/**
 * Giving terms a meaning — ln.pdf §3.1 and §3.3, Exercise 4, Collection Q12.
 *
 * The chapter's whole stance is that a term is a meaningless string. This file
 * is the one place that stance is dropped: an interpretation picks a set for
 * the variables to range over and a real operation for each function symbol,
 * and then a term denotes something and an equation is true or false.
 *
 * Two reasons to have it. One, the exam asks it directly — "for which of these
 * interpretations does f(x,g(y,z)) = g(f(x,y),f(x,z)) hold?". Two, Theorem 3.19
 * says ⊢ and ⊨ are the same relation, which makes an interpretation the honest
 * way to show an equation is *not* derivable: find a meaning that satisfies
 * every axiom and breaks the goal.
 */

import { isVar, termVariables, type Term } from './terms'
import type { Equation } from './terms'

/** A set to interpret over, with enough elements listed to search. */
export interface Domain<V> {
  id: string
  /** "natural numbers", "finite sets of digits", "strings of letters". */
  label: string
  /** A finite sample. Search only ever looks here, so it must be telling. */
  values: V[]
  show: (value: V) => string
  equal: (left: V, right: V) => boolean
}

export interface Interpretation<V> {
  id: string
  domain: Domain<V>
  /** Symbol → the operation it means. */
  ops: Readonly<Record<string, (args: V[]) => V>>
  /** Symbol → how to say it in words, for the question text. */
  describe: Readonly<Record<string, string>>
}

export type ValueAssignment<V> = Readonly<Record<string, V>>

export class UninterpretedSymbolError extends Error {}

/** What the term denotes, given values for its variables. */
export function evaluateTerm<V>(
  interpretation: Interpretation<V>,
  assignment: ValueAssignment<V>,
  term: Term,
): V {
  if (isVar(term)) {
    const value = assignment[term.name]
    if (value === undefined) {
      throw new UninterpretedSymbolError(`No value for the variable ${term.name}`)
    }
    return value
  }
  const operation = interpretation.ops[term.name]
  if (operation === undefined) {
    throw new UninterpretedSymbolError(`No meaning given to ${term.name}`)
  }
  return operation(term.args.map((arg) => evaluateTerm(interpretation, assignment, arg)))
}

/** Do both sides denote the same thing under this assignment? */
export function equationHoldsAt<V>(
  interpretation: Interpretation<V>,
  assignment: ValueAssignment<V>,
  equation: Equation,
): boolean {
  return interpretation.domain.equal(
    evaluateTerm(interpretation, assignment, equation.left),
    evaluateTerm(interpretation, assignment, equation.right),
  )
}

/** Every assignment of the listed variables to sampled domain values. */
export function* assignments<V>(
  domain: Domain<V>,
  variables: readonly string[],
): Generator<ValueAssignment<V>> {
  if (variables.length === 0) {
    yield {}
    return
  }
  const [first, ...rest] = variables
  for (const value of domain.values) {
    for (const partial of assignments(domain, rest)) {
      yield { ...partial, [first as string]: value }
    }
  }
}

export const equationVariables = (equation: Equation): string[] => [
  ...new Set([...termVariables(equation.left), ...termVariables(equation.right)]),
]

/**
 * An assignment where the two sides differ, or null.
 *
 * Null means "none among the sampled values", which is evidence rather than
 * proof — the domain may be infinite. The sample is chosen so that every
 * equation the games ask about is decided by it.
 */
export function findValueCounterexample<V>(
  interpretation: Interpretation<V>,
  equation: Equation,
): ValueAssignment<V> | null {
  for (const assignment of assignments(interpretation.domain, equationVariables(equation))) {
    if (!equationHoldsAt(interpretation, assignment, equation)) return assignment
  }
  return null
}

export const showValueAssignment = <V>(
  interpretation: Interpretation<V>,
  assignment: ValueAssignment<V>,
): string =>
  Object.entries(assignment)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name} = ${interpretation.domain.show(value as V)}`)
    .join(', ')

// ---------------------------------------------------------------------------
// The domains the exams use
// ---------------------------------------------------------------------------

const NUMBERS: Domain<number> = {
  id: 'numbers',
  label: 'numbers',
  // 0, 1 and 2 are where the interesting failures live; the rest keeps an
  // accidental agreement from looking like a law.
  values: [0, 1, 2, 3, 5],
  show: (value) => String(value),
  equal: (left, right) => left === right,
}

const STRINGS: Domain<string> = {
  id: 'strings',
  label: 'finite strings of letters',
  values: ['', 'a', 'b', 'ab', 'cd', 'abc'],
  show: (value) => (value === '' ? '""' : `"${value}"`),
  equal: (left, right) => left === right,
}

const SETS: Domain<ReadonlySet<number>> = {
  id: 'sets',
  label: 'finite sets',
  values: [new Set(), new Set([1]), new Set([2]), new Set([1, 2]), new Set([2, 3])],
  show: (value) => (value.size === 0 ? '∅' : `{${[...value].sort((a, b) => a - b).join(',')}}`),
  equal: (left, right) =>
    left.size === right.size && [...left].every((element) => right.has(element)),
}

const union = (args: ReadonlySet<number>[]): ReadonlySet<number> =>
  new Set(args.flatMap((set) => [...set]))

const intersect = (args: ReadonlySet<number>[]): ReadonlySet<number> => {
  const [first, second] = args as [ReadonlySet<number>, ReadonlySet<number>]
  return new Set([...first].filter((element) => second.has(element)))
}

/**
 * The five readings of `f` and `g` the exam offers.
 *
 * Kept as data rather than as prose so that whether each one satisfies a given
 * equation is *computed*, never transcribed — the answer key cannot drift away
 * from the question.
 */
export const INTERPRETATIONS = {
  timesPlus: {
    id: 'timesPlus',
    domain: NUMBERS,
    ops: {
      f: ([a, b]) => (a as number) * (b as number),
      g: ([a, b]) => (a as number) + (b as number),
    },
    describe: { f: 'multiplication of numbers', g: 'addition of numbers' },
  } satisfies Interpretation<number>,

  plusTimes: {
    id: 'plusTimes',
    domain: NUMBERS,
    ops: {
      f: ([a, b]) => (a as number) + (b as number),
      g: ([a, b]) => (a as number) * (b as number),
    },
    describe: { f: 'addition of numbers', g: 'multiplication of numbers' },
  } satisfies Interpretation<number>,

  powerTimes: {
    id: 'powerTimes',
    domain: NUMBERS,
    ops: {
      f: ([a, b]) => (a as number) ** (b as number),
      g: ([a, b]) => (a as number) * (b as number),
    },
    describe: { f: 'the first input to the power of the second', g: 'multiplication of numbers' },
  } satisfies Interpretation<number>,

  plusMinus: {
    id: 'plusMinus',
    domain: NUMBERS,
    ops: {
      f: ([a, b]) => (a as number) + (b as number),
      g: ([a, b]) => (a as number) - (b as number),
    },
    describe: { f: 'addition of numbers', g: 'the second input subtracted from the first' },
  } satisfies Interpretation<number>,

  unionIntersect: {
    id: 'unionIntersect',
    domain: SETS,
    ops: { f: union, g: intersect },
    describe: { f: 'union of finite sets', g: 'intersection of finite sets' },
  } satisfies Interpretation<ReadonlySet<number>>,

  concatShorter: {
    id: 'concatShorter',
    domain: STRINGS,
    ops: {
      f: ([a, b]) => (a as string) + (b as string),
      g: ([a, b]) => ((b as string).length < (a as string).length ? (b as string) : (a as string)),
    },
    describe: {
      f: 'the two inputs concatenated',
      g: 'the shorter of the two inputs, the first if they tie',
    },
  } satisfies Interpretation<string>,
} as const

export type InterpretationId = keyof typeof INTERPRETATIONS

/**
 * Check an equation against one of the named interpretations.
 *
 * The domains hold different kinds of value, so this is where the generic
 * parameter has to be discharged; every caller is asking the same yes/no
 * question and does not care what a value is.
 */
export function checkNamed(
  id: InterpretationId,
  equation: Equation,
): { holds: boolean; counterexample: string | null } {
  const interpretation = INTERPRETATIONS[id] as Interpretation<unknown>
  const found = findValueCounterexample(interpretation, equation)
  return {
    holds: found === null,
    counterexample: found === null ? null : showValueAssignment(interpretation, found),
  }
}
