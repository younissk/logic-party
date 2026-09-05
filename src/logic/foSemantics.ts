/**
 * Evaluating a first-order formula in a finite structure — ln.pdf §4.1,
 * Definition 4.3, Exercise 7 question 2.
 *
 * A structure fixes a nonempty universe, a function U^n → U for every function
 * symbol, and a predicate U^n → {true, false} for every predicate symbol. Then
 * a closed formula is simply true or false, and a quantifier is a loop over the
 * universe.
 *
 * The universe is kept finite and small on purpose. Everything the exercises
 * ask is decided over four elements, and a finite universe is the only case
 * where "check all of them" is a procedure rather than a wish.
 */

import { isVar, type Term } from './terms'
import type { FoFormula } from './fol'
import { freeVariables } from './fol'

/** Elements are indices 0…size−1, which keeps tables plain arrays. */
export interface Structure {
  size: number
  /** Element names for display; defaults to the numbers. */
  labels?: string[]
  /** Function symbol → its table, flat, indexed base `size`. */
  functions: Readonly<Record<string, number[]>>
  /** Predicate symbol → its table, flat, indexed base `size`. */
  predicates: Readonly<Record<string, boolean[]>>
}

export type Env = Readonly<Record<string, number>>

export class UndefinedSymbolError extends Error {}

export const elementLabel = (structure: Structure, element: number): string =>
  structure.labels?.[element] ?? String(element)

/** Flat index of an argument tuple, most significant first. */
export const tableIndex = (size: number, args: readonly number[]): number =>
  args.reduce((total, value) => total * size + value, 0)

export function evaluateTermIn(structure: Structure, env: Env, term: Term): number {
  if (isVar(term)) {
    const value = env[term.name]
    if (value === undefined) {
      throw new UndefinedSymbolError(`No value for the variable ${term.name}`)
    }
    return value
  }
  const table = structure.functions[term.name]
  if (table === undefined) {
    throw new UndefinedSymbolError(`No interpretation for the function symbol ${term.name}`)
  }
  const args = term.args.map((arg) => evaluateTermIn(structure, env, arg))
  const value = table[tableIndex(structure.size, args)]
  if (value === undefined) {
    throw new UndefinedSymbolError(`${term.name} has an incomplete table`)
  }
  return value
}

/**
 * The truth of a formula under a structure and an assignment.
 *
 * The two quantifier cases are where first-order logic differs from
 * propositional: each one loops over the whole universe with the bound variable
 * reassigned, which is Definition 4.3 parts 4 and 5 literally.
 */
export function evaluateFormula(structure: Structure, env: Env, formula: FoFormula): boolean {
  switch (formula.kind) {
    case 'true':
      return true
    case 'false':
      return false
    case 'atom': {
      const table = structure.predicates[formula.predicate]
      if (table === undefined) {
        throw new UndefinedSymbolError(`No interpretation for the predicate ${formula.predicate}`)
      }
      const args = formula.args.map((arg) => evaluateTermIn(structure, env, arg))
      const value = table[tableIndex(structure.size, args)]
      if (value === undefined) {
        throw new UndefinedSymbolError(`${formula.predicate} has an incomplete table`)
      }
      return value
    }
    case 'not':
      return !evaluateFormula(structure, env, formula.body)
    case 'binary': {
      const left = evaluateFormula(structure, env, formula.left)
      const right = evaluateFormula(structure, env, formula.right)
      switch (formula.connective) {
        case 'and':
          return left && right
        case 'or':
          return left || right
        case 'implies':
          return !left || right
        case 'iff':
          return left === right
      }
      return false
    }
    case 'quantified': {
      for (let element = 0; element < structure.size; element++) {
        const holds = evaluateFormula(
          structure,
          { ...env, [formula.variable]: element },
          formula.body,
        )
        if (formula.quantifier === 'forall' && !holds) return false
        if (formula.quantifier === 'exists' && holds) return true
      }
      return formula.quantifier === 'forall'
    }
  }
}

/** A closed formula's truth does foNot depend on the assignment — p.66. */
export function holdsIn(structure: Structure, formula: FoFormula): boolean {
  const free = freeVariables(formula)
  if (free.length === 0) return evaluateFormula(structure, {}, formula)
  // A formula with free variables is judged as its universal closure, which is
  // the convention clauses already use.
  const walk = (names: string[], env: Env): boolean => {
    const [first, ...rest] = names
    if (first === undefined) return evaluateFormula(structure, env, formula)
    for (let element = 0; element < structure.size; element++) {
      if (!walk(rest, { ...env, [first]: element })) return false
    }
    return true
  }
  return walk(free, {})
}

/**
 * Build a structure from readable descriptions.
 *
 * `functions` and `predicates` take a function of the argument tuple, so a
 * question can say "I(g)(x) = (x+2) mod 4" rather than listing four entries —
 * which is how the exercises state them, and how a reader checks them.
 */
export function makeStructure(spec: {
  size: number
  labels?: string[]
  functions?: Record<string, { arity: number; value: (args: number[]) => number }>
  predicates?: Record<string, { arity: number; value: (args: number[]) => boolean }>
}): Structure {
  const functions: Record<string, number[]> = {}
  for (const [name, entry] of Object.entries(spec.functions ?? {})) {
    functions[name] = fill(spec.size, entry.arity, entry.value)
  }
  const predicates: Record<string, boolean[]> = {}
  for (const [name, entry] of Object.entries(spec.predicates ?? {})) {
    predicates[name] = fill(spec.size, entry.arity, entry.value)
  }
  const structure: Structure = { size: spec.size, functions, predicates }
  return spec.labels === undefined ? structure : { ...structure, labels: spec.labels }
}

function fill<T>(size: number, arity: number, value: (args: number[]) => T): T[] {
  const total = size ** arity
  const table: T[] = []
  for (let index = 0; index < total; index++) {
    const args: number[] = []
    let rest = index
    for (let position = 0; position < arity; position++) {
      args.unshift(rest % size)
      rest = Math.floor(rest / size)
    }
    table.push(value(args))
  }
  return table
}
