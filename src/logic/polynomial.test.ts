import { describe, expect, it } from 'vitest'
import {
  add,
  applyPolyRule,
  booleanRule,
  polyConstant,
  evaluatePolynomial,
  gatePolynomial,
  gateRule,
  gateValue,
  isZero,
  multiply,
  polynomialsEqual,
  rational,
  reducePolynomial,
  showPolynomial,
  showRational,
  subtract,
  polyVariable,
  type PolyRule,
  type Polynomial,
} from './polynomial'

const X = polyVariable('x')
const Y = polyVariable('y')
const N = (value: number, over = 1): Polynomial => polyConstant(rational(value, over))

describe('rationals', () => {
  it('stays exact where a float would not', () => {
    // 1/3 + 1/3 + 1/3 is one, not 0.9999999999999999.
    const third = N(1, 3)
    expect(showPolynomial(add(add(third, third), third))).toBe('1')
  })

  it('normalises the sign onto the numerator', () => {
    expect(showRational(rational(1, -2))).toBe('-1/2')
    expect(showRational(rational(-2, -4))).toBe('1/2')
  })
})

describe('arithmetic', () => {
  it('collects like terms', () => {
    expect(showPolynomial(add(X, X))).toBe('2*x')
    expect(isZero(subtract(X, X))).toBe(true)
  })

  it('expands a product the way the notes do', () => {
    // (x+y)*(y+x) = x^2 + 2xy + y^2
    const expanded = multiply(add(X, Y), add(Y, X))
    // Same degree, so the tie is broken by the printed variable part.
    expect(showPolynomial(expanded)).toBe('2*x*y + x^2 + y^2')
  })

  it('prints a negative leading term as a minus', () => {
    expect(showPolynomial(subtract(N(0), multiply(N(3), X)))).toBe('-3*x')
    expect(showPolynomial(subtract(X, Y))).toBe('x - y')
  })

  it('sorts by degree so equal polynomials print alike', () => {
    const one = add(add(multiply(X, Y), X), N(2))
    const other = add(add(N(2), X), multiply(Y, X))
    expect(polynomialsEqual(one, other)).toBe(true)
  })

  it('evaluates at a point', () => {
    const p = subtract(add(X, Y), multiply(X, Y))
    expect(evaluatePolynomial(p, { x: 1, y: 0 })).toBe(1)
    expect(evaluatePolynomial(p, { x: 1, y: 1 })).toBe(1)
    expect(evaluatePolynomial(p, { x: 0, y: 0 })).toBe(0)
  })
})

describe('gate polynomials — Figure 5.3', () => {
  it('prints as the figure prints them', () => {
    expect(showPolynomial(gatePolynomial('and', 'x', 'y', 'z'))).toBe('-x*y + z')
    expect(showPolynomial(gatePolynomial('or', 'x', 'y', 'z'))).toBe('x*y - x - y + z')
    expect(showPolynomial(gatePolynomial('xor', 'x', 'y', 'z'))).toBe('2*x*y - x - y + z')
  })

  it('vanishes exactly when z is the gate’s output', () => {
    for (const kind of ['and', 'or', 'xor'] as const) {
      const polynomial = gatePolynomial(kind, 'x', 'y', 'z')
      for (const x of [0, 1]) {
        for (const y of [0, 1]) {
          for (const z of [0, 1]) {
            const value = evaluatePolynomial(polynomial, { x, y, z })
            const correct = z === gateValue(kind, x, y)
            expect([kind, x, y, z, value === 0]).toEqual([kind, x, y, z, correct])
          }
        }
      }
    }
  })

  it('turns into a rule with the signs flipped', () => {
    // The notes point this out: z - x - y + xy = 0 becomes z → x + y - xy.
    expect(showPolynomial(gateRule('or', 'x', 'y', 'z').right)).toBe('-x*y + x + y')
    expect(showPolynomial(gateRule('and', 'x', 'y', 'z').right)).toBe('x*y')
    expect(showPolynomial(gateRule('xor', 'x', 'y', 'z').right)).toBe('-2*x*y + x + y')
  })
})

describe('reduction', () => {
  it('applies a rule at every position at once', () => {
    // The notes' own step: a + c - 2ac - x2 + 2abc*x2 with x2 → a+c-2ac.
    const a = polyVariable('a')
    const c = polyVariable('c')
    const x2 = polyVariable('x2')
    const ac = multiply(a, c)
    const start = add(
      subtract(subtract(add(a, c), multiply(N(2), ac)), x2),
      multiply(multiply(N(2), multiply(multiply(a, polyVariable('b')), c)), x2),
    )
    const rule: PolyRule = {
      variable: 'x2',
      exponent: 1,
      right: subtract(add(a, c), multiply(N(2), ac)),
    }
    const after = applyPolyRule(start, rule)
    // a + c - 2ac cancels with -(a+c-2ac), leaving only the product term.
    expect(showPolynomial(after)).toBe('-4*a^2*b*c^2 + 2*a*b*c^2 + 2*a^2*b*c')
  })

  it('lowers a square with x² → x', () => {
    const squared = multiply(X, X)
    expect(showPolynomial(applyPolyRule(squared, booleanRule('x')))).toBe('x')
    const cubed = multiply(squared, X)
    // x^3 fires once, giving x^2, and the loop takes it down to x.
    expect(showPolynomial(reducePolynomial(cubed, [booleanRule('x')]).result)).toBe('x')
  })

  it('verifies the notes’ own circuit — Example 5.12', () => {
    // Full adder: x1 = a AND c, x2 = a XOR c, x3 = b AND x2,
    // s0 = b XOR x2, s1 = x1 OR x3. Claim: a + b + c - 2*s1 - s0 = 0.
    const rules: PolyRule[] = [
      gateRule('or', 'x1', 'x3', 's1'),
      gateRule('xor', 'b', 'x2', 's0'),
      gateRule('and', 'b', 'x2', 'x3'),
      gateRule('and', 'a', 'c', 'x1'),
      gateRule('xor', 'a', 'c', 'x2'),
      booleanRule('a'),
      booleanRule('b'),
      booleanRule('c'),
    ]
    const goal = subtract(
      subtract(add(add(polyVariable('a'), polyVariable('b')), polyVariable('c')), multiply(N(2), polyVariable('s1'))),
      polyVariable('s0'),
    )
    const run = reducePolynomial(goal, rules)
    expect(showPolynomial(run.result)).toBe('0')
    expect(run.chain.length).toBeGreaterThan(3)
  })

  it('verifies exam26a’s half adder', () => {
    // s1 = a AND b, s0 = a XOR b. Claim: a + b - 2*s1 - s0 = 0.
    const rules: PolyRule[] = [
      gateRule('and', 'a', 'b', 's1'),
      gateRule('xor', 'a', 'b', 's0'),
      booleanRule('a'),
      booleanRule('b'),
    ]
    const goal = subtract(
      subtract(add(polyVariable('a'), polyVariable('b')), multiply(N(2), polyVariable('s1'))),
      polyVariable('s0'),
    )
    expect(isZero(reducePolynomial(goal, rules).result)).toBe(true)
  })

  it('refuses a claim the wiring does not support', () => {
    // exam26bA asks for a - b - (2*s1 - s0) = 0. With s1 = a AND b and
    // s0 = a XOR b that is false — at a=1, b=0 it comes to 2 — so whatever
    // circuit the paper draws, it is not this one. The method says so rather
    // than quietly agreeing, which is the property worth testing.
    const rules: PolyRule[] = [
      gateRule('and', 'a', 'b', 's1'),
      gateRule('xor', 'a', 'b', 's0'),
      booleanRule('a'),
      booleanRule('b'),
    ]
    const goal = subtract(
      subtract(polyVariable('a'), polyVariable('b')),
      subtract(multiply(N(2), polyVariable('s1')), polyVariable('s0')),
    )
    const result = reducePolynomial(goal, rules).result
    expect(isZero(result)).toBe(false)
    // And brute force agrees: a=1, b=0 gives 2, not 0.
    expect(evaluatePolynomial(goal, { a: 1, b: 0, s1: 0, s0: 1 })).toBe(2)
  })

  it('does not reduce a wrong claim to zero', () => {
    const rules: PolyRule[] = [
      gateRule('and', 'a', 'b', 's1'),
      gateRule('xor', 'a', 'b', 's0'),
      booleanRule('a'),
      booleanRule('b'),
    ]
    // Claiming the outputs are the *product* rather than the sum.
    const wrong = subtract(multiply(polyVariable('a'), polyVariable('b')), polyVariable('s0'))
    expect(isZero(reducePolynomial(wrong, rules).result)).toBe(false)
  })

  it('agrees with brute force over every input', () => {
    // The polynomial method and checking all 2^n inputs must give one answer.
    const rules: PolyRule[] = [
      gateRule('and', 'a', 'b', 's1'),
      gateRule('xor', 'a', 'b', 's0'),
      booleanRule('a'),
      booleanRule('b'),
    ]
    const goal = subtract(
      subtract(add(polyVariable('a'), polyVariable('b')), multiply(N(2), polyVariable('s1'))),
      polyVariable('s0'),
    )
    let holds = true
    for (const a of [0, 1]) {
      for (const b of [0, 1]) {
        const s1 = gateValue('and', a, b)
        const s0 = gateValue('xor', a, b)
        if (a + b - 2 * s1 - s0 !== 0) holds = false
      }
    }
    expect(isZero(reducePolynomial(goal, rules).result)).toBe(holds)
  })
})
