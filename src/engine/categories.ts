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

/**
 * One kind of exercise the exam asks for.
 *
 * A section is a syllabus, not a game list: an item exists whether or not a
 * minigame drills it yet. That way the category page shows the whole shape of
 * the chapter and how much of it is covered, rather than only the parts that
 * happen to be built.
 */
export interface SyllabusItem {
  /** Stable slug. Referred to by `requires`, so never rename one. */
  id: string
  /**
   * Position in the study plan. Warm-ups that sit outside the numbered plan
   * leave this off rather than shifting everything after them.
   */
  n?: number
  title: string
  /** Where it is defined and where it is asked — notes section, exam, exercise. */
  source: string
  /** Minigame id, when one exists. */
  game?: string
  /**
   * Items you need first, by id.
   *
   * Genuine conceptual dependencies, not the reading order: Tseitin requires
   * the naive pipeline because its entire selling point is the blowup you only
   * appreciate once you have felt it, and counting models requires classifying
   * them because "how many" is meaningless until "any at all" is settled.
   */
  requires?: string[]
  /** One line on why the prerequisites are what they are. Shown when locked. */
  why?: string
}

export interface Section {
  /** A, B, C … — how the study plan refers to it. */
  letter: string
  title: string
  items: SyllabusItem[]
}

export interface CategoryInfo {
  id: Category
  title: string
  blurb: string
  /** Shown in the round token on the category card. */
  icon: string
  /** Tailwind background class for that token. */
  colour: string
  /**
   * The chapter broken into sections, when it has been planned out that far.
   * Falls back to `planned` for chapters that have not been.
   */
  sections?: Section[]
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
/**
 * The propositional chapter as a study plan.
 *
 * Ordered the way the course builds it up — semantics, then the normal forms
 * that make solving possible, then the three solving families, then the
 * certificates that let an answer be checked. The numbering is the plan's own
 * and is stable: a warm-up added later goes in unnumbered rather than pushing
 * everything down.
 */
const PROPOSITIONAL_SECTIONS: Section[] = [
  {
    letter: 'A',
    title: 'Semantics & basics',
    items: [
      {
        id: 'truth-tables',
        title: 'Truth tables — evaluate a formula row by row',
        source: 'ln §2.1 · warm-up',
        game: 'truth-table',
      },
      {
        id: 'properties',
        n: 1,
        title: 'Property classification — satisfiable, valid, refutable, unsatisfiable',
        source: 'Exercise 1 · ln §2.1',
        game: 'property-check',
        requires: ['truth-tables'],
        why: 'Every property is a statement about a formula\u2019s column. You have to be able to fill one in first.',
      },
      {
        id: 'model-count',
        n: 2,
        title: 'Counting models of a CNF',
        source: 'exam25a Q1.1a · Exercise 1 · ln §2.1',
        game: 'model-count',
        requires: ['properties'],
        why: '\u201cHow many models\u201d is meaningless until \u201cany at all\u201d is settled.',
      },
    ],
  },
  {
    letter: 'B',
    title: 'Normal forms',
    items: [
      {
        id: 'cnf',
        n: 3,
        title: 'Naive CNF transformation — De Morgan and distributivity',
        source: 'ln §2.2',
        game: 'cnf-pipeline',
        requires: ['truth-tables'],
        why: 'Every step of the pipeline is an equivalence. You need to be able to check one.',
      },
      {
        id: 'tseitin',
        n: 4,
        title: 'Tseitin transformation — which clauses appear',
        source: 'Exercise 2 · ln Algorithm 2.19',
        game: 'tseitin',
        requires: ['cnf'],
        why: 'Tseitin exists to dodge the distribution blowup. Feel the blowup first or it looks like pointless extra machinery.',
      },
      {
        id: 'sat-equivalence',
        n: 5,
        title: 'Equivalent vs. satisfiability-equivalent',
        source: 'ln Definition 2.21',
        game: 'equivalence',
        requires: ['model-count', 'tseitin'],
        why: 'The distinction is about model sets, and its headline example is Tseitin.',
      },
    ],
  },
  {
    letter: 'C',
    title: 'Resolution',
    items: [
      {
        id: 'resolvents',
        n: 6,
        title: 'Compute all resolvents, including tautological ones',
        source: 'exam25a Q1.1b · ln Definition 2.22',
        game: 'resolvents',
        requires: ['cnf'],
        why: 'Resolution works on clauses. You need to be able to produce clauses.',
      },
      {
        id: 'derivable',
        n: 7,
        title: 'Is clause X derivable?',
        source: 'exam26a and exam26bA Q1.1',
        game: 'derivable',
        requires: ['resolvents', 'model-count'],
        why: 'The first move is BCP to decide satisfiability; the second is the resolution rule.',
      },
      {
        id: 'refutation',
        n: 8,
        title: 'Build a resolution refutation',
        source: 'ln §2.3',
        game: 'refutation',
        requires: ['resolvents'],
        why: 'A refutation is a chain of single resolution steps.',
      },
    ],
  },
  {
    letter: 'D',
    title: 'Solving',
    items: [
      {
        id: 'bcp',
        n: 9,
        title: 'BCP until fixpoint — what formula remains',
        source: 'exam25a Q1.1c · ln Definition 2.39',
        requires: ['model-count'],
        why: 'Propagation is already the first step of counting models.',
      },
      {
        id: 'dp',
        n: 10,
        title: 'DP procedure — variable elimination, decide SAT or UNSAT',
        source: 'exam26a and exam26bA Q1.2',
        requires: ['resolvents'],
        why: 'Eliminating a variable means resolving every pair that clashes on it.',
      },
      {
        id: 'dpll',
        n: 11,
        title: 'DPLL decision tree — build it, count leaves',
        source: 'Exercise 3 · ln §2.4',
        requires: ['bcp'],
        why: 'DPLL is decide, then propagate. The propagation half has to be automatic.',
      },
      {
        id: 'dpll-refutation',
        n: 12,
        title: 'Refutation matching a given DPLL tree',
        source: 'exam25a Q1.2',
        requires: ['dpll', 'refutation'],
        why: 'The hybrid: it asks you to read a tree and write the resolution proof it corresponds to.',
      },
      {
        id: 'cdcl',
        n: 13,
        title: 'CDCL and learned clauses — conflict analysis',
        source: 'ln §2.4 · Example 2.45',
        requires: ['dpll'],
        why: 'CDCL is DPLL that learns from its conflicts.',
      },
    ],
  },
  {
    letter: 'E',
    title: 'Certificates',
    items: [
      {
        id: 'rup',
        n: 14,
        title: 'RUP proof — extend the formula step by step to ⊥',
        source: 'exam26a and exam26bA Q1.3 · Exercise 3 · ln §2.5',
        requires: ['bcp', 'refutation'],
        why: 'A RUP check is BCP on the formula with the candidate clause negated.',
      },
      {
        id: 'bce',
        n: 15,
        title: 'Blocked clause elimination — prove SAT by deleting',
        source: 'exam25a Q1.3 · exam26bA bonus',
        requires: ['resolvents', 'sat-equivalence'],
        why: 'Deleting a clause changes the model set, so it is only legal because satisfiability survives.',
      },
    ],
  },
]

export const CATEGORIES: readonly CategoryInfo[] = [
  {
    id: 'propositional',
    title: 'Propositional Logic',
    blurb: 'Syntax and semantics, normal forms, resolution, solving, certificates.',
    icon: '∧',
    colour: 'bg-space-blue text-white',
    planned: ['Syntax and semantics', 'Normal forms', 'Resolution', 'Solving', 'Certificates'],
    sections: PROPOSITIONAL_SECTIONS,
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

/** Every syllabus item of a category, sections flattened. */
export function syllabusItems(category: Category): SyllabusItem[] {
  return (CATEGORY_BY_ID[category].sections ?? []).flatMap((section) => section.items)
}

/** How much of a planned-out category is actually playable. */
export function sectionProgress(category: Category): { built: number; total: number } {
  const items = syllabusItems(category)
  return { built: items.filter((item) => item.game !== undefined).length, total: items.length }
}
