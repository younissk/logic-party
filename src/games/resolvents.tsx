/**
 * Compute all resolvents — ln.pdf §2.3 Definition 2.22, exam25a Q1.1b.
 *
 * You produce them rather than recognise them. Tap two clauses, pick the pivot
 * when there is more than one, and the resolvent deals itself into your tray.
 * Find them all.
 *
 * Which makes "one pivot per step" something the board enforces rather than
 * something you are asked about: two clauses clashing on two variables offer
 * you two separate pivots, and cancelling both at once is not a move the game
 * has. The tautological results are still resolvents and still have to be
 * found, which is what the exam question means by "also include tautological
 * resolvents".
 */

import { useEffect, useState } from 'react'
import type { Clause } from '@/logic'
import {
  allResolvents,
  clauseKey,
  isTautologicalClause,
  normaliseClause,
  resolveOn,
  showClause,
  type Rng,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'
import { MovingItem, MovingList, Pop, ProgressBar, Shakeable, useShake } from '@/ui/motion'
import { ResolventsGuide } from './resolvents.guide'

export interface ResolventsQuestion {
  /** The clauses on the table. */
  clauses: Clause[]
  /** Every distinct one-step resolvent, tautologies included. */
  resolvents: Clause[]
}

/** The resolvents produced, as clauses. */
export type ResolventsAnswer = Clause[]

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  variables: string[]
  clauses: number
  width: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['a', 'b', 'c'], clauses: 2, width: [2, 3] },
  medium: { variables: ['a', 'b', 'c', 'd'], clauses: 3, width: [2, 3] },
  hard: { variables: ['a', 'b', 'c', 'd', 'e'], clauses: 3, width: [3, 4] },
}

const ATTEMPTS = 300

function randomClause(rng: Rng, profile: Profile): Clause {
  const width = rng.range(...profile.width)
  return normaliseClause(
    rng.sample(profile.variables, width).map((name) => ({ name, negated: rng.bool() })),
  )
}

function generate({ rng, difficulty }: GenerateContext): ResolventsQuestion {
  const profile = PROFILES[difficulty]

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const clauses: Clause[] = []
    for (let index = 0; index < profile.clauses; index++) {
      const clause = randomClause(rng, profile)
      if (isTautologicalClause(clause)) break
      if (clauses.some((existing) => clauseKey(existing) === clauseKey(clause))) break
      clauses.push(clause)
    }
    if (clauses.length !== profile.clauses) continue

    const steps = allResolvents(clauses)
    // A question with nothing to find, or with everything to find, teaches
    // nothing about picking one pivot at a time.
    if (steps.length < 2) continue

    const real: Clause[] = []
    for (const step of steps) {
      if (!real.some((clause) => clauseKey(clause) === clauseKey(step.resolvent))) {
        real.push(step.resolvent)
      }
    }
    // At least one tautological resolvent, because that is the lesson.
    if (!real.some(isTautologicalClause)) continue
    if (real.some((clause) => clause.length === 0)) continue

    return { clauses, resolvents: real }
  }

  // Last resort, so a round can never stall: the exam's own question.
  const c1: Clause = [
    { name: 'a', negated: false },
    { name: 'b', negated: false },
    { name: 'c', negated: true },
  ]
  const c2: Clause = [
    { name: 'a', negated: true },
    { name: 'd', negated: false },
    { name: 'e', negated: true },
    { name: 'c', negated: false },
  ]
  const c3: Clause = [
    { name: 'd', negated: true },
    { name: 'f', negated: false },
  ]
  const clauses = [c1, c2, c3]
  return { clauses, resolvents: allResolvents(clauses).map((step) => step.resolvent) }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: ResolventsQuestion): ResolventsAnswer => [...question.resolvents]

function check(question: ResolventsQuestion, answer: ResolventsAnswer): Verdict {
  const wanted = new Map(question.resolvents.map((clause) => [clauseKey(clause), clause]))
  const found = new Set(answer.map(clauseKey))

  const missed = [...wanted.keys()].filter((key) => !found.has(key))
  // Every clause in the tray was produced by the board, so an extra can only
  // be a duplicate; the count is what matters.
  const extra = [...found].filter((key) => !wanted.has(key))

  if (missed.length === 0 && extra.length === 0) {
    const tautologies = question.resolvents.filter(isTautologicalClause).length
    return {
      correct: true,
      message: `All ${question.resolvents.length} found`,
      detail: `${tautologies} of them tautological — one pivot cancelled, the other clash left standing.`,
    }
  }

  return {
    correct: false,
    // Says how many are left, never which: sprint shows this before the retry.
    message:
      missed.length > 0
        ? `${missed.length} still to find`
        : `${extra.length} of those are not resolvents`,
    score:
      wanted.size === 0 ? 0 : Math.max(0, (wanted.size - missed.length - extra.length) / wanted.size),
    detail: `The full set is ${question.resolvents.map(showClause).join(', ')}. Check every pair, and inside each pair every clashing variable separately.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked, solution }: MinigameScreenProps<ResolventsQuestion, ResolventsAnswer>) {
  const [found, setFound] = useState<Clause[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [pivots, setPivots] = useState<{ a: number; b: number; options: string[] } | null>(null)
  const [shaking, shake] = useShake()

  useEffect(() => {
    setFound([])
    setSelected(null)
    setPivots(null)
  }, [question])

  const add = (a: number, b: number, pivot: string) => {
    const resolvent = resolveOn(question.clauses[a] as Clause, question.clauses[b] as Clause, pivot)
    if (resolvent === null) return
    setFound((previous) =>
      previous.some((clause) => clauseKey(clause) === clauseKey(resolvent))
        ? previous
        : [...previous, resolvent],
    )
  }

  const pick = (index: number) => {
    if (locked || pivots !== null) return
    if (selected === null) return setSelected(index)
    if (selected === index) return setSelected(null)

    const options = allResolvents([
      question.clauses[selected] as Clause,
      question.clauses[index] as Clause,
    ])
    setSelected(null)
    if (options.length === 0) return shake()
    if (options.length === 1) return add(selected, index, (options[0] as { pivot: string }).pivot)
    setPivots({ a: selected, b: index, options: options.map((option) => option.pivot) })
  }

  const shown = locked ? (solution ?? found) : found
  const remaining = question.resolvents.length - found.length

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Find every resolvent
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {found.length} of {question.resolvents.length}
        </p>
      </div>

      <p className="mt-1 text-xs font-medium text-ink-soft">
        Tap two clauses to resolve them. One pivot per step — tautological results count.
      </p>

      <Shakeable shaking={shaking}>
        <div className="mt-2 flex flex-col gap-1.5">
          {question.clauses.map((clause, index) => (
            <button
              key={index}
              type="button"
              disabled={locked}
              onClick={() => pick(index)}
              className={`tile flex w-full items-center gap-2 px-3 py-2 text-left
                ${selected === index ? 'bg-space-blue text-white' : 'bg-card'}`}
            >
              <span className="w-6 shrink-0 text-xs font-bold opacity-60">C{index + 1}</span>
              <ClauseText
                clause={clause}
                className={`text-base font-bold ${selected === index ? 'text-white' : ''}`}
              />
            </button>
          ))}
        </div>
      </Shakeable>

      {pivots !== null && !locked && (
        <Pop className="tile mt-3 bg-coin p-3">
          <p className="text-sm font-bold">
            They clash on {pivots.options.length} variables — that is {pivots.options.length}{' '}
            separate resolvents, not one.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pivots.options.map((pivot) => (
              <Button
                key={pivot}
                variant="secondary"
                onClick={() => {
                  add(pivots.a, pivots.b, pivot)
                  setPivots(null)
                }}
              >
                {pivot}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setPivots(null)}>
              Cancel
            </Button>
          </div>
        </Pop>
      )}

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">Your tray</p>
      <div className="mt-1">
        <ProgressBar value={found.length} total={question.resolvents.length} />
      </div>

      <MovingList className="mt-2 flex flex-col gap-1.5">
        {shown.map((clause) => (
          <MovingItem
            key={clauseKey(clause)}
            id={clauseKey(clause)}
            disabled
            className="tile flex w-full items-center gap-2 bg-grass px-3 py-1.5 text-left text-white"
          >
            <ClauseText clause={clause} className="text-base font-bold" />
            {isTautologicalClause(clause) && (
              <span className="ml-auto text-xs font-bold uppercase tracking-wider">tautology</span>
            )}
          </MovingItem>
        ))}
        {shown.length === 0 && (
          <p className="rounded-xl bg-card-shade px-3 py-2 text-sm font-semibold text-ink-soft">
            Nothing yet.
          </p>
        )}
      </MovingList>

      {!locked && (
        <Button variant="coin" className="mt-3 w-full" onClick={() => submit(found)}>
          {remaining <= 0 ? 'Submit' : `Submit — ${remaining} still out there`}
        </Button>
      )}
    </Card>
  )
}

export const resolventsGame = defineMinigame<ResolventsQuestion, ResolventsAnswer>({
  id: 'resolvents',
  title: 'Resolvent Hunt',
  tagline: 'Every pair, every clashing variable, one at a time.',
  topics: ['resolution'],
  icon: '⚔️',
  roundSeconds: 150,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  Screen,
  Guide: ResolventsGuide,
  questionKey: (question) => question.clauses.map(clauseKey).join(';'),
})
