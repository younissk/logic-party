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
   * Exercise types expected to live here, shown while the category is empty.
   *
   * PLACEHOLDERS — edit these to match the actual syllabus as you work
   * through it. They exist so an empty category says what it is *for*.
   */
  planned: string[]
}

export const CATEGORIES: readonly CategoryInfo[] = [
  {
    id: 'propositional',
    title: 'Propositional Logic',
    blurb: 'Connectives, truth tables, normal forms, satisfiability, resolution.',
    icon: '∧',
    colour: 'bg-space-blue text-white',
    planned: [
      'Truth tables',
      'Tautology, contradiction, contingency',
      'CNF and DNF',
      'Satisfiability and models',
      'Resolution',
    ],
  },
  {
    id: 'equational',
    title: 'Equational Reasoning',
    blurb: 'Rewriting one formula into another, one justified equivalence at a time.',
    icon: '=',
    colour: 'bg-grass text-white',
    planned: [
      'Equivalence laws (De Morgan, distribution, absorption)',
      'Proving two formulas equivalent by rewriting',
      'Simplification chains',
      'Substitution of equals for equals',
    ],
  },
  {
    id: 'first-order',
    title: 'First-Order Logic',
    blurb: 'Quantifiers, variables, structures and what makes a formula true in one.',
    icon: '∀',
    colour: 'bg-space-red text-white',
    planned: [
      'Reading and writing quantified formulas',
      'Free and bound variables, scope',
      'Models and countermodels',
      'Prenex form and Skolemisation',
      'Unification',
    ],
  },
  {
    id: 'fol-theories',
    title: 'Theories in First-Order Logic',
    blurb: 'Reasoning inside a fixed theory: equality, orders, arithmetic.',
    icon: '⊨',
    colour: 'bg-plum text-white',
    planned: [
      'Axioms and their consequences',
      'Equality and congruence',
      'Satisfiability modulo a theory',
      'Decidable and undecidable fragments',
    ],
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
  equivalence: 'equational',
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
