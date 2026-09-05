/**
 * Semantic questions about formulas.
 *
 * Everything here that can fail returns a *witness* rather than a bare
 * boolean: the assignment that makes the formula false, the row where two
 * formulas disagree, the countermodel to an argument. Feedback like
 * "wrong — try p=T, q=F" is worth far more to a student than "wrong".
 */

import type { Formula } from './ast'
import { sortedVariables } from './ast'
import type { Assignment } from './evaluate'
import { evaluate } from './evaluate'
import { allAssignments } from './truthTable'

export type Classification = 'tautology' | 'contradiction' | 'contingent'

const unionVariables = (formulas: readonly Formula[]): string[] => {
  const names = new Set<string>()
  for (const formula of formulas) for (const name of sortedVariables(formula)) names.add(name)
  return [...names].sort((a, b) => a.localeCompare(b))
}

/** Every assignment satisfying the formula. */
export function models(formula: Formula): Assignment[] {
  const variables = sortedVariables(formula)
  return allAssignments(variables).filter((assignment) => evaluate(formula, assignment))
}

export function countModels(formula: Formula): number {
  const variables = sortedVariables(formula)
  let count = 0
  for (const assignment of allAssignments(variables)) {
    if (evaluate(formula, assignment)) count++
  }
  return count
}

/**
 * Models counted over a stated set of variables, which may be larger than the
 * set the formula mentions.
 *
 * "How many models does φ have" is not a question about φ alone — it is a
 * question about φ *and the variables under discussion*. A variable the
 * formula never mentions is free, so it doubles the count: (a ∨ b) has 3
 * models over {a, b} and 6 over {a, b, c}. Exam questions state the variable
 * set for exactly this reason, and dropping it is the classic way to lose the
 * mark.
 */
export function countModelsOver(formula: Formula, variables: readonly string[]): number {
  const mentioned = sortedVariables(formula)
  const missing = mentioned.filter((name) => !variables.includes(name))
  if (missing.length > 0) {
    throw new RangeError(
      `Formula mentions ${missing.join(', ')}, which the variable set does not contain`,
    )
  }
  return countModels(formula) * 2 ** (variables.length - mentioned.length)
}

/** A satisfying assignment, or null if the formula is unsatisfiable. */
export function findModel(formula: Formula): Assignment | null {
  const variables = sortedVariables(formula)
  for (const assignment of allAssignments(variables)) {
    if (evaluate(formula, assignment)) return assignment
  }
  return null
}

/** An assignment making the formula false, or null if it is a tautology. */
export function findCounterexample(formula: Formula): Assignment | null {
  const variables = sortedVariables(formula)
  for (const assignment of allAssignments(variables)) {
    if (!evaluate(formula, assignment)) return assignment
  }
  return null
}

export const isSatisfiable = (formula: Formula): boolean => findModel(formula) !== null
export const isTautology = (formula: Formula): boolean => findCounterexample(formula) === null
export const isContradiction = (formula: Formula): boolean => findModel(formula) === null

export function classify(formula: Formula): Classification {
  if (isContradiction(formula)) return 'contradiction'
  if (isTautology(formula)) return 'tautology'
  return 'contingent'
}

/**
 * An assignment where the two formulas differ, or null if they are
 * logically equivalent. Compared over the union of their variables, so
 * `p` and `p ∧ (q ∨ ¬q)` come out equivalent.
 */
export function findDistinguishingAssignment(a: Formula, b: Formula): Assignment | null {
  const variables = unionVariables([a, b])
  for (const assignment of allAssignments(variables)) {
    if (evaluate(a, assignment) !== evaluate(b, assignment)) return assignment
  }
  return null
}

export const isEquivalent = (a: Formula, b: Formula): boolean =>
  findDistinguishingAssignment(a, b) === null

/**
 * An assignment satisfying every premise while falsifying the conclusion —
 * i.e. a counterexample to the argument. Null means the entailment holds.
 */
export function findCountermodel(
  premises: readonly Formula[],
  conclusion: Formula,
): Assignment | null {
  const variables = unionVariables([...premises, conclusion])
  for (const assignment of allAssignments(variables)) {
    const premisesHold = premises.every((premise) => evaluate(premise, assignment))
    if (premisesHold && !evaluate(conclusion, assignment)) return assignment
  }
  return null
}

export const entails = (premises: readonly Formula[], conclusion: Formula): boolean =>
  findCountermodel(premises, conclusion) === null

/**
 * Does the formula's value actually depend on this variable?
 *
 * `(p → q) ∧ q` does not depend on p: it is just `q` wearing a costume. A
 * variable that makes no difference is a *fictitious* variable, and an
 * exercise containing one is far easier than it looks — which is exactly the
 * wrong way for a drill to be easy.
 */
export function dependsOn(formula: Formula, variable: string): boolean {
  const others = sortedVariables(formula).filter((name) => name !== variable)
  for (const assignment of allAssignments(others)) {
    const whenFalse = evaluate(formula, { ...assignment, [variable]: false })
    const whenTrue = evaluate(formula, { ...assignment, [variable]: true })
    if (whenFalse !== whenTrue) return true
  }
  return false
}

/** True when every variable mentioned in the formula genuinely matters. */
export function dependsOnAllVariables(formula: Formula): boolean {
  return sortedVariables(formula).every((name) => dependsOn(formula, name))
}

/** Human-readable assignment, e.g. "p = T, q = F". */
export function showAssignment(assignment: Assignment): string {
  return Object.keys(assignment)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `${name} = ${assignment[name] ? 'T' : 'F'}`)
    .join(', ')
}
