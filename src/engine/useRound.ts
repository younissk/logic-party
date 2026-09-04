/**
 * The round runner.
 *
 * Owns everything that is the same for every minigame: dealing seeded
 * questions, the per-question timer, checking, scoring, recording progress
 * and advancing. A minigame never touches any of it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deriveSeed, makeRng } from '@/logic'
import { recordAttempt } from '@/store/progress'
import type { AnyMinigame, Difficulty, Verdict } from './types'
import { DEFAULT_QUESTIONS_PER_ROUND } from './types'

export interface RoundOptions {
  game: AnyMinigame
  difficulty: Difficulty
  seed: string
  questionCount?: number
  /** Skip writing to the progress store — used by the party mode preview. */
  practiceOnly?: boolean
}

export interface RoundState {
  index: number
  total: number
  question: unknown
  solution: unknown
  verdict: Verdict | null
  locked: boolean
  /** Null when the minigame is untimed. */
  secondsLeft: number | null
  /** Sum of per-question scores so far. */
  score: number
  correctCount: number
  /** True once the last question has been answered. */
  finished: boolean
  /** Set when a question could not be generated at all. */
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
  const total = options.questionCount ?? game.questionsPerRound ?? DEFAULT_QUESTIONS_PER_ROUND

  const [seed, setSeed] = useState(options.seed)
  const [index, setIndex] = useState(0)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)

  // A fresh seed from the caller (a new round) resets everything.
  const previousSeed = useRef(options.seed)
  useEffect(() => {
    if (previousSeed.current !== options.seed) {
      previousSeed.current = options.seed
      setSeed(options.seed)
      setIndex(0)
      setVerdict(null)
      setScore(0)
      setCorrectCount(0)
      setFinished(false)
    }
  }, [options.seed])

  /**
   * All questions are dealt up front from the round seed, so the round is
   * reproducible and every player in a party match gets the same deal.
   */
  const dealt = useMemo(() => {
    try {
      const questions = Array.from({ length: total }, (_, questionIndex) => {
        const rng = makeRng(deriveSeed(seed, game.id, difficulty, questionIndex))
        const question = game.generate({ rng, difficulty, questionIndex })
        return { question, solution: game.solve(question) }
      })
      return { questions, error: null as string | null }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      return { questions: [], error: `Could not build this round: ${message}` }
    }
  }, [game, difficulty, seed, total])

  const current = dealt.questions[index]
  const locked = verdict !== null

  // Per-question countdown.
  const limit = game.secondsPerQuestion ?? null
  const [secondsLeft, setSecondsLeft] = useState<number | null>(limit)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    startedAt.current = Date.now()
    setSecondsLeft(limit)
  }, [index, limit, seed])

  const finish = useCallback(
    (result: Verdict) => {
      const questionScore = scoreOf(result)
      setVerdict(result)
      setScore((previous) => previous + questionScore)
      if (result.correct) setCorrectCount((previous) => previous + 1)

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
    [difficulty, game.id, game.topics, index, practiceOnly, seed],
  )

  useEffect(() => {
    if (limit === null || locked || finished || !current) return

    const timer = window.setInterval(() => {
      setSecondsLeft((remaining) => {
        if (remaining === null) return null
        if (remaining > 1) return remaining - 1
        return 0
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [limit, locked, finished, current, index])

  // Separated from the tick so `finish` runs once, outside the interval callback.
  useEffect(() => {
    if (secondsLeft === 0 && !locked && !finished && current) {
      finish({ correct: false, message: 'Out of time', score: 0 })
    }
  }, [secondsLeft, locked, finished, current, finish])

  const submit = useCallback(
    (answer: unknown) => {
      if (locked || !current) return
      try {
        finish(game.check(current.question, answer))
      } catch (cause) {
        // A throwing checker is a bug in the minigame, not a wrong answer.
        const message = cause instanceof Error ? cause.message : String(cause)
        finish({ correct: false, message: 'Could not check that answer', detail: message, score: 0 })
      }
    },
    [current, finish, game, locked],
  )

  const reveal = useCallback(() => {
    if (locked || !current) return
    finish({ correct: false, message: 'Revealed', detail: 'Skipped — this one counts as wrong.', score: 0 })
  }, [current, finish, locked])

  const next = useCallback(() => {
    if (index + 1 >= total) {
      setFinished(true)
      return
    }
    setIndex((previous) => previous + 1)
    setVerdict(null)
  }, [index, total])

  const restart = useCallback((nextSeed?: string) => {
    setSeed((previous) => nextSeed ?? previous)
    setIndex(0)
    setVerdict(null)
    setScore(0)
    setCorrectCount(0)
    setFinished(false)
  }, [])

  return {
    index,
    total,
    question: current?.question ?? null,
    solution: locked ? (current?.solution ?? null) : null,
    verdict,
    locked,
    secondsLeft,
    score,
    correctCount,
    finished,
    error: dealt.error,
    submit,
    reveal,
    next,
    restart,
  }
}
