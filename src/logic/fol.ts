/**
 * First-order logic — ln.pdf §4.1, Definition 4.1.
 *
 * A formula is built from atoms `p(t₁,…,tₙ)` over terms, the propositional
 * connectives, and the two quantifiers. Terms are the ones from chapter 3
 * unchanged, which is the point of having done chapter 3 first: `p(f(x),y)` is
 * a predicate symbol applied to terms, and everything already known about
 * substitution and unification applies to its arguments.
 *
 * Two things the chapter is careful about and so is this file. A *variable
 * occurrence* is bound or free, foNot a variable — `p(x)∨∃x:q(x)` has both. And
 * a formula is *clean* when every variable is either free or bound by exactly
 * one quantifier, which is what makes the prenex transformation possible at
 * all.
 */

import {
  app,
  isVar,
  parseTerm,
  showTerm,
  termVariables,
  termsEqual,
  variable,
  type Signature,
  type Term,
} from './terms'
import { applySubstitution, type Substitution } from './substitution'

export type Quantifier = 'forall' | 'exists'
export type FoConnective = 'and' | 'or' | 'implies' | 'iff'

export type FoFormula =
  | { kind: 'true' }
  | { kind: 'false' }
  | { kind: 'atom'; predicate: string; args: Term[] }
  | { kind: 'not'; body: FoFormula }
  | { kind: 'binary'; connective: FoConnective; left: FoFormula; right: FoFormula }
  | { kind: 'quantified'; quantifier: Quantifier; variable: string; body: FoFormula }

export const atom = (predicate: string, args: Term[] = []): FoFormula => ({
  kind: 'atom',
  predicate,
  args,
})
export const foNot = (body: FoFormula): FoFormula => ({ kind: 'not', body })
export const binary = (connective: FoConnective, left: FoFormula, right: FoFormula): FoFormula => ({
  kind: 'binary',
  connective,
  left,
  right,
})
export const forall = (name: string, body: FoFormula): FoFormula => ({
  kind: 'quantified',
  quantifier: 'forall',
  variable: name,
  body,
})
export const exists = (name: string, body: FoFormula): FoFormula => ({
  kind: 'quantified',
  quantifier: 'exists',
  variable: name,
  body,
})

/** Predicate symbol → arity, alongside the term signature. */
export interface FoSignature {
  predicates: Readonly<Record<string, number>>
  functions: Signature
}

// ---------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------

const CONNECTIVE_SYMBOL: Record<FoConnective, string> = {
  and: '∧',
  or: '∨',
  implies: '→',
  iff: '↔',
}

const QUANTIFIER_SYMBOL: Record<Quantifier, string> = { forall: '∀', exists: '∃' }

/**
 * The formula as the notes write it.
 *
 * Binary formulas are always bracketed, as Definition 4.1 does — a quantifier
 * scope reaches as far right as it can, and dropping brackets around a binary
 * subformula under a quantifier changes what is bound.
 */
export function showFormula(formula: FoFormula): string {
  switch (formula.kind) {
    case 'true':
      return '⊤'
    case 'false':
      return '⊥'
    case 'atom':
      return formula.args.length === 0
        ? formula.predicate
        : `${formula.predicate}(${formula.args.map(showTerm).join(',')})`
    case 'not':
      return `¬${showFormula(formula.body)}`
    case 'binary':
      return `(${operand(formula.left)}${CONNECTIVE_SYMBOL[formula.connective]}${operand(formula.right)})`
    case 'quantified':
      return `${QUANTIFIER_SYMBOL[formula.quantifier]}${formula.variable}:${showFormula(formula.body)}`
  }
}

/**
 * An operand of a binary connective, bracketed when it has to be.
 *
 * A quantifier's scope runs as far right as the text allows, so printing
 * `(∀x:p(x))→q` without its brackets gives a string that reads back as
 * `∀x:(p(x)→q)` — a different formula with a different prefix. Anything whose
 * rightmost part is a quantifier body needs the brackets kept.
 */
function operand(formula: FoFormula): string {
  const openEnded =
    formula.kind === 'quantified' ||
    (formula.kind === 'not' && needsBrackets(formula.body))
  return openEnded ? `(${showFormula(formula)})` : showFormula(formula)
}

const needsBrackets = (formula: FoFormula): boolean =>
  formula.kind === 'quantified' || (formula.kind === 'not' && needsBrackets(formula.body))

/** One variable occurrence inside an atom, with where it prints. */
export interface VariableSpot {
  /** Index of its first character in `showFormula(formula)`. */
  at: number
  name: string
  bound: boolean
}

/**
 * The printed formula, and where every variable occurrence lands in it.
 *
 * Written here rather than in the game so there is one printer: a second walker
 * that reproduces `showFormula`'s bracketing by hand drifts the moment the
 * bracketing rule changes, and it did.
 *
 * The variable written beside a quantifier is the binder, not an occurrence,
 * so it is not reported — which is how the notes read the tree too.
 */
export function renderWithPositions(formula: FoFormula): {
  text: string
  spots: VariableSpot[]
} {
  const spots: VariableSpot[] = []
  let text = ''

  const emit = (piece: string): void => {
    text += piece
  }

  const walkTerm = (term: Term, bound: readonly string[]): void => {
    if (isVar(term)) {
      spots.push({ at: text.length, name: term.name, bound: bound.includes(term.name) })
      emit(term.name)
      return
    }
    emit(`${term.name}(`)
    term.args.forEach((arg, index) => {
      if (index > 0) emit(',')
      walkTerm(arg, bound)
    })
    emit(')')
  }

  const walk = (node: FoFormula, bound: readonly string[]): void => {
    switch (node.kind) {
      case 'true':
      case 'false':
        emit(showFormula(node))
        return
      case 'atom':
        if (node.args.length === 0) {
          emit(node.predicate)
          return
        }
        emit(`${node.predicate}(`)
        node.args.forEach((arg, index) => {
          if (index > 0) emit(',')
          walkTerm(arg, bound)
        })
        emit(')')
        return
      case 'not':
        emit('¬')
        walk(node.body, bound)
        return
      case 'binary': {
        emit('(')
        const bracketLeft = needsBrackets(node.left)
        if (bracketLeft) emit('(')
        walk(node.left, bound)
        if (bracketLeft) emit(')')
        emit(CONNECTIVE_SYMBOL[node.connective])
        const bracketRight = needsBrackets(node.right)
        if (bracketRight) emit('(')
        walk(node.right, bound)
        if (bracketRight) emit(')')
        emit(')')
        return
      }
      case 'quantified':
        emit(QUANTIFIER_SYMBOL[node.quantifier])
        emit(node.variable)
        emit(':')
        walk(node.body, [...bound, node.variable])
        return
    }
  }

  walk(formula, [])
  return { text, spots }
}

export function formulasEqual(left: FoFormula, right: FoFormula): boolean {
  if (left.kind !== right.kind) return false
  switch (left.kind) {
    case 'true':
    case 'false':
      return true
    case 'atom': {
      const other = right as typeof left
      return (
        left.predicate === other.predicate &&
        left.args.length === other.args.length &&
        left.args.every((arg, index) => termsEqual(arg, other.args[index] as Term))
      )
    }
    case 'not':
      return formulasEqual(left.body, (right as typeof left).body)
    case 'binary': {
      const other = right as typeof left
      return (
        left.connective === other.connective &&
        formulasEqual(left.left, other.left) &&
        formulasEqual(left.right, other.right)
      )
    }
    case 'quantified': {
      const other = right as typeof left
      return (
        left.quantifier === other.quantifier &&
        left.variable === other.variable &&
        formulasEqual(left.body, other.body)
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

/** Every subformula, root first. */
export function foSubformulas(formula: FoFormula): FoFormula[] {
  const found: FoFormula[] = [formula]
  if (formula.kind === 'not') found.push(...foSubformulas(formula.body))
  if (formula.kind === 'binary') {
    found.push(...foSubformulas(formula.left), ...foSubformulas(formula.right))
  }
  if (formula.kind === 'quantified') found.push(...foSubformulas(formula.body))
  return found
}

export const isAtom = (formula: FoFormula): boolean => formula.kind === 'atom'

/** An atom or a negated atom — Exercise 7's vocabulary question. */
export const isLiteralFormula = (formula: FoFormula): boolean =>
  formula.kind === 'atom' || (formula.kind === 'not' && formula.body.kind === 'atom')

/** An atom whose arguments are all ground. */
export const isGroundAtom = (formula: FoFormula): boolean =>
  formula.kind === 'atom' && formula.args.every((arg) => termVariables(arg).length === 0)

/** Variables with at least one free occurrence. */
export function freeVariables(formula: FoFormula, bound: readonly string[] = []): string[] {
  switch (formula.kind) {
    case 'true':
    case 'false':
      return []
    case 'atom':
      return [
        ...new Set(formula.args.flatMap(termVariables).filter((name) => !bound.includes(name))),
      ]
    case 'not':
      return freeVariables(formula.body, bound)
    case 'binary':
      return [
        ...new Set([
          ...freeVariables(formula.left, bound),
          ...freeVariables(formula.right, bound),
        ]),
      ]
    case 'quantified':
      return freeVariables(formula.body, [...bound, formula.variable])
  }
}

/** Variables with at least one bound occurrence. */
export function boundVariables(formula: FoFormula): string[] {
  const found = new Set<string>()
  const walk = (node: FoFormula, bound: string[]): void => {
    switch (node.kind) {
      case 'atom':
        for (const name of node.args.flatMap(termVariables)) {
          if (bound.includes(name)) found.add(name)
        }
        return
      case 'not':
        walk(node.body, bound)
        return
      case 'binary':
        walk(node.left, bound)
        walk(node.right, bound)
        return
      case 'quantified':
        walk(node.body, [...bound, node.variable])
        return
      default:
        return
    }
  }
  walk(formula, [])
  return [...found]
}

/** No free variables — the definition on p.65. */
export const isClosed = (formula: FoFormula): boolean => freeVariables(formula).length === 0

/**
 * Every variable is free, or bound by exactly one quantifier.
 *
 * Two ways to fail: a variable quantified twice — `(∀x:p(x))∨(∃x:q(x))` — and
 * one that is free somewhere and bound elsewhere, `p(x)∨∃x:q(x)`. Both are the
 * cases the notes call "a source of confusion", and both break Algorithm 4.12.
 */
export function isClean(formula: FoFormula): boolean {
  const quantified: string[] = []
  let ok = true
  const walk = (node: FoFormula): void => {
    if (!ok) return
    if (node.kind === 'quantified') {
      if (quantified.includes(node.variable)) ok = false
      quantified.push(node.variable)
      walk(node.body)
      return
    }
    if (node.kind === 'not') walk(node.body)
    if (node.kind === 'binary') {
      walk(node.left)
      walk(node.right)
    }
  }
  walk(formula)
  if (!ok) return false
  const free = freeVariables(formula)
  return !quantified.some((name) => free.includes(name))
}

/** Apply a substitution to every free variable in the formula. */
export function substituteFormula(sigma: Substitution, formula: FoFormula): FoFormula {
  switch (formula.kind) {
    case 'true':
    case 'false':
      return formula
    case 'atom':
      return atom(
        formula.predicate,
        formula.args.map((arg) => applySubstitution(sigma, arg)),
      )
    case 'not':
      return foNot(substituteFormula(sigma, formula.body))
    case 'binary':
      return binary(
        formula.connective,
        substituteFormula(sigma, formula.left),
        substituteFormula(sigma, formula.right),
      )
    case 'quantified':
      // The quantified variable is foNot free here, so it is foNot σ's business.
      return {
        kind: 'quantified',
        quantifier: formula.quantifier,
        variable: formula.variable,
        body: substituteFormula(
          { ...sigma, [formula.variable]: variable(formula.variable) },
          formula.body,
        ),
      }
  }
}

/** Rename one bound variable throughout its scope — bounded renaming. */
export function renameBound(formula: FoFormula, from: string, to: string): FoFormula {
  if (formula.kind !== 'quantified' || formula.variable !== from) return formula
  return {
    kind: 'quantified',
    quantifier: formula.quantifier,
    variable: to,
    body: substituteFormula({ [from]: variable(to) }, formula.body),
  }
}

const FRESH_NAMES = ['u', 'v', 'w', 'x', 'y', 'z']

/** Every variable mentioned anywhere, bound or free. */
export function allVariables(formula: FoFormula): string[] {
  const found = new Set<string>()
  for (const node of foSubformulas(formula)) {
    if (node.kind === 'atom') for (const name of node.args.flatMap(termVariables)) found.add(name)
    if (node.kind === 'quantified') found.add(node.variable)
  }
  return [...found]
}

/**
 * A clean version — Example 4.8's bounded renaming, applied until every
 * quantifier binds a name of its own and none of them clashes with a free one.
 */
export function clean(formula: FoFormula): FoFormula {
  const free = freeVariables(formula)
  const used = new Set([...free, ...allVariables(formula)])

  const fresh = (): string => {
    for (const name of FRESH_NAMES) {
      if (!used.has(name)) {
        used.add(name)
        return name
      }
    }
    for (let index = 1; ; index++) {
      const name = `x${index}`
      if (!used.has(name)) {
        used.add(name)
        return name
      }
    }
  }

  const seen = new Set<string>()
  const walk = (node: FoFormula): FoFormula => {
    switch (node.kind) {
      case 'not':
        return foNot(walk(node.body))
      case 'binary':
        return binary(node.connective, walk(node.left), walk(node.right))
      case 'quantified': {
        const clash = seen.has(node.variable) || free.includes(node.variable)
        const name = clash ? fresh() : node.variable
        seen.add(name)
        const renamed = clash ? (renameBound(node, node.variable, name) as typeof node) : node
        return {
          kind: 'quantified',
          quantifier: node.quantifier,
          variable: name,
          body: walk(renamed.body),
        }
      }
      default:
        return node
    }
  }
  return walk(formula)
}

/** Every function symbol used in the formula's terms, with its arity. */
export function functionSymbols(formula: FoFormula): Record<string, number> {
  const found: Record<string, number> = {}
  const walkTerm = (term: Term): void => {
    if (isVar(term)) return
    found[term.name] = term.args.length
    for (const arg of term.args) walkTerm(arg)
  }
  for (const node of foSubformulas(formula)) {
    if (node.kind === 'atom') for (const arg of node.args) walkTerm(arg)
  }
  return found
}

export function predicateSymbols(formula: FoFormula): Record<string, number> {
  const found: Record<string, number> = {}
  for (const node of foSubformulas(formula)) {
    if (node.kind === 'atom') found[node.predicate] = node.args.length
  }
  return found
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export class FoParseError extends Error {}

/**
 * Read a formula.
 *
 * Accepts the notes' notation and the exercises': `∀x:φ` and `∀x.φ` both work,
 * as do ASCII stand-ins for the connectives. Precedence is ¬ then ∧ then ∨ then
 * → then ↔, and a quantifier's scope runs as far right as it can.
 */
export function parseFormula(source: string, signature: FoSignature): FoFormula {
  const text = source.replace(/\s+/g, '')
  let index = 0

  const fail = (message: string): never => {
    throw new FoParseError(`${message} (position ${index + 1} of "${source}")`)
  }

  const eat = (token: string): boolean => {
    if (text.startsWith(token, index)) {
      index += token.length
      return true
    }
    return false
  }

  const name = (): string => {
    const start = index
    // `=` and `<` are predicate symbols like any other in this course's
    // syntax, and they are the ones whose names are not letters — §4.4 adds
    // equality to the signature rather than to the grammar, and §5.1 does the
    // same for the order of a dense linear order.
    const symbolic = text[index]
    if (symbolic === '=' || symbolic === '<') {
      index++
      return symbolic
    }
    if (!/[A-Za-z_]/.test(text[index] ?? '')) fail('Expected a symbol')
    index++
    while (/[A-Za-z0-9_]/.test(text[index] ?? '')) index++
    return text.slice(start, index)
  }

  /** The bracketed argument list of an atom, split at top-level commas. */
  const readTerms = (): Term[] => {
    const args: Term[] = []
    if (!eat('(')) return args
    if (eat(')')) return args
    let depth = 0
    let start = index
    while (index < text.length) {
      const character = text[index] as string
      if (character === '(') depth++
      if (character === ')') {
        if (depth === 0) break
        depth--
      }
      if (character === ',' && depth === 0) {
        args.push(parseTerm(text.slice(start, index), signature.functions))
        index++
        start = index
        continue
      }
      index++
    }
    args.push(parseTerm(text.slice(start, index), signature.functions))
    if (!eat(')')) fail('Expected )')
    // Definition 4.1 keeps P, F and V disjoint, so a symbol the signature does
    // foNot list as a function symbol is foNot one — and `p(p(x))` is foNot a
    // formula, however much it looks like one.
    for (const argument of args) checkTerm(argument)
    return args
  }

  const checkTerm = (term: Term): void => {
    if (isVar(term)) {
      if (signature.predicates[term.name] !== undefined) {
        fail(`${term.name} is a predicate symbol, foNot a term`)
      }
      return
    }
    if (signature.functions[term.name] === undefined) {
      fail(`${term.name} is foNot a function symbol`)
    }
    for (const argument of term.args) checkTerm(argument)
  }

  const primary = (): FoFormula => {
    if (eat('⊤')) return { kind: 'true' }
    if (eat('⊥')) return { kind: 'false' }
    if (eat('¬') || eat('~') || eat('!')) return foNot(primary())

    for (const [token, quantifier] of [
      ['∀', 'forall'],
      ['∃', 'exists'],
    ] as const) {
      if (eat(token)) {
        const bound = name()
        // Both separators, and a run of quantifiers may share one: ∀x∃y:φ.
        if (!eat(':')) eat('.')
        return { kind: 'quantified', quantifier, variable: bound, body: implication() }
      }
    }

    if (eat('(')) {
      const inner = implication()
      if (!eat(')')) fail('Expected )')
      return inner
    }

    const symbol = name()
    const arity = signature.predicates[symbol]
    if (arity === undefined) fail(`${symbol} is foNot a predicate symbol`)
    const args = readTerms()
    if (arity !== args.length) {
      fail(`${symbol} takes ${arity} argument${arity === 1 ? '' : 's'}, got ${args.length}`)
    }
    return atom(symbol, args)
  }

  const conjunction = (): FoFormula => {
    let left = primary()
    while (eat('∧') || eat('&')) left = binary('and', left, primary())
    return left
  }

  const disjunction = (): FoFormula => {
    let left = conjunction()
    while (eat('∨') || eat('|')) left = binary('or', left, conjunction())
    return left
  }

  const implication = (): FoFormula => {
    const left = disjunction()
    if (eat('↔') || eat('<->') || eat('<=>')) return binary('iff', left, implication())
    if (eat('→') || eat('->') || eat('=>')) return binary('implies', left, implication())
    return left
  }

  const result = implication()
  if (index !== text.length) fail('Trailing input')
  return result
}

/** The signature the formula itself uses — for when none was declared. */
export const signatureOf = (formula: FoFormula): FoSignature => ({
  predicates: predicateSymbols(formula),
  functions: functionSymbols(formula),
})

/** A Skolem term: a fresh symbol applied to the universals in scope. */
export const skolemTerm = (name: string, args: readonly string[]): Term =>
  app(
    name,
    args.map((argument) => variable(argument)),
  )
