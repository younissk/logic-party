import { describe, expect, it } from 'vitest'
import { parse } from './parse'
import {
  classify,
  countModels,
  dependsOn,
  dependsOnAllVariables,
  entails,
  findCountermodel,
  findCounterexample,
  findDistinguishingAssignment,
  findModel,
  isEquivalent,
  isSatisfiable,
  isTautology,
  showAssignment,
} from './semantics'
import { evaluate } from './evaluate'
import { allAssignments, truthTable, truthVector } from './truthTable'

describe('semantics', () => {
  it('classifies the standard examples', () => {
    expect(classify(parse('p ∨ ¬p'))).toBe('tautology')
    expect(classify(parse('p ∧ ¬p'))).toBe('contradiction')
    expect(classify(parse('p → q'))).toBe('contingent')
  })

  it('recognises the classic tautologies', () => {
    for (const source of [
      'p → p',
      '(p → q) ↔ (¬q → ¬p)', // contraposition
      '¬(p ∧ q) ↔ (¬p ∨ ¬q)', // De Morgan
      '¬(p ∨ q) ↔ (¬p ∧ ¬q)', // De Morgan
      '(p → q) ↔ (¬p ∨ q)', // material implication
      '((p → q) ∧ (q → r)) → (p → r)', // hypothetical syllogism
      '(p ∧ (p → q)) → q', // modus ponens
      '((p ∨ q) ∧ ¬p) → q', // disjunctive syllogism
      '(p ↔ q) ↔ ((p → q) ∧ (q → p))',
    ]) {
      expect(isTautology(parse(source)), source).toBe(true)
    }
  })

  it('returns a witness, not just a verdict', () => {
    const counterexample = findCounterexample(parse('p → q'))
    expect(counterexample).toEqual({ p: true, q: false })

    const model = findModel(parse('p ∧ ¬q'))
    expect(model).toEqual({ p: true, q: false })

    expect(findModel(parse('p ∧ ¬p'))).toBeNull()
    expect(findCounterexample(parse('p ∨ ¬p'))).toBeNull()
  })

  it('counts models', () => {
    expect(countModels(parse('p ∨ q'))).toBe(3)
    expect(countModels(parse('p ∧ q'))).toBe(1)
    expect(countModels(parse('p ∨ ¬p'))).toBe(2)
  })

  it('compares formulas over the union of their variables', () => {
    expect(isEquivalent(parse('p'), parse('p ∧ (q ∨ ¬q)'))).toBe(true)
    expect(isEquivalent(parse('p → q'), parse('¬q → ¬p'))).toBe(true)
    expect(isEquivalent(parse('p → q'), parse('q → p'))).toBe(false)

    const witness = findDistinguishingAssignment(parse('p → q'), parse('q → p'))
    expect(witness).not.toBeNull()
    if (witness) {
      expect(evaluate(parse('p → q'), witness)).not.toBe(evaluate(parse('q → p'), witness))
    }
  })

  it('checks entailment and produces countermodels', () => {
    expect(entails([parse('p'), parse('p → q')], parse('q'))).toBe(true)
    expect(entails([parse('p → q'), parse('q')], parse('p'))).toBe(false)

    const countermodel = findCountermodel([parse('p → q'), parse('q')], parse('p'))
    expect(countermodel).toEqual({ p: false, q: true })
  })

  it('treats unsatisfiable premises as entailing anything', () => {
    expect(entails([parse('p'), parse('¬p')], parse('q'))).toBe(true)
  })

  it('spots fictitious variables', () => {
    // ((p → q) ∨ q) ∧ q is just q — p makes no difference to any row.
    const disguised = parse('((p → q) ∨ q) ∧ q')
    expect(dependsOn(disguised, 'q')).toBe(true)
    expect(dependsOn(disguised, 'p')).toBe(false)
    expect(dependsOnAllVariables(disguised)).toBe(false)

    expect(dependsOnAllVariables(parse('p ∧ q'))).toBe(true)
    expect(dependsOnAllVariables(parse('p ∨ (q ∧ ¬q)'))).toBe(false)
  })

  it('formats an assignment readably', () => {
    expect(showAssignment({ q: false, p: true })).toBe('p = T, q = F')
  })

  it('agrees with the truth table', () => {
    const formula = parse('(p → q) ∧ (q → r)')
    const table = truthTable(formula)
    expect(table.rows).toHaveLength(8)
    expect(table.rows.filter((row) => row.value)).toHaveLength(countModels(formula))
    expect(isSatisfiable(formula)).toBe(table.rows.some((row) => row.value))
  })
})

describe('truth tables', () => {
  it('counts up in binary with the leftmost variable flipping slowest', () => {
    expect(allAssignments(['p', 'q'])).toEqual([
      { p: false, q: false },
      { p: false, q: true },
      { p: true, q: false },
      { p: true, q: true },
    ])
  })

  it('can count down instead, for textbooks that print T first', () => {
    expect(allAssignments(['p', 'q'], { order: 'trueFirst' })).toEqual([
      { p: true, q: true },
      { p: true, q: false },
      { p: false, q: true },
      { p: false, q: false },
    ])
  })

  it('refuses tables too large to render', () => {
    const tooMany = Array.from({ length: 17 }, (_, i) => `p${i}`)
    expect(() => allAssignments(tooMany)).toThrow(RangeError)
  })

  it('fingerprints a formula by its result column', () => {
    expect(truthVector(parse('p ∧ q'))).toBe('0001')
    expect(truthVector(parse('p ∨ q'))).toBe('0111')
    expect(truthVector(parse('p → q'))).toBe('1101')
    expect(truthVector(parse('p ↔ q'))).toBe('1001')
  })
})
