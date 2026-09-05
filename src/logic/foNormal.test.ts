import { describe, expect, it } from 'vitest'
import { parseFormula, showFormula, type FoSignature } from './fol'
import {
  clausify,
  clausesOfMatrix,
  isPrenex,
  pnfOptions,
  showFoClause,
  showFoClauseSet,
  skolemize,
  splitPrenex,
  toPrenex,
  toSkolemNormalForm,
} from './foNormal'
import { holdsIn, makeStructure } from './foSemantics'

const SIG: FoSignature = {
  predicates: { p: 2, q: 3, r: 1, s: 1 },
  functions: { a: 0, c: 0, f: 1, g: 2 },
}
const F = (source: string, signature: FoSignature = SIG) => parseFormula(source, signature)

describe('prenex normal form — Algorithm 4.12', () => {
  // Example 4.14's formula.
  // The notes print this as ∀x∃y:(∃z:(p(x,z)∨p(y,z)) → ¬∀z:¬q(x,y,z)); the
  // brackets around the antecedent are explicit here because a quantifier's
  // scope otherwise runs as far right as it can.
  const PHI = F('∀x:∃y:((∃z:(p(x,z)∨p(y,z)))→¬∀z:¬q(x,y,z))')

  it('reaches a prenex form', () => {
    const { result } = toPrenex(PHI)
    expect(isPrenex(result)).toBe(true)
  })

  it('produces the notes’ own prefix', () => {
    const { result } = toPrenex(PHI)
    const { prefix } = splitPrenex(result)
    // ∀x∃y∀z∃u — four quantifiers, alternating as the notes have it.
    expect(prefix.map((entry) => entry.quantifier)).toEqual([
      'forall',
      'exists',
      'forall',
      'exists',
    ])
  })

  it('flips a quantifier on the left of an implication', () => {
    const { result } = toPrenex(F('(∀x:r(x))→s(a())'))
    expect(splitPrenex(result).prefix[0]?.quantifier).toBe('exists')
    const other = toPrenex(F('(∃x:r(x))→s(a())'))
    expect(splitPrenex(other.result).prefix[0]?.quantifier).toBe('forall')
  })

  it('pushes a negation through a quantifier', () => {
    expect(showFormula(toPrenex(F('¬∀x:r(x)')).result)).toBe('∃x:¬r(x)')
    expect(showFormula(toPrenex(F('¬∃x:r(x)')).result)).toBe('∀x:¬r(x)')
  })

  it('cleans first, so the notes’ stuck example goes through', () => {
    // ∀x:p(x)∨∀x:q(x) cannot be prenexed without renaming.
    const stuck = F('(∀x:r(x))∨(∀x:s(x))')
    const { result } = toPrenex(stuck)
    expect(isPrenex(result)).toBe(true)
    expect(splitPrenex(result).prefix).toHaveLength(2)
  })

  it('offers more than one order, which is why there are several PNFs', () => {
    // Somewhere in the run there is a choice; Example 4.14 exploits it.
    const options = pnfOptions(F('∀x:∃y:((∃z:(p(x,z)∨p(y,z)))→¬∀z:¬q(x,y,z))'))
    expect(options.length).toBeGreaterThan(0)
    const many = pnfOptions(F('(∃x:r(x))→(∃y:s(y))'))
    expect(many.length).toBeGreaterThan(1)
  })

  it('preserves truth in a finite structure — PNF is an equivalence', () => {
    const structure = makeStructure({
      size: 3,
      functions: { a: { arity: 0, value: () => 0 }, f: { arity: 1, value: ([x]) => ((x as number) + 1) % 3 } },
      predicates: {
        r: { arity: 1, value: ([x]) => x === 0 },
        s: { arity: 1, value: ([x]) => (x as number) > 0 },
      },
    })
    const sig: FoSignature = { predicates: { r: 1, s: 1 }, functions: { a: 0, f: 1 } }
    for (const source of [
      '(∀x:r(x))→s(a())',
      '¬∀x:(r(x)∨s(x))',
      '(∃x:r(x))∧(∀y:s(y))',
      '∀x:(r(x)→∃y:s(f(y)))',
    ]) {
      const original = parseFormula(source, sig)
      const prenex = toPrenex(original).result
      expect([source, holdsIn(structure, prenex)]).toEqual([source, holdsIn(structure, original)])
    }
  })
})

describe('Skolemization', () => {
  it('turns a leading ∃ into a constant', () => {
    const { result, steps } = skolemize(toPrenex(F('∃x:r(x)')).result)
    expect(showFormula(result)).toMatch(/^r\(f1\(\)\)$/)
    expect(steps[0]?.dependsOn).toEqual([])
  })

  it('gives a Skolem function one argument per ∀ to its left', () => {
    const { result, steps } = skolemize(toPrenex(F('∀x:∃y:p(x,y)')).result)
    expect(showFormula(result)).toBe('∀x:p(x,f1(x))')
    expect(steps[0]?.dependsOn).toEqual(['x'])
  })

  it('leaves a ∀ behind an ∃ alone', () => {
    const { result } = skolemize(toPrenex(F('∃x:∀y:p(x,y)')).result)
    expect(showFormula(result)).toBe('∀y:p(f1(),y)')
  })

  it('solves Exercise 8 question 1', () => {
    // ∃x∀y∃z:(p(x,y) ∨ ∀u∃v:q(z,u,v))  ⇒  ∀y∀u:(p(c,y) ∨ q(f(y),u,g(y,u)))
    const sig: FoSignature = { predicates: { p: 2, q: 3 }, functions: {} }
    const source = '∃x:∀y:∃z:(p(x,y)∨∀u:∃v:q(z,u,v))'
    const { result, steps } = toSkolemNormalForm(parseFormula(source, sig))
    const { prefix } = splitPrenex(result)

    expect(prefix.map((entry) => entry.quantifier)).toEqual(['forall', 'forall'])
    expect(prefix.map((entry) => entry.variable)).toEqual(['y', 'u'])
    // Three existentials, of arity 0, 1 and 2 — exactly the exercise's c, f(y),
    // g(y,u), whatever the symbols end up being called.
    expect(steps.map((step) => step.dependsOn)).toEqual([[], ['y'], ['y', 'u']])
  })

  it('answers Exercise 8 question 3 about the shape of the Skolem form', () => {
    // ∀x∃y:(p(x) ∧ ¬p(y)) skolemises to ∀x:(p(x) ∧ ¬p(f(x))), foNot to a constant.
    const sig: FoSignature = { predicates: { p: 1 }, functions: {} }
    const { result, steps } = toSkolemNormalForm(parseFormula('∀x:∃y:(p(x)∧¬p(y))', sig))
    expect(steps).toHaveLength(1)
    expect(steps[0]?.dependsOn).toEqual(['x'])
    expect(showFormula(result)).toBe('∀x:(p(x)∧¬p(f1(x)))')
  })
})

describe('clausification', () => {
  it('reads a CNF matrix as a set of clauses', () => {
    const matrix = F('(¬p(x,a())∨r(x))∧(s(x)∨p(x,a()))')
    const clauses = clausesOfMatrix(matrix)
    expect(clauses).toHaveLength(2)
    expect(showFoClause(clauses[0] as never)).toBe('¬p(x,a()) ∨ r(x)')
  })

  it('runs the whole pipeline on Example 4.15', () => {
    const sig: FoSignature = { predicates: { p: 2, q: 3 }, functions: {} }
    const source = '∀x:∃y:(∃z:(p(x,z)∨p(y,z))→¬∀u:¬q(x,y,u))'
    const clauses = clausify(parseFormula(source, sig))
    // Two clauses, each a negative p and a positive q — the shape the notes
    // print, whatever the Skolem symbols are named.
    expect(clauses).toHaveLength(2)
    for (const clause of clauses) {
      expect(clause.map((literal) => `${literal.negated ? '¬' : ''}${literal.predicate}`).sort()).toEqual(
        ['q', '¬p'],
      )
    }
  })

  it('clausifies the barber — Example 4.25', () => {
    const sig: FoSignature = { predicates: { shaves: 2 }, functions: { barber: 0 } }
    const clauses = clausify(
      parseFormula('∀x:(shaves(barber(),x)↔¬shaves(x,x))', sig),
    )
    expect(clauses).toHaveLength(2)
    expect(showFoClauseSet(clauses)).toContain('shaves')
  })

  it('drops the ∀ prefix, leaving the variables implicitly universal', () => {
    const sig: FoSignature = { predicates: { p: 1 }, functions: {} }
    const clauses = clausify(parseFormula('∀x:p(x)', sig))
    expect(showFoClause(clauses[0] as never)).toBe('p(x)')
  })
})
