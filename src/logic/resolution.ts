/**
 * Resolution — ln.pdf §2.3, Definition 2.22, Examples 2.23–2.24.
 *
 * One inference rule, and the reason a tool can say "provably impossible"
 * rather than "I tried and gave up": resolution is *refutation complete*. If a
 * clause set is unsatisfiable, resolving long enough always produces the empty
 * clause.
 *
 * Three facts do most of the work in an exam:
 *
 *   1. One pivot per step. Two clauses clashing on two variables give two
 *      separate resolvents; you never cancel both at once.
 *   2. Cancelling one pivot while another clash survives gives a tautology —
 *      the surviving pair sits in the result.
 *   3. Clauses are sets. a ∨ b ∨ a is a ∨ b.
 */

import type { Clause, Literal } from './normal'
import { areComplementary, isTautologicalClause, literalsEqual, showClause } from './normal'

/** Guard: saturation is finite (3ⁿ clauses over n variables) but not small. */
export const MAX_SATURATION_CLAUSES = 4000

export class SaturationTooLargeError extends Error {
  constructor() {
    super(`Resolution produced more than ${MAX_SATURATION_CLAUSES} clauses`)
    this.name = 'SaturationTooLargeError'
  }
}

// ---------------------------------------------------------------------------
// Clauses as sets
// ---------------------------------------------------------------------------

/** Duplicates removed, literals in a canonical order. Clauses are sets. */
export function normaliseClause(clause: Clause): Clause {
  const unique: Literal[] = []
  for (const literal of clause) {
    if (!unique.some((seen) => literalsEqual(seen, literal))) unique.push(literal)
  }
  return unique.sort((a, b) =>
    a.name === b.name ? Number(a.negated) - Number(b.negated) : a.name.localeCompare(b.name),
  )
}

/** Identity of a clause as a set, for membership and de-duplication. */
export const clauseKey = (clause: Clause): string =>
  normaliseClause(clause)
    .map((literal) => `${literal.negated ? '¬' : ''}${literal.name}`)
    .join('|')

export const clausesEqual = (a: Clause, b: Clause): boolean => clauseKey(a) === clauseKey(b)

export const clauseVariables = (clause: Clause): string[] => [
  ...new Set(clause.map((literal) => literal.name)),
]

/** Variables two clauses have in common — resolution needs at least one. */
export function sharedVariables(a: Clause, b: Clause): string[] {
  const right = new Set(b.map((literal) => literal.name))
  return [...new Set(a.map((literal) => literal.name))].filter((name) => right.has(name))
}

// ---------------------------------------------------------------------------
// The rule
// ---------------------------------------------------------------------------

export interface Resolution {
  readonly left: Clause
  readonly right: Clause
  /** The variable cancelled. Exactly one per step. */
  readonly pivot: string
  readonly resolvent: Clause
}

/**
 * Resolve two clauses on one variable, or null when they do not clash on it.
 *
 * Only the pivot pair is deleted. Any *other* complementary pair in the two
 * parents survives into the result and makes it a tautology — which is the
 * whole point of the exam question that says "also include tautological
 * resolvents".
 */
export function resolveOn(a: Clause, b: Clause, pivot: string): Clause | null {
  const inA = a.filter((literal) => literal.name === pivot)
  const inB = b.filter((literal) => literal.name === pivot)
  if (!inA.some((left) => inB.some((right) => areComplementary(left, right)))) return null

  return normaliseClause([
    ...a.filter((literal) => literal.name !== pivot),
    ...b.filter((literal) => literal.name !== pivot),
  ])
}

/**
 * Every resolvent of one pair of clauses — one per clashing variable.
 *
 * Two clauses that clash on two variables produce two resolvents, both
 * tautological. Cancelling both at once is not a resolution step and is the
 * standard way to get this question wrong.
 */
export function resolvents(a: Clause, b: Clause): Resolution[] {
  const out: Resolution[] = []
  for (const pivot of sharedVariables(a, b)) {
    const resolvent = resolveOn(a, b, pivot)
    if (resolvent !== null) out.push({ left: a, right: b, pivot, resolvent })
  }
  return out
}

/** Every resolvent of every unordered pair, tautologies included. */
export function allResolvents(set: readonly Clause[]): Resolution[] {
  const out: Resolution[] = []
  for (let i = 0; i < set.length; i++) {
    for (let j = i + 1; j < set.length; j++) {
      out.push(...resolvents(set[i] as Clause, set[j] as Clause))
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Saturation and derivability
// ---------------------------------------------------------------------------

export interface DerivedClause {
  readonly clause: Clause
  /** Null for an input clause. */
  readonly from: { left: Clause; right: Clause; pivot: string } | null
  /** How many resolution steps deep this clause was first reached. */
  readonly depth: number
}

/**
 * Resolve to fixpoint, recording how each clause was first reached.
 *
 * Tautologies are dropped rather than kept. Resolution stays refutation
 * complete without them, and keeping them explodes the search for no gain —
 * a valid clause constrains nothing. They still matter to the *one-step*
 * question, which is why `allResolvents` keeps them and this does not.
 */
export function saturate(set: readonly Clause[]): DerivedClause[] {
  const derived: DerivedClause[] = []
  const seen = new Map<string, number>()

  const push = (entry: DerivedClause): boolean => {
    const key = clauseKey(entry.clause)
    if (seen.has(key)) return false
    seen.set(key, derived.length)
    derived.push(entry)
    return true
  }

  for (const clause of set) {
    if (isTautologicalClause(clause)) continue
    push({ clause: normaliseClause(clause), from: null, depth: 0 })
  }

  let frontier = 0
  while (frontier < derived.length) {
    const current = derived[frontier] as DerivedClause
    frontier++

    // Resolve against everything already known, including itself's peers.
    for (let index = 0; index < derived.length; index++) {
      if (index === frontier - 1) continue
      const other = derived[index] as DerivedClause

      for (const step of resolvents(current.clause, other.clause)) {
        if (isTautologicalClause(step.resolvent)) continue
        push({
          clause: step.resolvent,
          from: { left: current.clause, right: other.clause, pivot: step.pivot },
          depth: Math.max(current.depth, other.depth) + 1,
        })
        if (derived.length > MAX_SATURATION_CLAUSES) throw new SaturationTooLargeError()
      }
    }
  }

  return derived
}

/**
 * Can resolution derive exactly this clause from this set?
 *
 * Decided by saturating rather than by entailment, because they are different
 * questions. Resolution derives a clause *at most as wide* as any it entails,
 * so an entailed clause can still be underivable — (c ∨ d) in the exam is
 * entailed by nothing it can reach, and every route to it goes through a
 * tautology.
 */
export function isDerivable(set: readonly Clause[], target: Clause): boolean {
  if (isTautologicalClause(target)) {
    // A tautology is never *derived*: saturation drops it, and it is not an
    // input unless it was written down as one.
    return set.some((clause) => clausesEqual(clause, target))
  }
  const key = clauseKey(target)
  return saturate(set).some((entry) => clauseKey(entry.clause) === key)
}

/** True when resolution reaches the empty clause — i.e. the set is unsatisfiable. */
export const refutable = (set: readonly Clause[]): boolean => isDerivable(set, [])

// ---------------------------------------------------------------------------
// Refutations
// ---------------------------------------------------------------------------

/**
 * A derivation of the empty clause, or null if the set is satisfiable.
 *
 * Reconstructed backwards from ⊥ through the parents saturation recorded, so
 * it contains only the steps the refutation actually needs — which makes its
 * length a fair par to score a player's own attempt against.
 */
export function findRefutation(set: readonly Clause[]): Resolution[] | null {
  let derived: DerivedClause[]
  try {
    derived = saturate(set)
  } catch {
    return null
  }

  const byKey = new Map(derived.map((entry) => [clauseKey(entry.clause), entry]))
  const empty = byKey.get('')
  if (empty === undefined) return null

  const steps: Resolution[] = []
  const done = new Set<string>()

  const walk = (clause: Clause): void => {
    const key = clauseKey(clause)
    if (done.has(key)) return
    done.add(key)
    const entry = byKey.get(key)
    if (entry === undefined || entry.from === null) return
    walk(entry.from.left)
    walk(entry.from.right)
    steps.push({
      left: entry.from.left,
      right: entry.from.right,
      pivot: entry.from.pivot,
      resolvent: entry.clause,
    })
  }

  walk([])
  return steps
}

/**
 * The shortest refutation, or null when the set is satisfiable.
 *
 * `findRefutation` reconstructs *a* derivation — whichever one saturation
 * happened to record a parent for — and that is routinely longer than
 * necessary. This relaxes a cost over the whole saturation instead: a clause
 * costs one step more than the two it comes from, iterated to fixpoint, so the
 * result does not depend on the order clauses were found in. The parents of
 * the best route are kept, and the derivation is rebuilt from them.
 *
 * The relaxation charges a derivation *tree*, so a route reusing one
 * intermediate clause twice pays for it twice; the rebuilt derivation is a DAG
 * and shares it, which is why the returned list can be shorter than the cost
 * that chose it. Both are real refutations, so either is a fair par.
 */
export function shortestRefutation(set: readonly Clause[]): Resolution[] | null {
  let derived: DerivedClause[]
  try {
    derived = saturate(set)
  } catch {
    return null
  }
  if (!derived.some((entry) => entry.clause.length === 0)) return null
  // Relaxation is quadratic in the saturation; on anything big, take the
  // derivation we already have rather than spending the time.
  if (derived.length > 400) return findRefutation(set)

  const cost = new Map<string, number>()
  const best = new Map<string, { left: Clause; right: Clause; pivot: string }>()
  const byKey = new Map(derived.map((entry) => [clauseKey(entry.clause), entry.clause]))
  for (const entry of derived) {
    if (entry.from === null) cost.set(clauseKey(entry.clause), 0)
  }

  for (let round = 0; round < derived.length; round++) {
    let improved = false
    for (let i = 0; i < derived.length; i++) {
      const left = (derived[i] as DerivedClause).clause
      const leftCost = cost.get(clauseKey(left))
      if (leftCost === undefined) continue

      for (let j = i + 1; j < derived.length; j++) {
        const right = (derived[j] as DerivedClause).clause
        const rightCost = cost.get(clauseKey(right))
        if (rightCost === undefined) continue

        for (const step of resolvents(left, right)) {
          if (isTautologicalClause(step.resolvent)) continue
          const key = clauseKey(step.resolvent)
          const candidate = leftCost + rightCost + 1
          if (candidate < (cost.get(key) ?? Infinity)) {
            cost.set(key, candidate)
            best.set(key, { left, right, pivot: step.pivot })
            improved = true
          }
        }
      }
    }
    if (!improved) break
  }

  if (!cost.has('')) return findRefutation(set)

  const steps: Resolution[] = []
  const done = new Set<string>()
  const walk = (clause: Clause): void => {
    const key = clauseKey(clause)
    if (done.has(key)) return
    done.add(key)
    const parents = best.get(key)
    if (parents === undefined) return
    walk(parents.left)
    walk(parents.right)
    steps.push({ ...parents, resolvent: byKey.get(key) ?? clause })
  }
  walk([])
  return steps
}

/** How many steps the shortest refutation takes, or null when there is none. */
export function refutationCost(set: readonly Clause[]): number | null {
  return shortestRefutation(set)?.length ?? null
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Split a clause set into groups that share no variables.
 *
 * Resolution needs a shared variable, so two components can never be mixed —
 * which instantly rules out any candidate clause drawing letters from both. It
 * is the single insight that kills half the options in the exam's "is this
 * derivable" question without any work at all.
 */
export function components(set: readonly Clause[]): Clause[][] {
  const parent = new Map<string, string>()
  const find = (name: string): string => {
    const seen = parent.get(name)
    if (seen === undefined || seen === name) return name
    const root = find(seen)
    parent.set(name, root)
    return root
  }
  const union = (a: string, b: string) => {
    const [ra, rb] = [find(a), find(b)]
    if (ra !== rb) parent.set(ra, rb)
  }

  for (const clause of set) {
    for (const literal of clause) if (!parent.has(literal.name)) parent.set(literal.name, literal.name)
    const names = clauseVariables(clause)
    for (let i = 1; i < names.length; i++) union(names[0] as string, names[i] as string)
  }

  const groups = new Map<string, Clause[]>()
  for (const clause of set) {
    // An empty clause belongs to no component; give it its own group.
    const root = clause.length === 0 ? '⊥' : find((clause[0] as Literal).name)
    groups.set(root, [...(groups.get(root) ?? []), clause])
  }
  return [...groups.values()]
}

/** True when the two clauses cannot possibly interact: no shared variable. */
export const disjointComponents = (a: Clause, b: Clause): boolean => sharedVariables(a, b).length === 0

export const showResolution = (step: Resolution): string =>
  `Res_${step.pivot}(${showClause(step.left)}, ${showClause(step.right)}) = ${showClause(step.resolvent)}`
