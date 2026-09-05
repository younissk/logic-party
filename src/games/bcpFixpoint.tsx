/**
 * BCP until fixpoint — ln.pdf §2.4 Definition 2.39, exam25a Q1.1c.
 *
 * Two mechanical moves per unit literal l, and only these two:
 *   - delete every clause containing l — already satisfied;
 *   - erase ¬l from every clause it appears in — that literal is dead.
 *
 * Then repeat. The wrong answers on offer are the four ways people actually
 * slip: erasing the wrong polarity, deleting instead of erasing, stopping one
 * unit early, and dropping a clause that mentions neither.
 */

import { useEffect, useState } from 'react'
import type { Clause, Literal } from '@/logic'
import {
  bcp,
  bcpOutcome,
  bcpStep,
  clauseKey,
  isTautologicalClause,
  normaliseClause,
  showClauseSet,
  type BcpOutcome,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Card } from '@/ui/primitives'
import { ClauseList, ClauseSetChoice, ClauseSetText } from '@/ui/ClauseSet'
import { BcpFixpointGuide } from './bcpFixpoint.guide'

export interface BcpQuestion {
  clauses: Clause[]
  options: Clause[][]
  answer: number
}

export type BcpAnswer = number

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

const setKey = (set: readonly Clause[]) =>
  [...set.map(clauseKey)].sort().join(';')

/**
 * The four slips, as clause sets.
 *
 * Each is what you get by doing the propagation *almost* right, so telling
 * them apart is exactly the skill Definition 2.39 is testing.
 */
function distractors(clauses: readonly Clause[]): Clause[][] {
  const out: Clause[][] = []
  const unit = clauses.find((clause) => clause.length === 1)
  if (unit === undefined) return out
  const literal = unit[0] as Literal
  const flipped: Literal = { name: literal.name, negated: !literal.negated }

  // Propagated the complement instead — the polarity slip.
  out.push(bcp(bcpStep(clauses, flipped)).result)

  // Deleted the clauses containing ¬l rather than erasing the literal from them.
  out.push(
    bcp(
      clauses
        .filter((clause) => !clause.some((other) => other.name === literal.name))
        .map((clause) => [...clause]),
    ).result,
  )

  // Stopped after the first propagation instead of running to fixpoint.
  out.push(bcpStep(clauses, literal))

  // Erased l but forgot to delete the clauses it satisfied.
  out.push(
    bcp(
      clauses.map((clause) => clause.filter((other) => other.name !== literal.name)),
    ).result,
  )

  return out
}

const ATTEMPTS = 400

function generate({ rng, difficulty }: GenerateContext): BcpQuestion {
  const profile = PROFILES[difficulty]
  // Draw the outcome first, so all three come up — a round of nothing but
  // "undecided" would never exercise naming the other two.
  const target = rng.pick(['satisfiable', 'unsatisfiable', 'undecided'] as const)

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const count = rng.range(...profile.clauses)
    const units = rng.range(...profile.units)
    const clauses: Clause[] = []

    for (let index = 0; index < count; index++) {
      const width = index < units ? 1 : Math.min(rng.range(2, profile.width[1]), profile.variables.length)
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
    // At least two propagations, or there is nothing to run to fixpoint.
    if (run.steps.length < 2) continue

    const truth = run.result
    const wrong: Clause[][] = []
    for (const option of distractors(clauses)) {
      if (setKey(option) === setKey(truth)) continue
      if (wrong.some((existing) => setKey(existing) === setKey(option))) continue
      wrong.push(option)
    }
    if (wrong.length < 2) continue

    const options = rng.shuffle([truth, ...wrong.slice(0, 3)])
    return { clauses, options, answer: options.findIndex((option) => setKey(option) === setKey(truth)) }
  }

  // Last resort, so a round can never stall: the exam's own question.
  const clauses: Clause[] = [
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
  ]
  const truth = bcp(clauses).result
  return { clauses, options: [truth], answer: 0 }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: BcpQuestion): BcpAnswer => question.answer

function check(question: BcpQuestion, answer: BcpAnswer): Verdict {
  const run = bcp(question.clauses)
  const trace = run.steps
    .map((step) => `${step.literal.negated ? '¬' : ''}${step.literal.name}`)
    .join(' → ')

  if (answer === question.answer) {
    return {
      correct: true,
      message: OUTCOME_LABELS[run.outcome],
      detail: `Propagated ${trace}. ${showClauseSet(run.result)} is what is left.`,
    }
  }

  return {
    correct: false,
    // Says nothing about which option is right — sprint shows this before the
    // retry, and there are only a handful of options.
    message: 'Not what BCP leaves',
    detail: `Propagated ${trace}, giving ${showClauseSet(run.result)} — ${OUTCOME_LABELS[run.outcome]}. Delete the clauses containing the unit literal; erase only its complement from the rest.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked, solution }: MinigameScreenProps<BcpQuestion, BcpAnswer>) {
  const [picked, setPicked] = useState<number | null>(null)

  useEffect(() => {
    setPicked(null)
  }, [question])

  const run = bcp(question.clauses)

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        What does BCP leave?
      </p>

      <ClauseList set={question.clauses} className="mt-2" />

      <p className="mt-3 text-xs font-medium text-ink-soft">
        Propagate every unit clause until none is left. Delete the clauses containing the unit
        literal; erase only its complement from the others.
      </p>

      <ClauseSetChoice
        options={question.options}
        solution={solution}
        locked={locked}
        onPick={(index) => {
          setPicked(index)
          submit(index)
        }}
      />

      {locked && (
        <div className="mt-3 rounded-2xl bg-card-shade p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">The run</p>
          <ol className="mt-1 flex flex-col gap-1 text-sm font-medium">
            {run.steps.map((step, index) => (
              <li key={index} className="flex flex-wrap items-baseline gap-x-2">
                <span className="formula font-bold">
                  unit ({step.literal.negated ? '¬' : ''}
                  {step.literal.name})
                </span>
                <span className="text-ink-soft">→</span>
                <ClauseSetText set={step.result} />
              </li>
            ))}
          </ol>
          <p className="mt-2 border-t-2 border-dashed border-ink-soft/40 pt-2 text-sm font-bold">
            {OUTCOME_LABELS[bcpOutcome(run.result)]}
          </p>
          {picked !== null && picked !== question.answer && (
            <p className="mt-1 text-xs font-medium text-ink-soft">You picked the option above it.</p>
          )}
        </div>
      )}
    </Card>
  )
}

export const bcpGame = defineMinigame<BcpQuestion, BcpAnswer>({
  id: 'bcp',
  title: 'Propagate It',
  tagline: 'Run BCP to fixpoint and name what is left.',
  topics: ['satisfiability'],
  icon: '⚡',
  roundSeconds: 150,
  sprintQuestions: 8,
  sprintPenaltySeconds: 10,
  generate,
  check,
  solve,
  Screen,
  Guide: BcpFixpointGuide,
  questionKey: (question) => question.clauses.map(clauseKey).join(';'),
})

export { setKey }
