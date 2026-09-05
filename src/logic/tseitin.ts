/**
 * Tseitin transformation — ln.pdf §2.2, Algorithm 2.19.
 *
 * Naive CNF distributes, and distribution is exponential: (a∧b) ∨ (c∧d) ∨
 * (e∧f) becomes 8 clauses, ten such pairs become 1024. Tseitin instead gives
 * every subformula a *name* and writes down what the name means. Each
 * definition costs a fixed handful of clauses, so the result grows linearly.
 * That single fact is why a ten-million-gate circuit can be handed to a SAT
 * solver at all.
 *
 * The price is that the result is only *satisfiability* equivalent, not
 * equivalent (Definition 2.21): the fresh variables mean the two formulas have
 * different models. Any model of the CNF is still a model of the original once
 * the fresh variables are dropped.
 */

import type { Formula } from './ast'
import { not, v } from './ast'
import type { Clause, Literal } from './normal'
import { conjuncts, disjuncts, isLiteral } from './normal'

/** A `t ↔ χ` definition and the clauses that encode it. */
export interface Definition {
  /** The fresh variable. */
  readonly name: string
  /**
   * What it names, with any inner subformulas already replaced by their own
   * names — so this is always "simple" in the sense of Algorithm 2.19: its
   * immediate subformulas are literals.
   */
  readonly formula: Formula
  readonly clauses: Clause[]
}

export interface TseitinResult {
  /**
   * The definitions introduced, inside-out — a definition only ever mentions
   * names introduced before it.
   */
  readonly definitions: Definition[]
  /** The clauses of the top level, after its parts were replaced by names. */
  readonly rootClauses: Clause[]
  /** Everything: the definition clauses followed by the top-level clauses. */
  readonly clauses: Clause[]
}

const positive = (name: string): Literal => ({ name, negated: false })
const negative = (name: string): Literal => ({ name, negated: true })

/** Flip a literal. */
export const negateLiteral = (literal: Literal): Literal => ({
  name: literal.name,
  negated: !literal.negated,
})

function asLiteral(formula: Formula): Literal {
  if (formula.kind === 'var') return positive(formula.name)
  if (formula.kind === 'not' && formula.arg.kind === 'var') return negative(formula.arg.name)
  throw new TypeError('Expected a literal')
}

/**
 * The clause table of Algorithm 2.19: the CNF of `t ↔ χ`.
 *
 * Written out per connective rather than derived, because these exact clause
 * sets are what the exam asks for — and then checked semantically in the tests
 * against `t ↔ χ`, so a typo here cannot survive.
 *
 * The shape to remember, for t ↔ (a ∨ b): one wide clause going *out* of t
 * (¬t ∨ a ∨ b), and one small clause per disjunct going *in* (¬a ∨ t, ¬b ∨ t).
 * Conjunction is the mirror image. Getting a sign backwards — writing (¬a ∨ z)
 * as (a ∨ ¬z) — is the classic lost mark, so derive them from t ↔ χ rather
 * than recalling them.
 */
export function definitionClauses(name: string, formula: Formula): Clause[] {
  const t = positive(name)
  const notT = negative(name)

  if (formula.kind === 'not') {
    const a = asLiteral(formula.arg)
    return [
      [notT, negateLiteral(a)],
      [t, a],
    ]
  }

  if (formula.kind === 'var' || formula.kind === 'const') {
    throw new TypeError('A definition names a compound subformula, not an atom')
  }

  const a = asLiteral(formula.left)
  const b = asLiteral(formula.right)
  const notA = negateLiteral(a)
  const notB = negateLiteral(b)

  switch (formula.kind) {
    case 'or':
      return [
        [notT, a, b],
        [notA, t],
        [notB, t],
      ]
    case 'and':
      return [
        [notA, notB, t],
        [notT, a],
        [notT, b],
      ]
    case 'implies':
      return [
        [notT, notA, b],
        [a, t],
        [notB, t],
      ]
    case 'iff':
      return [
        [notT, notA, b],
        [notT, a, notB],
        [a, b, t],
        [notA, notB, t],
      ]
  }
}

/** How many clauses `t ↔ χ` costs. Four for ↔, two for ¬, three otherwise. */
export function definitionClauseCount(kind: Formula['kind']): number {
  if (kind === 'iff') return 4
  if (kind === 'not') return 2
  return 3
}

export interface TseitinOptions {
  /** Prefix for the fresh variables. Default `t`, so t1, t2, … */
  readonly prefix?: string
  /**
   * Whether ¬ gets a definition of its own.
   *
   * Off by default, which is the convention the course exercises use: a
   * negation is already a literal, so it rides along inside the clause instead
   * of costing a name. Turning it on follows the clause table literally.
   */
  readonly defineNegations?: boolean
  /** Names already taken, so a fresh variable really is fresh. */
  readonly taken?: readonly string[]
}

/**
 * Apply the transformation.
 *
 * Two things make the output match what the exercises expect. First, naming is
 * inside-out, so a definition never mentions a name that does not exist yet.
 * Second, the top level is only descended *through* — a formula that is
 * already a clause is kept as one rather than given a name of its own, which
 * is why x ∨ ¬(y ∨ ¬(z ∨ x)) comes out as 7 clauses and not 9.
 */
export function tseitin(formula: Formula, options: TseitinOptions = {}): TseitinResult {
  const { prefix = 't', defineNegations = false } = options
  const taken = new Set(options.taken ?? [])
  const definitions: Definition[] = []

  const fresh = (): string => {
    let index = definitions.length + 1
    while (taken.has(`${prefix}${index}`)) index++
    const name = `${prefix}${index}`
    taken.add(name)
    return name
  }

  const define = (simple: Formula): Literal => {
    const name = fresh()
    definitions.push({ name, formula: simple, clauses: definitionClauses(name, simple) })
    return positive(name)
  }

  /** A definition body built from literals, so a child's sign survives. */
  const simpleFrom = (kind: 'and' | 'or' | 'implies' | 'iff', a: Literal, b: Literal): Formula => ({
    kind,
    left: a.negated ? not(v(a.name)) : v(a.name),
    right: b.negated ? not(v(b.name)) : v(b.name),
  })

  const reduce = (f: Formula): Literal => {
    if (f.kind === 'var') return positive(f.name)
    if (f.kind === 'const') throw new TypeError('Simplify away truth constants before Tseitin')
    if (f.kind === 'not') {
      const inner = reduce(f.arg)
      // ¬¬x is still a legal definition body: its argument is a literal.
      return defineNegations
        ? define(not(inner.negated ? not(v(inner.name)) : v(inner.name)))
        : negateLiteral(inner)
    }
    return define(simpleFrom(f.kind, reduce(f.left), reduce(f.right)))
  }

  // Descend through the CNF skeleton the formula already has, and only name
  // the parts that are not literals.
  const rootClauses: Clause[] = conjuncts(formula).map((conjunct) =>
    disjuncts(conjunct).map((disjunct) => (isLiteral(disjunct) ? asLiteral(disjunct) : reduce(disjunct))),
  )

  return { definitions, rootClauses, clauses: [...definitions.flatMap((d) => d.clauses), ...rootClauses] }
}
