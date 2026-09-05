/**
 * First-order resolution — ln.pdf §4.3, Definition 4.23, exam25a Q3.3,
 * exam26a Q3.2, Exercise 8 question 4.
 *
 * The propositional rule with unification bolted on: pick a positive literal in
 * one clause and a negative one in another, unify their atoms, and the mgu is
 * applied to everything that survives. Nothing is instantiated in advance —
 * only as much as this step needs, which is the whole improvement over
 * grounding everything first.
 *
 * The two clauses are renamed apart before unifying, always. Two clauses that
 * both happen to use `x` are not talking about the same x, and forgetting that
 * invents occurs-check failures that are not there.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  clauseVariants,
  findFoRefutation,
  foBinaryResolvents,
  foClauseVariables,
  parseFoClauseSet,
  renameClauseApart,
  showFoClause,
  showFoLiteral,
  showSubstitution,
  type FoClause,
  type FoLiteral,
  type FoSignature,
  type Signature,
  type Substitution,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'
import { MovingItem, MovingList, Pop, Shakeable, useShake } from '@/ui/motion'
import { FoResolutionGuide } from './foResolutionGame.guide'

export interface FoResolutionQuestion {
  predicates: Record<string, number>
  functions: Signature
  clauses: string[]
  /** How many resolution steps the shortest refutation takes. */
  par: number
}

/** The clauses derived, printed, in the order they were produced. */
export type FoResolutionAnswer = string[]

const signatureOf = (question: FoResolutionQuestion): FoSignature => ({
  predicates: question.predicates,
  functions: question.functions,
})

export const clausesOf = (question: FoResolutionQuestion): FoClause[] =>
  parseFoClauseSet(question.clauses, signatureOf(question))

/** Every resolvent of two clauses, with the pair and the mgu that produced it. */
export interface Step {
  clause: FoClause
  left: FoLiteral
  right: FoLiteral
  sigma: Substitution
}

export const stepsBetween = (first: FoClause, second: FoClause): Step[] =>
  foBinaryResolvents(first, second)

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
    predicates: { p: 1, q: 1 },
    functions: { a: 0, f: 1 },
    sets: [
      ['p(a())', '¬p(x)'],
      ['¬p(x) ∨ q(x)', 'p(a())', '¬q(a())'],
      ['p(f(x))', '¬p(f(a()))'],
    ],
  },
  medium: {
    predicates: { p: 2, q: 1 },
    functions: { a: 0, b: 0, f: 1 },
    sets: [
      ['p(x,x) ∨ ¬q(x)', '¬p(a(),y)', 'q(a())'],
      ['¬p(x,y) ∨ q(x)', 'p(a(),b())', '¬q(a())'],
      ['p(a(),f(a()))', '¬p(x,f(x)) ∨ q(x)', '¬q(a())'],
    ],
  },
  hard: {
    predicates: { p: 2, q: 1, r: 2 },
    functions: { a: 0, b: 0, f: 1, g: 1 },
    sets: [
      ['p(x,x) ∨ ¬q(x)', '¬p(a(),y)', 'p(z,b()) ∨ q(f(z))'],
      [
        'p(x,f(y)) ∨ q(y)',
        '¬q(a())',
        '¬p(b(),f(a())) ∨ r(z,x)',
        '¬r(g(a()),b()) ∨ q(y)',
      ],
    ],
  },
}

function generate({ rng, difficulty }: GenerateContext): FoResolutionQuestion {
  const profile = PROFILES[difficulty]
  const signature: FoSignature = {
    predicates: profile.predicates,
    functions: profile.functions,
  }

  for (const set of rng.shuffle(profile.sets)) {
    let clauses: FoClause[]
    try {
      clauses = parseFoClauseSet(set, signature)
    } catch {
      continue
    }
    const run = findFoRefutation(clauses, 300)
    // A round that cannot be won is not a question.
    if (!run.refuted) continue

    const par = derivationLength(run)
    if (par < 1 || par > 6) continue

    return {
      predicates: profile.predicates,
      functions: profile.functions,
      clauses: set,
      par,
    }
  }

  const fallback = ['p(a())', '¬p(x)']
  const clauses = parseFoClauseSet(fallback, {
    predicates: { p: 1 },
    functions: { a: 0 },
  })
  return {
    predicates: { p: 1 },
    functions: { a: 0 },
    clauses: fallback,
    par: derivationLength(findFoRefutation(clauses, 300)),
  }
}

/** How many derived clauses the refutation actually uses. */
function derivationLength(run: ReturnType<typeof findFoRefutation>): number {
  const empty = run.derived.findIndex((entry) => entry.clause.length === 0)
  if (empty === -1) return 0
  const needed = new Set<number>()
  const walk = (index: number): void => {
    if (needed.has(index)) return
    needed.add(index)
    const from = run.derived[index]?.from
    if (from === null || from === undefined) return
    walk(from[0])
    walk(from[1])
  }
  walk(empty)
  return [...needed].filter((index) => run.derived[index]?.from !== null).length
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

function solve(question: FoResolutionQuestion): FoResolutionAnswer {
  const clauses = clausesOf(question)
  const run = findFoRefutation(clauses, 300)
  const empty = run.derived.findIndex((entry) => entry.clause.length === 0)
  if (empty === -1) return []

  const order: number[] = []
  const walk = (index: number): void => {
    if (order.includes(index)) return
    const from = run.derived[index]?.from
    if (from !== null && from !== undefined) {
      walk(from[0])
      walk(from[1])
    }
    order.push(index)
  }
  walk(empty)

  return order
    .filter((index) => run.derived[index]?.from !== null)
    .map((index) => showFoClause((run.derived[index] as { clause: FoClause }).clause))
}

/**
 * Replay a derivation: each clause must be a resolvent of two already present.
 *
 * Checked rather than trusted, because the board can only offer legal steps but
 * a stored answer comes from anywhere.
 */
export function replayDerivation(
  start: readonly FoClause[],
  derived: readonly string[],
  signature: FoSignature,
): { known: FoClause[]; illegal: string | null } {
  const known = [...start]
  for (const source of derived) {
    let clause: FoClause
    try {
      clause = parseFoClauseSet([source], signature)[0] as FoClause
    } catch {
      return { known, illegal: source }
    }
    const legal = known.some((first) =>
      known.some((second) =>
        stepsBetween(first, second).some((step) => clauseVariants(step.clause, clause)),
      ),
    )
    if (!legal) return { known, illegal: source }
    known.push(clause)
  }
  return { known, illegal: null }
}

function check(question: FoResolutionQuestion, answer: FoResolutionAnswer): Verdict {
  const signature = signatureOf(question)
  const { known, illegal } = replayDerivation(clausesOf(question), answer, signature)

  if (illegal !== null) {
    return {
      correct: false,
      message: 'That clause is not a resolvent of two you have',
      detail:
        'Every step resolves two clauses already on the board, on one complementary pair, under their most general unifier.',
    }
  }

  if (!known.some((clause) => clause.length === 0)) {
    return {
      correct: false,
      // Says how far, never which pair to try.
      message: answer.length === 0 ? 'No steps taken' : 'No empty clause yet',
      score: Math.min(0.7, answer.length / Math.max(question.par, 1) / 2),
      detail:
        'The empty clause comes from two unit clauses whose atoms unify. Work towards shortening clauses rather than making new long ones.',
    }
  }

  return {
    correct: true,
    message:
      answer.length === question.par
        ? `Refuted in ${answer.length} — the shortest`
        : `Refuted in ${answer.length}`,
    detail:
      answer.length === question.par
        ? 'Every step instantiated only as much as it needed, which is exactly what unification buys over grounding.'
        : `${question.par} steps is the shortest known route. Yours is a refutation too.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<FoResolutionQuestion, FoResolutionAnswer>) {
  const start = useMemo(() => clausesOf(question), [question])
  const signature = useMemo(() => signatureOf(question), [question])
  const [derived, setDerived] = useState<string[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [pending, setPending] = useState<{ a: number; b: number; steps: Step[] } | null>(null)
  const [shaking, shake] = useShake()

  useEffect(() => {
    setDerived([])
    setSelected(null)
    setPending(null)
  }, [question])

  const { known } = replayDerivation(start, derived, signature)
  const refuted = known.some((clause) => clause.length === 0)

  const pick = (index: number) => {
    if (locked || pending !== null) return
    if (selected === null) return setSelected(index)
    if (selected === index) return setSelected(null)

    const steps = stepsBetween(known[selected] as FoClause, known[index] as FoClause)
    setSelected(null)
    if (steps.length === 0) return shake()
    if (steps.length === 1) {
      add((steps[0] as Step).clause)
      return
    }
    setPending({ a: selected, b: index, steps })
  }

  const add = (clause: FoClause) => {
    const printed = showFoClause(clause)
    if (derived.includes(printed)) return shake()
    if (known.some((existing) => clauseVariants(existing, clause))) return shake()
    setDerived((previous) => [...previous, printed])
    setPending(null)
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Resolve down to ⊥
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {derived.length} derived · {question.par} is enough
        </p>
      </div>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Tap two clauses. Their variables are renamed apart for you, and the mgu is applied to what
        survives.
      </p>

      <Shakeable shaking={shaking}>
        <MovingList className="mt-2 flex flex-col gap-1.5">
          {known.map((clause, index) => (
            <MovingItem
              key={`${index}:${showFoClause(clause)}`}
              id={`${index}`}
              disabled={locked}
              onClick={() => pick(index)}
              className={`tile flex w-full items-center gap-2 px-3 py-2 text-left
                ${
                  clause.length === 0
                    ? 'bg-space-red text-white'
                    : selected === index
                      ? 'bg-space-blue text-white'
                      : index < start.length
                        ? 'bg-card'
                        : 'bg-coin'
                }`}
            >
              <FoClauseText
                clause={clause}
                className={`text-base font-bold ${
                  selected === index || clause.length === 0 ? 'text-white' : ''
                }`}
              />
              {clause.length === 0 && (
                <span className="ml-auto text-[0.6rem] font-bold uppercase tracking-wider">
                  refutation
                </span>
              )}
            </MovingItem>
          ))}
        </MovingList>
      </Shakeable>

      {pending !== null && !locked && (
        <Pop className="tile mt-2 bg-coin p-3">
          <p className="text-sm font-bold">
            {pending.steps.length} complementary pairs — each gives a different resolvent.
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {pending.steps.map((step, index) => (
              <button
                key={index}
                type="button"
                onClick={() => add(step.clause)}
                className="tile flex w-full flex-col items-start bg-card px-3 py-1.5 text-left hover:bg-card-shade
                  focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin"
              >
                <FoClauseText clause={step.clause} className="text-sm font-bold" />
                <span className="formula text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
                  on {showFoLiteral(step.left)} / {showFoLiteral(step.right)} ·{' '}
                  {showSubstitution(step.sigma)}
                </span>
              </button>
            ))}
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </Pop>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            One refutation, in {question.par} steps
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {solve(question).map((entry) => (
              <li key={entry} className="formula font-bold">
                {entry === '□' ? '□' : entry}
              </li>
            ))}
          </ul>
        </Pop>
      )}

      {!locked && (
        <div className="mt-3 flex gap-2">
          {derived.length > 0 && (
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setDerived((previous) => previous.slice(0, -1))}
            >
              ← Undo
            </Button>
          )}
          <Button
            variant={refuted ? 'coin' : 'secondary'}
            className="flex-1"
            onClick={() => submit(derived)}
          >
            {refuted ? `Submit — ${derived.length} steps` : 'Submit anyway'}
          </Button>
        </div>
      )}
    </Card>
  )
}

/** For the guide: the variables a clause has, after renaming apart. */
export const renamedApart = (clause: FoClause, avoid: readonly string[]): FoClause =>
  renameClauseApart(clause, [...avoid])

export const variablesOf = foClauseVariables

export const foResolutionGame = defineMinigame<FoResolutionQuestion, FoResolutionAnswer>({
  id: 'fo-resolution',
  title: 'Resolve With Unification',
  tagline: 'Instantiate only as much as this step needs.',
  topics: ['fo-resolution'],
  icon: '⚔️',
  roundSeconds: 240,
  sprintQuestions: 5,
  generate,
  check,
  solve,
  Screen,
  Guide: FoResolutionGuide,
  questionKey: (question) => question.clauses.join(';'),
})
