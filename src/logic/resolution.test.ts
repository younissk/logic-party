import { describe, expect, it } from 'vitest'

import { clauses, showClause, type Clause } from './normal'
import { parse } from './parse'
import { isSatisfiable } from './semantics'
import {
  allResolvents,
  clauseKey,
  components,
  findRefutation,
  isDerivable,
  normaliseClause,
  refutable,
  refutationCost,
  resolveOn,
  shortestRefutation,
  type Resolution,
  resolvents,
  saturate,
  sharedVariables,
} from './resolution'

const C = (source: string): Clause => clauses(parse(source))[0] as Clause
const S = (source: string): Clause[] => clauses(parse(source))
// Compare clause sets as sets of sets: literal order carries no meaning.
const show = (set: readonly Clause[]) => set.map((clause) => showClause(normaliseClause(clause))).sort()

describe('clauses are sets', () => {
  it('collapses duplicate literals', () => {
    expect(showClause(normaliseClause(C('a ∨ b ∨ a')))).toBe('{a, b}')
  })

  it('ignores order when comparing', () => {
    expect(clauseKey(C('a ∨ ¬b'))).toBe(clauseKey(C('¬b ∨ a')))
  })
})

describe('resolveOn', () => {
  it('deletes only the pivot pair', () => {
    expect(showClause(resolveOn(C('a ∨ b'), C('¬a ∨ c'), 'a') as Clause)).toBe('{b, c}')
  })

  it('returns null when the clauses do not clash on that variable', () => {
    expect(resolveOn(C('a ∨ b'), C('a ∨ c'), 'a')).toBeNull()
    expect(resolveOn(C('a ∨ b'), C('¬a ∨ c'), 'b')).toBeNull()
  })

  it('leaves a second clash in the result, making it a tautology', () => {
    // The rule cancels one pivot. The other pair survives — that is the point.
    expect(showClause(resolveOn(C('a ∨ ¬c'), C('¬a ∨ c'), 'a') as Clause)).toBe('{c, ¬c}')
  })

  it('gives the empty clause from two complementary units', () => {
    expect(showClause(resolveOn(C('a'), C('¬a'), 'a') as Clause)).toBe('□')
  })
})

describe('resolvents', () => {
  it('gives one resolvent per clashing variable, never a combined one', () => {
    const pair = resolvents(C('a ∨ ¬c'), C('¬a ∨ c'))
    expect(pair.map((step) => step.pivot).sort()).toEqual(['a', 'c'])
    // Cancelling both at once would give the empty clause. It is not a step.
    expect(show(pair.map((step) => step.resolvent))).toEqual(['{c, ¬c}', '{a, ¬a}'].sort())
  })

  it('gives nothing when there is no shared variable', () => {
    expect(resolvents(C('a ∨ b'), C('c ∨ d'))).toEqual([])
  })
})

describe('the exam question', () => {
  /**
   * exam25a Q1.1b — find all resolvents of the three clauses, tautological
   * ones included. Three resolvents, two of them tautologies, which is exactly
   * what the "one pivot per step" rule predicts.
   */
  const c1 = C('a ∨ b ∨ ¬c')
  const c2 = C('¬a ∨ d ∨ ¬e ∨ c')
  const c3 = C('¬d ∨ f')

  it('finds all three resolvents', () => {
    const found = allResolvents([c1, c2, c3])
    expect(found).toHaveLength(3)
    expect(show(found.map((step) => step.resolvent))).toEqual(
      show([C('b ∨ ¬c ∨ d ∨ ¬e ∨ c'), C('a ∨ b ∨ ¬a ∨ d ∨ ¬e'), C('¬a ∨ ¬e ∨ c ∨ f')]),
    )
  })

  it('finds no resolvent for the pair with no shared variable', () => {
    expect(sharedVariables(c1, c3)).toEqual([])
    expect(resolvents(c1, c3)).toEqual([])
  })
})

describe('components', () => {
  it('splits a set that shares no variables', () => {
    // exam26a Q1.1 — an xyz half and an abcd half that can never be mixed.
    const set = S(
      '(z) ∧ (¬x ∨ ¬y) ∧ (x ∨ ¬y ∨ ¬z) ∧ (x ∨ y ∨ ¬z) ∧ (x ∨ y ∨ z) ∧ (¬x ∨ ¬z) ∧ (a ∨ b ∨ c ∨ d) ∧ (¬a ∨ ¬b)',
    )
    const groups = components(set)
    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.length).sort()).toEqual([2, 6])
  })

  it('keeps a connected set in one piece', () => {
    expect(components(S('(a ∨ b) ∧ (¬b ∨ c)'))).toHaveLength(1)
  })
})

describe('refutation completeness', () => {
  const cases = [
    'a ∧ ¬a',
    '(a ∨ b) ∧ ¬a ∧ ¬b',
    '(z) ∧ (¬x ∨ ¬y) ∧ (x ∨ ¬y ∨ ¬z) ∧ (x ∨ y ∨ ¬z) ∧ (x ∨ y ∨ z) ∧ (¬x ∨ ¬z)',
    '(a ∨ b) ∧ (¬a ∨ c)',
    '(p ∨ q) ∧ (¬p ∨ q) ∧ (p ∨ ¬q) ∧ (¬p ∨ ¬q)',
    'a',
  ]

  /** The property that makes resolution worth anything. */
  it.each(cases)('reaches ⊥ from %s exactly when it is unsatisfiable', (source) => {
    const formula = parse(source)
    expect(refutable(clauses(formula))).toBe(!isSatisfiable(formula))
  })

  it.each(cases)('produces a refutation for %s exactly when one exists', (source) => {
    const formula = parse(source)
    const refutation = findRefutation(clauses(formula))
    expect(refutation !== null).toBe(!isSatisfiable(formula))
  })

  it('every step of a refutation is a legal resolution ending in ⊥', () => {
    const set = S('(z) ∧ (¬x ∨ ¬y) ∧ (x ∨ ¬y ∨ ¬z) ∧ (x ∨ y ∨ ¬z) ∧ (x ∨ y ∨ z) ∧ (¬x ∨ ¬z)')
    const refutation = findRefutation(set) as ReturnType<typeof findRefutation> & object[]

    const available = set.map(clauseKey)
    for (const step of refutation) {
      expect(available).toContain(clauseKey(step.left))
      expect(available).toContain(clauseKey(step.right))
      expect(clauseKey(resolveOn(step.left, step.right, step.pivot) as Clause)).toBe(
        clauseKey(step.resolvent),
      )
      available.push(clauseKey(step.resolvent))
    }
    expect(clauseKey(refutation[refutation.length - 1]?.resolvent as Clause)).toBe('')
  })
})

describe('isDerivable', () => {
  /**
   * exam26a Q1.1 — the four checkbox answers, and the reasoning behind each.
   */
  const xyz = S('(z) ∧ (¬x ∨ ¬y) ∧ (x ∨ ¬y ∨ ¬z) ∧ (x ∨ y ∨ ¬z) ∧ (x ∨ y ∨ z) ∧ (¬x ∨ ¬z)')
  const abcd = S('(a ∨ b ∨ c ∨ d) ∧ (¬a ∨ ¬b)')
  const whole = [...xyz, ...abcd]

  it('derives the empty clause, because the xyz half is unsatisfiable', () => {
    expect(isDerivable(whole, [])).toBe(true)
  })

  it('derives (x)', () => {
    expect(isDerivable(whole, C('x'))).toBe(true)
  })

  it('cannot derive (c ∨ d): every route to it goes through a tautology', () => {
    expect(isDerivable(whole, C('c ∨ d'))).toBe(false)
  })

  it('cannot derive a clause mixing the two components', () => {
    expect(isDerivable(whole, C('a ∨ b ∨ c ∨ x'))).toBe(false)
  })

  /** The exam26bA variant flips (z) to (¬z), and the answers invert. */
  const flipped = [
    ...S('(¬z) ∧ (¬x ∨ ¬y) ∧ (x ∨ ¬y ∨ ¬z) ∧ (x ∨ y ∨ ¬z) ∧ (x ∨ y ∨ z) ∧ (¬x ∨ ¬z)'),
    ...abcd,
  ]

  it('does not reach ⊥ once (z) becomes (¬z)', () => {
    expect(isDerivable(flipped, [])).toBe(false)
    expect(
      isSatisfiable(
        parse('(¬z) ∧ (¬x ∨ ¬y) ∧ (x ∨ ¬y ∨ ¬z) ∧ (x ∨ y ∨ ¬z) ∧ (x ∨ y ∨ z) ∧ (¬x ∨ ¬z)'),
      ),
    ).toBe(true)
  })

  it('cannot derive (x) in the flipped variant — it is not even implied', () => {
    expect(isDerivable(flipped, C('x'))).toBe(false)
  })

  it('derives (x ∨ y) in the flipped variant', () => {
    expect(isDerivable(flipped, C('x ∨ y'))).toBe(true)
  })
})

describe('saturate', () => {
  it('records how deep each clause was first reached', () => {
    const derived = saturate(S('(a ∨ b) ∧ (¬a ∨ b) ∧ (a ∨ ¬b) ∧ (¬a ∨ ¬b)'))
    expect(derived.filter((entry) => entry.depth === 0)).toHaveLength(4)
    expect(derived.some((entry) => clauseKey(entry.clause) === '')).toBe(true)
  })

  it('drops tautologies rather than resolving on them', () => {
    // Resolution stays refutation complete without them, and a valid clause
    // constrains nothing.
    const derived = saturate([C('a ∨ ¬a'), C('b')])
    expect(derived.map((entry) => showClause(entry.clause))).toEqual(['{b}'])
  })
})

describe('refutationCost', () => {
  it('produces a real refutation, never longer than the reconstruction', () => {
    for (const source of [
      'a ∧ ¬a',
      '(a ∨ b) ∧ ¬a ∧ ¬b',
      '(¬x ∨ ¬y ∨ ¬z) ∧ (x) ∧ (¬x ∨ y) ∧ (z) ∧ (¬y)',
      '(z) ∧ (¬x ∨ ¬y) ∧ (x ∨ ¬y ∨ ¬z) ∧ (x ∨ y ∨ ¬z) ∧ (x ∨ y ∨ z) ∧ (¬x ∨ ¬z)',
      '(p ∨ q) ∧ (¬p ∨ q) ∧ (p ∨ ¬q) ∧ (¬p ∨ ¬q)',
    ]) {
      const set = S(source)
      const short = shortestRefutation(set) as Resolution[]
      const found = findRefutation(set) as { length: number }
      expect(short.length, source).toBeLessThanOrEqual(found.length)
      expect(short.length, source).toBeGreaterThan(0)

      // And it really is a derivation: every step legal, ending in □.
      const available = set.map(clauseKey)
      for (const step of short) {
        expect(available, source).toContain(clauseKey(step.left))
        expect(available, source).toContain(clauseKey(step.right))
        expect(clauseKey(resolveOn(step.left, step.right, step.pivot) as Clause)).toBe(
          clauseKey(step.resolvent),
        )
        available.push(clauseKey(step.resolvent))
      }
      expect(available, source).toContain('')
    }
  })

  it('finds the two-step route the reconstruction misses', () => {
    // (x) with (¬x ∨ y) gives (y); (y) with (¬y) gives □. Two steps, and the
    // derivation saturation happens to record is longer.
    const set = S('(¬x ∨ ¬y ∨ ¬z) ∧ (x) ∧ (¬x ∨ y) ∧ (z) ∧ (¬y)')
    expect(refutationCost(set)).toBe(2)
  })

  it('is null exactly when the set is satisfiable', () => {
    expect(refutationCost(S('(a ∨ b) ∧ (¬a ∨ c)'))).toBeNull()
    expect(refutationCost(S('a ∧ ¬a'))).not.toBeNull()
  })
})
