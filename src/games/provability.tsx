/**
 * Sound and complete — ln.pdf §5.2, Exercise 11 question 1.
 *
 * Two properties in opposite directions, and the exam mixes them deliberately.
 * Soundness says every proof produces a truth; completeness says every truth
 * has a proof. Gödel proved the first-order calculus complete, and arithmetic
 * incomplete — the same name on two theorems that are easy to run together.
 */

import { makeClaimSort } from './claimSort'
import { PROVABILITY_CLAIMS, type ProvabilityBin } from './provability.claims'
import { ProvabilityGuide } from './provability.guide'
import type { Bin } from '@/ui/SortBoard'

const BINS: readonly Bin<ProvabilityBin>[] = [
  { id: 'true', label: 'True', style: 'bg-grass/25' },
  { id: 'false', label: 'False', style: 'bg-space-red/15' },
]

export const provabilityGame = makeClaimSort<ProvabilityBin>({
  id: 'provability',
  title: 'Sound And Complete',
  tagline: 'Sort the claims about proving and being true.',
  icon: '⚖️',
  topics: ['theories'],
  bins: BINS,
  claims: PROVABILITY_CLAIMS,
  howMany: { easy: 4, medium: 5, hard: 5 },
  hint: 'Soundness runs from proof to truth; completeness runs from truth to proof. Ask which direction the claim goes.',
  closing:
    'Provable ⇒ true is soundness, and it holds. True ⇒ provable is completeness, and whether it holds depends entirely on which theory is being talked about.',
  Guide: ProvabilityGuide,
})
