/**
 * Multivariate polynomials over the rationals — ln.pdf §5.3.
 *
 * Needed for the last thing the course does: verifying a circuit by reducing a
 * polynomial to zero. A monomial is a rational coefficient times a product of
 * powers (Definition 5.9); a polynomial is a sum of monomials, kept normalised
 * so that equality is a string comparison and "is it zero?" is a length check.
 *
 * Coefficients are exact rationals rather than floats. The reductions here run
 * dozens of steps and multiply out repeatedly; a rounding error would turn a
 * correct circuit into an incorrect one and be invisible.
 */

// ---------------------------------------------------------------------------
// Rationals
// ---------------------------------------------------------------------------

export interface Rational {
  /** Always carries the sign; never zero unless the value is zero. */
  numerator: number
  /** Always positive. */
  denominator: number
}

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const next = x % y
    x = y
    y = next
  }
  return x === 0 ? 1 : x
}

export function rational(numerator: number, denominator = 1): Rational {
  if (denominator === 0) throw new Error('A rational cannot have denominator zero')
  const sign = denominator < 0 ? -1 : 1
  const divisor = gcd(numerator, denominator)
  return {
    numerator: (sign * numerator) / divisor,
    denominator: (sign * denominator) / divisor,
  }
}

export const ZERO = rational(0)
export const ONE = rational(1)

export const isZeroRational = (value: Rational): boolean => value.numerator === 0

export const addRational = (left: Rational, right: Rational): Rational =>
  rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  )

export const multiplyRational = (left: Rational, right: Rational): Rational =>
  rational(left.numerator * right.numerator, left.denominator * right.denominator)

export const negateRational = (value: Rational): Rational =>
  rational(-value.numerator, value.denominator)

export function showRational(value: Rational): string {
  if (value.denominator === 1) return String(value.numerator)
  return `${value.numerator}/${value.denominator}`
}

// ---------------------------------------------------------------------------
// Monomials
// ---------------------------------------------------------------------------

/** Variable → exponent. A variable absent from the map has exponent zero. */
export type Powers = Readonly<Record<string, number>>

export interface Monomial {
  coefficient: Rational
  powers: Powers
}

/** The canonical key of a monomial's variable part, so like terms collect. */
export function powerKey(powers: Powers): string {
  return Object.entries(powers)
    .filter(([, exponent]) => exponent > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, exponent]) => (exponent === 1 ? name : `${name}^${exponent}`))
    .join('*')
}

export const multiplyPowers = (left: Powers, right: Powers): Powers => {
  const merged: Record<string, number> = { ...left }
  for (const [name, exponent] of Object.entries(right)) {
    merged[name] = (merged[name] ?? 0) + exponent
  }
  return merged
}

export const monomialDegree = (powers: Powers): number =>
  Object.values(powers).reduce((total, exponent) => total + exponent, 0)

// ---------------------------------------------------------------------------
// Polynomials
// ---------------------------------------------------------------------------

/** Normalised: no zero coefficients, no two monomials with the same powers. */
export type Polynomial = readonly Monomial[]

export const zero: Polynomial = []

export const polyConstant = (value: Rational): Polynomial =>
  isZeroRational(value) ? [] : [{ coefficient: value, powers: {} }]

export const polyVariable = (name: string): Polynomial => [
  { coefficient: ONE, powers: { [name]: 1 } },
]

/** Collect like terms, drop zeros, and sort so equal polynomials print alike. */
export function normalise(monomials: readonly Monomial[]): Polynomial {
  const collected = new Map<string, Monomial>()
  for (const monomial of monomials) {
    const key = powerKey(monomial.powers)
    const existing = collected.get(key)
    if (existing === undefined) {
      collected.set(key, { ...monomial, powers: cleanPowers(monomial.powers) })
      continue
    }
    collected.set(key, {
      coefficient: addRational(existing.coefficient, monomial.coefficient),
      powers: existing.powers,
    })
  }
  return [...collected.values()]
    .filter((monomial) => !isZeroRational(monomial.coefficient))
    .sort((left, right) => {
      const byDegree = monomialDegree(right.powers) - monomialDegree(left.powers)
      if (byDegree !== 0) return byDegree
      return powerKey(left.powers).localeCompare(powerKey(right.powers))
    })
}

const cleanPowers = (powers: Powers): Powers =>
  Object.fromEntries(Object.entries(powers).filter(([, exponent]) => exponent > 0))

export const add = (left: Polynomial, right: Polynomial): Polynomial =>
  normalise([...left, ...right])

export const negate = (polynomial: Polynomial): Polynomial =>
  polynomial.map((monomial) => ({
    coefficient: negateRational(monomial.coefficient),
    powers: monomial.powers,
  }))

export const subtract = (left: Polynomial, right: Polynomial): Polynomial =>
  add(left, negate(right))

export function multiply(left: Polynomial, right: Polynomial): Polynomial {
  const product: Monomial[] = []
  for (const one of left) {
    for (const two of right) {
      product.push({
        coefficient: multiplyRational(one.coefficient, two.coefficient),
        powers: multiplyPowers(one.powers, two.powers),
      })
    }
  }
  return normalise(product)
}

export const isZero = (polynomial: Polynomial): boolean => polynomial.length === 0

export const polynomialsEqual = (left: Polynomial, right: Polynomial): boolean =>
  showPolynomial(left) === showPolynomial(right)

/** The variables occurring, in alphabetical order. */
export const polynomialVariables = (polynomial: Polynomial): string[] =>
  [...new Set(polynomial.flatMap((monomial) => Object.keys(monomial.powers)))].sort((a, b) =>
    a.localeCompare(b),
  )

/**
 * Printed the way the notes print one: `2*a*b*c - 4*a^2*b*c^2`.
 *
 * Signs are folded into the joins so a negative leading coefficient reads as a
 * minus rather than as `+ -2`.
 */
export function showPolynomial(polynomial: Polynomial): string {
  if (polynomial.length === 0) return '0'
  return polynomial
    .map((monomial, index) => {
      const negative = monomial.coefficient.numerator < 0
      const magnitude = negative
        ? negateRational(monomial.coefficient)
        : monomial.coefficient
      const key = powerKey(monomial.powers)
      const body =
        key === ''
          ? showRational(magnitude)
          : showRational(magnitude) === '1'
            ? key
            : `${showRational(magnitude)}*${key}`
      if (index === 0) return negative ? `-${body}` : body
      return negative ? ` - ${body}` : ` + ${body}`
    })
    .join('')
}

/** Evaluate at a point, for checking a polynomial against a truth table. */
export function evaluatePolynomial(
  polynomial: Polynomial,
  point: Readonly<Record<string, number>>,
): number {
  let total = 0
  for (const monomial of polynomial) {
    let value = monomial.coefficient.numerator / monomial.coefficient.denominator
    for (const [name, exponent] of Object.entries(monomial.powers)) {
      const at = point[name]
      if (at === undefined) throw new Error(`No value given for ${name}`)
      value *= at ** exponent
    }
    total += value
  }
  return total
}

// ---------------------------------------------------------------------------
// Reduction — §5.3, the circuit-verification procedure
// ---------------------------------------------------------------------------

/**
 * A rule rewriting one variable's power. `x^2 → x` and `s1 → x1+x3-x1*x3` are
 * both of this shape: a left side that is a single variable raised to a power,
 * and a polynomial right side.
 */
export interface PolyRule {
  variable: string
  /** The exponent the rule matches. 1 for a gate rule, 2 for x² → x. */
  exponent: number
  right: Polynomial
}

export const showPolyRule = (rule: PolyRule): string =>
  `${rule.variable}${rule.exponent === 1 ? '' : `^${rule.exponent}`} → ${showPolynomial(rule.right)}`

/**
 * Apply a rule everywhere at once.
 *
 * The notes are explicit about this: "when we apply a polynomial reduction
 * rule, we apply it at all possible positions at once". A rule for x² fires on
 * every monomial whose x-exponent is at least 2; a rule for x fires on every
 * monomial containing x at all.
 */
export function applyPolyRule(polynomial: Polynomial, rule: PolyRule): Polynomial {
  let changed = false
  const result: Polynomial[] = []

  for (const monomial of polynomial) {
    const exponent = monomial.powers[rule.variable] ?? 0
    if (exponent < rule.exponent) {
      result.push([monomial])
      continue
    }
    changed = true
    // Peel off exactly the matched power and multiply the rest by the right
    // side once for each time the rule fires in this monomial.
    const times = rule.exponent === 1 ? exponent : Math.floor(exponent / rule.exponent)
    const leftover = exponent - times * rule.exponent
    const rest: Powers = { ...monomial.powers }
    if (leftover === 0) delete (rest as Record<string, number>)[rule.variable]
    else (rest as Record<string, number>)[rule.variable] = leftover

    let piece: Polynomial = [{ coefficient: monomial.coefficient, powers: rest }]
    for (let count = 0; count < times; count++) piece = multiply(piece, rule.right)
    result.push(piece)
  }

  if (!changed) return polynomial
  return normalise(result.flat())
}

export const ruleApplies = (polynomial: Polynomial, rule: PolyRule): boolean =>
  polynomial.some((monomial) => (monomial.powers[rule.variable] ?? 0) >= rule.exponent)

/**
 * Reduce until nothing applies, taking the first available rule each time.
 *
 * Terminates because every rule replaces a variable by something built from
 * variables that come earlier in the circuit's topological order, and the x²→x
 * rules only ever lower a degree.
 */
export function reducePolynomial(
  polynomial: Polynomial,
  rules: readonly PolyRule[],
  limit = 200,
): { chain: Polynomial[]; used: PolyRule[]; result: Polynomial } {
  const chain: Polynomial[] = [polynomial]
  const used: PolyRule[] = []
  let current = polynomial

  for (let step = 0; step < limit; step++) {
    const rule = rules.find((candidate) => ruleApplies(current, candidate))
    if (rule === undefined) break
    const next = applyPolyRule(current, rule)
    if (polynomialsEqual(next, current)) break
    used.push(rule)
    current = next
    chain.push(current)
  }

  return { chain, used, result: current }
}

// ---------------------------------------------------------------------------
// Gates — Figure 5.3
// ---------------------------------------------------------------------------

export type GateKind = 'and' | 'or' | 'xor'

export const GATE_LABELS: Readonly<Record<GateKind, string>> = {
  and: 'AND',
  or: 'OR',
  xor: 'XOR',
}

/** What a gate computes, for checking a polynomial against its truth table. */
export const gateValue = (kind: GateKind, x: number, y: number): number => {
  switch (kind) {
    case 'and':
      return x && y ? 1 : 0
    case 'or':
      return x || y ? 1 : 0
    case 'xor':
      return x === y ? 0 : 1
  }
}

/**
 * The gate polynomial of Figure 5.3, with named variables.
 *
 * Each is `z − (what the gate computes)`, which is zero exactly when z is the
 * gate's correct output — so a circuit becomes a set of polynomial equations.
 */
export function gatePolynomial(kind: GateKind, x: string, y: string, z: string): Polynomial {
  const X = polyVariable(x)
  const Y = polyVariable(y)
  const Z = polyVariable(z)
  const XY = multiply(X, Y)

  switch (kind) {
    case 'and':
      // z - xy
      return subtract(Z, XY)
    case 'or':
      // z - x - y + xy
      return add(subtract(subtract(Z, X), Y), XY)
    case 'xor':
      // z - x - y + 2xy
      return add(subtract(subtract(Z, X), Y), multiply(polyConstant(rational(2)), XY))
  }
}

/** The right-hand side a gate polynomial turns into as a reduction rule. */
export function gateRule(kind: GateKind, x: string, y: string, z: string): PolyRule {
  const X = polyVariable(x)
  const Y = polyVariable(y)
  const XY = multiply(X, Y)

  const right: Polynomial =
    kind === 'and'
      ? XY
      : kind === 'or'
        ? add(subtract(add(X, Y), XY), zero)
        : subtract(add(X, Y), multiply(polyConstant(rational(2)), XY))

  return { variable: z, exponent: 1, right }
}

/** `x² → x`, the constraint that pins a variable to 0 or 1. */
export const booleanRule = (name: string): PolyRule => ({
  variable: name,
  exponent: 2,
  right: polyVariable(name),
})
