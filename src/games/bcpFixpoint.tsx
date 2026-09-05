/**
 * BCP until fixpoint — ln.pdf §2.4 Definition 2.39, exam25a Q1.1c.
 *
 * You run it. Tap a unit clause and the two mechanical moves happen in front
 * of you: every clause containing that literal leaves, and its complement is
 * struck out of the ones that stay. Then again, until nothing is forced.
 *
 * What is graded is the words *until fixpoint*. You may stop whenever you
 * like, and stopping while a unit clause is still on the table is the mistake
 * — the same one as reading the question as "propagate once".
 */

import { useEffect, useMemo, useState } from 'react'
import type { Clause, Literal } from '@/logic'
import {
  bcp,
  bcpOutcome,
  bcpStep,
  clauseKey,
  isTautologicalClause,
  literalsEqual,
  normaliseClause,
  showClauseSet,
  type BcpOutcome,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'
import { ClauseSetText } from '@/ui/ClauseSet'
import { MovingItem, MovingList, Pop, ProgressBar } from '@/ui/motion'
import { BcpFixpointGuide } from './bcpFixpoint.guide'

export interface BcpQuestion {
  clauses: Clause[]
}

/** The unit literals propagated, in the order they were chosen. */
export type BcpAnswer = Literal[]

export const OUTCOME_LABELS: Readonly<Record<BcpOutcome, string>> = {
  satisfiable: 'empty formula — satisfiable',
  unsatisfiable: 'contains ⊥ — unsatisfiable',
  undecided: 'neither — BCP is out of moves',
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  variables: string[]
  clauses: [min: number, max: number]
  width: [min: number, max: number]
  units: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['a', 'b', 'c'], clauses: [3, 4], width: [1, 2], units: [1, 1] },
  medium: { variables: ['a', 'b', 'c', 'd'], clauses: [4, 5], width: [1, 3], units: [1, 2] },
  hard: { variables: ['a', 'b', 'c', 'd', 'e', 'f'], clauses: [5, 6], width: [1, 3], units: [1, 2] },
}

const ATTEMPTS = 400

function generate({ rng, difficulty }: GenerateContext): BcpQuestion {
  const profile = PROFILES[difficulty]
  // Draw the outcome first, so all three come up — a round of nothing but
  // "undecided" would never show the empty formula or the empty clause.
  const target = rng.pick(['satisfiable', 'unsatisfiable', 'undecided'] as const)

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const count = rng.range(...profile.clauses)
    const units = rng.range(...profile.units)
    const clauses: Clause[] = []

    for (let index = 0; index < count; index++) {
      const width =
        index < units ? 1 : Math.min(rng.range(2, profile.width[1]), profile.variables.length)
      const clause = normaliseClause(
        rng.sample(profile.variables, width).map((name) => ({ name, negated: rng.bool() })),
      )
      if (isTautologicalClause(clause)) break
      if (clauses.some((existing) => clauseKey(existing) === clauseKey(clause))) break
      clauses.push(clause)
    }
    if (clauses.length !== count) continue
    if (!clauses.some((clause) => clause.length === 1)) continue

    const run = bcp(clauses)
    if (run.outcome !== target) continue
    // At least two propagations, or "until fixpoint" asks nothing that
    // "propagate once" does not.
    if (run.steps.length < 2) continue

    return { clauses }
  }

  // Last resort, so a round can never stall: the exam's own question.
  return {
    clauses: [
      [{ name: 'a', negated: false }],
      [
        { name: 'a', negated: true },
        { name: 'c', negated: false },
        { name: 'd', negated: false },
      ],
      [
        { name: 'a', negated: true },
        { name: 'b', negated: false },
        { name: 'c', negated: true },
      ],
      [
        { name: 'a', negated: true },
        { name: 'c', negated: true },
      ],
      [
        { name: 'a', negated: false },
        { name: 'b', negated: false },
      ],
      [
        { name: 'd', negated: true },
        { name: 'e', negated: false },
        { name: 'f', negated: false },
      ],
    ],
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: BcpQuestion): BcpAnswer =>
  bcp(question.clauses).steps.map((step) => step.literal)

/** Replay a sequence of propagations, refusing any that was not forced. */
export function replay(
  clauses: readonly Clause[],
  order: readonly Literal[],
): { result: Clause[]; illegal: Literal | null } {
  let current = clauses.map((clause) => normaliseClause(clause))
  for (const literal of order) {
    const wasUnit = current.some(
      (clause) => clause.length === 1 && literalsEqual(clause[0] as Literal, literal),
    )
    if (!wasUnit) return { result: current, illegal: literal }
    current = bcpStep(current, literal)
  }
  return { result: current, illegal: null }
}

function check(question: BcpQuestion, answer: BcpAnswer): Verdict {
  const { result, illegal } = replay(question.clauses, answer)

  if (illegal !== null) {
    return {
      correct: false,
      message: `${illegal.negated ? '¬' : ''}${illegal.name} was not a unit clause`,
      detail: 'BCP only ever propagates a clause with exactly one literal left in it.',
    }
  }

  // A conflict ends the run whatever else is on the table: once the empty
  // clause is there the formula is unsatisfiable and there is nothing further
  // propagation could tell you. Demanding no units left would reject exactly
  // the case BCP is best at.
  const conflicted = result.some((clause) => clause.length === 0)
  const remaining = conflicted ? undefined : result.find((clause) => clause.length === 1)
  if (remaining !== undefined) {
    const literal = remaining[0] as Literal
    return {
      correct: false,
      // Does not say what is left, only that something is: sprint shows this
      // before the retry.
      message: 'Not at fixpoint yet',
      detail: `${literal.negated ? '¬' : ''}${literal.name} is still a unit clause. "Until fixpoint" means until no unit clause remains.`,
      score: answer.length / Math.max(bcp(question.clauses).steps.length, 1),
    }
  }

  const outcome = bcpOutcome(result)
  return {
    correct: true,
    message: OUTCOME_LABELS[outcome],
    detail: `${showClauseSet(result)} is what is left after ${answer.length} propagation${
      answer.length === 1 ? '' : 's'
    }.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const literalKey = (literal: Literal) => `${literal.negated ? '¬' : ''}${literal.name}`

function Screen({ question, submit, locked }: MinigameScreenProps<BcpQuestion, BcpAnswer>) {
  const [order, setOrder] = useState<Literal[]>([])

  useEffect(() => {
    setOrder([])
  }, [question])

  const { result } = useMemo(() => replay(question.clauses, order), [question, order])
  const par = useMemo(() => bcp(question.clauses).steps.length, [question])

  // Keyed by content, not by position: after a propagation the indices shift,
  // and an index-keyed list looks to AnimatePresence like every item was
  // replaced — so nothing ever finished exiting and the board showed the old
  // clauses alongside the new ones. Deduplicated for the same reason a clause
  // set is a set: striking a literal can make two clauses equal.
  const shown = result.filter(
    (clause, index) => result.findIndex((other) => clauseKey(other) === clauseKey(clause)) === index,
  )

  const conflicted = result.some((clause) => clause.length === 0)
  const units = conflicted ? [] : result.filter((clause) => clause.length === 1)
  const atFixpoint = units.length === 0
  const outcome = bcpOutcome(result)

  const propagate = (literal: Literal) => {
    if (locked) return
    // Validated inside the updater, against state replayed from scratch, so it
    // cannot be fooled by a stale closure. A card that is mid-exit is still in
    // the DOM and still clickable, and it holds the *previous* render's board —
    // on which its own literal was of course still a unit. Checking that copy
    // let the same tap through repeatedly, so the counter read eight
    // propagations where one had happened.
    setOrder((previous) => {
      const board = replay(question.clauses, previous).result
      const unit = board.some(
        (clause) => clause.length === 1 && literalsEqual(clause[0] as Literal, literal),
      )
      return unit ? [...previous, literal] : previous
    })
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Propagate to fixpoint
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {order.length} propagated
        </p>
      </div>

      <p className="mt-1 text-xs font-medium text-ink-soft">
        Tap a unit clause. Clauses containing it go; its complement is struck out of the rest.
      </p>

      <MovingList className="mt-2 flex flex-col gap-1.5">
        {shown.map((clause) => {
          const unit = clause.length === 1
          const empty = clause.length === 0
          return (
            <MovingItem
              key={clauseKey(clause)}
              id={clauseKey(clause)}
              disabled={locked || !unit}
              onClick={() => unit && propagate(clause[0] as Literal)}
              className={`tile flex w-full items-center gap-2 px-3 py-2 text-left
                ${empty ? 'bg-space-red text-white' : unit ? 'bg-coin' : 'bg-card'}`}
            >
              <ClauseText clause={clause} className="text-base font-bold" />
              {unit && !locked && (
                <span className="ml-auto text-xs font-bold uppercase tracking-wider">
                  unit — tap
                </span>
              )}
              {empty && (
                <span className="ml-auto text-xs font-bold uppercase tracking-wider">conflict</span>
              )}
            </MovingItem>
          )
        })}
        {shown.length === 0 && (
          <Pop className="tile bg-grass px-3 py-2">
            <p className="formula text-base font-bold text-white">⊤ — the empty formula</p>
          </Pop>
        )}
      </MovingList>

      {order.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-soft">
          Propagated:
          {order.map((literal, index) => (
            <span key={index} className="formula rounded-md bg-card-shade px-1.5 py-0.5 font-bold">
              {literalKey(literal)}
            </span>
          ))}
        </p>
      )}

      <div className="mt-3">
        <ProgressBar value={Math.min(order.length, par)} total={par} />
      </div>

      {!locked && (
        <Button variant={atFixpoint ? 'coin' : 'secondary'} className="mt-2 w-full" onClick={() => submit(order)}>
          {atFixpoint ? `Done — ${OUTCOME_LABELS[outcome]}` : `Stop here (${units.length} unit${units.length === 1 ? '' : 's'} left)`}
        </Button>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">At fixpoint</p>
          <p className="mt-1">
            <ClauseSetText set={bcp(question.clauses).result} />
          </p>
          <p className="mt-1 font-bold">{OUTCOME_LABELS[bcp(question.clauses).outcome]}</p>
        </Pop>
      )}
    </Card>
  )
}

export const bcpGame = defineMinigame<BcpQuestion, BcpAnswer>({
  id: 'bcp',
  title: 'Propagate It',
  tagline: 'Run BCP yourself, all the way to fixpoint.',
  topics: ['satisfiability'],
  icon: '⚡',
  roundSeconds: 150,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  Screen,
  Guide: BcpFixpointGuide,
  questionKey: (question) => question.clauses.map(clauseKey).join(';'),
})
