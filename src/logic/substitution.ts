/**
 * Substitution, matching and unification — ln.pdf §3.2.
 *
 * A substitution maps variables to terms and is applied *simultaneously*: the
 * replacements happen in one pass, not one after another, and never
 * repeatedly. Getting that wrong is the standard mistake — applying
 * {x ↦ y, y ↦ f(x)} to g(f(x),z,y) one mapping at a time gives
 * g(f(f(x)),z,f(x)) instead of the correct g(f(y),z,f(x)).
 */

import {
  app,
  isVar,
  showTerm,
  termVariables,
  termsEqual,
  variable,
  type Term,
} from './terms'

/** Variables not listed map to themselves. */
export type Substitution = Readonly<Record<string, Term>>

export const EMPTY_SUBSTITUTION: Substitution = {}

/** Apply σ to a term. One pass, every variable at once. */
export function applySubstitution(sigma: Substitution, term: Term): Term {
  if (isVar(term)) return sigma[term.name] ?? term
  return app(term.name, term.args.map((arg) => applySubstitution(sigma, arg)))
}

/** Drop the mappings that do nothing, so `{x ↦ x}` prints as `{}`. */
export function trimSubstitution(sigma: Substitution): Substitution {
  const trimmed: Record<string, Term> = {}
  for (const [name, image] of Object.entries(sigma)) {
    if (!termsEqual(image, variable(name))) trimmed[name] = image
  }
  return trimmed
}

export const substitutionDomain = (sigma: Substitution): string[] =>
  Object.keys(trimSubstitution(sigma)).sort((a, b) => a.localeCompare(b))

export function showSubstitution(sigma: Substitution): string {
  const domain = substitutionDomain(sigma)
  if (domain.length === 0) return '{}'
  return `{${domain.map((name) => `${name} ↦ ${showTerm(sigma[name] as Term)}`).join(', ')}}`
}

export function substitutionsEqual(left: Substitution, right: Substitution): boolean {
  const a = trimSubstitution(left)
  const b = trimSubstitution(right)
  const names = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const name of names) {
    const leftImage = a[name] ?? variable(name)
    const rightImage = b[name] ?? variable(name)
    if (!termsEqual(leftImage, rightImage)) return false
  }
  return true
}

/**
 * σ ∘ σ′ — apply σ′ first, then σ. Definition on p.46 of the notes.
 *
 * Every variable in either domain gets a mapping, because a variable that σ′
 * leaves alone can still be moved by σ. The order matters and reversing it is
 * the exam's favourite trap: for σ = {x ↦ f(x)} and σ′ = {x ↦ y, y ↦ f(x)},
 * σ ∘ σ′ = {x ↦ y, y ↦ f(f(x))} while σ′ ∘ σ = {x ↦ f(y), y ↦ f(x)}.
 */
export function compose(sigma: Substitution, inner: Substitution): Substitution {
  const result: Record<string, Term> = {}
  for (const name of new Set([...Object.keys(inner), ...Object.keys(sigma)])) {
    const image = inner[name] ?? variable(name)
    result[name] = applySubstitution(sigma, image)
  }
  return trimSubstitution(result)
}

/**
 * A variable renaming: every variable goes to a variable, injectively.
 *
 * {x ↦ y, y ↦ x} is one; {x ↦ f(x)} is not (the image is not a variable) and
 * {x ↦ z, y ↦ z} is not (two variables collide) — Example 3.6.1.
 */
export function isVariableRenaming(sigma: Substitution): boolean {
  const trimmed = trimSubstitution(sigma)
  const images: string[] = []
  for (const [name, image] of Object.entries(trimmed)) {
    if (!isVar(image)) return false
    // Injective across the whole of V, not only across the domain: a variable
    // outside the domain maps to itself, so nothing in the domain may land on
    // one that is not being moved.
    if (images.includes(image.name)) return false
    if (image.name !== name && trimmed[image.name] === undefined) {
      const collidesWithFixedPoint = Object.keys(trimmed).includes(image.name)
      if (!collidesWithFixedPoint) {
        // `image.name` is not moved by σ, so σ maps both it and `name` onto it.
        return false
      }
    }
    images.push(image.name)
  }
  return true
}

// ---------------------------------------------------------------------------
// Matching — Algorithm 3.8
// ---------------------------------------------------------------------------

/**
 * A σ with σ(pattern) = target, or null when none exists.
 *
 * Only the pattern's variables move. The notes' letter-by-letter version needs
 * the two terms to share no variables; this structural version is the same
 * algorithm with that caveat handled properly — a variable already bound must
 * be bound the same way again, so `f(x,x)` matches `f(a,a)` but not `f(a,b)`.
 */
export function match(pattern: Term, target: Term): Substitution | null {
  const bindings: Record<string, Term> = {}

  const walk = (left: Term, right: Term): boolean => {
    if (isVar(left)) {
      const bound = bindings[left.name]
      if (bound !== undefined) return termsEqual(bound, right)
      bindings[left.name] = right
      return true
    }
    if (isVar(right)) return false
    if (left.name !== right.name || left.args.length !== right.args.length) return false
    return left.args.every((arg, index) => walk(arg, right.args[index] as Term))
  }

  return walk(pattern, target) ? trimSubstitution(bindings) : null
}

/**
 * t ≤ t′ — Definition 3.5. "t is more general than t′."
 *
 * Read it as: t′ is an instance of t. `f(x,y) ≤ f(x,g(z)) ≤ f(h(x),g(y))`.
 */
export const moreGeneral = (general: Term, specific: Term): boolean =>
  match(general, specific) !== null

/** Each is an instance of the other — Theorem 3.7.1, so they differ by renaming. */
export const areVariants = (left: Term, right: Term): boolean =>
  moreGeneral(left, right) && moreGeneral(right, left)

/** Neither is an instance of the other. `f(x)` and `g(x)`; `g(x)` and `g(y)` are not. */
export const areIncomparable = (left: Term, right: Term): boolean =>
  !moreGeneral(left, right) && !moreGeneral(right, left)

// ---------------------------------------------------------------------------
// Unification — Algorithm 3.13
// ---------------------------------------------------------------------------

/** Why unification failed, in the algorithm's own terms. */
export type UnifyFailure =
  | { reason: 'clash'; left: string; right: string }
  | { reason: 'occurs'; variable: string; term: Term }

export type UnifyResult =
  | { unified: true; mgu: Substitution }
  | { unified: false; failure: UnifyFailure }

/** Does `name` occur in `term`? The check that makes f(x) and f(f(x)) fail. */
export const occurs = (name: string, term: Term): boolean => termVariables(term).includes(name)

/**
 * A most general unifier, or the reason there is none.
 *
 * Two ways to fail, and the exam asks you to name which: a **clash** of two
 * different function symbols, which no substitution can repair, and the
 * **occurs check** — x against a term containing x, where every substitution
 * only pushes the mismatch one symbol further along, forever.
 */
export function unify(left: Term, right: Term): UnifyResult {
  let sigma: Substitution = {}

  const bind = (name: string, term: Term): UnifyFailure | null => {
    if (occurs(name, term)) return { reason: 'occurs', variable: name, term }
    // `name` is unbound here — the caller normalised both sides through sigma
    // before comparing — so composing brings the new binding in along with the
    // existing ones, each updated by it.
    sigma = compose({ [name]: term }, sigma)
    return null
  }

  const walk = (a: Term, b: Term): UnifyFailure | null => {
    const one = applySubstitution(sigma, a)
    const two = applySubstitution(sigma, b)
    if (termsEqual(one, two)) return null

    if (isVar(one)) return bind(one.name, two)
    if (isVar(two)) return bind(two.name, one)

    if (one.name !== two.name || one.args.length !== two.args.length) {
      return { reason: 'clash', left: one.name, right: two.name }
    }
    for (let index = 0; index < one.args.length; index++) {
      const failure = walk(one.args[index] as Term, two.args[index] as Term)
      if (failure !== null) return failure
    }
    return null
  }

  const failure = walk(left, right)
  if (failure !== null) return { unified: false, failure }
  return { unified: true, mgu: trimSubstitution(sigma) }
}

/** The mgu, or null. For when the reason for failure does not matter. */
export function mgu(left: Term, right: Term): Substitution | null {
  const result = unify(left, right)
  return result.unified ? result.mgu : null
}

export const areUnifiable = (left: Term, right: Term): boolean => mgu(left, right) !== null

/**
 * A copy of the term with every variable renamed apart from `avoid`.
 *
 * Critical pairs need this: two rules that happen to use the same variable
 * name are not thereby talking about the same variable, and unifying them
 * without renaming invents overlaps that are not there.
 */
export function renameApart(term: Term, avoid: readonly string[], mark = "'"): Term {
  const renaming: Record<string, Term> = {}
  for (const name of termVariables(term)) {
    let fresh = name + mark
    while (avoid.includes(fresh)) fresh += mark
    renaming[name] = variable(fresh)
  }
  return applySubstitution(renaming, term)
}
