/**
 * Gödel's ceiling — ln.pdf §5.2, Exercise 11, exam25a Q4.1.
 *
 * Adding multiplication to Presburger arithmetic changes everything at once:
 * the theory stops being decidable, stops being axiomatizable, and stops being
 * something a proof calculus can exhaust. The claims here separate those three
 * consequences, because they are usually run together.
 */

import type { Claim } from './claimSort'

export type CeilingBin = 'true' | 'false'

export const CEILING_CLAIMS: readonly Claim<CeilingBin>[] = [
  {
    id: 'undecidable',
    text: 'T(ℕ,=,+,*) is undecidable.',
    bin: 'true',
    why: 'No algorithm decides membership. This is the theorem that separates it from Presburger arithmetic.',
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'complete',
    text: 'T(ℕ,=,+,*) is complete.',
    bin: 'true',
    why: 'It is the theory of a single structure, ℕ, and a structure decides every closed formula. Complete does not mean decidable, and this is the example that proves it.',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'axiomatizable',
    text: 'T(ℕ,=,+,*) has a computable set of axioms.',
    bin: 'false',
    why: "Gödel: a computable, consistent axiom set for arithmetic is always incomplete, and this theory is complete — so it has no computable axiomatisation.",
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'consistent',
    text: 'T(ℕ,=,+,*) is consistent.',
    bin: 'true',
    why: 'ℕ is a model of it, and a theory with a model cannot contain a contradiction.',
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'unprovable-truth',
    text: 'There are true statements about ℕ that no consistent computable axiom system proves.',
    bin: 'true',
    why: "Gödel's first incompleteness theorem, stated the way it is usually meant.",
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'presburger-undecidable',
    text: 'Dropping * from the signature leaves the theory undecidable.',
    bin: 'false',
    why: 'T(ℕ,=,+) is decidable, by the automaton construction of §5.2. Multiplication is exactly what tips it over.',
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'reals-undecidable',
    text: 'T(ℝ,=,+,*) is undecidable too.',
    bin: 'false',
    why: 'Tarski showed the reals decidable by quantifier elimination. Undecidability comes from the *integers* being definable, not from multiplication itself.',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'contains-presburger',
    text: 'Every formula of T(ℕ,=,+) is also in T(ℕ,=,+,*).',
    bin: 'true',
    why: 'Same structure, a larger signature — anything true of ℕ stays true when more symbols are available.',
    difficulty: ['medium'],
  },
  {
    id: 'nat-in-real',
    text: 'Every formula of T(ℕ,=,+,*) is also in T(ℝ,=,+,*).',
    bin: 'false',
    why: '∀x∃y:(y=x+1 ∧ ¬∃z:(x<z ∧ z<y)) is true in ℕ and false in ℝ. Different structures, so nothing carries over automatically.',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'integers-undecidable',
    text: 'T(ℤ,=,+,*) is undecidable.',
    bin: 'true',
    why: 'ℕ is definable inside ℤ — a number is a natural exactly when it is a sum of four squares — so deciding ℤ would decide ℕ. That is Exercise 11 question 4.',
    difficulty: ['hard'],
  },
]
