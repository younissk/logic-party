/**
 * Course categories — the chapters of the syllabus, and the app's navigation.
 *
 * Categories and topics are different things on purpose:
 *
 *   Category  a chapter of the course. Coarse, stable, what you revise "for".
 *   Topic     a single skill. Fine, what progress tracking ranks you on.
 *
 * A minigame declares its topics, and its category follows from them, so the
 * two can never disagree.
 */

import type { Topic } from './types'

export type Category = 'propositional' | 'equational' | 'first-order' | 'fol-theories'

export interface CategoryInfo {
  id: Category
  title: string
  blurb: string
  /** Shown in the round token on the category card. */
  icon: string
  /** Tailwind background class for that token. */
  colour: string
  /**
   * The chapter's sections, shown while the category has no minigames yet, so
   * an empty category still says what it is *for*. Taken from the course notes.
   */
  planned: string[]
}

/**
 * The five chapters of the lecture notes, minus the introduction.
 *
 * Section lists are taken from the contents page of the course notes (JKU
 * Computational Logic for AI, WS 2025/2026), not invented — so `planned` says
 * what will actually be examined rather than what sounds plausible.
 */
export const CATEGORIES: readonly CategoryInfo[] = [
  {
    id: 'propositional',
    title: 'Propositional Logic',
    blurb: 'Syntax and semantics, normal forms, resolution, solving, certificates.',
    icon: '∧',
    colour: 'bg-space-blue text-white',
    planned: [
      'Syntax and semantics',
      'Normal forms',
      'Resolution',
      'Solving',
      'Certificates',
    ],
  },
  {
    id: 'equational',
    title: 'Equational Reasoning',
    // Not propositional equivalence laws — this chapter is about terms and
    // rewriting: unification, normal forms, Knuth-Bendix completion.
    blurb: 'Terms, substitution and unification, rewriting to normal form, completion.',
    icon: '=',
    colour: 'bg-grass text-white',
    planned: ['Terms', 'Substitution and unification', 'Normal forms', 'Completion'],
  },
  {
    id: 'first-order',
    title: 'First-Order Logic',
    blurb: 'Syntax and semantics, normal forms, resolution, and equality.',
    icon: '∀',
    colour: 'bg-space-red text-white',
    planned: [
      'Syntax and semantics',
      'Normal forms',
      'Resolution',
      'First-order logic with equality',
    ],
  },
  {
    id: 'fol-theories',
    title: 'Theories in First-Order Logic',
    blurb: 'Quantifier elimination, the natural numbers, the real numbers.',
    icon: '⊨',
    colour: 'bg-plum text-white',
    planned: ['Quantifier elimination', 'Natural numbers', 'Real numbers'],
  },
]

export const CATEGORY_BY_ID: Readonly<Record<Category, CategoryInfo>> = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category]),
) as Record<Category, CategoryInfo>

/**
 * Which chapter each skill belongs to.
 *
 * Exhaustive by construction: adding a Topic without placing it here is a type
 * error, which is the point — a topic with no home would vanish from the app's
 * navigation without anyone noticing.
 */
export const TOPIC_CATEGORY: Readonly<Record<Topic, Category>> = {
  syntax: 'propositional',
  'truth-tables': 'propositional',
  'normal-forms': 'propositional',
  satisfiability: 'propositional',
  entailment: 'propositional',
  resolution: 'propositional',
  'proof-systems': 'propositional',
  // Propositional equivalence lives in chapter 2, not chapter 3: "Equational
  // Reasoning" in this course means term rewriting, not equivalence laws.
  equivalence: 'propositional',
}

export function topicsInCategory(category: Category): Topic[] {
  return (Object.keys(TOPIC_CATEGORY) as Topic[]).filter(
    (topic) => TOPIC_CATEGORY[topic] === category,
  )
}

/** Every category a minigame's topics place it in. */
export function categoriesOf(topics: readonly Topic[]): Category[] {
  const categories = new Set<Category>()
  for (const topic of topics) categories.add(TOPIC_CATEGORY[topic])
  return [...categories]
}
