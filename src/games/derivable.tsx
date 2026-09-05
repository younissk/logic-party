/**
 * Is clause X derivable? — ln.pdf §2.3, exam26a and exam26bA Q1.1.
 *
 * The checkbox question, and it rewards two ideas rather than grinding:
 *
 *   1. Run BCP first. If the set is unsatisfiable then ⊥ is derivable, because
 *      resolution is refutation complete — that settles the empty clause with
 *      no resolution steps at all.
 *   2. Resolution needs a shared variable, so two components that share none
 *      can never be mixed. Any candidate drawing letters from both halves is
 *      dead on sight.
 *
 * Ground truth comes from saturating the clause set, not from entailment.
 * They are different questions: an entailed clause can still be underivable,
 * which is exactly what happens to (c ∨ d) in the exam.
 */

import { useEffect, useState } from 'react'
import type { Clause } from '@/logic'
import {
  clauseKey,
  clauseSetToFormula,
  components,
  isSatisfiable,
  isTautologicalClause,
  normaliseClause,
  saturate,
  sharedVariables,
  showClause,
  type Rng,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'
import { DerivableGuide } from './derivable.guide'

export interface DerivableQuestion {
  clauses: Clause[]
  /** Candidate clauses to judge; ⊥ is always one of them. */
  candidates: Clause[]
  /** Indices into `candidates` that resolution can actually reach. */
  derivable: number[]
}

export type DerivableAnswer = number[]

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  /** Variables of the main component. */
  variables: string[]
  clauses: [min: number, max: number]
  width: [min: number, max: number]
  /** A second component sharing no variables, to make the split matter. */
  secondComponent: string[]
  candidates: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    variables: ['x', 'y'],
    clauses: [3, 4],
    width: [1, 2],
    secondComponent: [],
    candidates: 4,
  },
  medium: {
    variables: ['x', 'y', 'z'],
    clauses: [4, 5],
    width: [1, 3],
    secondComponent: ['a', 'b'],
    candidates: 5,
  },
  hard: {
    variables: ['x', 'y', 'z'],
    clauses: [5, 6],
    width: [1, 3],
    secondComponent: ['a', 'b', 'c'],
    candidates: 6,
  },
}

const ATTEMPTS = 250

function randomClause(rng: Rng, pool: string[], width: [number, number]): Clause {
  const size = Math.min(rng.range(...width), pool.length)
  return normaliseClause(rng.sample(pool, size).map((name) => ({ name, negated: rng.bool() })))
}

function generate({ rng, difficulty }: GenerateContext): DerivableQuestion {
  const profile = PROFILES[difficulty]

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const main: Clause[] = []
    const count = rng.range(...profile.clauses)
    for (let index = 0; index < count; index++) {
      const clause = randomClause(rng, profile.variables, profile.width)
      if (isTautologicalClause(clause)) break
      if (main.some((existing) => clauseKey(existing) === clauseKey(clause))) break
      main.push(clause)
    }
    if (main.length !== count) continue
    // A unit clause somewhere is what makes BCP the right first move.
    if (!main.some((clause) => clause.length === 1)) continue

    const second: Clause[] = []
    if (profile.secondComponent.length >= 2) {
      second.push(
        normaliseClause(profile.secondComponent.map((name) => ({ name, negated: false }))),
        normaliseClause([
          { name: profile.secondComponent[0] as string, negated: true },
          { name: profile.secondComponent[1] as string, negated: true },
        ]),
      )
    }

    const clauses = [...main, ...second]

    let reachable: string[]
    try {
      reachable = saturate(clauses).map((entry) => clauseKey(entry.clause))
    } catch {
      continue
    }
    const reachableSet = new Set(reachable)

    // Candidates: the empty clause, some genuinely derivable clauses, and
    // some that are not — including at least one that mixes the components.
    const derivedPool = saturate(clauses)
      .filter((entry) => entry.from !== null && entry.clause.length > 0 && entry.clause.length <= 3)
      .map((entry) => entry.clause)

    const pool: Clause[] = [[]]
    for (const clause of rng.shuffle(derivedPool).slice(0, 2)) pool.push(clause)

    // A clause taking letters from both components — impossible by definition.
    if (second.length > 0) {
      pool.push(
        normaliseClause([
          { name: profile.variables[0] as string, negated: false },
          { name: profile.secondComponent[0] as string, negated: false },
        ]),
      )
      // Something inside the second component that cannot be reached either,
      // because stripping a or b always leaves a tautology.
      pool.push(
        normaliseClause(
          profile.secondComponent.slice(2).length > 0
            ? profile.secondComponent.slice(2).map((name) => ({ name, negated: false }))
            : [{ name: profile.secondComponent[1] as string, negated: false }],
        ),
      )
    }

    while (pool.length < profile.candidates) {
      const clause = randomClause(rng, profile.variables, [1, 2])
      if (isTautologicalClause(clause)) continue
      if (pool.some((existing) => clauseKey(existing) === clauseKey(clause))) continue
      pool.push(clause)
    }

    const candidates = rng.shuffle(pool).slice(0, profile.candidates)
    // A question where everything or nothing is derivable is not a question.
    const derivable = candidates
      .map((clause, index) => ({ clause, index }))
      .filter(({ clause }) => reachableSet.has(clauseKey(clause)))
      .map(({ index }) => index)
    if (derivable.length === 0 || derivable.length === candidates.length) continue

    return { clauses, candidates, derivable }
  }

  // Last resort, so a round can never stall: the exam's own question.
  const clauses: Clause[] = [
    [{ name: 'z', negated: false }],
    [
      { name: 'x', negated: true },
      { name: 'y', negated: true },
    ],
    [
      { name: 'x', negated: false },
      { name: 'y', negated: true },
      { name: 'z', negated: true },
    ],
    [
      { name: 'x', negated: false },
      { name: 'y', negated: false },
      { name: 'z', negated: true },
    ],
    [
      { name: 'x', negated: false },
      { name: 'y', negated: false },
      { name: 'z', negated: false },
    ],
    [
      { name: 'x', negated: true },
      { name: 'z', negated: true },
    ],
  ]
  const candidates: Clause[] = [[], [{ name: 'x', negated: false }]]
  return { clauses, candidates, derivable: [0, 1] }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: DerivableQuestion): DerivableAnswer => [...question.derivable]

/** Why each candidate is or is not reachable, in the terms the method uses. */
export function reason(question: DerivableQuestion, index: number): string {
  const candidate = question.candidates[index] as Clause
  const reachable = question.derivable.includes(index)

  if (candidate.length === 0) {
    return reachable
      ? 'Derivable: the set is unsatisfiable, and resolution is refutation complete.'
      : 'Not derivable: the set is satisfiable, so there is nothing to refute.'
  }

  if (reachable) return 'Derivable.'

  const groups = components(question.clauses)
  if (groups.length > 1) {
    const touched = groups.filter((group) =>
      group.some((clause) => sharedVariables(clause, candidate).length > 0),
    )
    if (touched.length > 1) {
      return 'Not derivable: it mixes two components that share no variable, and resolution can never bridge them.'
    }
  }

  return 'Not derivable: every route to it passes through a tautology.'
}

function check(question: DerivableQuestion, answer: DerivableAnswer): Verdict {
  const picked = new Set(answer)
  const expected = new Set(question.derivable)
  const missed = [...expected].filter((index) => !picked.has(index))
  const extra = [...picked].filter((index) => !expected.has(index))

  if (missed.length === 0 && extra.length === 0) {
    return {
      correct: true,
      message: `${expected.size} derivable`,
      detail: question.derivable
        .map((index) => `${showClause(question.candidates[index] as Clause)} — ${reason(question, index)}`)
        .join(' '),
    }
  }

  return {
    correct: false,
    message:
      missed.length > 0 && extra.length > 0
        ? `${missed.length} missed, ${extra.length} not derivable`
        : missed.length > 0
          ? `${missed.length} derivable one${missed.length === 1 ? '' : 's'} missed`
          : `${extra.length} of those cannot be derived`,
    score: expected.size === 0 ? 0 : Math.max(0, (expected.size - missed.length - extra.length) / expected.size),
    detail: question.candidates
      .map((clause, index) => `${showClause(clause)} — ${reason(question, index)}`)
      .join(' '),
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked, solution }: MinigameScreenProps<DerivableQuestion, DerivableAnswer>) {
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
  const groups = components(question.clauses)
  const satisfiable = isSatisfiable(clauseSetToFormula(question.clauses))

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Which can resolution derive?
      </p>

      <div className="mt-2 flex flex-col gap-3">
        {groups.map((group, groupIndex) => (
          <div key={groupIndex} className="flex flex-col gap-1.5">
            {groups.length > 1 && (
              <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                Component {groupIndex + 1}
              </p>
            )}
            {group.map((clause, index) => (
              <div key={index} className="rounded-xl bg-card-shade px-3 py-1.5">
                <ClauseText clause={clause} className="text-base font-bold" />
              </div>
            ))}
          </div>
        ))}
      </div>

      {groups.length > 1 && (
        <p className="mt-2 text-xs font-medium text-ink-soft">
          These components share no variable, so no resolution step can ever combine them.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-1.5">
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
                {isPicked || shouldBe ? '✓' : ''}
              </span>
              <ClauseText
                clause={clause}
                className={`text-base font-bold ${locked && (shouldBe || wrongPick) ? 'text-white' : ''}`}
              />
            </button>
          )
        })}
      </div>

      {!locked ? (
        <Button variant="coin" className="mt-4 w-full" onClick={() => submit(picked)}>
          {picked.length === 0 ? 'None of them' : `Check ${picked.length} selected`}
        </Button>
      ) : (
        <p className="mt-3 text-xs font-medium text-ink-soft">
          The set is {satisfiable ? 'satisfiable, so ⊥ is out of reach' : 'unsatisfiable, so ⊥ is derivable'}.
        </p>
      )}
    </Card>
  )
}

export const derivableGame = defineMinigame<DerivableQuestion, DerivableAnswer>({
  id: 'derivable',
  title: 'Can You Get There?',
  tagline: 'Check the clause set, then check what it can reach.',
  topics: ['resolution'],
  icon: '🎯',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: DerivableGuide,
  questionKey: (question) =>
    `${question.clauses.map(clauseKey).join(';')}|${question.candidates.map(clauseKey).join(';')}`,
})
