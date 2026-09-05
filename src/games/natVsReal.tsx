/**
 * Which universe is it true in? — ln.pdf §5.2 and §5.3, exam25a question 4.3.
 *
 * The exam gives four boxes and asks for one formula in each: true in both ℕ
 * and ℝ, true in ℕ only, true in ℝ only, true in neither. Answering it needs
 * the reflex of asking *what ℕ has that ℝ does not* — a least element,
 * immediate successors, everything non-negative — and what ℝ has that ℕ does
 * not: halving, density, square roots.
 *
 * Sorting given formulas is the same skill from the other end, and it can be
 * marked. Which is what this does.
 */

import { makeClaimSort } from './claimSort'
import { UNIVERSE_CLAIMS, type UniverseBin } from './natVsReal.claims'
import { NatVsRealGuide } from './natVsReal.guide'
import type { Bin } from '@/ui/SortBoard'

const BINS: readonly Bin<UniverseBin>[] = [
  { id: 'both', label: 'True in both', style: 'bg-grass/25' },
  { id: 'nat', label: 'ℕ only', style: 'bg-space-blue/20' },
  { id: 'real', label: 'ℝ only', style: 'bg-coin/50' },
  { id: 'neither', label: 'Neither', style: 'bg-space-red/15' },
]

export const natVsRealGame = makeClaimSort<UniverseBin>({
  id: 'nat-vs-real',
  title: 'Which Universe',
  tagline: 'Sort each formula by where it holds — ℕ, ℝ, both, or neither.',
  icon: '🌍',
  topics: ['arithmetic-theories'],
  bins: BINS,
  claims: UNIVERSE_CLAIMS,
  howMany: { easy: 4, medium: 5, hard: 5 },
  hint: 'ℕ has a least element and immediate successors. ℝ has halves, density and square roots. Nearly every separator is one of those six.',
  closing:
    'Same language, different structures. A formula belongs to a theory when the structure makes it true, so the only thing to compare is what the two structures actually have.',
  Guide: NatVsRealGuide,
})
