/**
 * Theories, made finite enough to compute with — ln.pdf §5.1, Definitions 5.1
 * and 5.3.
 *
 * A theory is a set of closed formulas closed under logical consequence. That
 * definition quantifies over all structures, which is not something a game can
 * evaluate. So everything here is *relative to a finite class of structures*:
 * fix a small universe and a small signature, list every structure over it,
 * and consequence becomes "true in every one of these that satisfies the
 * premises" — a set intersection.
 *
 * The restriction is real and the games say so. What it buys is that every
 * claim about subsets, unions and completeness becomes decidable, so a
 * counterexample can be *built* by a player and *checked* by the app rather
 * than recalled from a lecture. The claims that come out are the same ones the
 * exams ask about, because they are claims about closure, and closure behaves
 * the same way over four structures as over all of them.
 *
 * A theory is represented by its set of models — the indices of the structures
 * satisfying it. That representation makes the algebra trivial and correct:
 *
 *   T₁ ⊆ T₂            exactly when  models(T₂) ⊆ models(T₁)
 *   T₁ ∩ T₂ is a theory, of models(T₁) ∪ models(T₂)
 *   T₁ ∪ T₂ generally is not; its closure has models(T₁) ∩ models(T₂)
 *
 * The last line is the whole point of the union question: a formula true in
 * every model of both theories together can easily be in neither.
 */

import { holdsIn, type Structure } from './foSemantics'
import type { FoFormula } from './fol'

export interface StructureClass {
  /** Every structure under consideration, in a fixed order. */
  structures: Structure[]
  /** One short label per structure, for display. */
  labels: string[]
  /** The signature they interpret. */
  predicates: Record<string, number>
  functions: Record<string, number>
}

/**
 * Every structure on `size` elements interpreting one unary predicate.
 *
 * Four of them for a two-element universe, which is small enough to show all
 * at once and big enough for ∀ and ∃ to come apart.
 */
export function unaryClass(size: number, predicate = 'p'): StructureClass {
  const structures: Structure[] = []
  const labels: string[] = []
  const labelNames = size === 2 ? ['1', '2'] : Array.from({ length: size }, (_, i) => String(i + 1))

  for (let bits = 0; bits < 1 << size; bits++) {
    const table = Array.from({ length: size }, (_, index) => ((bits >> index) & 1) === 1)
    structures.push({
      size,
      labels: labelNames,
      functions: {},
      predicates: { [predicate]: table },
    })
    const inside = labelNames.filter((_, index) => table[index] === true)
    labels.push(`${predicate}={${inside.join(',')}}`)
  }
  return { structures, labels, predicates: { [predicate]: 1 }, functions: {} }
}

/** The structures in the class that satisfy every one of the formulas. */
export function modelsOf(
  world: StructureClass,
  formulas: readonly FoFormula[],
): number[] {
  return world.structures
    .map((_, index) => index)
    .filter((index) =>
      formulas.every((formula) => holdsIn(world.structures[index] as Structure, formula)),
    )
}

/** Whether a formula is in the theory whose models are exactly `models`. */
export function inTheory(
  world: StructureClass,
  models: readonly number[],
  formula: FoFormula,
): boolean {
  return models.every((index) => holdsIn(world.structures[index] as Structure, formula))
}

/** Which formulas of a catalogue belong to the theory. */
export const theoryMembers = (
  world: StructureClass,
  models: readonly number[],
  catalogue: readonly FoFormula[],
): FoFormula[] => catalogue.filter((formula) => inTheory(world, models, formula))

/**
 * Consistency — Definition 5.3.
 *
 * An inconsistent theory contains every formula, which happens exactly when it
 * has no model at all: the "every model satisfies it" test is vacuous.
 */
export const isConsistent = (models: readonly number[]): boolean => models.length > 0

/**
 * Completeness, relative to a catalogue.
 *
 * A complete theory decides every closed formula: it contains φ or ¬φ. Over a
 * class of structures that is exactly "all its models agree", so a theory with
 * two models that a catalogue formula tells apart is incomplete, and that
 * formula is the witness.
 */
export function completenessWitness(
  world: StructureClass,
  models: readonly number[],
  catalogue: readonly FoFormula[],
): FoFormula | null {
  for (const formula of catalogue) {
    const values = models.map((index) => holdsIn(world.structures[index] as Structure, formula))
    if (values.some((value) => value !== values[0])) return formula
  }
  return null
}

export const isComplete = (
  world: StructureClass,
  models: readonly number[],
  catalogue: readonly FoFormula[],
): boolean => isConsistent(models) && completenessWitness(world, models, catalogue) === null

// ---------------------------------------------------------------------------
// The set operations
// ---------------------------------------------------------------------------

const intersect = (left: readonly number[], right: readonly number[]): number[] =>
  left.filter((index) => right.includes(index))

const union = (left: readonly number[], right: readonly number[]): number[] =>
  [...new Set([...left, ...right])].sort((a, b) => a - b)

/** Models of the intersection of two theories — always itself a theory. */
export const intersectionModels = union

/**
 * Models of the *closure* of the union of two theories.
 *
 * The union itself need not be closed. Everything both theories entail
 * together is true in the structures that model both, so this is where its
 * closure lives.
 */
export const unionClosureModels = intersect

/**
 * A formula showing that T₁ ∪ T₂ is not closed: entailed by the two together
 * and in neither of them.
 */
export function unionWitness(
  world: StructureClass,
  left: readonly number[],
  right: readonly number[],
  catalogue: readonly FoFormula[],
): FoFormula | null {
  const both = unionClosureModels(left, right)
  for (const formula of catalogue) {
    if (!inTheory(world, both, formula)) continue
    if (inTheory(world, left, formula)) continue
    if (inTheory(world, right, formula)) continue
    return formula
  }
  return null
}

/**
 * A formula showing a subset of a theory is not itself a theory: entailed by
 * the subset, and not in it.
 */
export function subsetWitness(
  world: StructureClass,
  models: readonly number[],
  subset: readonly FoFormula[],
  catalogue: readonly FoFormula[],
): FoFormula | null {
  const subsetModels = modelsOf(world, subset)
  for (const formula of catalogue) {
    if (!inTheory(world, subsetModels, formula)) continue
    if (subset.some((member) => member === formula)) continue
    if (!inTheory(world, models, formula)) continue
    return formula
  }
  return null
}
