/**
 * A small language of real (in)equalities — ln.pdf §5.3, Exercise 12.
 *
 * The signature of T(ℝ,=,+,*) is what the exercises use, plus the shortcut ≤,
 * and the formulas asked about are short: a couple of quantifiers over
 * polynomial comparisons. So rather than a general theory of the reals, this
 * is exactly that fragment, with two ways of deciding a formula.
 *
 * Over a *finite set of candidate values* a quantifier is a loop, which makes
 * everything computable. That is not a decision procedure for the theory —
 * Tarski's is, and it is doubly exponential — and it can be wrong in both
 * directions: a ∃ whose only witnesses are irrational comes out false, and a ∀
 * whose only counterexamples are outside the candidate range comes out true.
 *
 * So the games that use this store the real truth value alongside each formula
 * and the tests assert that the candidate search reproduces it. The search is
 * the interaction; the stored value is the authority.
 */

import {
  add,
  evaluatePolynomial,
  multiply,
  polyConstant,
  polyVariable,
  rational,
  showPolynomial,
  subtract,
  type Polynomial,
} from './polynomial'

export type RealRelation = 'lt' | 'le' | 'eq'

export type RealFormula =
  | { kind: 'atom'; relation: RealRelation; left: Polynomial; right: Polynomial }
  | { kind: 'not'; body: RealFormula }
  | { kind: 'and'; left: RealFormula; right: RealFormula }
  | { kind: 'or'; left: RealFormula; right: RealFormula }
  | { kind: 'implies'; left: RealFormula; right: RealFormula }
  | { kind: 'quantified'; quantifier: 'forall' | 'exists'; variable: string; body: RealFormula }

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

export const rx = (name: string): Polynomial => polyVariable(name)
export const rnum = (value: number): Polynomial => polyConstant(rational(value))
export const rplus = (left: Polynomial, right: Polynomial): Polynomial => add(left, right)
export const rminus = (left: Polynomial, right: Polynomial): Polynomial => subtract(left, right)
export const rtimes = (left: Polynomial, right: Polynomial): Polynomial => multiply(left, right)
export const rsquare = (base: Polynomial): Polynomial => multiply(base, base)

export const rlt = (left: Polynomial, right: Polynomial): RealFormula => ({
  kind: 'atom',
  relation: 'lt',
  left,
  right,
})
export const rle = (left: Polynomial, right: Polynomial): RealFormula => ({
  kind: 'atom',
  relation: 'le',
  left,
  right,
})
export const req = (left: Polynomial, right: Polynomial): RealFormula => ({
  kind: 'atom',
  relation: 'eq',
  left,
  right,
})
export const rnot = (body: RealFormula): RealFormula => ({ kind: 'not', body })
export const rand = (left: RealFormula, right: RealFormula): RealFormula => ({
  kind: 'and',
  left,
  right,
})
export const ror = (left: RealFormula, right: RealFormula): RealFormula => ({
  kind: 'or',
  left,
  right,
})
export const rimplies = (left: RealFormula, right: RealFormula): RealFormula => ({
  kind: 'implies',
  left,
  right,
})
export const rforall = (variable: string, body: RealFormula): RealFormula => ({
  kind: 'quantified',
  quantifier: 'forall',
  variable,
  body,
})
export const rexists = (variable: string, body: RealFormula): RealFormula => ({
  kind: 'quantified',
  quantifier: 'exists',
  variable,
  body,
})

// ---------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------

const RELATION_SYMBOL: Readonly<Record<RealRelation, string>> = {
  lt: '<',
  le: '≤',
  eq: '=',
}

export function showReal(formula: RealFormula): string {
  switch (formula.kind) {
    case 'atom':
      return `${showPolynomial(formula.left)}${RELATION_SYMBOL[formula.relation]}${showPolynomial(formula.right)}`
    case 'not':
      return `¬${showReal(formula.body)}`
    case 'and':
      return `(${showReal(formula.left)}∧${showReal(formula.right)})`
    case 'or':
      return `(${showReal(formula.left)}∨${showReal(formula.right)})`
    case 'implies':
      return `(${showReal(formula.left)}→${showReal(formula.right)})`
    case 'quantified':
      return `${formula.quantifier === 'forall' ? '∀' : '∃'}${formula.variable}:${showReal(formula.body)}`
  }
}

/** The quantifier prefix, outermost first, with the matrix under it. */
export function prefix(formula: RealFormula): {
  quantifiers: { quantifier: 'forall' | 'exists'; variable: string }[]
  matrix: RealFormula
} {
  const quantifiers: { quantifier: 'forall' | 'exists'; variable: string }[] = []
  let current = formula
  while (current.kind === 'quantified') {
    quantifiers.push({ quantifier: current.quantifier, variable: current.variable })
    current = current.body
  }
  return { quantifiers, matrix: current }
}

// ---------------------------------------------------------------------------
// Evaluating
// ---------------------------------------------------------------------------

export type RealEnv = Readonly<Record<string, number>>

/**
 * Values a quantifier ranges over.
 *
 * All dyadic, so the arithmetic below is exact in binary floating point rather
 * than nearly exact — a comparison like x*x ≤ y must not depend on rounding.
 * They straddle 0 and 1, which is where every inequality in the exercises
 * changes its mind, and they reach far enough out that a claim like "there is
 * a smallest real" is refuted rather than accidentally confirmed.
 */
export const CANDIDATES: readonly number[] = [
  -6, -4, -3, -2, -1.5, -1, -0.5, -0.25, 0, 0.25, 0.5, 1, 1.5, 2, 3, 4, 6,
]

/**
 * The naturals, as far as a bounded search goes.
 *
 * Passing this instead of CANDIDATES is what lets one formula be judged in two
 * universes — which is exactly what "belongs to T(ℕ,…) but not T(ℝ,…)" asks.
 */
export const NATURALS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8]

export function evaluateReal(
  formula: RealFormula,
  env: RealEnv,
  candidates: readonly number[] = CANDIDATES,
): boolean {
  switch (formula.kind) {
    case 'atom': {
      const left = evaluatePolynomial(formula.left, env)
      const right = evaluatePolynomial(formula.right, env)
      switch (formula.relation) {
        case 'lt':
          return left < right
        case 'le':
          return left <= right
        case 'eq':
          return left === right
      }
      return false
    }
    case 'not':
      return !evaluateReal(formula.body, env, candidates)
    case 'and':
      return (
        evaluateReal(formula.left, env, candidates) && evaluateReal(formula.right, env, candidates)
      )
    case 'or':
      return (
        evaluateReal(formula.left, env, candidates) || evaluateReal(formula.right, env, candidates)
      )
    case 'implies':
      return (
        !evaluateReal(formula.left, env, candidates) || evaluateReal(formula.right, env, candidates)
      )
    case 'quantified': {
      const test = (value: number): boolean =>
        evaluateReal(formula.body, { ...env, [formula.variable]: value }, candidates)
      return formula.quantifier === 'exists' ? candidates.some(test) : candidates.every(test)
    }
  }
}

/**
 * The candidate that best serves whoever is choosing.
 *
 * For ∃ that means a value making the rest true, and for ∀ a value making it
 * false. Null when no such value is in the candidate set — for the challenger
 * that means the player is about to win.
 */
export function bestChoice(
  formula: RealFormula & { kind: 'quantified' },
  env: RealEnv,
): number | null {
  const wanted = formula.quantifier === 'exists'
  for (const value of CANDIDATES) {
    if (evaluateReal(formula.body, { ...env, [formula.variable]: value }) === wanted) return value
  }
  return null
}

/** Every variable the formula mentions, quantified or not. */
export function realVariables(formula: RealFormula): string[] {
  const names = new Set<string>()
  const walk = (node: RealFormula): void => {
    switch (node.kind) {
      case 'atom':
        for (const polynomial of [node.left, node.right]) {
          for (const monomial of polynomial) {
            for (const name of Object.keys(monomial.powers)) names.add(name)
          }
        }
        return
      case 'not':
        walk(node.body)
        return
      case 'quantified':
        names.add(node.variable)
        walk(node.body)
        return
      default:
        walk(node.left)
        walk(node.right)
    }
  }
  walk(formula)
  return [...names]
}
