/**
 * Count the models — ln.pdf §2.1 Definition 2.6, exam25a Q1.1a, Exercise 1.
 *
 * The method the game is built to teach is *not* "write out the truth table".
 * Sixteen rows under exam pressure is how you run out of time. It is:
 *
 *   1. propagate the units — they force values, and cost nothing;
 *   2. enumerate only what is left, which is now small;
 *   3. multiply by 2 for every variable nothing constrains.
 *
 * Step 3 is the one that loses marks. "How many models" is a question about a
 * formula *and a set of variables*; a variable the formula never mentions is
 * free and doubles the count.
 */

import { useEffect, useState, type ReactNode } from 'react'
import type { Clause } from '@/logic'
import {
  clauseSetToFormula,
  countModels,
  countModelsOver,
  isTautologicalClause,
  literalsEqual,
  showClauseSet,
  sortedVariables,
  unitPropagate,
  type ForcedAssignment,
  type Rng,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FormulaText, VariableName } from '@/ui/FormulaText'
import { ModelCountGuide } from './modelCount.guide'

export interface ModelCountQuestion {
  /**
   * The clause set itself, not a Formula.
   *
   * The exam always asks this about a CNF, and keeping the clauses means
   * nothing ever has to run `toCNF` on a formula that is already in CNF —
   * where any simplification it chose to do would quietly change the question.
   */
  clauses: Clause[]
  /**
   * The variables under discussion, which may be more than the formula
   * mentions. Stated explicitly because without it the question has no answer.
   */
  variables: string[]
}

/** The clause set as one formula, for display and for the semantics helpers. */
export const questionFormula = (question: ModelCountQuestion) => clauseSetToFormula(question.clauses)

export type ModelCountAnswer = number

// ---------------------------------------------------------------------------
// The method, as data — this drives both the marking and the explanation
// ---------------------------------------------------------------------------

export interface CountTrace {
  /** Variables unit propagation forced, in order. */
  forced: readonly ForcedAssignment[]
  /** What propagation left behind. */
  remaining: Clause[]
  remainingVariables: string[]
  /** Models of the remaining clauses, over the variables they mention. */
  remainingModels: number
  /** Variables nothing constrains: each doubles the count. */
  free: string[]
  total: number
}

/**
 * Work the count out the way a person should, and keep the working.
 *
 * A test asserts this agrees with `countModelsOver` on every generated
 * question, so the shortcut the game teaches is verified against the
 * definition rather than trusted.
 */
export function trace(question: ModelCountQuestion): CountTrace {
  const propagation = unitPropagate(question.clauses)
  const remainingVariables = sortedVariables(clauseSetToFormula(propagation.remaining))
  const constrained = new Set([...propagation.forced.map((f) => f.name), ...remainingVariables])
  const free = question.variables.filter((name) => !constrained.has(name))

  if (propagation.conflict) {
    return {
      forced: propagation.forced,
      remaining: propagation.remaining,
      remainingVariables,
      remainingModels: 0,
      free,
      total: 0,
    }
  }

  const remainingModels =
    propagation.remaining.length === 0 ? 1 : countModels(clauseSetToFormula(propagation.remaining))

  return {
    forced: propagation.forced,
    remaining: propagation.remaining,
    remainingVariables,
    remainingModels,
    free,
    total: remainingModels * 2 ** free.length,
  }
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  /** Size of the variable universe the question asks about. */
  universe: number
  clauses: [min: number, max: number]
  width: [min: number, max: number]
  units: [min: number, max: number]
  /** How many of the universe's variables the formula is allowed to ignore. */
  freeVariables: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { universe: 3, clauses: [2, 3], width: [1, 2], units: [1, 2], freeVariables: [0, 0] },
  medium: { universe: 4, clauses: [3, 4], width: [1, 3], units: [1, 2], freeVariables: [0, 1] },
  hard: { universe: 5, clauses: [4, 6], width: [1, 3], units: [0, 2], freeVariables: [0, 1] },
}

const POOL = ['a', 'b', 'c', 'd', 'e'] as const

const sameClause = (a: Clause, b: Clause): boolean =>
  a.length === b.length && a.every((literal) => b.some((other) => literalsEqual(literal, other)))

function buildClauseSet(rng: Rng, profile: Profile, available: string[]): Clause[] | null {
  const count = rng.range(...profile.clauses)
  const units = Math.min(rng.range(...profile.units), count)
  const set: Clause[] = []

  for (let index = 0; index < count; index++) {
    const width =
      index < units ? 1 : Math.min(rng.range(...profile.width), available.length)
    const names = rng.sample(available, width)
    const clause: Clause = names.map((name) => ({ name, negated: rng.bool() }))

    // A tautological clause is satisfied by everything, so it constrains
    // nothing and is pure noise in a counting question.
    if (isTautologicalClause(clause)) return null
    if (set.some((existing) => sameClause(existing, clause))) return null
    set.push(clause)
  }

  // Every variable of the universe the formula is *supposed* to mention must
  // actually appear, or the free-variable count silently changes.
  const mentioned = new Set(set.flatMap((clause) => clause.map((literal) => literal.name)))
  if (available.some((name) => !mentioned.has(name))) return null

  return rng.shuffle(set)
}

const ATTEMPTS = 300

function generate({ rng, difficulty }: GenerateContext): ModelCountQuestion {
  const profile = PROFILES[difficulty]
  const variables: string[] = POOL.slice(0, profile.universe)

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const free = rng.range(...profile.freeVariables)
    const available = rng.sample(variables, variables.length - free)
    if (available.length < 2) continue

    const set = buildClauseSet(rng, profile, available)
    if (set === null) continue

    const question: ModelCountQuestion = {
      clauses: set,
      variables: [...variables].sort((a, b) => a.localeCompare(b)),
    }

    const total = countModelsOver(questionFormula(question), question.variables)
    // Zero is a real and instructive answer, but a round full of them is not a
    // counting exercise. Keep it rare rather than impossible.
    if (total === 0 && !rng.bool(0.15)) continue
    // If almost everything is a model, propagation had nothing to do and the
    // question degenerates into "how many assignments are there".
    if (total >= 2 ** profile.universe) continue

    return question
  }

  // Last resort, so a round can never stall: the exam's own question.
  return {
    clauses: [
      [{ name: 'a', negated: false }],
      [{ name: 'b', negated: false }],
      [
        { name: 'c', negated: false },
        { name: 'd', negated: false },
      ],
      [
        { name: 'c', negated: true },
        { name: 'd', negated: false },
      ],
    ],
    variables: ['a', 'b', 'c', 'd'],
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: ModelCountQuestion): ModelCountAnswer =>
  countModelsOver(questionFormula(question), question.variables)

function explain(question: ModelCountQuestion): string {
  const t = trace(question)
  const parts: string[] = []

  if (t.forced.length > 0) {
    parts.push(
      `Units force ${t.forced.map((f) => `${f.name} = ${f.value ? 'T' : 'F'}`).join(', ')}`,
    )
  }
  if (t.remainingVariables.length > 0) {
    parts.push(
      `${t.remainingModels} of ${2 ** t.remainingVariables.length} ways to set ${t.remainingVariables.join(', ')}`,
    )
  }
  if (t.free.length > 0) {
    parts.push(`${t.free.join(', ')} ${t.free.length === 1 ? 'is' : 'are'} free, so ×${2 ** t.free.length}`)
  }

  return parts.length === 0 ? `${t.total} models.` : `${parts.join(' · ')} = ${t.total}.`
}

function check(question: ModelCountQuestion, answer: ModelCountAnswer): Verdict {
  const expected = solve(question)
  if (answer === expected) {
    // No detail: the screen shows the three steps worked out in full the
    // moment the round locks, and repeating them here prints them twice.
    return { correct: true, message: `${expected} model${expected === 1 ? '' : 's'}` }
  }

  const t = trace(question)
  // The most common wrong answer by far is the count over the variables the
  // formula happens to mention, i.e. forgetting the free ones. Say so, because
  // "you are out by a factor of two" is a different lesson from "you counted
  // the rows wrong".
  const missedFree = t.free.length > 0 && answer === expected / 2 ** t.free.length
  return {
    correct: false,
    message: 'Not the right count',
    detail: missedFree
      ? `${answer} is the count over just the variables the formula mentions. ${t.free.join(', ')} ${
          t.free.length === 1 ? 'appears' : 'appear'
        } nowhere in it, so ${t.free.length === 1 ? 'it is' : 'they are'} free and ${
          t.free.length === 1 ? 'doubles' : `multiplies`
        } the count: the answer is ${expected}. ${explain(question)}`
      : `The answer is ${expected}. ${explain(question)}`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const MAX_DIGITS = 3

function Keypad({ onDigit, onClear, disabled }: { onDigit: (d: string) => void; onClear: () => void; disabled: boolean }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
        <Button key={digit} variant="secondary" disabled={disabled} onClick={() => onDigit(digit)} className="px-0 text-xl">
          {digit}
        </Button>
      ))}
      <Button variant="secondary" disabled={disabled} onClick={onClear} className="px-0 text-base">
        clear
      </Button>
      <Button variant="secondary" disabled={disabled} onClick={() => onDigit('0')} className="px-0 text-xl">
        0
      </Button>
      <span />
    </div>
  )
}

function Working({ question }: { question: ModelCountQuestion }) {
  const t = trace(question)

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-card-shade p-3 text-sm font-medium">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">How it comes out</p>

      <Line n={1} label="Units force">
        {t.forced.length === 0 ? (
          <span className="text-ink-soft">nothing — no unit clauses</span>
        ) : (
          t.forced.map((f) => (
            <span key={f.name} className="mr-2 whitespace-nowrap">
              <VariableName name={f.name} /> = {f.value ? 'T' : 'F'}
            </span>
          ))
        )}
      </Line>

      <Line n={2} label="What is left">
        {t.remaining.length === 0 ? (
          <span className="text-ink-soft">nothing — every clause is satisfied</span>
        ) : (
          <>
            <FormulaText formula={clauseSetToFormula(t.remaining)} />
            <span className="ml-2 whitespace-nowrap text-ink-soft">
              → {t.remainingModels} of {2 ** t.remainingVariables.length}
            </span>
          </>
        )}
      </Line>

      <Line n={3} label="Free variables">
        {t.free.length === 0 ? (
          <span className="text-ink-soft">none — every variable is constrained</span>
        ) : (
          <>
            {t.free.map((name) => (
              <VariableName key={name} name={name} className="mr-2" />
            ))}
            <span className="whitespace-nowrap">× {2 ** t.free.length}</span>
          </>
        )}
      </Line>

      <p className="mt-1 border-t-2 border-dashed border-ink-soft/40 pt-2 text-base font-bold">
        {t.remainingModels} × {2 ** t.free.length} = {t.total} model{t.total === 1 ? '' : 's'}
      </p>
    </div>
  )
}

function Line({ n, label, children }: { n: number; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="space flex h-6 w-6 shrink-0 items-center justify-center bg-coin text-xs font-bold">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <span className="font-bold">{label}: </span>
        {children}
      </div>
    </div>
  )
}

function Screen({ question, submit, locked }: MinigameScreenProps<ModelCountQuestion, ModelCountAnswer>) {
  const [entry, setEntry] = useState('')

  useEffect(() => {
    setEntry('')
  }, [question])

  const mentioned = new Set(sortedVariables(questionFormula(question)))

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        How many models?
      </p>
      <p className="mt-1 text-xl leading-snug font-semibold text-balance text-ink">
        <FormulaText formula={questionFormula(question)} />
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-card-shade px-3 py-2">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">Over</span>
        {question.variables.map((name) => (
          <span
            key={name}
            className={`rounded-full px-2 py-0.5 text-base font-bold ${
              mentioned.has(name) ? 'bg-white' : 'bg-coin'
            }`}
            title={mentioned.has(name) ? undefined : 'Never mentioned — this one is free'}
          >
            <VariableName name={name} />
          </span>
        ))}
        <span className="text-xs font-semibold text-ink-soft">
          {question.variables.length} variables · {2 ** question.variables.length} assignments
        </span>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <span
          className={`tile flex h-16 min-w-28 items-center justify-center bg-white text-3xl font-bold tabular-nums ${
            entry === '' ? 'text-ink-soft' : 'text-ink'
          }`}
        >
          {entry === '' ? '?' : entry}
        </span>
      </div>

      {!locked && (
        <>
          <Keypad
            disabled={locked}
            onClear={() => setEntry('')}
            onDigit={(digit) =>
              setEntry((previous) =>
                previous.length >= MAX_DIGITS ? previous : previous === '0' ? digit : previous + digit,
              )
            }
          />
          <Button
            variant="coin"
            className="mt-3 w-full"
            disabled={entry === ''}
            onClick={() => submit(Number(entry))}
          >
            {entry === '' ? 'Type a number' : `Answer ${entry}`}
          </Button>
        </>
      )}

      {locked && <Working question={question} />}
    </Card>
  )
}

export const modelCountGame = defineMinigame<ModelCountQuestion, ModelCountAnswer>({
  id: 'model-count',
  title: 'Model Count',
  tagline: 'Propagate the units, count what is left.',
  topics: ['satisfiability'],
  icon: '🔢',
  roundSeconds: 150,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  Screen,
  Guide: ModelCountGuide,
  questionKey: (question) => `${question.variables.join('')}|${showClauseSet(question.clauses)}`,
})
