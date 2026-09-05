/**
 * The DP procedure — ln.pdf §2.4, exam26a and exam26bA Q1.2.
 *
 * You run the elimination. Tap a variable and the clauses mentioning it leave,
 * the resolvents arrive, and the tautologies among them burn off on the way —
 * which is the step people skip when they only have to recognise it.
 *
 * Keep going until nothing is left. Where you end is the answer: the empty
 * formula means satisfiable, the empty clause means unsatisfiable, and mixing
 * those two up is the only thing this question really tests.
 */

import { useEffect, useMemo, useState } from 'react'
import type { Clause } from '@/logic'
import {
  clauseKey,
  clauseVariables,
  eliminateVariable,
  isTautologicalClause,
  normaliseClause,
  showClauseSet,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'
import { ClauseSetText } from '@/ui/ClauseSet'
import { MovingItem, MovingList, Pop, ProgressBar } from '@/ui/motion'
import { VariableName } from '@/ui/FormulaText'
import { DpEliminateGuide } from './dpEliminate.guide'

export interface DpQuestion {
  clauses: Clause[]
  /** Variables that have to go, so the meter has something to measure. */
  variables: string[]
}

/** The variables eliminated, in the order chosen. */
export type DpAnswer = string[]

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  variables: string[]
  clauses: [min: number, max: number]
  width: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['x', 'y', 'z'], clauses: [3, 4], width: [2, 2] },
  medium: { variables: ['x', 'y', 'z'], clauses: [4, 6], width: [2, 3] },
  hard: { variables: ['w', 'x', 'y', 'z'], clauses: [5, 7], width: [2, 3] },
}

const ATTEMPTS = 400

function generate({ rng, difficulty }: GenerateContext): DpQuestion {
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

    const variables = [...new Set(clauses.flatMap(clauseVariables))].sort((a, b) =>
      a.localeCompare(b),
    )
    if (variables.length < 2) continue

    // At least one elimination has to throw a tautology away, or the rule the
    // question is about never comes up.
    const dropsSomething = variables.some(
      (variable) => eliminateVariable(clauses, variable).discarded.length > 0,
    )
    if (!dropsSomething) continue

    return { clauses, variables }
  }

  // Last resort, so a round can never stall: the exam's own question.
  const clauses: Clause[] = [
    [
      { name: 'x', negated: true },
      { name: 'y', negated: false },
      { name: 'z', negated: false },
    ],
    [
      { name: 'x', negated: false },
      { name: 'y', negated: true },
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
  return { clauses, variables: ['x', 'y', 'z'] }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: DpQuestion): DpAnswer => [...question.variables]

/**
 * Replay an elimination order, stopping at the empty clause as DP does.
 *
 * A variable the formula no longer mentions is skipped rather than refused:
 * eliminating one variable routinely takes another with it, when every clause
 * that mentioned it was consumed. Asking for a variable that is already gone
 * is a no-op, not an illegal move.
 */
export function runElimination(clauses: readonly Clause[], order: readonly string[]): Clause[] {
  let current = clauses.map((clause) => normaliseClause(clause))
  for (const variable of order) {
    if (current.some((clause) => clause.length === 0)) break
    if (!current.some((clause) => clause.some((literal) => literal.name === variable))) continue
    current = eliminateVariable(current, variable).result
  }
  return current
}

export const verdictOf = (clauses: readonly Clause[]): 'satisfiable' | 'unsatisfiable' =>
  clauses.some((clause) => clause.length === 0) ? 'unsatisfiable' : 'satisfiable'

function check(question: DpQuestion, answer: DpAnswer): Verdict {
  const result = runElimination(question.clauses, answer)
  const conflicted = result.some((clause) => clause.length === 0)
  if (!conflicted && result.length > 0) {
    return {
      correct: false,
      message: 'Something is still standing',
      detail: `${result.length} clause${result.length === 1 ? '' : 's'} left. Keep eliminating: DP finishes at the empty formula or at the empty clause, and nowhere else.`,
      score: answer.length / Math.max(question.variables.length, 1),
    }
  }

  const verdict = verdictOf(result)
  return {
    correct: true,
    message: conflicted ? 'Empty clause — unsatisfiable' : 'Empty formula — satisfiable',
    detail:
      verdict === 'satisfiable'
        ? 'Every clause was eliminated away, and reaching the empty formula is what proves it satisfiable.'
        : 'A clause lost its last literal. The empty clause is false under everything, so the formula is unsatisfiable.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked }: MinigameScreenProps<DpQuestion, DpAnswer>) {
  const [order, setOrder] = useState<string[]>([])
  const [last, setLast] = useState<ReturnType<typeof eliminateVariable> | null>(null)

  useEffect(() => {
    setOrder([])
    setLast(null)
  }, [question])

  const result = useMemo(() => runElimination(question.clauses, order), [question, order])
  const left = useMemo(
    () => [...new Set(result.flatMap(clauseVariables))].sort((a, b) => a.localeCompare(b)),
    [result],
  )

  // Keyed by content, not by position: after a propagation the indices shift,
  // and an index-keyed list looks to AnimatePresence like every item was
  // replaced — so nothing ever finished exiting and the board showed the old
  // clauses alongside the new ones. Deduplicated for the same reason a clause
  // set is a set: striking a literal can make two clauses equal.
  const shown = result.filter(
    (clause, index) => result.findIndex((other) => clauseKey(other) === clauseKey(clause)) === index,
  )

  const conflicted = result.some((clause) => clause.length === 0)
  const done = conflicted || result.length === 0

  const eliminate = (variable: string) => {
    if (locked || done) return
    setLast(eliminateVariable(result, variable))
    setOrder((previous) => [...previous, variable])
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Eliminate every variable
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {order.length} of {question.variables.length} gone
        </p>
      </div>

      <p className="mt-1 text-xs font-medium text-ink-soft">
        Tap a variable: every clause mentioning it goes, the resolvents arrive, tautologies among
        them are thrown away.
      </p>

      <MovingList className="mt-2 flex flex-col gap-1.5">
        {shown.map((clause) => (
          <MovingItem
            key={clauseKey(clause)}
            id={clauseKey(clause)}
            disabled
            className={`tile flex w-full items-center px-3 py-2 text-left
              ${clause.length === 0 ? 'bg-space-red text-white' : 'bg-card'}`}
          >
            <ClauseText clause={clause} className="text-base font-bold" />
            {clause.length === 0 && (
              <span className="ml-auto text-xs font-bold uppercase tracking-wider">
                the empty clause
              </span>
            )}
          </MovingItem>
        ))}
        {shown.length === 0 && (
          <Pop className="tile bg-grass px-3 py-2">
            <p className="formula text-base font-bold text-white">⊤ — the empty formula</p>
          </Pop>
        )}
      </MovingList>

      {last !== null && last.discarded.length > 0 && (
        <Pop className="mt-2 rounded-xl bg-card-shade px-3 py-1.5 text-xs font-semibold text-ink-soft">
          {last.discarded.length} tautological resolvent{last.discarded.length === 1 ? '' : 's'}{' '}
          thrown away · {last.added.length} kept
        </Pop>
      )}

      {!locked && !done && (
        <div className="mt-3 flex flex-wrap gap-2">
          {left.map((variable) => (
            <Button
              key={variable}
              variant="secondary"
              className="min-h-11 px-4"
              onClick={() => eliminate(variable)}
            >
              <VariableName name={variable} />
            </Button>
          ))}
        </div>
      )}

      <div className="mt-3">
        <ProgressBar value={order.length} total={question.variables.length} />
      </div>

      {!locked && (
        <Button
          variant={done ? 'coin' : 'secondary'}
          className="mt-2 w-full"
          onClick={() => submit(order)}
        >
          {done
            ? conflicted
              ? 'Done — unsatisfiable'
              : 'Done — satisfiable'
            : `Stop here (${left.length} variable${left.length === 1 ? '' : 's'} left)`}
        </Button>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Where DP ends</p>
          <p className="mt-1">
            <ClauseSetText set={runElimination(question.clauses, question.variables)} />
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            {showClauseSet(runElimination(question.clauses, question.variables))}
          </p>
        </Pop>
      )}
    </Card>
  )
}

export const dpGame = defineMinigame<DpQuestion, DpAnswer>({
  id: 'dp',
  title: 'Eliminate',
  tagline: 'Resolve every variable away and see where you land.',
  topics: ['resolution', 'satisfiability'],
  icon: '🧹',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: DpEliminateGuide,
  questionKey: (question) => question.clauses.map(clauseKey).join(';'),
})
