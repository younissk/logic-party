/** Truth table construction. */

import type { Formula } from './ast'
import { sortedVariables } from './ast'
import type { Assignment } from './evaluate'
import { evaluate } from './evaluate'

/** 2^16 rows is already unusable in a UI; refuse rather than hang the tab. */
export const MAX_TRUTH_TABLE_VARIABLES = 16

export type RowOrder = 'falseFirst' | 'trueFirst'

export interface TruthTableRow {
  readonly assignment: Assignment
  readonly value: boolean
}

export interface TruthTable {
  readonly variables: string[]
  readonly rows: TruthTableRow[]
}

export interface TruthTableOptions {
  /**
   * 'falseFirst' counts up in binary (F F, F T, T F, T T) — the CS convention.
   * 'trueFirst' counts down, which is how many logic textbooks print it.
   */
  order?: RowOrder
  /** Override the column order; defaults to alphabetical. */
  variables?: readonly string[]
}

/** All 2^n assignments over `variables`, in the requested row order. */
export function allAssignments(
  variables: readonly string[],
  options: { order?: RowOrder } = {},
): Assignment[] {
  if (variables.length > MAX_TRUTH_TABLE_VARIABLES) {
    throw new RangeError(
      `${variables.length} variables would need ${2 ** variables.length} rows (limit is ${MAX_TRUTH_TABLE_VARIABLES} variables)`,
    )
  }

  const trueFirst = (options.order ?? 'falseFirst') === 'trueFirst'
  const total = 2 ** variables.length
  const rows: Assignment[] = []

  for (let i = 0; i < total; i++) {
    const assignment: Record<string, boolean> = {}
    variables.forEach((name, index) => {
      // Leftmost variable is the most significant bit, so it flips slowest.
      const bit = (i >> (variables.length - 1 - index)) & 1
      assignment[name] = trueFirst ? bit === 0 : bit === 1
    })
    rows.push(assignment)
  }

  return rows
}

export function truthTable(formula: Formula, options: TruthTableOptions = {}): TruthTable {
  const variables = [...(options.variables ?? sortedVariables(formula))]
  const rows = allAssignments(variables, { order: options.order }).map((assignment) => ({
    assignment,
    value: evaluate(formula, assignment),
  }))
  return { variables, rows }
}

/** Compact bit-string of the result column — a cheap equivalence fingerprint. */
export function truthVector(formula: Formula, variables?: readonly string[]): string {
  const table = truthTable(formula, variables ? { variables } : {})
  return table.rows.map((row) => (row.value ? '1' : '0')).join('')
}
