import { describe, expect, it } from 'vitest'
import {
  allVariables,
  boundVariables,
  clean,
  freeVariables,
  isClean,
  isClosed,
  isGroundAtom,
  isLiteralFormula,
  parseFormula,
  showFormula,
  type FoSignature,
} from './fol'
import { evaluateFormula, holdsIn, makeStructure } from './foSemantics'

const SIG: FoSignature = {
  predicates: { p: 1, q: 3, r: 2, s: 1, t: 2 },
  functions: { a: 0, b: 0, c: 0, f: 1, g: 1, h: 1 },
}
const F = (source: string, signature: FoSignature = SIG) => parseFormula(source, signature)

describe('parsing and printing', () => {
  it('round-trips the notes’ own formulas', () => {
    const weekdays: FoSignature = {
      predicates: { weekend: 1, before: 2 },
      functions: { monday: 0, next: 1 },
    }
    for (const source of [
      '¬∀x:weekend(x)',
      '∀x:(weekend(x)→∃y:before(y,x))',
      '∀x:(weekend(x)→¬weekend(next(next(x))))',
      '∀x:before(monday(),x)',
    ]) {
      expect(showFormula(parseFormula(source, weekdays))).toBe(source)
    }
  })

  it('accepts the exercises’ dot separator and ASCII connectives', () => {
    expect(showFormula(F('∀x.(p(x) -> p(x))'))).toBe('∀x:(p(x)→p(x))')
    expect(showFormula(F('~p(a())'))).toBe('¬p(a())')
  })

  it('lets a run of quantifiers share one separator', () => {
    expect(showFormula(F('∃x∀y∃z:q(x,y,z)'))).toBe('∃x:∀y:∃z:q(x,y,z)')
  })

  it('refuses a predicate at the wrong arity, and a term where a formula goes', () => {
    expect(() => F('p(x,y)')).toThrow()
    expect(() => F('p(p(x))')).toThrow()
  })

  it('gives a quantifier the widest scope it can have', () => {
    // ∀x:(p(x)∧p(a())), foNot (∀x:p(x))∧p(a()).
    expect(showFormula(F('∀x:p(x)∧p(a())'))).toBe('∀x:(p(x)∧p(a()))')
  })
})

describe('the vocabulary of Exercise 7', () => {
  // Φ = ∃x:(¬s(x) ∧ ∀y:t(y,x)) ∧ s(a())
  const PHI = F('∃x:(¬s(x)∧∀y:t(y,x))∧s(a())')

  it('knows an atom from a literal from a ground atom', () => {
    expect(isLiteralFormula(F('t(y,x)'))).toBe(true)
    expect(isGroundAtom(F('s(a())'))).toBe(true)
    expect(isGroundAtom(F('s(x)'))).toBe(false)
    expect(isLiteralFormula(F('∀y:t(y,x)'))).toBe(false)
  })

  it('agrees with the exercise on what is bound and what is closed', () => {
    expect(boundVariables(PHI).sort()).toEqual(['x', 'y'])
    expect(freeVariables(PHI)).toEqual([])
    expect(isClosed(PHI)).toBe(true)
  })

  it('sees a variable that is both free and bound', () => {
    const both = F('p(x)∨∃x:p(x)')
    expect(freeVariables(both)).toEqual(['x'])
    expect(boundVariables(both)).toEqual(['x'])
    expect(isClean(both)).toBe(false)
  })

  it('calls a doubly quantified variable unclean', () => {
    expect(isClean(F('(∀x:p(x))∨(∃x:s(x))'))).toBe(false)
    expect(isClean(F('∃x:∀x:p(x)'))).toBe(false)
    expect(isClean(F('∀x:(p(x)→∃y:r(x,y))'))).toBe(true)
  })
})

describe('cleaning', () => {
  it('makes the notes’ stuck example clean', () => {
    const stuck = F('(∀x:p(x))∨(∀x:s(x))')
    expect(isClean(stuck)).toBe(false)
    const cleaned = clean(stuck)
    expect(isClean(cleaned)).toBe(true)
    expect(allVariables(cleaned)).toHaveLength(2)
  })

  it('leaves an already clean formula alone', () => {
    const fine = F('∀x:(p(x)→∃y:r(x,y))')
    expect(showFormula(clean(fine))).toBe(showFormula(fine))
  })

  it('does foNot capture a free variable', () => {
    const mixed = F('p(x)∨∃x:p(x)')
    const cleaned = clean(mixed)
    expect(isClean(cleaned)).toBe(true)
    expect(freeVariables(cleaned)).toEqual(['x'])
  })
})

describe('Exercise 7 question 2, in the structure it gives', () => {
  // U = {0,1,2,3}; a=0, b=1; f(x)=1 if x=1 else 2; g(x)=(x+2)%4;
  // p(x) iff x=0; q(x) iff x>=2; r(x,y) iff x<y.
  const structure = makeStructure({
    size: 4,
    functions: {
      a: { arity: 0, value: () => 0 },
      b: { arity: 0, value: () => 1 },
      f: { arity: 1, value: ([x]) => ((x as number) === 1 ? 1 : 2) },
      g: { arity: 1, value: ([x]) => ((x as number) + 2) % 4 },
    },
    predicates: {
      p: { arity: 1, value: ([x]) => x === 0 },
      q: { arity: 1, value: ([x]) => (x as number) >= 2 },
      r: { arity: 2, value: ([x, y]) => (x as number) < (y as number) },
    },
  })

  const sig: FoSignature = {
    predicates: { p: 1, q: 1, r: 2 },
    functions: { a: 0, b: 0, f: 1, g: 1 },
  }
  const holds = (source: string) => holdsIn(structure, parseFormula(source, sig))

  it('marks exactly the six the exercise marks', () => {
    const answers: [string, boolean][] = [
      ['p(f(a()))∨¬q(g(b()))', false],
      ['r(a(),g(a()))', true],
      ['∀x:(p(x)∨q(x))', false],
      ['∀x:(p(x)→p(g(g(x))))', true],
      ['∃x:∀y:r(x,y)', false],
      ['p(f(a()))∧¬p(f(a()))', false],
      ['r(a(),b())', true],
      ['∀x:(q(f(x))∨q(g(x)))', true],
      ['p(b())', false],
      ['∃x:(p(x)∨∃y:r(x,y))', true],
      ['∃x:(q(x)∧¬q(g(g(x))))', false],
      ['∃x:∀y:(r(x,y)∨r(g(x),y)∨r(x,g(y)))', true],
    ]
    for (const [source, expected] of answers) {
      expect([source, holds(source)]).toEqual([source, expected])
    }
  })

  it('evaluates a quantifier as a loop over the universe', () => {
    // ∀x:p(x) is false because p only holds at 0.
    expect(evaluateFormula(structure, {}, parseFormula('∀x:p(x)', sig))).toBe(false)
    expect(evaluateFormula(structure, {}, parseFormula('∃x:p(x)', sig))).toBe(true)
  })

  it('lets an assignment decide a formula with a free variable', () => {
    const free = parseFormula('p(x)', sig)
    expect(evaluateFormula(structure, { x: 0 }, free)).toBe(true)
    expect(evaluateFormula(structure, { x: 1 }, free)).toBe(false)
  })
})
