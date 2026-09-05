/**
 * Unification — ln.pdf §3.2, Algorithm 3.13, on all three exam papers.
 *
 * The same walk as matching, with two differences that make it a different
 * question. Both terms may be instantiated, so a variable on *either* side of
 * the mismatch is a move. And there are two ways to fail rather than one: a
 * clash of function symbols, which no substitution repairs, and the occurs
 * check — binding x to a term containing x only moves the mismatch one symbol
 * along, forever.
 *
 * The exam asks for "a most general unifier, or a proof that these terms are
 * not unifiable", so naming *which* failure is part of the answer.
 */

import { useEffect, useState } from 'react'
import {
  applySubstitution,
  parseTerm,
  showTerm,
  termSize,
  termsEqual,
  unify,
  variable,
  type Rng,
  type Signature,
  type Term,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button } from '@/ui/primitives'
import { TermText } from '@/ui/TermText'
import { MguGuide } from './mgu.guide'
import { firstMismatch, legalMoves, replay, startState, type Move } from './unifyDriver'
import { OutcomeLine, UnifyBoard } from './unifyScreen'

export interface MguQuestion {
  signature: Signature
  left: string
  right: string
  /** What Algorithm 3.13 ends in. */
  outcome: 'unified' | 'clash' | 'occurs'
}

export type MguAnswer = Move[]

const parse = (question: MguQuestion) => ({
  left: parseTerm(question.left, question.signature),
  right: parseTerm(question.right, question.signature),
})

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  symbols: [name: string, arity: number][]
  leftVars: string[]
  rightVars: string[]
  size: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    symbols: [
      ['f', 2],
      ['g', 1],
    ],
    leftVars: ['x', 'y'],
    rightVars: ['z'],
    size: [3, 5],
  },
  medium: {
    symbols: [
      ['f', 2],
      ['g', 2],
      ['h', 1],
    ],
    leftVars: ['x', 'y'],
    rightVars: ['z', 'w'],
    size: [5, 8],
  },
  hard: {
    symbols: [
      ['f', 2],
      ['g', 2],
      ['h', 1],
    ],
    leftVars: ['x', 'y', 'z'],
    rightVars: ['u', 'v', 'w'],
    size: [8, 12],
  },
}

function randomTerm(rng: Rng, profile: Profile, variables: string[], budget: number): Term {
  const usable = profile.symbols.filter(([, arity]) => arity + 1 <= budget)
  if (budget <= 1 || usable.length === 0) return variable(rng.pick(variables))
  const [name, arity] = rng.pick(usable)
  const args: Term[] = []
  let left = budget - 1
  for (let index = 0; index < arity; index++) {
    const share = Math.max(1, Math.floor(left / (arity - index)))
    const arg = randomTerm(rng, profile, variables, rng.range(1, share))
    args.push(arg)
    left -= termSize(arg)
  }
  return { kind: 'fn', name, args }
}

function generate({ rng, difficulty }: GenerateContext): MguQuestion {
  const profile = PROFILES[difficulty]
  const signature: Signature = Object.fromEntries(profile.symbols)
  // Draw the ending first. Without this the occurs check almost never comes
  // up, and it is half of what the exam is asking about.
  const wanted = rng.pick(['unified', 'clash', 'occurs'] as const)

  for (let attempt = 0; attempt < 500; attempt++) {
    // Share the variable pool sometimes, which is what makes an occurs check
    // possible at all.
    const shared = wanted === 'occurs' || rng.bool(0.4)
    const rightPool = shared ? profile.leftVars : profile.rightVars
    const left = randomTerm(rng, profile, profile.leftVars, rng.range(...profile.size))
    const right = randomTerm(rng, profile, rightPool, rng.range(...profile.size))
    if (left.kind === 'var' || right.kind === 'var') continue
    if (termsEqual(left, right)) continue
    if (left.name !== right.name) continue

    const result = unify(left, right)
    const outcome = result.unified ? 'unified' : result.failure.reason
    if (outcome !== wanted) continue

    // At least two steps, or the question is answered by looking at it.
    const reference = solveFrom(left, right)
    if (reference.length < 2) continue

    return { signature, left: showTerm(left), right: showTerm(right), outcome }
  }

  // Last resort, so a round can never stall: Example 3.15.1.
  const fallback: Signature = { f: 1, g: 2 }
  return {
    signature: fallback,
    left: 'g(x,f(f(y)))',
    right: 'g(g(z,y),f(z))',
    outcome: 'unified',
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

/** The moves Algorithm 3.13 takes, preferring the left side where both work. */
function solveFrom(left: Term, right: Term): Move[] {
  const moves: Move[] = []
  let state = startState(left, right)
  for (let guard = 0; guard < 40 && state.outcome === 'running'; guard++) {
    const options = legalMoves('unify', state)
    const next = options[0]
    if (next === undefined) break
    moves.push(next)
    state = replay('unify', left, right, moves)
    if (state.illegal !== null) break
  }
  return moves
}

const solve = (question: MguQuestion): MguAnswer => {
  const { left, right } = parse(question)
  return solveFrom(left, right)
}

function check(question: MguQuestion, answer: MguAnswer): Verdict {
  const { left, right } = parse(question)
  const state = replay('unify', left, right, answer)

  if (state.illegal !== null) {
    return {
      correct: false,
      message: 'That move was not available',
      detail:
        'Every step happens at the first mismatch, and only where a variable is standing — or is one of the two ways to stop.',
    }
  }

  if (state.outcome === 'running') {
    return {
      correct: false,
      message: 'Not finished',
      detail: 'Carry on until the two terms are identical, or until neither side can be moved.',
      score: 0.3,
    }
  }

  if (state.outcome !== question.outcome) {
    return {
      correct: false,
      // Names what was claimed, not what is true.
      message: WRONG_ENDING[state.outcome],
      detail:
        'A clash is two different function symbols meeting. The occurs check is a variable meeting a term that contains it. Anything else is still a live mismatch.',
    }
  }

  const result = unify(left, right)
  if (state.outcome === 'unified' && result.unified) {
    return {
      correct: true,
      message: 'Unified',
      detail: `Both terms became ${showTerm(applySubstitution(result.mgu, left))}, and this is a most general unifier.`,
    }
  }

  return {
    correct: true,
    message: state.outcome === 'clash' ? 'No unifier — a clash' : 'No unifier — the occurs check',
    detail:
      state.outcome === 'clash'
        ? 'Two different function symbols at the same position, and no substitution can change a function symbol.'
        : 'Binding a variable to a term containing it only pushes the mismatch one symbol along; repeating it never terminates.',
  }
}

const WRONG_ENDING: Record<'unified' | 'clash' | 'occurs', string> = {
  unified: 'They do not unify',
  clash: 'That is not a clash',
  occurs: 'The occurs check does not fire here',
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked }: MinigameScreenProps<MguQuestion, MguAnswer>) {
  const { left, right } = parse(question)
  const [moves, setMoves] = useState<Move[]>([])

  useEffect(() => {
    setMoves([])
  }, [question])

  const state = replay('unify', left, right, moves)
  const done = state.outcome !== 'running'
  const at = firstMismatch(state.left, state.right)

  return (
    <UnifyBoard
      mode="unify"
      state={state}
      locked={locked}
      onMove={(move) => setMoves((previous) => [...previous, move])}
      title="Unify them, or show why you cannot"
      footer={
        locked ? null : (
          <div className="mt-3 flex flex-col gap-2">
            {state.outcome === 'running' && at !== null && legalMoves('unify', state).length === 0 && (
              <p className="rounded-xl bg-card-shade px-3 py-2 text-xs font-semibold text-ink-soft">
                Nothing is legal here, which is itself the answer.
              </p>
            )}
            {moves.length > 0 && (
              <Button variant="ghost" onClick={() => setMoves((previous) => previous.slice(0, -1))}>
                ← Undo
              </Button>
            )}
            <Button variant={done ? 'coin' : 'secondary'} onClick={() => submit(moves)}>
              {done ? ENDING_LABEL[state.outcome] : 'Submit — not finished'}
            </Button>
          </div>
        )
      }
      reveal={
        <>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            {question.outcome === 'unified' ? 'A most general unifier' : 'Why there is none'}
          </p>
          <div className="mt-1">
            <OutcomeLine
              outcome={question.outcome}
              sigma={(() => {
                const result = unify(left, right)
                return result.unified ? result.mgu : {}
              })()}
            />
          </div>
          <p className="mt-2 flex flex-wrap items-baseline gap-2 text-sm font-medium text-ink-soft">
            t₁ = <TermText term={left} className="font-bold" /> · t₂ ={' '}
            <TermText term={right} className="font-bold" />
          </p>
        </>
      }
    />
  )
}

const ENDING_LABEL: Record<'unified' | 'clash' | 'occurs' | 'running', string> = {
  unified: 'Submit — unified',
  clash: 'Submit — no unifier, a clash',
  occurs: 'Submit — no unifier, occurs check',
  running: 'Submit — not finished',
}

export const mguGame = defineMinigame<MguQuestion, MguAnswer>({
  id: 'mgu',
  title: 'Unify It',
  tagline: 'Both sides may move. Two ways to fail, and you have to name which.',
  topics: ['unification'],
  icon: '🪢',
  roundSeconds: 180,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  Screen,
  Guide: MguGuide,
  questionKey: (question) => `${question.left}|${question.right}`,
})
