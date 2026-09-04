import { describe, expect, it } from 'vitest'
import type { Formula } from './ast'
import { equals, sortedVariables, depth as formulaDepth } from './ast'
import {
  FORMULA_PROFILES,
  GenerationFailedError,
  randomFormula,
  randomFormulaWhere,
} from './generate'
import { makeRng } from './rng'
import { classify, isTautology } from './semantics'
import { format } from './print'

/**
 * Does any node combine an operand with *itself*?
 *
 * Checked on the AST, not the printed string: `(r ∨ q) → q` contains the text
 * "q → q" but is a perfectly good formula, whereas `r ∨ q ∨ q` is not.
 */
const chainOperands = (formula: Formula, kind: 'and' | 'or'): Formula[] =>
  formula.kind === kind
    ? [...chainOperands(formula.left, kind), ...chainOperands(formula.right, kind)]
    : [formula]

function repeatsAnOperand(formula: Formula): boolean {
  switch (formula.kind) {
    case 'var':
    case 'const':
      return false
    case 'not':
      return repeatsAnOperand(formula.arg)
    default: {
      const operands =
        formula.kind === 'and' || formula.kind === 'or'
          ? [
              ...chainOperands(formula.left, formula.kind),
              ...chainOperands(formula.right, formula.kind),
            ]
          : [formula.left, formula.right]

      const duplicated = operands.some((a, i) => operands.some((b, j) => i < j && equals(a, b)))
      return duplicated || repeatsAnOperand(formula.left) || repeatsAnOperand(formula.right)
    }
  }
}

describe('randomFormula', () => {
  it('is reproducible from its seed', () => {
    const a = format(randomFormula(makeRng('same'), { depth: 5 }))
    const b = format(randomFormula(makeRng('same'), { depth: 5 }))
    expect(a).toBe(b)
  })

  it('respects the requested depth and variable pool', () => {
    const rng = makeRng('shape')
    for (let i = 0; i < 100; i++) {
      const formula = randomFormula(rng, { depth: 4, variables: ['p', 'q'] })
      expect(formulaDepth(formula)).toBe(4) // depth is an exact target, negations included
      expect(sortedVariables(formula).every((name) => ['p', 'q'].includes(name))).toBe(true)
    }
  })

  it('honours minDistinctVariables', () => {
    const rng = makeRng('distinct')
    for (let i = 0; i < 100; i++) {
      const formula = randomFormula(rng, { depth: 4, variables: ['p', 'q', 'r'], minDistinctVariables: 3 })
      expect(sortedVariables(formula).length).toBeGreaterThanOrEqual(3)
    }
  })

  it('only uses the connectives it was allowed', () => {
    const rng = makeRng('connectives')
    for (let i = 0; i < 100; i++) {
      const printed = format(randomFormula(rng, { depth: 5, connectives: ['and', 'or'] }))
      expect(printed).not.toMatch(/[¬→↔]/)
    }
  })

  it('never combines an operand with itself, given a pool to choose from', () => {
    const rng = makeRng('siblings')
    for (let i = 0; i < 300; i++) {
      const formula = randomFormula(rng, { depth: 5, variables: ['p', 'q', 'r', 's'] })
      expect(repeatsAnOperand(formula), format(formula)).toBe(false)
    }
  })

  it('still terminates when the pool is too small to avoid a repeat', () => {
    // One variable and a deep tree: p ∨ p is unavoidable. The generator must
    // return something rather than retry forever.
    const rng = makeRng('single-variable-pool')
    const formula = randomFormula(rng, { depth: 4, variables: ['p'] })
    expect(sortedVariables(formula)).toEqual(['p'])
  })

  it('produces variety rather than the same formula every time', () => {
    const rng = makeRng('variety')
    const seen = new Set(Array.from({ length: 60 }, () => format(randomFormula(rng, { depth: 4 }))))
    expect(seen.size).toBeGreaterThan(30)
  })

  it('every difficulty profile generates a usable formula', () => {
    for (const [name, profile] of Object.entries(FORMULA_PROFILES)) {
      const formula = randomFormula(makeRng(`profile-${name}`), profile)
      expect(sortedVariables(formula).length).toBeGreaterThanOrEqual(profile.minDistinctVariables ?? 1)
    }
  })
})

describe('randomFormulaWhere', () => {
  it('finds a formula with the requested property', () => {
    const rng = makeRng('property')
    const contingent = randomFormulaWhere(rng, { depth: 4 }, (f) => classify(f) === 'contingent')
    expect(classify(contingent)).toBe('contingent')
  })

  it('gives up loudly rather than looping forever', () => {
    const rng = makeRng('impossible')
    expect(() =>
      randomFormulaWhere(rng, { depth: 2, connectives: ['and'] }, isTautology, 25),
    ).toThrow(GenerationFailedError)
  })
})
