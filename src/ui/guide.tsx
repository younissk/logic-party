/**
 * Building blocks for minigame guides.
 *
 * Everything here that shows a truth value *computes* it with the same
 * evaluator the games mark answers with. Nothing in a guide is a table typed
 * out by hand, so a guide cannot quietly disagree with the game it explains.
 */

import { useState, type ReactNode } from 'react'
import {
  evaluateAll,
  key as formulaKey,
  parse,
  size,
  sortedVariables,
  subformulas,
  truthTable,
} from '@/logic'
import { Card } from './primitives'
import { FormulaText, VariableName } from './FormulaText'

/** Write formulas as text in guide prose: <F>p → q</F>. */
export function F({ children }: { children: string }) {
  return <FormulaText formula={parse(children)} />
}

/**
 * A bare connective or symbol — <Sym>→</Sym>.
 *
 * Not the same as <F>, which parses: "→" on its own is not a formula, so it
 * has to be rendered rather than parsed.
 */
export function Sym({ children }: { children: string }) {
  return <span className="formula font-semibold">{children}</span>
}

export function GuideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="shout text-2xl text-white">{title}</h2>
      {children}
    </section>
  )
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 text-[0.95rem] leading-relaxed font-medium">{children}</div>
}

export function Callout({
  tone = 'tip',
  title,
  children,
}: {
  tone?: 'tip' | 'warn'
  title: string
  children: ReactNode
}) {
  return (
    <div className={`tile p-4 ${tone === 'warn' ? 'bg-coin' : 'bg-card-shade'}`}>
      <p className="text-sm font-bold uppercase tracking-wider">
        {tone === 'warn' ? '⚠ ' : '★ '}
        {title}
      </p>
      <div className="mt-2 text-[0.95rem] leading-relaxed font-medium">{children}</div>
    </div>
  )
}

/** A value as a board space, matching how the games render them. */
function Value({ value }: { value: boolean }) {
  return (
    <span
      className={`space inline-flex h-7 w-7 items-center justify-center text-sm font-bold text-white ${
        value ? 'bg-space-blue' : 'bg-space-red'
      }`}
    >
      {value ? 'T' : 'F'}
    </span>
  )
}

/**
 * A complete truth table, computed live.
 *
 * `columns` adds intermediate subformulas as their own columns — the way the
 * table is actually built by hand, one piece at a time.
 */
export function MiniTruthTable({
  source,
  columns = [],
}: {
  source: string
  columns?: string[]
}) {
  const formula = parse(source)
  const extra = columns.map(parse)
  const table = truthTable(formula)

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-center">
        <thead>
          <tr>
            {table.variables.map((name) => (
              <th key={name} className="px-2 pb-2 text-base">
                <VariableName name={name} />
              </th>
            ))}
            {extra.map((column, index) => (
              <th key={index} className="border-l-2 border-dashed border-card-shade px-3 pb-2 text-sm">
                <FormulaText formula={column} />
              </th>
            ))}
            <th className="border-l-3 border-ink px-3 pb-2 text-sm">
              <FormulaText formula={formula} />
            </th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => {
            const values = evaluateAll(formula, row.assignment)
            return (
              <tr key={index} className="border-t-2 border-dashed border-card-shade">
                {table.variables.map((name) => (
                  <td key={name} className="px-2 py-1.5">
                    <Value value={row.assignment[name] as boolean} />
                  </td>
                ))}
                {extra.map((column, columnIndex) => (
                  <td
                    key={columnIndex}
                    className="border-l-2 border-dashed border-card-shade px-3 py-1.5"
                  >
                    <Value value={evaluateAll(column, row.assignment).get(formulaKey(column)) as boolean} />
                  </td>
                ))}
                <td className="border-l-3 border-ink px-3 py-1.5">
                  <Value value={values.get(formulaKey(formula)) as boolean} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Toggle the variables and watch the formula come apart.
 *
 * Shows every subformula smallest-first with its current value, which is the
 * order you evaluate one by hand — the point being that a big formula is never
 * evaluated as a whole, only as a stack of small ones.
 */
export function AssignmentPlayground({ source }: { source: string }) {
  const formula = parse(source)
  const variables = sortedVariables(formula)
  const [assignment, setAssignment] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(variables.map((name) => [name, false])),
  )

  const values = evaluateAll(formula, assignment)
  const pieces = subformulas(formula)
    .filter((piece) => piece.kind !== 'var' && piece.kind !== 'const')
    .sort((a, b) => size(a) - size(b))

  const toggle = (name: string) =>
    setAssignment((previous) => ({ ...previous, [name]: !previous[name] }))

  return (
    <Card>
      <p className="text-sm font-bold uppercase tracking-wider text-ink-soft">Try it yourself</p>
      <p className="mt-1 text-lg">
        <FormulaText formula={formula} />
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {variables.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => toggle(name)}
            aria-pressed={assignment[name] ?? false}
            className={`chunky flex h-11 items-center gap-2 px-4 text-base font-bold ${
              assignment[name] ? 'bg-space-blue text-white' : 'bg-space-red text-white'
            }`}
          >
            <VariableName name={name} className="text-white" />
            <span>= {assignment[name] ? 'T' : 'F'}</span>
          </button>
        ))}
      </div>

      <ul className="mt-4 flex flex-col gap-1.5">
        {pieces.map((piece) => {
          const isRoot = formulaKey(piece) === formulaKey(formula)
          return (
            <li
              key={formulaKey(piece)}
              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-1.5 ${
                isRoot ? 'bg-coin font-bold' : 'bg-card-shade'
              }`}
            >
              <FormulaText formula={piece} />
              <Value value={values.get(formulaKey(piece)) as boolean} />
            </li>
          )
        })}
      </ul>

      <p className="mt-3 text-sm font-medium text-ink-soft">
        Smallest first — that is the order you work a table out by hand. The last line is the answer
        for this row.
      </p>
    </Card>
  )
}
