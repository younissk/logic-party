/**
 * Herbrand and first-order resolution — ln.pdf §4.3–4.4.
 *
 * Two routes to the same place. The **ground** route (Herbrand): build the
 * universe of ground terms, instantiate every clause every way, and hand the
 * result to a propositional solver — Theorem 4.21 promises a finite
 * unsatisfiable subset exists, and says nothing about how to find it. The
 * **lifted** route (resolution with unification): work on the original clauses
 * and instantiate only as much as each step needs.
 *
 * Binary resolution alone is foNot complete — the barber of Example 4.25 defeats
 * it — so Definition 4.28 adds factoring. With equality, two more rules:
 * reflexivity resolution and paramodulation.
 */

import {
  positions,
  replaceAt,
  showTerm,
  subtermAt,
  termVariables,
  termsEqual,
  variable,
  type Position,
  type Term,
} from './terms'
import { applySubstitution, compose, match, mgu, type Substitution } from './substitution'
import {
  applyToClause,
  foClauseVariables,
  isFoTautologicalClause,
  foLiteralsEqual,
  normaliseFoClause,
  showFoClause,
  type FoClause,
  type FoLiteral,
} from './foNormal'

// ---------------------------------------------------------------------------
// Renaming apart
// ---------------------------------------------------------------------------

/**
 * A copy of the clause whose variables cannot collide with `avoid`.
 *
 * Definition 4.23 requires the two clauses to share no variables, and the notes
 * are explicit that renaming is always allowed because it does foNot affect
 * satisfiability — every variable in a clause is universally quantified, so its
 * name carries nothing.
 */
export function renameClauseApart(clause: FoClause, avoid: readonly string[]): FoClause {
  const renaming: Record<string, Term> = {}
  for (const name of foClauseVariables(clause)) {
    let fresh = `${name}'`
    while (avoid.includes(fresh)) fresh += "'"
    renaming[name] = variable(fresh)
  }
  return applyToClause(renaming, clause)
}

// ---------------------------------------------------------------------------
// Binary resolution — Definition 4.23
// ---------------------------------------------------------------------------

export interface BinaryResolvent {
  clause: FoClause
  /** The literals that were cancelled, before instantiation. */
  left: FoLiteral
  right: FoLiteral
  sigma: Substitution
}

/**
 * Every binary resolvent of two clauses.
 *
 * The second clause is renamed apart first. Two literals of opposite sign whose
 * atoms unify are removed under the mgu, and what is left of both clauses is
 * the resolvent.
 */
export function foBinaryResolvents(first: FoClause, second: FoClause): BinaryResolvent[] {
  const other = renameClauseApart(second, foClauseVariables(first))
  const found: BinaryResolvent[] = []

  for (let i = 0; i < first.length; i++) {
    for (let j = 0; j < other.length; j++) {
      const left = first[i] as FoLiteral
      const right = other[j] as FoLiteral
      if (left.negated === right.negated) continue
      if (left.predicate !== right.predicate) continue
      if (left.args.length !== right.args.length) continue

      const sigma = unifyLiterals(left, right)
      if (sigma === null) continue

      // The literals are dropped by *position*, before σ is applied — which is
      // what Definition 4.23 means by σ(C₁)\{σ(l₁)}. Dropping by value instead
      // would delete a sibling that σ happened to make identical, and the
      // barber of Example 4.25 would refute without factoring: the two
      // literals of ¬shaves(barber,x)∨¬shaves(x,x) both become
      // ¬shaves(barber,barber), and removing "the one we resolved on" must
      // leave the other behind.
      const clause = normaliseFoClause([
        ...applyToClause(sigma, first.filter((_, index) => index !== i)),
        ...applyToClause(sigma, other.filter((_, index) => index !== j)),
      ])

      if (found.some((existing) => foClausesEqual(existing.clause, clause))) continue
      found.push({ clause, left, right, sigma })
    }
  }
  return found
}

/** Unify two literals' argument lists, ignoring their signs. */
export function unifyLiterals(left: FoLiteral, right: FoLiteral): Substitution | null {
  if (left.predicate !== right.predicate) return null
  if (left.args.length !== right.args.length) return null
  // Pack the arguments into one term so a variable shared between arguments
  // is unified consistently across all of them.
  const pack = (literal: FoLiteral): Term => ({ kind: 'fn', name: '$args', args: literal.args })
  return mgu(pack(left), pack(right))
}

export const foClausesEqual = (left: FoClause, right: FoClause): boolean =>
  left.length === right.length &&
  left.every((literal) => right.some((other) => foLiteralsEqual(literal, other)))

/** Same clause up to renaming — what "already derived" has to mean. */
export function clauseVariants(left: FoClause, right: FoClause): boolean {
  if (left.length !== right.length) return false
  const pack = (clause: FoClause): Term => ({
    kind: 'fn',
    name: '$clause',
    args: clause.map((literal) => ({
      kind: 'fn',
      name: `${literal.negated ? 'n' : 'p'}_${literal.predicate}`,
      args: literal.args,
    })),
  })
  // Only comparable in the order they are written, so try the given order and
  // trust normalisation to have made it canonical enough for the small clauses
  // the games use.
  const one = pack(left)
  const two = pack(right)
  const forward = mgu(one, two)
  const backward = mgu(two, one)
  if (forward === null || backward === null) return false
  return (
    showTerm(applySubstitution(forward, one)) === showTerm(two) &&
    showTerm(applySubstitution(backward, two)) === showTerm(one)
  )
}

// ---------------------------------------------------------------------------
// Factoring — Definition 4.26
// ---------------------------------------------------------------------------

export interface Factor {
  clause: FoClause
  left: FoLiteral
  right: FoLiteral
  sigma: Substitution
}

/**
 * Every factor of a clause.
 *
 * Two literals of the *same* sign that unify are merged under the mgu. Since a
 * clause is a set, the merged copy appears once. Without this rule resolution
 * is incomplete: the barber's clauses resolve only to tautologies.
 */
export function foFactors(clause: FoClause): Factor[] {
  const found: Factor[] = []
  for (let i = 0; i < clause.length; i++) {
    for (let j = i + 1; j < clause.length; j++) {
      const left = clause[i] as FoLiteral
      const right = clause[j] as FoLiteral
      if (left.negated !== right.negated) continue
      const sigma = unifyLiterals(left, right)
      if (sigma === null) continue
      if (Object.keys(sigma).length === 0) continue
      const factored = applyToClause(sigma, clause)
      if (foClausesEqual(factored, clause)) continue
      if (found.some((existing) => foClausesEqual(existing.clause, factored))) continue
      found.push({ clause: factored, left, right, sigma })
    }
  }
  return found
}

/**
 * Definition 4.28: a binary resolvent of the two clauses, or of a factor of
 * either, or of foFactors of both.
 */
export function foResolvents(first: FoClause, second: FoClause): FoClause[] {
  const lefts = [first, ...foFactors(first).map((factor) => factor.clause)]
  const rights = [second, ...foFactors(second).map((factor) => factor.clause)]
  const found: FoClause[] = []
  for (const left of lefts) {
    for (const right of rights) {
      for (const resolvent of foBinaryResolvents(left, right)) {
        if (found.some((existing) => foClausesEqual(existing, resolvent.clause))) continue
        found.push(resolvent.clause)
      }
    }
  }
  return found
}

// ---------------------------------------------------------------------------
// Refutation search
// ---------------------------------------------------------------------------

/**
 * Does `general` subsume `specific`? — some σ with σ(general) ⊆ specific.
 *
 * A subsumed clause says nothing its subsumer does foNot, so keeping it only
 * makes the search bigger. Without this the reflexivity axiom `x = x` alone
 * floods a saturation: it subsumes every `t = t` the search can build.
 */
export function subsumes(general: FoClause, specific: FoClause): boolean {
  if (general.length > specific.length) return false

  const pack = (literal: FoLiteral): Term => ({
    kind: 'fn',
    name: `${literal.negated ? 'n' : 'p'}_${literal.predicate}`,
    args: literal.args,
  })

  const walk = (index: number, sigma: Substitution): boolean => {
    const literal = general[index]
    if (literal === undefined) return true
    const pattern = pack({
      ...literal,
      args: literal.args.map((arg) => applySubstitution(sigma, arg)),
    })
    for (const candidate of specific) {
      if (candidate.negated !== literal.negated) continue
      if (candidate.predicate !== literal.predicate) continue
      if (candidate.args.length !== literal.args.length) continue
      const found = match(pattern, pack(candidate))
      if (found === null) continue
      if (walk(index + 1, compose(found, sigma))) return true
    }
    return false
  }

  return walk(0, {})
}

export interface DerivedFoClause {
  clause: FoClause
  /** Indices of the two parents, or null for an input clause. */
  from: [number, number] | null
}

/**
 * Saturate until ⊥ appears or the budget runs out.
 *
 * First-order logic is undecidable, so "no refutation found" is never a proof
 * of satisfiability — only of having stopped looking. The budget is what makes
 * that honest.
 */
export function findFoRefutation(
  clauses: readonly FoClause[],
  limit = 400,
): { refuted: boolean; derived: DerivedFoClause[] } {
  const derived: DerivedFoClause[] = clauses.map((clause) => ({
    clause: normaliseFoClause(clause),
    from: null,
  }))

  // Shortest first. A short clause is closer to ⊥ and resolves against more,
  // so working outwards from the short ones finds the refutation long before
  // the budget runs out — which a plain left-to-right sweep does foNot, because
  // the equality axioms generate wide clauses forever.
  const order = (): number[] =>
    derived
      .map((_, index) => index)
      .sort(
        (a, b) =>
          (derived[a] as DerivedFoClause).clause.length -
          (derived[b] as DerivedFoClause).clause.length,
      )

  for (let round = 0; round < limit; round++) {
    let added = false
    const indices = order()
    for (const i of indices) {
      if (derived.length >= limit) break
      for (const j of indices) {
        if (j > i) continue
        if (derived.length >= limit) break
        const left = (derived[i] as DerivedFoClause).clause
        const right = (derived[j] as DerivedFoClause).clause
        for (const resolvent of foResolvents(left, right)) {
          if (isFoTautologicalClause(resolvent)) continue
          if (derived.some((entry) => subsumes(entry.clause, resolvent))) continue
          derived.push({ clause: resolvent, from: [i, j] })
          added = true
          if (resolvent.length === 0) return { refuted: true, derived }
        }
      }
    }
    if (!added) break
  }
  return { refuted: derived.some((entry) => entry.clause.length === 0), derived }
}

// ---------------------------------------------------------------------------
// Herbrand — §4.3
// ---------------------------------------------------------------------------

/** The constant invented when a clause set has none — Example 4.19.2. */
export const INVENTED_CONSTANT = 'a'

export interface HerbrandLanguage {
  constants: Term[]
  /** Function symbols of arity ≥ 1, with their arities. */
  functions: [name: string, arity: number][]
  /** True when a constant had to be invented. */
  invented: boolean
}

/** The constants and functions a clause set offers, with the fallback applied. */
export function herbrandLanguage(clauses: readonly FoClause[]): HerbrandLanguage {
  const constants: Term[] = []
  const functions = new Map<string, number>()

  const walk = (term: Term): void => {
    if (term.kind === 'var') return
    if (term.args.length === 0) {
      if (!constants.some((existing) => termsEqual(existing, term))) constants.push(term)
      return
    }
    functions.set(term.name, term.args.length)
    for (const arg of term.args) walk(arg)
  }
  for (const clause of clauses) for (const literal of clause) for (const arg of literal.args) walk(arg)

  const invented = constants.length === 0
  if (invented) constants.push({ kind: 'fn', name: INVENTED_CONSTANT, args: [] })

  return { constants, functions: [...functions.entries()], invented }
}

/**
 * The Herbrand universe, up to a depth.
 *
 * Infinite whenever there is a function symbol of arity ≥ 1, so it is always
 * generated to a bound. Depth 0 is the constants.
 */
export function herbrandUniverse(clauses: readonly FoClause[], depth = 2): Term[] {
  const language = herbrandLanguage(clauses)
  let terms = [...language.constants]
  for (let level = 0; level < depth; level++) {
    const next = [...terms]
    for (const [name, arity] of language.functions) {
      for (const args of tuples(terms, arity)) {
        const built: Term = { kind: 'fn', name, args }
        if (!next.some((existing) => termsEqual(existing, built))) next.push(built)
      }
    }
    terms = next
  }
  return terms
}

/** Every tuple of the given length drawn from `items`, with repetition. */
export function* tuples<T>(items: readonly T[], length: number): Generator<T[]> {
  if (length === 0) {
    yield []
    return
  }
  for (const item of items) {
    for (const rest of tuples(items, length - 1)) yield [item, ...rest]
  }
}

/**
 * The ground instances of one clause over a universe.
 *
 * Every variable is replaced by every ground term, in every combination — which
 * is why the expansion explodes and why resolution exists.
 */
export function groundInstances(clause: FoClause, universe: readonly Term[]): FoClause[] {
  const names = foClauseVariables(clause)
  const found: FoClause[] = []
  for (const values of tuples(universe, names.length)) {
    const sigma: Substitution = Object.fromEntries(
      names.map((name, index) => [name, values[index] as Term]),
    )
    const instance = applyToClause(sigma, clause)
    if (!found.some((existing) => foClausesEqual(existing, instance))) found.push(instance)
  }
  return found
}

/** The Herbrand expansion of a clause set, to a universe depth. */
export const herbrandExpansion = (clauses: readonly FoClause[], depth = 1): FoClause[] => {
  const universe = herbrandUniverse(clauses, depth)
  const found: FoClause[] = []
  for (const clause of clauses) {
    for (const instance of groundInstances(clause, universe)) {
      if (!found.some((existing) => foClausesEqual(existing, instance))) found.push(instance)
    }
  }
  return found
}

/** Every ground atom over a universe — the candidates for a Herbrand model. */
export function herbrandBase(clauses: readonly FoClause[], depth = 1): FoLiteral[] {
  const universe = herbrandUniverse(clauses, depth)
  const predicates = new Map<string, number>()
  for (const clause of clauses) {
    for (const literal of clause) predicates.set(literal.predicate, literal.args.length)
  }
  const atoms: FoLiteral[] = []
  for (const [predicate, arity] of predicates) {
    for (const args of tuples(universe, arity)) {
      atoms.push({ negated: false, predicate, args })
    }
  }
  return atoms
}

/**
 * Is this set of true ground atoms a model of the ground clauses?
 *
 * A Herbrand interpretation *is* the set of ground atoms it makes true — the
 * universe and the function symbols are fixed, so nothing else is left to
 * choose.
 */
export function isHerbrandModel(
  clauses: readonly FoClause[],
  trueAtoms: readonly FoLiteral[],
  depth = 1,
): boolean {
  // Variables in a clause are universally quantified, so a clause with one is
  // shorthand for all its ground instances — checking it as written would let
  // ¬p(x) pass in an interpretation where p(c) is true.
  const ground = clauses.flatMap((clause) =>
    foClauseVariables(clause).length === 0
      ? [clause]
      : groundInstances(clause, herbrandUniverse(clauses, depth)),
  )

  const holds = (literal: FoLiteral): boolean => {
    const positive = trueAtoms.some((entry) =>
      foLiteralsEqual({ ...entry, negated: false }, { ...literal, negated: false }),
    )
    return literal.negated ? !positive : positive
  }
  return ground.every((clause) => clause.some(holds))
}

// ---------------------------------------------------------------------------
// Equality — §4.4
// ---------------------------------------------------------------------------

/** The equality predicate, written `=` in the notes. */
export const EQUALITY = '='

export const isEquality = (literal: FoLiteral): boolean =>
  literal.predicate === EQUALITY && literal.args.length === 2

export interface ReflexivityStep {
  clause: FoClause
  /** The disequality that was resolved away. */
  literal: FoLiteral
  sigma: Substitution
}

/**
 * Reflexivity resolution — Definition 4.40.
 *
 * A clause containing `s ≠ t` where s and t unify loses that literal, and the
 * rest is instantiated by the mgu. It is what makes `∀x:x ≠ x` refutable, which
 * plain resolution cannot do.
 */
export function reflexivitySteps(clause: FoClause): ReflexivityStep[] {
  const found: ReflexivityStep[] = []
  for (const literal of clause) {
    if (!isEquality(literal) || !literal.negated) continue
    const sigma = mgu(literal.args[0] as Term, literal.args[1] as Term)
    if (sigma === null) continue
    const rest = applyToClause(
      sigma,
      clause.filter((other) => other !== literal),
    )
    if (found.some((existing) => foClausesEqual(existing.clause, rest))) continue
    found.push({ clause: rest, literal, sigma })
  }
  return found
}

export interface ParamodulationStep {
  clause: FoClause
  /** Which literal of the second clause was rewritten, and where. */
  into: FoLiteral
  position: Position
  sigma: Substitution
  /** True when the equation was used right-to-left. */
  reversed: boolean
}

/**
 * Paramodulation — Definition 4.42.
 *
 * From `s = t ∨ rest₁` and a clause containing a term r somewhere, if s and r
 * unify then r may be replaced by t. *One* occurrence, foNot all of them: the
 * replacement condition the notes state is about a single occurrence, which is
 * why `p(a,a)` gives `p(a,b)` and `p(b,a)` as well as `p(b,b)`.
 */
export function paramodulants(equationClause: FoClause, target: FoClause): ParamodulationStep[] {
  const other = renameClauseApart(target, foClauseVariables(equationClause))
  const found: ParamodulationStep[] = []

  for (const equation of equationClause) {
    if (!isEquality(equation) || equation.negated) continue

    for (const reversed of [false, true]) {
      const from = equation.args[reversed ? 1 : 0] as Term
      const to = equation.args[reversed ? 0 : 1] as Term

      for (const literal of other) {
        for (let index = 0; index < literal.args.length; index++) {
          const argument = literal.args[index] as Term
          for (const position of positions(argument)) {
            const sub = subtermAt(argument, position)
            if (sub === undefined || sub.kind === 'var') continue
            const sigma = mgu(from, sub)
            if (sigma === null) continue

            const args = [...literal.args]
            args[index] = replaceAt(argument, position, to)
            const rewritten: FoLiteral = { ...literal, args }

            const clause = normaliseFoClause([
              ...applyToClause(sigma, [rewritten]),
              ...applyToClause(
                sigma,
                equationClause.filter((entry) => entry !== equation),
              ),
              ...applyToClause(
                sigma,
                other.filter((entry) => entry !== literal),
              ),
            ])
            if (found.some((existing) => foClausesEqual(existing.clause, clause))) continue
            found.push({ clause, into: literal, position, sigma, reversed })
          }
        }
      }
    }
  }
  return found
}

/**
 * The equality axioms E_φ — the schema on p.84.
 *
 * Reflexivity, symmetry, transitivity, and one congruence axiom per function
 * and predicate symbol. Adding them lets *ordinary* resolution reason about
 * equality (Theorem 4.37), at the cost of a much bigger clause set — which is
 * the trade paramodulation exists to avoid.
 */
export function equalityAxioms(clauses: readonly FoClause[]): FoClause[] {
  const eq = (left: Term, right: Term, negated = false): FoLiteral => ({
    negated,
    predicate: EQUALITY,
    args: [left, right],
  })
  const v = variable

  const axioms: FoClause[] = [
    [eq(v('x'), v('x'))],
    [eq(v('x'), v('y'), true), eq(v('y'), v('x'))],
    [eq(v('x'), v('y'), true), eq(v('y'), v('z'), true), eq(v('x'), v('z'))],
  ]

  const language = herbrandLanguage(clauses)
  for (const [name, arity] of language.functions) {
    const xs = Array.from({ length: arity }, (_, index) => v(`x${index + 1}`))
    const ys = Array.from({ length: arity }, (_, index) => v(`y${index + 1}`))
    axioms.push([
      ...xs.map((left, index) => eq(left, ys[index] as Term, true)),
      eq({ kind: 'fn', name, args: xs }, { kind: 'fn', name, args: ys }),
    ])
  }

  const predicates = new Map<string, number>()
  for (const clause of clauses) {
    for (const literal of clause) {
      if (isEquality(literal)) continue
      predicates.set(literal.predicate, literal.args.length)
    }
  }
  for (const [name, arity] of predicates) {
    const xs = Array.from({ length: arity }, (_, index) => v(`x${index + 1}`))
    const ys = Array.from({ length: arity }, (_, index) => v(`y${index + 1}`))
    axioms.push([
      ...xs.map((left, index) => eq(left, ys[index] as Term, true)),
      { negated: true, predicate: name, args: xs },
      { negated: false, predicate: name, args: ys },
    ])
  }

  return axioms
}

/** For the guides: a clause set printed one clause per line. */
export const showClauseLines = (clauses: readonly FoClause[]): string[] =>
  clauses.map(showFoClause)

export const clauseFreeVariables = (clause: FoClause): string[] =>
  [...new Set(clause.flatMap((literal) => literal.args.flatMap(termVariables)))]
