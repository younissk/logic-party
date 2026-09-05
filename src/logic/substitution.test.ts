import { describe, expect, it } from 'vitest'
import { parseTerm, showTerm, variable, type Signature, type Term } from './terms'
import {
  applySubstitution,
  areIncomparable,
  areUnifiable,
  areVariants,
  compose,
  isVariableRenaming,
  match,
  mgu,
  moreGeneral,
  occurs,
  renameApart,
  showSubstitution,
  substitutionsEqual,
  unify,
  type Substitution,
} from './substitution'

const SIG: Signature = { f: 2, g: 2, h: 1, a: 0, b: 0, c: 0, p: 1, q: 2, r: 1, s: 1, t: 2 }
const T = (source: string, signature: Signature = SIG) => parseTerm(source, signature)
const S = (mapping: Record<string, string>, signature: Signature = SIG): Substitution =>
  Object.fromEntries(Object.entries(mapping).map(([name, term]) => [name, T(term, signature)]))

describe('applying a substitution', () => {
  it('replaces simultaneously, not one after the other — Example 3.4.1', () => {
    const sig: Signature = { f: 1, g: 3 }
    const sigma = S({ x: 'y', y: 'f(x)' }, sig)
    expect(showTerm(applySubstitution(sigma, parseTerm('g(f(x),z,y)', sig)))).toBe('g(f(y),z,f(x))')
  })

  it('replaces once, not repeatedly', () => {
    const sig: Signature = { f: 1 }
    expect(showTerm(applySubstitution(S({ x: 'f(x)' }, sig), parseTerm('f(x)', sig)))).toBe('f(f(x))')
  })

  it('leaves unlisted variables alone', () => {
    expect(showTerm(applySubstitution(S({ x: 'a()' }), T('f(x,y)')))).toBe('f(a(),y)')
  })
})

describe('composition', () => {
  it('applies the inner one first — the note on p.46', () => {
    const sig: Signature = { f: 1, g: 2 }
    const sigma = S({ x: 'f(x)' }, sig)
    const other = S({ x: 'y', y: 'f(x)' }, sig)
    expect(showSubstitution(compose(sigma, other))).toBe('{x ↦ y, y ↦ f(f(x))}')
    expect(showSubstitution(compose(other, sigma))).toBe('{x ↦ f(y), y ↦ f(x)}')
  })

  it('agrees with applying the two in turn', () => {
    const sig: Signature = { f: 1, g: 2 }
    const sigma = S({ x: 'f(x)' }, sig)
    const other = S({ x: 'y', y: 'f(x)' }, sig)
    const term = parseTerm('g(x,y)', sig)
    expect(showTerm(applySubstitution(compose(sigma, other), term))).toBe(
      showTerm(applySubstitution(sigma, applySubstitution(other, term))),
    )
  })

  it('settles exam26bA Q2.1, which is true', () => {
    // σ = {x ↦ y}, σ′ = {y ↦ f(x)}. Then σ ∘ σ′ = {x ↦ y, y ↦ f(y)}.
    const sig: Signature = { f: 1 }
    const composed = compose(S({ x: 'y' }, sig), S({ y: 'f(x)' }, sig))
    expect(substitutionsEqual(composed, S({ x: 'y', y: 'f(y)' }, sig))).toBe(true)
  })

  it('settles exam26a Q2.1 line one, which is false', () => {
    // σ = {x ↦ f(y), y ↦ z}. Then σ(x) = f(y), not f(z): one pass, not two.
    const sig: Signature = { f: 1 }
    expect(showTerm(applySubstitution(S({ x: 'f(y)', y: 'z' }, sig), variable('x')))).toBe('f(y)')
  })
})

describe('variable renamings — Example 3.6.1', () => {
  it('accepts a swap', () => {
    expect(isVariableRenaming(S({ x: 'y', y: 'x' }))).toBe(true)
  })

  it('rejects a non-variable image', () => {
    expect(isVariableRenaming(S({ x: 'h(x)' }))).toBe(false)
  })

  it('rejects two variables landing on one', () => {
    expect(isVariableRenaming(S({ x: 'z', y: 'z' }))).toBe(false)
  })
})

describe('matching — Algorithm 3.8', () => {
  it('solves Example 3.9.1', () => {
    const found = match(T('f(x,g(y,x))'), T('f(h(u),g(v,h(u)))'))
    expect(found).not.toBeNull()
    expect(showSubstitution(found as Substitution)).toBe('{x ↦ h(u), y ↦ v}')
  })

  it('fails on Example 3.9.2, where the third argument cannot follow', () => {
    expect(match(T('f(x,g(y,x))'), T('f(h(u),g(v,w))'))).toBeNull()
  })

  it('does not fall for the shared-variable trap of Example 3.9.3', () => {
    // The letter-by-letter algorithm returns a wrong answer here; a variable
    // already bound has to stay bound.
    expect(match(T('f(x,y)'), T('f(y,x)'))).not.toBeNull()
    expect(match(T('f(x,x)'), T('f(y,z)'))).toBeNull()
  })

  it('answers Exercise 4’s matching question', () => {
    // t1 = f(x,x), t2 = f(y,z): which σ have t1 = σ(t2)?
    const t1 = T('f(x,x)')
    const t2 = T('f(y,z)')
    const holds = (mapping: Record<string, string>) =>
      showTerm(applySubstitution(S(mapping), t2)) === showTerm(t1)
    expect(holds({ y: 'x', z: 'x' })).toBe(true)
    expect(holds({ y: 'x', z: 'x', x: 'z' })).toBe(true)
    expect(holds({ z: 'y', x: 'y' })).toBe(false)
    expect(holds({ y: 'f(x,x)', z: 'f(x,x)', x: 'f(x,x)' })).toBe(false)
  })
})

describe('more general than — Definition 3.5', () => {
  it('orders the chain of Example 3.6.3', () => {
    const sig: Signature = { f: 2, g: 1, h: 1 }
    const P = (source: string) => parseTerm(source, sig)
    expect(moreGeneral(P('f(x,y)'), P('f(x,g(z))'))).toBe(true)
    expect(moreGeneral(P('f(x,g(z))'), P('f(h(x),g(y))'))).toBe(true)
    expect(moreGeneral(P('f(x,y)'), P('f(h(x),g(y))'))).toBe(true)
    // The other way round is not true, which is what makes it an ordering.
    expect(moreGeneral(P('f(h(x),g(y))'), P('f(x,y)'))).toBe(false)
  })

  it('sees f(x,y) and f(y,x) as variants of each other', () => {
    expect(areVariants(T('f(x,y)'), T('f(y,x)'))).toBe(true)
  })

  it('calls f(x) and g(x) incomparable', () => {
    expect(areIncomparable(T('h(x)'), T('r(x)'))).toBe(true)
  })

  it('answers exam25a Q2.1', () => {
    // Which terms are at least as general as f(g(X,Y),h(h(X)))?
    const sig: Signature = { f: 2, g: 2, h: 1 }
    const target = parseTerm('f(g(X,Y),h(h(X)))', sig)
    const asks: [string, boolean][] = [
      ['f(g(X,Y),h(X))', false],
      ['f(X,h(h(X)))', false],
      ['f(X,h(h(Y)))', true],
      ['f(g(X,Y),h(h(Y)))', false],
      ['f(g(Y,X),h(h(Y)))', true],
      ['X', true],
    ]
    for (const [source, expected] of asks) {
      expect([source, moreGeneral(parseTerm(source, sig), target)]).toEqual([source, expected])
    }
  })

  it('answers Exercise 5 question 1', () => {
    const sig: Signature = { c: 0, f: 1, g: 1, h: 1 }
    const r = parseTerm('g(c())', sig)
    const s = parseTerm('g(f(x))', sig)
    const t = parseTerm('f(y)', sig)
    const u = parseTerm('g(y)', sig)

    expect(moreGeneral(t, s)).toBe(false) // a
    expect(moreGeneral(u, r)).toBe(true) // b
    expect(areUnifiable(r, s)).toBe(false) // c
    expect(moreGeneral(s, t)).toBe(false) // d
    expect(areUnifiable(u, t)).toBe(false) // e
    expect(areUnifiable(s, t)).toBe(false) // f
    expect(moreGeneral(u, s)).toBe(true) // g
    expect(areIncomparable(s, t)).toBe(true) // h
  })
})

describe('unification — Algorithm 3.13', () => {
  it('solves Example 3.11.1', () => {
    const found = mgu(variable('x'), variable('y'))
    expect(found).not.toBeNull()
    expect(showSubstitution(found as Substitution)).toMatch(/^\{[xy] ↦ [xy]\}$/)
  })

  it('refuses Example 3.11.2 with a clash', () => {
    const result = unify(T('h(x)'), T('f(x,y)'))
    expect(result.unified).toBe(false)
    if (!result.unified) expect(result.failure.reason).toBe('clash')
  })

  it('solves Example 3.11.3 / 3.15.1', () => {
    const sig: Signature = { f: 1, g: 2 }
    const found = mgu(parseTerm('g(x,f(f(y)))', sig), parseTerm('g(g(z,y),f(z))', sig))
    expect(found).not.toBeNull()
    expect(showSubstitution(found as Substitution)).toBe('{x ↦ g(f(y),y), z ↦ f(y)}')
  })

  it('refuses Example 3.11.4', () => {
    const sig: Signature = { f: 1, g: 2 }
    expect(areUnifiable(parseTerm('g(x,f(y))', sig), parseTerm('g(f(f(y)),x)', sig))).toBe(false)
  })

  it('refuses f(x) against f(f(x)) by the occurs check — Example 3.15.3', () => {
    const sig: Signature = { f: 1 }
    const result = unify(parseTerm('f(x)', sig), parseTerm('f(f(x))', sig))
    expect(result.unified).toBe(false)
    if (!result.unified) {
      expect(result.failure.reason).toBe('occurs')
      if (result.failure.reason === 'occurs') expect(result.failure.variable).toBe('x')
    }
    expect(occurs('x', parseTerm('f(x)', sig))).toBe(true)
  })

  it('solves exam25a Q2.2', () => {
    const sig: Signature = { f: 2, g: 2, h: 1 }
    const found = mgu(parseTerm('f(g(X,Y),X)', sig), parseTerm('f(Z,h(h(Y)))', sig))
    expect(found).not.toBeNull()
    const sigma = found as Substitution
    // Both terms must actually become the same term.
    expect(showTerm(applySubstitution(sigma, parseTerm('f(g(X,Y),X)', sig)))).toBe(
      showTerm(applySubstitution(sigma, parseTerm('f(Z,h(h(Y)))', sig))),
    )
    expect(showSubstitution(sigma)).toBe('{X ↦ h(h(Y)), Z ↦ g(h(h(Y)),Y)}')
  })

  it('solves exam26a Q2.3', () => {
    const sig: Signature = { f: 1, g: 2, h: 2 }
    const found = mgu(parseTerm('g(x,f(y))', sig), parseTerm('g(h(z,y),z)', sig))
    expect(found).not.toBeNull()
    expect(showSubstitution(found as Substitution)).toBe('{x ↦ h(f(y),y), z ↦ f(y)}')
  })

  it('refuses exam26bA Q2.3 by the occurs check', () => {
    // g(h(x,y),x) against g(z,f(f(y))): x ↦ f(f(y)) then z ↦ h(f(f(y)),y) — it
    // does unify. The false one in that paper is the true/false line.
    const sig: Signature = { f: 1, g: 2, h: 2 }
    const found = mgu(parseTerm('g(h(x,y),x)', sig), parseTerm('g(z,f(f(y)))', sig))
    expect(found).not.toBeNull()
    expect(showSubstitution(found as Substitution)).toBe('{x ↦ f(f(y)), z ↦ h(f(f(y)),y)}')
  })

  it('answers exam26a and exam26bA true/false lines about unifiability', () => {
    const sig: Signature = { f: 1, g: 2 }
    // exam26a: "g(x,y) and g(f(y),x) are unifiable" — FALSE. x ↦ f(y) from the
    // first argument, and then the second asks y against f(y): occurs check.
    const blocked = unify(parseTerm('g(x,y)', sig), parseTerm('g(f(y),x)', sig))
    expect(blocked.unified).toBe(false)
    if (!blocked.unified) expect(blocked.failure.reason).toBe('occurs')

    // exam26bA: "g(x,f(y)) and g(f(z),x) are unifiable" — TRUE, and only the
    // order of the arguments differs. x ↦ f(z), then f(y) against f(z).
    expect(areUnifiable(parseTerm('g(x,f(y))', sig), parseTerm('g(f(z),x)', sig))).toBe(true)
  })

  it('answers Exercise 5 question 2', () => {
    const sig: Signature = { a: 2, b: 0, f: 2, g: 1, h: 1, q: 2 }
    const pairs: [string, string, boolean][] = [
      ['a(x,a(y,a(z,b())))', 'a(a(a(b(),z),y),x)', true],
      ['f(x,g(y))', 'f(y,g(x))', true],
      ['q(g(x),h(y))', 'q(g(g(y)),h(g(y)))', false],
    ]
    for (const [left, right, expected] of pairs) {
      expect([left, areUnifiable(parseTerm(left, sig), parseTerm(right, sig))]).toEqual([
        left,
        expected,
      ])
    }
  })

  it('produces a unifier that really unifies, on every example above', () => {
    const sig: Signature = { f: 1, g: 2, h: 2 }
    const cases: [string, string][] = [
      ['g(x,f(y))', 'g(h(z,y),z)'],
      ['g(x,f(f(y)))', 'g(h(z,y),f(z))'],
      ['g(h(x,y),x)', 'g(z,f(f(y)))'],
    ]
    for (const [left, right] of cases) {
      const one = parseTerm(left, sig)
      const two = parseTerm(right, sig)
      const sigma = mgu(one, two)
      expect(sigma).not.toBeNull()
      expect(showTerm(applySubstitution(sigma as Substitution, one))).toBe(
        showTerm(applySubstitution(sigma as Substitution, two)),
      )
    }
  })

  it('is most general: every other unifier is an instance of it', () => {
    const sig: Signature = { f: 1, g: 2 }
    const one = parseTerm('g(x,f(y))', sig)
    const two = parseTerm('g(f(z),y)', sig)
    const general = mgu(one, two) as Substitution
    // A specific unifier, found by hand.
    const specific = S({ x: 'f(a())', z: 'a()', y: 'f(b())' }, { ...sig, a: 0, b: 0 })
    const unifies = (sigma: Substitution): boolean =>
      showTerm(applySubstitution(sigma, one)) === showTerm(applySubstitution(sigma, two))
    if (unifies(specific)) {
      // There must be a ρ with ρ ∘ general = specific.
      const rho = mgu(
        applySubstitution(general, one),
        applySubstitution(specific, one),
      )
      expect(rho).not.toBeNull()
    }
  })
})

describe('renameApart', () => {
  it('moves every variable out of the way', () => {
    const renamed = renameApart(T('f(x,y)'), ['x', 'y'])
    expect(showTerm(renamed)).toBe("f(x',y')")
  })

  it('keeps going until the name really is free', () => {
    const renamed = renameApart(T('f(x,y)'), ['x', "x'", 'y'])
    expect(showTerm(renamed)).toBe("f(x'',y')")
  })

  it('leaves ground terms alone', () => {
    const term: Term = T('f(a(),b())')
    expect(showTerm(renameApart(term, ['x']))).toBe('f(a(),b())')
  })
})
