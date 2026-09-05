/** The logic core. Framework-free and fully tested — every minigame builds on it. */

export * from './ast'
export * from './evaluate'
export * from './generate'
export * from './normal'
export * from './parse'
export * from './print'
export * from './rng'
export * from './semantics'
export * from './truthTable'
export * from './resolution'
export * from './certificates'
export * from './encoding'
export * from './solving'
export * from './tseitin'

// Chapter 3 — equational reasoning.
export * from './terms'
export * from './substitution'
export * from './rewriting'
export * from './interpretation'
export * from './equational'

// Chapter 4 — first-order logic.
export * from './fol'
export * from './foNormal'
export * from './foSemantics'
export * from './foResolution'

// Chapter 5 — theories in first-order logic.
export * from './polynomial'
export * from './automaton'
export * from './dlo'
export * from './theories'

/**
 * `arithmetic` is deliberately not re-exported.
 *
 * Its builders are a one-letter DSL — `v`, `num`, `and`, `forall` — chosen so
 * that a formula written in TypeScript still reads like the formula the notes
 * print. Half those names already belong to the propositional AST, and
 * prefixing them all would trade the readability the DSL exists for. Import it
 * as `@/logic/arithmetic` instead.
 */
