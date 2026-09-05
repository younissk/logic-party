/**
 * Equivalent vs. satisfiability equivalent — ln.pdf §2.2, Definition 2.21.
 *
 * This is the licence that makes preprocessing legal. Tseitin, blocked-clause
 * elimination and variable elimination all destroy equivalence and preserve
 * satisfiability, which is why a solver can hand back a model containing
 * variables you never wrote — and why its UNSAT is still trustworthy.
 *
 * Three relationships are possible, and they are nested:
 *
 *   equivalent            same models. Implies the next one.
 *   sat-equivalent only   both satisfiable, or both unsatisfiable, but
 *                         different models.
 *   neither               one is satisfiable and the other is not.
 *
 * One consequence catches everyone, so the generator makes a point of asking
 * it: two unsatisfiable formulas have the same models — none — so they are not
 * merely sat-equivalent, they are *equivalent*, however unrelated they look.
 */

import type { Formula } from '@/logic'
import {
  and,
  eliminateImplications,
  format,
  isEquivalent,
  isSatisfiable,
  findDistinguishingAssignment,
  not,
  or,
  randomFormula,
  randomFormulaWhere,
  showAssignment,
  size,
  toNNF,
  v,
  type Rng,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FormulaText } from '@/ui/FormulaText'
import { EquivalenceGuide } from './equivalence.guide'

export type Relationship = 'equivalent' | 'sat-equivalent' | 'neither'

export const RELATIONSHIPS: readonly Relationship[] = ['equivalent', 'sat-equivalent', 'neither']

export const RELATIONSHIP_LABELS: Readonly<Record<Relationship, string>> = {
  equivalent: 'Equivalent',
  'sat-equivalent': 'Satisfiability equivalent only',
  neither: 'Neither',
}

const RELATIONSHIP_HINTS: Readonly<Record<Relationship, string>> = {
  equivalent: 'Exactly the same models',
  'sat-equivalent': 'Both satisfiable, but different models',
  neither: 'One is satisfiable, the other is not',
}

export interface EquivalenceQuestion {
  left: Formula
  right: Formula
}

export type EquivalenceAnswer = Relationship

/** The one source of truth for what the relationship is. */
export function classifyPair(left: Formula, right: Formula): Relationship {
  if (isEquivalent(left, right)) return 'equivalent'
  return isSatisfiable(left) === isSatisfiable(right) ? 'sat-equivalent' : 'neither'
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  variables: string[]
  depth: number
  maxSize: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['a', 'b'], depth: 3, maxSize: 12 },
  medium: { variables: ['a', 'b', 'c'], depth: 4, maxSize: 18 },
  hard: { variables: ['a', 'b', 'c'], depth: 5, maxSize: 26 },
}

/** Rewrites that never change the models — the laws of Example 2.12. */
const REWRITES: ((rng: Rng, formula: Formula, profile: Profile) => Formula)[] = [
  (_rng, formula) => toNNF(formula),
  (_rng, formula) => eliminateImplications(formula),
  (_rng, formula) => not(not(formula)),
  // Conjoining a tautology, and disjoining a contradiction, are the textbook
  // examples of a change that is visible but means nothing.
  (rng, formula, profile) => {
    const name = rng.pick(profile.variables)
    return and(formula, or(v(name), not(v(name))))
  },
  (rng, formula, profile) => {
    const name = rng.pick(profile.variables)
    return or(formula, and(v(name), not(v(name))))
  },
]

const ATTEMPTS = 300

function randomSatisfiable(rng: Rng, profile: Profile): Formula {
  return randomFormulaWhere(
    rng,
    {
      variables: profile.variables,
      depth: rng.range(2, profile.depth),
      connectives: ['not', 'and', 'or', 'implies', 'iff'],
      minDistinctVariables: 2,
    },
    (candidate) => isSatisfiable(candidate),
  )
}

/** An unsatisfiable formula that does not wear its contradiction on its sleeve. */
function randomContradiction(rng: Rng, profile: Profile): Formula {
  const inner = randomFormula(rng, {
    variables: profile.variables,
    depth: rng.range(1, 2),
    connectives: ['not', 'and', 'or'],
    minDistinctVariables: 1,
  })
  return rng.bool() ? and(inner, not(inner)) : not(or(inner, not(inner)))
}

function build(rng: Rng, profile: Profile, target: Relationship): EquivalenceQuestion | null {
  if (target === 'equivalent') {
    // Half the time, the pair is one formula rewritten; half the time it is two
    // unrelated contradictions, which are equivalent because neither has any
    // models at all. The second case is the one people get wrong.
    if (rng.bool(0.35)) {
      return { left: randomContradiction(rng, profile), right: randomContradiction(rng, profile) }
    }
    const left = randomSatisfiable(rng, profile)
    const rewrite = rng.pick(REWRITES)
    return { left, right: rewrite(rng, left, profile) }
  }

  if (target === 'sat-equivalent') {
    const left = randomSatisfiable(rng, profile)
    // Strengthening keeps it satisfiable often enough to be worth trying, and
    // guarantees the model sets differ when it does.
    const right = rng.bool()
      ? and(left, v(rng.pick(profile.variables)))
      : randomSatisfiable(rng, profile)
    return { left, right }
  }

  const satisfiable = randomSatisfiable(rng, profile)
  const contradiction = randomContradiction(rng, profile)
  return rng.bool()
    ? { left: satisfiable, right: contradiction }
    : { left: contradiction, right: satisfiable }
}

function generate({ rng, difficulty }: GenerateContext): EquivalenceQuestion {
  const profile = PROFILES[difficulty]
  const target = rng.pick(RELATIONSHIPS)

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    let candidate: EquivalenceQuestion | null
    try {
      candidate = build(rng, profile, target)
    } catch {
      continue
    }
    if (candidate === null) continue
    if (classifyPair(candidate.left, candidate.right) !== target) continue
    if (size(candidate.left) > profile.maxSize || size(candidate.right) > profile.maxSize) continue
    // Two formulas that print identically are not a question.
    if (format(candidate.left) === format(candidate.right)) continue
    return candidate
  }

  // Last resort, so a round can never stall: the notes' own example.
  return { left: v('a'), right: and(v('a'), or(v('b'), not(v('b')))) }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: EquivalenceQuestion): EquivalenceAnswer =>
  classifyPair(question.left, question.right)

/** The evidence, in the terms the definitions are stated in. */
export function evidence(question: EquivalenceQuestion): string {
  const { left, right } = question
  const truth = solve(question)
  const leftSat = isSatisfiable(left)

  if (truth === 'equivalent') {
    return leftSat
      ? 'No assignment tells them apart, so their model sets are identical — and identical models means equivalent, which also makes them satisfiability equivalent.'
      : 'Both are unsatisfiable. Neither has any models, so their model sets are equal — the empty set — and that makes them equivalent, not merely satisfiability equivalent.'
  }

  if (truth === 'sat-equivalent') {
    const witness = findDistinguishingAssignment(left, right)
    return `Both are satisfiable, so they agree on the one bit satisfiability equivalence compares. They are not equivalent: ${
      witness === null ? 'their models differ' : showAssignment(witness)
    } satisfies one and not the other.`
  }

  return `${format(leftSat ? left : right)} is satisfiable and ${format(
    leftSat ? right : left,
  )} is not, so they do not even agree on that one bit.`
}

function check(question: EquivalenceQuestion, answer: EquivalenceAnswer): Verdict {
  const truth = solve(question)
  if (answer === truth) {
    return { correct: true, message: RELATIONSHIP_LABELS[truth], detail: evidence(question) }
  }
  return {
    correct: false,
    // A pure function of what was picked — sprint shows this before the retry.
    message: `Not “${RELATIONSHIP_LABELS[answer]}”`,
    detail: `It is ${RELATIONSHIP_LABELS[truth].toLowerCase()}. ${evidence(question)}`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Side({ label, formula }: { label: string; formula: Formula }) {
  const printed = format(formula)
  const scale = printed.length > 40 ? 'text-base' : printed.length > 26 ? 'text-lg' : 'text-xl'
  return (
    <div className="rounded-2xl bg-card-shade px-3 py-2">
      <p className="formula text-xs font-bold text-ink-soft">{label}</p>
      <p className={`leading-snug font-semibold text-balance ${scale}`}>
        <FormulaText formula={formula} />
      </p>
    </div>
  )
}

function Screen({ question, submit, locked, solution }: MinigameScreenProps<EquivalenceQuestion, EquivalenceAnswer>) {
  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        How do these relate?
      </p>

      <div className="mt-2 flex flex-col gap-2">
        <Side label="φ" formula={question.left} />
        <Side label="ψ" formula={question.right} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {RELATIONSHIPS.map((option) => {
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
              <span className="block text-base font-bold">{RELATIONSHIP_LABELS[option]}</span>
              <span className="block text-sm font-medium opacity-80">{RELATIONSHIP_HINTS[option]}</span>
            </Button>
          )
        })}
      </div>

      <p className="mt-3 text-xs font-medium text-ink-soft">
        Equivalence always implies satisfiability equivalence, never the reverse — so “equivalent” is
        the answer whenever the models match, even if the formulas look nothing alike.
      </p>
    </Card>
  )
}

export const equivalenceGame = defineMinigame<EquivalenceQuestion, EquivalenceAnswer>({
  id: 'equivalence',
  title: 'Same or Just Both?',
  tagline: 'Equivalent, satisfiability equivalent, or neither.',
  topics: ['equivalence'],
  icon: '⚖️',
  roundSeconds: 120,
  sprintQuestions: 10,
  // Three options and no advance until correct: the default five seconds would
  // make guessing cheaper than comparing the model sets.
  sprintPenaltySeconds: 12,
  generate,
  check,
  solve,
  Screen,
  Guide: EquivalenceGuide,
  questionKey: (question) => `${format(question.left)}|${format(question.right)}`,
})
