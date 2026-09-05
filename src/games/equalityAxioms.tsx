/**
 * The equality axioms E_φ — ln.pdf §4.4, Example 4.36, Exercise 9 question 2.
 *
 * Ordinary resolution treats `=` as just another predicate, so it has to be
 * *told* what equality means. The schema on p.84 does that: reflexivity,
 * symmetry, transitivity, one congruence axiom per function symbol, and one per
 * predicate symbol. Add them and Theorem 4.37 says the enriched formula has a
 * model exactly when the original has a normal one.
 *
 * The point of playing it is the size. Every symbol in the language costs an
 * axiom, and the set grows faster than the problem does — which is exactly the
 * argument for paramodulation.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  equalityAxioms,
  findFoRefutation,
  herbrandLanguage,
  parseFoClauseSet,
  showFoClause,
  type FoClause,
  type FoSignature,
  type Signature,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'
import { Pop, ProgressBar } from '@/ui/motion'
import { EqualityAxiomsGuide } from './equalityAxioms.guide'

export interface EqualityAxiomsQuestion {
  predicates: Record<string, number>
  functions: Signature
  clauses: string[]
  /** The full axiom set, printed, in the schema's own order. */
  axioms: string[]
  /** The fewest axioms that let resolution refute the set. */
  par: number
}

/** Indices into `axioms` that were added. */
export type EqualityAxiomsAnswer = number[]

const signatureOf = (question: EqualityAxiomsQuestion): FoSignature => ({
  predicates: { ...question.predicates, '=': 2 },
  functions: question.functions,
})

export const clausesOf = (question: EqualityAxiomsQuestion): FoClause[] =>
  parseFoClauseSet(question.clauses, signatureOf(question))

export const axiomsOf = (question: EqualityAxiomsQuestion): FoClause[] =>
  parseFoClauseSet(question.axioms, signatureOf(question))

/** What each axiom of the schema is called, in the order they are generated. */
export function axiomLabels(question: EqualityAxiomsQuestion): string[] {
  const language = herbrandLanguage(clausesOf(question))
  const predicates = new Set<string>()
  for (const clause of clausesOf(question)) {
    for (const literal of clause) {
      if (literal.predicate === '=') continue
      predicates.add(literal.predicate)
    }
  }
  return [
    'reflexivity',
    'symmetry',
    'transitivity',
    ...language.functions.map(([name]) => `congruence for ${name}`),
    ...[...predicates].map((name) => `congruence for ${name}`),
  ]
}

/**
 * A saturation with equality axioms in it is expensive, and this game asks for
 * one on every render and for every subset when searching. Both are pure
 * functions of the clause set and the chosen axioms, so both are cached.
 *
 * Without this the screen re-ran a refutation search on each keystroke and the
 * generator ran 2^n of them per question — enough to hang a round.
 */
const REFUTES = new Map<string, boolean>()
const SMALLEST = new Map<string, number[] | null>()

/** Small sets, so a small budget: subsumption prunes the rest. */
const BUDGET = 120

/** Does the clause set plus these axioms refute? */
export const refutesWith = (
  question: EqualityAxiomsQuestion,
  chosen: readonly number[],
): boolean => {
  const picked = [...new Set(chosen)].sort((a, b) => a - b)
  const key = `${question.clauses.join(';')}|${picked.join(',')}`
  const cached = REFUTES.get(key)
  if (cached !== undefined) return cached

  const axioms = axiomsOf(question)
  const clauses = picked
    .map((index) => axioms[index])
    .filter((clause): clause is FoClause => clause !== undefined)
  const result = findFoRefutation([...clausesOf(question), ...clauses], BUDGET).refuted
  REFUTES.set(key, result)
  return result
}

/** The smallest set of axioms that does. */
export function smallestSet(question: EqualityAxiomsQuestion): number[] | null {
  const key = question.clauses.join(';')
  const cached = SMALLEST.get(key)
  if (cached !== undefined) return cached

  const axioms = axiomsOf(question)
  const all = axioms.map((_, index) => index)
  let found: number[] | null = null
  outer: for (let size = 0; size <= all.length; size++) {
    for (const subset of choose(all, size)) {
      if (refutesWith(question, subset)) {
        found = subset
        break outer
      }
    }
  }
  SMALLEST.set(key, found)
  return found
}

function* choose(items: readonly number[], size: number): Generator<number[]> {
  if (size === 0) {
    yield []
    return
  }
  for (let index = 0; index <= items.length - size; index++) {
    for (const rest of choose(items.slice(index + 1), size - 1)) {
      yield [items[index] as number, ...rest]
    }
  }
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  predicates: Record<string, number>
  functions: Signature
  sets: string[][]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    predicates: { p: 1 },
    functions: { a: 0, b: 0 },
    sets: [
      ['p(a())', '¬p(b())', '=(a(),b())'],
      ['p(a())', '¬p(b())', '=(b(),a())'],
    ],
  },
  medium: {
    predicates: { p: 1, q: 1 },
    functions: { a: 0, b: 0, c: 0 },
    sets: [
      ['p(a())', '¬p(c())', '=(a(),b())', '=(b(),c())'],
      ['q(a())', '¬q(b())', '=(b(),a())'],
    ],
  },
  hard: {
    predicates: { p: 1 },
    functions: { a: 0, b: 0, f: 1 },
    sets: [
      ['p(f(a()))', '¬p(f(b()))', '=(a(),b())'],
      ['p(a())', '¬p(f(b()))', '=(a(),b())', '=(b(),f(b()))'],
    ],
  },
}

function generate({ rng, difficulty }: GenerateContext): EqualityAxiomsQuestion {
  const profile = PROFILES[difficulty]
  const signature: FoSignature = {
    predicates: { ...profile.predicates, '=': 2 },
    functions: profile.functions,
  }

  for (const set of rng.shuffle(profile.sets)) {
    let clauses: FoClause[]
    try {
      clauses = parseFoClauseSet(set, signature)
    } catch {
      continue
    }
    // Without the axioms it must *not* refute, or the exercise has no point.
    if (findFoRefutation(clauses, 200).refuted) continue

    const axioms = equalityAxioms(clauses).map(showFoClause)
    const question: EqualityAxiomsQuestion = {
      predicates: profile.predicates,
      functions: profile.functions,
      clauses: set,
      axioms,
      par: 0,
    }
    if (axioms.length > 6) continue
    const smallest = smallestSet(question)
    if (smallest === null || smallest.length === 0) continue

    return { ...question, par: smallest.length }
  }

  const fallback = ['p(a())', '¬p(b())', '=(a(),b())']
  const signature2: FoSignature = {
    predicates: { p: 1, '=': 2 },
    functions: { a: 0, b: 0 },
  }
  const clauses = parseFoClauseSet(fallback, signature2)
  const question: EqualityAxiomsQuestion = {
    predicates: { p: 1 },
    functions: { a: 0, b: 0 },
    clauses: fallback,
    axioms: equalityAxioms(clauses).map(showFoClause),
    par: 0,
  }
  return { ...question, par: smallestSet(question)?.length ?? 1 }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: EqualityAxiomsQuestion): EqualityAxiomsAnswer =>
  smallestSet(question) ?? question.axioms.map((_, index) => index)

function check(question: EqualityAxiomsQuestion, answer: EqualityAxiomsAnswer): Verdict {
  if (!refutesWith(question, answer)) {
    return {
      correct: false,
      // Says only that it is not enough, never which axiom is missing.
      message:
        answer.length === 0
          ? 'Resolution cannot refute this on its own'
          : `${answer.length} axiom${answer.length === 1 ? '' : 's'} is not enough`,
      score: Math.min(0.5, answer.length / Math.max(question.par, 1) / 2),
      detail:
        'Ask what the refutation needs to *do* with the equation: move it onto another term, turn it round, or chain two of them. Each of those is one axiom.',
    }
  }

  const size = new Set(answer).size
  return {
    correct: true,
    message:
      size === question.par
        ? `${size} axiom${size === 1 ? '' : 's'} — the fewest that work`
        : `Refuted with ${size}`,
    detail:
      size === question.par
        ? 'That is Theorem 4.37 in practice: the enriched set is unsatisfiable exactly when the original has no normal model.'
        : `${question.par} would have done. The full schema is always enough, which is why it is stated as a schema — and why it is so much bigger than the problem.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<EqualityAxiomsQuestion, EqualityAxiomsAnswer>) {
  const clauses = useMemo(() => clausesOf(question), [question])
  const axioms = useMemo(() => axiomsOf(question), [question])
  const labels = useMemo(() => axiomLabels(question), [question])
  const [chosen, setChosen] = useState<number[]>([])

  useEffect(() => {
    setChosen([])
  }, [question])

  const refuted = refutesWith(question, chosen)

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Teach resolution what = means
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {chosen.length} added · {question.par} is enough
        </p>
      </div>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        These clauses are contradictory only if equality behaves like equality. Add the axioms that
        make the contradiction reachable.
      </p>

      <div className="mt-2 flex flex-col gap-1">
        {clauses.map((clause, index) => (
          <div key={index} className="tile bg-card-shade px-3 py-1.5">
            <FoClauseText clause={clause} className="text-base font-bold" />
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
        The schema — one axiom per line
      </p>
      <div className="mt-1 flex flex-col gap-1">
        {axioms.map((axiom, index) => {
          const on = chosen.includes(index)
          return (
            <button
              key={index}
              type="button"
              disabled={locked}
              onClick={() =>
                setChosen((previous) =>
                  previous.includes(index)
                    ? previous.filter((entry) => entry !== index)
                    : [...previous, index],
                )
              }
              className={`tile flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left
                ${on ? 'bg-space-blue text-white' : 'bg-card'}`}
            >
              <FoClauseText
                clause={axiom}
                className={`text-sm font-bold ${on ? 'text-white' : ''}`}
              />
              <span className="text-[0.6rem] font-bold uppercase tracking-wider opacity-70">
                {labels[index] ?? 'congruence'}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-2">
        <ProgressBar value={Math.min(chosen.length, question.par)} total={question.par} />
      </div>

      <p
        className={`mt-2 rounded-xl px-3 py-1.5 text-xs font-bold ${
          refuted ? 'bg-grass text-white' : 'bg-card-shade text-ink-soft'
        }`}
      >
        {refuted
          ? 'Resolution now derives ⊥ from this set.'
          : 'Resolution still cannot derive ⊥ from this set.'}
      </p>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            {question.par} axiom{question.par === 1 ? '' : 's'} is enough
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {(smallestSet(question) ?? []).map((index) => (
              <li key={index} className="text-xs font-semibold text-ink-soft">
                {labels[index] ?? 'congruence'} — {question.axioms[index]}
              </li>
            ))}
          </ul>
        </Pop>
      )}

      {!locked && (
        <Button
          variant={refuted ? 'coin' : 'secondary'}
          className="mt-3 w-full"
          onClick={() => submit(chosen)}
        >
          {refuted ? `Submit — ${chosen.length} axioms` : 'Submit anyway'}
        </Button>
      )}
    </Card>
  )
}

export const equalityAxiomsGame = defineMinigame<EqualityAxiomsQuestion, EqualityAxiomsAnswer>({
  id: 'equality-axioms',
  title: 'Teach It Equality',
  tagline: 'Resolution knows nothing about =. Say what it means, one axiom at a time.',
  topics: ['fo-equality'],
  icon: '🟰',
  roundSeconds: 210,
  sprintQuestions: 5,
  generate,
  check,
  solve,
  Screen,
  Guide: EqualityAxiomsGuide,
  questionKey: (question) => question.clauses.join(';'),
})
