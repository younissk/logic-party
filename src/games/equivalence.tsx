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

import { useEffect, useState } from 'react'
import type { Assignment, Formula } from '@/logic'
import {
  and,
  eliminateImplications,
  evaluate,
  findModel,
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
import { Pop } from '@/ui/motion'
import { WitnessHunt, type Banked } from '@/ui/WitnessHunt'
import { EquivalenceGuide } from './equivalence.guide'

export type Relationship = 'equivalent' | 'sat-equivalent' | 'neither'

export const RELATIONSHIPS: readonly Relationship[] = ['equivalent', 'sat-equivalent', 'neither']

export const RELATIONSHIP_LABELS: Readonly<Record<Relationship, string>> = {
  equivalent: 'Equivalent',
  'sat-equivalent': 'Satisfiability equivalent only',
  neither: 'Neither',
}


export interface EquivalenceQuestion {
  left: Formula
  right: Formula
}

/**
 * The evidence again, not the label.
 *
 * All three relationships are settled by three questions, each answered by a
 * row or by the claim that no row answers it: does φ have a model, does ψ,
 * and is there a row where they disagree. Picking "satisfiability equivalent
 * only" off a list never makes you produce the row that separates them.
 */
export interface EquivalenceAnswer {
  /** A row satisfying φ, or null for "φ has none". */
  leftModel: Assignment | null
  /** A row satisfying ψ, or null. */
  rightModel: Assignment | null
  /** A row where they differ, or null for "nothing separates them". */
  separator: Assignment | null
}

/** What a completed hunt says the pair are. */
export function relationshipFromWitnesses(answer: EquivalenceAnswer): Relationship {
  if (answer.separator === null) return 'equivalent'
  return (answer.leftModel === null) === (answer.rightModel === null) ? 'sat-equivalent' : 'neither'
}

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

const solve = (question: EquivalenceQuestion): EquivalenceAnswer => ({
  leftModel: findModel(question.left),
  rightModel: findModel(question.right),
  separator: findDistinguishingAssignment(question.left, question.right),
})

/** The evidence, in the terms the definitions are stated in. */
export function evidence(question: EquivalenceQuestion): string {
  const { left, right } = question
  const truth = classifyPair(left, right)
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
  const problems: string[] = []
  let right = 0

  const checkModel = (slot: 'leftModel' | 'rightModel', formula: Formula, label: string) => {
    const banked = answer[slot]
    if (banked !== null) {
      if (evaluate(formula, banked)) right++
      else problems.push(`${showAssignment(banked)} does not satisfy ${label}.`)
      return
    }
    const real = findModel(formula)
    if (real === null) right++
    else problems.push(`${label} does have a model: ${showAssignment(real)}.`)
  }

  checkModel('leftModel', question.left, 'φ')
  checkModel('rightModel', question.right, 'ψ')

  const separator = answer.separator
  if (separator !== null) {
    if (evaluate(question.left, separator) !== evaluate(question.right, separator)) right++
    else problems.push(`${showAssignment(separator)} gives both the same value, so it separates nothing.`)
  } else {
    const real = findDistinguishingAssignment(question.left, question.right)
    if (real === null) right++
    else problems.push(`${showAssignment(real)} does separate them.`)
  }

  if (problems.length > 0) {
    return {
      correct: false,
      score: right / 3,
      message: problems.length === 1 ? 'One claim does not hold' : `${problems.length} claims do not hold`,
      detail: problems.join(' '),
    }
  }

  return {
    correct: true,
    message: RELATIONSHIP_LABELS[classifyPair(question.left, question.right)],
    detail: evidence(question),
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------


function Screen({ question, submit, locked, solution }: MinigameScreenProps<EquivalenceQuestion, EquivalenceAnswer>) {
  const [banked, setBanked] = useState<Banked>({})

  useEffect(() => {
    setBanked({})
  }, [question])

  const answer: EquivalenceAnswer = {
    leftModel: banked.leftModel ?? null,
    rightModel: banked.rightModel ?? null,
    separator: banked.separator ?? null,
  }
  const settled =
    banked.leftModel !== undefined && banked.rightModel !== undefined && banked.separator !== undefined

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Three questions, three rows
      </p>
      <p className="mt-1 mb-2 text-xs font-medium text-ink-soft">
        Does each have a model, and is there a row where they disagree? The relationship follows
        from the answers — you never have to name it.
      </p>

      <WitnessHunt
        locked={locked}
        formulas={[
          { label: 'φ', formula: question.left },
          { label: 'ψ', formula: question.right },
        ]}
        banked={banked}
        onBank={(id, assignment) => setBanked((previous) => ({ ...previous, [id]: assignment }))}
        goals={[
          {
            id: 'leftModel',
            label: 'A row satisfying φ',
            noneLabel: 'φ has none',
            test: (assignment) => evaluate(question.left, assignment),
          },
          {
            id: 'rightModel',
            label: 'A row satisfying ψ',
            noneLabel: 'ψ has none',
            test: (assignment) => evaluate(question.right, assignment),
          },
          {
            id: 'separator',
            label: 'A row where they disagree',
            noneLabel: 'Nothing separates them',
            test: (assignment) =>
              evaluate(question.left, assignment) !== evaluate(question.right, assignment),
          },
        ]}
        footer={
          <>
            {!locked && (
              <Button
                variant="coin"
                className="mt-3 w-full"
                disabled={!settled}
                onClick={() => submit(answer)}
              >
                {settled
                  ? `Submit — ${RELATIONSHIP_LABELS[relationshipFromWitnesses(answer)].toLowerCase()}`
                  : 'Settle all three first'}
              </Button>
            )}

            {locked && (
              <Pop className="mt-3 rounded-2xl bg-card-shade p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                  What that makes them
                </p>
                <p className="mt-1 text-base font-bold">
                  {RELATIONSHIP_LABELS[relationshipFromWitnesses(solution ?? answer)]}
                </p>
                <p className="mt-1 text-xs font-medium text-ink-soft">
                  No separator means the model sets are identical, which is equivalence — and two
                  formulas with no models at all have identical model sets too.
                </p>
              </Pop>
            )}
          </>
        }
      />
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
  generate,
  check,
  solve,
  Screen,
  Guide: EquivalenceGuide,
  questionKey: (question) => `${format(question.left)}|${format(question.right)}`,
})
