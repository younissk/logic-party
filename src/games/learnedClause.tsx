/**
 * CDCL and clause learning — ln.pdf §2.4, Example 2.45.
 *
 * DPLL's upgrade: on a conflict, do not just undo the last decision — work out
 * *why* it failed and record a clause forbidding that whole region, then jump
 * back further.
 *
 * The scheme the notes teach: the decisions in force were jointly impossible,
 * so their negation is forced. Decide a = F and b = F, hit a conflict, learn
 * (a ∨ b). Only decisions go in — anything BCP derived is already a
 * consequence of them, and putting it in gives a weaker clause that fires
 * later.
 */

import { useEffect, useState } from 'react'
import type { Clause, Literal } from '@/logic'
import {
  cdcl,
  clauseKey,
  clauseSetToFormula,
  isSatisfiable,
  isTautologicalClause,
  learnFromDecisions,
  normaliseClause,
  showClause,
  type CdclStep,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseList } from '@/ui/ClauseSet'
import { ClauseText } from '@/ui/ClauseText'
import { LearnedClauseGuide } from './learnedClause.guide'

export interface LearnedQuestion {
  clauses: Clause[]
  /** The conflict being analysed. */
  decisions: Literal[]
  propagated: Literal[]
  options: Clause[]
  answer: number
}

export type LearnedAnswer = number

interface Profile {
  variables: string[]
  clauses: [min: number, max: number]
  width: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['a', 'b'], clauses: [3, 4], width: [1, 2] },
  medium: { variables: ['a', 'b', 'c'], clauses: [4, 6], width: [2, 3] },
  hard: { variables: ['a', 'b', 'c', 'd'], clauses: [5, 7], width: [2, 3] },
}

const ATTEMPTS = 400

/** Wrong answers that are each a specific misunderstanding. */
function distractors(step: CdclStep): Clause[] {
  const negate = (literal: Literal): Literal => ({ name: literal.name, negated: !literal.negated })
  return [
    // The decisions un-negated — forgetting that you record the *forbidden*
    // combination, not the combination itself.
    normaliseClause(step.decisions),
    // The propagated literals thrown in as well, giving a weaker clause.
    normaliseClause([...step.decisions, ...step.propagated].map(negate)),
    // Only the last decision, as if plain DPLL backtracking.
    normaliseClause(step.decisions.slice(-1).map(negate)),
    // Everything assigned, un-negated.
    normaliseClause([...step.decisions, ...step.propagated]),
  ]
}

function generate({ rng, difficulty }: GenerateContext): LearnedQuestion {
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
    if (isSatisfiable(clauseSetToFormula(clauses))) continue

    const run = cdcl(clauses)
    // A conflict reached with at least one decision *and* at least one
    // propagation, so the difference between the two actually matters.
    const usable = run.steps.filter(
      (step) => step.decisions.length > 0 && step.propagated.length > 0,
    )
    if (usable.length === 0) continue

    const step = rng.pick(usable)
    const truth = step.learned

    const wrong: Clause[] = []
    for (const option of distractors(step)) {
      if (clauseKey(option) === clauseKey(truth)) continue
      if (option.length === 0) continue
      if (wrong.some((existing) => clauseKey(existing) === clauseKey(option))) continue
      wrong.push(option)
    }
    if (wrong.length < 2) continue

    const options = rng.shuffle([truth, ...wrong.slice(0, 3)])
    return {
      clauses,
      decisions: step.decisions,
      propagated: step.propagated,
      options,
      answer: options.findIndex((option) => clauseKey(option) === clauseKey(truth)),
    }
  }

  // Last resort, so a round can never stall: the notes' own first conflict.
  const decisions: Literal[] = [
    { name: 'a', negated: true },
    { name: 'b', negated: true },
  ]
  const named: [string, boolean][][] = [
    [['a', false], ['b', false], ['c', false]],
    [['a', false], ['b', true], ['c', false]],
    [['a', false], ['b', false], ['c', true]],
    [['a', false], ['b', true], ['c', true]],
    [['a', true], ['c', false]],
    [['a', true], ['c', true]],
  ]
  return {
    clauses: named.map((clause) => clause.map(([name, negated]) => ({ name, negated }))),
    decisions,
    propagated: [{ name: 'c', negated: true }],
    options: [learnFromDecisions(decisions).clause],
    answer: 0,
  }
}

const solve = (question: LearnedQuestion): LearnedAnswer => question.answer

function check(question: LearnedQuestion, answer: LearnedAnswer): Verdict {
  const truth = question.options[question.answer] as Clause
  const decisions = question.decisions
    .map((literal) => `${literal.name} = ${literal.negated ? 'F' : 'T'}`)
    .join(' and ')

  if (answer === question.answer) {
    return {
      correct: true,
      message: showClause(truth),
      detail: `Deciding ${decisions} led to a conflict, so that combination is forbidden — and forbidding it is exactly ${showClause(truth)}. Learned clauses are always derivable by resolution, which is why adding one is sound.`,
    }
  }

  return {
    correct: false,
    message: 'Not the clause that gets learned',
    detail: `${showClause(truth)}. Negate the decisions and only the decisions: ${decisions} was impossible, so at least one of them has to go the other way. Anything BCP derived follows from the decisions already, so including it only makes the clause weaker.`,
  }
}

function Screen({ question, submit, locked, solution }: MinigameScreenProps<LearnedQuestion, LearnedAnswer>) {
  const [, setPicked] = useState<number | null>(null)

  useEffect(() => {
    setPicked(null)
  }, [question])

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        What gets learned?
      </p>

      <ClauseList set={question.clauses} className="mt-2" />

      <div className="mt-3 flex flex-col gap-1.5 rounded-2xl bg-card-shade p-3 text-sm">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">Decisions</span>
          {question.decisions.map((literal) => (
            <span
              key={literal.name}
              className="space inline-flex h-6 items-center bg-coin px-2 text-xs font-bold"
            >
              {literal.name} = {literal.negated ? 'F' : 'T'}
            </span>
          ))}
        </p>
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">BCP then forced</span>
          {question.propagated.map((literal) => (
            <span
              key={literal.name}
              className="formula rounded-md border-2 border-ink bg-white px-1.5 text-xs font-bold"
            >
              {literal.name} = {literal.negated ? 'F' : 'T'}
            </span>
          ))}
          <span className="text-xs font-bold text-space-red">→ conflict</span>
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {question.options.map((clause, index) => {
          const isAnswer = locked && solution === index
          return (
            <Button
              key={index}
              variant={isAnswer ? 'primary' : 'secondary'}
              disabled={locked}
              onClick={() => {
                setPicked(index)
                submit(index)
              }}
              className={`w-full justify-start py-2.5 text-left
                ${isAnswer ? 'revealed' : ''} ${locked && !isAnswer ? 'opacity-50' : ''}`}
            >
              <ClauseText clause={clause} className="text-base font-bold" />
            </Button>
          )
        })}
      </div>

      <p className="mt-3 text-xs font-medium text-ink-soft">
        Circles are decisions, boxes are propagations. Only the decisions go into the learned clause.
      </p>
    </Card>
  )
}

export const learnedClauseGame = defineMinigame<LearnedQuestion, LearnedAnswer>({
  id: 'learned-clause',
  title: 'Learn From It',
  tagline: 'Turn a conflict into a clause that forbids it.',
  topics: ['proof-systems', 'satisfiability'],
  icon: '🧠',
  roundSeconds: 150,
  sprintQuestions: 6,
  sprintPenaltySeconds: 10,
  generate,
  check,
  solve,
  Screen,
  Guide: LearnedClauseGuide,
  questionKey: (question) =>
    `${question.clauses.map(clauseKey).join(';')}|${question.decisions.map((l) => `${l.negated ? '¬' : ''}${l.name}`).join(',')}`,
})
