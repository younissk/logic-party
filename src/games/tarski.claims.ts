/**
 * How each theory is decided, if it is — ln.pdf §5.3.
 *
 * Three routes, and the chapter's point is that they are different: some
 * theories are decided by eliminating quantifiers, some by an automaton, and
 * some not at all. Sorting theories by *route* rather than by yes/no is what
 * makes "decidable" and "admits QE" stop looking like the same word.
 */

import type { Claim } from './claimSort'

export type RouteBin = 'qe' | 'other' | 'undecidable'

export const ROUTE_CLAIMS: readonly Claim<RouteBin>[] = [
  {
    id: 'reals',
    text: 'T(ℝ,=,+,*)',
    bin: 'qe',
    why: "Tarski's theorem. Quantifier elimination over polynomial inequalities — and the procedure is doubly exponential in the number of quantifiers.",
    difficulty: ['easy', 'medium', 'hard'],
  },
  {
    id: 'dlo',
    text: 'Unbounded dense linear orders',
    bin: 'qe',
    why: 'Theorem 5.6 — density and unboundedness eliminate an ∃ over a conjunction of order atoms.',
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'finite-universe',
    text: 'Any theory over a finite universe with names for its elements',
    bin: 'qe',
    why: '∀ becomes a conjunction over the elements and ∃ a disjunction, so every quantifier expands away.',
    difficulty: ['medium'],
  },
  {
    id: 'presburger',
    text: 'T(ℕ,=,+)',
    bin: 'other',
    why: 'Decidable, but by automata rather than elimination — in this signature it does not admit QE at all.',
    difficulty: ['easy', 'medium', 'hard'],
  },
  {
    id: 'nat-times',
    text: 'T(ℕ,=,+,*)',
    bin: 'undecidable',
    why: 'No algorithm at all. Complete, consistent, and beyond any computable axiomatisation.',
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'integers',
    text: 'T(ℤ,=,+,*)',
    bin: 'undecidable',
    why: 'ℕ is definable inside ℤ, so a decision procedure here would decide arithmetic.',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'valid-fo',
    text: 'The set of all valid first-order formulas',
    bin: 'undecidable',
    why: 'Church and Turing — validity is semi-decidable only. Proofs can be enumerated; nothing halts on the invalid ones.',
    difficulty: ['hard'],
  },
  {
    id: 'inconsistent',
    text: 'An inconsistent theory',
    bin: 'qe',
    why: 'It contains everything, so ⊤ is a quantifier-free equivalent of every formula. Trivial, and it is why "every inconsistent theory admits QE" is true.',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'one-structure-finite',
    text: 'The theory of one fixed finite structure',
    bin: 'qe',
    why: 'Same expansion as any finite universe, and evaluation then decides it outright.',
    difficulty: ['hard'],
  },
]
