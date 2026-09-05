/**
 * Which property fits? — Definition 2.6 and Theorem 2.8 of the course notes.
 *
 * Given a formula, say whether it is valid, satisfiable-but-not-valid, or
 * unsatisfiable. Those three are exactly the regions of Figure 2.3: mutually
 * exclusive and between them covering every formula.
 *
 * The three-way choice is deliberate. "Satisfiable" on its own is *not* the
 * opposite of "valid" — every valid formula is also satisfiable (Theorem 2.8.1)
 * — so a button labelled plain "satisfiable" would be wrong about two thirds of
 * the questions. The middle option says "satisfiable, not valid" instead.
 */

import type { Assignment, Classification, Formula, Rng } from '@/logic'
import {
  and,
  andAll,
  classify,
  countModels,
  dependsOnAllVariables,
  findCounterexample,
  findModel,
  format,
  iff,
  implies,
  not,
  or,
  orAll,
  randomFormula,
  repeatsAnOperand,
  showAssignment,
  size,
  sortedVariables,
  v,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FormulaText } from '@/ui/FormulaText'
import { PropertyGuide } from './property.guide'

/**
 * The answer is the classification itself, so there is exactly one source of
 * truth for what a formula is: `classify`. The game cannot mark against a
 * different notion of validity than the rest of the app uses.
 */
export type PropertyAnswer = Classification

export interface PropertyQuestion {
  formula: Formula
  variables: string[]
}

export const CLASSIFICATIONS: readonly Classification[] = [
  'tautology',
  'contingent',
  'contradiction',
]

/**
 * Course vocabulary, not ours. "Valid" and "tautology" are the same thing in
 * Definition 2.6.2, and the exam uses both.
 */
export const PROPERTY_LABELS: Readonly<Record<Classification, string>> = {
  tautology: 'Valid',
  contingent: 'Satisfiable, not valid',
  contradiction: 'Unsatisfiable',
}

const PROPERTY_HINTS: Readonly<Record<Classification, string>> = {
  tautology: 'True under every assignment',
  contingent: 'True under some, false under others',
  contradiction: 'False under every assignment',
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export interface Profile {
  variables: string[]
  /** Depth of the random subformulas plugged into a tautology schema. */
  partDepth: number
  /** Depth used when a contingent formula is drawn directly. */
  contingentDepth: number
  /**
   * Node-count window every question must land in, whatever its property.
   *
   * This matters more than it looks: a schema-built tautology is naturally
   * bigger than a freely drawn contingent formula, and if the sizes differ the
   * player learns to answer from the length of the formula rather than from
   * the logic. Holding all three to the same window removes the tell.
   */
  minSize: number
  maxSize: number
  /**
   * Variables the formula must actually mention.
   *
   * Without this, "hard" is only nominally harder: the schemas plug in small
   * random parts, and nearly half the draws over a three-variable pool ended
   * up mentioning just two, which is a medium question in a hard round.
   */
  minVariables: number
}

export const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['p', 'q'], partDepth: 1, contingentDepth: 4, minSize: 6, maxSize: 9, minVariables: 2 },
  medium: { variables: ['p', 'q'], partDepth: 2, contingentDepth: 5, minSize: 7, maxSize: 15, minVariables: 2 },
  hard: { variables: ['p', 'q', 'r'], partDepth: 2, contingentDepth: 6, minSize: 11, maxSize: 21, minVariables: 3 },
}

export type Schema = { arity: number; build: (parts: Formula[]) => Formula }

const part = (parts: Formula[], index: number): Formula => parts[index] as Formula

/**
 * Tautology schemas: substituting *any* formulas for the placeholders yields a
 * valid formula. Every one of these is a law the course states somewhere, so
 * recognising them is itself part of the exercise.
 *
 * Verified against `classify` on every draw regardless — a schema typed wrong
 * would otherwise generate questions with the wrong answer.
 */
export const TAUTOLOGY_SCHEMAS: readonly Schema[] = [
  // Excluded middle and non-contradiction.
  { arity: 1, build: (p) => or(part(p, 0), not(part(p, 0))) },
  { arity: 1, build: (p) => not(and(part(p, 0), not(part(p, 0)))) },
  // Weakening and strengthening.
  { arity: 2, build: (p) => implies(and(part(p, 0), part(p, 1)), part(p, 0)) },
  { arity: 2, build: (p) => implies(part(p, 0), or(part(p, 0), part(p, 1))) },
  // Total order on implication — surprising, and a good question.
  { arity: 2, build: (p) => or(implies(part(p, 0), part(p, 1)), implies(part(p, 1), part(p, 0))) },
  // De Morgan, both directions.
  { arity: 2, build: (p) => iff(not(and(part(p, 0), part(p, 1))), or(not(part(p, 0)), not(part(p, 1)))) },
  { arity: 2, build: (p) => iff(not(or(part(p, 0), part(p, 1))), and(not(part(p, 0)), not(part(p, 1)))) },
  // Implication as a disjunction, and contraposition.
  { arity: 2, build: (p) => iff(implies(part(p, 0), part(p, 1)), or(not(part(p, 0)), part(p, 1))) },
  { arity: 2, build: (p) => iff(implies(part(p, 0), part(p, 1)), implies(not(part(p, 1)), not(part(p, 0)))) },
  // Modus ponens and modus tollens, written as one formula.
  { arity: 2, build: (p) => implies(and(implies(part(p, 0), part(p, 1)), part(p, 0)), part(p, 1)) },
  { arity: 2, build: (p) => implies(and(implies(part(p, 0), part(p, 1)), not(part(p, 1))), not(part(p, 0))) },
  // Double negation.
  { arity: 1, build: (p) => iff(not(not(part(p, 0))), part(p, 0)) },
  // Transitivity of implication.
  {
    arity: 3,
    build: (p) =>
      implies(
        and(implies(part(p, 0), part(p, 1)), implies(part(p, 1), part(p, 2))),
        implies(part(p, 0), part(p, 2)),
      ),
  },
]

/**
 * Contradiction schemas. Deliberately not just "negate a tautology": if every
 * unsatisfiable question started with a ¬ the answer would be visible from the
 * first character.
 */
export const CONTRADICTION_SCHEMAS: readonly Schema[] = [
  { arity: 1, build: (p) => and(part(p, 0), not(part(p, 0))) },
  { arity: 1, build: (p) => not(or(part(p, 0), not(part(p, 0)))) },
  { arity: 1, build: (p) => iff(part(p, 0), not(part(p, 0))) },
  // The premises of modus ponens together with the negated conclusion.
  { arity: 2, build: (p) => andAll([implies(part(p, 0), part(p, 1)), part(p, 0), not(part(p, 1))]) },
  // A disjunction with both sides denied.
  { arity: 2, build: (p) => andAll([or(part(p, 0), part(p, 1)), not(part(p, 0)), not(part(p, 1))]) },
  // Equivalence asserted, then broken.
  { arity: 2, build: (p) => andAll([iff(part(p, 0), part(p, 1)), part(p, 0), not(part(p, 1))]) },
  { arity: 2, build: (p) => and(iff(part(p, 0), part(p, 1)), iff(part(p, 0), not(part(p, 1)))) },
]

/**
 * All 2ⁿ clauses over n variables, e.g. (x∨y) ∧ (¬x∨y) ∧ (x∨¬y) ∧ (¬x∨¬y).
 *
 * Unsatisfiable because every assignment falsifies exactly the clause that
 * negates it — and the only way to see that is to reason about it, which is
 * why it is worth generating separately from the schemas. This shape is
 * lifted straight from Exercise 1 of the course.
 */
export function fullClauseSet(variables: readonly string[]): Formula {
  const count = 1 << variables.length
  const clauses: Formula[] = []
  for (let mask = 0; mask < count; mask++) {
    clauses.push(
      orAll(
        variables.map((name, bit) => ((mask >> bit) & 1 ? not(v(name)) : v(name))),
      ),
    )
  }
  return andAll(clauses)
}

/**
 * Randomly commute the operands of ∧, ∨ and ↔ throughout the formula.
 *
 * Truth-preserving, and it breaks up the mirror symmetry a schema leaves
 * behind: `¬(p ∧ q) ↔ (¬p ∨ ¬q)` can come out as `(¬q ∨ ¬p) ↔ ¬(q ∧ p)`,
 * which has to be read rather than recognised. Implication is left alone —
 * it does not commute.
 */
export function commute(rng: Rng, formula: Formula): Formula {
  switch (formula.kind) {
    case 'var':
    case 'const':
      return formula
    case 'not':
      return not(commute(rng, formula.arg))
    default: {
      const left = commute(rng, formula.left)
      const right = commute(rng, formula.right)
      const swap = formula.kind !== 'implies' && rng.bool()
      const a = swap ? right : left
      const b = swap ? left : right
      switch (formula.kind) {
        case 'and':
          return and(a, b)
        case 'or':
          return or(a, b)
        case 'iff':
          return iff(a, b)
        default:
          return implies(a, b)
      }
    }
  }
}

/** A placeholder to plug into a schema: a literal, or something small. */
function randomPart(rng: Rng, profile: Profile): Formula {
  return randomFormula(rng, {
    variables: profile.variables,
    depth: rng.range(1, profile.partDepth),
    connectives: ['not', 'and', 'or', 'implies'],
    minDistinctVariables: 1,
  })
}

const ATTEMPTS = 200

function fits(formula: Formula, profile: Profile, target: Classification): boolean {
  const width = size(formula)
  return (
    width >= profile.minSize &&
    width <= profile.maxSize &&
    sortedVariables(formula).length >= profile.minVariables &&
    // The schemas are believed correct; this is what makes that safe to assume.
    classify(formula) === target
  )
}

function generateWithProperty(rng: Rng, profile: Profile, target: Classification): Formula {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    let candidate: Formula

    if (target === 'contingent') {
      candidate = randomFormula(rng, {
        variables: profile.variables,
        depth: rng.range(2, profile.contingentDepth),
        connectives: ['not', 'and', 'or', 'implies', 'iff'],
        minDistinctVariables: 2,
      })
      // Quality filters that only make sense here. A tautology depends on
      // none of its variables — that is what being a tautology means — so
      // applying `dependsOnAllVariables` to the other two targets would reject
      // every candidate. A contingent formula that mentions a variable it does
      // not actually use, though, is a fake-hard question.
      if (!dependsOnAllVariables(candidate) || repeatsAnOperand(candidate)) continue
    } else if (
      target === 'contradiction' &&
      // Every clause over three variables is 8 clauses and roughly 60 nodes —
      // far outside any size window, and it would wreck the length invariant.
      // So this tactic is a two-variable one, and hard does not use it.
      profile.minVariables === 2 &&
      rng.bool(0.15)
    ) {
      candidate = fullClauseSet(rng.sample(profile.variables, 2))
    } else {
      const schemas = target === 'tautology' ? TAUTOLOGY_SCHEMAS : CONTRADICTION_SCHEMAS
      const schema = rng.pick(schemas)
      candidate = schema.build(
        Array.from({ length: schema.arity }, () => randomPart(rng, profile)),
      )
    }

    candidate = commute(rng, candidate)
    if (fits(candidate, profile, target)) return candidate
  }

  // Last resort, so a round can never stall. Small and obvious, but correct,
  // and only reachable if 200 draws all missed the size window.
  const [a = 'p', b = 'q', c = 'r'] = profile.variables
  // Mentions every variable the profile asks for, so it satisfies `fits` too.
  const pad = profile.minVariables >= 3 ? [v(c)] : []
  const fallback: Record<Classification, Formula> = {
    tautology: orAll([v(a), not(v(a)), v(b), ...pad]),
    contingent: andAll([v(a), or(v(b), not(v(a))), ...pad]),
    contradiction: andAll([v(a), v(b), not(v(a)), ...pad]),
  }
  return fallback[target]
}

function generate({ rng, difficulty }: GenerateContext): PropertyQuestion {
  const profile = PROFILES[difficulty]
  // Independent uniform draws rather than a rotation: a rotation would let you
  // work out the third answer of every block from the first two.
  const target = rng.pick(CLASSIFICATIONS)
  const formula = generateWithProperty(rng, profile, target)
  return { formula, variables: sortedVariables(formula) }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: PropertyQuestion): PropertyAnswer => classify(question.formula)

/** The evidence for the answer, in the form Definition 2.6 asks for. */
function witness(formula: Formula, truth: Classification): string {
  const total = 1 << sortedVariables(formula).length

  if (truth === 'tautology') {
    const model = findModel(formula) as Assignment
    return `No assignment makes it false — all ${total} rows come out true, for example ${showAssignment(
      model,
    )}. Equivalently, ¬(${format(formula)}) is unsatisfiable.`
  }

  if (truth === 'contradiction') {
    const counter = findCounterexample(formula) as Assignment
    return `No assignment makes it true — all ${total} rows come out false, for example ${showAssignment(
      counter,
    )}. It has no models at all.`
  }

  const model = findModel(formula) as Assignment
  const counter = findCounterexample(formula) as Assignment
  return `Model: ${showAssignment(model)} makes it true, so it is satisfiable. Counter-model: ${showAssignment(
    counter,
  )} makes it false, so it is not valid. ${countModels(formula)} of ${total} rows are models.`
}

function check(question: PropertyQuestion, answer: PropertyAnswer): Verdict {
  const truth = solve(question)

  if (answer === truth) {
    return {
      correct: true,
      message: PROPERTY_LABELS[truth],
      detail: witness(question.formula, truth),
    }
  }

  return {
    correct: false,
    // A pure function of what you picked, never of what the answer is: in
    // sprint this message is the only feedback shown before you try again, and
    // with three options anything that narrowed the field would hand the
    // question over. The quotes are load-bearing — "Not satisfiable, not
    // valid" without them reads as a claim that the formula is unsatisfiable.
    message: `Not \u201C${PROPERTY_LABELS[answer]}\u201D`,
    detail: `It is ${PROPERTY_LABELS[truth].toLowerCase()}. ${witness(question.formula, truth)}`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked, solution }: MinigameScreenProps<PropertyQuestion, PropertyAnswer>) {
  const printed = format(question.formula)
  const formulaSize = printed.length > 44 ? 'text-lg' : printed.length > 28 ? 'text-xl' : 'text-2xl'

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Which property fits?
      </p>
      <p className={`mt-1 leading-snug font-semibold text-balance text-ink ${formulaSize}`}>
        <FormulaText formula={question.formula} />
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {CLASSIFICATIONS.map((option) => {
          const isAnswer = locked && solution === option
          return (
            <Button
              key={option}
              variant={isAnswer ? 'primary' : 'secondary'}
              disabled={locked}
              onClick={() => submit(option)}
              className={`w-full flex-col items-start gap-0 py-3 text-left
                ${isAnswer ? 'revealed' : ''} ${locked && !isAnswer ? 'opacity-50' : ''}`}
            >
              <span className="block text-base font-bold">{PROPERTY_LABELS[option]}</span>
              <span className="block text-sm font-medium opacity-80">{PROPERTY_HINTS[option]}</span>
            </Button>
          )
        })}
      </div>

      <p className="mt-3 text-xs font-medium text-ink-soft">
        {question.variables.length} variables · {1 << question.variables.length} assignments to
        account for. Every valid formula is satisfiable too, which is why the middle option says
        “not valid”.
      </p>
    </Card>
  )
}

export const propertyGame = defineMinigame<PropertyQuestion, PropertyAnswer>({
  id: 'property-check',
  title: 'Property Check',
  tagline: 'Valid, satisfiable or unsatisfiable?',
  topics: ['satisfiability'],
  icon: '🔎',
  roundSeconds: 120,
  sprintQuestions: 10,
  /**
   * Triple the usual penalty, because this is a three-way choice.
   *
   * Sprint will not let you move on until you are right, so with three options
   * you can always brute-force a question in at most two wrong guesses. At the
   * default five seconds that costs ten — less than honestly working out
   * whether a formula with three variables is valid, which makes guessing the
   * faster strategy. At twelve it is comfortably the slower one.
   */
  sprintPenaltySeconds: 12,
  generate,
  check,
  solve,
  Screen,
  Guide: PropertyGuide,
  questionKey: (question) => format(question.formula),
})
