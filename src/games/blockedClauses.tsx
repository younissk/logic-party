/**
 * Blocked clause elimination — ln.pdf §2.4 Definition 2.33, exam25a Q1.3.
 *
 * A literal l ∈ C is blocked when *every* clause D containing ¬l resolves with
 * C on l to a tautology. Removing a blocked clause preserves satisfiability
 * (Theorem 2.34), so eliminating everything proves the formula satisfiable —
 * though it hands you no model.
 *
 * The shortcut that solves most of these: a **pure** literal is automatically
 * blocked. If nothing contains ¬l there are no D to check and the condition
 * holds vacuously. Hunt those first; the exam question is six of them in a
 * row.
 *
 * The game is the exam's own instruction — find a blocked clause, remove it,
 * find the next — so a move is only allowed when it is actually legal, and
 * tapping a clause that is not blocked shows you why.
 */

import { useEffect, useMemo, useState } from 'react'
import type { Clause, Literal } from '@/logic'
import {
  bce,
  blockingLiteral,
  clauseKey,
  isTautologicalClause,
  normaliseClause,
  pureLiterals,
  resolveOn,
  showClause,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'
import { BlockedClausesGuide } from './blockedClauses.guide'

export interface BlockedQuestion {
  clauses: Clause[]
  /** How many removals the reference run takes — always all of them. */
  par: number
}

/** The clauses removed, in order. */
export type BlockedAnswer = Clause[]

interface Profile {
  variables: string[]
  clauses: [min: number, max: number]
  width: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['a', 'b', 'c', 'd'], clauses: [3, 4], width: [2, 3] },
  medium: { variables: ['a', 'b', 'c', 'd', 'e'], clauses: [4, 5], width: [2, 3] },
  hard: { variables: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], clauses: [5, 6], width: [2, 4] },
}

const ATTEMPTS = 400

function generate({ rng, difficulty }: GenerateContext): BlockedQuestion {
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

    // Elimination has to actually finish, or the puzzle has no solution.
    const run = bce(clauses)
    if (!run.complete) continue
    // At least one step where the blocking literal was not simply pure, so the
    // definition gets exercised and not only the shortcut.
    if (!run.steps.some((step) => !step.pure)) continue

    return { clauses, par: run.steps.length }
  }

  // Last resort, so a round can never stall: the exam's own question.
  const named: [string, boolean][][] = [
    [['a', false], ['b', false], ['c', false], ['d', false]],
    [['a', true], ['b', false], ['c', true]],
    [['a', false], ['e', false]],
    [['a', true], ['e', false]],
    [['c', false], ['f', false]],
    [['c', true], ['g', false]],
  ]
  const clauses = named.map((clause) => clause.map(([name, negated]) => ({ name, negated })))
  return { clauses, par: bce(clauses).steps.length }
}

const solve = (question: BlockedQuestion): BlockedAnswer =>
  bce(question.clauses).steps.map((step) => step.clause)

function check(question: BlockedQuestion, answer: BlockedAnswer): Verdict {
  // Replay it. `check` has to be right on any input, not only on what the
  // screen happens to allow.
  let current = question.clauses.map((clause) => normaliseClause(clause))
  for (const clause of answer) {
    const literal = blockingLiteral(current, clause)
    if (literal === null) {
      return { correct: false, message: `${showClause(clause)} was not blocked` }
    }
    current = current.filter((other) => clauseKey(other) !== clauseKey(clause))
  }

  if (current.length > 0) {
    return { correct: false, message: `${current.length} clauses still standing` }
  }

  const run = bce(question.clauses)
  const pure = run.steps.filter((step) => step.pure).length
  return {
    correct: true,
    message: 'Empty formula — satisfiable',
    detail: `${pure} of the ${run.steps.length} removals were pure literals, where there is nothing to check at all. Removal preserves satisfiability, not equivalence — so this proves the formula satisfiable without producing a model.`,
  }
}

/** Why a clause cannot be removed right now, in the definition's own terms. */
function refusal(clauses: readonly Clause[], clause: Clause): string {
  for (const literal of clause) {
    const opposite: Literal = { name: literal.name, negated: !literal.negated }
    const blocker = clauses
      .filter((other) => clauseKey(other) !== clauseKey(clause))
      .filter((other) => other.some((entry) => entry.name === opposite.name && entry.negated === opposite.negated))
      .find((other) => {
        const resolvent = resolveOn(clause, other, literal.name)
        return resolvent !== null && !isTautologicalClause(resolvent)
      })
    if (blocker === undefined) continue
    const resolvent = resolveOn(clause, blocker, literal.name) as Clause
    return `On ${literal.negated ? '¬' : ''}${literal.name}, resolving with ${showClause(
      blocker,
    )} gives ${showClause(resolvent)} — not a tautology.`
  }
  return 'No literal of it is blocked.'
}

function Screen({ question, submit, locked }: MinigameScreenProps<BlockedQuestion, BlockedAnswer>) {
  const [removed, setRemoved] = useState<Clause[]>([])
  const [refused, setRefused] = useState<{ clause: Clause; why: string } | null>(null)

  useEffect(() => {
    setRemoved([])
    setRefused(null)
  }, [question])

  const remaining = useMemo(
    () =>
      question.clauses.filter(
        (clause) => !removed.some((gone) => clauseKey(gone) === clauseKey(clause)),
      ),
    [question, removed],
  )

  const pure = useMemo(
    () => new Set(pureLiterals(remaining).map((l) => `${l.negated ? '¬' : ''}${l.name}`)),
    [remaining],
  )

  const tap = (clause: Clause) => {
    if (locked) return
    const literal = blockingLiteral(remaining, clause)
    if (literal === null) {
      setRefused({ clause, why: refusal(remaining, clause) })
      return
    }
    setRefused(null)
    setRemoved((previous) => [...previous, clause])
  }

  const done = remaining.length === 0

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Delete every clause
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {removed.length} of {question.par} gone
        </p>
      </div>

      <p className="mt-1 text-xs font-medium text-ink-soft">
        Tap a clause to remove it — only blocked ones will go. A pure literal is always blocked, so
        hunt those first.
      </p>

      <div className="mt-3 flex flex-col gap-1.5">
        {remaining.map((clause, index) => {
          const literal = blockingLiteral(remaining, clause)
          const isPure =
            literal !== null && pure.has(`${literal.negated ? '¬' : ''}${literal.name}`)
          return (
            <button
              key={index}
              type="button"
              disabled={locked}
              onClick={() => tap(clause)}
              className={`tile flex items-center gap-2 px-3 py-2 text-left
                ${literal !== null ? 'bg-card' : 'bg-card-shade'}`}
            >
              <ClauseText clause={clause} className="text-base font-bold" />
              {locked && literal !== null && (
                <span className="ml-auto whitespace-nowrap text-xs font-bold text-ink-soft">
                  blocked on {literal.negated ? '¬' : ''}
                  {literal.name}
                  {isPure ? ' (pure)' : ''}
                </span>
              )}
            </button>
          )
        })}
        {done && (
          <p className="formula rounded-xl bg-grass px-3 py-2 text-base font-bold text-white">
            ⊤ — the empty formula
          </p>
        )}
      </div>

      {refused !== null && !locked && (
        <div className="tile mt-3 bg-coin p-3">
          <p className="text-sm font-bold">
            <span className="formula">{showClause(refused.clause)}</span> is not blocked yet
          </p>
          <p className="mt-1 text-sm font-medium">{refused.why}</p>
          <p className="mt-1 text-xs font-medium">
            Removing another clause first can unblock it — that is why this cascades.
          </p>
        </div>
      )}

      {removed.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-soft">
          Removed:
          {removed.map((clause, index) => (
            <span key={index} className="rounded-md bg-card-shade px-1.5 py-0.5">
              <ClauseText clause={clause} className="text-xs font-bold" />
            </span>
          ))}
        </p>
      )}

      {!locked && (
        <Button variant="coin" className="mt-3 w-full" disabled={!done} onClick={() => submit(removed)}>
          {done ? 'Submit — satisfiable' : `${remaining.length} still standing`}
        </Button>
      )}
    </Card>
  )
}

export const blockedClausesGame = defineMinigame<BlockedQuestion, BlockedAnswer>({
  id: 'blocked-clauses',
  title: 'Delete It All',
  tagline: 'Prove satisfiability by removing every clause.',
  topics: ['resolution', 'proof-systems'],
  icon: '🧨',
  roundSeconds: 240,
  sprintQuestions: 5,
  generate,
  check,
  solve,
  Screen,
  Guide: BlockedClausesGuide,
  questionKey: (question) => question.clauses.map(clauseKey).join(';'),
})
