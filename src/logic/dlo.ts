/**
 * Quantifier elimination for unbounded dense linear orders — ln.pdf §5.1,
 * Theorem 5.6, exam25a Q4.2, exam26bA Q4.2, Exercise 10.
 *
 * The signature is two binary predicates, `<` and `=`, over variables only —
 * no function symbols, so every term is a variable. Five axioms:
 * irreflexivity, transitivity, linearity, density, unboundedness.
 *
 * The procedure the theorem's proof describes, made into code:
 *
 *   1. ∀x:Φ is ¬∃x:¬Φ, so only ∃ has to be eliminated.
 *   2. Work innermost-first, so the body is always quantifier-free.
 *   3. Push negations onto atoms and then *remove* them: ¬(y<z) becomes
 *      z<y ∨ z=y, and ¬(y=z) becomes y<z ∨ z<y. Linearity is what licenses
 *      both, and it is why the result has no negations left at all.
 *   4. Put the body in DNF and push ∃ inside the ∨.
 *   5. In each conjunction, the conjuncts not mentioning x come straight out.
 *   6. What is left is y₁<x ∧ … ∧ yₙ<x ∧ x<z₁ ∧ … ∧ x<zₘ. If either side is
 *      empty, unboundedness makes it true. Otherwise density makes it the
 *      cross product yᵢ<zⱼ — which is the whole trick.
 */

import {
  binary,
  atom,
  parseFormula,
  showFormula,
  type FoFormula,
  type FoSignature,
} from './fol'
import { toNegationNormalForm } from './foNormal'
import { isVar, type Term } from './terms'

export const DLO_SIGNATURE: FoSignature = {
  predicates: { '<': 2, '=': 2 },
  functions: {},
}

export const parseDlo = (source: string): FoFormula => parseFormula(source, DLO_SIGNATURE)

/** `x<y` printed as the notes print it, rather than as `<(x,y)`. */
export function showDlo(formula: FoFormula): string {
  switch (formula.kind) {
    case 'true':
      return '⊤'
    case 'false':
      return '⊥'
    case 'atom': {
      const [left, right] = formula.args as [Term, Term]
      return `${name(left)}${formula.predicate}${name(right)}`
    }
    case 'not':
      return `¬${showDlo(formula.body)}`
    case 'binary': {
      const symbol = { and: '∧', or: '∨', implies: '→', iff: '↔' }[formula.connective]
      return `(${showDlo(formula.left)}${symbol}${showDlo(formula.right)})`
    }
    case 'quantified':
      return `${formula.quantifier === 'forall' ? '∀' : '∃'}${formula.variable}:${showDlo(formula.body)}`
  }
}

const name = (term: Term): string => (isVar(term) ? term.name : showFormula(atom('?', [term])))

const less = (left: string, right: string): FoFormula =>
  atom('<', [
    { kind: 'var', name: left },
    { kind: 'var', name: right },
  ])

const equal = (left: string, right: string): FoFormula =>
  atom('=', [
    { kind: 'var', name: left },
    { kind: 'var', name: right },
  ])

const TRUE: FoFormula = { kind: 'true' }
const FALSE: FoFormula = { kind: 'false' }

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

interface Atom {
  relation: '<' | '='
  left: string
  right: string
}

const readAtom = (formula: FoFormula): Atom | null => {
  if (formula.kind !== 'atom') return null
  const [left, right] = formula.args as [Term, Term]
  if (!isVar(left) || !isVar(right)) return null
  return { relation: formula.predicate as '<' | '=', left: left.name, right: right.name }
}

const writeAtom = (atomValue: Atom): FoFormula =>
  atomValue.relation === '<'
    ? less(atomValue.left, atomValue.right)
    : equal(atomValue.left, atomValue.right)

// ---------------------------------------------------------------------------
// Removing negations, using linearity
// ---------------------------------------------------------------------------

/**
 * Turn every negated atom into a positive disjunction.
 *
 * Linearity (A3) says any two objects are ordered one way or equal, so
 * ¬(y<z) is exactly z<y ∨ z=y, and ¬(y=z) is exactly y<z ∨ z<y. After this
 * step nothing in the formula is negated, which is what lets the elimination
 * work with plain conjunctions of atoms.
 */
export function removeNegations(formula: FoFormula): FoFormula {
  const nnf = toNegationNormalForm(formula)

  const walk = (node: FoFormula): FoFormula => {
    switch (node.kind) {
      case 'not': {
        const inner = readAtom(node.body)
        if (inner === null) return node
        return inner.relation === '<'
          ? binary('or', less(inner.right, inner.left), equal(inner.right, inner.left))
          : binary('or', less(inner.left, inner.right), less(inner.right, inner.left))
      }
      case 'binary':
        return binary(node.connective, walk(node.left), walk(node.right))
      case 'quantified':
        return {
          kind: 'quantified',
          quantifier: node.quantifier,
          variable: node.variable,
          body: walk(node.body),
        }
      default:
        return node
    }
  }

  return walk(nnf)
}

// ---------------------------------------------------------------------------
// DNF
// ---------------------------------------------------------------------------

/** Disjunction of conjunctions, as lists — the shape the elimination wants. */
export function dnf(formula: FoFormula): FoFormula[][] {
  switch (formula.kind) {
    case 'true':
      return [[]]
    case 'false':
      return []
    case 'binary':
      if (formula.connective === 'or') return [...dnf(formula.left), ...dnf(formula.right)]
      if (formula.connective === 'and') {
        const left = dnf(formula.left)
        const right = dnf(formula.right)
        const product: FoFormula[][] = []
        for (const one of left) for (const two of right) product.push([...one, ...two])
        return product
      }
      return [[formula]]
    default:
      return [[formula]]
  }
}

const conjoin = (parts: readonly FoFormula[]): FoFormula => {
  if (parts.length === 0) return TRUE
  return parts.slice(1).reduce((left, part) => binary('and', left, part), parts[0] as FoFormula)
}

const disjoin = (parts: readonly FoFormula[]): FoFormula => {
  if (parts.length === 0) return FALSE
  return parts.slice(1).reduce((left, part) => binary('or', left, part), parts[0] as FoFormula)
}

// ---------------------------------------------------------------------------
// Eliminating one ∃
// ---------------------------------------------------------------------------

/**
 * `∃x:(conjunction of atoms)`, eliminated.
 *
 * Returns ⊤, ⊥, or a quantifier-free formula. The four cases are exactly the
 * proof's: an `x<x` kills it, an `x=y` substitutes, an empty side is satisfied
 * by unboundedness, and the general case is the cross product from density.
 */
export function eliminateConjunction(variable: string, conjuncts: readonly FoFormula[]): FoFormula {
  const atoms: Atom[] = []
  const free: FoFormula[] = []

  for (const conjunct of conjuncts) {
    if (conjunct.kind === 'true') continue
    if (conjunct.kind === 'false') return FALSE
    const parsed = readAtom(conjunct)
    if (parsed === null) {
      free.push(conjunct)
      continue
    }
    if (parsed.left !== variable && parsed.right !== variable) {
      free.push(conjunct)
      continue
    }
    atoms.push(parsed)
  }

  // x < x is unsatisfiable; x = x says nothing.
  for (const entry of atoms) {
    if (entry.left === variable && entry.right === variable) {
      if (entry.relation === '<') return FALSE
    }
  }
  const useful = atoms.filter(
    (entry) => !(entry.left === variable && entry.right === variable),
  )

  // An equation pins x down: substitute and drop the quantifier.
  const equation = useful.find((entry) => entry.relation === '=')
  if (equation !== undefined) {
    const other = equation.left === variable ? equation.right : equation.left
    const substituted = useful
      .filter((entry) => entry !== equation)
      .map((entry) => ({
        ...entry,
        left: entry.left === variable ? other : entry.left,
        right: entry.right === variable ? other : entry.right,
      }))
      // x<x became y<y, which is false by irreflexivity.
      .map((entry) =>
        entry.relation === '<' && entry.left === entry.right ? null : entry,
      )
    if (substituted.some((entry) => entry === null)) return FALSE
    return simplifyDlo(
      conjoin([
        ...free,
        ...(substituted as Atom[]).map(writeAtom),
      ]),
    )
  }

  const below = useful
    .filter((entry) => entry.relation === '<' && entry.right === variable)
    .map((entry) => entry.left)
  const above = useful
    .filter((entry) => entry.relation === '<' && entry.left === variable)
    .map((entry) => entry.right)

  // Unboundedness: with nothing on one side, an x always exists.
  if (below.length === 0 || above.length === 0) return simplifyDlo(conjoin(free))

  // Density: an x strictly between them exists exactly when every lower bound
  // is below every upper bound.
  const crossed: FoFormula[] = []
  for (const low of below) {
    for (const high of above) {
      if (low === high) return FALSE
      crossed.push(less(low, high))
    }
  }
  return simplifyDlo(conjoin([...free, ...crossed]))
}

/** `∃x:Φ` for a quantifier-free Φ. */
export function eliminateExists(variable: string, body: FoFormula): FoFormula {
  const positive = removeNegations(body)
  const disjuncts = dnf(positive)
  if (disjuncts.length === 0) return FALSE
  return simplifyDlo(
    disjoin(disjuncts.map((conjuncts) => eliminateConjunction(variable, conjuncts))),
  )
}

// ---------------------------------------------------------------------------
// Simplification
// ---------------------------------------------------------------------------

/** Constant folding, duplicate atoms dropped, and x<x collapsed. */
export function simplifyDlo(formula: FoFormula): FoFormula {
  const walk = (node: FoFormula): FoFormula => {
    switch (node.kind) {
      case 'atom': {
        const parsed = readAtom(node)
        if (parsed === null) return node
        if (parsed.left === parsed.right) {
          return parsed.relation === '<' ? FALSE : TRUE
        }
        return node
      }
      case 'not': {
        const body = walk(node.body)
        if (body.kind === 'true') return FALSE
        if (body.kind === 'false') return TRUE
        return { kind: 'not', body }
      }
      case 'binary': {
        const left = walk(node.left)
        const right = walk(node.right)
        if (node.connective === 'and') {
          if (left.kind === 'false' || right.kind === 'false') return FALSE
          if (left.kind === 'true') return right
          if (right.kind === 'true') return left
          return dedupe('and', left, right)
        }
        if (node.connective === 'or') {
          if (left.kind === 'true' || right.kind === 'true') return TRUE
          if (left.kind === 'false') return right
          if (right.kind === 'false') return left
          return dedupe('or', left, right)
        }
        return binary(node.connective, left, right)
      }
      case 'quantified': {
        const body = walk(node.body)
        if (body.kind === 'true' || body.kind === 'false') return body
        return {
          kind: 'quantified',
          quantifier: node.quantifier,
          variable: node.variable,
          body,
        }
      }
      default:
        return node
    }
  }
  return walk(formula)
}

/** Flatten a chain of ∧ or ∨, drop repeats, rebuild. */
function dedupe(connective: 'and' | 'or', left: FoFormula, right: FoFormula): FoFormula {
  const parts: FoFormula[] = []
  const collect = (node: FoFormula): void => {
    if (node.kind === 'binary' && node.connective === connective) {
      collect(node.left)
      collect(node.right)
      return
    }
    const key = showDlo(node)
    if (!parts.some((existing) => showDlo(existing) === key)) parts.push(node)
  }
  collect(left)
  collect(right)
  return connective === 'and' ? conjoin(parts) : disjoin(parts)
}

// ---------------------------------------------------------------------------
// The whole procedure
// ---------------------------------------------------------------------------

export interface DloStep {
  /** What was done, in the proof's own words. */
  rule: string
  result: FoFormula
}

export const DLO_AXIOMS: readonly { name: string; formula: string }[] = [
  { name: 'irreflexivity', formula: '∀x:¬<(x,x)' },
  { name: 'transitivity', formula: '∀x:∀y:∀z:((<(x,y)∧<(y,z))→<(x,z))' },
  { name: 'linearity', formula: '∀x:∀y:(<(x,y)∨<(y,x)∨=(x,y))' },
  { name: 'density', formula: '∀x:∀y:(<(x,y)→∃z:(<(x,z)∧<(z,y)))' },
  { name: 'unboundedness', formula: '∀x:∃y:∃z:(<(y,x)∧<(x,z))' },
]

/**
 * Eliminate every quantifier, innermost first.
 *
 * A ∀ is turned into ¬∃¬ first, which is where the negations that step 3
 * removes come from — so the two halves of the procedure feed each other.
 */
export function eliminateQuantifiers(
  formula: FoFormula,
  limit = 40,
): { result: FoFormula; steps: DloStep[] } {
  const steps: DloStep[] = []
  let current = simplifyDlo(formula)

  for (let round = 0; round < limit; round++) {
    const target = innermostQuantifier(current)
    if (target === null) break

    const replacement =
      target.node.quantifier === 'exists'
        ? eliminateExists(target.node.variable, target.node.body)
        : simplifyDlo({
            kind: 'not',
            body: eliminateExists(target.node.variable, { kind: 'not', body: target.node.body }),
          })

    current = simplifyDlo(replace(current, target.path, replacement))
    steps.push({
      rule:
        target.node.quantifier === 'exists'
          ? `eliminated ∃${target.node.variable}`
          : `∀${target.node.variable} as ¬∃${target.node.variable}¬, then eliminated`,
      result: current,
    })
  }

  return { result: current, steps }
}

/** The innermost quantifier — one whose body has no quantifier left. */
function innermostQuantifier(
  formula: FoFormula,
  path: number[] = [],
): { node: FoFormula & { kind: 'quantified' }; path: number[] } | null {
  switch (formula.kind) {
    case 'not':
      return innermostQuantifier(formula.body, [...path, 0])
    case 'binary':
      return (
        innermostQuantifier(formula.left, [...path, 0]) ??
        innermostQuantifier(formula.right, [...path, 1])
      )
    case 'quantified': {
      const deeper = innermostQuantifier(formula.body, [...path, 0])
      return deeper ?? { node: formula, path }
    }
    default:
      return null
  }
}

function replace(formula: FoFormula, path: readonly number[], replacement: FoFormula): FoFormula {
  if (path.length === 0) return replacement
  const [step, ...rest] = path
  switch (formula.kind) {
    case 'not':
      return { kind: 'not', body: replace(formula.body, rest, replacement) }
    case 'quantified':
      return {
        kind: 'quantified',
        quantifier: formula.quantifier,
        variable: formula.variable,
        body: replace(formula.body, rest, replacement),
      }
    case 'binary':
      return step === 0
        ? binary(formula.connective, replace(formula.left, rest, replacement), formula.right)
        : binary(formula.connective, formula.left, replace(formula.right, rest, replacement))
    default:
      return formula
  }
}

// ---------------------------------------------------------------------------
// Checking against a concrete model
// ---------------------------------------------------------------------------

/**
 * Truth in a finite sample of ℚ.
 *
 * A finite set is not a model of the theory — it fails density and
 * unboundedness — so this cannot decide the theory. What it *can* do is catch a
 * wrong elimination: if Φ and its supposed quantifier-free equivalent disagree
 * on a concrete assignment of rationals to their free variables, one of them is
 * wrong. Used by the tests, not by the marking.
 */
export function valueAt(
  formula: FoFormula,
  env: Readonly<Record<string, number>>,
): boolean {
  switch (formula.kind) {
    case 'true':
      return true
    case 'false':
      return false
    case 'atom': {
      const parsed = readAtom(formula)
      if (parsed === null) return false
      const left = env[parsed.left]
      const right = env[parsed.right]
      if (left === undefined || right === undefined) {
        throw new Error(`No value for ${left === undefined ? parsed.left : parsed.right}`)
      }
      return parsed.relation === '<' ? left < right : left === right
    }
    case 'not':
      return !valueAt(formula.body, env)
    case 'binary': {
      const left = valueAt(formula.left, env)
      const right = valueAt(formula.right, env)
      switch (formula.connective) {
        case 'and':
          return left && right
        case 'or':
          return left || right
        case 'implies':
          return !left || right
        case 'iff':
          return left === right
      }
      return false
    }
    case 'quantified':
      throw new Error('valueAt is for quantifier-free formulas')
  }
}
