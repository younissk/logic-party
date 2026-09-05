import { describe, expect, it } from 'vitest'

import { parse } from './parse'
import { format } from './print'
import {
  applyCnfStep,
  clauses,
  cleanClauses,
  cnfPipeline,
  isCNF,
  isNNF,
  nextCnfStep,
  needsCleanup,
  showClause,
  showClauseSet,
  unitPropagate,
} from './normal'
import { countModels, countModelsOver, isEquivalent } from './semantics'

describe('nextCnfStep', () => {
  /** The order is the algorithm. Each of these is one rung of the ladder. */
  it.each([
    ['¬((a ↔ b) → c) ∨ (a ∧ c)', 'iff'],
    ['¬(((a → b) ∧ (b → a)) → c) ∨ (a ∧ c)', 'implies'],
    ['¬(¬((¬a ∨ b) ∧ (¬b ∨ a)) ∨ c) ∨ (a ∧ c)', 'nnf'],
    ['((¬a ∨ b) ∧ (¬b ∨ a) ∧ ¬c) ∨ (a ∧ c)', 'distribute'],
    ['(a ∨ ¬a) ∧ (b ∨ c)', 'clean'],
    ['(a ∨ b) ∧ (¬a ∨ c)', 'done'],
  ])('%s needs %s next', (source, step) => {
    expect(nextCnfStep(parse(source))).toBe(step)
  })

  it('puts ↔ before → even when both are present', () => {
    // The trap: → is visible and tempting, but ↔ turns into more of them.
    expect(nextCnfStep(parse('(a ↔ b) → c'))).toBe('iff')
  })

  it('puts pushing ¬ before distributing even when a ∧ sits inside a ∨', () => {
    // The other trap: there is a ∧ under a ∨, so distribution looks available,
    // but distributing now leaves ¬(a ∧ b) inside a clause, which is not a
    // clause.
    expect(nextCnfStep(parse('¬(a ∧ b) ∨ (c ∧ d)'))).toBe('nnf')
  })
})

describe('the pipeline', () => {
  const sources = [
    '¬((a ↔ b) → c) ∨ (a ∧ c)',
    '(a ∧ b) ∨ (c ∧ d)',
    'a ↔ (b ↔ c)',
    '¬(a → (b ∧ ¬c))',
    '(a ∨ ¬a) ∧ (b → b)',
    'a ∧ b',
  ]

  it.each(sources)('reaches CNF from %s', (source) => {
    const trace = cnfPipeline(parse(source))
    const last = trace.length === 0 ? parse(source) : (trace[trace.length - 1]?.result as never)
    expect(isCNF(last)).toBe(true)
    expect(nextCnfStep(last)).toBe('done')
  })

  it.each(sources)('every step of %s preserves meaning', (source) => {
    const original = parse(source)
    for (const { result } of cnfPipeline(original)) {
      expect(isEquivalent(original, result), format(result)).toBe(true)
    }
  })

  it.each(sources)('never repeats a step on %s', (source) => {
    const steps = cnfPipeline(parse(source)).map((entry) => entry.step)
    expect(new Set(steps).size).toBe(steps.length)
  })

  it('reproduces the worked example from the notes', () => {
    // Example 2.16 ends with exactly these four clauses after cleanup. Order
    // is not part of the answer — ∧ commutes, and the notes' order is one of
    // 24 — so compare them as the sets they are.
    const trace = cnfPipeline(parse('¬((a ↔ b) → c) ∨ (a ∧ c)'))
    const final = trace[trace.length - 1]?.result as never
    const asSet = (set: string[]) => [...set].sort()
    expect(asSet(clauses(final).map(showClause))).toEqual(
      asSet(['{¬b, a}', '{¬c, a}', '{¬a, b, c}', '{¬b, a, c}']),
    )
  })

  it('shows the exponential blowup the notes warn about', () => {
    // Example 2.18: three conjunctions give 2³ = 8 clauses.
    expect(clauses(parse('(a ∧ b) ∨ (c ∧ d) ∨ (e ∧ f)'))).toHaveLength(8)
  })

  it('leaves a step that does not apply as a no-op', () => {
    // Distributing before the negations are pushed in genuinely does nothing
    // useful, which is worth letting a player see rather than blocking.
    const stuck = parse('¬(a ∧ b) ∨ c')
    expect(format(applyCnfStep(stuck, 'implies'))).toBe(format(stuck))
  })
})

describe('cleanClauses', () => {
  it('drops tautological clauses and duplicate literals', () => {
    expect(showClauseSet(clauses(cleanClauses(parse('(a ∨ ¬a) ∧ (b ∨ c ∨ b)'))))).toBe('{{b, c}}')
  })

  it('collapses to ⊤ when every clause was a tautology', () => {
    expect(cleanClauses(parse('(a ∨ ¬a) ∧ (b ∨ ¬b)'))).toEqual({ kind: 'const', value: true })
  })

  it('leaves a clean CNF untouched', () => {
    expect(needsCleanup(parse('(a ∨ b) ∧ (¬a ∨ c)'))).toBe(false)
  })
})

describe('unitPropagate', () => {
  it('runs the exam question to fixpoint', () => {
    // exam25a Q1.1c: BCP on
    //   a ∧ (¬a∨c∨d) ∧ (¬a∨b∨¬c) ∧ (¬a∨¬c) ∧ (a∨b) ∧ (¬d∨e∨f)
    const result = unitPropagate(
      clauses(parse('a ∧ (¬a ∨ c ∨ d) ∧ (¬a ∨ b ∨ ¬c) ∧ (¬a ∨ ¬c) ∧ (a ∨ b) ∧ (¬d ∨ e ∨ f)')),
    )
    expect(result.conflict).toBe(false)
    // a is the unit; it forces ¬c, which makes (c ∨ d) into the unit d, which
    // forces e ∨ f to remain.
    expect(result.forced).toEqual([
      { name: 'a', value: true },
      { name: 'c', value: false },
      { name: 'd', value: true },
    ])
    expect(showClauseSet(result.remaining)).toBe('{{e, f}}')
  })

  it('reports a conflict when propagation empties a clause', () => {
    expect(unitPropagate(clauses(parse('a ∧ (¬a ∨ b) ∧ ¬b'))).conflict).toBe(true)
  })

  it('does nothing when there is no unit clause', () => {
    const input = clauses(parse('(a ∨ b) ∧ (¬a ∨ c)'))
    const result = unitPropagate(input)
    expect(result.forced).toEqual([])
    expect(result.remaining).toHaveLength(2)
  })

  it('never changes whether the clause set is satisfiable', () => {
    for (const source of [
      'a ∧ (¬a ∨ b) ∧ (¬b ∨ c)',
      '(a ∨ b) ∧ ¬a ∧ (¬b ∨ c) ∧ ¬c',
      'x ∧ ¬x',
      '(p ∨ q) ∧ (¬p ∨ q) ∧ (p ∨ ¬q)',
    ]) {
      const original = parse(source)
      const result = unitPropagate(clauses(original))
      const stillSatisfiable = !result.conflict && countModels(original) > 0
      expect(countModels(original) > 0).toBe(stillSatisfiable)
    }
  })
})

describe('countModelsOver', () => {
  it('answers the exam question', () => {
    // exam25a Q1.1a: a ∧ b ∧ (c ∨ d) ∧ (¬c ∨ d) over {a, b, c, d} has 2 models.
    expect(countModelsOver(parse('a ∧ b ∧ (c ∨ d) ∧ (¬c ∨ d)'), ['a', 'b', 'c', 'd'])).toBe(2)
  })

  it('answers the exercise question', () => {
    // Exercise 1: (¬a∨¬b∨¬c) ∧ (a∨c) ∧ (b∨d) ∧ (¬d∨¬a) ∧ (c∨¬b) over
    // {a, b, c, d} has 3 models.
    expect(
      countModelsOver(parse('(¬a ∨ ¬b ∨ ¬c) ∧ (a ∨ c) ∧ (b ∨ d) ∧ (¬d ∨ ¬a) ∧ (c ∨ ¬b)'), [
        'a',
        'b',
        'c',
        'd',
      ]),
    ).toBe(3)
  })

  it('doubles for every variable the formula never mentions', () => {
    expect(countModelsOver(parse('a ∨ b'), ['a', 'b'])).toBe(3)
    expect(countModelsOver(parse('a ∨ b'), ['a', 'b', 'c'])).toBe(6)
    expect(countModelsOver(parse('a ∨ b'), ['a', 'b', 'c', 'd'])).toBe(12)
  })

  it('refuses a variable set that does not cover the formula', () => {
    expect(() => countModelsOver(parse('a ∨ b'), ['a'])).toThrow(RangeError)
  })
})

describe('isNNF', () => {
  it.each([
    ['a ∧ ¬b', true],
    ['¬(a ∧ b)', false],
    ['¬¬a', false],
    ['a → b', false],
    ['a ↔ b', false],
    ['(a ∨ ¬b) ∧ (¬a ∨ c)', true],
  ])('%s', (source, expected) => {
    expect(isNNF(parse(source))).toBe(expected)
  })
})
