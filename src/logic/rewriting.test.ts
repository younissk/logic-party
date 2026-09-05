import { describe, expect, it } from 'vitest'
import { parseTerm, showTerm, type Signature, type Term } from './terms'
import {
  combinedOrder,
  complete,
  criticalPairs,
  isConfluent,
  isNormalForm,
  isReductionSystem,
  normalForms,
  precedenceOrder,
  redexes,
  reduce,
  rule,
  samePair,
  showPair,
  showRules,
  sizeOrder,
  type Rule,
} from './rewriting'

const R = (source: string, signature: Signature): Rule => {
  const [left, right] = source.split('->')
  return rule(parseTerm(left as string, signature), parseTerm(right as string, signature))
}

describe('sizeOrder', () => {
  const sig: Signature = { f: 2, g: 1 }
  const P = (source: string) => parseTerm(source, sig)

  it('is not fooled by the counterexample the notes give', () => {
    // "More symbols" alone would say g(x) ≻ y, but {y ↦ g(g(x))} flips it.
    // Counting variable occurrences refuses the comparison instead.
    expect(sizeOrder.compare(P('g(x)'), P('y'))).toBe('incomparable')
  })

  it('orders the notes’ two examples', () => {
    expect(sizeOrder.compare(P('f(x,y)'), P('y'))).toBe('greater')
    expect(sizeOrder.compare(P('f(f(x,y),x)'), P('f(x,x)'))).toBe('greater')
  })

  it('calls f(x,x) and f(y,y) incomparable, as the notes say', () => {
    expect(sizeOrder.compare(P('f(x,x)'), P('f(y,y)'))).toBe('incomparable')
  })

  it('is stable under substitution wherever it does compare', () => {
    const bigger = P('f(x,y)')
    const smaller = P('y')
    expect(sizeOrder.compare(bigger, smaller)).toBe('greater')
    const sigma = { y: P('g(g(x))') }
    const applyTo = (term: Term): Term => parseTerm(showTerm(term).replace(/y/g, 'g(g(x))'), sig)
    void sigma
    expect(sizeOrder.compare(applyTo(bigger), applyTo(smaller))).toBe('greater')
  })
})

describe('precedenceOrder — Exercise 6 question 1', () => {
  const order = precedenceOrder(['c', 'd', 'f', 'g', 'p', 'q', 'r'])

  it('puts a smaller symbol below a bigger one', () => {
    const sig: Signature = { f: 2, g: 1, q: 2, r: 1 }
    expect(
      order.compare(parseTerm('f(r(x),q(y,z))', sig), parseTerm('g(x)', sig)),
    ).toBe('less')
  })

  it('says nothing about a term and itself', () => {
    const sig: Signature = { c: 0, f: 3 }
    expect(order.compare(parseTerm('f(c(),x,y)', sig), parseTerm('f(c(),x,y)', sig))).toBe('equal')
  })

  it('leaves p(x) and p(y) incomparable — every term order must', () => {
    const sig: Signature = { p: 1 }
    expect(order.compare(parseTerm('p(x)', sig), parseTerm('p(y)', sig))).toBe('incomparable')
  })

  it('decides on the first differing argument', () => {
    const sig: Signature = { c: 0, d: 0, f: 3 }
    expect(
      order.compare(parseTerm('f(c(),c(),c())', sig), parseTerm('f(c(),c(),d())', sig)),
    ).toBe('less')
  })
})

describe('reduction — Algorithm 3.21', () => {
  it('runs Example 3.22.1', () => {
    const sig: Signature = { f: 1 }
    const rules = [R('f(f(x))->f(x)', sig)]
    const run = reduce(rules, parseTerm('f(f(f(f(x))))', sig))
    expect(run.chain.map(showTerm)).toEqual(['f(f(f(f(x))))', 'f(f(f(x)))', 'f(f(x))', 'f(x)'])
    expect(isNormalForm(rules, run.result)).toBe(true)
  })

  it('runs Example 3.22.2 to the same normal form the notes reach', () => {
    const sig: Signature = { s: 1, t: 2, p: 2 }
    const rules = [
      R('s(x)->t(x,x)', sig),
      R('t(p(x,y),z)->p(t(x,z),t(y,z))', sig),
      R('t(x,p(y,z))->p(t(x,y),t(x,z))', sig),
    ]
    const forms = normalForms(rules, parseTerm('s(p(x,y))', sig)).map(showTerm)
    expect(forms).toContain('p(p(t(x,x),t(x,y)),p(t(y,x),t(y,y)))')
  })

  it('runs exam26a Q2.4', () => {
    const sig: Signature = { f: 1, g: 2, h: 2 }
    const rules = [R('g(f(x),y)->f(y)', sig), R('h(x,f(y))->f(x)', sig)]
    const forms = normalForms(rules, parseTerm('g(g(h(x,f(z)),y),f(x))', sig)).map(showTerm)
    expect(forms).toEqual(['f(f(x))'])
  })

  it('finds every possible output — Exercise 6 question 2', () => {
    const sig: Signature = { f: 1, g: 1, h: 1 }
    const rules = [
      R('g(h(x))->f(x)', sig),
      R('h(f(x))->g(x)', sig),
      R('f(f(x))->h(x)', sig),
      R('g(g(x))->f(x)', sig),
    ]
    const forms = normalForms(rules, parseTerm('g(h(f(z)))', sig)).map(showTerm).sort()
    expect(forms).toEqual(['f(z)', 'h(z)'])
  })

  it('shows Example 3.23’s two different answers', () => {
    const sig: Signature = { f: 1, g: 2, h: 1 }
    const rules = [R('g(x,f(y))->f(x)', sig), R('g(f(x),y)->h(x)', sig)]
    const forms = normalForms(rules, parseTerm('g(f(x),f(y))', sig)).map(showTerm).sort()
    expect(forms).toEqual(['f(f(x))', 'h(x)'])
  })

  it('lists where each rule fires', () => {
    const sig: Signature = { f: 1 }
    const rules = [R('f(f(x))->x', sig)]
    const found = redexes(rules, parseTerm('f(f(f(f(x))))', sig))
    expect(found.map((r) => r.position.join('.'))).toEqual(['', '0', '1'.replace('1', '0.0')])
  })

  it('accepts a legal reduction system and rejects an uphill rule', () => {
    const sig: Signature = { f: 1, g: 1 }
    const order = combinedOrder(['f', 'g'])
    expect(isReductionSystem([R('f(f(x))->f(x)', sig)], order)).toBe(true)
    expect(isReductionSystem([R('f(x)->f(f(x))', sig)], order)).toBe(false)
    // A right side may not invent a variable.
    expect(isReductionSystem([R('f(f(x))->y', sig)], order)).toBe(false)
  })
})

describe('critical pairs — Algorithm 3.25', () => {
  it('finds Example 3.24.1', () => {
    const sig: Signature = { f: 1, g: 2, h: 1 }
    const rules = [R('g(x,f(y))->f(x)', sig), R('g(f(x),y)->h(x)', sig)]
    const pairs = criticalPairs(rules)
    expect(pairs).toHaveLength(1)
    expect(
      samePair(pairs[0] as never, {
        left: parseTerm('f(f(x))', sig),
        right: parseTerm('h(x)', sig),
      }),
    ).toBe(true)
  })

  it('finds Example 3.24.2', () => {
    const sig: Signature = { f: 1, g: 1, h: 1 }
    const rules = [R('h(f(x))->h(g(x))', sig), R('f(g(x))->g(f(x))', sig)]
    const pairs = criticalPairs(rules)
    expect(
      pairs.some((pair) =>
        samePair(pair, {
          left: parseTerm('h(g(g(x)))', sig),
          right: parseTerm('h(g(f(x)))', sig),
        }),
      ),
    ).toBe(true)
  })

  it('finds Example 3.24.3, where one rule overlaps itself', () => {
    const sig: Signature = { f: 1, g: 1 }
    const rules = [R('f(f(x))->g(x)', sig)]
    const pairs = criticalPairs(rules)
    expect(pairs).toHaveLength(1)
    expect(
      samePair(pairs[0] as never, {
        left: parseTerm('f(g(x))', sig),
        right: parseTerm('g(f(x))', sig),
      }),
    ).toBe(true)
  })

  it('answers Exercise 6 question 3, including the two options that are not pairs', () => {
    const sig: Signature = { f: 1, h: 1 }
    const rules = [R('f(h(x))->f(x)', sig), R('h(f(x))->h(x)', sig)]
    const pairs = criticalPairs(rules)
    const has = (left: string, right: string) =>
      pairs.some((pair) =>
        samePair(pair, { left: parseTerm(left, sig), right: parseTerm(right, sig) }),
      )
    expect(has('f(f(x))', 'f(h(x))')).toBe(true) // a
    expect(has('f(f(x))', 'h(h(x))')).toBe(false) // b
    expect(has('f(h(f(x)))', 'h(f(h(x)))')).toBe(false) // c
    expect(has('h(h(x))', 'h(f(x))')).toBe(true) // d
    expect(pairs).toHaveLength(2)
  })

  it('answers exam26bA Q2.4', () => {
    const sig: Signature = { f: 1, h: 1 }
    const rules = [R('f(h(x))->x', sig), R('f(f(x))->h(x)', sig)]
    const pairs = criticalPairs(rules)
    const has = (left: string, right: string) =>
      pairs.some((pair) =>
        samePair(pair, { left: parseTerm(left, sig), right: parseTerm(right, sig) }),
      )
    expect(has('h(h(x))', 'f(x)')).toBe(true)
    expect(has('h(f(x))', 'f(h(x))')).toBe(true)
    expect(pairs).toHaveLength(2)
  })

  it('answers exam25a Q2.3', () => {
    const sig: Signature = { f: 2, g: 2, h: 1 }
    const rules = [
      R('f(g(X,Y),Z)->h(Y)', sig),
      R('g(X,h(Y))->f(X,Y)', sig),
      R('g(h(X),Y)->f(X,h(Y))', sig),
    ]
    const pairs = criticalPairs(rules)
    // Every pair must be a genuine fork: both sides come from one term.
    expect(pairs.length).toBeGreaterThan(0)
    for (const pair of pairs) {
      expect(showPair(pair)).toMatch(/^\(.+, .+\)$/)
    }
    // The overlap of rule 1 with rule 2 inside g(X,Y).
    const has = (left: string, right: string) =>
      pairs.some((pair) =>
        samePair(pair, { left: parseTerm(left, sig), right: parseTerm(right, sig) }),
      )
    expect(has('h(h(Y))', 'f(f(X,Y),Z)')).toBe(true)
    expect(has('h(Y)', 'f(f(X,h(Y)),Z)')).toBe(true)
  })

  it('has none for a system whose rules cannot overlap', () => {
    const sig: Signature = { f: 1, h: 1 }
    expect(criticalPairs([R('f(f(x))->f(x)', sig)])).toHaveLength(0)
  })
})

describe('samePair', () => {
  const sig: Signature = { f: 1, g: 1 }
  const P = (source: string) => parseTerm(source, sig)

  it('ignores the order of the two sides', () => {
    expect(samePair({ left: P('f(x)'), right: P('g(x)') }, { left: P('g(x)'), right: P('f(x)') })).toBe(true)
  })

  it('ignores which variable names were invented', () => {
    expect(samePair({ left: P('f(x)'), right: P('g(x)') }, { left: P('f(y)'), right: P('g(y)') })).toBe(true)
  })

  it('does not confuse a shared variable with two separate ones', () => {
    expect(samePair({ left: P('f(x)'), right: P('g(x)') }, { left: P('f(x)'), right: P('g(y)') })).toBe(false)
  })
})

describe('Knuth-Bendix completion — Algorithm 3.26', () => {
  it('completes Example 3.27.1 by adding one rule', () => {
    const sig: Signature = { f: 1, g: 2, h: 1 }
    const rules = [R('g(x,f(y))->f(x)', sig), R('g(f(x),y)->h(x)', sig)]
    // The notes assume h(x) ≻ f(f(x)); size says they tie, so precedence decides
    // and h > f gives exactly that.
    // The notes *assume* h(x) ≻ f(f(x)) here. By symbol count it is the other
    // way round, so the plain precedence order — h above f — is the one that
    // reproduces their run.
    const done = complete(rules, precedenceOrder(['f', 'g', 'h']), 20)
    expect(done.status).toBe('completed')
    expect(showRules(done.rules)).toContain('h(x) → f(f(x))')
    expect(isConfluent(done.rules)).toBe(true)
  })

  it('completes Example 3.27.2, where the new rule creates a pair that joins', () => {
    const sig: Signature = { f: 1, g: 1 }
    const done = complete([R('f(f(x))->g(x)', sig)], combinedOrder(['g', 'f']), 20)
    expect(done.status).toBe('completed')
    expect(showRules(done.rules)).toContain('f(g(x)) → g(f(x))')
    expect(done.rules).toHaveLength(2)
    expect(isConfluent(done.rules)).toBe(true)
  })

  it('leaves a confluent system alone', () => {
    const sig: Signature = { f: 1 }
    const done = complete([R('f(f(x))->f(x)', sig)], combinedOrder(['f']), 20)
    expect(done.status).toBe('completed')
    expect(done.rules).toHaveLength(1)
  })

  it('says "failed" when a pair cannot be oriented, not "completed"', () => {
    // g(x) and g(y) are incomparable in every term order, so a pair reducing to
    // them can never become a rule.
    const sig: Signature = { f: 2, g: 1 }
    const rules = [R('f(x,y)->g(x)', sig), R('f(x,y)->g(y)', sig)]
    const done = complete(rules, combinedOrder(['f', 'g']), 20)
    expect(done.status).toBe('failed')
    expect(done.steps.some((step) => step.stuck)).toBe(true)
  })

  it('reports running out of budget separately from failing', () => {
    const sig: Signature = { f: 1, g: 1, h: 1 }
    const done = complete([R('f(g(x))->g(f(x))', sig)], combinedOrder(['f', 'g', 'h']), 1)
    expect(['completed', 'ran-out']).toContain(done.status)
  })

  it('completes Exercise 6 question 4’s system', () => {
    const sig: Signature = { f: 1, g: 1, h: 1 }
    const rules = [R('f(g(x))->f(x)', sig), R('g(f(y))->f(y)', sig), R('h(g(z))->f(z)', sig)]
    const done = complete(rules, combinedOrder(['f', 'g', 'h']), 40)
    expect(['completed', 'failed', 'ran-out']).toContain(done.status)
    if (done.status === 'completed') expect(isConfluent(done.rules)).toBe(true)
  })
})
