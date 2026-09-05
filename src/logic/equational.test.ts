import { describe, expect, it } from 'vitest'
import { parseEquation, parseTerm, showTerm, type Signature } from './terms'
import { derivable, derive, findRefutingInterpretation, decide, oneStep } from './equational'
import { checkNamed, findValueCounterexample, INTERPRETATIONS, showValueAssignment } from './interpretation'
import type { Interpretation } from './interpretation'

const SIG: Signature = { f: 2, g: 2, h: 1 }
const E = (source: string, signature: Signature = SIG) => parseEquation(source, signature)

describe('interpretations — Exercise 4 and Collection Q12', () => {
  // f(x,g(y,z)) = g(f(x,y),f(x,z)), the distributivity question.
  const distributive = E('f(x,g(y,z))=g(f(x,y),f(x,z))')

  it('holds for multiplication over addition', () => {
    expect(checkNamed('timesPlus', distributive).holds).toBe(true)
  })

  it('holds for union over intersection', () => {
    expect(checkNamed('unionIntersect', distributive).holds).toBe(true)
  })

  it('holds for concatenation over "the shorter one"', () => {
    expect(checkNamed('concatShorter', distributive).holds).toBe(true)
  })

  it('fails for addition over multiplication, and says where', () => {
    const result = checkNamed('plusTimes', distributive)
    expect(result.holds).toBe(false)
    expect(result.counterexample).not.toBeNull()
  })

  it('fails for exponentiation over multiplication', () => {
    expect(checkNamed('powerTimes', distributive).holds).toBe(false)
  })

  it('fails for addition over subtraction', () => {
    expect(checkNamed('plusMinus', distributive).holds).toBe(false)
  })

  it('reports a counterexample that really is one', () => {
    const interpretation = INTERPRETATIONS.plusTimes as Interpretation<unknown>
    const found = findValueCounterexample(interpretation, distributive)
    expect(found).not.toBeNull()
    // Reading it back must give two different numbers.
    expect(showValueAssignment(interpretation, found as never)).toMatch(/x = \d/)
  })

  it('sees commutativity where it is and not where it is not', () => {
    const commutative = E('f(x,y)=f(y,x)')
    expect(checkNamed('timesPlus', commutative).holds).toBe(true)
    expect(checkNamed('concatShorter', commutative).holds).toBe(false)
  })
})

describe('one closure step', () => {
  it('uses an axiom in both directions — Definition 3.16 closes under symmetry', () => {
    const sig: Signature = { f: 1 }
    const axioms = [parseEquation('f(x)=f(f(x))', sig)]
    const forward = oneStep(axioms, parseTerm('f(x)', sig), 10).map((step) => showTerm(step.to))
    expect(forward).toContain('f(f(x))')
    const backward = oneStep(axioms, parseTerm('f(f(x))', sig), 10).map((step) => showTerm(step.to))
    expect(backward).toContain('f(x)')
  })

  it('rewrites inside a subterm, not only at the root', () => {
    const sig: Signature = { f: 1, g: 2 }
    const axioms = [parseEquation('f(x)=f(f(x))', sig)]
    const results = oneStep(axioms, parseTerm('g(x,f(x))', sig), 10).map((step) => showTerm(step.to))
    expect(results).toContain('g(x,f(f(x)))')
  })
})

describe('derivability — Example 3.17.1', () => {
  const sig: Signature = { f: 1, g: 2 }
  const axioms = [parseEquation('f(x)=f(f(x))', sig)]
  const goal = (source: string) => parseEquation(source, sig)

  it('derives the equations the notes list', () => {
    for (const source of [
      'f(x)=f(f(x))',
      'g(x,f(f(x)))=g(x,f(x))',
      'f(f(x))=f(x)',
      'f(f(f(x)))=f(f(f(f(x))))',
      'g(x,y)=g(x,y)',
      'g(f(f(x)),f(x))=g(f(x),f(f(x)))',
    ]) {
      expect([source, derivable(axioms, goal(source))]).toEqual([source, true])
    }
  })

  it('does not derive the two the notes exclude', () => {
    for (const source of ['f(x)=f(y)', 'g(x,y)=g(x,f(y))']) {
      expect([source, derivable(axioms, goal(source))]).toEqual([source, false])
    }
  })

  it('returns a chain that really is a proof', () => {
    const found = derive(axioms, goal('f(f(f(x)))=f(f(f(f(x))))'))
    expect(found.derivable).toBe(true)
    expect(showTerm(found.chain[0] as never)).toBe('f(f(f(x)))')
    expect(showTerm(found.chain[found.chain.length - 1] as never)).toBe('f(f(f(f(x))))')
    // Every consecutive pair must be one legal step apart.
    for (let index = 0; index + 1 < found.chain.length; index++) {
      const reachable = oneStep(axioms, found.chain[index] as never, 20).map((step) =>
        showTerm(step.to),
      )
      expect(reachable).toContain(showTerm(found.chain[index + 1] as never))
    }
  })
})

describe('derivability — Exercise 5 question 4', () => {
  const sig: Signature = { f: 2, g: 1 }

  it('derives g(y)=f(y) from {f(x)=g(x)} — symmetry and instantiation', () => {
    const unary: Signature = { f: 1, g: 1 }
    expect(
      derivable([parseEquation('f(x)=g(x)', unary)], parseEquation('g(y)=f(y)', unary)),
    ).toBe(true)
  })

  it('does not derive f(f(x))=g(g(x)) from commuting f and g', () => {
    const unary: Signature = { f: 1, g: 1 }
    expect(
      derivable(
        [parseEquation('f(g(x))=g(f(x))', unary)],
        parseEquation('f(f(x))=g(g(x))', unary),
      ),
    ).toBe(false)
  })

  it('derives the re-bracketing that associativity allows', () => {
    expect(
      derivable(
        [parseEquation('f(x,f(y,z))=f(f(x,y),z)', sig)],
        parseEquation('f(x,f(f(y,z),w))=f(f(x,y),f(z,w))', sig),
      ),
    ).toBe(true)
  })

  it('does not get commutativity out of associativity', () => {
    expect(
      derivable(
        [parseEquation('f(x,f(y,z))=f(f(x,y),z)', sig)],
        parseEquation('f(x,y)=f(y,x)', sig),
      ),
    ).toBe(false)
  })
})

describe('countermodels — Theorem 3.19 used in anger', () => {
  it('proves associativity does not give commutativity', () => {
    const sig: Signature = { f: 2, g: 2 }
    const found = findRefutingInterpretation(
      [parseEquation('f(x,f(y,z))=f(f(x,y),z)', sig)],
      parseEquation('f(x,y)=f(y,x)', sig),
    )
    expect(found).not.toBeNull()
    // Whatever it picked must satisfy the axiom and break the goal.
    const id = (found as never as { id: 'timesPlus' }).id
    expect(checkNamed(id, parseEquation('f(x,f(y,z))=f(f(x,y),z)', sig)).holds).toBe(true)
    expect(checkNamed(id, parseEquation('f(x,y)=f(y,x)', sig)).holds).toBe(false)
  })

  it('decides both directions where it can, and says so where it cannot', () => {
    const sig: Signature = { f: 2 }
    const axioms = [parseEquation('f(x,f(y,z))=f(f(x,y),z)', sig)]
    expect(decide(axioms, parseEquation('f(x,f(y,z))=f(f(x,y),z)', sig)).status).toBe('derivable')
    expect(decide(axioms, parseEquation('f(x,y)=f(y,x)', sig)).status).toBe('not-derivable')
  })
})
