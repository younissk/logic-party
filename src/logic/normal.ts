/**
 * Normal forms: NNF, CNF, DNF, plus the clause view that resolution and
 * DPLL minigames need.
 *
 * The transformations here are the naive textbook ones — the same steps a
 * student performs by hand in an exam — not Tseitin. That is deliberate: the
 * app must be able to show the *expected* answer, and the expected answer is
 * the one the marking scheme wants.
 */

import type { Formula } from './ast'
import { and, andAll, equals, FALSE, not, or, orAll, size, TRUE, v } from './ast'

/** Distribution is exponential in the worst case; refuse before the tab dies. */
export const MAX_NORMAL_FORM_SIZE = 20_000

class NormalFormTooLargeError extends Error {
  constructor(nodes: number) {
    super(`Normal form exceeded ${MAX_NORMAL_FORM_SIZE} nodes (reached ${nodes}) — pick a smaller formula`)
    this.name = 'NormalFormTooLargeError'
  }
}

const guard = (formula: Formula): Formula => {
  const nodes = size(formula)
  if (nodes > MAX_NORMAL_FORM_SIZE) throw new NormalFormTooLargeError(nodes)
  return formula
}

/** Constant folding and the identity/annihilator laws. Never grows the formula. */
export function simplify(formula: Formula): Formula {
  switch (formula.kind) {
    case 'var':
    case 'const':
      return formula

    case 'not': {
      const arg = simplify(formula.arg)
      if (arg.kind === 'const') return arg.value ? FALSE : TRUE
      if (arg.kind === 'not') return arg.arg
      return not(arg)
    }

    case 'and': {
      const left = simplify(formula.left)
      const right = simplify(formula.right)
      if (left.kind === 'const') return left.value ? right : FALSE
      if (right.kind === 'const') return right.value ? left : FALSE
      if (equals(left, right)) return left
      return and(left, right)
    }

    case 'or': {
      const left = simplify(formula.left)
      const right = simplify(formula.right)
      if (left.kind === 'const') return left.value ? TRUE : right
      if (right.kind === 'const') return right.value ? TRUE : left
      if (equals(left, right)) return left
      return or(left, right)
    }

    case 'implies': {
      const left = simplify(formula.left)
      const right = simplify(formula.right)
      if (left.kind === 'const') return left.value ? right : TRUE
      if (right.kind === 'const') return right.value ? TRUE : simplify(not(left))
      if (equals(left, right)) return TRUE
      return { kind: 'implies', left, right }
    }

    case 'iff': {
      const left = simplify(formula.left)
      const right = simplify(formula.right)
      if (left.kind === 'const') return left.value ? right : simplify(not(right))
      if (right.kind === 'const') return right.value ? left : simplify(not(left))
      if (equals(left, right)) return TRUE
      return { kind: 'iff', left, right }
    }
  }
}

/** Rewrite ↔ as a conjunction of implications. */
export function eliminateBiconditionals(formula: Formula): Formula {
  switch (formula.kind) {
    case 'var':
    case 'const':
      return formula
    case 'not':
      return not(eliminateBiconditionals(formula.arg))
    case 'iff': {
      const left = eliminateBiconditionals(formula.left)
      const right = eliminateBiconditionals(formula.right)
      return and({ kind: 'implies', left, right }, { kind: 'implies', left: right, right: left })
    }
    default:
      return {
        kind: formula.kind,
        left: eliminateBiconditionals(formula.left),
        right: eliminateBiconditionals(formula.right),
      }
  }
}

/** Rewrite a → b as ¬a ∨ b. Assumes ↔ is already gone. */
export function eliminateImplications(formula: Formula): Formula {
  switch (formula.kind) {
    case 'var':
    case 'const':
      return formula
    case 'not':
      return not(eliminateImplications(formula.arg))
    case 'implies':
      return or(not(eliminateImplications(formula.left)), eliminateImplications(formula.right))
    case 'iff':
      return eliminateImplications(eliminateBiconditionals(formula))
    default:
      return {
        kind: formula.kind,
        left: eliminateImplications(formula.left),
        right: eliminateImplications(formula.right),
      }
  }
}

/** Negation Normal Form: ¬ appears only directly in front of variables. */
export function toNNF(formula: Formula): Formula {
  const pushNegations = (f: Formula, negated: boolean): Formula => {
    switch (f.kind) {
      case 'var':
        return negated ? not(f) : f
      case 'const':
        return negated ? (f.value ? FALSE : TRUE) : f
      case 'not':
        return pushNegations(f.arg, !negated)
      case 'and':
        return negated
          ? or(pushNegations(f.left, true), pushNegations(f.right, true))
          : and(pushNegations(f.left, false), pushNegations(f.right, false))
      case 'or':
        return negated
          ? and(pushNegations(f.left, true), pushNegations(f.right, true))
          : or(pushNegations(f.left, false), pushNegations(f.right, false))
      case 'implies':
        // a → b  ≡  ¬a ∨ b ;  ¬(a → b)  ≡  a ∧ ¬b
        return negated
          ? and(pushNegations(f.left, false), pushNegations(f.right, true))
          : or(pushNegations(f.left, true), pushNegations(f.right, false))
      case 'iff':
        return pushNegations(eliminateBiconditionals(f), negated)
    }
  }

  return pushNegations(formula, false)
}

/** Flatten a chain of ∧ into its conjuncts (a ∧ (b ∧ c) -> [a, b, c]). */
export function conjuncts(formula: Formula): Formula[] {
  if (formula.kind !== 'and') return [formula]
  return [...conjuncts(formula.left), ...conjuncts(formula.right)]
}

/** Flatten a chain of ∨ into its disjuncts. */
export function disjuncts(formula: Formula): Formula[] {
  if (formula.kind !== 'or') return [formula]
  return [...disjuncts(formula.left), ...disjuncts(formula.right)]
}

/**
 * Distribute ∨ over ∧ until the formula is in CNF.
 *
 * Assumes NNF — this is step 4 of the textbook pipeline, and the only step
 * that can grow the formula. (a∧b) ∨ (c∧d) ∨ (e∧f) becomes 2³ = 8 clauses;
 * ten such pairs become 1024. That blowup is the entire reason Tseitin exists.
 *
 * Exported so the step-by-step pipeline and `toCNF` cannot disagree about
 * what "distribute" means.
 */
export function distribute(formula: Formula): Formula {
  const push = (left: Formula, right: Formula): Formula => {
    if (left.kind === 'and') return and(push(left.left, right), push(left.right, right))
    if (right.kind === 'and') return and(push(left, right.left), push(left, right.right))
    return or(left, right)
  }

  const convert = (f: Formula): Formula => {
    if (f.kind === 'and') return guard(and(convert(f.left), convert(f.right)))
    if (f.kind === 'or') return guard(push(convert(f.left), convert(f.right)))
    return f
  }

  return convert(formula)
}

export function toCNF(formula: Formula): Formula {
  return simplify(distribute(toNNF(simplify(formula))))
}

/** True when negation appears only directly in front of variables. */
export function isNNF(formula: Formula): boolean {
  switch (formula.kind) {
    case 'var':
    case 'const':
      return true
    case 'not':
      return formula.arg.kind === 'var' || formula.arg.kind === 'const'
    case 'and':
    case 'or':
      return isNNF(formula.left) && isNNF(formula.right)
    default:
      // → and ↔ are not NNF connectives at all.
      return false
  }
}

/** True when the formula contains a connective of this kind anywhere. */
export function contains(formula: Formula, kind: Formula['kind']): boolean {
  if (formula.kind === kind) return true
  switch (formula.kind) {
    case 'var':
    case 'const':
      return false
    case 'not':
      return contains(formula.arg, kind)
    default:
      return contains(formula.left, kind) || contains(formula.right, kind)
  }
}

export function toDNF(formula: Formula): Formula {
  const distribute = (left: Formula, right: Formula): Formula => {
    if (left.kind === 'or') return or(distribute(left.left, right), distribute(left.right, right))
    if (right.kind === 'or') return or(distribute(left, right.left), distribute(left, right.right))
    return and(left, right)
  }

  const convert = (f: Formula): Formula => {
    if (f.kind === 'or') return guard(or(convert(f.left), convert(f.right)))
    if (f.kind === 'and') return guard(distribute(convert(f.left), convert(f.right)))
    return f
  }

  return simplify(convert(toNNF(simplify(formula))))
}

// ---------------------------------------------------------------------------
// Clause view — the representation resolution and DPLL work on.
// ---------------------------------------------------------------------------

export interface Literal {
  readonly name: string
  readonly negated: boolean
}

/** A clause is a disjunction of literals; the empty clause is falsum. */
export type Clause = readonly Literal[]

export const isLiteral = (f: Formula): boolean =>
  f.kind === 'var' || (f.kind === 'not' && f.arg.kind === 'var')

export const isClause = (f: Formula): boolean => disjuncts(f).every(isLiteral)

/**
 * ⊤ and ⊥ count as normal forms: ⊤ is the empty clause set and ⊥ the clause
 * set containing the empty clause. `simplify` inside toCNF/toDNF collapses
 * tautologies and contradictions to exactly these, so without this case the
 * converters would emit output their own validator rejects.
 */
export const isCNF = (f: Formula): boolean =>
  f.kind === 'const' || conjuncts(f).every(isClause)

export const isDNF = (f: Formula): boolean =>
  f.kind === 'const' || disjuncts(f).every((d) => conjuncts(d).every(isLiteral))

function toLiteral(f: Formula): Literal {
  if (f.kind === 'var') return { name: f.name, negated: false }
  if (f.kind === 'not' && f.arg.kind === 'var') return { name: f.arg.name, negated: true }
  throw new TypeError('Expected a literal (a variable or a negated variable)')
}

/**
 * Clause set of a formula. Converts to CNF first, so this works on any input.
 * Tautological clauses (containing p and ¬p) are kept — students are usually
 * expected to notice and discard them themselves.
 */
export function clauses(formula: Formula): Clause[] {
  const cnf = toCNF(formula)
  if (cnf.kind === 'const') return cnf.value ? [] : [[]]
  return conjuncts(cnf).map((clause) => disjuncts(clause).map(toLiteral))
}

export const literalToFormula = (literal: Literal): Formula =>
  literal.negated ? not(v(literal.name)) : v(literal.name)

export const clauseToFormula = (clause: Clause): Formula =>
  clause.length === 0 ? FALSE : orAll(clause.map(literalToFormula))

export const clauseSetToFormula = (set: readonly Clause[]): Formula =>
  set.length === 0 ? TRUE : andAll(set.map(clauseToFormula))

export const literalsEqual = (a: Literal, b: Literal): boolean =>
  a.name === b.name && a.negated === b.negated

export const areComplementary = (a: Literal, b: Literal): boolean =>
  a.name === b.name && a.negated !== b.negated

/** A clause containing both p and ¬p — always true, safe to discard. */
export const isTautologicalClause = (clause: Clause): boolean =>
  clause.some((a) => clause.some((b) => areComplementary(a, b)))

export function showLiteral(literal: Literal): string {
  return `${literal.negated ? '¬' : ''}${literal.name}`
}

export function showClause(clause: Clause): string {
  return clause.length === 0 ? '□' : `{${clause.map(showLiteral).join(', ')}}`
}

export function showClauseSet(set: readonly Clause[]): string {
  return `{${set.map(showClause).join(', ')}}`
}

// ---------------------------------------------------------------------------
// Unit propagation (BCP)
// ---------------------------------------------------------------------------

/** One variable forced by a unit clause, and the clause that forced it. */
export interface ForcedAssignment {
  readonly name: string
  readonly value: boolean
}

export interface Propagation {
  /** Variables forced, in the order propagation forced them. */
  readonly forced: readonly ForcedAssignment[]
  /**
   * What is left once satisfied clauses are deleted and falsified literals are
   * struck out of the clauses that remain.
   */
  readonly remaining: Clause[]
  /** True when propagation produced the empty clause. */
  readonly conflict: boolean
}

/**
 * Boolean constraint propagation, run to fixpoint.
 *
 * A unit clause has only one literal, so there is no choice about it: that
 * literal must be true. Setting it satisfies every clause containing it
 * (delete them) and falsifies its complement everywhere else (strike it out),
 * which can produce new unit clauses. Repeat until nothing is forced.
 *
 * This is the first move in counting models by hand — it costs nothing and it
 * removes variables from the problem, so what is left is small enough to
 * enumerate. It is also DPLL's inner loop and an exam question in its own
 * right ("apply BCP until fixpoint").
 */
export function unitPropagate(input: readonly Clause[]): Propagation {
  const forced: ForcedAssignment[] = []
  const assigned = new Map<string, boolean>()
  let remaining: Clause[] = input.map((clause) => [...clause])

  for (;;) {
    const unit = remaining.find((clause) => clause.length === 1)
    if (unit === undefined) break

    const literal = unit[0] as Literal
    const value = !literal.negated
    assigned.set(literal.name, value)
    forced.push({ name: literal.name, value })

    const next: Clause[] = []
    for (const clause of remaining) {
      // Satisfied by the forced literal — the whole clause goes.
      if (clause.some((l) => l.name === literal.name && l.negated === literal.negated)) continue
      // Otherwise strike out the complement wherever it appears.
      next.push(clause.filter((l) => l.name !== literal.name))
    }
    remaining = next

    if (remaining.some((clause) => clause.length === 0)) {
      return { forced, remaining, conflict: true }
    }
  }

  return { forced, remaining, conflict: false }
}

// ---------------------------------------------------------------------------
// The textbook CNF pipeline, one step at a time
// ---------------------------------------------------------------------------

/**
 * The moves of the CNF transformation, in the order they must be applied.
 *
 * The order is not a preference. Distributing before negations are pushed in
 * leaves ¬(φ∧ψ) sitting inside a clause, which is not a clause; eliminating →
 * before ↔ misses the implications that ↔ turns into. Doing them out of order
 * is the single most common way to lose the marks.
 */
export type CnfStep = 'iff' | 'implies' | 'nnf' | 'distribute' | 'clean' | 'done'

export const CNF_STEPS: readonly CnfStep[] = ['iff', 'implies', 'nnf', 'distribute', 'clean', 'done']

export const CNF_STEP_LABELS: Readonly<Record<CnfStep, string>> = {
  iff: 'Eliminate ↔',
  implies: 'Eliminate →',
  nnf: 'Push ¬ inwards',
  distribute: 'Distribute ∨ over ∧',
  clean: 'Drop tautologies and duplicates',
  done: 'Done — this is CNF',
}

export const CNF_STEP_RULES: Readonly<Record<CnfStep, string>> = {
  iff: 'φ ↔ ψ  ⟹  (φ → ψ) ∧ (ψ → φ)',
  implies: 'φ → ψ  ⟹  ¬φ ∨ ψ',
  nnf: '¬(φ ∧ ψ) ⟹ ¬φ ∨ ¬ψ · ¬(φ ∨ ψ) ⟹ ¬φ ∧ ¬ψ · ¬¬φ ⟹ φ',
  distribute: '(φ ∧ ψ) ∨ χ  ⟹  (φ ∨ χ) ∧ (ψ ∨ χ)',
  clean: 'a ∨ ¬a ∨ … ⟹ drop the clause · a ∨ b ∨ a ⟹ a ∨ b',
  done: 'Every conjunct is a disjunction of literals.',
}

/** True when the clause set still has a tautological clause or a repeated literal. */
export function needsCleanup(formula: Formula): boolean {
  if (!isCNF(formula)) return false
  if (formula.kind === 'const') return false
  return conjuncts(formula).some((clause) => {
    const literals = disjuncts(clause).map(toLiteral)
    if (isTautologicalClause(literals)) return true
    return literals.some((a, i) => literals.some((b, j) => j > i && literalsEqual(a, b)))
  })
}

/**
 * The one move the pipeline allows next. There is never a choice.
 *
 * Read top to bottom: the first test that fires is the answer. That ordering
 * *is* the algorithm.
 */
export function nextCnfStep(formula: Formula): CnfStep {
  if (contains(formula, 'iff')) return 'iff'
  if (contains(formula, 'implies')) return 'implies'
  if (!isNNF(formula)) return 'nnf'
  if (!isCNF(formula)) return 'distribute'
  if (needsCleanup(formula)) return 'clean'
  return 'done'
}

/** Drop tautological clauses and repeated literals. Assumes CNF. */
export function cleanClauses(formula: Formula): Formula {
  if (formula.kind === 'const') return formula
  const kept: Clause[] = []
  for (const conjunct of conjuncts(formula)) {
    const literals = disjuncts(conjunct).map(toLiteral)
    if (isTautologicalClause(literals)) continue
    const unique: Literal[] = []
    for (const literal of literals) {
      if (!unique.some((seen) => literalsEqual(seen, literal))) unique.push(literal)
    }
    kept.push(unique)
  }
  // Every clause was a tautology, so the conjunction of none of them is ⊤.
  return kept.length === 0 ? TRUE : clauseSetToFormula(kept)
}

/**
 * Apply one pipeline step, as a full pass over the formula.
 *
 * A step that does not apply is a no-op — which is exactly what happens if you
 * try to distribute before the negations are pushed in, and is worth letting
 * the player see rather than blocking.
 */
export function applyCnfStep(formula: Formula, step: CnfStep): Formula {
  switch (step) {
    case 'iff':
      return eliminateBiconditionals(formula)
    case 'implies':
      return eliminateImplications(formula)
    case 'nnf':
      return toNNF(formula)
    case 'distribute':
      return guard(distribute(formula))
    case 'clean':
      return isCNF(formula) ? cleanClauses(formula) : formula
    case 'done':
      return formula
  }
}

/** Every intermediate formula of a full run, starting with the input. */
export function cnfPipeline(formula: Formula): { step: CnfStep; result: Formula }[] {
  const trace: { step: CnfStep; result: Formula }[] = []
  let current = formula
  for (let guardCount = 0; guardCount < CNF_STEPS.length + 2; guardCount++) {
    const step = nextCnfStep(current)
    if (step === 'done') break
    current = applyCnfStep(current, step)
    trace.push({ step, result: current })
  }
  return trace
}
