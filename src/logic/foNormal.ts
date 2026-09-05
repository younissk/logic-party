/**
 * Prenex normal form, Skolemization and clausification — ln.pdf §4.2.
 *
 * The pipeline is three steps and each one loses something different. PNF
 * (Algorithm 4.12) preserves *equivalence*: it only ever swaps a subformula for
 * an equivalent one from Figure 4.1. Skolemization does foNot — `∃x:p(x)` and
 * `p(c)` are foNot equivalent, only satisfiability-equivalent (Theorem 4.16),
 * which is all a refutation needs. Clausification then throws the ∀ prefix away
 * because every remaining variable is universally quantified anyway.
 *
 * The transformation is foNot deterministic: which equivalence you apply when
 * changes the quantifier order in the prefix, and that changes the arity of the
 * Skolem functions. Example 4.15 works the same formula two ways and gets a
 * different answer both times, both correct.
 */

import { showTerm, termVariables, termsEqual, variable, type Term } from './terms'
import { applySubstitution } from './substitution'
import {
  atom,
  binary,
  clean,
  formulasEqual,
  freeVariables,
  functionSymbols,
  isClean,
  foNot,
  showFormula,
  substituteFormula,
  type FoConnective,
  type FoFormula,
  type Quantifier,
} from './fol'

// ---------------------------------------------------------------------------
// Prenex normal form — Algorithm 4.12, Figure 4.1
// ---------------------------------------------------------------------------

export const isQuantifierFree = (formula: FoFormula): boolean => {
  switch (formula.kind) {
    case 'quantified':
      return false
    case 'not':
      return isQuantifierFree(formula.body)
    case 'binary':
      return isQuantifierFree(formula.left) && isQuantifierFree(formula.right)
    default:
      return true
  }
}

/** `Q₁x₁…Qₙxₙ:ψ` with ψ quantifier-free — Definition 4.10. */
export function isPrenex(formula: FoFormula): boolean {
  let node = formula
  while (node.kind === 'quantified') node = node.body
  return isQuantifierFree(node)
}

export interface Prefix {
  quantifier: Quantifier
  variable: string
}

/** The prefix and the matrix of a formula already in PNF. */
export function splitPrenex(formula: FoFormula): { prefix: Prefix[]; matrix: FoFormula } {
  const prefix: Prefix[] = []
  let node = formula
  while (node.kind === 'quantified') {
    prefix.push({ quantifier: node.quantifier, variable: node.variable })
    node = node.body
  }
  return { prefix, matrix: node }
}

export const rebuildPrenex = (prefix: readonly Prefix[], matrix: FoFormula): FoFormula =>
  prefix.reduceRight<FoFormula>(
    (body, entry) => ({
      kind: 'quantified',
      quantifier: entry.quantifier,
      variable: entry.variable,
      body,
    }),
    matrix,
  )

/** The dual quantifier, for pushing a negation through. */
const flip = (quantifier: Quantifier): Quantifier =>
  quantifier === 'forall' ? 'exists' : 'forall'

/** Which equivalence of Figure 4.1 a step used. */
export type PnfRule =
  | 'iff'
  | 'not-forall'
  | 'not-exists'
  | 'forall-implies-left'
  | 'exists-implies-left'
  | 'quantifier-left'
  | 'quantifier-right'

export const PNF_RULE_LABELS: Readonly<Record<PnfRule, string>> = {
  iff: 'φ↔ψ ≡ (φ→ψ)∧(ψ→φ)',
  'not-forall': '¬∀x:φ ≡ ∃x:¬φ',
  'not-exists': '¬∃x:φ ≡ ∀x:¬φ',
  'forall-implies-left': '(∀x:φ)→ψ ≡ ∃x:(φ→ψ)',
  'exists-implies-left': '(∃x:φ)→ψ ≡ ∀x:(φ→ψ)',
  'quantifier-left': '(Qx:φ)∘ψ ≡ Qx:(φ∘ψ)',
  'quantifier-right': 'ψ∘(Qx:φ) ≡ Qx:(ψ∘φ)',
}

export interface PnfMove {
  rule: PnfRule
  /** The formula after the step. */
  result: FoFormula
}

/**
 * One step of Algorithm 4.12 at the outermost place it applies.
 *
 * The algorithm says "let χ be a subformula of the form of a left-hand side",
 * and leaves which one open. Taking the outermost is a strategy; `pnfOptions`
 * lists the others, which is where the several different PNFs come from.
 */
export function pnfStep(formula: FoFormula): PnfMove | null {
  return pnfOptions(formula)[0] ?? null
}

/** Every Figure 4.1 equivalence applicable anywhere, outermost first. */
export function pnfOptions(formula: FoFormula): PnfMove[] {
  const moves: PnfMove[] = [...topLevelMoves(formula)]

  const rebuild = (replacement: FoFormula, at: 'body' | 'left' | 'right'): FoFormula => {
    if (formula.kind === 'not') return foNot(replacement)
    if (formula.kind === 'quantified') {
      return {
        kind: 'quantified',
        quantifier: formula.quantifier,
        variable: formula.variable,
        body: replacement,
      }
    }
    if (formula.kind === 'binary') {
      return at === 'left'
        ? binary(formula.connective, replacement, formula.right)
        : binary(formula.connective, formula.left, replacement)
    }
    return replacement
  }

  if (formula.kind === 'not' || formula.kind === 'quantified') {
    for (const move of pnfOptions(formula.body)) {
      moves.push({ rule: move.rule, result: rebuild(move.result, 'body') })
    }
  }
  if (formula.kind === 'binary') {
    for (const move of pnfOptions(formula.left)) {
      moves.push({ rule: move.rule, result: rebuild(move.result, 'left') })
    }
    for (const move of pnfOptions(formula.right)) {
      moves.push({ rule: move.rule, result: rebuild(move.result, 'right') })
    }
  }
  return moves
}

/**
 * Every equivalence applying at the root of this formula.
 *
 * More than one can: `(∃x:φ)→(∃y:ψ)` has a quantifier on each side, and which
 * you pull out first decides the order of the prefix. That choice is the whole
 * reason a formula has several prenex forms, so the options are all offered
 * rather than the first one taken silently.
 */
function topLevelMoves(formula: FoFormula): PnfMove[] {
  if (formula.kind === 'binary' && formula.connective === 'iff') {
    return [
      {
        rule: 'iff',
        result: binary(
          'and',
          binary('implies', formula.left, formula.right),
          binary('implies', formula.right, formula.left),
        ),
      },
    ]
  }

  if (formula.kind === 'not' && formula.body.kind === 'quantified') {
    const inner = formula.body
    return [
      {
        rule: inner.quantifier === 'forall' ? 'not-forall' : 'not-exists',
        result: {
          kind: 'quantified',
          quantifier: flip(inner.quantifier),
          variable: inner.variable,
          body: foNot(inner.body),
        },
      },
    ]
  }

  if (formula.kind !== 'binary') return []
  const { connective, left, right } = formula
  const moves: PnfMove[] = []

  if (left.kind === 'quantified') {
    // A quantifier on the left of an implication flips: the antecedent is
    // negative, so ∀ becomes ∃ and vice versa.
    const flipped = connective === 'implies'
    moves.push({
      rule: flipped
        ? left.quantifier === 'forall'
          ? 'forall-implies-left'
          : 'exists-implies-left'
        : 'quantifier-left',
      result: {
        kind: 'quantified',
        quantifier: flipped ? flip(left.quantifier) : left.quantifier,
        variable: left.variable,
        body: binary(connective, left.body, right),
      },
    })
  }

  if (right.kind === 'quantified') {
    moves.push({
      rule: 'quantifier-right',
      result: {
        kind: 'quantified',
        quantifier: right.quantifier,
        variable: right.variable,
        body: binary(connective, left, right.body),
      },
    })
  }

  return moves
}

/**
 * Run Algorithm 4.12 to a fixpoint, cleaning first.
 *
 * Without the cleaning step the algorithm gets stuck: the notes show
 * `∀x:p(x)∨∀x:q(x)` reducing to something that is foNot in PNF and cannot move,
 * because pulling either quantifier out would capture the other's x.
 */
export function toPrenex(formula: FoFormula, limit = 200): { result: FoFormula; steps: PnfMove[] } {
  let current = isClean(formula) ? formula : clean(formula)
  const steps: PnfMove[] = []
  for (let count = 0; count < limit; count++) {
    const move = pnfStep(current)
    if (move === null) break
    steps.push(move)
    current = move.result
  }
  return { result: current, steps }
}

// ---------------------------------------------------------------------------
// Skolemization
// ---------------------------------------------------------------------------

export interface SkolemStep {
  /** The existential variable that was removed. */
  variable: string
  /** The term it became. */
  term: Term
  /** The universals it depended on, in prefix order. */
  dependsOn: string[]
}

/**
 * Remove every ∃ from a formula already in PNF.
 *
 * Each existential becomes a fresh function symbol applied to *exactly* the
 * universally quantified variables to its left. Zero of them gives a constant.
 * Getting that list wrong is the exam's favourite mistake: a Skolem function
 * that forgets a dependency claims a single witness works for every value, and
 * one that invents a dependency is merely wasteful.
 */
export function skolemize(
  formula: FoFormula,
  prefixName = 'f',
): { result: FoFormula; steps: SkolemStep[] } {
  const { prefix, matrix } = splitPrenex(formula)
  const taken = new Set(Object.keys(functionSymbols(formula)))
  const steps: SkolemStep[] = []

  let body = matrix
  const universals: string[] = []
  const kept: Prefix[] = []

  for (const entry of prefix) {
    if (entry.quantifier === 'forall') {
      universals.push(entry.variable)
      kept.push(entry)
      continue
    }
    let index = steps.length + 1
    let name = `${prefixName}${index}`
    while (taken.has(name)) {
      index++
      name = `${prefixName}${index}`
    }
    taken.add(name)

    const term: Term =
      universals.length === 0
        ? { kind: 'fn', name, args: [] }
        : { kind: 'fn', name, args: universals.map((argument) => variable(argument)) }
    body = substituteFormula({ [entry.variable]: term }, body)
    steps.push({ variable: entry.variable, term, dependsOn: [...universals] })
  }

  return { result: rebuildPrenex(kept, body), steps }
}

/** The whole pipeline: clean, prenex, Skolemize, CNF the matrix. */
export function toSkolemNormalForm(formula: FoFormula): {
  prenex: FoFormula
  skolemised: FoFormula
  result: FoFormula
  steps: SkolemStep[]
} {
  const prenex = toPrenex(formula).result
  const { result: skolemised, steps } = skolemize(prenex)
  const { prefix, matrix } = splitPrenex(skolemised)
  return {
    prenex,
    skolemised,
    result: rebuildPrenex(prefix, cnfOfMatrix(matrix)),
    steps,
  }
}

// ---------------------------------------------------------------------------
// CNF of the matrix, and clauses
// ---------------------------------------------------------------------------

/** Remove → and ↔ in favour of ¬, ∧, ∨. */
export function removeImplications(formula: FoFormula): FoFormula {
  switch (formula.kind) {
    case 'not':
      return foNot(removeImplications(formula.body))
    case 'quantified':
      return {
        kind: 'quantified',
        quantifier: formula.quantifier,
        variable: formula.variable,
        body: removeImplications(formula.body),
      }
    case 'binary': {
      const left = removeImplications(formula.left)
      const right = removeImplications(formula.right)
      if (formula.connective === 'implies') return binary('or', foNot(left), right)
      if (formula.connective === 'iff') {
        return binary(
          'and',
          binary('or', foNot(left), right),
          binary('or', foNot(right), left),
        )
      }
      return binary(formula.connective, left, right)
    }
    default:
      return formula
  }
}

/** Push negations inwards until they sit on atoms. */
export function toNegationNormalForm(formula: FoFormula): FoFormula {
  const walk = (node: FoFormula, negated: boolean): FoFormula => {
    switch (node.kind) {
      case 'true':
        return negated ? { kind: 'false' } : node
      case 'false':
        return negated ? { kind: 'true' } : node
      case 'atom':
        return negated ? foNot(node) : node
      case 'not':
        return walk(node.body, !negated)
      case 'binary': {
        const connective: FoConnective = negated
          ? node.connective === 'and'
            ? 'or'
            : 'and'
          : node.connective
        return binary(connective, walk(node.left, negated), walk(node.right, negated))
      }
      case 'quantified':
        return {
          kind: 'quantified',
          quantifier: negated ? flip(node.quantifier) : node.quantifier,
          variable: node.variable,
          body: walk(node.body, negated),
        }
    }
  }
  return walk(removeImplications(formula), false)
}

/** Distribute ∨ over ∧ in a quantifier-free matrix. */
export function cnfOfMatrix(matrix: FoFormula): FoFormula {
  const distribute = (node: FoFormula): FoFormula => {
    if (node.kind !== 'binary') return node
    const left = distribute(node.left)
    const right = distribute(node.right)
    if (node.connective === 'and') return binary('and', left, right)
    if (node.connective !== 'or') return binary(node.connective, left, right)

    if (left.kind === 'binary' && left.connective === 'and') {
      return distribute(
        binary('and', binary('or', left.left, right), binary('or', left.right, right)),
      )
    }
    if (right.kind === 'binary' && right.connective === 'and') {
      return distribute(
        binary('and', binary('or', left, right.left), binary('or', left, right.right)),
      )
    }
    return binary('or', left, right)
  }
  return distribute(toNegationNormalForm(matrix))
}

/** A first-order literal: a predicate applied to terms, possibly negated. */
export interface FoLiteral {
  negated: boolean
  predicate: string
  args: Term[]
}

export type FoClause = FoLiteral[]

export const showFoLiteral = (literal: FoLiteral): string =>
  `${literal.negated ? '¬' : ''}${literal.predicate}${
    literal.args.length === 0 ? '' : `(${literal.args.map(showTerm).join(',')})`
  }`

export const showFoClause = (clause: FoClause): string =>
  clause.length === 0 ? '□' : clause.map(showFoLiteral).join(' ∨ ')

export const showFoClauseSet = (clauses: readonly FoClause[]): string =>
  `{${clauses.map((clause) => `{${clause.map(showFoLiteral).join(', ')}}`).join(', ')}}`

export const foLiteralsEqual = (left: FoLiteral, right: FoLiteral): boolean =>
  left.negated === right.negated &&
  left.predicate === right.predicate &&
  left.args.length === right.args.length &&
  left.args.every((arg, index) => termsEqual(arg, right.args[index] as Term))

export const negateFoLiteral = (literal: FoLiteral): FoLiteral => ({
  ...literal,
  negated: !literal.negated,
})

export const foLiteralToFormula = (literal: FoLiteral): FoFormula => {
  const inner = atom(literal.predicate, literal.args)
  return literal.negated ? foNot(inner) : inner
}

/** Duplicate literals removed, in first-seen order — clauses are sets. */
export function normaliseFoClause(clause: FoClause): FoClause {
  const seen: FoClause = []
  for (const literal of clause) {
    if (!seen.some((existing) => foLiteralsEqual(existing, literal))) seen.push(literal)
  }
  return seen
}

export const foClauseVariables = (clause: FoClause): string[] => [
  ...new Set(clause.flatMap((literal) => literal.args.flatMap(termVariables))),
]

export const applyToClause = (
  sigma: Parameters<typeof applySubstitution>[0],
  clause: FoClause,
): FoClause =>
  normaliseFoClause(
    clause.map((literal) => ({
      ...literal,
      args: literal.args.map((arg) => applySubstitution(sigma, arg)),
    })),
  )

/** A tautology: some literal and its negation both present. */
export const isFoTautologicalClause = (clause: FoClause): boolean =>
  clause.some((literal) =>
    clause.some((other) => foLiteralsEqual(other, negateFoLiteral(literal))),
  )

/**
 * The clause set of a closed formula — Definition on p.74.
 *
 * The ∀ prefix is dropped, foNot lost: every variable left in a clause is
 * universally quantified by convention, which is what makes two clauses
 * renamable apart without changing anything.
 */
export function clausify(formula: FoFormula): FoClause[] {
  const { result } = toSkolemNormalForm(formula)
  const { matrix } = splitPrenex(result)
  return clausesOfMatrix(matrix)
}

/** Read a CNF matrix as a clause set. */
export function clausesOfMatrix(matrix: FoFormula): FoClause[] {
  const conjuncts = (node: FoFormula): FoFormula[] =>
    node.kind === 'binary' && node.connective === 'and'
      ? [...conjuncts(node.left), ...conjuncts(node.right)]
      : [node]

  const disjuncts = (node: FoFormula): FoFormula[] =>
    node.kind === 'binary' && node.connective === 'or'
      ? [...disjuncts(node.left), ...disjuncts(node.right)]
      : [node]

  const clauses: FoClause[] = []
  for (const conjunct of conjuncts(matrix)) {
    const clause: FoClause = []
    for (const disjunct of disjuncts(conjunct)) {
      if (disjunct.kind === 'atom') {
        clause.push({ negated: false, predicate: disjunct.predicate, args: disjunct.args })
        continue
      }
      if (disjunct.kind === 'not' && disjunct.body.kind === 'atom') {
        clause.push({ negated: true, predicate: disjunct.body.predicate, args: disjunct.body.args })
        continue
      }
      // ⊤ and ⊥ survive the pipeline only in degenerate inputs.
      if (disjunct.kind === 'true') return []
    }
    clauses.push(normaliseFoClause(clause))
  }
  return clauses
}

/** The clause set as a formula again, for display and for evaluation. */
export const foClauseSetToFormula = (clauses: readonly FoClause[]): FoFormula => {
  if (clauses.length === 0) return { kind: 'true' }
  const asFormula = (clause: FoClause): FoFormula =>
    clause.length === 0
      ? { kind: 'false' }
      : clause
          .slice(1)
          .reduce<FoFormula>(
            (left, literal) => binary('or', left, foLiteralToFormula(literal)),
            foLiteralToFormula(clause[0] as FoLiteral),
          )
  return clauses
    .slice(1)
    .reduce<FoFormula>((left, clause) => binary('and', left, asFormula(clause)), asFormula(clauses[0] as FoClause))
}

/** True when the two formulas print the same — used by the games' marking. */
export const sameFormula = (left: FoFormula, right: FoFormula): boolean =>
  formulasEqual(left, right) || showFormula(left) === showFormula(right)

export const formulaIsClosed = (formula: FoFormula): boolean =>
  freeVariables(formula).length === 0
