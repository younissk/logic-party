/** Evaluating a formula under an assignment. */

import type { Formula } from './ast'
import { key } from './ast'

export type Assignment = Readonly<Record<string, boolean>>

export class UnassignedVariableError extends Error {
  constructor(readonly variable: string) {
    super(`Variable "${variable}" has no truth value in this assignment`)
    this.name = 'UnassignedVariableError'
  }
}

export function evaluate(formula: Formula, assignment: Assignment): boolean {
  switch (formula.kind) {
    case 'var': {
      const value = assignment[formula.name]
      if (value === undefined) throw new UnassignedVariableError(formula.name)
      return value
    }
    case 'const':
      return formula.value
    case 'not':
      return !evaluate(formula.arg, assignment)
    case 'and':
      return evaluate(formula.left, assignment) && evaluate(formula.right, assignment)
    case 'or':
      return evaluate(formula.left, assignment) || evaluate(formula.right, assignment)
    case 'implies':
      return !evaluate(formula.left, assignment) || evaluate(formula.right, assignment)
    case 'iff':
      return evaluate(formula.left, assignment) === evaluate(formula.right, assignment)
  }
}

/**
 * Value of every subformula, keyed by `ast.key`.
 *
 * Powers the "fill the table column by column" and "where did the student go
 * wrong" minigames: with this we can point at the exact subformula that broke.
 */
export function evaluateAll(formula: Formula, assignment: Assignment): Map<string, boolean> {
  const results = new Map<string, boolean>()

  const walk = (f: Formula): boolean => {
    const cached = results.get(key(f))
    if (cached !== undefined) return cached

    let value: boolean
    switch (f.kind) {
      case 'var': {
        const assigned = assignment[f.name]
        if (assigned === undefined) throw new UnassignedVariableError(f.name)
        value = assigned
        break
      }
      case 'const':
        value = f.value
        break
      case 'not':
        value = !walk(f.arg)
        break
      case 'and':
        value = walk(f.left) && walk(f.right)
        break
      case 'or':
        value = walk(f.left) || walk(f.right)
        break
      case 'implies':
        value = !walk(f.left) || walk(f.right)
        break
      case 'iff':
        value = walk(f.left) === walk(f.right)
        break
    }
    results.set(key(f), value)
    return value
  }

  walk(formula)
  return results
}
