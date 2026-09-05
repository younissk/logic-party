/**
 * What multiplication costs — ln.pdf §5.2, Exercise 11, exam25a Q4.1.
 *
 * T(ℕ,=,+,*) is complete and undecidable at the same time, which is the fact
 * most worth having straight: it is the theory of one structure, so it decides
 * every closed formula, and yet nothing can compute which way. What it lacks
 * is a computable axiomatisation — that is Gödel's theorem, and it is the only
 * one of the three properties that fails.
 */

import { makeClaimSort } from './claimSort'
import { CEILING_CLAIMS, type CeilingBin } from './natTimes.claims'
import { NatTimesGuide } from './natTimes.guide'
import type { Bin } from '@/ui/SortBoard'

const BINS: readonly Bin<CeilingBin>[] = [
  { id: 'true', label: 'True', style: 'bg-grass/25' },
  { id: 'false', label: 'False', style: 'bg-space-red/15' },
]

export const natTimesGame = makeClaimSort<CeilingBin>({
  id: 'nat-times',
  title: "Gödel's Ceiling",
  tagline: 'Sort the claims about arithmetic with multiplication.',
  icon: '🚧',
  topics: ['arithmetic-theories'],
  bins: BINS,
  claims: CEILING_CLAIMS,
  howMany: { easy: 4, medium: 5, hard: 5 },
  hint: 'Complete, decidable and axiomatizable are three different things. Ask which one the claim is really about.',
  closing:
    'T(ℕ,=,+,*) is complete and consistent and undecidable, all at once. The property it lacks is a computable set of axioms.',
  Guide: NatTimesGuide,
})
