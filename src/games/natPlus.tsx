/**
 * Presburger arithmetic and where it stops — ln.pdf §5.2.
 *
 * T(ℕ,=,+) is decidable, by automata rather than by quantifier elimination,
 * and it is not finitely axiomatizable. T(ℕ,=,+,*) is undecidable. So one
 * symbol separates a theory a machine can settle from one nothing can, and
 * knowing which properties fall on which side of that line is the skill.
 *
 * The trap is that many properties *look* multiplicative and are not: "even"
 * and "a multiple of 3" are fixed numbers of additions. What genuinely needs *
 * is a product of two unknowns.
 */

import { makeClaimSort } from './claimSort'
import { PLUS_CLAIMS, type PlusBin } from './natPlus.claims'
import { NatPlusGuide } from './natPlus.guide'
import type { Bin } from '@/ui/SortBoard'

const BINS: readonly Bin<PlusBin>[] = [
  { id: 'plus', label: 'Addition is enough', style: 'bg-grass/25' },
  { id: 'times', label: 'Needs multiplication', style: 'bg-space-red/15' },
]

export const natPlusGame = makeClaimSort<PlusBin>({
  id: 'nat-plus',
  title: 'Plus Is Not Enough',
  tagline: 'Which of these can be said with + alone?',
  icon: '➕',
  topics: ['arithmetic-theories'],
  bins: BINS,
  claims: PLUS_CLAIMS,
  howMany: { easy: 4, medium: 5, hard: 5 },
  hint: 'A fixed number of additions is still addition. A product of two unknowns is not.',
  closing:
    'The line matters because it is the line between decidable and not: T(ℕ,=,+) is settled by automata, and T(ℕ,=,+,*) is settled by nothing.',
  Guide: NatPlusGuide,
})
