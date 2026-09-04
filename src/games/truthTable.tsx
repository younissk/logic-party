/**
 * Truth table fill — the reference minigame.
 *
 * If you are adding a new exercise, copy this file: it is the smallest
 * complete example of the contract (generate / check / solve / Screen) and
 * nothing else in the codebase had to change to add it beyond one line in
 * the registry.
 */

import { useEffect, useState } from 'react'
import type { Assignment, Formula } from '@/logic'
import {
  allAssignments,
  classify,
  dependsOnAllVariables,
  evaluate,
  format,
  randomFormulaWhere,
  showAssignment,
  sortedVariables,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card, FormulaText } from '@/ui/primitives'

export interface TruthTableQuestion {
  formula: Formula
  variables: string[]
  rows: Assignment[]
}

/** One entry per row; null means "not filled in yet". */
export type TruthTableAnswer = (boolean | null)[]

/**
 * Truth tables double in length with every variable, so the variable count is
 * the real difficulty dial — the formula's shape is secondary.
 */
const PROFILES: Record<Difficulty, { variables: string[]; depth: number }> = {
  easy: { variables: ['p', 'q'], depth: 3 },
  medium: { variables: ['p', 'q'], depth: 5 },
  hard: { variables: ['p', 'q', 'r'], depth: 5 },
}

function generate({ rng, difficulty }: GenerateContext): TruthTableQuestion {
  const profile = PROFILES[difficulty]

  const formula = randomFormulaWhere(
    rng,
    {
      variables: profile.variables,
      depth: profile.depth,
      connectives: difficulty === 'easy' ? ['not', 'and', 'or'] : ['not', 'and', 'or', 'implies', 'iff'],
      minDistinctVariables: profile.variables.length,
    },
    // Two ways a generated table can be a bad exercise, both rejected here:
    //   - a tautology or contradiction is one repeated value, guessable
    //     without reading the formula at all;
    //   - a formula with a fictitious variable looks hard and is not, e.g.
    //     ((p → q) ∨ q) ∧ q, which is just q.
    (candidate) => classify(candidate) === 'contingent' && dependsOnAllVariables(candidate),
  )

  const variables = sortedVariables(formula)
  return { formula, variables, rows: allAssignments(variables) }
}

const solve = (question: TruthTableQuestion): TruthTableAnswer =>
  question.rows.map((assignment) => evaluate(question.formula, assignment))

function check(question: TruthTableQuestion, answer: TruthTableAnswer): Verdict {
  const expected = solve(question)
  const wrongRows = expected
    .map((value, index) => ({ value, index }))
    .filter(({ value, index }) => answer[index] !== value)

  if (wrongRows.length === 0) {
    return { correct: true, message: 'Every row correct', score: 1 }
  }

  const first = wrongRows[0] as { value: boolean; index: number }
  const assignment = question.rows[first.index] as Assignment
  const given = answer[first.index]

  return {
    correct: false,
    // Partial credit: getting 7 of 8 rows is genuinely different from guessing.
    score: (expected.length - wrongRows.length) / expected.length,
    message:
      wrongRows.length === 1 ? 'One row is wrong' : `${wrongRows.length} rows are wrong`,
    detail: `With ${showAssignment(assignment)}, ${format(question.formula)} is ${
      first.value ? 'true' : 'false'
    }${given === null || given === undefined ? ' — you left it blank.' : ', not ' + (given ? 'true' : 'false') + '.'}`,
  }
}

function Screen({ question, submit, locked, solution }: MinigameScreenProps<TruthTableQuestion, TruthTableAnswer>) {
  const [answer, setAnswer] = useState<TruthTableAnswer>(() => question.rows.map(() => null))

  // A new question means a fresh, empty column.
  useEffect(() => {
    setAnswer(question.rows.map(() => null))
  }, [question])

  const setRow = (index: number, value: boolean | null) => {
    if (locked) return
    setAnswer((previous) => previous.map((entry, i) => (i === index ? value : entry)))
  }

  /** Tapping a cell cycles blank -> T -> F -> blank; fastest input on a phone. */
  const cycle = (index: number) => {
    const current = answer[index]
    setRow(index, current === null ? true : current ? false : null)
  }

  const complete = answer.every((entry) => entry !== null)

  return (
    <Card>
      <p className="text-sm text-slate-400">Fill in the truth table for</p>
      <p className="mt-1 text-2xl">
        <FormulaText formula={question.formula} />
      </p>

      <table className="mt-4 w-full border-collapse text-center">
        <thead>
          <tr className="text-slate-400">
            {question.variables.map((name) => (
              <th key={name} className="formula pb-2 text-base font-normal">
                {name}
              </th>
            ))}
            <th className="formula border-l border-slate-700 pb-2 pl-3 text-base font-normal text-slate-200">
              {format(question.formula)}
            </th>
          </tr>
        </thead>
        <tbody>
          {question.rows.map((assignment, rowIndex) => {
            const given = answer[rowIndex] ?? null
            const expected = solution?.[rowIndex]
            const isWrong = locked && expected !== undefined && given !== expected

            return (
              <tr key={rowIndex} className="border-t border-slate-800">
                {question.variables.map((name) => (
                  <td key={name} className="formula py-2 text-slate-400">
                    {assignment[name] ? 'T' : 'F'}
                  </td>
                ))}
                <td className="border-l border-slate-700 py-1.5 pl-3">
                  <button
                    type="button"
                    onClick={() => cycle(rowIndex)}
                    disabled={locked}
                    aria-label={`Row ${rowIndex + 1}: ${showAssignment(assignment)}`}
                    className={`h-10 w-14 rounded-lg border text-base font-bold transition-colors
                      ${
                        isWrong
                          ? 'border-rose-500 bg-rose-500/10 text-rose-300'
                          : given === null
                            ? 'border-dashed border-slate-600 text-slate-600'
                            : given
                              ? 'border-emerald-600 bg-emerald-500/10 text-emerald-300'
                              : 'border-slate-500 bg-slate-700/40 text-slate-200'
                      }`}
                  >
                    {given === null ? '·' : given ? 'T' : 'F'}
                    {isWrong && expected !== undefined && (
                      <span className="ml-1 text-xs font-normal text-rose-400">
                        ({expected ? 'T' : 'F'})
                      </span>
                    )}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {!locked && (
        <Button className="mt-4 w-full" disabled={!complete} onClick={() => submit(answer)}>
          {complete ? 'Check my table' : `${answer.filter((e) => e === null).length} rows left`}
        </Button>
      )}
    </Card>
  )
}

export const truthTableGame = defineMinigame<TruthTableQuestion, TruthTableAnswer>({
  id: 'truth-table',
  title: 'Truth Table Sprint',
  tagline: 'Fill in the column before the clock runs out.',
  topics: ['truth-tables'],
  icon: '🧮',
  secondsPerQuestion: 120,
  questionsPerRound: 5,
  generate,
  check,
  solve,
  Screen,
})
