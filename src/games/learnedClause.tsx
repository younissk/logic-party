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
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'
import { Pop } from '@/ui/motion'
import { LearnedClauseGuide } from './learnedClause.guide'

export interface LearnedQuestion {
  clauses: Clause[]
  /** The conflict being analysed. */
  decisions: Literal[]
  propagated: Literal[]
}

/** The clause built, literal by literal. */
export type LearnedAnswer = Clause

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
    return { clauses, decisions: step.decisions, propagated: step.propagated }
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
  }
}

const solve = (question: LearnedQuestion): LearnedAnswer => learnFromDecisions(question.decisions).clause

function check(question: LearnedQuestion, answer: LearnedAnswer): Verdict {
  const truth = learnFromDecisions(question.decisions).clause
  const decisions = question.decisions
    .map((literal) => `${literal.name} = ${literal.negated ? 'F' : 'T'}`)
    .join(' and ')

  if (clauseKey(normaliseClause(answer)) === clauseKey(truth)) {
    return {
      correct: true,
      message: showClause(truth),
      detail: `Deciding ${decisions} led to a conflict, so that combination is forbidden — and forbidding it is exactly ${showClause(truth)}. Learned clauses are always derivable by resolution, which is why adding one is sound.`,
    }
  }

  // Name the specific misunderstanding rather than the answer: sprint shows
  // this before the retry.
  const propagated = new Set(question.propagated.map((literal) => literal.name))
  const included = answer.some((literal) => propagated.has(literal.name))
  const unnegated = answer.some((literal) =>
    question.decisions.some(
      (decision) => decision.name === literal.name && decision.negated === literal.negated,
    ),
  )

  return {
    correct: false,
    message: included
      ? 'That includes something BCP derived'
      : unnegated
        ? 'That is the combination you tried, not the one to forbid'
        : 'Not the clause that gets learned',
    detail: included
      ? `Anything propagation derived already follows from the decisions, so putting it in only makes the clause longer — and a longer clause fires later. Decisions only.`
      : `Negate the decisions and only the decisions: ${decisions} was impossible, so at least one of them has to go the other way.`,
  }
}

function Screen({ question, submit, locked, solution }: MinigameScreenProps<LearnedQuestion, LearnedAnswer>) {
  const [built, setBuilt] = useState<Clause>([])

  useEffect(() => {
    setBuilt([])
  }, [question])

  const negate = (literal: Literal): Literal => ({ name: literal.name, negated: !literal.negated })
  const key = (literal: Literal) => `${literal.negated ? '¬' : ''}${literal.name}`

  const toggle = (literal: Literal) => {
    if (locked) return
    // Tapping an assignment adds its *negation*: the clause forbids what was
    // tried, and doing that conversion by hand is where the marks go.
    const flipped = negate(literal)
    setBuilt((previous) =>
      previous.some((entry) => key(entry) === key(flipped))
        ? previous.filter((entry) => key(entry) !== key(flipped))
        : normaliseClause([...previous, flipped]),
    )
  }

  const inClause = (literal: Literal) => built.some((entry) => key(entry) === key(negate(literal)))
  const shown = locked ? (solution ?? built) : built

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Build the learned clause
      </p>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-card-shade px-3 py-2">
        {question.clauses.map((clause, index) => (
          <ClauseText key={index} clause={clause} className="text-sm font-bold" />
        ))}
      </div>

      <p className="mt-3 text-xs font-medium text-ink-soft">
        Tap an assignment to forbid it. What goes into the clause is its negation — and only the
        decisions belong there.
      </p>

      <div className="mt-2 flex flex-col gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Decisions</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {question.decisions.map((literal) => (
              <button
                key={literal.name}
                type="button"
                disabled={locked}
                onClick={() => toggle(literal)}
                className={`space formula flex h-11 items-center px-3 text-sm font-bold
                  ${inClause(literal) ? 'bg-space-blue text-white' : 'bg-coin text-ink'}`}
              >
                {literal.name} = {literal.negated ? 'F' : 'T'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            BCP then forced — not decisions
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {question.propagated.map((literal) => (
              <button
                key={literal.name}
                type="button"
                disabled={locked}
                onClick={() => toggle(literal)}
                className={`formula flex h-11 items-center rounded-md border-2 border-ink px-3 text-sm font-bold
                  ${inClause(literal) ? 'bg-space-red text-white' : 'bg-white text-ink'}`}
              >
                {literal.name} = {literal.negated ? 'F' : 'T'}
              </button>
            ))}
            <span className="text-xs font-bold text-space-red">→ conflict</span>
          </div>
        </div>
      </div>

      <div className="tile mt-3 flex min-h-14 flex-wrap items-center gap-1.5 bg-card-shade p-3">
        <span className="formula text-lg font-bold">(</span>
        {shown.length === 0 && (
          <span className="text-sm font-semibold text-ink-soft">nothing forbidden yet</span>
        )}
        {shown.map((literal, index) => (
          <span key={key(literal)} className="flex items-center gap-1.5">
            {index > 0 && <span className="formula font-bold">∨</span>}
            <Pop>
              <span className="chunky formula flex h-9 items-center bg-space-blue px-2.5 text-sm font-bold text-white">
                {key(literal)}
              </span>
            </Pop>
          </span>
        ))}
        <span className="formula text-lg font-bold">)</span>
      </div>

      {!locked && (
        <Button
          variant="coin"
          className="mt-3 w-full"
          disabled={built.length === 0}
          onClick={() => submit(built)}
        >
          {built.length === 0 ? 'Forbid something' : `Learn ${showClause(built)}`}
        </Button>
      )}
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
  generate,
  check,
  solve,
  Screen,
  Guide: LearnedClauseGuide,
  questionKey: (question) =>
    `${question.clauses.map(clauseKey).join(';')}|${question.decisions
      .map((l) => `${l.negated ? '¬' : ''}${l.name}`)
      .join(',')}`,
})
