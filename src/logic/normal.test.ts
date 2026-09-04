import { describe, expect, it } from 'vitest'
import { randomFormula } from './generate'
import {
  clauses,
  clauseSetToFormula,
  conjuncts,
  disjuncts,
  isCNF,
  isDNF,
  isTautologicalClause,
  showClauseSet,
  simplify,
  toCNF,
  toDNF,
  toNNF,
} from './normal'
import { parse } from './parse'
import { format } from './print'
import { makeRng } from './rng'
import { isEquivalent } from './semantics'
import type { Formula } from './ast'

/** ¬ may only sit directly on a variable in NNF. */
const negationsOnlyOnVariables = (f: Formula): boolean => {
  switch (f.kind) {
    case 'var':
    case 'const':
      return true
    case 'not':
      return f.arg.kind === 'var'
    default:
      return negationsOnlyOnVariables(f.left) && negationsOnlyOnVariables(f.right)
  }
}

describe('simplify', () => {
  it('folds constants and applies the identity laws', () => {
    expect(format(simplify(parse('p ∧ ⊤')))).toBe('p')
    expect(format(simplify(parse('p ∧ ⊥')))).toBe('⊥')
    expect(format(simplify(parse('p ∨ ⊤')))).toBe('⊤')
    expect(format(simplify(parse('p ∨ ⊥')))).toBe('p')
    expect(format(simplify(parse('¬¬p')))).toBe('p')
    expect(format(simplify(parse('⊤ → p')))).toBe('p')
    expect(format(simplify(parse('⊥ → p')))).toBe('⊤')
    expect(format(simplify(parse('p → p')))).toBe('⊤')
  })
})

describe('normal forms', () => {
  it('rewrites the textbook examples', () => {
    expect(format(toNNF(parse('¬(p ∧ q)')))).toBe('¬p ∨ ¬q')
    expect(format(toNNF(parse('¬(p → q)')))).toBe('p ∧ ¬q')
    expect(format(toCNF(parse('p ∨ (q ∧ r)')))).toBe('(p ∨ q) ∧ (p ∨ r)')
    expect(format(toDNF(parse('p ∧ (q ∨ r)')))).toBe('p ∧ q ∨ p ∧ r')
  })

  it('produces genuine normal forms that mean the same thing, for 200 random formulas', () => {
    const rng = makeRng('normal-forms')
    for (let i = 0; i < 200; i++) {
      const original = randomFormula(rng, { depth: 4 })

      const nnf = toNNF(original)
      expect(negationsOnlyOnVariables(nnf), `NNF of ${format(original)}`).toBe(true)
      expect(isEquivalent(nnf, original), `NNF of ${format(original)}`).toBe(true)

      const cnf = toCNF(original)
      expect(isCNF(cnf), `CNF of ${format(original)} was ${format(cnf)}`).toBe(true)
      expect(isEquivalent(cnf, original), `CNF of ${format(original)}`).toBe(true)

      const dnf = toDNF(original)
      expect(isDNF(dnf), `DNF of ${format(original)} was ${format(dnf)}`).toBe(true)
      expect(isEquivalent(dnf, original), `DNF of ${format(original)}`).toBe(true)
    }
  })

  it('flattens nested chains', () => {
    expect(conjuncts(parse('p ∧ q ∧ r'))).toHaveLength(3)
    expect(disjuncts(parse('p ∨ (q ∨ r)'))).toHaveLength(3)
    expect(conjuncts(parse('p ∨ q'))).toHaveLength(1)
  })
})

describe('clauses', () => {
  it('extracts a clause set', () => {
    expect(showClauseSet(clauses(parse('(p ∨ ¬q) ∧ (¬p ∨ r)')))).toBe('{{p, ¬q}, {¬p, r}}')
  })

  it('keeps an unsatisfiable formula as real clauses, for resolution to refute', () => {
    // p ∧ ¬p is two unit clauses. Deriving □ from them is the student's job,
    // not the converter's.
    expect(showClauseSet(clauses(parse('p ∧ ¬p')))).toBe('{{p}, {¬p}}')
    expect(showClauseSet(clauses(parse('p ∨ ¬p')))).toBe('{{p, ¬p}}')
  })

  it('represents ⊥ as the empty clause and ⊤ as the empty clause set', () => {
    expect(clauses(parse('p ∧ ⊥'))).toEqual([[]])
    expect(clauses(parse('p ∨ ⊤'))).toEqual([])
  })

  it('spots tautological clauses', () => {
    expect(isTautologicalClause([{ name: 'p', negated: false }, { name: 'p', negated: true }])).toBe(true)
    expect(isTautologicalClause([{ name: 'p', negated: false }, { name: 'q', negated: true }])).toBe(false)
  })

  it('round-trips through the clause representation, for 200 random formulas', () => {
    const rng = makeRng('clause-round-trip')
    for (let i = 0; i < 200; i++) {
      const original = randomFormula(rng, { depth: 4 })
      const rebuilt = clauseSetToFormula(clauses(original))
      expect(isEquivalent(rebuilt, original), format(original)).toBe(true)
    }
  })
})
