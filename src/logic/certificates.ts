/**
 * Certificates — ln.pdf §2.5 (RUP, Definition 2.47, Algorithm 2.50) and §2.4
 * (blocked clauses, Definition 2.33).
 *
 * A solver saying SAT is easy to trust: it hands you a model and you check it
 * in a second. A solver saying UNSAT is a bare claim, and a solver is half a
 * million lines of optimised C that does have bugs. Since 2013 every SAT
 * competition has required a machine-checkable proof of unsatisfiability, and
 * the format is DRAT — which is built on RUP. This is how "provably
 * impossible" becomes something you can check rather than believe.
 */

import type { Clause, Literal } from './normal'
import { isTautologicalClause, literalsEqual } from './normal'
import { clauseKey, normaliseClause, resolveOn } from './resolution'
import { bcp } from './solving'

const negate = (literal: Literal): Literal => ({ name: literal.name, negated: !literal.negated })

// ---------------------------------------------------------------------------
// RUP — Definition 2.47
// ---------------------------------------------------------------------------

/**
 * The unit clauses you get by negating a clause.
 *
 * The one piece of notation to get right: ¬(a ∨ ¬b) is (¬a) ∧ (b) — a clause
 * of n literals negates into n *separate* unit clauses, not one clause.
 */
export const negateClause = (clause: Clause): Clause[] => clause.map((literal) => [negate(literal)])

/**
 * Does this clause have the RUP property with respect to this formula?
 *
 * Assume the clause is false — which is exactly adding its negation as units —
 * then propagate. If that crashes, the clause was already implied and adding
 * it cannot turn a satisfiable formula unsatisfiable (Theorem 2.48).
 *
 * The special case worth remembering: the *empty* clause has the RUP property
 * exactly when BCP(φ) reaches ⊥ on its own, with no units added at all. So the
 * last line of every RUP proof is asking whether the earlier lines made plain
 * propagation enough.
 */
export function hasRupProperty(clauses: readonly Clause[], candidate: Clause): boolean {
  return bcp([...clauses, ...negateClause(candidate)]).outcome === 'unsatisfiable'
}

export interface RupCheck {
  ok: boolean
  /** Index of the first line that failed, or null when the whole proof checks. */
  failedAt: number | null
  /** True when the proof ends in the empty clause, as a refutation must. */
  endsInEmpty: boolean
}

/**
 * Algorithm 2.50: walk the proof, checking each line against everything before
 * it, and adding it as you go. Each line you add makes the next one easier.
 */
export function checkRupProof(clauses: readonly Clause[], proof: readonly Clause[]): RupCheck {
  const current: Clause[] = clauses.map((clause) => normaliseClause(clause))

  for (let index = 0; index < proof.length; index++) {
    const line = proof[index] as Clause
    if (!hasRupProperty(current, line)) {
      return { ok: false, failedAt: index, endsInEmpty: false }
    }
    current.push(normaliseClause(line))
  }

  const last = proof[proof.length - 1]
  const endsInEmpty = last !== undefined && last.length === 0
  return { ok: endsInEmpty, failedAt: null, endsInEmpty }
}

/**
 * Look for a short RUP refutation, preferring the smallest clauses.
 *
 * This is the method the exam wants rather than a clever search: guess a small
 * clause, check it propagates to ⊥, add it, repeat. Units first because they
 * constrain the most, then binary clauses. Finding the proof is the easy half
 * — the point of RUP is that *checking* needs nothing but propagation.
 */
export function findRupProof(clauses: readonly Clause[], maxSteps = 4): Clause[] | null {
  const variables = [...new Set(clauses.flatMap((clause) => clause.map((literal) => literal.name)))].sort(
    (a, b) => a.localeCompare(b),
  )

  const units: Clause[] = variables.flatMap((name) => [
    [{ name, negated: false }],
    [{ name, negated: true }],
  ])
  const binaries: Clause[] = []
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const left = (units[i] as Clause)[0] as Literal
      const right = (units[j] as Clause)[0] as Literal
      if (left.name === right.name) continue
      binaries.push(normaliseClause([left, right]))
    }
  }

  const proof: Clause[] = []
  const current: Clause[] = clauses.map((clause) => normaliseClause(clause))

  for (let step = 0; step < maxSteps; step++) {
    if (hasRupProperty(current, [])) {
      proof.push([])
      return proof
    }

    const next = [...units, ...binaries].find(
      (candidate) =>
        !current.some((clause) => clauseKey(clause) === clauseKey(candidate)) &&
        hasRupProperty(current, candidate),
    )
    if (next === undefined) return null

    proof.push(next)
    current.push(next)
  }

  return null
}

// ---------------------------------------------------------------------------
// Blocked clauses — Definition 2.33
// ---------------------------------------------------------------------------

/**
 * Is this clause blocked on this literal?
 *
 * For *every* clause D of the formula containing ¬l, the resolvent Res_l(C, D)
 * must be a tautology. C itself is excluded, which is what "blocked in φ"
 * means: blocked with respect to φ \ {C}.
 *
 * The shortcut that solves most exam questions: if l is **pure** — nothing in
 * the formula contains ¬l — then there are no D at all and the condition holds
 * vacuously. A pure literal is automatically blocked, with zero checking.
 */
export function isBlockedOn(clauses: readonly Clause[], clause: Clause, literal: Literal): boolean {
  if (!clause.some((other) => literalsEqual(other, literal))) return false

  const opposite = negate(literal)
  const others = clauses.filter((other) => clauseKey(other) !== clauseKey(clause))

  return others
    .filter((other) => other.some((entry) => literalsEqual(entry, opposite)))
    .every((other) => {
      const resolvent = resolveOn(clause, other, literal.name)
      return resolvent === null || isTautologicalClause(resolvent)
    })
}

/** A literal this clause is blocked on, or null when it is not blocked at all. */
export function blockingLiteral(clauses: readonly Clause[], clause: Clause): Literal | null {
  return clause.find((literal) => isBlockedOn(clauses, clause, literal)) ?? null
}

export const isBlockedClause = (clauses: readonly Clause[], clause: Clause): boolean =>
  blockingLiteral(clauses, clause) !== null

/** Literals whose complement appears nowhere — each is automatically blocked. */
export function pureLiterals(clauses: readonly Clause[]): Literal[] {
  const seen = new Map<string, Literal>()
  for (const clause of clauses) {
    for (const literal of clause) seen.set(`${literal.negated ? '¬' : ''}${literal.name}`, literal)
  }
  return [...seen.values()].filter(
    (literal) => !seen.has(`${literal.negated ? '' : '¬'}${literal.name}`),
  )
}

export interface BceStep {
  clause: Clause
  /** The literal it was blocked on. */
  literal: Literal
  /** True when that literal was pure, so the check was vacuous. */
  pure: boolean
  result: Clause[]
}

export interface BceRun {
  steps: BceStep[]
  result: Clause[]
  /** True when everything was eliminated, which proves the formula satisfiable. */
  complete: boolean
}

/**
 * Blocked clause elimination, run to fixpoint.
 *
 * Removing a blocked clause preserves satisfiability but not equivalence
 * (Theorem 2.34), so reaching the empty formula proves the original is
 * satisfiable — though it does not hand you a model.
 *
 * Removing one clause can *unblock* another, which is the whole reason this
 * cascades: (¬b ∨ ¬d ∨ ¬e) is not blocked in Example 2.35's φ but is blocked
 * in φ₁. So the order matters for the trace even though the fixpoint does not.
 */
export function bce(clauses: readonly Clause[]): BceRun {
  const steps: BceStep[] = []
  let current = clauses.map((clause) => normaliseClause(clause))

  for (;;) {
    const pure = new Set(
      pureLiterals(current).map((literal) => `${literal.negated ? '¬' : ''}${literal.name}`),
    )

    let removed: BceStep | null = null
    for (const clause of current) {
      const literal = blockingLiteral(current, clause)
      if (literal === null) continue
      const rest = current.filter((other) => clauseKey(other) !== clauseKey(clause))
      removed = {
        clause,
        literal,
        pure: pure.has(`${literal.negated ? '¬' : ''}${literal.name}`),
        result: rest,
      }
      break
    }

    if (removed === null) break
    steps.push(removed)
    current = removed.result
  }

  return { steps, result: current, complete: current.length === 0 }
}
