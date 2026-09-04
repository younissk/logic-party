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
  repeatsAnOperand,
  showAssignment,
  sortedVariables,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FormulaText, VariableName } from '@/ui/FormulaText'
import { TruthTableGuide } from './truthTable.guide'

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
    //     ((p → q) ∨ q) ∧ q, which is just q;
    //   - a repeated operand (q ∨ p ∨ p) is padding, and the generator cannot
    //     always avoid it on its own with a two-variable pool.
    (candidate) =>
      classify(candidate) === 'contingent' &&
      dependsOnAllVariables(candidate) &&
      !repeatsAnOperand(candidate),
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

  /** Tapping a space cycles blank -> T -> F -> blank; fastest input on a phone. */
  const cycle = (index: number) => {
    const current = answer[index]
    setRow(index, current === null ? true : current ? false : null)
  }

  const remaining = answer.filter((entry) => entry === null).length

  // A hard formula is long, and a long formula at 2xl wraps into fragments
  // that are harder to read than the logic itself. Step the size down instead.
  const printed = format(question.formula)
  const formulaSize = printed.length > 32 ? 'text-lg' : printed.length > 22 ? 'text-xl' : 'text-2xl'

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Fill in the truth table
      </p>
      <p className={`mt-1 leading-snug font-semibold text-balance text-ink ${formulaSize}`}>
        <FormulaText formula={question.formula} />
      </p>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr>
            {question.variables.map((name) => (
              <th key={name} className="w-10 pb-2 text-lg font-semibold">
                <VariableName name={name} />
              </th>
            ))}
            <th className="pb-2 pl-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Your answer
            </th>
          </tr>
        </thead>
        <tbody>
          {question.rows.map((assignment, rowIndex) => {
            const given = answer[rowIndex] ?? null
            const expected = solution?.[rowIndex]
            const isWrong = locked && expected !== undefined && given !== expected

            return (
              <tr key={rowIndex} className="border-t-2 border-dashed border-card-shade">
                {question.variables.map((name) => (
                  <td key={name} className="py-2 text-center">
                    <span
                      className={`formula inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white ${
                        assignment[name] ? 'bg-space-blue/70' : 'bg-space-red/70'
                      }`}
                    >
                      {assignment[name] ? 'T' : 'F'}
                    </span>
                  </td>
                ))}

                <td className="py-1.5 pl-3">
                  <div className="flex items-center justify-end gap-2">
                    {isWrong && expected !== undefined && (
                      <span className="whitespace-nowrap text-sm font-bold text-space-red">
                        should be {expected ? 'T' : 'F'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => cycle(rowIndex)}
                      disabled={locked}
                      aria-label={`Row ${rowIndex + 1}: ${showAssignment(assignment)}`}
                      className={`space h-12 w-12 shrink-0 text-xl font-bold
                        ${
                          given === null
                            ? 'border-dashed bg-card-shade text-ink-soft'
                            : given
                              ? 'bg-space-blue text-white'
                              : 'bg-space-red text-white'
                        }
                        ${isWrong ? 'opacity-60' : ''}`}
                    >
                      {given === null ? '?' : given ? 'T' : 'F'}
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {!locked && (
        <Button variant="coin" className="mt-5 w-full" disabled={remaining > 0} onClick={() => submit(answer)}>
          {remaining === 0 ? 'Check my table' : `${remaining} space${remaining === 1 ? '' : 's'} left`}
        </Button>
      )}
    </Card>
  )
}

export const truthTableGame = defineMinigame<TruthTableQuestion, TruthTableAnswer>({
  id: 'truth-table',
  title: 'Truth Table Sprint',
  tagline: 'Work out the column, row by row.',
  topics: ['truth-tables'],
  icon: '🧮',
  roundSeconds: 120,
  sprintQuestions: 10,
  generate,
  check,
  solve,
  Screen,
  Guide: TruthTableGuide,
  // Two questions are the same question exactly when the formula is.
  questionKey: (question) => format(question.formula),
})
