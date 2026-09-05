import { describe, expect, it } from 'vitest'

import { clauseSetToFormula, clauses, showClause, showClauseSet, type Clause } from './normal'
import { parse } from './parse'
import { isSatisfiable } from './semantics'
import { bcp } from './solving'
import {
  bce,
  blockingLiteral,
  checkRupProof,
  findRupProof,
  hasRupProperty,
  isBlockedOn,
  negateClause,
  pureLiterals,
} from './certificates'

const S = (source: string): Clause[] => clauses(parse(source))
const C = (source: string): Clause => clauses(parse(source))[0] as Clause

describe('negateClause', () => {
  it('turns one clause into that many unit clauses', () => {
    // The one bit of notation to get right: ¬(a ∨ ¬b) is (¬a) ∧ (b).
    expect(showClauseSet(negateClause(C('a ∨ ¬b')))).toBe('{{¬a}, {b}}')
  })

  it('negates the empty clause into nothing at all', () => {
    expect(negateClause([])).toEqual([])
  })
})

describe('hasRupProperty', () => {
  it('matches the example from the notes', () => {
    // Example 2.49: (a) has the property, (¬b) does not.
    const phi = S('(a ∨ b) ∧ (a ∨ ¬b) ∧ (b)')
    expect(hasRupProperty(phi, C('a'))).toBe(true)
    expect(hasRupProperty(phi, C('¬b'))).toBe(false)
  })

  it('holds for the empty clause exactly when BCP alone reaches ⊥', () => {
    // The special case: negating ⊥ adds no units, so this is plain propagation.
    for (const source of ['a ∧ ¬a', '(a ∨ b) ∧ ¬a ∧ ¬b', '(a ∨ b) ∧ (¬a ∨ c)', 'a ∧ (¬a ∨ b)']) {
      const set = S(source)
      expect(hasRupProperty(set, []), source).toBe(bcp(set).outcome === 'unsatisfiable')
    }
  })

  it('holds for any resolvent of two clauses', () => {
    // The notes' own example: (a ∨ b ∨ d) is RUP w.r.t. its two parents.
    expect(hasRupProperty(S('(a ∨ b ∨ c) ∧ (¬c ∨ d)'), C('a ∨ b ∨ d'))).toBe(true)
  })

  it('never lets an unsatisfiable-making clause through', () => {
    // Theorem 2.48: adding a RUP clause preserves satisfiability.
    for (const source of ['(a ∨ b) ∧ (¬a ∨ c)', '(p ∨ q) ∧ (¬p ∨ q)', 'a ∧ (¬a ∨ b)']) {
      const set = S(source)
      const satisfiable = isSatisfiable(parse(source))
      for (const candidate of [C('a'), C('¬a'), C('b'), C('¬b'), C('a ∨ b')]) {
        if (!hasRupProperty(set, candidate)) continue
        const extended = [...set, candidate]
        expect(
          extended.some((clause) => clause.length === 0) ? false : isSatisfiable(parse(source)),
          `${source} + ${showClause(candidate)}`,
        ).toBe(satisfiable)
      }
    }
  })
})

describe('RUP refutations', () => {
  it('checks the exam proof', () => {
    // exam26a Q1.3 — the proof is (¬a), then ⊥.
    const phi = S('(¬a ∨ b) ∧ (¬a ∨ ¬b) ∧ (a ∨ ¬c) ∧ (a ∨ c)')
    const proof: Clause[] = [C('¬a'), []]
    expect(checkRupProof(phi, proof)).toEqual({ ok: true, failedAt: null, endsInEmpty: true })
  })

  it('rejects a line propagation does not refute', () => {
    // Satisfiable, so nothing is going to crash: assuming ¬a leaves {b} and
    // BCP simply stops.
    const phi = S('(a ∨ b) ∧ (¬a ∨ c)')
    expect(hasRupProperty(phi, C('a'))).toBe(false)
    expect(checkRupProof(phi, [C('a'), []]).failedAt).toBe(0)
  })

  it('rejects a proof that does not end in ⊥', () => {
    const phi = S('(¬a ∨ b) ∧ (¬a ∨ ¬b) ∧ (a ∨ ¬c) ∧ (a ∨ c)')
    expect(checkRupProof(phi, [C('¬a')]).ok).toBe(false)
  })

  it('checks the refutation from the notes', () => {
    // Example 2.51: the learned clauses of Example 2.45 form a RUP refutation,
    // and so does the alternative sequence the notes also give.
    const phi = S('(a ∨ b ∨ c) ∧ (a ∨ ¬b ∨ c) ∧ (a ∨ b ∨ ¬c) ∧ (a ∨ ¬b ∨ ¬c) ∧ (¬a ∨ c) ∧ (¬a ∨ ¬c)')
    expect(checkRupProof(phi, [C('a ∨ b'), C('a'), []]).ok).toBe(true)
    expect(checkRupProof(phi, [C('¬a'), C('b'), []]).ok).toBe(true)
  })

  it('finds a proof exactly when the formula is unsatisfiable', () => {
    for (const source of [
      '(¬a ∨ b) ∧ (¬a ∨ ¬b) ∧ (a ∨ ¬c) ∧ (a ∨ c)',
      '(a ∨ b ∨ c) ∧ (a ∨ ¬b ∨ c) ∧ (a ∨ b ∨ ¬c) ∧ (a ∨ ¬b ∨ ¬c) ∧ (¬a ∨ c) ∧ (¬a ∨ ¬c)',
      'a ∧ ¬a',
      '(p ∨ q) ∧ (¬p ∨ q) ∧ (p ∨ ¬q) ∧ (¬p ∨ ¬q)',
      '(a ∨ b) ∧ (¬a ∨ c)',
    ]) {
      const set = S(source)
      const proof = findRupProof(set)
      expect(proof !== null, source).toBe(!isSatisfiable(parse(source)))
      if (proof !== null) expect(checkRupProof(set, proof).ok, source).toBe(true)
    }
  })

  it('finds the exam proof in two lines', () => {
    const proof = findRupProof(S('(¬a ∨ b) ∧ (¬a ∨ ¬b) ∧ (a ∨ ¬c) ∧ (a ∨ c)')) as Clause[]
    expect(proof).toHaveLength(2)
    expect(showClause(proof[1] as Clause)).toBe('□')
  })
})

describe('blocked clauses', () => {
  it('recognises the non-vacuous case', () => {
    // (a ∨ b) blocked on a: the only clause with ¬a is (¬a ∨ ¬b), and the
    // resolvent (b ∨ ¬b) is a tautology.
    const phi = S('(a ∨ b) ∧ (¬a ∨ ¬b) ∧ (b ∨ c)')
    expect(isBlockedOn(phi, C('a ∨ b'), { name: 'a', negated: false })).toBe(true)
  })

  it('a pure literal blocks vacuously', () => {
    const phi = S('(c ∨ f) ∧ (¬c ∨ g) ∧ (a ∨ e)')
    expect(pureLiterals(phi).map((l) => `${l.negated ? '¬' : ''}${l.name}`).sort()).toEqual(
      ['a', 'e', 'f', 'g'].sort(),
    )
    expect(isBlockedOn(phi, C('c ∨ f'), { name: 'f', negated: false })).toBe(true)
  })

  it('says no when a resolvent is not a tautology', () => {
    const phi = S('(a ∨ b) ∧ (¬a ∨ c)')
    // Res_a gives (b ∨ c), which is not a tautology.
    expect(isBlockedOn(phi, C('a ∨ b'), { name: 'a', negated: false })).toBe(false)
  })

  it('runs the exam question to the empty formula', () => {
    // exam25a Q1.3 — every step is a pure literal.
    const run = bce(S('(a ∨ b ∨ c ∨ d) ∧ (¬a ∨ b ∨ ¬c) ∧ (a ∨ e) ∧ (¬a ∨ e) ∧ (c ∨ f) ∧ (¬c ∨ g)'))
    expect(run.complete).toBe(true)
    expect(run.steps).toHaveLength(6)
    expect(run.steps.every((step) => step.pure)).toBe(true)
  })

  it('runs the example from the notes to the empty formula', () => {
    // Example 2.35, where removing one clause unblocks the next.
    const run = bce(S('(a ∨ b ∨ ¬d) ∧ (¬b ∨ ¬d ∨ ¬e) ∧ (b ∨ d ∨ e) ∧ (¬b ∨ d) ∧ (d)'))
    expect(run.complete).toBe(true)
    expect(run.steps).toHaveLength(5)
  })

  it('never eliminates everything from an unsatisfiable formula', () => {
    // Removal preserves satisfiability, so reaching the empty formula would
    // claim an unsatisfiable formula is satisfiable.
    for (const source of [
      'a ∧ ¬a',
      '(p ∨ q) ∧ (¬p ∨ q) ∧ (p ∨ ¬q) ∧ (¬p ∨ ¬q)',
      '(¬a ∨ b) ∧ (¬a ∨ ¬b) ∧ (a ∨ ¬c) ∧ (a ∨ c)',
    ]) {
      expect(bce(S(source)).complete, source).toBe(false)
    }
  })

  it('preserves satisfiability at every step', () => {
    // Theorem 2.34, checked on the intermediate formulas rather than assumed.
    for (const source of [
      '(a ∨ b ∨ c ∨ d) ∧ (¬a ∨ b ∨ ¬c) ∧ (a ∨ e) ∧ (¬a ∨ e) ∧ (c ∨ f) ∧ (¬c ∨ g)',
      '(a ∨ b ∨ ¬d) ∧ (¬b ∨ ¬d ∨ ¬e) ∧ (b ∨ d ∨ e) ∧ (¬b ∨ d) ∧ (d)',
      '(a ∨ b) ∧ (¬a ∨ ¬b) ∧ (b ∨ c)',
      'a ∧ ¬a',
      '(p ∨ q) ∧ (¬p ∨ q) ∧ (p ∨ ¬q) ∧ (¬p ∨ ¬q)',
    ]) {
      const before = isSatisfiable(parse(source))
      for (const step of bce(S(source)).steps) {
        const after = step.result.length === 0 ? true : isSatisfiable(clauseSetToFormula(step.result))
        expect(after, `${source} after removing ${showClause(step.clause)}`).toBe(before)
      }
    }
  })

  it('every removal really was blocked, at the moment it was removed', () => {
    // Re-derived against the formula as it stood before that step, because a
    // clause that was not blocked can become blocked once another one goes.
    for (const source of [
      '(a ∨ b) ∧ (¬a ∨ ¬b) ∧ (b ∨ c)',
      '(a ∨ b ∨ ¬d) ∧ (¬b ∨ ¬d ∨ ¬e) ∧ (b ∨ d ∨ e) ∧ (¬b ∨ d) ∧ (d)',
      '(a ∨ b ∨ c ∨ d) ∧ (¬a ∨ b ∨ ¬c) ∧ (a ∨ e) ∧ (¬a ∨ e) ∧ (c ∨ f) ∧ (¬c ∨ g)',
    ]) {
      let current = S(source)
      for (const step of bce(S(source)).steps) {
        expect(isBlockedOn(current, step.clause, step.literal), showClause(step.clause)).toBe(true)
        expect(blockingLiteral(current, step.clause)).not.toBeNull()
        current = step.result
      }
    }
  })

  it('unblocking really happens — blocked on a literal it was not blocked on before', () => {
    // Example 2.35 turns on exactly this. The notes' parenthetical is about the
    // *literal*: (¬b ∨ ¬d ∨ ¬e) is blocked on ¬b in φ₁ and was not in φ.
    const phi = S('(a ∨ b ∨ ¬d) ∧ (¬b ∨ ¬d ∨ ¬e) ∧ (b ∨ d ∨ e) ∧ (¬b ∨ d) ∧ (d)')
    const later = C('¬b ∨ ¬d ∨ ¬e')
    const notB = { name: 'b', negated: true }

    expect(isBlockedOn(phi, later, notB)).toBe(false)
    const phi1 = phi.filter((clause) => !clause.some((literal) => literal.name === 'a'))
    expect(isBlockedOn(phi1, later, notB)).toBe(true)
  })
})
