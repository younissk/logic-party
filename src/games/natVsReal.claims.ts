/**
 * ℕ against ℝ — ln.pdf §5.2 and §5.3, exam25a question 4.3.
 *
 * The exam asks for one formula in each of four boxes: true in both, true in ℕ
 * only, true in ℝ only, true in neither. The signature is the same for both —
 * =, +, * with 0, 1 and ≤ as shortcuts — so what separates them is the
 * structure, not the language.
 *
 * Where a bounded search can settle a claim honestly, the formula is recorded
 * alongside it and the tests evaluate it over both universes. Where it cannot
 * — anything turning on ℝ being dense or unbounded, or on a witness being
 * irrational — the claim carries `checkable: false` and its verdict is cited
 * rather than computed. A finite search cannot see density, and pretending
 * otherwise would put a wrong answer key in the game.
 */

import {
  rand,
  req,
  rle,
  rlt,
  rnum,
  ror,
  rplus,
  rtimes,
  rx,
  rimplies,
  type RealFormula,
} from '@/logic'
import type { Claim } from './claimSort'

export type UniverseBin = 'both' | 'nat' | 'real' | 'neither'

export interface UniverseClaim extends Claim<UniverseBin> {
  /** The formula itself, when a bounded search can decide it in both. */
  formula?: RealFormula
  /** False when the verdict rests on density, unboundedness or irrationals. */
  checkable: boolean
}

const X = rx('x')
const Y = rx('y')

const all = (variable: string, body: RealFormula): RealFormula => ({
  kind: 'quantified',
  quantifier: 'forall',
  variable,
  body,
})
const some = (variable: string, body: RealFormula): RealFormula => ({
  kind: 'quantified',
  quantifier: 'exists',
  variable,
  body,
})

export const UNIVERSE_CLAIMS: readonly UniverseClaim[] = [
  {
    id: 'commutative',
    text: '∀x∀y: x+y = y+x',
    bin: 'both',
    why: 'Addition commutes in every one of these structures — a formula that cannot tell them apart.',
    formula: all('x', all('y', req(rplus(X, Y), rplus(Y, X)))),
    checkable: true,
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'nonneg',
    text: '∀x: 0 ≤ x',
    bin: 'nat',
    why: 'Every natural is at least 0; over ℝ take x = −1. The cleanest separator in the ℕ direction.',
    formula: all('x', rle(rnum(0), X)),
    checkable: true,
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'square-nonneg',
    text: '∀x: 0 ≤ x*x',
    bin: 'both',
    why: 'A square is never negative in either — over ℝ because it is an ordered field, over ℕ because nothing is negative at all.',
    formula: all('x', rle(rnum(0), rtimes(X, X))),
    checkable: true,
    difficulty: ['easy'],
  },
  {
    id: 'halve',
    text: '∀x∃y: y+y = x',
    bin: 'real',
    why: 'Halving always works over ℝ and fails for x = 1 over ℕ.',
    checkable: false,
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'least',
    text: '∃x∀y: x ≤ y',
    bin: 'nat',
    why: '0 is a least natural. ℝ has no least element, so this is one of the two classic separators.',
    checkable: false,
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'dense',
    text: '∀x∀y: (x<y → ∃z: (x<z ∧ z<y))',
    bin: 'real',
    why: 'Density. Between 0 and 1 there is nothing in ℕ, and always something in ℝ.',
    checkable: false,
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'successor-gap',
    text: '∀x∃y: (x<y ∧ ¬∃z:(x<z ∧ z<y))',
    bin: 'nat',
    why: 'Every natural has an immediate successor with nothing in between; in ℝ nothing is immediate.',
    checkable: false,
    difficulty: ['hard'],
  },
  {
    id: 'root-two',
    text: '∃x: x*x = 1+1',
    bin: 'real',
    why: '√2 exists in ℝ and is not a natural — and it is not a rational either, which is why a search over fractions would miss it.',
    checkable: false,
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'self-successor',
    text: '∃x: x+1 = x',
    bin: 'neither',
    why: 'Adding one changes a number in both structures. A formula false everywhere is still an answer the exam asks for.',
    formula: some('x', req(rplus(X, rnum(1)), X)),
    checkable: true,
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'all-idempotent',
    text: '∀x: x*x = x',
    bin: 'neither',
    why: 'Only 0 and 1 are their own squares, in either structure.',
    formula: all('x', req(rtimes(X, X), X)),
    checkable: true,
    difficulty: ['easy'],
  },
  {
    id: 'no-zero-divisors',
    text: '∀x∀y: (x*y = 0 → (x = 0 ∨ y = 0))',
    bin: 'both',
    why: 'Neither structure has zero divisors — a product is zero only when a factor is.',
    formula: all(
      'x',
      all('y', rimplies(req(rtimes(X, Y), rnum(0)), ror(req(X, rnum(0)), req(Y, rnum(0))))),
    ),
    checkable: true,
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'square-order',
    text: '∀x∀y: (x ≤ y → x*x ≤ y*y)',
    bin: 'nat',
    why: 'True in ℕ because everything is non-negative; over ℝ take x = −2, y = 1.',
    formula: all('x', all('y', rimplies(rle(X, Y), rle(rtimes(X, X), rtimes(Y, Y))))),
    checkable: true,
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'strict-between-self',
    text: '∃x: (x < x+1 ∧ x+1 < x)',
    bin: 'neither',
    why: 'A strict cycle, which no order allows.',
    formula: some('x', rand(rlt(X, rplus(X, rnum(1))), rlt(rplus(X, rnum(1)), X))),
    checkable: true,
    difficulty: ['easy', 'medium'],
  },
]
