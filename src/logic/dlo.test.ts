import { describe, expect, it } from 'vitest'

import {
  DLO_AXIOMS,
  eliminateConjunction,
  eliminateExists,
  eliminateQuantifiers,
  parseDlo,
  removeNegations,
  showDlo,
  simplifyDlo,
  valueAt,
} from './dlo'
import { freeVariables, type FoFormula } from './fol'

/**
 * An oracle independent of the elimination code.
 *
 * ℚ is a model of the theory, so a formula's truth there settles it. The
 * search over an infinite universe is finite because in a dense linear order
 * truth depends only on the *order type* of the assignment: every point that
 * sits in the same gap between the values already named behaves identically.
 * So one representative per gap — plus one below everything and one above —
 * is a complete search.
 */
function holdsInQ(formula: FoFormula, env: Readonly<Record<string, number>>): boolean {
  switch (formula.kind) {
    case 'quantified': {
      const seen = [...new Set(Object.values(env))].sort((a, b) => a - b)
      const candidates = [
        (seen[0] ?? 0) - 1,
        ...seen,
        ...seen.slice(1).map((value, index) => ((seen[index] as number) + value) / 2),
        (seen[seen.length - 1] ?? 0) + 1,
      ]
      const test = (value: number): boolean =>
        holdsInQ(formula.body, { ...env, [formula.variable]: value })
      return formula.quantifier === 'exists' ? candidates.some(test) : candidates.every(test)
    }
    case 'not':
      return !holdsInQ(formula.body, env)
    case 'binary': {
      const left = holdsInQ(formula.left, env)
      const right = holdsInQ(formula.right, env)
      if (formula.connective === 'and') return left && right
      if (formula.connective === 'or') return left || right
      if (formula.connective === 'implies') return !left || right
      return left === right
    }
    default:
      return valueAt(formula, env)
  }
}

/** Every assignment of `size` free variables to a small ordered sample. */
function* assignments(
  names: readonly string[],
  values: readonly number[],
): Generator<Record<string, number>> {
  if (names.length === 0) {
    yield {}
    return
  }
  const [head, ...rest] = names as [string, ...string[]]
  for (const tail of assignments(rest, values)) {
    for (const value of values) yield { ...tail, [head]: value }
  }
}

/** The eliminated formula must agree with the original on every assignment. */
function agreesEverywhere(original: FoFormula, eliminated: FoFormula): true | string {
  const names = [...new Set(freeVariables(original))].sort()
  const sample = [0, 1, 2, 3]
  for (const env of assignments(names, sample)) {
    const wanted = holdsInQ(original, env)
    const got = holdsInQ(eliminated, env)
    if (wanted !== got) {
      const shown = names.map((name) => `${name}=${env[name]}`).join(' ')
      return `at ${shown}: original ${wanted}, eliminated ${got}`
    }
  }
  return true
}

describe('removing negations with linearity', () => {
  it('turns ¬(y<z) into z<y ∨ z=y', () => {
    expect(showDlo(removeNegations(parseDlo('¬<(y,z)')))).toBe('(z<y∨z=y)')
  })

  it('turns ¬(y=z) into y<z ∨ z<y', () => {
    expect(showDlo(removeNegations(parseDlo('¬=(y,z)')))).toBe('(y<z∨z<y)')
  })

  it('leaves nothing negated', () => {
    const positive = removeNegations(parseDlo('¬(<(x,y)∧=(y,z))'))
    const walk = (node: FoFormula): boolean =>
      node.kind === 'not'
        ? false
        : node.kind === 'binary'
          ? walk(node.left) && walk(node.right)
          : true
    expect(walk(positive)).toBe(true)
  })
})

describe('eliminating one existential', () => {
  it('is unbounded above, so a lone lower bound is always satisfiable', () => {
    expect(eliminateExists('x', parseDlo('<(y,x)'))).toEqual({ kind: 'true' })
  })

  it('is unbounded below too', () => {
    expect(eliminateExists('x', parseDlo('<(x,y)'))).toEqual({ kind: 'true' })
  })

  it('uses density for a point strictly between two others', () => {
    expect(showDlo(eliminateExists('x', parseDlo('(<(y,x)∧<(x,z))')))).toBe('y<z')
  })

  it('crosses every lower bound with every upper bound', () => {
    const result = eliminateExists('x', parseDlo('(<(u,x)∧(<(v,x)∧(<(x,y)∧<(x,z))))'))
    const text = showDlo(result)
    for (const pair of ['u<y', 'u<z', 'v<y', 'v<z']) expect(text).toContain(pair)
  })

  it('refuses x<x, by irreflexivity', () => {
    expect(eliminateExists('x', parseDlo('<(x,x)'))).toEqual({ kind: 'false' })
  })

  it('refuses a bound that is both above and below', () => {
    expect(eliminateExists('x', parseDlo('(<(y,x)∧<(x,y))'))).toEqual({ kind: 'false' })
  })

  it('substitutes through an equation', () => {
    expect(showDlo(eliminateExists('x', parseDlo('(=(x,y)∧<(x,z))')))).toBe('y<z')
  })

  it('carries conjuncts that do not mention x straight out', () => {
    expect(showDlo(eliminateExists('x', parseDlo('(<(u,v)∧<(y,x))')))).toBe('u<v')
  })

  it('splits a disjunction before eliminating', () => {
    const result = eliminateExists('x', parseDlo('(<(x,x)∨<(y,x))'))
    expect(result).toEqual({ kind: 'true' })
  })
})

describe('eliminating a conjunction directly', () => {
  it('reads an empty conjunction as ⊤', () => {
    expect(eliminateConjunction('x', [])).toEqual({ kind: 'true' })
  })

  it('collapses as soon as one conjunct is ⊥', () => {
    expect(eliminateConjunction('x', [{ kind: 'false' }])).toEqual({ kind: 'false' })
  })
})

describe('the whole procedure', () => {
  const cases: readonly string[] = [
    '∃x:<(y,x)',
    '∀x:∃y:<(x,y)',
    '∃x:(<(y,x)∧<(x,z))',
    '∀x:(<(x,y)→∃z:(<(x,z)∧<(z,y)))',
    '∃x:¬<(x,y)',
    '∀y:∃x:((<(z,x)∧<(x,y))∨(<(y,w)∧<(y,x)))',
    '∀x:∃y:((<(w,y)∧<(y,x))∨(<(x,z)∧<(y,x)))',
    '∃x:∀y:(<(x,y)∨=(x,y))',
    '∀x:∀y:(<(x,y)∨(<(y,x)∨=(x,y)))',
    '∃y:(=(y,z)∧¬<(y,w))',
  ]

  for (const source of cases) {
    it(`leaves no quantifier in ${source}`, () => {
      const { result } = eliminateQuantifiers(parseDlo(source))
      const walk = (node: FoFormula): boolean =>
        node.kind === 'quantified'
          ? false
          : node.kind === 'not'
            ? walk(node.body)
            : node.kind === 'binary'
              ? walk(node.left) && walk(node.right)
              : true
      expect(walk(result)).toBe(true)
    })

    it(`preserves the meaning of ${source}`, () => {
      const original = parseDlo(source)
      const { result } = eliminateQuantifiers(original)
      expect(agreesEverywhere(original, result)).toBe(true)
    })
  }

  it('records one step per quantifier', () => {
    const { steps } = eliminateQuantifiers(parseDlo('∀y:∃x:(<(z,x)∧<(x,y))'))
    expect(steps).toHaveLength(2)
    expect(steps[0]?.rule).toContain('∃x')
    expect(steps[1]?.rule).toContain('∀y')
  })

  it('proves the axioms themselves — density comes out ⊤', () => {
    const density = parseDlo('∀x:∀y:(<(x,y)→∃z:(<(x,z)∧<(z,y)))')
    expect(eliminateQuantifiers(density).result).toEqual({ kind: 'true' })
  })

  it('proves linearity comes out ⊤', () => {
    const linearity = parseDlo('∀x:∀y:(<(x,y)∨(<(y,x)∨=(x,y)))')
    expect(eliminateQuantifiers(linearity).result).toEqual({ kind: 'true' })
  })

  it('refutes a bounded statement — there is no least element', () => {
    const least = parseDlo('∃x:∀y:(<(x,y)∨=(x,y))')
    expect(eliminateQuantifiers(least).result).toEqual({ kind: 'false' })
  })
})

describe('exam questions', () => {
  // exam25a Q4.2.
  it('handles ∀y∃x:((z<x ∧ x<y) ∨ (y<w ∧ y<x))', () => {
    const source = parseDlo('∀y:∃x:((<(z,x)∧<(x,y))∨(<(y,w)∧<(y,x)))')
    const { result } = eliminateQuantifiers(source)
    expect(agreesEverywhere(source, result)).toBe(true)
    // ∃x collapses to z<y ∨ y<w — density for the left disjunct, and
    // unboundedness below for the right. Every y is covered exactly when the
    // two ranges overlap, which is z<w.
    expect(showDlo(result)).toBe('¬(w<z∨w=z)')
  })

  // exam26bA Q4.2.
  it('handles ∀x∃y:((w<y ∧ y<x) ∨ (x<z ∧ y<x))', () => {
    const source = parseDlo('∀x:∃y:((<(w,y)∧<(y,x))∨(<(x,z)∧<(y,x)))')
    const { result } = eliminateQuantifiers(source)
    expect(agreesEverywhere(source, result)).toBe(true)
    // The right disjunct only needs *some* y below x, which unboundedness
    // always supplies, so it holds whenever x<z; the left one needs a y
    // between w and x, so density makes it w<x. Every x is covered exactly
    // when w<z.
    expect(showDlo(result)).toBe('¬(z<w∨z=w)')
  })
})

describe('the axioms as written', () => {
  it('parses all five', () => {
    for (const axiom of DLO_AXIOMS) {
      expect(() => parseDlo(axiom.formula)).not.toThrow()
    }
  })

  it('every one of them is valid in the theory', () => {
    for (const axiom of DLO_AXIOMS) {
      expect(eliminateQuantifiers(parseDlo(axiom.formula)).result).toEqual({ kind: 'true' })
    }
  })
})

describe('simplification', () => {
  it('reads x<x as ⊥ and x=x as ⊤', () => {
    expect(simplifyDlo(parseDlo('<(x,x)'))).toEqual({ kind: 'false' })
    expect(simplifyDlo(parseDlo('=(x,x)'))).toEqual({ kind: 'true' })
  })

  it('drops a repeated conjunct', () => {
    expect(showDlo(simplifyDlo(parseDlo('(<(x,y)∧<(x,y))')))).toBe('x<y')
  })
})
