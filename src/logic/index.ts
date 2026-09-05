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
