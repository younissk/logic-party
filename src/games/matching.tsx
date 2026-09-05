/**
 * Matching — ln.pdf §3.2, Algorithm 3.8, exam25a Q2.1.
 *
 * Deciding t₁ ≤ t₂ ("t₁ is more general than t₂") means finding a σ with
 * σ(t₁) = t₂. Only the pattern's variables may move; the target is fixed. That
 * asymmetry is the whole algorithm and the whole difficulty: a variable on the
 * *right* at the mismatch is not an opportunity, it is a dead end.
 *
 * You run it, one mismatch at a time. The bindings are forced, so what is
 * being tested is whether you can tell a live mismatch from a fatal one.
 */

import { useEffect, useState } from 'react'
import {
  applySubstitution,
  match,
  moreGeneral,
  parseTerm,
  showTerm,
  termSize,
  termsEqual,
  variable,
  type Rng,
  type Signature,
  type Term,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button } from '@/ui/primitives'
import { TermText } from '@/ui/TermText'
import { MatchingGuide } from './matching.guide'
import { legalMoves, replay, startState, type Move } from './unifyDriver'
import { OutcomeLine, UnifyBoard } from './unifyScreen'

export interface MatchingQuestion {
  signature: Signature
  pattern: string
  target: string
  /** True when a σ with σ(pattern) = target exists. */
  matches: boolean
}

/** The moves taken, in order. */
export type MatchingAnswer = Move[]

const parse = (question: MatchingQuestion) => ({
  pattern: parseTerm(question.pattern, question.signature),
  target: parseTerm(question.target, question.signature),
})

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  symbols: [name: string, arity: number][]
  patternVars: string[]
  targetVars: string[]
  size: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    symbols: [
      ['f', 2],
      ['g', 1],
    ],
    patternVars: ['x', 'y'],
    targetVars: ['u', 'v'],
    size: [3, 5],
  },
  medium: {
    symbols: [
      ['f', 2],
      ['g', 2],
      ['h', 1],
    ],
    patternVars: ['x', 'y'],
    targetVars: ['u', 'v'],
    size: [5, 8],
  },
  hard: {
    symbols: [
      ['f', 2],
      ['g', 2],
      ['h', 1],
    ],
    patternVars: ['x', 'y', 'z'],
    targetVars: ['u', 'v', 'w'],
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

function generate({ rng, difficulty }: GenerateContext): MatchingQuestion {
  const profile = PROFILES[difficulty]
  const signature: Signature = Object.fromEntries(profile.symbols)
  // Draw the verdict first, so "no such σ" is a live answer rather than a
  // theoretical one.
  const wanted = rng.bool()

  for (let attempt = 0; attempt < 400; attempt++) {
    const pattern = randomTerm(rng, profile, profile.patternVars, rng.range(...profile.size))
    if (pattern.kind === 'var') continue

    let target: Term
    if (wanted) {
      // Instantiate the pattern, so a σ certainly exists.
      const sigma = Object.fromEntries(
        profile.patternVars.map((name) => [
          name,
          randomTerm(rng, profile, profile.targetVars, rng.range(1, 3)),
        ]),
      )
      target = applySubstitution(sigma, pattern)
    } else {
      target = randomTerm(rng, profile, profile.targetVars, rng.range(...profile.size))
    }

    if (termsEqual(pattern, target)) continue
    const matches = moreGeneral(pattern, target)
    if (matches !== wanted) continue
    // A question decided at the very first symbol is not a question.
    const root = pattern.kind === 'fn' && target.kind === 'fn' && pattern.name === target.name
    if (!root) continue

    return { signature, pattern: showTerm(pattern), target: showTerm(target), matches }
  }

  // Last resort, so a round can never stall: Example 3.9.1.
  const fallback: Signature = { f: 2, g: 2, h: 1 }
  return {
    signature: fallback,
    pattern: 'f(x,g(y,x))',
    target: 'f(h(u),g(v,h(u)))',
    matches: true,
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

/** The moves the algorithm itself would take. */
function solve(question: MatchingQuestion): MatchingAnswer {
  const { pattern, target } = parse(question)
  const moves: Move[] = []
  let state = startState(pattern, target)
  for (let guard = 0; guard < 40 && state.outcome === 'running'; guard++) {
    const next = legal(state)
    if (next === null) break
    moves.push(next)
    state = replay('match', pattern, target, moves)
    if (state.illegal !== null) break
  }
  return moves
}

/**
 * The one move Algorithm 3.8 allows here, or null when it is finished.
 *
 * Read off the driver so there is a single definition of what is legal — the
 * game's buttons and its reference answer cannot disagree.
 */
function legal(state: ReturnType<typeof startState>): Move | null {
  return legalMoves('match', state)[0] ?? null
}

function check(question: MatchingQuestion, answer: MatchingAnswer): Verdict {
  const { pattern, target } = parse(question)
  const state = replay('match', pattern, target, answer)

  if (state.illegal !== null) {
    return {
      correct: false,
      message: 'That move was not available',
      detail: 'Matching may only instantiate the pattern, and only at the first mismatch.',
    }
  }

  if (state.outcome === 'running') {
    return {
      correct: false,
      message: 'Not finished',
      detail: 'Keep going until the two terms agree, or until the mismatch cannot be repaired.',
      score: 0.3,
    }
  }

  const claimedMatch = state.outcome === 'unified'
  if (claimedMatch !== question.matches) {
    return {
      correct: false,
      message: claimedMatch ? 'That is not a match' : 'There is a match',
      detail: question.matches
        ? 'Every mismatch here had a variable on the left, so every one could be repaired.'
        : 'A mismatch with a function symbol on the left is the end — the target cannot be changed.',
    }
  }

  if (!question.matches) {
    return {
      correct: true,
      message: 'No such σ — the pattern is not more general',
      detail: 'The mismatch sits under a function symbol in the pattern, and matching cannot move the target.',
    }
  }

  const sigma = match(pattern, target)
  return {
    correct: true,
    message: `σ(t₁) = t₂ with ${sigma === null ? '{}' : showTerm(applySubstitution(sigma, pattern))}`,
    detail: `t₁ ≤ t₂, and the σ you built is the one the algorithm produces.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked }: MinigameScreenProps<MatchingQuestion, MatchingAnswer>) {
  const { pattern, target } = parse(question)
  const [moves, setMoves] = useState<Move[]>([])

  useEffect(() => {
    setMoves([])
  }, [question])

  const state = replay('match', pattern, target, moves)
  const done = state.outcome !== 'running'

  return (
    <UnifyBoard
      mode="match"
      state={state}
      locked={locked}
      onMove={(move) => setMoves((previous) => [...previous, move])}
      title="Is t₁ more general than t₂?"
      footer={
        locked ? null : (
          <div className="mt-3 flex flex-col gap-2">
            {moves.length > 0 && (
              <Button variant="ghost" onClick={() => setMoves((previous) => previous.slice(0, -1))}>
                ← Undo
              </Button>
            )}
            <Button variant={done ? 'coin' : 'secondary'} onClick={() => submit(moves)}>
              {done
                ? state.outcome === 'unified'
                  ? 'Submit — they match'
                  : 'Submit — no such σ'
                : 'Submit — not finished'}
            </Button>
          </div>
        )
      }
      reveal={
        <>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            {question.matches ? 'The matching substitution' : 'Why there is none'}
          </p>
          <div className="mt-1">
            {question.matches ? (
              <OutcomeLine outcome="unified" sigma={match(pattern, target) ?? {}} />
            ) : (
              <p className="text-base font-bold">
                No σ has σ(t₁) = t₂. Matching cannot touch t₂.
              </p>
            )}
          </div>
          <p className="mt-2 flex flex-wrap items-baseline gap-2 text-sm font-medium text-ink-soft">
            t₁ = <TermText term={pattern} className="font-bold" /> · t₂ ={' '}
            <TermText term={target} className="font-bold" />
          </p>
        </>
      }
    />
  )
}

export const matchingGame = defineMinigame<MatchingQuestion, MatchingAnswer>({
  id: 'matching',
  title: 'Run The Matcher',
  tagline: 'Only the pattern may move. Find out whether that is enough.',
  topics: ['unification'],
  icon: '🧷',
  roundSeconds: 150,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  Screen,
  Guide: MatchingGuide,
  questionKey: (question) => `${question.pattern}|${question.target}`,
})
