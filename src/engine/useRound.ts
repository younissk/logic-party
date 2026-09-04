/**
 * The round runner.
 *
 * Owns everything that is the same for every minigame: dealing seeded
 * questions, the clock, checking, scoring, recording progress and advancing.
 * A minigame never touches any of it.
 *
 * Two formats, see RoundFormat. In time-attack the clock runs for the whole
 * round and never stops — including while feedback is on screen, which is
 * what makes reading the explanation a real decision rather than a free
 * pause.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deriveSeed, makeRng } from '@/logic'
import { recordAttempt, submitScore, submitTime } from '@/store/progress'
import type { AnyMinigame, Difficulty, RoundFormat, Verdict } from './types'
import { DEFAULT_ROUND_SECONDS, DEFAULT_SPRINT_QUESTIONS, SCORING } from './types'

export interface RoundOptions {
  game: AnyMinigame
  difficulty: Difficulty
  format: RoundFormat
  seed: string
  /** Override the sprint length. */
  questionCount?: number
  /** Skip writing to the progress store — used by the party mode preview. */
  practiceOnly?: boolean
}

/** What the last answer earned or cost, for the feedback banner. */
export interface Award {
  /** time-attack: points gained or lost. */
  points: number
  comboBonus: number
  combo: number
  /** sprint: seconds added to the finishing time. */
  penaltySeconds: number
}

export interface RoundState {
  format: RoundFormat
  index: number
  /** Null in time-attack: the round is as long as the clock allows. */
  total: number | null
  question: unknown
  solution: unknown
  verdict: Verdict | null
  locked: boolean
  /** time-attack: whole-round countdown. Null in sprint. */
  secondsLeft: number | null
  /** Fraction of the clock remaining, 0-1. For the time bar. */
  timeFraction: number
  /** sprint: stopwatch reading in ms, penalties included. Null in time-attack. */
  elapsedMs: number | null
  /** sprint: seconds added so far by wrong answers. */
  penaltySeconds: number
  points: number
  lastAward: Award | null
  combo: number
  bestCombo: number
  answered: number
  correctCount: number
  finished: boolean
  /** Set once the round ends, if the score or time beat the stored best. */
  isNewBest: boolean
  /** sprint: the finishing time in ms, once the round has ended. */
  finalMs: number | null
  error: string | null
  submit: (answer: unknown) => void
  /** Give up on this question: locks it and reveals the solution. */
  reveal: () => void
  next: () => void
  restart: (seed?: string) => void
}

const scoreOf = (verdict: Verdict): number => verdict.score ?? (verdict.correct ? 1 : 0)

export function useRound(options: RoundOptions): RoundState {
  const { game, difficulty, format, practiceOnly = false } = options

  const total =
    format === 'sprint'
      ? (options.questionCount ?? game.sprintQuestions ?? DEFAULT_SPRINT_QUESTIONS)
      : null
  const roundSeconds = game.roundSeconds ?? DEFAULT_ROUND_SECONDS

  const [seed, setSeed] = useState(options.seed)
  const [index, setIndex] = useState(0)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [points, setPoints] = useState(0)
  const [lastAward, setLastAward] = useState<Award | null>(null)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)
  const [isNewBest, setIsNewBest] = useState(false)

  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    format === 'time-attack' ? roundSeconds : null,
  )
  const [penaltySeconds, setPenaltySeconds] = useState(0)
  const [rawElapsedMs, setRawElapsedMs] = useState(0)
  /** Set the instant the last sprint question is answered; also stops the watch. */
  const [finalMs, setFinalMs] = useState<number | null>(null)

  const roundStartedAt = useRef(Date.now())

  const reset = useCallback(
    (nextSeed: string) => {
      setSeed(nextSeed)
      setIndex(0)
      setVerdict(null)
      setPoints(0)
      setLastAward(null)
      setCombo(0)
      setBestCombo(0)
      setAnswered(0)
      setCorrectCount(0)
      setFinished(false)
      setIsNewBest(false)
      setSecondsLeft(format === 'time-attack' ? roundSeconds : null)
      setPenaltySeconds(0)
      setRawElapsedMs(0)
      setFinalMs(null)
      roundStartedAt.current = Date.now()
    },
    [format, roundSeconds],
  )

  // A fresh seed from the caller (a new round) resets everything.
  const previousSeed = useRef(options.seed)
  useEffect(() => {
    if (previousSeed.current !== options.seed) {
      previousSeed.current = options.seed
      reset(options.seed)
    }
  }, [options.seed, reset])

  /**
   * Questions are generated on demand and cached by seed, difficulty and
   * index, so a time-attack round can run as long as the clock allows while
   * staying exactly reproducible.
   */
  const cache = useRef(new Map<string, { question: unknown; solution: unknown }>())
  /** Question keys already used, per round, so a round does not repeat itself. */
  const seenKeys = useRef(new Map<string, Set<string>>())

  /** Re-draws before accepting a repeat. A small pool can exhaust its space. */
  const DEDUPE_ATTEMPTS = 12

  const dealt = useMemo(() => {
    const roundKey = `${seed}:${game.id}:${difficulty}`
    const cacheKey = `${roundKey}:${index}`
    const cached = cache.current.get(cacheKey)
    if (cached) return { entry: cached, error: null as string | null }

    try {
      let seen = seenKeys.current.get(roundKey)
      if (!seen) {
        seen = new Set<string>()
        seenKeys.current.set(roundKey, seen)
      }

      let question: unknown = null
      for (let attempt = 0; attempt < DEDUPE_ATTEMPTS; attempt++) {
        // The salt keeps every draw reproducible: same seed, same sequence.
        const rng = makeRng(deriveSeed(seed, game.id, difficulty, index, attempt))
        question = game.generate({ rng, difficulty, questionIndex: index })

        if (!game.questionKey) break
        const key = game.questionKey(question)
        if (!seen.has(key)) {
          seen.add(key)
          break
        }
        // Out of attempts: accept the repeat rather than stall the round.
        if (attempt === DEDUPE_ATTEMPTS - 1) seen.add(key)
      }

      const entry = { question, solution: game.solve(question) }
      cache.current.set(cacheKey, entry)
      return { entry, error: null as string | null }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      return { entry: null, error: `Could not build this question: ${message}` }
    }
  }, [game, difficulty, seed, index])

  const current = dealt.entry
  const locked = verdict !== null
  const questionStartedAt = useRef(Date.now())

  useEffect(() => {
    questionStartedAt.current = Date.now()
  }, [index, seed])

  const endRound = useCallback(
    (finalPoints: number, finishingMs: number | null) => {
      setFinished(true)
      if (practiceOnly) return

      if (format === 'time-attack') {
        setIsNewBest(submitScore(game.id, difficulty, finalPoints))
      } else if (finishingMs !== null) {
        setIsNewBest(submitTime(game.id, difficulty, finishingMs))
      }
    },
    [difficulty, format, game.id, practiceOnly],
  )

  const finish = useCallback(
    (result: Verdict) => {
      const questionScore = scoreOf(result)
      const nextCombo = result.correct ? combo + 1 : 0
      const comboBonus = result.correct
        ? Math.min(SCORING.maxComboBonus, Math.max(0, nextCombo - 1) * SCORING.comboStep)
        : 0
      const delta = result.correct ? SCORING.correct + comboBonus : -SCORING.wrong
      const penalty = format === 'sprint' && !result.correct ? SCORING.sprintPenaltySeconds : 0

      setVerdict(result)
      setLastAward({ points: delta, comboBonus, combo: nextCombo, penaltySeconds: penalty })
      setCombo(nextCombo)
      setBestCombo((previous) => Math.max(previous, nextCombo))
      if (result.correct) setCorrectCount((previous) => previous + 1)
      // Clamped at zero: a run of bad luck should not bury the score so deep
      // that the rest of the round stops mattering.
      setPoints((previous) => Math.max(0, previous + delta))

      const totalPenalty = penaltySeconds + penalty
      if (penalty > 0) setPenaltySeconds(totalPenalty)

      const answeredNow = answered + 1
      setAnswered(answeredNow)

      // The stopwatch stops the moment the last answer lands, not when the
      // player finishes reading the feedback.
      if (format === 'sprint' && total !== null && answeredNow >= total) {
        setFinalMs(Date.now() - roundStartedAt.current + totalPenalty * 1000)
      }

      if (!practiceOnly) {
        recordAttempt({
          gameId: game.id,
          topics: [...game.topics],
          difficulty,
          correct: result.correct,
          score: questionScore,
          seed,
          questionIndex: index,
          at: Date.now(),
          ms: Date.now() - questionStartedAt.current,
        })
      }
    },
    [
      answered,
      combo,
      difficulty,
      format,
      game.id,
      game.topics,
      index,
      penaltySeconds,
      practiceOnly,
      seed,
      total,
    ],
  )

  // time-attack: the countdown, which keeps running while feedback is up.
  useEffect(() => {
    if (format !== 'time-attack' || finished) return
    const timer = window.setInterval(() => {
      setSecondsLeft((remaining) => (remaining === null ? null : Math.max(0, remaining - 1)))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [format, finished])

  // sprint: the stopwatch, stopped once the last answer has landed.
  useEffect(() => {
    if (format !== 'sprint' || finished || finalMs !== null) return
    const timer = window.setInterval(() => {
      setRawElapsedMs(Date.now() - roundStartedAt.current)
    }, 100)
    return () => window.clearInterval(timer)
  }, [format, finished, finalMs])

  // Kept out of the tick so the end-of-clock effect runs exactly once.
  useEffect(() => {
    if (format !== 'time-attack' || secondsLeft !== 0 || finished) return
    endRound(points, null)
  }, [secondsLeft, finished, format, endRound, points])

  const submit = useCallback(
    (answer: unknown) => {
      if (locked || finished || !current) return
      try {
        finish(game.check(current.question, answer))
      } catch (cause) {
        // A throwing checker is a bug in the minigame, not a wrong answer.
        const message = cause instanceof Error ? cause.message : String(cause)
        finish({ correct: false, message: 'Could not check that answer', detail: message, score: 0 })
      }
    },
    [current, finish, finished, game, locked],
  )

  const reveal = useCallback(() => {
    if (locked || finished || !current) return
    finish({
      correct: false,
      message: 'Skipped',
      detail:
        format === 'sprint'
          ? `A skip counts as wrong: +${SCORING.sprintPenaltySeconds}s.`
          : 'A skip counts as a wrong answer.',
      score: 0,
    })
  }, [current, finish, finished, format, locked])

  const next = useCallback(() => {
    if (total !== null && index + 1 >= total) {
      endRound(points, finalMs)
      return
    }
    setIndex((previous) => previous + 1)
    setVerdict(null)
  }, [endRound, finalMs, index, points, total])

  const restart = useCallback(
    (nextSeed?: string) => {
      reset(nextSeed ?? seed)
    },
    [reset, seed],
  )

  const elapsedMs =
    format === 'sprint' ? (finalMs ?? rawElapsedMs + penaltySeconds * 1000) : null

  return {
    format,
    index,
    total,
    question: current?.question ?? null,
    solution: locked ? (current?.solution ?? null) : null,
    verdict,
    locked,
    secondsLeft,
    timeFraction: format === 'time-attack' && secondsLeft !== null ? secondsLeft / roundSeconds : 1,
    elapsedMs,
    penaltySeconds,
    points,
    lastAward,
    combo,
    bestCombo,
    answered,
    correctCount,
    finished,
    isNewBest,
    finalMs,
    error: dealt.error,
    submit,
    reveal,
    next,
    restart,
  }
}
