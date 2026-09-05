/**
 * Build a resolution refutation — ln.pdf §2.3.
 *
 * You are given an unsatisfiable clause set and have to reach □. Every step is
 * a legal resolution by construction — you pick two clauses and, when they
 * clash on more than one variable, the pivot — so the game cannot be cheated
 * and never has to reject a move as malformed. What it scores is whether you
 * got there, and in how many steps against the shortest refutation.
 *
 * The heuristic that survives exam pressure: hunt units, propagate them, and
 * aim to produce a complementary pair of units. Clauses should shrink every
 * step. If yours are growing, you are wandering.
 */

import { useEffect, useMemo, useState } from 'react'
import type { Clause } from '@/logic'
import {
  clauseKey,
  clauseSetToFormula,
  isSatisfiable,
  refutationCost,
  shortestRefutation,
  isTautologicalClause,
  normaliseClause,
  resolveOn,
  resolvents,
  showClause,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'
import { RefutationGuide } from './refutation.guide'

export interface RefutationQuestion {
  clauses: Clause[]
  /** The fewest steps that reach □ — the par to match. */
  par: number
}

/** One move: the two clauses resolved and the pivot. */
export interface Step {
  left: Clause
  right: Clause
  pivot: string
  resolvent: Clause
}

export type RefutationAnswer = Step[]

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  variables: string[]
  clauses: [min: number, max: number]
  width: [min: number, max: number]
  par: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['x', 'y'], clauses: [3, 4], width: [1, 2], par: [2, 3] },
  medium: { variables: ['x', 'y', 'z'], clauses: [4, 5], width: [1, 3], par: [3, 5] },
  hard: { variables: ['x', 'y', 'z', 'w'], clauses: [5, 6], width: [2, 3], par: [4, 7] },
}

const ATTEMPTS = 400

function generate({ rng, difficulty }: GenerateContext): RefutationQuestion {
  const profile = PROFILES[difficulty]

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const count = rng.range(...profile.clauses)
    const clauses: Clause[] = []
    for (let index = 0; index < count; index++) {
      const width = Math.min(rng.range(...profile.width), profile.variables.length)
      const clause = normaliseClause(
        rng.sample(profile.variables, width).map((name) => ({ name, negated: rng.bool() })),
      )
      if (isTautologicalClause(clause)) break
      if (clauses.some((existing) => clauseKey(existing) === clauseKey(clause))) break
      clauses.push(clause)
    }
    if (clauses.length !== count) continue

    // Unsatisfiable, or there is nothing to refute.
    if (isSatisfiable(clauseSetToFormula(clauses))) continue
    // A unit clause to start from, which is what makes the heuristic work.
    if (!clauses.some((clause) => clause.length === 1)) continue
    // No clause may already be empty — that would be the answer, handed over.
    if (clauses.some((clause) => clause.length === 0)) continue

    let refutation: ReturnType<typeof shortestRefutation>
    try {
      refutation = shortestRefutation(clauses)
    } catch {
      continue
    }
    if (refutation === null) continue

    const par = refutation.length
    if (par < profile.par[0] || par > profile.par[1]) continue

    return { clauses, par }
  }

  // Last resort, so a round can never stall: the notes' own refutation.
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
  return { clauses, par: refutationCost(clauses) ?? 6 }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: RefutationQuestion): RefutationAnswer =>
  (shortestRefutation(question.clauses) ?? []).map((step) => ({
    left: step.left,
    right: step.right,
    pivot: step.pivot,
    resolvent: step.resolvent,
  }))

function check(question: RefutationQuestion, answer: RefutationAnswer): Verdict {
  // Every move the screen allows is legal by construction, but re-check here:
  // `check` has to be total and correct on any input, not only on what the UI
  // happens to produce.
  const available = question.clauses.map(clauseKey)
  for (const step of answer) {
    if (!available.includes(clauseKey(step.left)) || !available.includes(clauseKey(step.right))) {
      return { correct: false, message: 'A step used a clause that was not available' }
    }
    const resolvent = resolveOn(step.left, step.right, step.pivot)
    if (resolvent === null || clauseKey(resolvent) !== clauseKey(step.resolvent)) {
      return { correct: false, message: 'That is not a legal resolution step' }
    }
    available.push(clauseKey(step.resolvent))
  }

  if (!available.includes('')) {
    return { correct: false, message: 'The empty clause was not reached' }
  }

  const par = question.par
  const used = answer.length
  return {
    correct: true,
    message: used <= par ? `⊥ in ${used} — par ${par}` : `⊥ in ${used}, par is ${par}`,
    // Wandering still refutes, so it still counts; the score is where the
    // difference between a tidy derivation and a lucky one shows up.
    score: Math.min(1, par / Math.max(used, 1)),
    detail:
      used <= par
        ? 'Nothing wasted.'
        : `It can be done in ${par}. One route: ${solve(question)
            .map((step) => `${showClause(step.left)} + ${showClause(step.right)} on ${step.pivot}`)
            .join(', ')}.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

interface Entry {
  clause: Clause
  /** Null for an input clause. */
  step: Step | null
}

function Screen({ question, submit, locked }: MinigameScreenProps<RefutationQuestion, RefutationAnswer>) {
  const [entries, setEntries] = useState<Entry[]>(() =>
    question.clauses.map((clause) => ({ clause, step: null })),
  )
  const [selected, setSelected] = useState<number | null>(null)
  const [pivotChoice, setPivotChoice] = useState<{ a: number; b: number; pivots: string[] } | null>(null)

  useEffect(() => {
    setEntries(question.clauses.map((clause) => ({ clause, step: null })))
    setSelected(null)
    setPivotChoice(null)
  }, [question])

  const steps = useMemo(
    () => entries.filter((entry): entry is Entry & { step: Step } => entry.step !== null).map((entry) => entry.step),
    [entries],
  )
  const reachedEmpty = entries.some((entry) => entry.clause.length === 0)

  const addResolvent = (a: number, b: number, pivot: string) => {
    const left = (entries[a] as Entry).clause
    const right = (entries[b] as Entry).clause
    const resolvent = resolveOn(left, right, pivot)
    if (resolvent === null) return
    setEntries((previous) =>
      previous.some((entry) => clauseKey(entry.clause) === clauseKey(resolvent))
        ? previous
        : [...previous, { clause: resolvent, step: { left, right, pivot, resolvent } }],
    )
  }

  const pick = (index: number) => {
    if (locked || reachedEmpty) return
    if (pivotChoice !== null) return
    if (selected === null) {
      setSelected(index)
      return
    }
    if (selected === index) {
      setSelected(null)
      return
    }

    const left = (entries[selected] as Entry).clause
    const right = (entries[index] as Entry).clause
    const options = resolvents(left, right)

    if (options.length === 0) {
      // The empty clause has no literals, so nothing can be resolved on it —
      // and two clauses with no shared variable simply do not interact.
      setSelected(null)
      return
    }
    if (options.length === 1) {
      addResolvent(selected, index, (options[0] as { pivot: string }).pivot)
      setSelected(null)
      return
    }
    setPivotChoice({ a: selected, b: index, pivots: options.map((option) => option.pivot) })
    setSelected(null)
  }

  const canPairWithSelection = (index: number): boolean => {
    if (selected === null || selected === index) return true
    const left = (entries[selected] as Entry).clause
    const right = (entries[index] as Entry).clause
    return resolvents(left, right).length > 0
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Derive the empty clause
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {steps.length} step{steps.length === 1 ? '' : 's'} · par {question.par}
        </p>
      </div>

      <p className="mt-1 text-xs font-medium text-ink-soft">
        Tap two clauses to resolve them. Only pairs that clash on a variable can combine.
      </p>

      <div className="mt-3 flex flex-col gap-1.5">
        {entries.map((entry, index) => {
          const isSelected = selected === index
          const compatible = canPairWithSelection(index)
          const isEmpty = entry.clause.length === 0

          return (
            <button
              key={`${clauseKey(entry.clause)}-${index}`}
              type="button"
              disabled={locked || reachedEmpty || isEmpty}
              onClick={() => pick(index)}
              className={`tile flex items-center gap-2 px-3 py-2 text-left
                ${
                  isEmpty
                    ? 'bg-coin'
                    : isSelected
                      ? 'bg-space-blue text-white'
                      : compatible
                        ? 'bg-card'
                        : 'bg-card-shade opacity-45'
                }`}
            >
              <span className="w-6 shrink-0 text-xs font-bold opacity-70">{index + 1}</span>
              <ClauseText
                clause={entry.clause}
                className={`text-base font-bold ${isSelected ? 'text-white' : ''}`}
              />
              {entry.step !== null && (
                <span className="ml-auto whitespace-nowrap text-xs font-semibold opacity-70">
                  on {entry.step.pivot}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {pivotChoice !== null && (
        <div className="tile mt-3 bg-coin p-3">
          <p className="text-sm font-bold">
            These clash on {pivotChoice.pivots.length} variables. One pivot per step — pick one.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pivotChoice.pivots.map((pivot) => (
              <Button
                key={pivot}
                variant="secondary"
                onClick={() => {
                  addResolvent(pivotChoice.a, pivotChoice.b, pivot)
                  setPivotChoice(null)
                }}
              >
                {pivot}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setPivotChoice(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!locked && (
        <Button
          variant="coin"
          className="mt-4 w-full"
          disabled={!reachedEmpty}
          onClick={() => submit(steps)}
        >
          {reachedEmpty ? `Submit — ${steps.length} steps` : 'Keep resolving until you reach □'}
        </Button>
      )}
    </Card>
  )
}

export const refutationGame = defineMinigame<RefutationQuestion, RefutationAnswer>({
  id: 'refutation',
  title: 'Refutation Run',
  tagline: 'Resolve your way down to the empty clause.',
  topics: ['resolution', 'proof-systems'],
  icon: '🪓',
  roundSeconds: 240,
  sprintQuestions: 5,
  generate,
  check,
  solve,
  Screen,
  Guide: RefutationGuide,
  questionKey: (question) => question.clauses.map(clauseKey).join(';'),
})
