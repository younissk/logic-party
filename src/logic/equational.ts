/**
 * Equational theories — ln.pdf §3.3, Definition 3.16 and Theorem 3.19.
 *
 * `E ⊢ t=t′` means the equation can be built from E by four closure rules:
 * take an axiom, instantiate it, rewrite a subterm with it, and close under
 * reflexivity, symmetry and transitivity. Operationally that is one move:
 * find a subterm matching either side of an axiom and swap it for the other
 * side. A chain of such moves from t to t′ is a proof.
 *
 * The search is bounded, and it has to be: Theorem 3.29 says no algorithm
 * decides this in general. So a positive answer here is a proof — the chain is
 * returned — while a negative answer is only "not within these bounds". To
 * show something is genuinely *not* derivable, use a countermodel instead:
 * Theorem 3.19 makes ⊢ and ⊨ the same relation, so an interpretation that
 * satisfies every axiom and breaks the goal settles it.
 */

import {
  positions,
  replaceAt,
  showTerm,
  subtermAt,
  termSize,
  termsEqual,
  type Equation,
  type Term,
} from './terms'
import { applySubstitution, match } from './substitution'
import {
  INTERPRETATIONS,
  checkNamed,
  type InterpretationId,
} from './interpretation'

export interface SearchLimits {
  /** Terms bigger than this are not explored. */
  maxSize: number
  /** Give up after this many distinct terms. */
  maxTerms: number
}

export const DEFAULT_LIMITS: SearchLimits = { maxSize: 14, maxTerms: 4000 }

/** One move: an axiom used in one direction at one position. */
export interface TheoryStep {
  from: Term
  to: Term
  axiom: Equation
  /** True when the axiom was used right-to-left. */
  reversed: boolean
  position: readonly number[]
}

/**
 * Every term one closure step away.
 *
 * Both directions, because Definition 3.16 closes under symmetry: an axiom is
 * an equation, not a rule, and the theory does not care which side you came
 * from. This is exactly what makes the search space infinite in both
 * directions and the graph search of §3.3 hopeless.
 */
export function oneStep(axioms: readonly Equation[], term: Term, maxSize: number): TheoryStep[] {
  const steps: TheoryStep[] = []
  for (const position of positions(term)) {
    const sub = subtermAt(term, position)
    if (sub === undefined) continue
    for (const axiom of axioms) {
      for (const reversed of [false, true]) {
        const pattern = reversed ? axiom.right : axiom.left
        const replacement = reversed ? axiom.left : axiom.right
        const sigma = match(pattern, sub)
        if (sigma === null) continue
        const to = replaceAt(term, position, applySubstitution(sigma, replacement))
        if (termSize(to) > maxSize) continue
        if (termsEqual(to, term)) continue
        steps.push({ from: term, to, axiom, reversed, position })
      }
    }
  }
  return steps
}

export interface Derivation {
  derivable: boolean
  /** The terms visited, from the goal's left side to its right. */
  chain: Term[]
  /** The moves between them, one shorter than the chain. */
  steps: TheoryStep[]
  /** True when the search hit its budget rather than exhausting the space. */
  exhausted: boolean
}

/**
 * Search for a proof of `E ⊢ t=t′`.
 *
 * Breadth-first from the left side, so the chain returned is a shortest one —
 * which is what makes it readable as an explanation rather than a transcript.
 */
export function derive(
  axioms: readonly Equation[],
  goal: Equation,
  limits: SearchLimits = DEFAULT_LIMITS,
): Derivation {
  const start = goal.left
  const target = goal.right
  if (termsEqual(start, target)) {
    return { derivable: true, chain: [start], steps: [], exhausted: false }
  }

  const cameFrom = new Map<string, { previous: string; step: TheoryStep }>()
  const seen = new Map<string, Term>([[showTerm(start), start]])
  let frontier: Term[] = [start]

  while (frontier.length > 0 && seen.size <= limits.maxTerms) {
    const next: Term[] = []
    for (const term of frontier) {
      for (const step of oneStep(axioms, term, limits.maxSize)) {
        const key = showTerm(step.to)
        if (seen.has(key)) continue
        seen.set(key, step.to)
        cameFrom.set(key, { previous: showTerm(term), step })

        if (termsEqual(step.to, target)) {
          const chain: Term[] = []
          const steps: TheoryStep[] = []
          let cursor = key
          while (true) {
            chain.unshift(seen.get(cursor) as Term)
            const back = cameFrom.get(cursor)
            if (back === undefined) break
            steps.unshift(back.step)
            cursor = back.previous
          }
          return { derivable: true, chain, steps, exhausted: false }
        }
        next.push(step.to)
      }
    }
    frontier = next
  }

  return {
    derivable: false,
    chain: [],
    steps: [],
    exhausted: seen.size > limits.maxTerms,
  }
}

export const derivable = (
  axioms: readonly Equation[],
  goal: Equation,
  limits?: SearchLimits,
): boolean => derive(axioms, goal, limits).derivable

// ---------------------------------------------------------------------------
// The other direction: showing an equation is not derivable
// ---------------------------------------------------------------------------

export interface Countermodel {
  id: InterpretationId
  /** Where the goal fails under it. */
  where: string
}

/**
 * An interpretation satisfying every axiom but breaking the goal.
 *
 * By Theorem 3.19 that is a proof of `E ⊬ t=t′`, and a far better answer than
 * "the search gave up": it is checkable by hand in a line.
 */
export function findRefutingInterpretation(
  axioms: readonly Equation[],
  goal: Equation,
): Countermodel | null {
  for (const id of Object.keys(INTERPRETATIONS) as InterpretationId[]) {
    if (!axioms.every((axiom) => checkNamed(id, axiom).holds)) continue
    const broken = checkNamed(id, goal)
    if (broken.holds) continue
    if (broken.counterexample === null) continue
    return { id, where: broken.counterexample }
  }
  return null
}

export type TheoryVerdict =
  | { status: 'derivable'; derivation: Derivation }
  | { status: 'not-derivable'; countermodel: Countermodel }
  | { status: 'unknown' }

/**
 * Decide `E ⊢ t=t′` when it can be decided.
 *
 * Proof first, countermodel second, and an honest `unknown` when neither
 * lands — which is the shape Theorem 3.29 forces on any such function.
 */
export function decide(
  axioms: readonly Equation[],
  goal: Equation,
  limits?: SearchLimits,
): TheoryVerdict {
  const derivation = derive(axioms, goal, limits)
  if (derivation.derivable) return { status: 'derivable', derivation }
  const countermodel = findRefutingInterpretation(axioms, goal)
  if (countermodel !== null) return { status: 'not-derivable', countermodel }
  return { status: 'unknown' }
}
