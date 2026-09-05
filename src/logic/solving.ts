/**
 * Solving — ln.pdf §2.4: BCP, the DP procedure, DPLL, and clause learning.
 *
 * These four are the actual machinery of a SAT solver. BCP is most of a modern
 * solver's runtime; DPLL is the 1962 skeleton every solver still has; and the
 * decision tree turned upside down *is* a resolution refutation, which is the
 * deepest idea in the chapter — search and proof are the same object.
 */

import type { Clause, Literal } from './normal'
import { areComplementary, isTautologicalClause, literalsEqual } from './normal'
import { clauseKey, clauseVariables, normaliseClause, resolveOn, type Resolution } from './resolution'

const negate = (literal: Literal): Literal => ({ name: literal.name, negated: !literal.negated })

// ---------------------------------------------------------------------------
// BCP — Definition 2.39
// ---------------------------------------------------------------------------

/**
 * One application of BCP: assume the unit literal is true.
 *
 * Two mechanical moves, and only these two:
 *   - delete every clause containing l — it is already satisfied;
 *   - erase ¬l from every clause it appears in — that literal is dead.
 * A clause containing neither is untouched.
 */
export function bcpStep(clauses: readonly Clause[], literal: Literal): Clause[] {
  return clauses
    .filter((clause) => !clause.some((other) => literalsEqual(other, literal)))
    .map((clause) => clause.filter((other) => !areComplementary(other, literal)))
}

/**
 * What BCP concluded once no unit clauses remain.
 *
 * Naming which of the three you hit is half the exam question, and they are
 * not symmetric: the empty *formula* means satisfiable, the empty *clause*
 * means unsatisfiable, and anything else means BCP is simply out of moves.
 */
export type BcpOutcome = 'satisfiable' | 'unsatisfiable' | 'undecided'

export interface BcpStepRecord {
  /** The unit literal propagated. */
  literal: Literal
  /** The clause set after propagating it. */
  result: Clause[]
}

export interface BcpRun {
  steps: BcpStepRecord[]
  /** The clause set at fixpoint. */
  result: Clause[]
  outcome: BcpOutcome
}

export function bcpOutcome(clauses: readonly Clause[]): BcpOutcome {
  if (clauses.some((clause) => clause.length === 0)) return 'unsatisfiable'
  return clauses.length === 0 ? 'satisfiable' : 'undecided'
}

/**
 * BCP to fixpoint, keeping every step.
 *
 * Units are taken in the order they appear. The notes prove the order does not
 * matter — BCP(BCP(φ, l), k) = BCP(BCP(φ, k), l) — so any order reaches the
 * same fixpoint, and taking the first keeps the trace readable.
 */
export function bcp(clauses: readonly Clause[]): BcpRun {
  const steps: BcpStepRecord[] = []
  let current = clauses.map((clause) => normaliseClause(clause))

  for (;;) {
    if (current.some((clause) => clause.length === 0)) break
    const unit = current.find((clause) => clause.length === 1)
    if (unit === undefined) break

    const literal = unit[0] as Literal
    current = bcpStep(current, literal)
    steps.push({ literal, result: current })
  }

  return { steps, result: current, outcome: bcpOutcome(current) }
}

// ---------------------------------------------------------------------------
// DP — variable elimination
// ---------------------------------------------------------------------------

export interface EliminationStep {
  variable: string
  /** Clauses mentioning the variable, which all get deleted. */
  removed: Clause[]
  /** Resolvents kept — tautologies are thrown away. */
  added: Clause[]
  /** Resolvents that were tautologies, so you can see how many were dropped. */
  discarded: Clause[]
  result: Clause[]
}

/**
 * Eliminate one variable by resolution — the DP step.
 *
 * Resolve *every* clause containing v against *every* clause containing ¬v,
 * throw away the tautologies, then delete all the originals mentioning v and
 * add the survivors. No tree, no backtracking: DP deletes variables, DPLL
 * guesses them, and mixing the two up is the classic confusion.
 */
export function eliminateVariable(clauses: readonly Clause[], variable: string): EliminationStep {
  const positive = clauses.filter((clause) =>
    clause.some((literal) => literal.name === variable && !literal.negated),
  )
  const negative = clauses.filter((clause) =>
    clause.some((literal) => literal.name === variable && literal.negated),
  )
  const untouched = clauses.filter((clause) => !clause.some((literal) => literal.name === variable))
  const removed = clauses.filter((clause) => clause.some((literal) => literal.name === variable))

  const added: Clause[] = []
  const discarded: Clause[] = []
  for (const left of positive) {
    for (const right of negative) {
      const resolvent = resolveOn(left, right, variable)
      if (resolvent === null) continue
      if (isTautologicalClause(resolvent)) {
        discarded.push(resolvent)
        continue
      }
      if (!added.some((clause) => clauseKey(clause) === clauseKey(resolvent))) added.push(resolvent)
    }
  }

  const result: Clause[] = [...untouched]
  for (const clause of added) {
    if (!result.some((existing) => clauseKey(existing) === clauseKey(clause))) result.push(clause)
  }

  return { variable, removed, added, discarded, result }
}

export interface DpRun {
  steps: EliminationStep[]
  result: Clause[]
  /** Empty formula means satisfiable; the empty clause means unsatisfiable. */
  verdict: 'satisfiable' | 'unsatisfiable'
}

/** Run DP to the end, eliminating variables in the given order (default: alphabetical). */
export function dp(clauses: readonly Clause[], order?: readonly string[]): DpRun {
  const variables =
    order ??
    [...new Set(clauses.flatMap(clauseVariables))].sort((a, b) => a.localeCompare(b))

  const steps: EliminationStep[] = []
  let current = clauses.map((clause) => normaliseClause(clause))

  for (const variable of variables) {
    if (current.some((clause) => clause.length === 0)) break
    if (!current.some((clause) => clause.some((literal) => literal.name === variable))) continue
    const step = eliminateVariable(current, variable)
    steps.push(step)
    current = step.result
  }

  return {
    steps,
    result: current,
    verdict: current.some((clause) => clause.length === 0) ? 'unsatisfiable' : 'satisfiable',
  }
}

// ---------------------------------------------------------------------------
// DPLL
// ---------------------------------------------------------------------------

/** A literal BCP forced, together with the clause that forced it. */
export interface PropagatedLiteral {
  literal: Literal
  /**
   * The *original* clause that went unit.
   *
   * Definition 2.39's view rewrites the formula, which loses this. The mirror
   * needs it: turning the tree into a refutation resolves a propagated literal
   * away against the very clause that forced it, so a propagation without its
   * reason cannot be undone.
   */
  reason: Clause
}

const valueOf = (assignment: ReadonlyMap<string, boolean>, literal: Literal): boolean | undefined => {
  const value = assignment.get(literal.name)
  return value === undefined ? undefined : value !== literal.negated
}

export interface PropagationResult {
  forced: PropagatedLiteral[]
  /** A clause every literal of which is false — null when there is no conflict. */
  conflict: Clause | null
}

/**
 * BCP over an assignment rather than over the formula.
 *
 * Same fixpoint as `bcp`, but it keeps the original clauses and records why
 * each literal was forced, which is what DPLL and the mirror need.
 */
export function propagate(
  clauses: readonly Clause[],
  assumed: readonly Literal[],
): PropagationResult {
  const assignment = new Map<string, boolean>()
  const forced: PropagatedLiteral[] = []
  for (const literal of assumed) assignment.set(literal.name, !literal.negated)

  for (;;) {
    let progressed = false

    for (const clause of clauses) {
      let unassigned: Literal | null = null
      let satisfied = false
      let unassignedCount = 0

      for (const literal of clause) {
        const value = valueOf(assignment, literal)
        if (value === true) {
          satisfied = true
          break
        }
        if (value === undefined) {
          unassigned = literal
          unassignedCount++
        }
      }
      if (satisfied) continue

      if (unassignedCount === 0) return { forced, conflict: clause }
      if (unassignedCount === 1 && unassigned !== null) {
        assignment.set(unassigned.name, !unassigned.negated)
        forced.push({ literal: unassigned, reason: clause })
        progressed = true
      }
    }

    if (!progressed) return { forced, conflict: null }
  }
}

export interface DpllLeaf {
  kind: 'conflict' | 'model'
  /** Literals BCP forced on entry to this node, with their reasons. */
  propagated: PropagatedLiteral[]
  /** For a conflict: the clause that is false under this path. */
  conflict: Clause | null
  /** Decisions and propagations from the root to here. */
  path: Literal[]
}

export interface DpllBranch {
  kind: 'branch'
  propagated: PropagatedLiteral[]
  /** The variable decided here. */
  variable: string
  /** The notes decide false first, so this is the left-hand, dashed edge. */
  whenFalse: DpllNode
  whenTrue: DpllNode
  path: Literal[]
}

export type DpllNode = DpllLeaf | DpllBranch

/**
 * Run DPLL and keep the whole decision tree.
 *
 * Two conventions, both fixed by the notes so that the tree is unique:
 * propagate as early as possible, and when a decision is needed take the
 * alphabetically first unassigned variable. Example 2.43 sets it to *false*
 * first, which is the dashed edge in Figure 2.4.
 *
 * This explores *both* branches always, giving the complete decision tree.
 * Algorithm 2.42 returns as soon as a branch succeeds, so on a satisfiable
 * formula a real run stops early and its tree is a prefix of this one — which
 * is why the leaf count is only a well-defined question about an unsatisfiable
 * set, and why the minigame poses nothing else.
 */
export function dpll(clauses: readonly Clause[]): DpllNode {
  const set = clauses.map((clause) => normaliseClause(clause))
  const variables = [...new Set(set.flatMap(clauseVariables))].sort((a, b) => a.localeCompare(b))

  const build = (assumed: Literal[]): DpllNode => {
    const result = propagate(set, assumed)
    const path = [...assumed, ...result.forced.map((entry) => entry.literal)]

    if (result.conflict !== null) {
      return { kind: 'conflict', propagated: result.forced, conflict: result.conflict, path }
    }

    const assigned = new Set(path.map((literal) => literal.name))
    const next = variables.find((name) => !assigned.has(name))
    if (next === undefined) {
      return { kind: 'model', propagated: result.forced, conflict: null, path }
    }

    return {
      kind: 'branch',
      propagated: result.forced,
      variable: next,
      path,
      whenFalse: build([...path, { name: next, negated: true }]),
      whenTrue: build([...path, { name: next, negated: false }]),
    }
  }

  return build([])
}

/**
 * An original clause every literal of which is false under this assignment.
 *
 * This is the conflict clause a leaf is annotated with, and the input clause
 * the refutation starts from. Where several qualify, the first is taken —
 * any of them refutes the branch equally well.
 */
export function falsifiedClause(clauses: readonly Clause[], assignment: readonly Literal[]): Clause | null {
  const assigned = new Map(assignment.map((literal) => [literal.name, !literal.negated]))
  return (
    clauses.find((clause) =>
      clause.every((literal) => {
        const value = assigned.get(literal.name)
        return value !== undefined && value === literal.negated
      }),
    ) ?? null
  )
}

/** Every leaf of the tree, left to right — the order Figure 2.4 draws them. */
export function leaves(node: DpllNode): DpllLeaf[] {
  if (node.kind !== 'branch') return [node]
  return [...leaves(node.whenFalse), ...leaves(node.whenTrue)]
}

export const countLeaves = (node: DpllNode): number => leaves(node).length

export const isUnsatisfiableTree = (node: DpllNode): boolean =>
  leaves(node).every((leaf) => leaf.kind === 'conflict')

// ---------------------------------------------------------------------------
// The mirror: a decision tree is a resolution refutation upside down
// ---------------------------------------------------------------------------

export interface MirrorResult {
  /** The clause this subtree proves. □ at the root of a refuted tree. */
  clause: Clause
  steps: Resolution[]
}

/**
 * Turn a DPLL tree into the resolution refutation it already is.
 *
 * Each conflict leaf contributes the clause that went false there. Walking up,
 * two kinds of literal have to be resolved away:
 *
 *   - a **propagated** literal, against the clause that forced it. Figure 2.4
 *     draws these in boxes and they are resolved on just like any other.
 *   - a **decision** variable, by resolving the two sibling branches together
 *     — the whole reason the branch existed.
 *
 * A child whose clause does not mention the decision variable was already
 * false without the decision, so it passes straight up with no step: that
 * branch was never needed. Which is why a refutation is usually smaller than
 * the tree is wide.
 *
 * The variables cancel in the reverse of the order they were assigned, which
 * is the observation the exercise is really about.
 */
export function treeToRefutation(node: DpllNode): MirrorResult | null {
  /** Resolve away this node's own propagations, innermost first. */
  const undoPropagations = (start: Clause, propagated: readonly PropagatedLiteral[], steps: Resolution[]): Clause => {
    let clause = start
    for (let index = propagated.length - 1; index >= 0; index--) {
      const entry = propagated[index] as PropagatedLiteral
      const complement = clause.some(
        (literal) => literal.name === entry.literal.name && literal.negated !== entry.literal.negated,
      )
      if (!complement) continue
      const resolvent = resolveOn(clause, entry.reason, entry.literal.name)
      if (resolvent === null) continue
      steps.push({ left: clause, right: entry.reason, pivot: entry.literal.name, resolvent })
      clause = resolvent
    }
    return clause
  }

  const walk = (current: DpllNode): MirrorResult | null => {
    // Checked positively: `kind` on a leaf is a two-value union, so excluding
    // both values one at a time does not narrow to the branch case.
    if (current.kind !== 'branch') {
      if (current.kind === 'model' || current.conflict === null) return null
      const steps: Resolution[] = []
      return { clause: undoPropagations(current.conflict, current.propagated, steps), steps }
    }

    const left = walk(current.whenFalse)
    const right = walk(current.whenTrue)
    if (left === null || right === null) return null

    const steps = [...left.steps, ...right.steps]
    const mentions = (clause: Clause) => clause.some((literal) => literal.name === current.variable)

    let combined: Clause
    if (!mentions(left.clause)) {
      combined = left.clause
    } else if (!mentions(right.clause)) {
      combined = right.clause
    } else {
      const resolvent = resolveOn(left.clause, right.clause, current.variable)
      if (resolvent === null) return null
      steps.push({ left: left.clause, right: right.clause, pivot: current.variable, resolvent })
      combined = resolvent
    }

    return { clause: undoPropagations(combined, current.propagated, steps), steps }
  }

  return walk(node)
}

// ---------------------------------------------------------------------------
// CDCL — clause learning
// ---------------------------------------------------------------------------

export interface LearnedClause {
  /** The decisions in force when the conflict happened. */
  decisions: Literal[]
  /** Their negation, as a clause — what the solver records. */
  clause: Clause
}

/**
 * The clause a solver learns from a conflict, in the scheme Example 2.45 uses.
 *
 * The decisions that led here were jointly impossible, so their negation must
 * hold: decide a = F and b = F, hit a conflict, and (a ∨ b) is forced. Only
 * *decisions* go in — anything BCP derived is already a consequence of them,
 * and including it would give a weaker clause that fires later.
 *
 * Real solvers learn smaller clauses than this by analysing which assignments
 * actually took part in the conflict. This scheme is the one the notes teach,
 * and it is what the exam asks for.
 */
export function learnFromDecisions(decisions: readonly Literal[]): LearnedClause {
  return {
    decisions: [...decisions],
    clause: normaliseClause(decisions.map(negate)),
  }
}

export interface CdclStep {
  /** Decisions standing when this conflict was reached. */
  decisions: Literal[]
  /** Literals BCP forced after the last decision. */
  propagated: Literal[]
  learned: Clause
}

export interface CdclRun {
  steps: CdclStep[]
  /** True when the run ended by deriving ⊥ with no decision in force. */
  unsatisfiable: boolean
}

/**
 * Run CDCL far enough to produce the sequence of learned clauses.
 *
 * Decisions are taken alphabetically and false first, matching DPLL, so the
 * two runs line up and Example 2.45 can be read against Example 2.43. After a
 * conflict the learned clause is added and the search restarts from scratch —
 * which is not how a real solver backjumps, but produces exactly the sequence
 * the notes derive, and keeps the thing you are being examined on in view.
 */
export function cdcl(clauses: readonly Clause[], maxSteps = 20): CdclRun {
  const steps: CdclStep[] = []
  let learnedSoFar: Clause[] = []

  for (let round = 0; round < maxSteps; round++) {
    const withLearned = [...clauses, ...learnedSoFar]
    const decisions: Literal[] = []
    let current = withLearned.map((clause) => normaliseClause(clause))

    for (;;) {
      const run = bcp(current)
      if (run.outcome === 'unsatisfiable') {
        if (decisions.length === 0) return { steps, unsatisfiable: true }
        const learned = learnFromDecisions(decisions).clause
        steps.push({
          decisions: [...decisions],
          propagated: run.steps.map((step) => step.literal),
          learned,
        })
        learnedSoFar = [...learnedSoFar, learned]
        break
      }
      if (run.outcome === 'satisfiable') return { steps, unsatisfiable: false }

      const variable = [...new Set(run.result.flatMap(clauseVariables))].sort((a, b) =>
        a.localeCompare(b),
      )[0] as string
      const decision: Literal = { name: variable, negated: true }
      decisions.push(decision)
      current = bcpStep(run.result, decision)
    }
  }

  return { steps, unsatisfiable: false }
}
