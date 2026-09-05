/**
 * Instantiation refutation — ln.pdf §4.3, Theorem 4.21, exam25a Q3.2.
 *
 * Herbrand's theorem says an unsatisfiable clause set has a *finite*
 * unsatisfiable set of ground instances hiding in its expansion, and says
 * nothing about which. Gilmore's method is the obvious response: enumerate
 * instances, and after each one ask a propositional solver whether what you
 * have is already contradictory.
 *
 * Playing it makes the cost obvious. Every instance you add is cheap and most
 * of them are useless, and the ones that matter are the ones whose ground terms
 * line up — which is exactly the observation that turns into unification, and
 * into resolution.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  applyToClause,
  findFoRefutation,
  foClauseVariables,
  herbrandUniverse,
  parseFoClauseSet,
  showFoClause,
  showTerm,
  type FoClause,
  type FoSignature,
  type Signature,
  type Substitution,
  type Term,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'
import { TermText } from '@/ui/TermText'
import { MovingItem, MovingList, Pop } from '@/ui/motion'
import { GilmoreGuide } from './gilmore.guide'

export interface GilmoreQuestion {
  predicates: Record<string, number>
  functions: Signature
  clauses: string[]
  depth: number
  /** The fewest ground instances that already contradict. */
  par: number
}

/** The instances added, printed. */
export type GilmoreAnswer = string[]

const signatureOf = (question: GilmoreQuestion): FoSignature => ({
  predicates: question.predicates,
  functions: question.functions,
})

export const clausesOf = (question: GilmoreQuestion): FoClause[] =>
  parseFoClauseSet(question.clauses, signatureOf(question))

export const universeOf = (question: GilmoreQuestion): Term[] =>
  herbrandUniverse(clausesOf(question), question.depth)

/** Ground clauses are propositional, so a refutation search decides them. */
export const isContradictory = (ground: readonly FoClause[]): boolean =>
  ground.length > 0 && findFoRefutation(ground, 300).refuted

/** Every ground instance available at this depth, printed. */
export function availableInstances(question: GilmoreQuestion): string[] {
  const universe = universeOf(question)
  const found: string[] = []
  for (const clause of clausesOf(question)) {
    const names = foClauseVariables(clause)
    const walk = (index: number, sigma: Substitution): void => {
      const name = names[index]
      if (name === undefined) {
        const printed = showFoClause(applyToClause(sigma, clause))
        if (!found.includes(printed)) found.push(printed)
        return
      }
      for (const term of universe) walk(index + 1, { ...sigma, [name]: term })
    }
    walk(0, {})
  }
  return found
}

/** The smallest contradictory subset of the available instances. */
export function smallestRefutation(question: GilmoreQuestion): string[] | null {
  const available = availableInstances(question)
  const signature = signatureOf(question)
  const parse = (sources: readonly string[]): FoClause[] =>
    parseFoClauseSet([...sources], signature)

  for (let size = 1; size <= Math.min(available.length, 5); size++) {
    for (const subset of combinations(available, size)) {
      if (isContradictory(parse(subset))) return subset
    }
  }
  return null
}

function* combinations<T>(items: readonly T[], size: number): Generator<T[]> {
  if (size === 0) {
    yield []
    return
  }
  for (let index = 0; index <= items.length - size; index++) {
    for (const rest of combinations(items.slice(index + 1), size - 1)) {
      yield [items[index] as T, ...rest]
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
  depth: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    predicates: { p: 1 },
    functions: { a: 0, f: 1 },
    sets: [
      ['¬p(x)', 'p(f(y))'],
      ['p(a())', '¬p(x)'],
      ['¬p(x) ∨ p(f(x))', 'p(a())', '¬p(f(a()))'],
    ],
    depth: 1,
  },
  medium: {
    predicates: { p: 1, q: 1 },
    functions: { a: 0, b: 0, f: 1 },
    sets: [
      ['p(x) ∨ q(x)', '¬p(a())', '¬q(a())'],
      ['¬p(x) ∨ q(f(x))', 'p(a())', '¬q(f(a()))'],
      ['p(a()) ∨ p(b())', '¬p(x)'],
    ],
    depth: 1,
  },
  hard: {
    predicates: { p: 2, q: 1 },
    functions: { a: 0, b: 0, f: 1 },
    sets: [
      ['p(x,x) ∨ ¬q(x)', '¬p(a(),a())', 'q(a())'],
      ['¬p(x,y) ∨ p(y,x)', 'p(a(),b())', '¬p(b(),a())'],
      ['p(x,a()) ∨ q(x)', '¬q(b())', '¬p(b(),a())'],
    ],
    depth: 1,
  },
}

function generate({ rng, difficulty }: GenerateContext): GilmoreQuestion {
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
    // Only unsatisfiable sets: Gilmore never terminates on a satisfiable one,
    // and a round that cannot be won is not a question.
    if (!findFoRefutation(clauses, 300).refuted) continue

    const question: GilmoreQuestion = {
      predicates: profile.predicates,
      functions: profile.functions,
      clauses: set,
      depth: profile.depth,
      par: 0,
    }
    if (availableInstances(question).length > 12) continue
    const smallest = smallestRefutation(question)
    if (smallest === null) continue
    return { ...question, par: smallest.length }
  }

  const fallback = ['¬p(x)', 'p(f(y))']
  const question: GilmoreQuestion = {
    predicates: { p: 1 },
    functions: { a: 0, f: 1 },
    clauses: fallback,
    depth: 1,
    par: 2,
  }
  return { ...question, par: smallestRefutation(question)?.length ?? 2 }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: GilmoreQuestion): GilmoreAnswer => smallestRefutation(question) ?? []

function check(question: GilmoreQuestion, answer: GilmoreAnswer): Verdict {
  const signature = signatureOf(question)
  const available = availableInstances(question)
  const unknown = answer.filter((entry) => !available.includes(entry))

  if (unknown.length > 0) {
    return {
      correct: false,
      message: 'That is not a ground instance of these clauses',
      detail: 'Every instance has to come from one clause with its variables replaced.',
    }
  }

  const ground = parseFoClauseSet([...new Set(answer)], signature)
  if (!isContradictory(ground)) {
    return {
      correct: false,
      // Says only that it is not contradictory yet.
      message: `${answer.length} instance${answer.length === 1 ? '' : 's'}, still satisfiable`,
      score: Math.min(0.6, answer.length / Math.max(question.par, 1) / 2),
      detail:
        'Look for instances whose ground terms line up — a positive and a negative literal over the *same* term is what closes a branch.',
    }
  }

  const size = new Set(answer).size
  return {
    correct: true,
    message:
      size === question.par
        ? `Contradictory with ${size} — the fewest there are`
        : `Contradictory with ${size}`,
    detail:
      size === question.par
        ? 'That is Herbrand’s theorem made concrete: a finite unsatisfiable set of ground instances.'
        : `${question.par} is enough. Both are proofs; the shorter one is what resolution finds by instantiating only as much as each step needs.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked }: MinigameScreenProps<GilmoreQuestion, GilmoreAnswer>) {
  const clauses = useMemo(() => clausesOf(question), [question])
  const universe = useMemo(() => universeOf(question), [question])
  const signature = useMemo(() => signatureOf(question), [question])
  const [active, setActive] = useState(0)
  const [assignment, setAssignment] = useState<Record<string, number>>({})
  const [added, setAdded] = useState<string[]>([])

  useEffect(() => {
    setActive(0)
    setAssignment({})
    setAdded([])
  }, [question])

  const clause = clauses[active] as FoClause
  const names = foClauseVariables(clause)
  const ready = names.every((name) => assignment[name] !== undefined)
  const sigma: Substitution = Object.fromEntries(
    Object.entries(assignment)
      .filter(([name]) => names.includes(name))
      .map(([name, index]) => [name, universe[index] as Term]),
  )
  const preview = ready ? showFoClause(applyToClause(sigma, clause)) : null
  const already = preview !== null && added.includes(preview)

  const ground = parseFoClauseSet(added, signature)
  const contradictory = isContradictory(ground)

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Instantiate until it breaks
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {added.length} added · {question.par} is enough
        </p>
      </div>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        The clause set is unsatisfiable. Find ground instances that already contradict each other.
      </p>

      <div className="mt-2 flex flex-col gap-1.5">
        {clauses.map((entry, index) => (
          <button
            key={index}
            type="button"
            disabled={locked}
            onClick={() => {
              setActive(index)
              setAssignment({})
            }}
            className={`tile flex w-full items-center px-3 py-1.5 text-left
              ${index === active ? 'bg-space-blue text-white' : 'bg-card'}`}
          >
            <FoClauseText
              clause={entry}
              className={`text-base font-bold ${index === active ? 'text-white' : ''}`}
            />
          </button>
        ))}
      </div>

      {!locked && (
        <>
          <div className="mt-3 flex flex-col gap-2">
            {names.length === 0 && (
              <p className="rounded-xl bg-card-shade px-3 py-2 text-xs font-semibold text-ink-soft">
                Already ground — add it as it is.
              </p>
            )}
            {names.map((name) => (
              <div key={name} className="flex flex-wrap items-center gap-1.5">
                <span className="formula w-5 shrink-0 text-base font-bold">{name}</span>
                {universe.map((term, index) => (
                  <button
                    key={showTerm(term)}
                    type="button"
                    onClick={() => setAssignment((previous) => ({ ...previous, [name]: index }))}
                    className={`chunky min-h-10 px-3 text-sm font-bold
                      focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                      ${assignment[name] === index ? 'bg-space-blue text-white' : 'bg-card text-ink hover:bg-card-shade'}`}
                  >
                    <TermText term={term} className={assignment[name] === index ? 'text-white' : ''} />
                  </button>
                ))}
              </div>
            ))}
          </div>

          <Button
            variant={preview !== null && !already ? 'coin' : 'secondary'}
            className="mt-2 w-full"
            disabled={preview === null || already}
            onClick={() => preview !== null && setAdded((previous) => [...previous, preview])}
          >
            {preview === null
              ? 'Add — choose a term for each variable'
              : already
                ? 'Already added'
                : `Add ${preview}`}
          </Button>
        </>
      )}

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
        The ground set
      </p>
      <MovingList className="mt-1 flex flex-col gap-1">
        {added.map((entry) => (
          <MovingItem
            key={entry}
            id={entry}
            disabled
            className={`tile px-3 py-1 text-left ${contradictory ? 'bg-grass text-white' : 'bg-card-shade'}`}
          >
            <span className="formula text-sm font-bold">{entry}</span>
          </MovingItem>
        ))}
        {added.length === 0 && (
          <p className="rounded-xl bg-card-shade px-3 py-2 text-sm font-semibold text-ink-soft">
            Nothing added yet.
          </p>
        )}
      </MovingList>

      <p
        className={`mt-2 rounded-xl px-3 py-1.5 text-xs font-bold ${
          contradictory ? 'bg-grass text-white' : 'bg-card-shade text-ink-soft'
        }`}
      >
        {contradictory
          ? 'This set is already unsatisfiable — that is the finite witness.'
          : 'Still satisfiable as a propositional set.'}
      </p>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            {question.par} instances are enough
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {(smallestRefutation(question) ?? []).map((entry) => (
              <li key={entry} className="formula font-bold">
                {entry}
              </li>
            ))}
          </ul>
        </Pop>
      )}

      {!locked && (
        <div className="mt-3 flex gap-2">
          {added.length > 0 && (
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setAdded((previous) => previous.slice(0, -1))}
            >
              ← Undo
            </Button>
          )}
          <Button
            variant={contradictory ? 'coin' : 'secondary'}
            className="flex-1"
            onClick={() => submit(added)}
          >
            {contradictory ? 'Submit' : 'Submit anyway'}
          </Button>
        </div>
      )}
    </Card>
  )
}

export const gilmoreGame = defineMinigame<GilmoreQuestion, GilmoreAnswer>({
  id: 'gilmore',
  title: 'Instantiate Until It Breaks',
  tagline: 'Herbrand promises a finite witness. Finding it is the expensive part.',
  topics: ['herbrand'],
  icon: '🧨',
  roundSeconds: 210,
  sprintQuestions: 5,
  generate,
  check,
  solve,
  Screen,
  Guide: GilmoreGuide,
  questionKey: (question) => question.clauses.join(';'),
})
