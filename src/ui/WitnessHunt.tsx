/**
 * Toggle an assignment, watch the formulas, bank what you find.
 *
 * Definition 2.6 is stated in witnesses: satisfiable means *there is* an
 * assignment making it true, refutable means *there is* one making it false.
 * Picking the word "contingent" off a list never makes you produce either.
 *
 * So this is the shared board for the games that are really about hunting a
 * witness: flip variables, see every formula update live, and bank an
 * assignment when it does what you are looking for — or declare that no such
 * assignment exists, which is the other half of the definition.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Assignment, Formula } from '@/logic'
import { evaluate, sortedVariables } from '@/logic'
import { Button } from './primitives'
import { FormulaText, VariableName } from './FormulaText'
import { Pop, Shakeable, useShake } from './motion'

export interface Goal {
  id: string
  /** What you are looking for, e.g. "an assignment making it true". */
  label: string
  /** True when the current assignment satisfies this goal. */
  test: (assignment: Assignment) => boolean
  /** Wording for the "there is no such assignment" claim. */
  noneLabel: string
}

export interface Banked {
  /** The assignment banked, or null when "no such assignment" was claimed. */
  [id: string]: Assignment | null | undefined
}

export function WitnessHunt({
  formulas,
  goals,
  banked,
  onBank,
  locked,
  footer,
}: {
  /** Labelled formulas, all evaluated under the same assignment. */
  formulas: { label: string; formula: Formula }[]
  goals: Goal[]
  banked: Banked
  onBank: (id: string, assignment: Assignment | null) => void
  locked: boolean
  footer?: ReactNode
}) {
  const variables = useMemo(
    () => [...new Set(formulas.flatMap((entry) => sortedVariables(entry.formula)))].sort(),
    [formulas],
  )

  const [assignment, setAssignment] = useState<Assignment>(() =>
    Object.fromEntries(variables.map((name) => [name, false])),
  )
  const [shaking, shake] = useShake()

  useEffect(() => {
    setAssignment(Object.fromEntries(variables.map((name) => [name, false])))
  }, [variables])

  const toggle = (name: string) => {
    if (locked) return
    setAssignment((previous) => ({ ...previous, [name]: !previous[name] }))
  }

  const total = 2 ** variables.length
  const index = variables.reduce(
    (acc, name) => acc * 2 + (assignment[name] ? 1 : 0),
    0,
  )

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {formulas.map((entry) => {
          const value = evaluate(entry.formula, assignment)
          return (
            <div
              key={entry.label}
              className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 transition-colors
                ${value ? 'bg-space-blue/15' : 'bg-space-red/15'}`}
            >
              <span className="formula text-xs font-bold text-ink-soft">{entry.label}</span>
              <FormulaText formula={entry.formula} className="text-base font-bold" />
              <Pop key={`${entry.label}:${index}`} className="ml-auto">
                <span
                  className={`space inline-flex h-7 w-7 items-center justify-center text-sm font-bold text-white
                    ${value ? 'bg-space-blue' : 'bg-space-red'}`}
                >
                  {value ? 'T' : 'F'}
                </span>
              </Pop>
            </div>
          )
        })}
      </div>

      <Shakeable shaking={shaking}>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {variables.map((name) => (
            <button
              key={name}
              type="button"
              disabled={locked}
              onClick={() => toggle(name)}
              aria-pressed={assignment[name] ?? false}
              className={`chunky flex h-12 items-center gap-2 px-4 text-base font-bold text-white
                ${assignment[name] ? 'bg-space-blue' : 'bg-space-red'}`}
            >
              <VariableName name={name} className="text-white" />
              <span>= {assignment[name] ? 'T' : 'F'}</span>
            </button>
          ))}
        </div>
      </Shakeable>

      <p className="mt-1 text-center text-xs font-medium text-ink-soft">
        Row {index + 1} of {total}. Flip a variable to move.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {goals.map((goal) => {
          const found = banked[goal.id]
          const qualifies = goal.test(assignment)
          const settled = found !== undefined

          return (
            <div
              key={goal.id}
              className={`tile flex flex-wrap items-center gap-2 px-3 py-2
                ${settled ? (found === null ? 'bg-card-shade' : 'bg-grass text-white') : 'bg-card'}`}
            >
              <span className="min-w-0 flex-1 text-sm font-bold">{goal.label}</span>

              {settled ? (
                <span className="formula text-sm font-bold">
                  {found === null
                    ? 'none exists'
                    : Object.keys(found)
                        .sort()
                        .map((name) => `${name}=${found[name] ? 'T' : 'F'}`)
                        .join(' ')}
                </span>
              ) : locked ? null : (
                <span className="flex gap-1.5">
                  <Button
                    variant={qualifies ? 'coin' : 'secondary'}
                    className="min-h-9 px-3 text-xs"
                    onClick={() => {
                      if (!qualifies) {
                        shake()
                        return
                      }
                      onBank(goal.id, { ...assignment })
                    }}
                  >
                    Bank this row
                  </Button>
                  <Button
                    variant="secondary"
                    className="min-h-9 px-3 text-xs"
                    onClick={() => onBank(goal.id, null)}
                  >
                    {goal.noneLabel}
                  </Button>
                </span>
              )}
            </div>
          )
        })}
      </div>

      {footer}
    </>
  )
}
