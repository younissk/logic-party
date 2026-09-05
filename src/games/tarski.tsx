/**
 * How a theory gets decided — ln.pdf §5.3, and the true/false lines about QE
 * on exam26a and exam26bA.
 *
 * "Decidable" and "admits quantifier elimination" are different properties and
 * the exam asks about both. QE implies decidability whenever the quantifier-
 * free fragment is decidable, which it is in every theory here. The converse
 * fails, and Presburger arithmetic is the counterexample: decided by automata,
 * with no elimination available in its own signature.
 *
 * So the sorting is by *route*, not by yes or no. Three bins force the
 * distinction that a true/false list lets you avoid.
 */

import { makeClaimSort } from './claimSort'
import { ROUTE_CLAIMS, type RouteBin } from './tarski.claims'
import { TarskiGuide } from './tarski.guide'
import type { Bin } from '@/ui/SortBoard'

const BINS: readonly Bin<RouteBin>[] = [
  { id: 'qe', label: 'Decided by eliminating quantifiers', style: 'bg-grass/25' },
  { id: 'other', label: 'Decidable some other way', style: 'bg-coin/50' },
  { id: 'undecidable', label: 'Not decidable at all', style: 'bg-space-red/15' },
]

export const tarskiGame = makeClaimSort<RouteBin>({
  id: 'tarski',
  title: 'How Bad Is It?',
  tagline: 'Sort each theory by how — or whether — it can be decided.',
  icon: '📉',
  topics: ['quantifier-elimination', 'arithmetic-theories'],
  bins: BINS,
  claims: ROUTE_CLAIMS,
  howMany: { easy: 4, medium: 5, hard: 5 },
  columns: 3,
  hint: 'QE gives decidability. Decidability does not give QE — Presburger arithmetic is the counterexample.',
  closing:
    'Tarski decided the reals by elimination; Presburger decided the naturals with addition by automata; nobody decides the naturals with multiplication.',
  Guide: TarskiGuide,
})
