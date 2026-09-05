/**
 * The Lifting Lemma — ln.pdf §4.3, Theorem 4.30 and the discussion before it.
 *
 * A ground refutation and a first-order one are the same proof at two levels.
 * The lemma says: whatever two ground clauses resolve to, the general clauses
 * they instantiate resolve to something *more general* — the ground resolvent
 * is an instance of it.
 *
 * So the game shows a ground step and asks you to find the general one above
 * it. Getting it wrong is usually one of two things: picking the wrong pair of
 * general clauses, or picking a resolvent that happens to be ground-equal but
 * is not general enough to cover the step.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  applyToClause,
  foBinaryResolvents,
  foClausesEqual,
  match,
  parseFoClauseSet,
  showFoClause,
  showFoLiteral,
  showSubstitution,
  showTerm,
  type FoClause,
  type FoSignature,
  type Signature,
  type Substitution,
  type Term,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'
import { Pop, Shakeable, useShake } from '@/ui/motion'
import { LiftingGuide } from './lifting.guide'

export interface LiftingQuestion {
  predicates: Record<string, number>
  functions: Signature
  /** The general clauses on the board. */
  clauses: string[]
  /** Which two were instantiated, and how. */
  parents: [number, number]
  groundParents: [string, string]
  /** The ground resolvent of those two. */
  groundResolvent: string
}

/** The general resolvent the player produced, printed. */
export type LiftingAnswer = string | null

const signatureOf = (question: LiftingQuestion): FoSignature => ({
  predicates: question.predicates,
  functions: question.functions,
})

export const clausesOf = (question: LiftingQuestion): FoClause[] =>
  parseFoClauseSet(question.clauses, signatureOf(question))

export const parse = (question: LiftingQuestion, source: string): FoClause =>
  parseFoClauseSet([source], signatureOf(question))[0] as FoClause

/**
 * Is `specific` an instance of `general`?
 *
 * One substitution has to work for the whole clause at once, so the literals
 * are packed into a single term before matching — a per-literal match would
 * accept a "generalisation" whose variables disagree between literals.
 */
export function isInstanceOf(general: FoClause, specific: FoClause): boolean {
  if (general.length !== specific.length) return false
  const pack = (clause: FoClause): Term => ({
    kind: 'fn',
    name: '$clause',
    args: clause.map((literal) => ({
      kind: 'fn',
      name: `${literal.negated ? 'n' : 'p'}_${literal.predicate}`,
      args: literal.args,
    })),
  })
  const found = match(pack(general), pack(specific))
  return found !== null
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  predicates: Record<string, number>
  functions: Signature
  /** General clauses, and a grounding substitution per clause. */
  cases: {
    clauses: string[]
    parents: [number, number]
    sigma: [Record<string, string>, Record<string, string>]
  }[]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    predicates: { p: 1, q: 1 },
    functions: { a: 0, b: 0, f: 1 },
    cases: [
      {
        clauses: ['p(x) ∨ q(x)', '¬p(a())', 'q(b())'],
        parents: [0, 1],
        sigma: [{ x: 'a()' }, {}],
      },
      {
        clauses: ['¬p(x) ∨ q(x)', 'p(f(a()))', '¬q(b())'],
        parents: [0, 1],
        sigma: [{ x: 'f(a())' }, {}],
      },
    ],
  },
  medium: {
    predicates: { p: 2, q: 1 },
    functions: { a: 0, b: 0, f: 1 },
    cases: [
      {
        clauses: ['p(x,x) ∨ ¬q(x)', '¬p(a(),y)', 'q(b())'],
        parents: [0, 1],
        sigma: [{ x: 'a()' }, { y: 'a()' }],
      },
      {
        clauses: ['¬p(x,y) ∨ q(x)', 'p(a(),f(b()))', '¬q(a())'],
        parents: [0, 1],
        sigma: [{ x: 'a()', y: 'f(b())' }, {}],
      },
    ],
  },
  hard: {
    predicates: { p: 2, q: 1 },
    functions: { a: 0, b: 0, f: 2 },
    cases: [
      {
        clauses: ['p(x,x) ∨ ¬q(x)', '¬p(a(),y)', 'p(z,b()) ∨ q(f(z,z))'],
        parents: [0, 1],
        sigma: [{ x: 'a()' }, { y: 'a()' }],
      },
      {
        clauses: ['¬p(x,y) ∨ q(x)', 'p(a(),f(b(),b()))', '¬q(a()) ∨ p(b(),b())'],
        parents: [0, 1],
        sigma: [{ x: 'a()', y: 'f(b(),b())' }, {}],
      },
    ],
  },
}

function generate({ rng, difficulty }: GenerateContext): LiftingQuestion {
  const profile = PROFILES[difficulty]
  const signature: FoSignature = {
    predicates: profile.predicates,
    functions: profile.functions,
  }

  for (const entry of rng.shuffle(profile.cases)) {
    let clauses: FoClause[]
    try {
      clauses = parseFoClauseSet(entry.clauses, signature)
    } catch {
      continue
    }

    const ground = entry.parents.map((index, at) => {
      const sigma: Substitution = Object.fromEntries(
        Object.entries(entry.sigma[at] as Record<string, string>).map(([name, source]) => [
          name,
          parseFoClauseSet([`p(${source})`], { predicates: { p: 1 }, functions: signature.functions })[0]?.[0]
            ?.args[0] as Term,
        ]),
      )
      return applyToClause(sigma, clauses[index] as FoClause)
    }) as [FoClause, FoClause]

    const groundSteps = foBinaryResolvents(ground[0], ground[1])
    if (groundSteps.length === 0) continue
    const groundResolvent = (groundSteps[0] as { clause: FoClause }).clause

    // The lemma has to have something to say: a general resolvent must exist
    // that the ground one instantiates.
    const generalSteps = foBinaryResolvents(
      clauses[entry.parents[0]] as FoClause,
      clauses[entry.parents[1]] as FoClause,
    )
    if (!generalSteps.some((step) => isInstanceOf(step.clause, groundResolvent))) continue

    return {
      predicates: profile.predicates,
      functions: profile.functions,
      clauses: entry.clauses,
      parents: entry.parents,
      groundParents: [showFoClause(ground[0]), showFoClause(ground[1])],
      groundResolvent: showFoClause(groundResolvent),
    }
  }

  return {
    predicates: { p: 1, q: 1 },
    functions: { a: 0, b: 0, f: 1 },
    clauses: ['p(x) ∨ q(x)', '¬p(a())', 'q(b())'],
    parents: [0, 1],
    groundParents: ['p(a()) ∨ q(a())', '¬p(a())'],
    groundResolvent: 'q(a())',
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

function solve(question: LiftingQuestion): LiftingAnswer {
  const clauses = clausesOf(question)
  const ground = parse(question, question.groundResolvent)
  const steps = foBinaryResolvents(
    clauses[question.parents[0]] as FoClause,
    clauses[question.parents[1]] as FoClause,
  )
  const lifted = steps.find((step) => isInstanceOf(step.clause, ground))
  return lifted === undefined ? null : showFoClause(lifted.clause)
}

function check(question: LiftingQuestion, answer: LiftingAnswer): Verdict {
  if (answer === null) {
    return {
      correct: false,
      message: 'Nothing submitted',
      detail: 'Resolve two of the general clauses and pick the resolvent the ground one instantiates.',
    }
  }

  const ground = parse(question, question.groundResolvent)
  const claimed = parse(question, answer)

  if (!isInstanceOf(claimed, ground)) {
    return {
      correct: false,
      // Says the relation fails, never which clause is right.
      message: 'The ground clause is not an instance of that',
      detail:
        'One substitution has to turn the whole clause into the ground one at once — the same variable cannot become two different terms.',
      score: 0.2,
    }
  }

  const clauses = clausesOf(question)
  const legal = clauses.some((first) =>
    clauses.some((second) =>
      foBinaryResolvents(first, second).some((step) => foClausesEqual(step.clause, claimed)),
    ),
  )
  if (!legal) {
    return {
      correct: false,
      message: 'That is not a resolvent of two clauses here',
      detail: 'It has to be produced by the rule, not merely be more general than the ground step.',
    }
  }

  return {
    correct: true,
    message: 'Lifted',
    detail:
      'That is the Lifting Lemma: the ground step is an instance of a first-order step, so a ground refutation can always be replayed upstairs — which is where completeness comes from.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked }: MinigameScreenProps<LiftingQuestion, LiftingAnswer>) {
  const clauses = useMemo(() => clausesOf(question), [question])
  const [selected, setSelected] = useState<number | null>(null)
  const [options, setOptions] = useState<
    { clause: FoClause; sigma: Substitution; left: string; right: string }[] | null
  >(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [shaking, shake] = useShake()

  useEffect(() => {
    setSelected(null)
    setOptions(null)
    setChosen(null)
  }, [question])

  const pick = (index: number) => {
    if (locked) return
    if (selected === null) return setSelected(index)
    if (selected === index) return setSelected(null)
    const steps = foBinaryResolvents(clauses[selected] as FoClause, clauses[index] as FoClause)
    setSelected(null)
    if (steps.length === 0) return shake()
    setOptions(
      steps.map((step) => ({
        clause: step.clause,
        sigma: step.sigma,
        left: showFoLiteral(step.left),
        right: showFoLiteral(step.right),
      })),
    )
  }

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Lift the ground step
      </p>

      <div className="tile mt-2 flex flex-col gap-1 bg-card-shade px-3 py-2">
        <p className="text-[0.6rem] font-bold uppercase tracking-wider text-ink-soft">
          a ground resolution step
        </p>
        <p className="formula text-sm font-bold">{question.groundParents[0]}</p>
        <p className="formula text-sm font-bold">{question.groundParents[1]}</p>
        <p className="formula border-t-2 border-dashed border-ink-soft/40 pt-1 text-base font-bold">
          {question.groundResolvent === '□' ? '□' : question.groundResolvent}
        </p>
      </div>

      <p className="mt-3 text-xs font-medium text-ink-soft">
        Resolve two of these, and pick the resolvent the ground one is an instance of.
      </p>

      <Shakeable shaking={shaking}>
        <div className="mt-2 flex flex-col gap-1.5">
          {clauses.map((clause, index) => (
            <button
              key={index}
              type="button"
              disabled={locked}
              onClick={() => pick(index)}
              className={`tile flex w-full items-center px-3 py-2 text-left
                ${selected === index ? 'bg-space-blue text-white' : 'bg-card'}`}
            >
              <FoClauseText
                clause={clause}
                className={`text-base font-bold ${selected === index ? 'text-white' : ''}`}
              />
            </button>
          ))}
        </div>
      </Shakeable>

      {options !== null && !locked && (
        <Pop className="tile mt-2 bg-coin p-3">
          <p className="text-sm font-bold">Which resolvent?</p>
          <div className="mt-2 flex flex-col gap-1">
            {options.map((option, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  setChosen(showFoClause(option.clause))
                  setOptions(null)
                }}
                className="tile flex w-full flex-col items-start bg-card px-3 py-1.5 text-left hover:bg-card-shade
                  focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin"
              >
                <FoClauseText clause={option.clause} className="text-sm font-bold" />
                <span className="formula text-[0.6rem] font-bold uppercase tracking-wider text-ink-soft">
                  on {option.left} / {option.right} · {showSubstitution(option.sigma)}
                </span>
              </button>
            ))}
            <Button variant="ghost" onClick={() => setOptions(null)}>
              Cancel
            </Button>
          </div>
        </Pop>
      )}

      {chosen !== null && (
        <div className="tile mt-3 flex flex-col gap-1 bg-card-shade px-3 py-2">
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-ink-soft">
            your general resolvent
          </p>
          <p className="formula text-base font-bold">{chosen}</p>
          <p className="text-xs font-semibold text-ink-soft">
            {isInstanceOf(parse(question, chosen), parse(question, question.groundResolvent))
              ? 'The ground clause is an instance of it.'
              : 'The ground clause is not an instance of it.'}
          </p>
        </div>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            The step it lifts to
          </p>
          <p className="formula mt-1 font-bold">{solve(question) ?? '—'}</p>
          <p className="mt-1 text-ink-soft">
            Ground clauses {question.groundParents[0]} and {question.groundParents[1]} are instances
            of two of the clauses above, and their resolvent is an instance of this one.
          </p>
        </Pop>
      )}

      {!locked && (
        <Button variant="coin" className="mt-3 w-full" onClick={() => submit(chosen)}>
          {chosen === null ? 'Submit — nothing picked' : 'Submit'}
        </Button>
      )}
    </Card>
  )
}

export const liftingGame = defineMinigame<LiftingQuestion, LiftingAnswer>({
  id: 'lifting',
  title: 'Lift It',
  tagline: 'The ground proof is a shadow. Find the step it fell from.',
  topics: ['fo-resolution'],
  icon: '🪁',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: LiftingGuide,
  questionKey: (question) => `${question.clauses.join(';')}|${question.groundResolvent}`,
})

export const showGroundTerm = showTerm
