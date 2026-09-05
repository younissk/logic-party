/**
 * The little world the chapter-5 theory games share.
 *
 * Two elements, one unary predicate, four structures. Definition 5.1 asks for
 * closure under consequence over *all* structures, which no program can check;
 * over a fixed finite class it becomes an intersection of model sets, and
 * every claim the exams ask about closure survives the restriction because
 * they are claims about closure and not about the class.
 *
 * It lives in its own module so that a game and its guide can both use it
 * without importing each other — a guide that reads a game's exports at module
 * top gets `undefined`, because the game imports the guide.
 */

import { parseFormula, unaryClass, type FoFormula, type FoSignature } from '@/logic'

export const SIGNATURE: FoSignature = { predicates: { p: 1 }, functions: {} }

/** The four structures on {1,2} interpreting p. */
export const WORLD = unaryClass(2)

export const parse = (source: string): FoFormula => parseFormula(source, SIGNATURE)

/**
 * Closed formulas over the signature, spread across the four structures.
 *
 * Wide enough that no theory in the games makes them all fall the same way,
 * which is what would turn a sorting question into a coin flip, and wide
 * enough to contain a witness whenever one exists.
 */
export const CATALOGUE: readonly string[] = [
  '∀x:p(x)',
  '∃x:p(x)',
  '∀x:¬p(x)',
  '∃x:¬p(x)',
  '(∃x:p(x))∧(∃x:¬p(x))',
  '(∀x:p(x))∨(∀x:¬p(x))',
  '(∀x:p(x))→(∃x:p(x))',
  '(∃x:p(x))→(∀x:p(x))',
  '(∃x:¬p(x))→(∀x:¬p(x))',
  '∀x:(p(x)∨¬p(x))',
  '∃x:(p(x)∧¬p(x))',
]

export const CATALOGUE_FORMULAS: readonly FoFormula[] = CATALOGUE.map(parse)
