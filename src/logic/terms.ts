/**
 * Terms — ln.pdf §3.1, Definition 3.1.
 *
 * A term is a *syntactic* object: a finite string assembled from function
 * symbols, variables, brackets and commas. Two terms are equal exactly when
 * they agree letter by letter, which is why everything here compares by
 * structure and never by meaning. `f(x)` is not the value of a function at an
 * argument; it is four letters.
 *
 * A signature fixes which symbols exist and how many arguments each takes.
 * Variables are whatever is not a function symbol — the notes' convention is
 * that letters from the end of the alphabet (w, x, y, z) are variables and
 * ones from the front (f, g, h) are function symbols, but nothing depends on
 * that: the signature is the authority.
 */

export interface Variable {
  kind: 'var'
  name: string
}

export interface Application {
  kind: 'fn'
  name: string
  args: Term[]
}

export type Term = Variable | Application

/** Function symbol → arity. A symbol of arity 0 is a constant. */
export type Signature = Readonly<Record<string, number>>

export const variable = (name: string): Variable => ({ kind: 'var', name })

export const app = (name: string, args: Term[] = []): Application => ({ kind: 'fn', name, args })

/** A constant: a function symbol of arity zero, written `c()`. */
export const constant = (name: string): Application => app(name, [])

export const isVar = (term: Term): term is Variable => term.kind === 'var'

// ---------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------

/**
 * The term as the notes write it: `g(f(x),y)`, constants as `c()`.
 *
 * No spaces, because a term is a string and the string is what is compared.
 */
export function showTerm(term: Term): string {
  if (isVar(term)) return term.name
  return `${term.name}(${term.args.map(showTerm).join(',')})`
}

/** The letters of a term with the brackets and commas removed — Exercise 4. */
export const flatten = (term: Term): string =>
  isVar(term) ? term.name : term.name + term.args.map(flatten).join('')

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

/** Letter-by-letter equality, which for terms is the only equality there is. */
export function termsEqual(left: Term, right: Term): boolean {
  if (left.kind !== right.kind) return false
  if (isVar(left)) return left.name === (right as Variable).name
  const other = right as Application
  if (left.name !== other.name || left.args.length !== other.args.length) return false
  return left.args.every((arg, index) => termsEqual(arg, other.args[index] as Term))
}

/** var(t) — the variables occurring in a term, in first-seen order. */
export function termVariables(term: Term): string[] {
  const seen: string[] = []
  const walk = (node: Term): void => {
    if (isVar(node)) {
      if (!seen.includes(node.name)) seen.push(node.name)
      return
    }
    for (const arg of node.args) walk(arg)
  }
  walk(term)
  return seen
}

/** How often each variable occurs — needed by the size-based term order. */
export function variableCounts(term: Term): Map<string, number> {
  const counts = new Map<string, number>()
  const walk = (node: Term): void => {
    if (isVar(node)) {
      counts.set(node.name, (counts.get(node.name) ?? 0) + 1)
      return
    }
    for (const arg of node.args) walk(arg)
  }
  walk(term)
  return counts
}

/** `var(t) = ∅` — Example 3.3.2. */
export const isGround = (term: Term): boolean => termVariables(term).length === 0

/** Number of symbols: function symbols and variable occurrences. */
export function termSize(term: Term): number {
  return isVar(term) ? 1 : 1 + term.args.reduce((total, arg) => total + termSize(arg), 0)
}

/** Nesting depth; a variable or constant has depth 1. */
export function termDepth(term: Term): number {
  if (isVar(term) || term.args.length === 0) return 1
  return 1 + Math.max(...term.args.map(termDepth))
}

/** The function symbols used, in first-seen order. */
export function termSymbols(term: Term): string[] {
  const seen: string[] = []
  const walk = (node: Term): void => {
    if (isVar(node)) return
    if (!seen.includes(node.name)) seen.push(node.name)
    for (const arg of node.args) walk(arg)
  }
  walk(term)
  return seen
}

/**
 * A position in a term: the path of argument indices from the root.
 *
 * The empty path is the root. Positions are how a rewrite says *where* it
 * fired, which matters as soon as one term has two redexes.
 */
export type Position = readonly number[]

export const showPosition = (position: Position): string =>
  position.length === 0 ? 'ε' : position.map((index) => index + 1).join('.')

export const positionsEqual = (left: Position, right: Position): boolean =>
  left.length === right.length && left.every((index, at) => index === right[at])

/** The subterm at a position, or undefined if the path runs off the term. */
export function subtermAt(term: Term, position: Position): Term | undefined {
  let current: Term = term
  for (const index of position) {
    if (isVar(current)) return undefined
    const next = current.args[index]
    if (next === undefined) return undefined
    current = next
  }
  return current
}

/** A copy of `term` with the subterm at `position` replaced. */
export function replaceAt(term: Term, position: Position, replacement: Term): Term {
  if (position.length === 0) return replacement
  if (isVar(term)) return term
  const [index, ...rest] = position
  const child = term.args[index as number]
  if (child === undefined) return term
  const args = [...term.args]
  args[index as number] = replaceAt(child, rest, replacement)
  return app(term.name, args)
}

/** Every position in the term, root first, then left to right. */
export function positions(term: Term): Position[] {
  const found: Position[] = []
  const walk = (node: Term, path: number[]): void => {
    found.push([...path])
    if (isVar(node)) return
    node.args.forEach((arg, index) => walk(arg, [...path, index]))
  }
  walk(term, [])
  return found
}

/**
 * subterms(t) — Example 3.3.
 *
 * A *set*: `g(g(x,y),g(f(y),x))` has six subterms, not seven, because `x`
 * occurring twice is one subterm.
 */
export function subterms(term: Term): Term[] {
  const found: Term[] = []
  for (const position of positions(term)) {
    const sub = subtermAt(term, position) as Term
    if (!found.some((existing) => termsEqual(existing, sub))) found.push(sub)
  }
  return found
}

export const isSubterm = (candidate: Term, term: Term): boolean =>
  subterms(term).some((sub) => termsEqual(sub, candidate))

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export class TermParseError extends Error {}

/**
 * Read `f(g(x),y)`.
 *
 * A bare name is a variable unless the signature gives it an arity, so `c`
 * and `c()` both read as the constant `c` when the signature says so. Symbol
 * names are single letters possibly followed by digits (`h1`), which is what
 * the exams use.
 */
export function parseTerm(source: string, signature: Signature = {}): Term {
  let index = 0
  const text = source.replace(/\s+/g, '')

  const fail = (message: string): never => {
    throw new TermParseError(`${message} (position ${index + 1} of "${source}")`)
  }

  const name = (): string => {
    const start = index
    if (!/[A-Za-z_]/.test(text[index] ?? '')) fail('Expected a symbol')
    index++
    while (/[A-Za-z0-9_']/.test(text[index] ?? '')) index++
    return text.slice(start, index)
  }

  const term = (): Term => {
    const symbol = name()
    if (text[index] !== '(') {
      const arity = signature[symbol]
      if (arity !== undefined && arity > 0) {
        return fail(`${symbol} takes ${arity} argument${arity === 1 ? '' : 's'}`)
      }
      return arity === 0 ? constant(symbol) : variable(symbol)
    }
    index++
    const args: Term[] = []
    if (text[index] !== ')') {
      args.push(term())
      while (text[index] === ',') {
        index++
        args.push(term())
      }
    }
    if (text[index] !== ')') fail('Expected )')
    index++
    const arity = signature[symbol]
    if (arity !== undefined && arity !== args.length) {
      fail(`${symbol} takes ${arity} argument${arity === 1 ? '' : 's'}, got ${args.length}`)
    }
    return app(symbol, args)
  }

  const result = term()
  if (index !== text.length) fail('Trailing input')
  return result
}

/** An equation `t = t′`, which is only a pair of terms written suggestively. */
export interface Equation {
  left: Term
  right: Term
}

export const equation = (left: Term, right: Term): Equation => ({ left, right })

export const showEquation = (eq: Equation): string => `${showTerm(eq.left)}=${showTerm(eq.right)}`

export const equationsEqual = (a: Equation, b: Equation): boolean =>
  termsEqual(a.left, b.left) && termsEqual(a.right, b.right)

export function parseEquation(source: string, signature: Signature = {}): Equation {
  const parts = source.split(/=|→|->/)
  if (parts.length !== 2) throw new TermParseError(`Not an equation: "${source}"`)
  return equation(
    parseTerm(parts[0] as string, signature),
    parseTerm(parts[1] as string, signature),
  )
}

// ---------------------------------------------------------------------------
// The keyboard with the broken comma key — Exercise 4, Collection Q11
// ---------------------------------------------------------------------------

/**
 * Read a term back out of its letters, with the brackets and commas gone.
 *
 * This is only possible because the arities are known: reading left to right,
 * every symbol says exactly how many terms must follow it. That is the whole
 * content of the exercise — the string carries no structure, the signature
 * does.
 *
 * Returns null when the letters do not spell a term: too few arguments, or
 * letters left over at the end.
 */
export function parseFlatTerm(letters: string, signature: Signature): Term | null {
  let index = 0

  const term = (): Term | null => {
    const symbol = letters[index]
    if (symbol === undefined) return null
    index++
    const arity = signature[symbol]
    if (arity === undefined) return variable(symbol)
    const args: Term[] = []
    for (let count = 0; count < arity; count++) {
      const arg = term()
      if (arg === null) return null
      args.push(arg)
    }
    return app(symbol, args)
  }

  const result = term()
  return result !== null && index === letters.length ? result : null
}

/**
 * Where each subterm of a flattened term begins and ends.
 *
 * `flatten` throws the structure away, so a game that asks you to point at a
 * subterm inside the flat string needs the spans back. Every position of the
 * term gets one, in the same order `positions` returns.
 */
export interface FlatSpan {
  position: Position
  /** Index of the first letter, inclusive. */
  start: number
  /** Index one past the last letter. */
  end: number
  term: Term
}

export function flatSpans(term: Term): FlatSpan[] {
  const spans: FlatSpan[] = []
  let cursor = 0

  const walk = (node: Term, path: number[]): void => {
    const start = cursor
    cursor += 1
    if (!isVar(node)) node.args.forEach((arg, index) => walk(arg, [...path, index]))
    spans.push({ position: [...path], start, end: cursor, term: node })
  }

  walk(term, [])
  return spans.sort((a, b) => a.start - b.start || b.end - a.end)
}
