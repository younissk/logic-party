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
   * How many past exams it appeared in, beyond one.
   *
   * A fact about the course rather than about any one student, so it survives
   * being handed to somebody else.
   */
  stars?: number
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
/**
 * The course as an exam plan, item by item.
 *
 * Numbering, wording and sources come from the syllabus rather than from me,
 * so the app and the course cannot drift apart. Numbers run 1–75 across the
 * whole course, not per chapter, because that is how it refers to them.
 */
const PROPOSITIONAL_SECTIONS: Section[] = [
  {
    letter: 'A',
    title: 'Semantics',
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
        title: 'Satisfiable / valid / refutable / unsatisfiable',
        source: 'Def. 2.6, Thm 2.8 · Exercise 1',
        game: 'property-check',
        requires: ['truth-tables'],
        why: 'Every property is a statement about a formula’s column. You have to be able to fill one in first.',
      },
      {
        id: 'model-count',
        n: 2,
        title: 'Counting models',
        source: 'exam25a Q1.1a · Exercise 1',
        game: 'model-count',
        requires: ['properties'],
        why: '“How many models” is meaningless until “any at all” is settled.',
      },
      {
        id: 'entailment',
        n: 3,
        title: 'Entailment and equivalence (A→B ≡ ¬A∨B)',
        source: 'Def. 2.9–2.11 · Exercise 1',
        game: 'model-sort',
        requires: ['properties'],
        why: 'Both notions are about model sets, so you need to be able to say when a formula holds first.',
      },
      {
        id: 'encoding',
        n: 4,
        title: 'Encoding a problem into CNF (graph colouring)',
        source: 'Exercise 1 Q4 · limboole',
        game: 'colouring',
        requires: ['cnf'],
        why: 'The encoding is three families of clause, so clauses have to be second nature.',
      },
    ],
  },
  {
    letter: 'B',
    title: 'Normal forms',
    items: [
      {
        id: 'cnf',
        n: 5,
        title: 'Naive CNF — ↔ then → then ¬ then distribute',
        source: 'ln §2.2 · Example 2.16',
        game: 'cnf-pipeline',
        requires: ['truth-tables'],
        why: 'Every step of the pipeline is an equivalence. You need to be able to check one.',
      },
      {
        id: 'tseitin',
        n: 6,
        title: 'Tseitin transformation — which clauses appear',
        source: 'Alg. 2.19 · Exercise 2',
        game: 'tseitin',
        requires: ['cnf'],
        why: 'Tseitin exists to dodge the distribution blowup. Feel the blowup first or it looks like pointless extra machinery.',
      },
      {
        id: 'sat-equivalence',
        n: 7,
        title: 'Equivalent vs. satisfiability-equivalent',
        source: 'Def. 2.21 · Quiz 1',
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
        n: 8,
        title: 'Compute all resolvents, including tautological',
        source: 'exam25a Q1.1b',
        game: 'resolvents',
        requires: ['cnf'],
        why: 'Resolution works on clauses. You need to be able to produce clauses.',
      },
      {
        id: 'derivable',
        n: 9,
        title: 'Is clause X derivable? Multi-step',
        source: 'exam26a and exam26bA Q1.1',
        game: 'derivable',
        stars: 1,
        requires: ['resolvents', 'model-count'],
        why: 'The first move is BCP to decide satisfiability; the second is the resolution rule.',
      },
      {
        id: 'one-step',
        n: 10,
        title: 'Derivable in one step only',
        source: 'Exercise 2',
        game: 'one-step',
        requires: ['resolvents'],
        why: 'It is the resolution rule with a target, so the rule itself comes first.',
      },
      {
        id: 'refutation',
        n: 11,
        title: 'Build a resolution refutation',
        source: 'ln §2.3 · Example 2.26',
        game: 'refutation',
        requires: ['resolvents'],
        why: 'A refutation is a chain of single resolution steps.',
      },
      {
        id: 'entailment-refutation',
        n: 12,
        title: 'Prove an entailment by refutation',
        source: 'Exercise 2',
        game: 'entailment-refutation',
        requires: ['refutation', 'entailment'],
        why: 'You refute the premises with the conclusion negated — so you need refutations and you need to know what ⊨ claims.',
      },
    ],
  },
  {
    letter: 'D',
    title: 'Solving',
    items: [
      {
        id: 'bcp',
        n: 13,
        title: 'BCP until fixpoint — name the three outcomes',
        source: 'Def. 2.39 · exam25a Q1.1c · Exercise 3',
        game: 'bcp',
        requires: ['model-count'],
        why: 'Propagation is already the first step of counting models.',
      },
      {
        id: 'dp',
        n: 14,
        title: 'DP procedure — variable elimination',
        source: 'exam26a and exam26bA Q1.2 · Exercise 2',
        game: 'dp',
        stars: 1,
        requires: ['resolvents'],
        why: 'Eliminating a variable means resolving every pair that clashes on it.',
      },
      {
        id: 'dpll',
        n: 15,
        title: 'DPLL decision tree — count the leaves',
        source: 'ln §2.4 · Exercise 3',
        game: 'dpll',
        requires: ['bcp'],
        why: 'DPLL is decide, then propagate. The propagation half has to be automatic.',
      },
      {
        id: 'dpll-refutation',
        n: 16,
        title: 'Refutation matching a given DPLL tree',
        source: 'exam25a Q1.2',
        game: 'conflict-clause',
        requires: ['dpll', 'refutation'],
        why: 'The hybrid: it asks you to read a tree and write the resolution proof it corresponds to.',
      },
      {
        id: 'cdcl',
        n: 17,
        title: 'CDCL and learned clauses',
        source: 'Examples 2.44–2.45',
        game: 'learned-clause',
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
        id: 'rup-proof',
        n: 18,
        title: 'RUP proof — build the sequence to ⊥',
        source: 'exam26a and exam26bA Q1.3 · Exercise 3',
        stars: 1,
        game: 'rup-builder',
        requires: ['rup-check'],
        why: 'Writing a proof means checking each line you write, so checking has to be automatic first.',
      },
      {
        id: 'rup-check',
        n: 19,
        title: 'RUP checkbox — does clause C have the property?',
        source: 'Quiz 1',
        game: 'rup',
        requires: ['bcp', 'refutation'],
        why: 'A RUP check is BCP on the formula with the candidate clause negated.',
      },
      {
        id: 'blocked-named',
        n: 20,
        title: 'Blocked clause with a named blocking literal',
        source: 'Exercise 3 · Quiz 1',
        game: 'blocked-literal',
        requires: ['resolvents'],
        why: 'The condition is about resolvents being tautologies, so the resolution rule comes first.',
      },
      {
        id: 'bce',
        n: 21,
        title: 'Blocked clause elimination to prove SAT',
        source: 'exam25a Q1.3 · exam26bA bonus',
        game: 'blocked-clauses',
        requires: ['resolvents', 'sat-equivalence'],
        why: 'Deleting a clause changes the model set, so it is only legal because satisfiability survives.',
      },
    ],
  },
]

const EQUATIONAL_SECTIONS: Section[] = [
  {
    letter: 'A',
    title: 'Terms',
    items: [
      {
        id: 'term-parse',
        n: 22,
        title: 'Parse a term from a string with no commas or parens',
        source: 'Exercise 4 · Collection Q11',
        stars: 1,
        game: 'term-flat',
      },
      {
        id: 'term-properties',
        n: 23,
        title: 'Ground terms; when T(F, a, V) is infinite',
        source: 'Exercise 4 · ln §3.1',
        game: 'term-build',
        requires: ['term-parse'],
        why: 'You have to be able to read a term before you can say anything about the set of them.',
      },
      {
        id: 'interpretation',
        n: 24,
        title: 'Does an equation hold under a concrete interpretation?',
        source: 'Collection Q12 · eq1',
        stars: 1,
        game: 'interpretation',
        requires: ['term-parse'],
        why: 'An interpretation assigns meaning to the symbols of a term you can already parse.',
      },
    ],
  },
  {
    letter: 'B',
    title: 'Substitution and unification',
    items: [
      {
        id: 'composition',
        n: 25,
        title: 'Substitution composition σ∘σ′ — simultaneous, not sequential',
        source: 'ln §3.2 · exam26bA Q2.1',
        game: 'composition',
        requires: ['term-parse'],
        why: 'A substitution maps variables to terms, so terms come first.',
      },
      {
        id: 'more-general',
        n: 26,
        title: 'More general than — t ≤ t′',
        source: 'exam25a Q2.1 · Exercise 5',
        stars: 1,
        game: 'more-general',
        requires: ['composition'],
        why: '“More general” is defined by whether a substitution takes one term to the other.',
      },
      {
        id: 'matching',
        n: 27,
        title: 'Matching algorithm',
        source: 'Alg. 3.8',
        game: 'matching',
        requires: ['more-general'],
        why: 'Matching is the algorithm that decides the “more general than” question.',
      },
      {
        id: 'mgu',
        n: 28,
        title: 'Most general unifier, or prove not unifiable',
        source: 'exam25a Q2.2 · exam26bA Q2.3',
        stars: 2,
        game: 'mgu',
        requires: ['matching', 'occurs-check'],
        why: 'Unification is matching in both directions, and the occurs check is where it fails.',
      },
      {
        id: 'unifiable-checkbox',
        n: 29,
        title: 'Unifiable / incomparable over a term set',
        source: 'Exercise 5',
        game: 'unifiable',
        requires: ['mgu'],
        why: 'Judging a whole set is the same question asked repeatedly.',
      },
      {
        id: 'occurs-check',
        n: 30,
        title: 'Occurs check — f(x) vs f(f(x))',
        source: 'ln §3.2',
        game: 'occurs-check',
        requires: ['composition'],
        why: 'It is the one case where no substitution can exist, so you need substitutions first.',
      },
    ],
  },
  {
    letter: 'C',
    title: 'Equational theory',
    items: [
      {
        id: 'closure',
        n: 31,
        title: 'Which equations follow from E? The four closure rules',
        source: 'Def. 3.16 · Exercise 5',
        game: 'theory-chain',
        requires: ['interpretation'],
        why: 'The closure rules are what ⊨ means once you have interpretations.',
      },
      {
        id: 'soundness',
        n: 32,
        title: '⊢ equals ⊨',
        source: 'Thm 3.19',
        game: 'theory-decide',
        requires: ['closure'],
        why: 'The theorem relates derivation to the closure you have just built.',
      },
    ],
  },
  {
    letter: 'D',
    title: 'Normal forms and completion',
    items: [
      {
        id: 'term-order',
        n: 33,
        title: 'Is this a term order? Why "more general than" fails',
        source: 'eq3 · exam26bA Q2.2',
        stars: 1,
        game: 'term-order',
        requires: ['more-general'],
        why: 'The point of the question is precisely why “more general than” is not one.',
      },
      {
        id: 'reduce',
        n: 34,
        title: 'Reduce a term to normal form',
        source: 'Alg. 3.21',
        game: 'reduce',
        requires: ['term-order'],
        why: 'Reduction needs an order to know which way is downhill.',
      },
      {
        id: 'non-confluent',
        n: 35,
        title: 'Which terms can be an output of reduction',
        source: 'Exercise 6',
        game: 'normal-forms',
        requires: ['reduce'],
        why: 'The question is what reduction can produce, so reduction comes first.',
      },
      {
        id: 'critical-pairs',
        n: 36,
        title: 'Compute all critical pairs',
        source: 'exam25a Q2.3 · exam26bA Q2.4 · Exercise 6',
        stars: 2,
        game: 'critical-pairs',
        requires: ['mgu', 'reduce'],
        why: 'A critical pair is found by unifying one rule’s left side into another’s.',
      },
      {
        id: 'renaming',
        n: 37,
        title: 'Critical pairs up to variable renaming',
        source: 'Exercise 6',
        game: 'pair-renaming',
        requires: ['critical-pairs'],
        why: 'Same computation, then a comparison up to renaming.',
      },
      {
        id: 'knuth-bendix',
        n: 38,
        title: 'Knuth-Bendix completion; it need not terminate',
        source: 'Alg. 3.26 · exam26bA Q2.1',
        game: 'completion',
        requires: ['critical-pairs', 'non-confluent'],
        why: 'Completion is: find critical pairs, orient them, repeat until confluent.',
      },
    ],
  },
]

const FIRST_ORDER_SECTIONS: Section[] = [
  {
    letter: 'A',
    title: 'Syntax and semantics',
    items: [
      {
        id: 'signature',
        n: 39,
        title: 'Signature, arity, well-formed formulas',
        source: 'ln §4.1',
        game: 'signature',
      },
      {
        id: 'fo-vocabulary',
        n: 40,
        title: 'Atom, ground atom, literal, bound, free, clean, closed',
        source: 'Exercise 7 · fo1',
        game: 'fo-vocabulary',
        requires: ['signature'],
        why: 'Every one of those words is defined against a signature.',
      },
      {
        id: 'fo-evaluate',
        n: 41,
        title: 'Evaluate a formula under a finite interpretation',
        source: 'ln §4.1 · exam26a Q4.2',
        game: 'fo-evaluate',
        requires: ['fo-vocabulary'],
        why: 'You need free and bound straight before an interpretation means anything.',
      },
    ],
  },
  {
    letter: 'B',
    title: 'Normal forms',
    items: [
      {
        id: 'prenex',
        n: 42,
        title: 'Prenex normal form — the seven shifting equivalences',
        source: 'Fig. 4.1',
        game: 'prenex',
        requires: ['fo-vocabulary'],
        why: 'Shifting quantifiers is exactly a question about what is bound where.',
      },
      {
        id: 'skolem',
        n: 43,
        title: 'Skolemization and Skolem normal form',
        source: 'all three exams · Exercise 8',
        stars: 3,
        game: 'skolem',
        requires: ['prenex'],
        why: 'Skolemization reads the ∀ variables to the left of an ∃, which only exists once the prefix is out front.',
      },
      {
        id: 'clausify',
        n: 44,
        title: 'Clausification',
        source: 'ln §4.2',
        game: 'clausify',
        requires: ['skolem'],
        why: 'Clausification is the last step after the quantifiers are gone.',
      },
    ],
  },
  {
    letter: 'C',
    title: 'Ground methods',
    items: [
      {
        id: 'herbrand-universe',
        n: 45,
        title: 'Herbrand universe — invent a constant if there is none',
        source: 'Exercise 8 · fo2',
        stars: 1,
        game: 'herbrand-universe',
        requires: ['clausify'],
        why: 'The universe is built from the function symbols of the clause form.',
      },
      {
        id: 'herbrand-expansion',
        n: 46,
        title: 'Herbrand expansion — the ground instances',
        source: 'Exercise 8',
        game: 'herbrand-expansion',
        requires: ['herbrand-universe'],
        why: 'The expansion is the ground instances over that universe.',
      },
      {
        id: 'herbrand-models',
        n: 47,
        title: 'Herbrand interpretations and models',
        source: 'Example 4.19',
        game: 'herbrand-models',
        requires: ['herbrand-expansion', 'fo-evaluate'],
        why: 'A Herbrand interpretation is an interpretation over the expansion.',
      },
      {
        id: 'herbrand-theorem',
        n: 48,
        title: 'Herbrand\'s theorem',
        source: 'Thm 4.21',
        game: 'herbrand-theorem',
        requires: ['herbrand-models'],
        why: 'The theorem is the statement about those models.',
      },
      {
        id: 'gilmore',
        n: 49,
        title: 'Gilmore / instantiation refutation',
        source: 'exam25a Q3.2 · recap Ex 1',
        stars: 1,
        game: 'gilmore',
        requires: ['herbrand-expansion'],
        why: 'Gilmore enumerates the expansion and hands each batch to a propositional solver.',
      },
    ],
  },
  {
    letter: 'D',
    title: 'Resolution',
    items: [
      {
        id: 'fo-resolution',
        n: 50,
        title: 'First-order resolution with unification',
        source: 'exam26a Q3.2 · exam25a Q3.3 · recap Ex 2 · Exercise 8',
        stars: 2,
        game: 'fo-resolution',
        requires: ['clausify', 'mgu'],
        why: 'First-order resolution is propositional resolution plus unification — you need both halves.',
      },
      {
        id: 'factoring',
        n: 51,
        title: 'Factoring',
        source: 'Def. 4.28',
        game: 'factoring',
        requires: ['fo-resolution'],
        why: 'Factoring is the extra rule resolution needs to stay complete.',
      },
      {
        id: 'lifting',
        n: 52,
        title: 'Soundness, completeness, the Lifting Lemma',
        source: 'Thm 4.30',
        game: 'lifting',
        requires: ['fo-resolution', 'herbrand-theorem'],
        why: 'The Lifting Lemma connects the ground and first-order levels.',
      },
    ],
  },
  {
    letter: 'E',
    title: 'Equality',
    items: [
      {
        id: 'equality-axioms',
        n: 53,
        title: 'Equality axioms E_φ with standard resolution',
        source: 'ln §4.4 · Exercise 9',
        game: 'equality-axioms',
        requires: ['fo-resolution'],
        why: 'The axioms are added and then ordinary resolution runs.',
      },
      {
        id: 'reflexivity-resolution',
        n: 54,
        title: 'Reflexivity resolution',
        source: 'Def. 4.40',
        game: 'reflexivity-resolution',
        requires: ['equality-axioms'],
        why: 'It is the special rule that replaces one of those axioms.',
      },
      {
        id: 'paramodulation',
        n: 55,
        title: 'Paramodulation',
        source: 'exam26bA Q3.2 · Exercise 9 · recap Ex 3',
        stars: 1,
        game: 'paramodulation',
        requires: ['equality-axioms', 'mgu'],
        why: 'Paramodulation unifies a subterm and replaces one occurrence — resolution machinery on an equation.',
      },
    ],
  },
]

const THEORIES_SECTIONS: Section[] = [
  {
    letter: 'A',
    title: 'Basics',
    items: [
      {
        id: 'theory-tf',
        n: 56,
        game: 'theory-tf',
        title: 'True/false on theories — closed under implication',
        source: 'all three exams · Def. 5.1',
        stars: 3,
      },
      {
        id: 'theory-properties',
        n: 57,
        game: 'theory-properties',
        title: 'Complete, decidable, finitely axiomatizable, inconsistent',
        source: 'theories2',
        requires: ['theory-tf'],
        why: 'Each property is a statement about a theory, so what a theory is comes first.',
      },
      {
        id: 'theory-sets',
        n: 58,
        game: 'theory-sets',
        title: 'Subsets, supersets, unions; one false formula and everything follows',
        source: 'Exercise 10 · all three exams',
        requires: ['theory-tf'],
        why: 'Closure under implication is what makes the set operations behave the way they do.',
      },
      {
        id: 'theory-membership',
        n: 59,
        title: 'Does formula φ belong to theory T? Justify',
        source: 'exam26a Q4.2',
        stars: 1,
        requires: ['theory-sets'],
        why: 'Deciding membership is applying those rules to one formula.',
      },
      {
        id: 'provability',
        n: 60,
        title: 'Provability claims — "every provable formula is true"',
        source: 'Exercise 11',
        requires: ['theory-properties'],
        why: 'The claims are about completeness and consistency by another name.',
      },
    ],
  },
  {
    letter: 'B',
    title: 'Quantifier elimination',
    items: [
      {
        id: 'qe-basics',
        n: 61,
        title: 'What QE is; it does not imply decidability',
        source: 'Def. 5.4',
        requires: ['theory-properties'],
        why: 'QE is a property a theory may or may not have, alongside the others.',
      },
      {
        id: 'qe-finite',
        n: 62,
        game: 'qe-finite',
        title: 'QE over finite universes — ∀ to ∧, ∃ to ∨',
        source: 'Example 5.5',
        requires: ['qe-basics'],
        why: 'The finite case is the easiest instance of the general idea.',
      },
      {
        id: 'qe-dense',
        n: 63,
        game: 'qe-dense',
        title: 'QE for unbounded dense linear orders',
        source: 'exam25a Q4.2 · exam26bA Q4.2 · Exercise 10',
        stars: 3,
        requires: ['qe-finite'],
        why: 'Same procedure, on a structure where the cross-product rule is the whole trick.',
      },
    ],
  },
  {
    letter: 'C',
    title: 'Natural numbers',
    items: [
      {
        id: 'nat-plus',
        n: 64,
        title: 'T(ℕ,=,+) — decidable by automata, no QE, not finitely axiomatizable',
        source: 'theories2',
        requires: ['theory-properties'],
        why: 'Its interest is exactly which of those properties it has and which it lacks.',
      },
      {
        id: 'automata',
        n: 65,
        title: 'Finite automata — which strings are accepted?',
        source: 'Exercise 11',
        stars: 1,
        requires: ['nat-plus'],
        why: 'The automaton is how decidability of T(ℕ,=,+) is actually shown.',
      },
      {
        id: 'nat-times',
        n: 66,
        title: 'T(ℕ,=,+,*) — undecidable; Gödel incompleteness',
        source: 'theories2',
        requires: ['nat-plus'],
        why: 'Adding multiplication is what tips it into undecidability.',
      },
      {
        id: 'divides',
        n: 67,
        title: 'Write formulas with x|y and prime(p)',
        source: 'exam26a Q4.3 · exam26bA Q4.3 · Exercise 11',
        stars: 2,
        requires: ['nat-times'],
        why: 'Divides and prime are defined using multiplication.',
      },
      {
        id: 'nat-vs-real',
        n: 68,
        title: 'ℕ vs ℝ — a formula true in one and not the other',
        source: 'exam25a Q4.3 · both 2026 exams',
        stars: 1,
        requires: ['divides'],
        why: 'The separating formulas are written in the same vocabulary.',
      },
    ],
  },
  {
    letter: 'D',
    title: 'Real numbers and circuits',
    items: [
      {
        id: 'tarski',
        n: 69,
        title: 'T(ℝ,=,+,*) is decidable by QE (Tarski); doubly exponential',
        source: 'theories3',
        requires: ['qe-dense', 'nat-times'],
        why: 'The reals are decidable by QE precisely where the naturals are not.',
      },
      {
        id: 'real-checkbox',
        n: 70,
        title: 'Which formulas are true in T(ℝ,=,+,*)?',
        source: 'Exercise 12',
        requires: ['tarski'],
        why: 'Judging a formula needs to know what the theory decides.',
      },
      {
        id: 'solution-set',
        n: 71,
        title: 'Pick the shaded solution-set picture for a formula',
        source: 'Exercise 12 · theories3',
        stars: 1,
        requires: ['real-checkbox'],
        why: 'The picture is the solution set of a formula you can already read.',
      },
      {
        id: 'gate-polynomials',
        n: 72,
        game: 'gate-polynomials',
        title: 'Gate polynomials — AND, OR, XOR',
        source: 'Exercise 12 · Fig. 5.3',
        stars: 1,
        requires: ['tarski'],
        why: 'Circuit verification lives inside the polynomial theory of the reals.',
      },
      {
        id: 'circuit-verify',
        n: 73,
        game: 'circuit-verify',
        title: 'Verify a circuit by polynomial reduction',
        source: 'exam26a Q4.4 · exam26bA Q4.4 · recap Ex 6',
        stars: 2,
        requires: ['gate-polynomials'],
        why: 'The three gate polynomials are the whole method.',
      },
    ],
  },
  {
    letter: 'E',
    title: 'Bonus',
    items: [
      {
        id: 'portrait',
        n: 74,
        title: 'Portrait ID — the only pictured figure in the course',
        source: 'exam26a bonus · theories2',
      },
      {
        id: 'short-proof',
        n: 75,
        title: 'Short proof — e.g. a pure literal gives a blocked clause',
        source: 'exam26bA bonus',
        requires: ['bce'],
        why: 'The bonus proof is that a pure literal gives a blocked clause — the shortcut you already use.',
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
    sections: EQUATIONAL_SECTIONS,
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
    sections: FIRST_ORDER_SECTIONS,
  },
  {
    id: 'fol-theories',
    title: 'Theories in First-Order Logic',
    blurb: 'Quantifier elimination, the natural numbers, the real numbers.',
    icon: '⊨',
    colour: 'bg-plum text-white',
    planned: ['Quantifier elimination', 'Natural numbers', 'Real numbers'],
    sections: THEORIES_SECTIONS,
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
  terms: 'equational',
  unification: 'equational',
  'equational-theory': 'equational',
  rewriting: 'equational',
  'fo-syntax': 'first-order',
  'fo-normal-forms': 'first-order',
  herbrand: 'first-order',
  'fo-resolution': 'first-order',
  'fo-equality': 'first-order',
  theories: 'fol-theories',
  'quantifier-elimination': 'fol-theories',
  'arithmetic-theories': 'fol-theories',
  circuits: 'fol-theories',
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
