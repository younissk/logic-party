/**
 * Compute all resolvents — ln.pdf §2.3 Definition 2.22, exam25a Q1.1b.
 *
 * The exam question says "also include tautological resolvents", and that
 * phrase is the whole test. Two clauses clashing on two variables give *two*
 * resolvents, each of them a tautology, because cancelling one pivot leaves
 * the other pair standing. Cancelling both at once is not a resolution step,
 * and it is the answer this game is built to catch.
 */

import { useEffect, useState } from 'react'
import type { Clause } from '@/logic'
import {
  allResolvents,
  clauseKey,
  isTautologicalClause,
  normaliseClause,
  resolveOn,
  sharedVariables,
  showClause,
  type Rng,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'
import { ResolventsGuide } from './resolvents.guide'

export interface ResolventsQuestion {
  /** The clauses on the table. */
  clauses: Clause[]
  /** Candidates to judge — a mix of real resolvents and near misses. */
  candidates: Clause[]
  /** Indices into `candidates` that really are one-step resolvents. */
  correct: number[]
}

/** Indices the player ticked. */
export type ResolventsAnswer = number[]

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  variables: string[]
  clauses: number
  width: [min: number, max: number]
  distractors: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['a', 'b', 'c'], clauses: 2, width: [2, 3], distractors: 3 },
  medium: { variables: ['a', 'b', 'c', 'd'], clauses: 3, width: [2, 3], distractors: 4 },
  hard: { variables: ['a', 'b', 'c', 'd', 'e'], clauses: 3, width: [3, 4], distractors: 5 },
}

const ATTEMPTS = 300

function randomClause(rng: Rng, profile: Profile): Clause {
  const width = rng.range(...profile.width)
  return normaliseClause(
    rng.sample(profile.variables, width).map((name) => ({ name, negated: rng.bool() })),
  )
}

/**
 * Wrong answers worth offering.
 *
 * Every one of these is a mistake a person actually makes, not noise: the
 * first is the classic "cancelled both pivots at once", and the rest are the
 * shapes a rushed answer takes.
 */
function distractorsFor(rng: Rng, clauses: Clause[], real: Clause[]): Clause[] {
  const out: Clause[] = []
  const isNew = (candidate: Clause) =>
    candidate.length > 0 &&
    !real.some((clause) => clauseKey(clause) === clauseKey(candidate)) &&
    !out.some((clause) => clauseKey(clause) === clauseKey(candidate)) &&
    !clauses.some((clause) => clauseKey(clause) === clauseKey(candidate))

  for (let i = 0; i < clauses.length; i++) {
    for (let j = i + 1; j < clauses.length; j++) {
      const left = clauses[i] as Clause
      const right = clauses[j] as Clause
      const pivots = sharedVariables(left, right).filter(
        (pivot) => resolveOn(left, right, pivot) !== null,
      )

      // The big one: cancel every clashing pair at once. Always wrong, always
      // tempting, and it is exactly what the tautological resolvents rule out.
      if (pivots.length > 1) {
        const both = normaliseClause([
          ...left.filter((literal) => !pivots.includes(literal.name)),
          ...right.filter((literal) => !pivots.includes(literal.name)),
        ])
        if (isNew(both)) out.push(both)
      }

      // The union with nothing cancelled — a merge rather than a resolution.
      if (pivots.length > 0) {
        const merged = normaliseClause([...left, ...right])
        if (isNew(merged)) out.push(merged)
      }

      // A resolvent with one surviving literal dropped.
      for (const pivot of pivots) {
        const resolvent = resolveOn(left, right, pivot) as Clause
        if (resolvent.length > 1) {
          const trimmed = resolvent.slice(0, -1)
          if (isNew(trimmed)) out.push(trimmed)
        }
        // A resolvent with one sign flipped.
        if (resolvent.length > 0) {
          const first = resolvent[0] as { name: string; negated: boolean }
          const flipped = normaliseClause([
            { name: first.name, negated: !first.negated },
            ...resolvent.slice(1),
          ])
          if (isNew(flipped)) out.push(flipped)
        }
      }
    }
  }

  return rng.shuffle(out)
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

    const distractors = distractorsFor(rng, clauses, real).slice(0, profile.distractors)
    if (distractors.length < 2) continue

    const candidates = rng.shuffle([...real, ...distractors])
    const correct = candidates
      .map((clause, index) => ({ clause, index }))
      .filter(({ clause }) => real.some((entry) => clauseKey(entry) === clauseKey(clause)))
      .map(({ index }) => index)

    return { clauses, candidates, correct }
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
  const candidates = allResolvents(clauses).map((step) => step.resolvent)
  return { clauses, candidates, correct: candidates.map((_, index) => index) }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: ResolventsQuestion): ResolventsAnswer => [...question.correct]

function check(question: ResolventsQuestion, answer: ResolventsAnswer): Verdict {
  const picked = new Set(answer)
  const expected = new Set(question.correct)

  const missed = [...expected].filter((index) => !picked.has(index))
  const extra = [...picked].filter((index) => !expected.has(index))

  if (missed.length === 0 && extra.length === 0) {
    const tautologies = question.correct.filter((index) =>
      isTautologicalClause(question.candidates[index] as Clause),
    ).length
    return {
      correct: true,
      message: `${question.correct.length} resolvents`,
      detail: `${tautologies} of them tautological — one pivot cancelled, the other clash left standing.`,
    }
  }

  return {
    correct: false,
    // Says how far off, never which ones — sprint shows this before the retry.
    message:
      missed.length > 0 && extra.length > 0
        ? `${missed.length} missed, ${extra.length} that are not resolvents`
        : missed.length > 0
          ? `${missed.length} resolvent${missed.length === 1 ? '' : 's'} missed`
          : `${extra.length} of those ${extra.length === 1 ? 'is' : 'are'} not a resolvent`,
    score: expected.size === 0 ? 0 : Math.max(0, (expected.size - missed.length - extra.length) / expected.size),
    detail: `The resolvents are ${question.correct
      .map((index) => showClause(question.candidates[index] as Clause))
      .join(', ')}. Check every pair, and inside each pair every clashing variable separately.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked, solution }: MinigameScreenProps<ResolventsQuestion, ResolventsAnswer>) {
  const [picked, setPicked] = useState<number[]>([])

  useEffect(() => {
    setPicked([])
  }, [question])

  const toggle = (index: number) => {
    if (locked) return
    setPicked((previous) =>
      previous.includes(index) ? previous.filter((entry) => entry !== index) : [...previous, index],
    )
  }

  const expected = new Set(solution ?? [])

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Which are resolvents?
      </p>

      <div className="mt-2 flex flex-col gap-1.5">
        {question.clauses.map((clause, index) => (
          <div key={index} className="flex items-center gap-2 rounded-xl bg-card-shade px-3 py-1.5">
            <span className="text-xs font-bold text-ink-soft">C{index + 1}</span>
            <ClauseText clause={clause} className="text-base font-bold" />
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs font-medium text-ink-soft">
        One pivot per step. Tick every clause reachable in a single resolution — tautological ones
        included.
      </p>

      <div className="mt-2 flex flex-col gap-1.5">
        {question.candidates.map((clause, index) => {
          const isPicked = picked.includes(index)
          const shouldBe = locked && expected.has(index)
          const wrongPick = locked && isPicked && !expected.has(index)

          return (
            <button
              key={index}
              type="button"
              disabled={locked}
              onClick={() => toggle(index)}
              className={`tile flex items-center gap-2 px-3 py-2 text-left
                ${
                  locked
                    ? shouldBe
                      ? 'bg-grass text-white'
                      : wrongPick
                        ? 'bg-space-red text-white'
                        : 'bg-card-shade'
                    : isPicked
                      ? 'bg-space-blue text-white'
                      : 'bg-card'
                }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-3 border-ink text-sm font-bold
                  ${isPicked || shouldBe ? 'bg-white text-ink' : 'bg-white/60'}`}
                aria-hidden
              >
                {isPicked ? '✓' : shouldBe ? '✓' : ''}
              </span>
              <ClauseText
                clause={clause}
                className={`text-base font-bold ${locked && (shouldBe || wrongPick) ? 'text-white' : ''}`}
              />
              {locked && isTautologicalClause(clause) && expected.has(index) && (
                <span className="ml-auto whitespace-nowrap text-xs font-bold">tautology</span>
              )}
            </button>
          )
        })}
      </div>

      {!locked && (
        <Button variant="coin" className="mt-4 w-full" onClick={() => submit(picked)}>
          {picked.length === 0 ? 'None of them' : `Check ${picked.length} selected`}
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
  questionKey: (question) => question.candidates.map(clauseKey).join(';'),
})
