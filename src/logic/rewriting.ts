/**
 * Term orders, reduction, critical pairs and completion — ln.pdf §3.3–3.4.
 *
 * The chapter's arc in one paragraph: deciding `E ⊢ t=t′` by searching the
 * graph of all equal terms is hopeless because the graph is infinite, so
 * instead you pick a *normal form* in each connected component and walk both
 * terms down to it. Walking downhill needs an order; a reduction system is a
 * set of equations already oriented downhill; reduction need not give a unique
 * answer; the places where it forks are the critical pairs; and completion
 * adds rules until the forks join back up — when it terminates, which it need
 * not.
 */

import {
  app,
  isVar,
  replaceAt,
  positions,
  showTerm,
  subtermAt,
  termSize,
  termsEqual,
  termVariables,
  variableCounts,
  type Position,
  type Term,
} from './terms'
import {
  applySubstitution,
  match,
  mgu,
  renameApart,
  type Substitution,
} from './substitution'

// ---------------------------------------------------------------------------
// Term orders — Definition 3.20
// ---------------------------------------------------------------------------

/**
 * How two terms compare. `incomparable` is a real answer, not a failure:
 * Definition 3.20 asks for a *partial* order, and the notes prove no term
 * order can compare every pair — `g(x)` and `g(y)` never compare, whatever
 * order you pick.
 */
export type Comparison = 'greater' | 'less' | 'equal' | 'incomparable'

export interface TermOrder {
  id: string
  name: string
  /** How `left` stands to `right`. */
  compare: (left: Term, right: Term) => Comparison
}

export const greaterIn = (order: TermOrder, left: Term, right: Term): boolean =>
  order.compare(left, right) === 'greater'

/**
 * More symbols, and no variable used less often — the notes' first order.
 *
 * The naive "more symbols" alone is not a term order: f(x) ≻ y by symbol
 * count, but {y ↦ f(f(x))} flips it, breaking part 3 of Definition 3.20.
 * Counting variable occurrences is exactly the repair.
 */
export const sizeOrder: TermOrder = {
  id: 'size',
  name: 'symbol count, watching the variables',
  compare(left, right) {
    if (termsEqual(left, right)) return 'equal'
    const dominates = (big: Term, small: Term): boolean => {
      if (termSize(big) <= termSize(small)) return false
      const bigCounts = variableCounts(big)
      for (const [name, count] of variableCounts(small)) {
        if ((bigCounts.get(name) ?? 0) < count) return false
      }
      return true
    }
    if (dominates(left, right)) return 'greater'
    if (dominates(right, left)) return 'less'
    return 'incomparable'
  },
}

/**
 * Order the function symbols, then compare arguments left to right.
 *
 * Exercise 6's order, and the notes' second one: `p(s₁,…) ≺ q(t₁,…)` if p < q,
 * or p = q and the first differing argument compares that way. A variable at
 * the deciding position makes the pair incomparable — which is precisely why
 * `p(x)` and `p(y)` never compare.
 *
 * On its own this is not a term order either: it has the infinite descending
 * chain g(h(x)) ≻ g(g(h(x))) ≻ … , breaking part 5.
 */
export function precedenceOrder(precedence: readonly string[]): TermOrder {
  const rank = (name: string): number => {
    const index = precedence.indexOf(name)
    return index === -1 ? precedence.length + name.charCodeAt(0) : index
  }

  const compare = (left: Term, right: Term): Comparison => {
    if (termsEqual(left, right)) return 'equal'
    if (isVar(left) || isVar(right)) return 'incomparable'
    if (left.name !== right.name) return rank(left.name) > rank(right.name) ? 'greater' : 'less'
    if (left.args.length !== right.args.length) {
      return left.args.length > right.args.length ? 'greater' : 'less'
    }
    for (let index = 0; index < left.args.length; index++) {
      const a = left.args[index] as Term
      const b = right.args[index] as Term
      if (termsEqual(a, b)) continue
      return compare(a, b)
    }
    return 'equal'
  }

  return { id: 'precedence', name: 'function symbols in order, then argument by argument', compare }
}

/**
 * Size first, precedence to break the ties — the combination the notes propose
 * and Exercise 6 states outright. Neither half is a term order alone; together
 * they are.
 */
export function combinedOrder(precedence: readonly string[]): TermOrder {
  const lex = precedenceOrder(precedence)
  return {
    id: 'combined',
    name: 'size first, then symbol order',
    compare(left, right) {
      const bySize = sizeOrder.compare(left, right)
      if (bySize !== 'incomparable') return bySize
      return lex.compare(left, right)
    },
  }
}

/** The default the games use: f < g < h < …, size first. */
export const DEFAULT_PRECEDENCE = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'p', 'q', 'r', 's', 't']
export const defaultOrder = combinedOrder(DEFAULT_PRECEDENCE)

// ---------------------------------------------------------------------------
// Reduction systems — Algorithm 3.21
// ---------------------------------------------------------------------------

/** An oriented equation, written l→r. */
export interface Rule {
  left: Term
  right: Term
}

export const rule = (left: Term, right: Term): Rule => ({ left, right })

export const showRule = (r: Rule): string => `${showTerm(r.left)} → ${showTerm(r.right)}`

export const showRules = (rules: readonly Rule[]): string =>
  `{${rules.map(showRule).join(', ')}}`

export const rulesEqual = (a: Rule, b: Rule): boolean =>
  termsEqual(a.left, b.left) && termsEqual(a.right, b.right)

/**
 * Rename a rule's variables to x, y, z, … in order of first appearance.
 *
 * Critical pairs are computed on renamed-apart copies, so a rule derived from
 * one arrives wearing whatever primed names the algorithm happened to invent.
 * Those names carry no information — a rule is the same rule under any
 * renaming — and leaving them in makes the output of completion unreadable.
 */
export function canonicalVariables<T extends { left: Term; right: Term }>(pair: T): T {
  const NAMES = ['x', 'y', 'z', 'w', 'v', 'u']
  const seen = [...new Set([...termVariables(pair.left), ...termVariables(pair.right)])]
  const renaming: Record<string, Term> = {}
  seen.forEach((name, index) => {
    const fresh = NAMES[index] ?? `x${index + 1}`
    renaming[name] = { kind: 'var', name: fresh }
  })
  return {
    ...pair,
    left: applySubstitution(renaming, pair.left),
    right: applySubstitution(renaming, pair.right),
  }
}

/**
 * Is this a legal reduction system for the order?
 *
 * Two conditions, both from §3.3: every rule points downhill, and no rule
 * conjures a variable on the right that the left does not have — otherwise
 * reduction would have to invent a term.
 */
export function isReductionSystem(rules: readonly Rule[], order: TermOrder): boolean {
  return rules.every((r) => {
    if (order.compare(r.left, r.right) !== 'greater') return false
    const left = termVariables(r.left)
    return termVariables(r.right).every((name) => left.includes(name))
  })
}

/** One place a rule fires: which rule, where, and with what instantiation. */
export interface Redex {
  ruleIndex: number
  position: Position
  sigma: Substitution
  /** The whole term after firing. */
  result: Term
}

/** Every rule application available on this term, root first. */
export function redexes(rules: readonly Rule[], term: Term): Redex[] {
  const found: Redex[] = []
  for (const position of positions(term)) {
    const sub = subtermAt(term, position)
    if (sub === undefined) continue
    rules.forEach((r, ruleIndex) => {
      const sigma = match(r.left, sub)
      if (sigma === null) return
      found.push({
        ruleIndex,
        position,
        sigma,
        result: replaceAt(term, position, applySubstitution(sigma, r.right)),
      })
    })
  }
  return found
}

export const isNormalForm = (rules: readonly Rule[], term: Term): boolean =>
  redexes(rules, term).length === 0

/**
 * Reduce until nothing applies, always taking the first redex available.
 *
 * A *strategy*, not the algorithm: Algorithm 3.21 says "pick such a subterm",
 * and which one you pick can change the answer. That freedom is the whole
 * point of §3.4, so the chain is returned rather than only the result.
 */
export function reduce(
  rules: readonly Rule[],
  term: Term,
  limit = 200,
): { chain: Term[]; result: Term; steps: Redex[] } {
  const chain: Term[] = [term]
  const steps: Redex[] = []
  let current = term
  for (let step = 0; step < limit; step++) {
    const next = redexes(rules, current)[0]
    if (next === undefined) break
    steps.push(next)
    current = next.result
    chain.push(current)
  }
  return { chain, result: current, steps }
}

/**
 * Every term the algorithm *could* return — Exercise 6 question 2.
 *
 * Reduction terminates, so this search does too, but a wide system can still
 * blow up: `limit` caps the number of distinct terms explored and the search
 * gives up rather than hanging.
 */
export function normalForms(rules: readonly Rule[], term: Term, limit = 4000): Term[] {
  const seen = new Set<string>([showTerm(term)])
  const queue: Term[] = [term]
  const results: Term[] = []

  while (queue.length > 0) {
    if (seen.size > limit) break
    const current = queue.shift() as Term
    const next = redexes(rules, current)
    if (next.length === 0) {
      if (!results.some((found) => termsEqual(found, current))) results.push(current)
      continue
    }
    for (const step of next) {
      const key = showTerm(step.result)
      if (seen.has(key)) continue
      seen.add(key)
      queue.push(step.result)
    }
  }
  return results
}

/** Every term reachable by any number of steps, the starting term included. */
export function reachable(rules: readonly Rule[], term: Term, limit = 2000): Term[] {
  const seen = new Map<string, Term>([[showTerm(term), term]])
  const queue: Term[] = [term]
  while (queue.length > 0 && seen.size <= limit) {
    const current = queue.shift() as Term
    for (const step of redexes(rules, current)) {
      const key = showTerm(step.result)
      if (seen.has(key)) continue
      seen.set(key, step.result)
      queue.push(step.result)
    }
  }
  return [...seen.values()]
}

// ---------------------------------------------------------------------------
// Critical pairs — Algorithm 3.25
// ---------------------------------------------------------------------------

export interface CriticalPair {
  left: Term
  right: Term
  /** Indices of the two rules that fork, outer first. */
  from: [number, number]
  /** Where inside the outer rule's left side the inner one matched. */
  position: Position
  sigma: Substitution
}

export const showPair = (pair: CriticalPair): string =>
  `(${showTerm(pair.left)}, ${showTerm(pair.right)})`

/**
 * Every critical pair of a reduction system.
 *
 * A pair arises where two rules' left sides *overlap*: unify a non-variable
 * subterm of one left side with the whole of the other (renamed apart, or the
 * two rules' variables would be confused for each other), then read off the
 * two terms the fork leads to.
 *
 * Trivial pairs are dropped. A rule always overlaps its own renamed copy at
 * the root, which yields a pair of variants of the same term — a fork that was
 * never a fork. Pairs whose two sides are literally identical go for the same
 * reason.
 */
export function criticalPairs(rules: readonly Rule[]): CriticalPair[] {
  const pairs: CriticalPair[] = []

  rules.forEach((outer, outerIndex) => {
    rules.forEach((inner, innerIndex) => {
      const avoid = [...termVariables(outer.left), ...termVariables(outer.right)]
      const innerLeft = renameApart(inner.left, avoid)
      const innerRight = renameApart(inner.right, avoid)

      for (const position of positions(outer.left)) {
        const sub = subtermAt(outer.left, position)
        if (sub === undefined || isVar(sub)) continue
        // A rule against its own copy at the root is not an overlap.
        if (outerIndex === innerIndex && position.length === 0) continue

        const sigma = mgu(sub, innerLeft)
        if (sigma === null) continue

        const left = applySubstitution(sigma, outer.right)
        const rewritten = replaceAt(
          applySubstitution(sigma, outer.left),
          position,
          applySubstitution(sigma, innerRight),
        )
        if (termsEqual(left, rewritten)) continue
        if (pairs.some((existing) => samePair(existing, { left, right: rewritten }))) continue

        pairs.push(
          canonicalVariables({
            left,
            right: rewritten,
            from: [outerIndex, innerIndex] as [number, number],
            position,
            sigma,
          }),
        )
      }
    })
  })

  return pairs
}

/**
 * Are these the same critical pair?
 *
 * Up to swapping the two sides — a fork has no preferred branch — and up to
 * renaming, since which variable names the algorithm invented is an accident
 * of the order it ran in. Exercise 6 says as much in its own rubric.
 */
export function samePair(
  a: { left: Term; right: Term },
  b: { left: Term; right: Term },
): boolean {
  const variantPair = (x: { left: Term; right: Term }, y: { left: Term; right: Term }): boolean => {
    // Rename both sides together, so a shared variable stays shared.
    const packed = (p: { left: Term; right: Term }): Term => app('$pair', [p.left, p.right])
    const one = packed(x)
    const two = packed(y)
    return match(one, two) !== null && match(two, one) !== null
  }
  return variantPair(a, b) || variantPair(a, { left: b.right, right: b.left })
}

// ---------------------------------------------------------------------------
// Knuth-Bendix completion — Algorithm 3.26
// ---------------------------------------------------------------------------

export type CompletionStatus = 'completed' | 'failed' | 'ran-out'

export interface CompletionStep {
  pair: { left: Term; right: Term }
  /** The two sides after reduction. */
  reduced: [Term, Term]
  /** The rule that was added, if any. */
  added: Rule | null
  /** Set when the pair could not be oriented — Algorithm 3.26 line 7. */
  stuck: boolean
}

export interface Completion {
  status: CompletionStatus
  rules: Rule[]
  steps: CompletionStep[]
}

/**
 * Complete a reduction system, or say why it cannot be.
 *
 * Two ways not to finish, and the difference matters: **failed** means a
 * critical pair reduced to two incomparable terms, so no rule can be made out
 * of it — a different term order might work. **ran-out** means the budget was
 * spent while pairs were still arriving, which is the shape of genuine
 * non-termination. Theorem 3.29 guarantees no algorithm avoids the second in
 * general.
 */
export function complete(
  start: readonly Rule[],
  order: TermOrder,
  budget = 40,
): Completion {
  const rules: Rule[] = [...start]
  const steps: CompletionStep[] = []
  let queue: { left: Term; right: Term }[] = criticalPairs(rules)

  for (let round = 0; round < budget; round++) {
    const pair = queue.shift()
    if (pair === undefined) return { status: 'completed', rules, steps }

    const left = reduce(rules, pair.left).result
    const right = reduce(rules, pair.right).result
    if (termsEqual(left, right)) {
      steps.push({ pair, reduced: [left, right], added: null, stuck: false })
      continue
    }

    const comparison = order.compare(left, right)
    if (comparison === 'incomparable' || comparison === 'equal') {
      steps.push({ pair, reduced: [left, right], added: null, stuck: true })
      return { status: 'failed', rules, steps }
    }

    const added = canonicalVariables(
      comparison === 'greater' ? rule(left, right) : rule(right, left),
    )
    rules.push(added)
    steps.push({ pair, reduced: [left, right], added, stuck: false })

    // Recompute rather than track incrementally: the systems here are small,
    // and a missed pair would silently produce a wrong "completed".
    const fresh = criticalPairs(rules)
    queue = fresh.filter(
      (candidate) =>
        !steps.some((done) => samePair(done.pair, candidate)) &&
        !queue.some((waiting) => samePair(waiting, candidate)),
    )
    queue = [...queue]
  }

  return { status: 'ran-out', rules, steps }
}

/**
 * Is the system confluent as it stands?
 *
 * Every critical pair joins: both sides reduce to the same normal form. This
 * is the property completion is trying to establish, and Theorem 3.28 is what
 * makes it worth having.
 */
export function isConfluent(rules: readonly Rule[]): boolean {
  return criticalPairs(rules).every((pair) =>
    termsEqual(reduce(rules, pair.left).result, reduce(rules, pair.right).result),
  )
}
