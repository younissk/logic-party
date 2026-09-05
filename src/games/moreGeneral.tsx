/**
 * More general than — ln.pdf §3.2, Definition 3.5, exam25a Q2.1, Exercise 5.
 *
 * `t ≤ t′` says t′ is an instance of t. The exam gives one target and six
 * candidates and asks which are "at least as general as" it — a judgement made
 * about a whole set at once, which is why this is a sorting board rather than
 * another algorithm walk. You see all the candidates together and compare them
 * against each other, which is how the question is actually solved.
 *
 * Three bins, not two: two terms can each be an instance of the other, and
 * Theorem 3.7 says that means they differ only by a renaming. Lumping variants
 * in with the ordinary instances would throw away the distinction the theorem
 * exists to make.
 */

import { useEffect, useState } from 'react'
import {
  applySubstitution,
  areVariants,
  moreGeneral,
  parseTerm,
  showTerm,
  termSize,
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
import { MoreGeneralGuide } from './moreGeneral.guide'

export type Generality = 'general' | 'variant' | 'no'

export const GENERALITY_BINS: readonly Bin<Generality>[] = [
  { id: 'general', label: 't ≤ target', style: 'border-ink bg-grass/25' },
  { id: 'variant', label: 'same up to renaming', style: 'border-ink bg-coin/40' },
  { id: 'no', label: 'not more general', style: 'border-ink bg-space-red/15' },
]

export interface MoreGeneralQuestion {
  signature: Signature
  target: string
  candidates: string[]
}

export type MoreGeneralAnswer = (Generality | null)[]

const parse = (question: MoreGeneralQuestion, source: string): Term =>
  parseTerm(source, question.signature)

export function generalityOf(question: MoreGeneralQuestion, source: string): Generality {
  const target = parse(question, question.target)
  const candidate = parse(question, source)
  if (areVariants(candidate, target)) return 'variant'
  return moreGeneral(candidate, target) ? 'general' : 'no'
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  symbols: [name: string, arity: number][]
  variables: string[]
  size: [min: number, max: number]
  candidates: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    symbols: [
      ['f', 2],
      ['h', 1],
    ],
    variables: ['x', 'y'],
    size: [4, 6],
    candidates: 4,
  },
  medium: {
    symbols: [
      ['f', 2],
      ['g', 2],
      ['h', 1],
    ],
    variables: ['x', 'y'],
    size: [6, 9],
    candidates: 5,
  },
  hard: {
    symbols: [
      ['f', 2],
      ['g', 2],
      ['h', 1],
    ],
    variables: ['x', 'y', 'z'],
    size: [8, 12],
    candidates: 6,
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

/** Replace one subterm of the target by a variable — a genuine generalisation. */
function generalise(rng: Rng, profile: Profile, term: Term): Term {
  if (term.kind === 'var') return variable(rng.pick(profile.variables))
  if (rng.bool(0.35)) return variable(rng.pick(profile.variables))
  const index = rng.int(term.args.length)
  return {
    kind: 'fn',
    name: term.name,
    args: term.args.map((arg, at) => (at === index ? generalise(rng, profile, arg) : arg)),
  }
}

function generate({ rng, difficulty }: GenerateContext): MoreGeneralQuestion {
  const profile = PROFILES[difficulty]
  const signature: Signature = Object.fromEntries(profile.symbols)

  for (let attempt = 0; attempt < 300; attempt++) {
    const target = randomTerm(rng, profile, rng.range(...profile.size))
    if (target.kind === 'var') continue

    const question: MoreGeneralQuestion = {
      signature,
      target: showTerm(target),
      candidates: [],
    }

    const pool: string[] = []
    const add = (term: Term) => {
      const printed = showTerm(term)
      if (printed === question.target) return
      if (pool.includes(printed)) return
      pool.push(printed)
    }

    // Genuine generalisations, near misses, and a renaming of the target.
    for (let count = 0; count < 4; count++) add(generalise(rng, profile, target))
    for (let count = 0; count < 3; count++) add(randomTerm(rng, profile, rng.range(...profile.size)))
    add(variable(rng.pick(profile.variables)))
    const renaming = Object.fromEntries(
      profile.variables.map((name, index) => [
        name,
        variable(profile.variables[(index + 1) % profile.variables.length] as string),
      ]),
    )
    add(applySubstitution(renaming, target))

    question.candidates = rng.shuffle(pool).slice(0, profile.candidates)
    if (question.candidates.length < profile.candidates) continue

    const bins = new Set(question.candidates.map((source) => generalityOf(question, source)))
    // Every bin has to be live, or the board answers itself.
    if (bins.size < 2) continue
    if (!bins.has('general') || !bins.has('no')) continue

    return question
  }

  // Last resort, so a round can never stall: the exam's own question.
  const fallback: Signature = { f: 2, g: 2, h: 1 }
  return {
    signature: fallback,
    target: 'f(g(X,Y),h(h(X)))',
    candidates: [
      'f(g(X,Y),h(X))',
      'f(X,h(h(X)))',
      'f(X,h(h(Y)))',
      'f(g(X,Y),h(h(Y)))',
      'f(g(Y,X),h(h(Y)))',
      'X',
    ],
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: MoreGeneralQuestion): MoreGeneralAnswer =>
  question.candidates.map((source) => generalityOf(question, source))

function check(question: MoreGeneralQuestion, answer: MoreGeneralAnswer): Verdict {
  const truth = solve(question)
  const right = truth.filter((bin, index) => answer[index] === bin).length
  const total = truth.length

  if (right === total) {
    const generals = truth.filter((bin) => bin !== 'no').length
    return {
      correct: true,
      message: `${generals} of ${total} are at least as general`,
      detail:
        'A candidate is more general exactly when some substitution turns it into the target — and if that works both ways, the two differ only by a renaming.',
    }
  }

  return {
    correct: false,
    // A count, never which: sprint shows this before the retry.
    message: `${total - right} in the wrong bin`,
    score: total === 0 ? 0 : right / total,
    detail:
      'Try to build the substitution. Every function symbol in the candidate must already match the target, and a variable used twice has to be sent to the same term both times.',
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
}: MinigameScreenProps<MoreGeneralQuestion, MoreGeneralAnswer>) {
  const [placed, setPlaced] = useState<MoreGeneralAnswer>([])

  useEffect(() => {
    setPlaced(question.candidates.map(() => null))
  }, [question])

  const remaining = placed.filter((bin) => bin === null).length

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Which are at least as general?
      </p>

      <div className="tile mt-2 bg-card-shade px-3 py-2">
        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">target</p>
        <TermText text={question.target} className="text-lg font-bold" />
      </div>

      <div className="mt-3">
        <SortBoard
          bins={GENERALITY_BINS}
          columns={3}
          tokens={question.candidates.map((source) => (
            <TermText text={source} className="text-sm font-bold" />
          ))}
          placed={placed}
          onPlace={(index, bin) =>
            setPlaced((previous) => previous.map((entry, at) => (at === index ? bin : entry)))
          }
          locked={locked}
          solution={locked ? (solution ?? undefined) : undefined}
          hint="Drag each candidate into a bin. Tap a placed one to send it back."
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

export const moreGeneralGame = defineMinigame<MoreGeneralQuestion, MoreGeneralAnswer>({
  id: 'more-general',
  title: 'Instance Or Not',
  tagline: 'Sort the candidates by whether the target is an instance of them.',
  topics: ['unification'],
  icon: '📐',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: MoreGeneralGuide,
  questionKey: (question) => `${question.target}|${question.candidates.join(';')}`,
})
