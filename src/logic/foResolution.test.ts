import { describe, expect, it } from 'vitest'
import { parseFormula, type FoSignature } from './fol'
import { clausify, showFoClause, type FoClause } from './foNormal'
import { parseTerm, showTerm, type Signature, type Term } from './terms'
import {
  foBinaryResolvents,
  foClausesEqual,
  equalityAxioms,
  foFactors,
  findFoRefutation,
  groundInstances,
  herbrandBase,
  herbrandLanguage,
  herbrandUniverse,
  isHerbrandModel,
  paramodulants,
  reflexivitySteps,
  renameClauseApart,
  foResolvents,
} from './foResolution'

const FUNCS: Signature = { a: 0, b: 0, c: 0, f: 2, g: 2, h: 3, barber: 0 }
const T = (source: string, signature: Signature = FUNCS) => parseTerm(source, signature)

/** A clause from a compact source: "¬p(a()) ∨ q(x)". */
const C = (source: string, signature: Signature = FUNCS): FoClause =>
  source.split('∨').map((piece) => {
    const text = piece.trim()
    const negated = text.startsWith('¬')
    const body = negated ? text.slice(1) : text
    const open = body.indexOf('(')
    if (open === -1) return { negated, predicate: body, args: [] }
    const predicate = body.slice(0, open)
    const inside = body.slice(open + 1, body.lastIndexOf(')'))
    const args: Term[] = []
    let depth = 0
    let start = 0
    for (let index = 0; index <= inside.length; index++) {
      const character = inside[index]
      if (character === '(') depth++
      if (character === ')') depth--
      if (index === inside.length || (character === ',' && depth === 0)) {
        const piece2 = inside.slice(start, index).trim()
        if (piece2.length > 0) args.push(parseTerm(piece2, signature))
        start = index + 1
      }
    }
    return { negated, predicate, args }
  })

describe('binary resolution — Definition 4.23', () => {
  it('renames the second clause apart before unifying', () => {
    const clause = C('p(x) ∨ q(x)')
    const renamed = renameClauseApart(clause, ['x'])
    expect(showFoClause(renamed)).toBe("p(x') ∨ q(x')")
  })

  it('resolves Example 4.24’s first step', () => {
    // p(x1,x1) ∨ ¬q(x2)  with  ¬p(a(),y)  gives  ¬q(x2)
    const found = foBinaryResolvents(C('p(x1,x1) ∨ ¬q(x2)'), C('¬p(a(),y)'))
    expect(found).toHaveLength(1)
    expect(showFoClause((found[0] as { clause: FoClause }).clause)).toBe('¬q(x2)')
  })

  it('refutes Example 4.22’s clause set', () => {
    const clauses = [
      C('p(x1,x1) ∨ ¬q(x2)'),
      C('¬p(a(),y)'),
      C('p(z1,b()) ∨ q(f(z1,z2))'),
    ]
    expect(findFoRefutation(clauses).refuted).toBe(true)
  })

  it('refutes Example 4.18’s ground set', () => {
    const clauses = [
      C('p(a(),a()) ∨ ¬q(f(a(),b()))'),
      C('¬p(a(),a())'),
      C('¬p(a(),b())'),
      C('p(a(),b()) ∨ q(f(a(),b()))'),
    ]
    expect(findFoRefutation(clauses).refuted).toBe(true)
  })

  it('refutes Exercise 8 question 4', () => {
    const clauses = [
      C('p(x,f(y,y)) ∨ q(y,f(y,y))'),
      C('¬q(a(),f(a(),a()))'),
      C('¬p(b(),f(a(),a())) ∨ r(z,x)'),
      C('¬r(g(a(),a()),b()) ∨ q(y,f(y,y))'),
    ]
    expect(findFoRefutation(clauses, 200).refuted).toBe(true)
  })
})

describe('factoring — Definition 4.26, and why it is needed', () => {
  it('cannot refute the barber with binary resolution alone', () => {
    const barber = [
      C('¬shaves(barber(),x1) ∨ ¬shaves(x1,x1)'),
      C('shaves(barber(),x2) ∨ shaves(x2,x2)'),
    ]
    // Every binary resolvent of these two is a tautology — Example 4.25.
    const binary = foBinaryResolvents(barber[0] as FoClause, barber[1] as FoClause)
    expect(binary.length).toBeGreaterThan(0)
    for (const entry of binary) {
      const tautology = entry.clause.some((literal) =>
        entry.clause.some(
          (other) =>
            other.predicate === literal.predicate &&
            other.negated !== literal.negated &&
            showTerm({ kind: 'fn', name: '$', args: other.args }) ===
              showTerm({ kind: 'fn', name: '$', args: literal.args }),
        ),
      )
      expect([showFoClause(entry.clause), tautology]).toEqual([showFoClause(entry.clause), true])
    }
  })

  it('produces Example 4.27’s factor', () => {
    const found = foFactors(C('¬shaves(barber(),x1) ∨ ¬shaves(x1,x1)'))
    expect(found).toHaveLength(1)
    expect(showFoClause((found[0] as { clause: FoClause }).clause)).toBe('¬shaves(barber(),barber())')
  })

  it('refutes the barber once factoring is allowed', () => {
    const barber = [
      C('¬shaves(barber(),x1) ∨ ¬shaves(x1,x1)'),
      C('shaves(barber(),x2) ∨ shaves(x2,x2)'),
    ]
    expect(foResolvents(barber[0] as FoClause, barber[1] as FoClause)).toContainEqual([])
    expect(findFoRefutation(barber).refuted).toBe(true)
  })

  it('answers Exercise 9 question 1', () => {
    const clause = C('p(a()) ∨ p(b()) ∨ p(x) ∨ q(x) ∨ q(y) ∨ p(z) ∨ p(f(z,z)) ∨ ¬p(z)')
    const produced = foFactors(clause).map((factor) => showFoClause(factor.clause))
    // Unifying p(x) with p(a()) sends x to a(), which drags q(x) along.
    expect(produced.some((entry) => entry.includes('q(a())'))).toBe(true)
    // Unifying p(x) with p(f(z,z)) sends x to f(z,z).
    expect(produced.some((entry) => entry.includes('q(f(z,z))'))).toBe(true)
    // Dropping a literal outright is foNot a factor.
    expect(produced).not.toContain('p(a()) ∨ p(x) ∨ q(x) ∨ q(y) ∨ p(z) ∨ p(f(z,z)) ∨ ¬p(z)')
  })
})

describe('Herbrand — §4.3', () => {
  it('invents a constant when there is none — Example 4.19.2', () => {
    const language = herbrandLanguage([C('¬p(x)'), C('p(f(y,y))')])
    expect(language.invented).toBe(true)
    expect(language.constants.map(showTerm)).toEqual(['a()'])
  })

  it('uses the constants that are there — Example 4.19.1', () => {
    const language = herbrandLanguage([C('¬p(x)'), C('p(c())')])
    expect(language.invented).toBe(false)
    expect(language.constants.map(showTerm)).toEqual(['c()'])
    expect(herbrandUniverse([C('¬p(x)'), C('p(c())')], 2).map(showTerm)).toEqual(['c()'])
  })

  it('answers Exercise 8 question 2', () => {
    // p(a(), h(x,b(),b())) ∨ q(y, f(g(x,x), a()))
    const clause = C('p(a(),h(x,b(),b())) ∨ q(y,f(g(x,x),a()))')
    const universe = herbrandUniverse([clause], 1).map(showTerm)
    expect(universe).toContain('a()')
    expect(universe).toContain('b()')
    expect(universe).toContain('h(a(),a(),a())')
    // Not in it: a term with a variable, an atom, or a symbol foNot present.
    expect(universe).not.toContain('c()')
    expect(universe).not.toContain('h(x,b(),b())')
    expect(universe).not.toContain('x')
  })

  it('builds the expansion by grounding every variable every way', () => {
    const clauses = [C('¬p(x)'), C('p(f(y,y))')]
    const universe = herbrandUniverse(clauses, 1)
    const instances = groundInstances(C('¬p(x)'), universe)
    expect(instances.length).toBe(universe.length)
    for (const instance of instances) {
      expect(showFoClause(instance)).not.toContain('x')
    }
  })

  it('has a Herbrand model exactly when the ground set is satisfiable', () => {
    // {¬p(x), p(c())} has two Herbrand interpretations and neither is a model.
    const clauses = [C('¬p(x)'), C('p(c())')]
    const base = herbrandBase(clauses, 0)
    expect(base).toHaveLength(1)
    expect(isHerbrandModel(clauses, [])).toBe(false)
    expect(isHerbrandModel(clauses, base)).toBe(false)

    // {¬p(x) ∨ p(f(x,x)), p(a())} has one — Example 4.19.3.
    const good = [C('¬p(x) ∨ p(f(x,x))'), C('p(a())')]
    const ground = [
      C('¬p(a()) ∨ p(f(a(),a()))'),
      C('p(a())'),
    ]
    expect(isHerbrandModel(ground, herbrandBase(good, 1))).toBe(true)
  })
})

describe('equality — §4.4', () => {
  const EQ = (left: string, right: string, negated = false) => ({
    negated,
    predicate: '=',
    args: [T(left), T(right)],
  })

  it('runs Example 4.41’s reflexivity resolution', () => {
    // f(x,x) ≠ f(a(),a()) ∨ p(x)  gives  p(a())
    const clause: FoClause = [EQ('f(x,x)', 'f(a(),a())', true), ...C('p(x)')]
    const steps = reflexivitySteps(clause)
    expect(steps).toHaveLength(1)
    expect(showFoClause((steps[0] as { clause: FoClause }).clause)).toBe('p(a())')
  })

  it('refutes ∀x:x ≠ x, which plain resolution cannot', () => {
    const clause: FoClause = [EQ('x', 'x', true)]
    expect(findFoRefutation([clause]).refuted).toBe(false)
    const steps = reflexivitySteps(clause)
    expect(steps).toHaveLength(1)
    expect((steps[0] as { clause: FoClause }).clause).toEqual([])
  })

  it('runs Example 4.43’s paramodulation', () => {
    // f(x,x) = x  into  p(f(f(a(),a()),f(a(),a())))  gives  p(f(a(),a()))
    const equation: FoClause = [EQ('f(x,x)', 'x')]
    const target = C('p(f(f(a(),a()),f(a(),a())))')
    const produced = paramodulants(equation, target).map((step) => showFoClause(step.clause))
    expect(produced).toContain('p(f(a(),a()))')
  })

  it('replaces one occurrence, foNot all of them', () => {
    // With a = b, p(a,a) can become p(b,a) and p(a,b) as well as staying.
    const equation: FoClause = [EQ('a()', 'b()')]
    const target = C('p(a(),a())')
    const produced = paramodulants(equation, target).map((step) => showFoClause(step.clause))
    expect(produced).toContain('p(b(),a())')
    expect(produced).toContain('p(a(),b())')
    expect(produced).not.toContain('p(b(),b())')
  })

  it('builds the equality axioms of a clause set', () => {
    const clauses = [C('p(a())'), C('¬p(b())'), [EQ('a()', 'b()')]]
    const axioms = equalityAxioms(clauses).map(showFoClause)
    expect(axioms[0]).toBe('=(x,x)')
    expect(axioms.some((axiom) => axiom.includes('¬=(x,y)') && axiom.includes('=(y,x)'))).toBe(true)
    // One congruence axiom per predicate symbol other than equality.
    expect(axioms.some((axiom) => axiom.includes('¬p(x1)') && axiom.includes('p(y1)'))).toBe(true)
  })

  it('refutes the axiom version of the notes’ Example 4.36', () => {
    const clauses = [C('p(a())'), C('¬p(b())'), [EQ('a()', 'b()')]]
    const withAxioms = [...clauses, ...equalityAxioms(clauses)]
    expect(findFoRefutation(withAxioms, 300).refuted).toBe(true)
  })
})

describe('clausify feeding resolution', () => {
  it('refutes the barber, straight from the formula', () => {
    const sig: FoSignature = { predicates: { shaves: 2 }, functions: { barber: 0 } }
    const clauses = clausify(parseFormula('∀x:(shaves(barber(),x)↔¬shaves(x,x))', sig))
    expect(findFoRefutation(clauses).refuted).toBe(true)
  })

  it('finds no refutation of something satisfiable, and says so honestly', () => {
    const sig: FoSignature = { predicates: { p: 1 }, functions: { a: 0 } }
    const clauses = clausify(parseFormula('∀x:p(x)', sig))
    const run = findFoRefutation(clauses, 50)
    expect(run.refuted).toBe(false)
  })

  it('agrees that two clauses are the same up to which order they are written', () => {
    expect(foClausesEqual(C('p(x) ∨ q(y)'), C('q(y) ∨ p(x)'))).toBe(true)
    expect(foClausesEqual(C('p(x)'), C('p(y)'))).toBe(false)
  })
})
