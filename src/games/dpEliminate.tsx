/**
 * The DP procedure — ln.pdf §2.4, exam26a and exam26bA Q1.2.
 *
 * Not DPLL. DP has no tree and no backtracking: it deletes variables one at a
 * time by resolution. For variable v, resolve every clause containing v
 * against every clause containing ¬v, throw away the tautologies, then delete
 * all the originals mentioning v and add the survivors.
 *
 * The endpoint rule is the only thing you must not confuse:
 *   ends with the empty formula → satisfiable
 *   produces the empty clause   → unsatisfiable
 */

import { useEffect, useState } from 'react'
import type { Clause } from '@/logic'
import {
  clauseKey,
  clauseVariables,
  eliminateVariable,
  isTautologicalClause,
  normaliseClause,
  resolveOn,
  showClauseSet,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Card } from '@/ui/primitives'
import { ClauseList, ClauseSetChoice } from '@/ui/ClauseSet'
import { VariableName } from '@/ui/FormulaText'
import { DpEliminateGuide } from './dpEliminate.guide'

export interface DpQuestion {
  clauses: Clause[]
  variable: string
  options: Clause[][]
  answer: number
}

export type DpAnswer = number

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

const setKey = (set: readonly Clause[]) => [...set.map(clauseKey)].sort().join(';')

/**
 * The three ways an elimination goes wrong.
 *
 * All of them produce something that looks like a plausible clause set, which
 * is the point: the difference between them is precisely the definition.
 */
function distractors(clauses: readonly Clause[], variable: string): Clause[][] {
  const positive = clauses.filter((clause) =>
    clause.some((literal) => literal.name === variable && !literal.negated),
  )
  const negative = clauses.filter((clause) =>
    clause.some((literal) => literal.name === variable && literal.negated),
  )
  const untouched = clauses.filter((clause) => !clause.some((literal) => literal.name === variable))

  const resolvents: Clause[] = []
  const withTautologies: Clause[] = []
  for (const left of positive) {
    for (const right of negative) {
      const resolvent = resolveOn(left, right, variable)
      if (resolvent === null) continue
      if (!withTautologies.some((clause) => clauseKey(clause) === clauseKey(resolvent))) {
        withTautologies.push(resolvent)
      }
      if (isTautologicalClause(resolvent)) continue
      if (!resolvents.some((clause) => clauseKey(clause) === clauseKey(resolvent))) {
        resolvents.push(resolvent)
      }
    }
  }

  return [
    // Kept the tautological resolvents.
    [...untouched, ...withTautologies],
    // Forgot to delete the originals mentioning the variable.
    [...clauses, ...resolvents],
    // Deleted the originals but never added the resolvents.
    [...untouched],
  ]
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

    const candidates = [...new Set(clauses.flatMap(clauseVariables))].filter(
      (variable) =>
        clauses.some((clause) => clause.some((l) => l.name === variable && !l.negated)) &&
        clauses.some((clause) => clause.some((l) => l.name === variable && l.negated)),
    )
    if (candidates.length === 0) continue

    const variable = rng.pick(candidates)
    const step = eliminateVariable(clauses, variable)
    // At least one tautology dropped, because that is the rule being tested.
    if (step.discarded.length === 0) continue
    if (step.result.length === 0 || step.result.length > 6) continue

    const truth = step.result
    const wrong: Clause[][] = []
    for (const option of distractors(clauses, variable)) {
      if (setKey(option) === setKey(truth)) continue
      if (wrong.some((existing) => setKey(existing) === setKey(option))) continue
      wrong.push(option)
    }
    if (wrong.length < 2) continue

    const options = rng.shuffle([truth, ...wrong])
    return {
      clauses,
      variable,
      options,
      answer: options.findIndex((option) => setKey(option) === setKey(truth)),
    }
  }

  // Last resort, so a round can never stall: the exam's own first step.
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
  const truth = eliminateVariable(clauses, 'x').result
  return { clauses, variable: 'x', options: [truth], answer: 0 }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: DpQuestion): DpAnswer => question.answer

function check(question: DpQuestion, answer: DpAnswer): Verdict {
  const step = eliminateVariable(question.clauses, question.variable)
  const summary = `${step.removed.length} clauses mentioned ${question.variable} and all of them go; of the resolvents, ${step.discarded.length} ${step.discarded.length === 1 ? 'was a tautology' : 'were tautologies'} and ${step.added.length} survived.`

  if (answer === question.answer) {
    return { correct: true, message: `${question.variable} eliminated`, detail: summary }
  }

  return {
    correct: false,
    message: 'Not what elimination leaves',
    detail: `${showClauseSet(step.result)} is what is left. ${summary}`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked, solution }: MinigameScreenProps<DpQuestion, DpAnswer>) {
  const [, setPicked] = useState<number | null>(null)

  useEffect(() => {
    setPicked(null)
  }, [question])

  const step = eliminateVariable(question.clauses, question.variable)

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Eliminate <VariableName name={question.variable} className="text-base" />
      </p>

      <ClauseList set={question.clauses} className="mt-2" />

      <p className="mt-3 text-xs font-medium text-ink-soft">
        Resolve every clause containing <VariableName name={question.variable} /> against every
        clause containing ¬<VariableName name={question.variable} />, drop the tautologies, then
        delete all the originals that mention it.
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
        <div className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">The count</p>
          <p className="mt-1">
            {step.removed.length} clauses deleted · {step.added.length + step.discarded.length}{' '}
            resolvents, {step.discarded.length} tautological · {step.added.length} kept
          </p>
        </div>
      )}
    </Card>
  )
}

export const dpGame = defineMinigame<DpQuestion, DpAnswer>({
  id: 'dp',
  title: 'Eliminate',
  tagline: 'Delete a variable by resolving it away.',
  topics: ['resolution', 'satisfiability'],
  icon: '🧹',
  roundSeconds: 180,
  sprintQuestions: 6,
  sprintPenaltySeconds: 10,
  generate,
  check,
  solve,
  Screen,
  Guide: DpEliminateGuide,
  questionKey: (question) => `${question.variable}|${question.clauses.map(clauseKey).join(';')}`,
})
