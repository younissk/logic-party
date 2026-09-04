import { describe, expect, it } from 'vitest'
import { and, equals, iff, implies, not, or, v, FALSE, TRUE } from './ast'
import { parse, ParseError, tryParse } from './parse'
import { format } from './print'
import { makeRng } from './rng'
import { randomFormula } from './generate'

describe('parse', () => {
  it('reads every dialect of every connective', () => {
    const expected = implies(and(v('p'), not(v('q'))), or(v('r'), v('p')))
    for (const source of [
      'p ∧ ¬q → r ∨ p',
      'p & ~q -> r | p',
      'p /\\ !q => r \\/ p',
      'p && !q -> r || p',
      'p and not q implies r or p',
    ]) {
      expect(equals(parse(source), expected), source).toBe(true)
    }
  })

  it('binds ¬ tighter than ∧, ∧ tighter than ∨, ∨ tighter than →, → tighter than ↔', () => {
    expect(equals(parse('¬p ∧ q'), and(not(v('p')), v('q')))).toBe(true)
    expect(equals(parse('p ∧ q ∨ r'), or(and(v('p'), v('q')), v('r')))).toBe(true)
    expect(equals(parse('p ∨ q → r'), implies(or(v('p'), v('q')), v('r')))).toBe(true)
    expect(equals(parse('p → q ↔ r'), iff(implies(v('p'), v('q')), v('r')))).toBe(true)
  })

  it('associates ∧ and ∨ left, → and ↔ right', () => {
    expect(equals(parse('p ∧ q ∧ r'), and(and(v('p'), v('q')), v('r')))).toBe(true)
    expect(equals(parse('p → q → r'), implies(v('p'), implies(v('q'), v('r'))))).toBe(true)
    expect(equals(parse('p ↔ q ↔ r'), iff(v('p'), iff(v('q'), v('r'))))).toBe(true)
  })

  it('reads constants but treats bare T and F as variable names', () => {
    expect(equals(parse('⊤'), TRUE)).toBe(true)
    expect(equals(parse('false'), FALSE)).toBe(true)
    expect(equals(parse('1 ∧ 0'), and(TRUE, FALSE))).toBe(true)
    expect(equals(parse('T ∧ F'), and(v('T'), v('F')))).toBe(true)
  })

  it('accepts brackets interchangeably with parentheses', () => {
    expect(equals(parse('[p ∨ q] ∧ r'), and(or(v('p'), v('q')), v('r')))).toBe(true)
  })

  it('accepts multi-character and subscripted variable names', () => {
    expect(equals(parse('rain ∧ p1'), and(v('rain'), v('p1')))).toBe(true)
    expect(equals(parse('p₁ ∨ p₂'), or(v('p₁'), v('p₂')))).toBe(true)
  })

  it('reports the position of a syntax error', () => {
    const result = tryParse('p ∧ ∧ q')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.position).toBe(4)
  })

  it.each([
    ['', 'Empty formula'],
    ['(p ∧ q', 'unclosed parenthesis'],
    ['p ∧', 'trailing connective'],
    ['p q', 'two formulas in a row'],
    ['p # q', 'unknown character'],
  ])('rejects %j (%s)', (source) => {
    expect(() => parse(source)).toThrow(ParseError)
  })

  it('round-trips: parse(format(f)) === f, for 300 random formulas', () => {
    const rng = makeRng('parser-round-trip')
    for (let i = 0; i < 300; i++) {
      const original = randomFormula(rng, { depth: 5, allowConstants: true })
      for (const notation of ['unicode', 'ascii'] as const) {
        const printed = format(original, { notation })
        expect(equals(parse(printed), original), printed).toBe(true)
      }
    }
  })
})
