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
import { recordAttempt, submitScore } from '@/store/progress'
import type { AnyMinigame, Difficulty, Verdict } from './types'
import { DEFAULT_QUESTIONS_PER_ROUND, DEFAULT_ROUND_SECONDS, SCORING } from './types'

export interface RoundOptions {
  game: AnyMinigame
  difficulty: Difficulty
  seed: string
  questionCount?: number
  /** Skip writing to the progress store — used by the party mode preview. */
  practiceOnly?: boolean
}

/** What the last answer earned, for the feedback banner. */
export interface Award {
  points: number
  comboBonus: number
  combo: number
}

export interface RoundState {
  format: 'time-attack' | 'fixed'
  index: number
  /** Null in time-attack: the round is as long as the clock allows. */
  total: number | null
  question: unknown
  solution: unknown
  verdict: Verdict | null
  locked: boolean
  /** Whole-round countdown in time-attack, per-question in fixed mode. */
  secondsLeft: number | null
  /** Fraction of the clock remaining, 0-1. For the time bar. */
  timeFraction: number
  points: number
  lastAward: Award | null
  combo: number
  bestCombo: number
  answered: number
  correctCount: number
  finished: boolean
  /** Set once the round ends, if the score beat the stored best. */
  isNewBest: boolean
  error: string | null
  submit: (answer: unknown) => void
  /** Give up on this question: locks it and reveals the solution. */
  reveal: () => void
  next: () => void
  restart: (seed?: string) => void
}

const scoreOf = (verdict: Verdict): number => verdict.score ?? (verdict.correct ? 1 : 0)

export function useRound(options: RoundOptions): RoundState {
  const { game, difficulty, practiceOnly = false } = options

  const format = game.format ?? 'time-attack'
  const total =
    format === 'fixed'
      ? (options.questionCount ?? game.questionsPerRound ?? DEFAULT_QUESTIONS_PER_ROUND)
      : null
  const roundSeconds = game.roundSeconds ?? DEFAULT_ROUND_SECONDS
  const questionSeconds = game.secondsPerQuestion ?? null

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
    format === 'time-attack' ? roundSeconds : questionSeconds,
  )

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
      setSecondsLeft(format === 'time-attack' ? roundSeconds : questionSeconds)
    },
    [format, questionSeconds, roundSeconds],
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
  const startedAt = useRef(Date.now())

  // Fixed mode gives each question its own clock; time-attack does not.
  useEffect(() => {
    startedAt.current = Date.now()
    if (format === 'fixed') setSecondsLeft(questionSeconds)
  }, [index, format, questionSeconds, seed])

  const endRound = useCallback(
    (finalPoints: number) => {
      setFinished(true)
      if (format === 'time-attack' && !practiceOnly) {
        setIsNewBest(submitScore(game.id, difficulty, finalPoints))
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

      setVerdict(result)
      setLastAward({ points: delta, comboBonus, combo: nextCombo })
      setCombo(nextCombo)
      setBestCombo((previous) => Math.max(previous, nextCombo))
      setAnswered((previous) => previous + 1)
      if (result.correct) setCorrectCount((previous) => previous + 1)
      // Clamped at zero: a run of bad luck should not bury the score so deep
      // that the rest of the round stops mattering.
      setPoints((previous) => Math.max(0, previous + delta))

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
          ms: Date.now() - startedAt.current,
        })
      }
    },
    [combo, difficulty, game.id, game.topics, index, practiceOnly, seed],
  )

  // The clock. In time-attack it keeps running while feedback is on screen.
  useEffect(() => {
    if (secondsLeft === null || finished) return
    if (format === 'fixed' && locked) return

    const timer = window.setInterval(() => {
      setSecondsLeft((remaining) => (remaining === null ? null : Math.max(0, remaining - 1)))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [format, locked, finished, secondsLeft === null, index])

  // Kept out of the tick so the end-of-clock effect runs exactly once.
  useEffect(() => {
    if (secondsLeft !== 0 || finished) return

    if (format === 'time-attack') {
      endRound(points)
      return
    }
    if (!locked && current) {
      finish({ correct: false, message: 'Out of time', score: 0 })
    }
  }, [secondsLeft, finished, format, locked, current, finish, endRound, points])

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
    finish({ correct: false, message: 'Skipped', detail: 'A skip counts as a wrong answer.', score: 0 })
  }, [current, finish, finished, locked])

  const next = useCallback(() => {
    if (total !== null && index + 1 >= total) {
      endRound(points)
      return
    }
    setIndex((previous) => previous + 1)
    setVerdict(null)
  }, [endRound, index, points, total])

  const restart = useCallback(
    (nextSeed?: string) => {
      reset(nextSeed ?? seed)
    },
    [reset, seed],
  )

  const clockLength = format === 'time-attack' ? roundSeconds : (questionSeconds ?? 0)

  return {
    format,
    index,
    total,
    question: current?.question ?? null,
    solution: locked ? (current?.solution ?? null) : null,
    verdict,
    locked,
    secondsLeft,
    timeFraction: clockLength > 0 && secondsLeft !== null ? secondsLeft / clockLength : 1,
    points,
    lastAward,
    combo,
    bestCombo,
    answered,
    correctCount,
    finished,
    isNewBest,
    error: dealt.error,
    submit,
    reveal,
    next,
    restart,
  }
}
