/**
 * The Herbrand expansion — ln.pdf §4.3, Exercise 8 question 3.
 *
 * Every clause, every variable, every ground term: the expansion is all of
 * those combinations at once. Herbrand's theorem promises that if the clause
 * set is unsatisfiable, some *finite* part of this is too — and says nothing
 * about which part, which is the difficulty resolution exists to solve.
 *
 * Here you ground the clauses by hand, one assignment at a time. Two mistakes
 * are the exercise's own: leaving a variable in, and assigning the same
 * variable two different terms in one instance.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  applyToClause,
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
import { MovingItem, MovingList, Pop, ProgressBar } from '@/ui/motion'
import { HerbrandExpansionGuide } from './herbrandExpansion.guide'

export interface HerbrandExpansionQuestion {
  predicates: Record<string, number>
  functions: Signature
  clauses: string[]
  depth: number
  /** Every ground instance at that depth, printed. */
  instances: string[]
}

/** The instances produced, printed. */
export type HerbrandExpansionAnswer = string[]

const signatureOf = (question: HerbrandExpansionQuestion): FoSignature => ({
  predicates: question.predicates,
  functions: question.functions,
})

export const clausesOf = (question: HerbrandExpansionQuestion): FoClause[] =>
  parseFoClauseSet(question.clauses, signatureOf(question))

export const universeOf = (question: HerbrandExpansionQuestion): Term[] =>
  herbrandUniverse(clausesOf(question), question.depth)

/** Every ground instance of every clause, deduplicated and printed. */
export function expansionOf(question: HerbrandExpansionQuestion): string[] {
  const universe = universeOf(question)
  const found: string[] = []
  for (const clause of clausesOf(question)) {
    for (const instance of instancesOf(clause, universe)) {
      if (!found.includes(instance)) found.push(instance)
    }
  }
  return found
}

function instancesOf(clause: FoClause, universe: readonly Term[]): string[] {
  const names = foClauseVariables(clause)
  const found: string[] = []
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
  return found
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
      ['p(a())', '¬p(f(x))'],
      ['¬p(x) ∨ p(f(x))'],
    ],
    depth: 1,
  },
  medium: {
    predicates: { p: 1, q: 2 },
    functions: { a: 0, b: 0, f: 1 },
    sets: [
      ['p(a())', '¬p(x) ∨ q(x,b())'],
      ['q(a(),b())', '¬q(x,y) ∨ p(f(x))'],
      ['¬p(x) ∨ p(f(x))', 'p(a()) ∨ q(a(),b())'],
    ],
    depth: 1,
  },
  hard: {
    predicates: { p: 2, q: 1 },
    functions: { a: 0, f: 1 },
    sets: [
      ['p(x,y) ∨ q(x)', '¬p(a(),f(a()))'],
      ['¬p(x,y) ∨ p(y,x)', 'p(a(),f(a()))'],
    ],
    depth: 1,
  },
}

function generate({ rng, difficulty }: GenerateContext): HerbrandExpansionQuestion {
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
    // Something to ground: a clause set with no variables has no expansion to
    // speak of.
    if (clauses.every((clause) => foClauseVariables(clause).length === 0)) continue

    const question: HerbrandExpansionQuestion = {
      predicates: profile.predicates,
      functions: profile.functions,
      clauses: set,
      depth: profile.depth,
      instances: [],
    }
    const instances = expansionOf(question)
    if (instances.length < 3 || instances.length > 10) continue
    return { ...question, instances }
  }

  const fallback = ['¬p(x)', 'p(f(y))']
  const question: HerbrandExpansionQuestion = {
    predicates: { p: 1 },
    functions: { a: 0, f: 1 },
    clauses: fallback,
    depth: 1,
    instances: [],
  }
  return { ...question, instances: expansionOf(question) }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: HerbrandExpansionQuestion): HerbrandExpansionAnswer => [
  ...question.instances,
]

function check(
  question: HerbrandExpansionQuestion,
  answer: HerbrandExpansionAnswer,
): Verdict {
  const wanted = new Set(question.instances)
  const found = new Set(answer)
  const missed = [...wanted].filter((entry) => !found.has(entry)).length
  const extra = [...found].filter((entry) => !wanted.has(entry)).length

  if (missed === 0 && extra === 0) {
    return {
      correct: true,
      message: `All ${wanted.size} instances`,
      detail:
        'Every variable of every clause, replaced by every element of the universe, in every combination — and the same variable gets the same term throughout one instance.',
    }
  }

  return {
    correct: false,
    // Counts, never instances: sprint shows this before the retry.
    message: missed > 0 ? `${missed} still to ground` : `${extra} of those do not belong`,
    score: wanted.size === 0 ? 0 : Math.max(0, (wanted.size - missed - extra) / wanted.size),
    detail:
      'Take one clause at a time and run its variables through the universe. A clause with two variables gives one instance per pair, not one per element.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<HerbrandExpansionQuestion, HerbrandExpansionAnswer>) {
  const clauses = useMemo(() => clausesOf(question), [question])
  const universe = useMemo(() => universeOf(question), [question])
  const [active, setActive] = useState(0)
  const [assignment, setAssignment] = useState<Record<string, number>>({})
  const [found, setFound] = useState<string[]>([])

  useEffect(() => {
    setActive(0)
    setAssignment({})
    setFound([])
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
  const already = preview !== null && found.includes(preview)

  const bank = () => {
    if (locked || preview === null || already) return
    setFound((previous) => [...previous, preview])
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Ground every clause
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {found.length} of {question.instances.length}
        </p>
      </div>

      <p className="mt-1 flex flex-wrap items-baseline gap-2 text-xs font-medium text-ink-soft">
        <span className="font-bold uppercase tracking-wider">universe</span>
        {universe.map((term) => (
          <span key={showTerm(term)} className="rounded-md bg-card-shade px-1.5 py-0.5">
            <TermText term={term} className="font-bold" />
          </span>
        ))}
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
            className={`tile flex w-full items-center gap-2 px-3 py-2 text-left
              ${index === active ? 'bg-space-blue text-white' : 'bg-card'}`}
          >
            <FoClauseText
              clause={entry}
              className={`text-base font-bold ${index === active ? 'text-white' : ''}`}
            />
            {foClauseVariables(entry).length === 0 && (
              <span className="ml-auto text-[0.6rem] font-bold uppercase tracking-wider">
                already ground
              </span>
            )}
          </button>
        ))}
      </div>

      {!locked && (
        <>
          <div className="mt-3 flex flex-col gap-2">
            {names.length === 0 && (
              <p className="rounded-xl bg-card-shade px-3 py-2 text-xs font-semibold text-ink-soft">
                No variables — this clause is its own only instance.
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

          <div className="tile mt-2 flex items-center gap-2 bg-card-shade px-3 py-2">
            <span className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
              gives
            </span>
            {preview === null ? (
              <span className="text-sm font-semibold text-ink-soft">choose a term for each</span>
            ) : (
              <FoClauseText
                clause={applyToClause(sigma, clause)}
                className="text-base font-bold"
              />
            )}
          </div>

          <Button
            variant={preview !== null && !already ? 'coin' : 'secondary'}
            className="mt-2 w-full"
            onClick={bank}
            disabled={preview === null || already}
          >
            {already ? 'Already in the tray' : 'Bank this instance'}
          </Button>
        </>
      )}

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">The expansion</p>
      <div className="mt-1">
        <ProgressBar value={found.length} total={question.instances.length} />
      </div>
      <MovingList className="mt-1 flex flex-col gap-1">
        {(locked ? question.instances : found).map((entry) => (
          <MovingItem
            key={entry}
            id={entry}
            disabled
            className="tile bg-grass px-3 py-1 text-left text-white"
          >
            <span className="formula text-sm font-bold">{entry}</span>
          </MovingItem>
        ))}
        {found.length === 0 && !locked && (
          <p className="rounded-xl bg-card-shade px-3 py-2 text-sm font-semibold text-ink-soft">
            Nothing yet.
          </p>
        )}
      </MovingList>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium text-ink-soft">
          The whole expansion is infinite whenever the universe is — this is the part of it over
          terms up to depth {question.depth}.
        </Pop>
      )}

      {!locked && (
        <Button variant="coin" className="mt-3 w-full" onClick={() => submit(found)}>
          {found.length === question.instances.length
            ? 'Submit'
            : `Submit — ${question.instances.length - found.length} still missing`}
        </Button>
      )}
    </Card>
  )
}

export const herbrandExpansionGame = defineMinigame<
  HerbrandExpansionQuestion,
  HerbrandExpansionAnswer
>({
  id: 'herbrand-expansion',
  title: 'Ground It',
  tagline: 'Every variable, every element, every combination.',
  topics: ['herbrand'],
  icon: '🧱',
  roundSeconds: 210,
  sprintQuestions: 5,
  generate,
  check,
  solve,
  Screen,
  Guide: HerbrandExpansionGuide,
  questionKey: (question) => question.clauses.join(';'),
})
