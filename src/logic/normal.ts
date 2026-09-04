/**
 * Normal forms: NNF, CNF, DNF, plus the clause view that resolution and
 * DPLL minigames need.
 *
 * The transformations here are the naive textbook ones — the same steps a
 * student performs by hand in an exam — not Tseitin. That is deliberate: the
 * app must be able to show the *expected* answer, and the expected answer is
 * the one the marking scheme wants.
 */

import type { Formula } from './ast'
import { and, andAll, equals, FALSE, not, or, orAll, size, TRUE, v } from './ast'

/** Distribution is exponential in the worst case; refuse before the tab dies. */
export const MAX_NORMAL_FORM_SIZE = 20_000

class NormalFormTooLargeError extends Error {
  constructor(nodes: number) {
    super(`Normal form exceeded ${MAX_NORMAL_FORM_SIZE} nodes (reached ${nodes}) — pick a smaller formula`)
    this.name = 'NormalFormTooLargeError'
  }
}

const guard = (formula: Formula): Formula => {
  const nodes = size(formula)
  if (nodes > MAX_NORMAL_FORM_SIZE) throw new NormalFormTooLargeError(nodes)
  return formula
}

/** Constant folding and the identity/annihilator laws. Never grows the formula. */
export function simplify(formula: Formula): Formula {
  switch (formula.kind) {
    case 'var':
    case 'const':
      return formula

    case 'not': {
      const arg = simplify(formula.arg)
      if (arg.kind === 'const') return arg.value ? FALSE : TRUE
      if (arg.kind === 'not') return arg.arg
      return not(arg)
    }

    case 'and': {
      const left = simplify(formula.left)
      const right = simplify(formula.right)
      if (left.kind === 'const') return left.value ? right : FALSE
      if (right.kind === 'const') return right.value ? left : FALSE
      if (equals(left, right)) return left
      return and(left, right)
    }

    case 'or': {
      const left = simplify(formula.left)
      const right = simplify(formula.right)
      if (left.kind === 'const') return left.value ? TRUE : right
      if (right.kind === 'const') return right.value ? TRUE : left
      if (equals(left, right)) return left
      return or(left, right)
    }

    case 'implies': {
      const left = simplify(formula.left)
      const right = simplify(formula.right)
      if (left.kind === 'const') return left.value ? right : TRUE
      if (right.kind === 'const') return right.value ? TRUE : simplify(not(left))
      if (equals(left, right)) return TRUE
      return { kind: 'implies', left, right }
    }

    case 'iff': {
      const left = simplify(formula.left)
      const right = simplify(formula.right)
      if (left.kind === 'const') return left.value ? right : simplify(not(right))
      if (right.kind === 'const') return right.value ? left : simplify(not(left))
      if (equals(left, right)) return TRUE
      return { kind: 'iff', left, right }
    }
  }
}

/** Rewrite ↔ as a conjunction of implications. */
export function eliminateBiconditionals(formula: Formula): Formula {
  switch (formula.kind) {
    case 'var':
    case 'const':
      return formula
    case 'not':
      return not(eliminateBiconditionals(formula.arg))
    case 'iff': {
      const left = eliminateBiconditionals(formula.left)
      const right = eliminateBiconditionals(formula.right)
      return and({ kind: 'implies', left, right }, { kind: 'implies', left: right, right: left })
    }
    default:
      return {
        kind: formula.kind,
        left: eliminateBiconditionals(formula.left),
        right: eliminateBiconditionals(formula.right),
      }
  }
}

/** Rewrite a → b as ¬a ∨ b. Assumes ↔ is already gone. */
export function eliminateImplications(formula: Formula): Formula {
  switch (formula.kind) {
    case 'var':
    case 'const':
      return formula
    case 'not':
      return not(eliminateImplications(formula.arg))
    case 'implies':
      return or(not(eliminateImplications(formula.left)), eliminateImplications(formula.right))
    case 'iff':
      return eliminateImplications(eliminateBiconditionals(formula))
    default:
      return {
        kind: formula.kind,
        left: eliminateImplications(formula.left),
        right: eliminateImplications(formula.right),
      }
  }
}

/** Negation Normal Form: ¬ appears only directly in front of variables. */
export function toNNF(formula: Formula): Formula {
  const pushNegations = (f: Formula, negated: boolean): Formula => {
    switch (f.kind) {
      case 'var':
        return negated ? not(f) : f
      case 'const':
        return negated ? (f.value ? FALSE : TRUE) : f
      case 'not':
        return pushNegations(f.arg, !negated)
      case 'and':
        return negated
          ? or(pushNegations(f.left, true), pushNegations(f.right, true))
          : and(pushNegations(f.left, false), pushNegations(f.right, false))
      case 'or':
        return negated
          ? and(pushNegations(f.left, true), pushNegations(f.right, true))
          : or(pushNegations(f.left, false), pushNegations(f.right, false))
      case 'implies':
        // a → b  ≡  ¬a ∨ b ;  ¬(a → b)  ≡  a ∧ ¬b
        return negated
          ? and(pushNegations(f.left, false), pushNegations(f.right, true))
          : or(pushNegations(f.left, true), pushNegations(f.right, false))
      case 'iff':
        return pushNegations(eliminateBiconditionals(f), negated)
    }
  }

  return pushNegations(formula, false)
}

/** Flatten a chain of ∧ into its conjuncts (a ∧ (b ∧ c) -> [a, b, c]). */
export function conjuncts(formula: Formula): Formula[] {
  if (formula.kind !== 'and') return [formula]
  return [...conjuncts(formula.left), ...conjuncts(formula.right)]
}

/** Flatten a chain of ∨ into its disjuncts. */
export function disjuncts(formula: Formula): Formula[] {
  if (formula.kind !== 'or') return [formula]
  return [...disjuncts(formula.left), ...disjuncts(formula.right)]
}

export function toCNF(formula: Formula): Formula {
  const distribute = (left: Formula, right: Formula): Formula => {
    if (left.kind === 'and') return and(distribute(left.left, right), distribute(left.right, right))
    if (right.kind === 'and') return and(distribute(left, right.left), distribute(left, right.right))
    return or(left, right)
  }

  const convert = (f: Formula): Formula => {
    if (f.kind === 'and') return guard(and(convert(f.left), convert(f.right)))
    if (f.kind === 'or') return guard(distribute(convert(f.left), convert(f.right)))
    return f
  }

  return simplify(convert(toNNF(simplify(formula))))
}

export function toDNF(formula: Formula): Formula {
  const distribute = (left: Formula, right: Formula): Formula => {
    if (left.kind === 'or') return or(distribute(left.left, right), distribute(left.right, right))
    if (right.kind === 'or') return or(distribute(left, right.left), distribute(left, right.right))
    return and(left, right)
  }

  const convert = (f: Formula): Formula => {
    if (f.kind === 'or') return guard(or(convert(f.left), convert(f.right)))
    if (f.kind === 'and') return guard(distribute(convert(f.left), convert(f.right)))
    return f
  }

  return simplify(convert(toNNF(simplify(formula))))
}

// ---------------------------------------------------------------------------
// Clause view — the representation resolution and DPLL work on.
// ---------------------------------------------------------------------------

export interface Literal {
  readonly name: string
  readonly negated: boolean
}

/** A clause is a disjunction of literals; the empty clause is falsum. */
export type Clause = readonly Literal[]

export const isLiteral = (f: Formula): boolean =>
  f.kind === 'var' || (f.kind === 'not' && f.arg.kind === 'var')

export const isClause = (f: Formula): boolean => disjuncts(f).every(isLiteral)

/**
 * ⊤ and ⊥ count as normal forms: ⊤ is the empty clause set and ⊥ the clause
 * set containing the empty clause. `simplify` inside toCNF/toDNF collapses
 * tautologies and contradictions to exactly these, so without this case the
 * converters would emit output their own validator rejects.
 */
export const isCNF = (f: Formula): boolean =>
  f.kind === 'const' || conjuncts(f).every(isClause)

export const isDNF = (f: Formula): boolean =>
  f.kind === 'const' || disjuncts(f).every((d) => conjuncts(d).every(isLiteral))

function toLiteral(f: Formula): Literal {
  if (f.kind === 'var') return { name: f.name, negated: false }
  if (f.kind === 'not' && f.arg.kind === 'var') return { name: f.arg.name, negated: true }
  throw new TypeError('Expected a literal (a variable or a negated variable)')
}

/**
 * Clause set of a formula. Converts to CNF first, so this works on any input.
 * Tautological clauses (containing p and ¬p) are kept — students are usually
 * expected to notice and discard them themselves.
 */
export function clauses(formula: Formula): Clause[] {
  const cnf = toCNF(formula)
  if (cnf.kind === 'const') return cnf.value ? [] : [[]]
  return conjuncts(cnf).map((clause) => disjuncts(clause).map(toLiteral))
}

export const literalToFormula = (literal: Literal): Formula =>
  literal.negated ? not(v(literal.name)) : v(literal.name)

export const clauseToFormula = (clause: Clause): Formula =>
  clause.length === 0 ? FALSE : orAll(clause.map(literalToFormula))

export const clauseSetToFormula = (set: readonly Clause[]): Formula =>
  set.length === 0 ? TRUE : andAll(set.map(clauseToFormula))

export const literalsEqual = (a: Literal, b: Literal): boolean =>
  a.name === b.name && a.negated === b.negated

export const areComplementary = (a: Literal, b: Literal): boolean =>
  a.name === b.name && a.negated !== b.negated

/** A clause containing both p and ¬p — always true, safe to discard. */
export const isTautologicalClause = (clause: Clause): boolean =>
  clause.some((a) => clause.some((b) => areComplementary(a, b)))

export function showLiteral(literal: Literal): string {
  return `${literal.negated ? '¬' : ''}${literal.name}`
}

export function showClause(clause: Clause): string {
  return clause.length === 0 ? '□' : `{${clause.map(showLiteral).join(', ')}}`
}

export function showClauseSet(set: readonly Clause[]): string {
  return `{${set.map(showClause).join(', ')}}`
}
