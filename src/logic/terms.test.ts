import { describe, expect, it } from 'vitest'
import {
  flatSpans,
  flatten,
  isGround,
  isSubterm,
  parseFlatTerm,
  parseTerm,
  positions,
  replaceAt,
  showTerm,
  subtermAt,
  subterms,
  termDepth,
  termSize,
  termVariables,
  termsEqual,
  type Signature,
} from './terms'

const SIG: Signature = { f: 1, g: 2 }
const T = (source: string, signature: Signature = SIG) => parseTerm(source, signature)

describe('parsing and printing', () => {
  it('round-trips the notes’ own terms', () => {
    for (const source of ['x', 'g(f(x),y)', 'f(f(f(f(f(x)))))', 'g(g(x,y),g(f(y),x))']) {
      expect(showTerm(T(source))).toBe(source)
    }
  })

  it('reads a constant with or without its brackets', () => {
    const withArity: Signature = { c: 0, f: 1 }
    expect(showTerm(parseTerm('c()', withArity))).toBe('c()')
    expect(showTerm(parseTerm('c', withArity))).toBe('c()')
    // Without an arity, a bare name is a variable — that is what a variable is.
    expect(showTerm(parseTerm('c', {}))).toBe('c')
  })

  it('rejects the wrong number of arguments', () => {
    expect(() => T('g(x)')).toThrow()
    expect(() => T('f(x,y)')).toThrow()
    expect(() => T('f(x))')).toThrow()
  })
})

describe('structure', () => {
  it('computes var(t) — Example 3.3.1', () => {
    expect(termVariables(T('g(g(x,y),g(f(y),x))'))).toEqual(['x', 'y'])
  })

  it('has var(t) empty exactly for ground terms — Example 3.3.2', () => {
    const sig: Signature = { f: 1, g: 2, c: 0 }
    expect(isGround(parseTerm('g(c(),c())', sig))).toBe(true)
    expect(isGround(parseTerm('f(g(x,c()))', sig))).toBe(false)
  })

  it('lists subterms as a set — Example 3.3.3 and 3.3.4', () => {
    expect(subterms(T('f(f(f(x)))')).map(showTerm)).toEqual(['f(f(f(x)))', 'f(f(x))', 'f(x)', 'x'])
    // Six, not seven: the two occurrences of x are one subterm.
    const many = subterms(T('g(g(x,y),g(f(y),x))')).map(showTerm)
    expect(many).toHaveLength(6)
    expect(many).toContain('g(x,y)')
    expect(many).toContain('g(f(y),x)')
    expect(many).toContain('f(y)')
  })

  it('distinguishes "is a subterm of" from "more general than"', () => {
    // g(x,y) is a subterm of the big term; f(x,y)-style generality is unrelated.
    expect(isSubterm(T('g(x,y)'), T('g(g(x,y),g(f(y),x))'))).toBe(true)
    expect(isSubterm(T('g(y,x)'), T('g(g(x,y),g(f(y),x))'))).toBe(false)
  })

  it('measures size and depth', () => {
    expect(termSize(T('g(f(x),y)'))).toBe(4)
    expect(termDepth(T('g(f(x),y)'))).toBe(3)
    expect(termDepth(T('x'))).toBe(1)
  })

  it('reads and replaces at a position', () => {
    const term = T('g(f(x),y)')
    expect(showTerm(subtermAt(term, [0]) as never)).toBe('f(x)')
    expect(showTerm(subtermAt(term, [0, 0]) as never)).toBe('x')
    expect(subtermAt(term, [2])).toBeUndefined()
    expect(showTerm(replaceAt(term, [0, 0], T('y')))).toBe('g(f(y),y)')
    expect(showTerm(replaceAt(term, [], T('x')))).toBe('x')
  })

  it('enumerates every position, root first', () => {
    expect(positions(T('g(f(x),y)')).map((p) => p.join(''))).toEqual(['', '0', '00', '1'])
  })
})

describe('the keyboard with the broken comma key', () => {
  const sig: Signature = { f: 2, g: 2, h: 1 }

  it('reads Exercise 4’s string back', () => {
    // fgxhygzfxy with a(f)=2, a(g)=2, a(h)=1.
    const term = parseFlatTerm('fgxhygzfxy', sig)
    expect(term).not.toBeNull()
    expect(showTerm(term as never)).toBe('f(g(x,h(y)),g(z,f(x,y)))')
  })

  it('agrees with the exercise on which subterms are there', () => {
    const term = parseFlatTerm('fgxhygzfxy', sig) as never
    expect(termVariables(term)).toEqual(['x', 'y', 'z'])
    for (const yes of ['g(x,h(y))', 'g(z,f(x,y))', 'f(x,y)']) {
      expect(isSubterm(parseTerm(yes, sig), term)).toBe(true)
    }
    expect(isSubterm(parseTerm('g(x,y)', sig), term)).toBe(false)
    // "g(z, f(x))" is not even a term under these arities, which is why the
    // exercise offers it: f takes two arguments.
    expect(() => parseTerm('g(z,f(x))', sig)).toThrow()
  })

  it('reads the Collection’s string with different arities', () => {
    // fhxgyfxyghxgyfxy with a(f)=2, a(g)=1, a(h)=3.
    const other: Signature = { f: 2, g: 1, h: 3 }
    const term = parseFlatTerm('fhxgyfxyghxgyfxy', other)
    expect(term).not.toBeNull()
    expect(termVariables(term as never)).toEqual(['x', 'y'])
    expect(isSubterm(parseTerm('h(x,g(y),f(x,y))', other), term as never)).toBe(true)
    expect(isSubterm(parseTerm('g(h(x,g(y),f(x,y)))', other), term as never)).toBe(true)
    expect(isSubterm(parseTerm('f(x,y)', other), term as never)).toBe(true)
    // "h(x, g(y))" is not a term here at all — h takes three arguments.
    expect(() => parseTerm('h(x,g(y))', other)).toThrow()
  })

  it('returns null when the letters do not spell a term', () => {
    expect(parseFlatTerm('fg', sig)).toBeNull()
    expect(parseFlatTerm('fxyz', sig)).toBeNull()
  })

  it('round-trips: flatten then parse gives the term back', () => {
    const term = T('g(g(x,y),g(f(y),x))')
    expect(flatten(term)).toBe('ggxygfyx')
    expect(termsEqual(parseFlatTerm(flatten(term), SIG) as never, term)).toBe(true)
  })
})

describe('flatSpans', () => {
  const sig: Signature = { f: 2, g: 2, h: 1 }

  it('gives every subterm its stretch of letters', () => {
    const term = parseFlatTerm('fgxhygzfxy', sig) as never
    const spans = flatSpans(term)
    const letters = flatten(term)
    for (const span of spans) {
      expect(letters.slice(span.start, span.end)).toBe(flatten(span.term))
    }
    expect(spans[0]).toMatchObject({ start: 0, end: letters.length })
  })

  it('has one span per position', () => {
    const term = T('g(g(x,y),f(z))', { f: 1, g: 2 })
    expect(flatSpans(term)).toHaveLength(positions(term).length)
  })
})
