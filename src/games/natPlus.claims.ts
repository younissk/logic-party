/**
 * What addition alone can say — ln.pdf §5.2.
 *
 * T(ℕ,=,+) is decidable and T(ℕ,=,+,*) is not, so the line between them is
 * worth being able to draw. Ordering, parity, and any fixed multiple are
 * expressible with + alone; divisibility by a *variable*, primality and
 * squaring are not, because they need a product of two unknowns.
 *
 * The reason each falls where it does is recorded, because "needs
 * multiplication" is a claim about the language and not about the property.
 */

import type { Claim } from './claimSort'

export type PlusBin = 'plus' | 'times'

export const PLUS_CLAIMS: readonly Claim<PlusBin>[] = [
  {
    id: 'leq',
    text: 'x ≤ y',
    bin: 'plus',
    why: '∃k: x+k = y. In ℕ every difference of the right sign is itself a natural number.',
    difficulty: ['easy', 'medium', 'hard'],
  },
  {
    id: 'even',
    text: 'x is even',
    bin: 'plus',
    why: '∃k: k+k = x. Doubling is repeated addition of a fixed number of copies.',
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'multiple-of-three',
    text: 'x is a multiple of 3',
    bin: 'plus',
    why: '∃k: k+k+k = x. Any *fixed* multiple is a fixed number of additions.',
    difficulty: ['easy', 'medium', 'hard'],
  },
  {
    id: 'successor',
    text: 'y is the successor of x',
    bin: 'plus',
    why: 'y = x+1, where 1 is itself definable as the smallest non-zero element.',
    difficulty: ['easy'],
  },
  {
    id: 'divides-variable',
    text: 'x divides y, for variable x',
    bin: 'times',
    why: '∃k: k*x = y multiplies two unknowns. With a *fixed* x it would be a fixed number of additions, but x varies.',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'prime',
    text: 'x is prime',
    bin: 'times',
    why: 'Primality is a statement about products of two unknowns, so it needs *.',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'square',
    text: 'x is a perfect square',
    bin: 'times',
    why: 'x = k*k, and squaring a variable is a product of two unknowns.',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'product',
    text: 'z = x * y',
    bin: 'times',
    why: 'This *is* multiplication — the symbol Presburger arithmetic leaves out, and adding it makes the theory undecidable.',
    difficulty: ['easy', 'medium', 'hard'],
  },
  {
    id: 'zero',
    text: 'x = 0',
    bin: 'plus',
    why: '∀y: x+y = y. Zero is the additive identity, which + can state.',
    difficulty: ['easy'],
  },
  {
    id: 'between',
    text: 'y lies strictly between x and z',
    bin: 'plus',
    why: 'A conjunction of two ≤ facts with the equalities excluded, and ≤ is available.',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'powers-of-two',
    text: 'x is a power of 2',
    bin: 'times',
    why: 'It is defined through divisibility by primes, and divisibility by a variable needs *.',
    difficulty: ['hard'],
  },
]
