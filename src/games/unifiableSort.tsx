/**
 * Unifiable, or which kind of not? — Exercise 5 question 2, ln.pdf §3.2.
 *
 * The exercise gives several pairs and asks which unify. Answering it one pair
 * at a time is the slow way; the fast way is to glance down the column for the
 * two shapes of failure — a clash of function symbols, and a variable meeting a
 * term that contains it — and sort what is left.
 *
 * So the board has three bins, not two. "Not unifiable" is not an answer the
 * exam accepts on its own, and separating the two reasons is what stops the
 * occurs check from being the thing you forget exists.
 */

import { useEffect, useState } from 'react'
import {
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
import { Button, Card } from '@/ui/primitives'
import { TermText } from '@/ui/TermText'
import { SortBoard, type Bin } from '@/ui/SortBoard'
import { UnifiableSortGuide } from './unifiableSort.guide'

export type Fate = 'unified' | 'clash' | 'occurs'

export const FATE_BINS: readonly Bin<Fate>[] = [
  { id: 'unified', label: 'unifiable', style: 'border-ink bg-grass/25' },
  { id: 'clash', label: 'clash', style: 'border-ink bg-space-red/15' },
  { id: 'occurs', label: 'occurs check', style: 'border-ink bg-coin/40' },
]

export interface UnifiablePair {
  left: string
  right: string
}

export interface UnifiableSortQuestion {
  signature: Signature
  pairs: UnifiablePair[]
}

export type UnifiableSortAnswer = (Fate | null)[]

export function fateOf(question: UnifiableSortQuestion, pair: UnifiablePair): Fate {
  const result = unify(
    parseTerm(pair.left, question.signature),
    parseTerm(pair.right, question.signature),
  )
  return result.unified ? 'unified' : result.failure.reason
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  symbols: [name: string, arity: number][]
  variables: string[]
  size: [min: number, max: number]
  pairs: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    symbols: [
      ['f', 1],
      ['g', 2],
    ],
    variables: ['x', 'y'],
    size: [2, 4],
    pairs: 4,
  },
  medium: {
    symbols: [
      ['f', 1],
      ['g', 2],
      ['h', 2],
    ],
    variables: ['x', 'y', 'z'],
    size: [3, 6],
    pairs: 5,
  },
  hard: {
    symbols: [
      ['f', 1],
      ['g', 2],
      ['h', 2],
    ],
    variables: ['x', 'y', 'z'],
    size: [5, 8],
    pairs: 6,
  },
}

function randomTerm(rng: Rng, profile: Profile, budget: number): Term {
  const usable = profile.symbols.filter(([, arity]) => arity + 1 <= budget)
  if (budget <= 1 || usable.length === 0) return variable(rng.pick(profile.variables))
  const [name, arity] = rng.pick(usable)
  const args: Term[] = []
  let left = budget - 1
  for (let index = 0; index < arity; index++) {
    const share = Math.max(1, Math.floor(left / (arity - index)))
    const arg = randomTerm(rng, profile, rng.range(1, share))
    args.push(arg)
    left -= termSize(arg)
  }
  return { kind: 'fn', name, args }
}

function generate({ rng, difficulty }: GenerateContext): UnifiableSortQuestion {
  const profile = PROFILES[difficulty]
  const signature: Signature = Object.fromEntries(profile.symbols)
  const question: UnifiableSortQuestion = { signature, pairs: [] }

  // One pair per bin first, so all three are always live, then fill up.
  const wanted: Fate[] = ['unified', 'clash', 'occurs']
  while (wanted.length < profile.pairs) wanted.push(rng.pick(['unified', 'clash', 'occurs'] as const))

  for (const fate of rng.shuffle(wanted)) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const left = randomTerm(rng, profile, rng.range(...profile.size))
      const right = randomTerm(rng, profile, rng.range(...profile.size))
      if (termsEqual(left, right)) continue
      if (left.kind === 'var' && right.kind === 'var') continue
      const pair = { left: showTerm(left), right: showTerm(right) }
      if (question.pairs.some((existing) => existing.left === pair.left && existing.right === pair.right)) {
        continue
      }
      if (fateOf(question, pair) !== fate) continue
      question.pairs.push(pair)
      break
    }
  }

  if (question.pairs.length < profile.pairs) {
    // Last resort, so a round can never stall: one certain pair per bin.
    const fallback: Signature = { f: 1, g: 2 }
    return {
      signature: fallback,
      pairs: [
        { left: 'g(x,f(y))', right: 'g(f(z),x)' },
        { left: 'g(x,y)', right: 'f(z)' },
        { left: 'f(x)', right: 'f(f(x))' },
        { left: 'g(x,x)', right: 'g(f(y),y)' },
      ],
    }
  }

  return question
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: UnifiableSortQuestion): UnifiableSortAnswer =>
  question.pairs.map((pair) => fateOf(question, pair))

function check(question: UnifiableSortQuestion, answer: UnifiableSortAnswer): Verdict {
  const truth = solve(question)
  const right = truth.filter((fate, index) => answer[index] === fate).length
  const total = truth.length

  if (right === total) {
    const unifiable = truth.filter((fate) => fate === 'unified').length
    return {
      correct: true,
      message: `${unifiable} of ${total} unify`,
      detail:
        'A clash is two different function symbols meeting. The occurs check is a variable meeting a term containing it — the repair never terminates.',
    }
  }

  // Getting the failures the wrong way round is a different mistake from
  // thinking something unifies, and worth naming separately.
  const swapped = truth.filter(
    (fate, index) =>
      fate !== 'unified' && answer[index] !== 'unified' && answer[index] !== fate,
  ).length

  return {
    correct: false,
    message:
      swapped === total - right && swapped > 0
        ? `${swapped} in the wrong failure bin`
        : `${total - right} in the wrong bin`,
    score: total === 0 ? 0 : right / total,
    detail:
      'Walk each pair to its first mismatch. Two function symbols there is a clash; a variable against a term containing it is the occurs check; anything else keeps going.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
  solution,
}: MinigameScreenProps<UnifiableSortQuestion, UnifiableSortAnswer>) {
  const [placed, setPlaced] = useState<UnifiableSortAnswer>([])

  useEffect(() => {
    setPlaced(question.pairs.map(() => null))
  }, [question])

  const remaining = placed.filter((fate) => fate === null).length

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Sort the pairs by what happens
      </p>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Not unifiable is not an answer on its own — say which of the two failures it is.
      </p>

      <div className="mt-3">
        <SortBoard
          bins={FATE_BINS}
          columns={3}
          tokens={question.pairs.map((pair) => (
            <span className="formula flex items-center gap-1 text-sm font-bold">
              <TermText text={pair.left} />
              <span className="opacity-50">~</span>
              <TermText text={pair.right} />
            </span>
          ))}
          placed={placed}
          onPlace={(index, bin) =>
            setPlaced((previous) => previous.map((entry, at) => (at === index ? bin : entry)))
          }
          locked={locked}
          solution={locked ? (solution ?? undefined) : undefined}
          hint="Drag each pair into a bin. Tap a placed one to send it back."
        />
      </div>

      {!locked && (
        <Button
          variant={remaining === 0 ? 'coin' : 'secondary'}
          className="mt-3 w-full"
          onClick={() => submit(placed)}
        >
          {remaining === 0 ? 'Submit' : `Submit — ${remaining} unplaced`}
        </Button>
      )}
    </Card>
  )
}

export const unifiableSortGame = defineMinigame<UnifiableSortQuestion, UnifiableSortAnswer>({
  id: 'unifiable',
  title: 'Unifiable Sweep',
  tagline: 'Several pairs, three fates, one glance each.',
  topics: ['unification'],
  icon: '🧺',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: UnifiableSortGuide,
  questionKey: (question) =>
    question.pairs.map((pair) => `${pair.left}~${pair.right}`).join(';'),
})
