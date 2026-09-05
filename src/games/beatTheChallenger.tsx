/**
 * True in T(ℝ,=,+,*)? — ln.pdf §5.3, Exercise 12 question 1, exam26a Q4.1,
 * exam26bA Q4.1.
 *
 * Deciding whether a formula holds over the reals is what Tarski's theorem
 * makes possible, and the way to *see* it for a small formula is to play it.
 * Every ∃ is a move for you and every ∀ is a move for the challenger. If the
 * formula is true you can always win; if it is false, no play of yours can be
 * made to work, and the right answer is to say so rather than to keep trying.
 *
 * The challenger is not a token opponent: it searches the candidate values and
 * plays one that beats you whenever one exists. So winning is a proof of the
 * ∃ side, and losing every line is what makes the formula false.
 *
 * Truth is stored with each formula and the challenger's search reproduces it —
 * the tests assert that, because a finite candidate set is not a decision
 * procedure for the reals and must not be mistaken for one.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  CANDIDATES,
  bestChoice,
  evaluateReal,
  prefix,
  rand,
  rle,
  rlt,
  rnum,
  rplus,
  rsquare,
  rtimes,
  rx,
  rimplies,
  showReal,
  type RealFormula,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { MovingItem, MovingList, Pop } from '@/ui/motion'
import { BeatTheChallengerGuide } from './beatTheChallenger.guide'

export interface ChallengeQuestion {
  id: string
}

export interface ChallengeAnswer {
  /** 'true' means "I can always win"; 'false' means the formula fails. */
  claim: 'true' | 'false'
  /** The terms the player chose for their own quantifiers, in order. */
  moves: string[]
}

// ---------------------------------------------------------------------------
// The formulas
// ---------------------------------------------------------------------------

const X = rx('x')
const Y = rx('y')
const Z = rx('z')

interface Challenge {
  id: string
  formula: RealFormula
  /**
   * Whether it really holds over ℝ, decided by hand and cited.
   *
   * The candidate search has to agree with this — see the tests. It is here
   * rather than computed because a finite search over a finite set of
   * rationals cannot settle a statement about the reals.
   */
  truth: boolean
  why: string
  difficulty: Difficulty[]
}

export const CHALLENGES: readonly Challenge[] = [
  {
    // Exercise 12 Q1.3.
    id: 'forall-exists-square',
    formula: { kind: 'quantified', quantifier: 'forall', variable: 'x', body: { kind: 'quantified', quantifier: 'exists', variable: 'y', body: rle(rsquare(X), Y) } },
    truth: true,
    why: 'Whatever x is, y = x² works — there is always something at least as big.',
    difficulty: ['easy', 'medium'],
  },
  {
    // Exercise 12 Q1.1.
    id: 'exists-forall-square',
    formula: { kind: 'quantified', quantifier: 'exists', variable: 'x', body: { kind: 'quantified', quantifier: 'forall', variable: 'y', body: rle(rsquare(X), Y) } },
    truth: false,
    why: 'One x would have to satisfy x² ≤ y for every y, and there is no smallest real — take y = x² − 1.',
    difficulty: ['easy', 'medium', 'hard'],
  },
  {
    // Exercise 12 Q1.2.
    id: 'strict-cycle',
    formula: {
      kind: 'quantified',
      quantifier: 'exists',
      variable: 'x',
      body: {
        kind: 'quantified',
        quantifier: 'exists',
        variable: 'y',
        body: {
          kind: 'quantified',
          quantifier: 'exists',
          variable: 'z',
          body: rand(rand(rlt(X, Y), rlt(Y, Z)), rlt(Z, X)),
        },
      },
    },
    truth: false,
    why: '< is transitive and irreflexive, so x < y < z < x would give x < x.',
    difficulty: ['easy', 'medium'],
  },
  {
    // Exercise 12 Q1.4 — the same cycle with ≤, which collapses to x = y = z.
    id: 'weak-cycle',
    formula: {
      kind: 'quantified',
      quantifier: 'exists',
      variable: 'x',
      body: {
        kind: 'quantified',
        quantifier: 'exists',
        variable: 'y',
        body: {
          kind: 'quantified',
          quantifier: 'exists',
          variable: 'z',
          body: rand(rand(rle(X, Y), rle(Y, Z)), rle(Z, X)),
        },
      },
    },
    truth: true,
    why: 'Take x = y = z. A weak cycle only forces them equal, which is allowed.',
    difficulty: ['easy', 'medium'],
  },
  {
    // exam26a Q4.1 — x²≤y² does not give x≤y, because squaring loses the sign.
    id: 'squares-order',
    formula: {
      kind: 'quantified',
      quantifier: 'forall',
      variable: 'x',
      body: {
        kind: 'quantified',
        quantifier: 'forall',
        variable: 'y',
        body: rimplies(rle(rsquare(X), rsquare(Y)), rle(X, Y)),
      },
    },
    truth: false,
    why: 'x = 1, y = −2: 1 ≤ 4 but 1 ≤ −2 is false. Squaring throws the sign away.',
    difficulty: ['medium', 'hard'],
  },
  {
    // exam26bA Q4.1 — the unit square is not inside the unit disc.
    id: 'unit-square',
    formula: {
      kind: 'quantified',
      quantifier: 'forall',
      variable: 'x',
      body: {
        kind: 'quantified',
        quantifier: 'forall',
        variable: 'y',
        body: rimplies(
          rand(rle(X, rnum(1)), rle(Y, rnum(1))),
          rle(rplus(rsquare(X), rsquare(Y)), rnum(1)),
        ),
      },
    },
    truth: false,
    why: 'x = y = −3 satisfies both premises and gives 18, and even x = y = 1 gives 2.',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'between',
    formula: {
      kind: 'quantified',
      quantifier: 'forall',
      variable: 'x',
      body: {
        kind: 'quantified',
        quantifier: 'exists',
        variable: 'y',
        body: rand(rle(X, Y), rle(Y, rplus(X, rnum(1)))),
      },
    },
    truth: true,
    why: 'y = x always works. The reals have no gaps to fall into.',
    difficulty: ['easy'],
  },
  {
    id: 'product-bound',
    formula: {
      kind: 'quantified',
      quantifier: 'exists',
      variable: 'x',
      body: {
        kind: 'quantified',
        quantifier: 'forall',
        variable: 'y',
        body: rle(rtimes(X, Y), rplus(rsquare(Y), rnum(1))),
      },
    },
    truth: true,
    why: 'x = 0 makes the left side 0, and y² + 1 is always at least 1.',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'exists-below-all',
    formula: {
      kind: 'quantified',
      quantifier: 'exists',
      variable: 'x',
      body: { kind: 'quantified', quantifier: 'forall', variable: 'y', body: rle(X, Y) },
    },
    truth: false,
    why: 'That would be a least real number, and there is none — y = x − 1 beats every candidate.',
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'square-nonneg',
    formula: {
      kind: 'quantified',
      quantifier: 'forall',
      variable: 'x',
      body: rle(rnum(0), rsquare(X)),
    },
    truth: true,
    why: 'A square of a real is never negative — the fact that makes ℝ an ordered field.',
    difficulty: ['easy'],
  },
  {
    id: 'exists-root',
    formula: {
      kind: 'quantified',
      quantifier: 'exists',
      variable: 'x',
      body: rle(rsquare(X), rnum(0)),
    },
    truth: true,
    why: 'x = 0, and only x = 0.',
    difficulty: ['easy'],
  },
  {
    id: 'sum-of-squares',
    formula: {
      kind: 'quantified',
      quantifier: 'exists',
      variable: 'x',
      body: {
        kind: 'quantified',
        quantifier: 'exists',
        variable: 'y',
        body: rand(rlt(rplus(rsquare(X), rsquare(Y)), rnum(1)), rlt(rnum(0), rtimes(X, Y))),
      },
    },
    truth: true,
    why: 'x = y = 1/2: the sum of squares is 1/2 and the product is positive.',
    difficulty: ['medium', 'hard'],
  },
]

export const challengeOf = (question: ChallengeQuestion): Challenge =>
  CHALLENGES.find((challenge) => challenge.id === question.id) ?? (CHALLENGES[0] as Challenge)

export const formulaOf = (question: ChallengeQuestion): RealFormula =>
  challengeOf(question).formula

/**
 * What the player may answer with.
 *
 * Not a number but a *term*, possibly mentioning the variables the challenger
 * has already played. That is the whole content of quantifier alternation: in
 * ∀x∃y the y is allowed to depend on x, and picking `y = x²` rather than a
 * constant is exactly the Skolem function of Chapter 4, chosen by hand.
 */
export interface Move {
  label: string
  value: (env: Readonly<Record<string, number>>) => number
}

const CONSTANTS: readonly number[] = [-2, -1, -0.5, 0, 0.5, 1, 2]

/** The moves available once `bound` variables have values. */
export function movesAvailable(bound: readonly string[]): Move[] {
  const moves: Move[] = CONSTANTS.map((value) => ({ label: String(value), value: () => value }))
  for (const name of bound) {
    moves.push({ label: name, value: (env) => env[name] as number })
    moves.push({ label: `-${name}`, value: (env) => -(env[name] as number) })
    moves.push({ label: `${name}^2`, value: (env) => (env[name] as number) ** 2 })
    moves.push({ label: `${name}+1`, value: (env) => (env[name] as number) + 1 })
    moves.push({ label: `${name}-1`, value: (env) => (env[name] as number) - 1 })
  }
  return moves
}

const resolve = (label: string, bound: readonly string[]): Move | undefined =>
  movesAvailable(bound).find((move) => move.label === label)

/**
 * Play the formula out: the player's terms against the challenger's replies.
 *
 * The challenger plays the value that makes the rest false whenever the
 * candidate set contains one, so a line that survives is a line that survived
 * a real attempt to break it.
 */
export function play(
  question: ChallengeQuestion,
  moves: readonly string[],
): {
  env: Record<string, number>
  history: { variable: string; label: string; value: number; mine: boolean }[]
  pending: { quantifier: 'forall' | 'exists'; variable: string } | null
  won: boolean | null
} {
  const { quantifiers, matrix } = prefix(formulaOf(question))
  const env: Record<string, number> = {}
  const history: { variable: string; label: string; value: number; mine: boolean }[] = []
  const bound: string[] = []
  let taken = 0

  for (let index = 0; index < quantifiers.length; index++) {
    const step = quantifiers[index] as { quantifier: 'forall' | 'exists'; variable: string }
    if (step.quantifier === 'exists') {
      const label = moves[taken]
      taken += 1
      if (label === undefined) return { env, history, pending: step, won: null }
      const move = resolve(label, bound)
      if (move === undefined) return { env, history, pending: step, won: null }
      const value = move.value(env)
      env[step.variable] = value
      history.push({ variable: step.variable, label, value, mine: true })
    } else {
      const remaining = rebuild(quantifiers, matrix, index)
      const reply =
        remaining.kind === 'quantified' ? bestChoice(remaining, env) : null
      const value = reply ?? (CANDIDATES[0] as number)
      env[step.variable] = value
      history.push({ variable: step.variable, label: String(value), value, mine: false })
    }
    bound.push(step.variable)
  }

  return { env, history, pending: null, won: evaluateReal(matrix, env) }
}

/** The formula from a given quantifier onwards. */
function rebuild(
  quantifiers: readonly { quantifier: 'forall' | 'exists'; variable: string }[],
  matrix: RealFormula,
  from: number,
): RealFormula {
  let current = matrix
  for (let index = quantifiers.length - 1; index >= from; index--) {
    const step = quantifiers[index] as { quantifier: 'forall' | 'exists'; variable: string }
    current = { kind: 'quantified', quantifier: step.quantifier, variable: step.variable, body: current }
  }
  return current
}

/**
 * Does this play beat *every* reply, not just the one the challenger made?
 *
 * This is what marking has to ask. The screen shows a single adversarial line
 * because that is what a game looks like, but an ∃ claim is only good if it
 * survives all of them, so the check runs every combination of replies.
 */
export function winsEverywhere(question: ChallengeQuestion, moves: readonly string[]): boolean {
  const { quantifiers, matrix } = prefix(formulaOf(question))

  const walk = (index: number, env: Record<string, number>, taken: number, bound: string[]): boolean => {
    if (index === quantifiers.length) return evaluateReal(matrix, env)
    const step = quantifiers[index] as { quantifier: 'forall' | 'exists'; variable: string }
    if (step.quantifier === 'exists') {
      const label = moves[taken]
      if (label === undefined) return false
      const move = resolve(label, bound)
      if (move === undefined) return false
      return walk(index + 1, { ...env, [step.variable]: move.value(env) }, taken + 1, [
        ...bound,
        step.variable,
      ])
    }
    return CANDIDATES.every((value) =>
      walk(index + 1, { ...env, [step.variable]: value }, taken, [...bound, step.variable]),
    )
  }

  return walk(0, {}, 0, [])
}

/** How many moves the player has to make. */
export const myMoves = (question: ChallengeQuestion): number =>
  prefix(formulaOf(question)).quantifiers.filter((step) => step.quantifier === 'exists').length

/** The variables already played when it is the player's turn again. */
export function boundBefore(question: ChallengeQuestion, madeSoFar: number): string[] {
  const { quantifiers } = prefix(formulaOf(question))
  const bound: string[] = []
  let taken = 0
  for (const step of quantifiers) {
    if (step.quantifier === 'exists') {
      if (taken === madeSoFar) return bound
      taken += 1
    }
    bound.push(step.variable)
  }
  return bound
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function generate({ rng, difficulty }: GenerateContext): ChallengeQuestion {
  const pool = CHALLENGES.filter((challenge) => challenge.difficulty.includes(difficulty))
  const usable = pool.length > 0 ? pool : CHALLENGES
  return { id: rng.pick([...usable]).id }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

/** A choice of terms that beats every reply, when the formula is true. */
export function winningMoves(question: ChallengeQuestion): string[] {
  const needed = myMoves(question)
  const search = (moves: string[]): string[] | null => {
    if (moves.length === needed) return winsEverywhere(question, moves) ? moves : null
    for (const move of movesAvailable(boundBefore(question, moves.length))) {
      const found = search([...moves, move.label])
      if (found !== null) return found
    }
    return null
  }
  return search([]) ?? Array.from({ length: needed }, () => '0')
}

function solve(question: ChallengeQuestion): ChallengeAnswer {
  const challenge = challengeOf(question)
  return challenge.truth
    ? { claim: 'true', moves: winningMoves(question) }
    : { claim: 'false', moves: [] }
}

function check(question: ChallengeQuestion, answer: ChallengeAnswer): Verdict {
  const challenge = challengeOf(question)

  if (answer.claim === 'false') {
    return challenge.truth
      ? {
          correct: false,
          // Never says which value wins.
          message: 'There is a play that survives every reply',
          score: 0,
          detail: 'Try the values at the edges and at 0 — a winning move often sits at one of them.',
        }
      : {
          correct: true,
          message: 'False, and nothing you could have played would have helped',
          detail: challenge.why,
        }
  }

  if (!challenge.truth) {
    return {
      correct: false,
      message: 'The challenger answered that',
      score: 0,
      detail: 'A single line that loses is not proof on its own — but here every line does.',
    }
  }

  if (winsEverywhere(question, answer.moves)) {
    return {
      correct: true,
      message: 'You beat every reply',
      detail: challenge.why,
    }
  }


  return {
    correct: false,
    // The losing line is on screen; naming a winning one is the answer.
    message: 'The challenger found a reply that beats that',
    score: 0.25,
    detail:
      'Pick your value so that it works against every possible reply, not just the likely one — that is what the ∃ has to mean.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<ChallengeQuestion, ChallengeAnswer>) {
  const formula = formulaOf(question)
  const needed = useMemo(() => myMoves(question), [question])
  const [moves, setMoves] = useState<string[]>([])

  useEffect(() => setMoves([]), [question])

  const outcome = useMemo(() => play(question, moves), [question, moves])
  const options = useMemo(
    () => movesAvailable(boundBefore(question, moves.length)),
    [question, moves.length],
  )
  const done = moves.length === needed

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Is it true over the reals?
      </p>

      <div className="mt-2 overflow-x-auto rounded-2xl bg-card-shade px-3 py-2 text-center">
        <span className="font-logic text-lg font-bold">{showReal(formula)}</span>
      </div>
      <p className="mt-1 text-center text-xs font-medium text-ink-soft">
        Every ∃ is your move. Every ∀ is the challenger&apos;s, and it plays to beat you.
      </p>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">The play</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {outcome.history.length === 0 && (
          <span className="rounded-xl bg-card-shade px-3 py-1.5 text-sm font-semibold text-ink-soft">
            Nothing played yet.
          </span>
        )}
        {outcome.history.map((step, index) => (
          <span
            key={index}
            className={`tile px-2.5 py-1 font-logic text-sm font-bold ${
              step.mine ? 'bg-grass text-white' : 'bg-space-red text-white'
            }`}
          >
            {step.mine ? 'you' : 'they'}: {step.variable} = {step.label}
            {step.mine && step.label !== String(step.value) ? ` = ${step.value}` : ''}
          </span>
        ))}
      </div>

      {done && (
        <p
          className={`mt-2 rounded-2xl px-3 py-2 text-center text-sm font-bold ${
            outcome.won ? 'bg-grass/25' : 'bg-space-red/20'
          }`}
        >
          {outcome.won ? 'This line holds up.' : 'This line fails.'}
        </p>
      )}

      {!locked && (
        <>
          {outcome.pending !== null && (
            <>
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
                Your move — choose {outcome.pending.variable}, and it may depend on what they played
              </p>
              <MovingList className="mt-1 flex flex-wrap gap-1.5">
                {options.map((move) => (
                  <MovingItem
                    key={move.label}
                    id={move.label}
                    onClick={() => setMoves((previous) => [...previous, move.label])}
                    className="tile bg-card px-2.5 py-1 font-logic text-sm font-bold tabular-nums"
                  >
                    {outcome.pending?.variable} = {move.label}
                  </MovingItem>
                ))}
              </MovingList>
            </>
          )}

          {moves.length > 0 && (
            <Button
              variant="secondary"
              className="mt-2 w-full"
              onClick={() => setMoves((previous) => previous.slice(0, -1))}
            >
              Take that back
            </Button>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant={done && outcome.won === true ? 'coin' : 'secondary'}
              disabled={!done}
              onClick={() => submit({ claim: 'true', moves })}
            >
              True — this play wins
            </Button>
            <Button variant="secondary" onClick={() => submit({ claim: 'false', moves: [] })}>
              False — nothing wins
            </Button>
          </div>
        </>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium text-ink-soft">
          {challengeOf(question).truth ? 'True over ℝ. ' : 'False over ℝ. '}
          {challengeOf(question).why}
        </Pop>
      )}
    </Card>
  )
}

export const beatTheChallengerGame = defineMinigame<ChallengeQuestion, ChallengeAnswer>({
  id: 'real-checkbox',
  title: 'Beat The Challenger',
  tagline: 'Play the ∃ moves against an opponent that plays every ∀ to beat you.',
  topics: ['arithmetic-theories'],
  icon: '⚔️',
  roundSeconds: 180,
  sprintQuestions: 6,
  // True or false is one bit, and the play is short — a guess must cost more
  // than working the line out.
  sprintPenaltySeconds: 8,
  generate,
  check,
  solve,
  questionKey: (question) => question.id,
  explain: (question) => {
    const challenge = challengeOf(question)
    return `${challenge.truth ? 'True' : 'False'} in T(ℝ,=,+,*). ${challenge.why}`
  },
  Screen,
  Guide: BeatTheChallengerGuide,
})
