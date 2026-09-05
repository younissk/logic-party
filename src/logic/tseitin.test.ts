import { describe, expect, it } from 'vitest'

import { and, iff, implies, isBinary, not, or, v, type Formula } from './ast'
import { parse } from './parse'
import { clauseSetToFormula, showClauseSet } from './normal'
import { isEquivalent, isSatisfiable } from './semantics'
import { definitionClauses, definitionClauseCount, tseitin } from './tseitin'

const a = v('a')
const b = v('b')

describe('definitionClauses', () => {
  /**
   * The clause table is written out by hand because those exact clause sets
   * are what the exam wants. This is what stops a typo in it from surviving:
   * every row has to actually mean t ↔ χ.
   */
  const bodies: [string, Formula][] = [
    ['¬a', not(a)],
    ['a ∨ b', or(a, b)],
    ['a ∧ b', and(a, b)],
    ['a → b', implies(a, b)],
    ['a ↔ b', iff(a, b)],
  ]

  it.each(bodies)('t ↔ (%s) is encoded exactly', (_label, body) => {
    const encoded = clauseSetToFormula(definitionClauses('t', body))
    expect(isEquivalent(encoded, iff(v('t'), body))).toBe(true)
  })

  it.each(bodies)('t ↔ (%s) keeps the signs of negated operands', (_label, body) => {
    // Substituting ¬a for a must flip the sign in the clauses, not just the
    // body — getting this backwards is the classic lost mark.
    const negatedOperands: Formula = isBinary(body)
      ? { kind: body.kind, left: not(a), right: b }
      : not(not(a))
    const encoded = clauseSetToFormula(definitionClauses('t', negatedOperands))
    expect(isEquivalent(encoded, iff(v('t'), negatedOperands))).toBe(true)
  })

  it('costs a constant number of clauses per definition', () => {
    expect(definitionClauseCount('iff')).toBe(4)
    expect(definitionClauseCount('not')).toBe(2)
    for (const kind of ['and', 'or', 'implies'] as const) {
      expect(definitionClauseCount(kind)).toBe(3)
    }
  })
})

describe('tseitin', () => {
  it('reproduces the course exercise exactly', () => {
    // Exercise 2: x ∨ ¬(y ∨ ¬(z ∨ x)) with definitions for (z ∨ x) and
    // (y ∨ ¬·), negation getting no definition of its own. The exercise says
    // seven clauses, and names the five it asks you to pick out.
    const result = tseitin(parse('x ∨ ¬(y ∨ ¬(z ∨ x))'), { prefix: 'q' })

    expect(result.clauses).toHaveLength(7)
    expect(result.definitions.map((d) => d.name)).toEqual(['q1', 'q2'])
    expect(showClauseSet(result.clauses)).toBe(
      '{{¬q1, z, x}, {¬z, q1}, {¬x, q1}, {¬q2, y, ¬q1}, {¬y, q2}, {q1, q2}, {x, ¬q2}}',
    )
  })

  it('reproduces the worked example from the notes', () => {
    // Example 2.20 introduces three definitions and ends with a two-literal
    // top-level clause: 4 + 3 + 3 + 1 = 11 clauses. The numbering differs —
    // which definition is called t1 is an arbitrary choice of the algorithm —
    // but the definitions and the count do not.
    const result = tseitin(parse('¬((a ↔ b) → c) ∨ (a ∧ c)'))
    expect(result.definitions).toHaveLength(3)
    expect(result.clauses).toHaveLength(11)
    expect(result.rootClauses).toHaveLength(1)
  })

  it('leaves a formula that is already CNF alone', () => {
    const cnf = parse('(a ∨ b) ∧ (¬a ∨ c)')
    const result = tseitin(cnf)
    expect(result.definitions).toHaveLength(0)
    expect(result.clauses).toHaveLength(2)
  })

  const cases = [
    'a ∨ ¬(b ∨ ¬(c ∨ a))',
    '¬((a ↔ b) → c) ∨ (a ∧ c)',
    '(a ∧ b) ∨ (c ∧ d)',
    '((a → b) ∧ (b → c)) ∨ ¬(a ∧ c)',
    'a ↔ (b ↔ c)',
    '¬¬(a ∧ ¬b)',
  ]

  it.each(cases)('is satisfiability equivalent to %s', (source) => {
    const original = parse(source)
    const result = clauseSetToFormula(tseitin(original).clauses)
    expect(isSatisfiable(result)).toBe(isSatisfiable(original))
  })

  /**
   * The stronger guarantee of Algorithm 2.19, and the one that makes the
   * transformation usable: a model of the CNF is a model of the original once
   * the fresh variables are dropped. Satisfiability equivalence alone would
   * not let you read an answer back out.
   */
  it.each(cases)('every model of the CNF is a model of %s', (source) => {
    const original = parse(source)
    const { clauses, definitions } = tseitin(original)
    const fresh = new Set(definitions.map((d) => d.name))
    const cnf = clauseSetToFormula(clauses)

    // ∀σ. cnf(σ) → original(σ), which is exactly "cnf entails original" once
    // the fresh variables are quantified away — and since `original` does not
    // mention them, entailment over the joint variable set says it.
    expect(isEquivalent(and(cnf, original), cnf)).toBe(true)
    expect([...fresh].every((name) => !source.includes(name))).toBe(true)
  })

  it('is not equivalent — that is the price of the linear size', () => {
    const original = parse('(a ∧ b) ∨ (c ∧ d)')
    const cnf = clauseSetToFormula(tseitin(original).clauses)
    expect(isSatisfiable(original)).toBe(isSatisfiable(cnf))
    expect(isEquivalent(original, cnf)).toBe(false)
  })

  it('grows linearly where naive distribution explodes', () => {
    // Example 2.18: three conjunctions naively give 2³ = 8 clauses, and the
    // exponent is the number of pairs. Tseitin pays a fixed price per gate.
    const explosive = parse('(a ∧ b) ∨ (c ∧ d) ∨ (e ∧ f)')
    expect(tseitin(explosive).clauses.length).toBeLessThan(16)

    const bigger = parse('(a ∧ b) ∨ (c ∧ d) ∨ (e ∧ f) ∨ (g ∧ h) ∨ (i ∧ j)')
    // Five pairs would be 2⁵ = 32 clauses naively; Tseitin stays proportional.
    expect(tseitin(bigger).clauses.length).toBeLessThan(24)
  })

  it('never reuses a name that is already taken', () => {
    const result = tseitin(parse('(a ∧ b) ∨ (c ∧ d)'), { taken: ['t1', 't2'] })
    expect(result.definitions.map((d) => d.name)).not.toContain('t1')
    expect(result.definitions.map((d) => d.name)).not.toContain('t2')
  })

  it('can give negations their own definitions when asked', () => {
    const source = parse('¬(a ∧ b) ∨ c')
    const withNames = tseitin(source, { defineNegations: true })
    expect(withNames.definitions.length).toBeGreaterThan(tseitin(source).definitions.length)
    expect(isSatisfiable(clauseSetToFormula(withNames.clauses))).toBe(isSatisfiable(source))
  })
})
