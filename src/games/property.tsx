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

import { useEffect, useState } from 'react'
import type { Assignment, Classification, Formula, Rng } from '@/logic'
import {
  and,
  andAll,
  classify,
  countModels,
  dependsOnAllVariables,
  evaluate,
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
import { Pop } from '@/ui/motion'
import { WitnessHunt, type Banked } from '@/ui/WitnessHunt'
import { PropertyGuide } from './property.guide'

/**
 * The answer is the *evidence*, not the label.
 *
 * Definition 2.6 is stated in witnesses — satisfiable means there is an
 * assignment making it true, refutable means there is one making it false —
 * so the game asks for those two rows rather than for the word that describes
 * having them. The classification falls out of which ones exist, which is why
 * naming it was never the interesting half.
 *
 * `null` for a slot is the claim that no such assignment exists, and that is a
 * real answer: it is what makes a formula valid or unsatisfiable.
 */
export interface PropertyAnswer {
  /** A row making it true, or null for "there is none". */
  model: Assignment | null
  /** A row making it false, or null for "there is none". */
  counter: Assignment | null
}

/** What a completed hunt says the formula is. */
export const classifyFromWitnesses = (answer: PropertyAnswer): Classification =>
  answer.model === null ? 'contradiction' : answer.counter === null ? 'tautology' : 'contingent'

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

const solve = (question: PropertyQuestion): PropertyAnswer => ({
  model: findModel(question.formula),
  counter: findCounterexample(question.formula),
})

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
  const truth = classify(question.formula)

  // Each half is checked on its own terms: a banked row has to actually do
  // what it claims, and a "there is none" has to actually be true.
  const wrong = (slot: 'model' | 'counter'): string | null => {
    const banked = answer[slot]
    const wanted = slot === 'model'
    if (banked !== null) {
      return evaluate(question.formula, banked) === wanted
        ? null
        : `${showAssignment(banked)} makes it ${wanted ? 'false' : 'true'}, not ${wanted ? 'true' : 'false'}.`
    }
    const real = wanted ? findModel(question.formula) : findCounterexample(question.formula)
    return real === null
      ? null
      : `There is one after all: ${showAssignment(real)} makes it ${wanted ? 'true' : 'false'}.`
  }

  const modelProblem = wrong('model')
  const counterProblem = wrong('counter')

  if (modelProblem !== null || counterProblem !== null) {
    return {
      correct: false,
      score: modelProblem === null || counterProblem === null ? 0.5 : 0,
      message: modelProblem !== null ? 'That is not a model' : 'That is not a counter-model',
      detail: [modelProblem, counterProblem].filter((entry) => entry !== null).join(' '),
    }
  }

  return {
    correct: true,
    message: PROPERTY_LABELS[truth],
    detail: witness(question.formula, truth),
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked, solution }: MinigameScreenProps<PropertyQuestion, PropertyAnswer>) {
  const [banked, setBanked] = useState<Banked>({})

  useEffect(() => {
    setBanked({})
  }, [question])

  const settled = banked.model !== undefined && banked.counter !== undefined
  const shown: PropertyAnswer | null = locked
    ? { model: banked.model ?? null, counter: banked.counter ?? null }
    : null

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Hunt the witnesses
      </p>
      <p className="mt-1 mb-2 text-xs font-medium text-ink-soft">
        Find a row making it true and a row making it false — or claim there is none. What the
        formula <em>is</em> follows from which ones you find.
      </p>

      <WitnessHunt
        locked={locked}
        formulas={[{ label: 'φ', formula: question.formula }]}
        banked={banked}
        onBank={(id, assignment) => setBanked((previous) => ({ ...previous, [id]: assignment }))}
        goals={[
          {
            id: 'model',
            label: 'A row making it true',
            noneLabel: 'None — never true',
            test: (assignment) => evaluate(question.formula, assignment),
          },
          {
            id: 'counter',
            label: 'A row making it false',
            noneLabel: 'None — never false',
            test: (assignment) => !evaluate(question.formula, assignment),
          },
        ]}
        footer={
          <>
            {!locked && (
              <Button
                variant="coin"
                className="mt-3 w-full"
                disabled={!settled}
                onClick={() =>
                  submit({ model: banked.model ?? null, counter: banked.counter ?? null })
                }
              >
                {settled
                  ? `Submit — ${PROPERTY_LABELS[classifyFromWitnesses({
                      model: banked.model ?? null,
                      counter: banked.counter ?? null,
                    })].toLowerCase()}`
                  : 'Settle both rows first'}
              </Button>
            )}

            {locked && shown !== null && (
              <Pop className="mt-3 rounded-2xl bg-card-shade p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                  What that makes it
                </p>
                <p className="mt-1 text-base font-bold">
                  {PROPERTY_LABELS[classifyFromWitnesses(shown)]}
                </p>
                <p className="mt-1 text-xs font-medium text-ink-soft">
                  A row of each means satisfiable and refutable at once. No false row means valid;
                  no true row means unsatisfiable.
                </p>
                {solution !== null && (
                  <p className="mt-2 text-xs font-medium text-ink-soft">
                    Reference: {solution.model === null ? 'no model' : showAssignment(solution.model)} ·{' '}
                    {solution.counter === null ? 'no counter-model' : showAssignment(solution.counter)}
                  </p>
                )}
              </Pop>
            )}
          </>
        }
      />

      <p className="mt-3 text-xs font-medium text-ink-soft">
        {question.variables.length} variables · {1 << question.variables.length} rows. Every valid
        formula is satisfiable too — which is why "no false row" is the claim that makes it valid,
        not "no true row".
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
  generate,
  check,
  solve,
  Screen,
  Guide: PropertyGuide,
  questionKey: (question) => format(question.formula),
})
