/**
 * Arithmetic formulas over ℕ, evaluated up to a bound — ln.pdf §5.2.
 *
 * The theory T(ℕ,=,+,*) is undecidable, so nothing here decides membership. It
 * does something narrower and honest: given a formula with one free variable n,
 * it says for each concrete n up to a bound whether the formula holds, with the
 * quantifiers searched over the same bound.
 *
 * That is enough for what the exercises actually ask — matching a formula to
 * the property it expresses. If two candidate readings disagree anywhere in the
 * first fifty numbers, the match is settled; and the guide says plainly that
 * agreeing up to fifty is evidence rather than proof.
 *
 * The shortcuts the notes introduce — `x|y`, `prime(p)` — are in the language
 * here as primitives, because the notes use them that way and unfolding them
 * would make every formula unreadable without changing any answer.
 */

export type Arith =
  | { kind: 'var'; name: string }
  | { kind: 'number'; value: number }
  | { kind: 'add'; left: Arith; right: Arith }
  | { kind: 'times'; left: Arith; right: Arith }
  | { kind: 'power'; base: Arith; exponent: number }

export type ArithFormula =
  | { kind: 'equals'; left: Arith; right: Arith }
  | { kind: 'less'; left: Arith; right: Arith }
  | { kind: 'atMost'; left: Arith; right: Arith }
  | { kind: 'divides'; left: Arith; right: Arith }
  | { kind: 'prime'; of: Arith }
  | { kind: 'not'; body: ArithFormula }
  | { kind: 'and'; left: ArithFormula; right: ArithFormula }
  | { kind: 'or'; left: ArithFormula; right: ArithFormula }
  | { kind: 'implies'; left: ArithFormula; right: ArithFormula }
  | { kind: 'iff'; left: ArithFormula; right: ArithFormula }
  | { kind: 'forall'; variable: string; body: ArithFormula }
  | { kind: 'exists'; variable: string; body: ArithFormula }

export type Env = Readonly<Record<string, number>>

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

export const v = (name: string): Arith => ({ kind: 'var', name })
export const num = (value: number): Arith => ({ kind: 'number', value })
export const plus = (left: Arith, right: Arith): Arith => ({ kind: 'add', left, right })
export const times = (left: Arith, right: Arith): Arith => ({ kind: 'times', left, right })
export const power = (base: Arith, exponent: number): Arith => ({ kind: 'power', base, exponent })

export const eq = (left: Arith, right: Arith): ArithFormula => ({ kind: 'equals', left, right })
export const lt = (left: Arith, right: Arith): ArithFormula => ({ kind: 'less', left, right })
export const le = (left: Arith, right: Arith): ArithFormula => ({ kind: 'atMost', left, right })
export const divides = (left: Arith, right: Arith): ArithFormula => ({
  kind: 'divides',
  left,
  right,
})
export const prime = (of: Arith): ArithFormula => ({ kind: 'prime', of })
export const not = (body: ArithFormula): ArithFormula => ({ kind: 'not', body })
export const and = (left: ArithFormula, right: ArithFormula): ArithFormula => ({
  kind: 'and',
  left,
  right,
})
export const or = (left: ArithFormula, right: ArithFormula): ArithFormula => ({
  kind: 'or',
  left,
  right,
})
export const implies = (left: ArithFormula, right: ArithFormula): ArithFormula => ({
  kind: 'implies',
  left,
  right,
})
export const iff = (left: ArithFormula, right: ArithFormula): ArithFormula => ({
  kind: 'iff',
  left,
  right,
})
export const forall = (variable: string, body: ArithFormula): ArithFormula => ({
  kind: 'forall',
  variable,
  body,
})
export const exists = (variable: string, body: ArithFormula): ArithFormula => ({
  kind: 'exists',
  variable,
  body,
})

// ---------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------

export function showArith(term: Arith): string {
  switch (term.kind) {
    case 'var':
      return term.name
    case 'number':
      return String(term.value)
    case 'add':
      return `(${showArith(term.left)}+${showArith(term.right)})`
    case 'times':
      return `${showArith(term.left)}*${showArith(term.right)}`
    case 'power':
      return `${showArith(term.base)}^${term.exponent}`
  }
}

export function showArithFormula(formula: ArithFormula): string {
  switch (formula.kind) {
    case 'equals':
      return `${showArith(formula.left)}=${showArith(formula.right)}`
    case 'less':
      return `${showArith(formula.left)}<${showArith(formula.right)}`
    case 'atMost':
      return `${showArith(formula.left)}≤${showArith(formula.right)}`
    case 'divides':
      return `${showArith(formula.left)}|${showArith(formula.right)}`
    case 'prime':
      return `prime(${showArith(formula.of)})`
    case 'not': {
      // A negated comparison has to be bracketed: `¬p^2|n` reads as "¬(p²)
      // divides n", which is not what it means. `prime(p)` is safe, since the
      // brackets are already there.
      const body = showArithFormula(formula.body)
      return formula.body.kind === 'prime' || body.startsWith('(')
        ? `¬${body}`
        : `¬(${body})`
    }
    case 'and':
      return `(${showArithFormula(formula.left)} ∧ ${showArithFormula(formula.right)})`
    case 'or':
      return `(${showArithFormula(formula.left)} ∨ ${showArithFormula(formula.right)})`
    case 'implies':
      return `(${showArithFormula(formula.left)} → ${showArithFormula(formula.right)})`
    case 'iff':
      return `(${showArithFormula(formula.left)} ↔ ${showArithFormula(formula.right)})`
    case 'forall':
      return `∀${formula.variable}:${showArithFormula(formula.body)}`
    case 'exists':
      return `∃${formula.variable}:${showArithFormula(formula.body)}`
  }
}

// ---------------------------------------------------------------------------
// Evaluating
// ---------------------------------------------------------------------------

export class UnboundVariableError extends Error {}

export function evaluateArith(term: Arith, env: Env): number {
  switch (term.kind) {
    case 'var': {
      const value = env[term.name]
      if (value === undefined) throw new UnboundVariableError(`No value for ${term.name}`)
      return value
    }
    case 'number':
      return term.value
    case 'add':
      return evaluateArith(term.left, env) + evaluateArith(term.right, env)
    case 'times':
      return evaluateArith(term.left, env) * evaluateArith(term.right, env)
    case 'power':
      return evaluateArith(term.base, env) ** term.exponent
  }
}

export const isPrime = (value: number): boolean => {
  if (!Number.isInteger(value) || value < 2) return false
  for (let divisor = 2; divisor * divisor <= value; divisor++) {
    if (value % divisor === 0) return false
  }
  return true
}

/**
 * Truth under a bound.
 *
 * Quantifiers range over 0…bound. A ∀ that fails somewhere in that range is
 * definitively false; a ∀ that holds throughout is only *unrefuted*, and an ∃
 * is the other way round. Every caller here is comparing two readings of the
 * same property, where a disagreement anywhere settles it.
 */
export function holdsUpTo(formula: ArithFormula, env: Env, bound: number): boolean {
  switch (formula.kind) {
    case 'equals':
      return evaluateArith(formula.left, env) === evaluateArith(formula.right, env)
    case 'less':
      return evaluateArith(formula.left, env) < evaluateArith(formula.right, env)
    case 'atMost':
      return evaluateArith(formula.left, env) <= evaluateArith(formula.right, env)
    case 'divides': {
      const left = evaluateArith(formula.left, env)
      const right = evaluateArith(formula.right, env)
      // In ℕ, every number divides 0, and 0 divides only 0.
      if (left === 0) return right === 0
      return right % left === 0
    }
    case 'prime':
      return isPrime(evaluateArith(formula.of, env))
    case 'not':
      return !holdsUpTo(formula.body, env, bound)
    case 'and':
      return holdsUpTo(formula.left, env, bound) && holdsUpTo(formula.right, env, bound)
    case 'or':
      return holdsUpTo(formula.left, env, bound) || holdsUpTo(formula.right, env, bound)
    case 'implies':
      return !holdsUpTo(formula.left, env, bound) || holdsUpTo(formula.right, env, bound)
    case 'iff':
      return holdsUpTo(formula.left, env, bound) === holdsUpTo(formula.right, env, bound)
    case 'forall': {
      for (let value = 0; value <= bound; value++) {
        if (!holdsUpTo(formula.body, { ...env, [formula.variable]: value }, bound)) return false
      }
      return true
    }
    case 'exists': {
      for (let value = 0; value <= bound; value++) {
        if (holdsUpTo(formula.body, { ...env, [formula.variable]: value }, bound)) return true
      }
      return false
    }
  }
}

/** The n in 0…limit for which a one-variable formula holds. */
export function witnesses(
  formula: ArithFormula,
  name: string,
  limit: number,
  bound = limit,
): number[] {
  const found: number[] = []
  for (let value = 0; value <= limit; value++) {
    if (holdsUpTo(formula, { [name]: value }, bound)) found.push(value)
  }
  return found
}

/**
 * Do a formula and a plain predicate pick out the same numbers?
 *
 * This is the check the matching exercise needs: `∀p:(prime(p) ∧ p|n) → p²|n`
 * and "every prime dividing n divides it twice" have to agree on every n in
 * range, and the first n where they part is the reason a wrong match is wrong.
 */
export function agreesWith(
  formula: ArithFormula,
  name: string,
  predicate: (value: number) => boolean,
  limit: number,
  bound = limit,
): { agrees: boolean; firstDisagreement: number | null } {
  for (let value = 0; value <= limit; value++) {
    const byFormula = holdsUpTo(formula, { [name]: value }, bound)
    if (byFormula !== predicate(value)) return { agrees: false, firstDisagreement: value }
  }
  return { agrees: true, firstDisagreement: null }
}
