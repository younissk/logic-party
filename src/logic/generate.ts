/**
 * Random formula generation.
 *
 * This is what turns the app from a question bank into a drill machine: every
 * minigame asks for a formula with the shape and property it needs, and gets
 * an unlimited supply of them.
 */

import type { Formula } from './ast'
import { equals, FALSE, not, sortedVariables, TRUE, v } from './ast'
import type { Rng } from './rng'

export type Connective = 'not' | 'and' | 'or' | 'implies' | 'iff'

export const DEFAULT_VARIABLES = ['p', 'q', 'r', 's'] as const

export interface GenerateOptions {
  /** Pool to draw variable names from. */
  variables?: readonly string[]
  /** Which connectives may appear. */
  connectives?: readonly Connective[]
  /** Tree depth of the generated formula (1 = a bare atom). */
  depth?: number
  /** Reject formulas using fewer than this many distinct variables. */
  minDistinctVariables?: number
  /** Probability that any given subformula gets wrapped in ¬. */
  negationRate?: number
  /** Allow ⊤/⊥ to appear as leaves. */
  allowConstants?: boolean
}

interface ResolvedOptions {
  variables: readonly string[]
  connectives: readonly Connective[]
  depth: number
  minDistinctVariables: number
  negationRate: number
  allowConstants: boolean
}

function resolve(options: GenerateOptions): ResolvedOptions {
  const variables = options.variables ?? DEFAULT_VARIABLES
  if (variables.length === 0) throw new RangeError('Need at least one variable to generate a formula')
  return {
    variables,
    connectives: options.connectives ?? ['not', 'and', 'or', 'implies', 'iff'],
    depth: Math.max(1, options.depth ?? 3),
    minDistinctVariables: options.minDistinctVariables ?? 0,
    negationRate: options.negationRate ?? 0.18,
    allowConstants: options.allowConstants ?? false,
  }
}

function build(rng: Rng, options: ResolvedOptions, depth: number): Formula {
  const leaf = (): Formula => {
    if (options.allowConstants && rng.bool(0.08)) return rng.bool() ? TRUE : FALSE
    return v(rng.pick(options.variables))
  }

  if (depth <= 1) return leaf()

  const canNegate = options.connectives.includes('not')
  const binaries = options.connectives.filter((c): c is Exclude<Connective, 'not'> => c !== 'not')

  // A negation spends a level of the depth budget like any other node, so
  // `depth` stays a real bound on the generated tree.
  if (canNegate && rng.bool(options.negationRate)) return not(build(rng, options, depth - 1))

  // With no binary connectives available, the only way down is negation.
  if (binaries.length === 0) return canNegate ? not(build(rng, options, depth - 1)) : leaf()

  // One branch always spends the full remaining budget so the formula
  // actually reaches the requested depth; the other is shortened at random,
  // which is what stops every generated tree looking perfectly balanced.
  const kind = rng.pick(binaries)
  const deepSideIsLeft = rng.bool()
  const leftDepth = deepSideIsLeft ? depth - 1 : rng.range(1, depth - 1)
  const rightDepth = deepSideIsLeft ? rng.range(1, depth - 1) : depth - 1

  const left = build(rng, options, leftDepth)

  /**
   * Operands of a chain of this same connective. ∧ and ∨ are associative, so
   * `(a ∨ q) ∨ q` repeats an operand even though its two direct children
   * differ — the duplicate has to be looked for across the whole chain.
   */
  const operands = (f: Formula): Formula[] =>
    f.kind === kind && (kind === 'and' || kind === 'or')
      ? [...operands(f.left), ...operands(f.right)]
      : [f]

  const leftOperands = operands(left)
  const repeatsAnOperand = (candidate: Formula): boolean =>
    operands(candidate).some((r) => leftOperands.some((l) => equals(l, r)))

  // p ∨ p, q ↔ q and (a ∨ q) ∨ q inflate a formula without making it harder,
  // and tend to collapse it into something trivial. Resample first, since a
  // resampled subtree keeps the intended shape.
  let right = build(rng, options, rightDepth)
  for (let attempt = 0; attempt < 8 && repeatsAnOperand(right); attempt++) {
    right = build(rng, options, rightDepth)
  }

  // Resampling is a gamble that a small variable pool can lose, so fall back
  // to picking a variable the left side has not used. This makes "no node
  // combines an operand with itself" a guarantee rather than a probability,
  // whenever the pool still has an unused variable to offer.
  if (repeatsAnOperand(right)) {
    const used = new Set(leftOperands.flatMap((f) => (f.kind === 'var' ? [f.name] : [])))
    const unused = options.variables.filter((name) => !used.has(name))
    if (unused.length > 0) right = v(rng.pick(unused))
  }

  return { kind, left, right }
}

/**
 * Does any node in the formula combine an operand with *itself*?
 *
 * `r ∨ q ∨ q` and `p ↔ p` are noise: they inflate a formula without making it
 * harder, and usually collapse it to something trivial. ∧ and ∨ are
 * associative, so the duplicate has to be looked for across the whole chain —
 * `(a ∨ q) ∨ q` repeats an operand even though its two direct children differ.
 *
 * `build` already avoids this while generating, but it cannot always succeed:
 * a three-operand chain over a two-variable pool has no non-repeating form.
 * Callers that need the guarantee should pass this to `randomFormulaWhere`,
 * which simply draws again.
 */
export function repeatsAnOperand(formula: Formula): boolean {
  const chain = (f: Formula, kind: 'and' | 'or'): Formula[] =>
    f.kind === kind ? [...chain(f.left, kind), ...chain(f.right, kind)] : [f]

  switch (formula.kind) {
    case 'var':
    case 'const':
      return false
    case 'not':
      return repeatsAnOperand(formula.arg)
    default: {
      const parts =
        formula.kind === 'and' || formula.kind === 'or'
          ? [...chain(formula.left, formula.kind), ...chain(formula.right, formula.kind)]
          : [formula.left, formula.right]

      const duplicated = parts.some((a, i) => parts.some((b, j) => i < j && equals(a, b)))
      return duplicated || repeatsAnOperand(formula.left) || repeatsAnOperand(formula.right)
    }
  }
}

export function randomFormula(rng: Rng, options: GenerateOptions = {}): Formula {
  const resolved = resolve(options)

  for (let attempt = 0; attempt < 200; attempt++) {
    const formula = build(rng, resolved, resolved.depth)
    if (sortedVariables(formula).length >= resolved.minDistinctVariables) return formula
  }

  // Fall back to an explicit conjunction over the required variables so the
  // caller still gets something usable rather than an exception.
  const needed = resolved.variables.slice(0, Math.max(1, resolved.minDistinctVariables))
  return needed.map(v).reduce((left, right) => ({ kind: 'and', left, right }))
}

export class GenerationFailedError extends Error {
  constructor(attempts: number) {
    super(`Could not generate a formula matching the requested property in ${attempts} attempts`)
    this.name = 'GenerationFailedError'
  }
}

/**
 * Rejection-sample until the formula satisfies `predicate`.
 *
 * Use for "give me a contingent formula", "give me one whose CNF has at least
 * three clauses", "give me a satisfiable but non-trivial clause set".
 */
export function randomFormulaWhere(
  rng: Rng,
  options: GenerateOptions,
  predicate: (formula: Formula) => boolean,
  attempts = 300,
): Formula {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const formula = randomFormula(rng, options)
    if (predicate(formula)) return formula
  }
  throw new GenerationFailedError(attempts)
}

/**
 * Generation profiles per difficulty. Deliberately conservative on variable
 * count: a 4-variable truth table is 16 rows, which is already a long drill.
 */
export const FORMULA_PROFILES: Readonly<Record<'easy' | 'medium' | 'hard', GenerateOptions>> = {
  easy: {
    variables: ['p', 'q'],
    connectives: ['not', 'and', 'or'],
    depth: 3,
    minDistinctVariables: 2,
  },
  medium: {
    variables: ['p', 'q', 'r'],
    connectives: ['not', 'and', 'or', 'implies'],
    depth: 4,
    minDistinctVariables: 2,
  },
  hard: {
    variables: ['p', 'q', 'r', 's'],
    connectives: ['not', 'and', 'or', 'implies', 'iff'],
    depth: 5,
    minDistinctVariables: 3,
  },
}
