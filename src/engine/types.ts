/**
 * The minigame contract.
 *
 * Everything in the app that is *not* the logic of a specific exercise —
 * seeding, timing, scoring, feedback, progress tracking, the party board —
 * is written once against this interface. Adding an exercise means
 * implementing `generate`, `check`, `solve` and a `Screen`; nothing else in
 * the codebase needs to know it exists.
 */

import type { ComponentType } from 'react'
import type { Rng } from '@/logic'

export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

/**
 * Exam topics. A minigame declares which it drills, so progress tracking can
 * answer "which topic am I worst at" and pick the next round accordingly.
 */
export type Topic =
  | 'syntax'
  | 'truth-tables'
  | 'equivalence'
  | 'normal-forms'
  | 'satisfiability'
  | 'entailment'
  | 'resolution'
  | 'proof-systems'

export const TOPIC_LABELS: Readonly<Record<Topic, string>> = {
  syntax: 'Syntax & parsing',
  'truth-tables': 'Truth tables',
  equivalence: 'Equivalence',
  'normal-forms': 'Normal forms',
  satisfiability: 'Satisfiability',
  entailment: 'Entailment',
  resolution: 'Resolution',
  'proof-systems': 'Proof systems',
}

export interface Verdict {
  correct: boolean
  /** One line, shown the moment the answer is submitted. */
  message: string
  /** Optional worked explanation — the witness, the offending row, the rule. */
  detail?: string
  /**
   * Partial credit in [0, 1] for multi-part answers such as a truth table.
   * Defaults to 1 when correct, 0 when not.
   */
  score?: number
}

export interface GenerateContext {
  /** Seeded — the same context always produces the same question. */
  rng: Rng
  difficulty: Difficulty
  /** 0-based index of this question within the round. */
  questionIndex: number
}

export interface MinigameScreenProps<Question, Answer> {
  question: Question
  difficulty: Difficulty
  /** Hand an answer to the runner; it checks, scores and shows feedback. */
  submit: (answer: Answer) => void
  /** True once answered or timed out — the screen must go read-only. */
  locked: boolean
  /** Null until the answer is submitted. */
  verdict: Verdict | null
  /** The reference answer, revealed after locking. */
  solution: Answer | null
}

/**
 * How a round is structured.
 *
 * 'time-attack' is the default and the house format: one clock for the whole
 * round, unlimited questions, points for correct answers and a penalty for
 * wrong ones. You are playing against your own best score.
 *
 * 'fixed' is for exercises where rushing defeats the point — building a
 * natural deduction proof, say. A set number of questions, each with its own
 * optional clock.
 */
export type RoundFormat = 'time-attack' | 'fixed'

/** Seconds in a time-attack round when a minigame does not say otherwise. */
export const DEFAULT_ROUND_SECONDS = 120

export const SCORING = {
  /** Awarded for a correct answer, before any combo bonus. */
  correct: 100,
  /**
   * Flat deduction for a wrong answer. Flat rather than scaled by partial
   * credit: the penalty has to be felt to make rushing a real risk. Partial
   * credit is still recorded against the topic, it just does not soften this.
   */
  wrong: 50,
  /** Added per consecutive correct answer beyond the first. */
  comboStep: 25,
  /** Ceiling on the combo bonus, so a long streak cannot run away with it. */
  maxComboBonus: 100,
} as const

export interface Minigame<Question = unknown, Answer = unknown> {
  /** Stable identifier — used in URLs and saved progress, so never rename it. */
  readonly id: string
  readonly title: string
  /** One line explaining what the player does. */
  readonly tagline: string
  readonly topics: readonly Topic[]
  /** Emoji shown on the game card and party board. */
  readonly icon: string

  /** Defaults to 'time-attack'. */
  readonly format?: RoundFormat

  /** time-attack: seconds for the whole round. */
  readonly roundSeconds?: number

  /** fixed: seconds per question; null means untimed. */
  readonly secondsPerQuestion?: number | null
  /** fixed: how many questions a round contains. */
  readonly questionsPerRound?: number

  generate(context: GenerateContext): Question
  /** Must be pure and total — a wrong answer is a verdict, never an exception. */
  check(question: Question, answer: Answer): Verdict
  /** The reference answer. Powers "show me" and guarantees every question is solvable. */
  solve(question: Question): Answer
  /** Optional worked explanation shown after the answer is revealed. */
  explain?(question: Question): string

  /**
   * Identity of a question, for avoiding repeats inside one round.
   *
   * A time-attack round asks as many questions as the clock allows, and the
   * space an easy difficulty draws from is small, so the same question does
   * come up twice. That is jarring, and worse, farmable. When a minigame
   * provides this the runner re-draws until it gets something new.
   */
  questionKey?(question: Question): string

  readonly Screen: ComponentType<MinigameScreenProps<Question, Answer>>
}

/**
 * Type-erased minigame, for the registry and the runner.
 *
 * The question and answer types are only meaningful inside one game, so the
 * shared machinery deliberately does not know them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyMinigame = Minigame<any, any>

export const DEFAULT_QUESTIONS_PER_ROUND = 5
