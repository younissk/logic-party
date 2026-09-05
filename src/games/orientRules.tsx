/**
 * Pointing equations downhill — ln.pdf §3.3, Definition 3.20, exam26bA Q2.2.
 *
 * A reduction system is a set of equations already oriented, and two
 * conditions decide whether an equation can be one at all. It has to go *down*
 * in the term order — which is what makes reduction terminate — and its right
 * side may not contain a variable its left side lacks, or a step would have to
 * invent a term.
 *
 * So there are three answers per equation, not two. "Neither way" is not a
 * failure to decide; it is Definition 3.20 refusing, and the notes are explicit
 * that no term order compares every pair.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  combinedOrder,
  parseEquation,
  showEquation,
  termSize,
  termVariables,
  termsEqual,
  variable,
  type Equation,
  type Rng,
  type Signature,
  type Term,
  type TermOrder,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { EquationText } from '@/ui/TermText'
import { SortBoard, type Bin } from '@/ui/SortBoard'
import { OrientGuide } from './orientRules.guide'

export type Orientation = 'forward' | 'backward' | 'neither'

export const ORIENT_BINS: readonly Bin<Orientation>[] = [
  { id: 'forward', label: 'l → r', style: 'border-ink bg-grass/25' },
  { id: 'backward', label: 'r → l', style: 'border-ink bg-space-blue/20' },
  { id: 'neither', label: 'not a rule', style: 'border-ink bg-space-red/15' },
]

export interface OrientQuestion {
  signature: Signature
  /** The symbols in order, smallest first — the order's precedence. */
  precedence: string[]
  equations: string[]
}

export type OrientAnswer = (Orientation | null)[]

export const orderFor = (question: OrientQuestion): TermOrder =>
  combinedOrder(question.precedence)

/** Would this direction be a legal rule? Both conditions, in one place. */
export function legalAs(order: TermOrder, left: Term, right: Term): boolean {
  if (order.compare(left, right) !== 'greater') return false
  const available = termVariables(left)
  return termVariables(right).every((name) => available.includes(name))
}

export function orientationOf(question: OrientQuestion, source: string): Orientation {
  const order = orderFor(question)
  const equation = parseEquation(source, question.signature)
  if (legalAs(order, equation.left, equation.right)) return 'forward'
  if (legalAs(order, equation.right, equation.left)) return 'backward'
  return 'neither'
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  symbols: [name: string, arity: number][]
  variables: string[]
  size: [min: number, max: number]
  equations: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    symbols: [
      ['f', 1],
      ['g', 1],
    ],
    variables: ['x', 'y'],
    size: [2, 4],
    equations: 4,
  },
  medium: {
    symbols: [
      ['f', 1],
      ['g', 2],
      ['h', 1],
    ],
    variables: ['x', 'y'],
    size: [2, 5],
    equations: 5,
  },
  hard: {
    symbols: [
      ['f', 2],
      ['g', 2],
      ['h', 1],
    ],
    variables: ['x', 'y', 'z'],
    size: [3, 7],
    equations: 6,
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

function generate({ rng, difficulty }: GenerateContext): OrientQuestion {
  const profile = PROFILES[difficulty]
  const signature: Signature = Object.fromEntries(profile.symbols)
  const precedence = profile.symbols.map(([name]) => name)

  for (let attempt = 0; attempt < 400; attempt++) {
    const question: OrientQuestion = { signature, precedence, equations: [] }
    const seen = new Set<string>()

    for (let guard = 0; guard < 200 && question.equations.length < profile.equations; guard++) {
      const left = randomTerm(rng, profile, rng.range(...profile.size))
      const right = randomTerm(rng, profile, rng.range(...profile.size))
      if (termsEqual(left, right)) continue
      const source = showEquation({ left, right } as Equation)
      if (seen.has(source)) continue
      seen.add(source)
      question.equations.push(source)
    }
    if (question.equations.length < profile.equations) continue

    const bins = new Set(question.equations.map((source) => orientationOf(question, source)))
    // All three bins live, or the board answers itself.
    if (bins.size < 3) continue

    return question
  }

  // Last resort, so a round can never stall.
  const fallback: Signature = { f: 1, g: 1 }
  return {
    signature: fallback,
    precedence: ['f', 'g'],
    equations: ['f(f(x))=f(x)', 'f(x)=g(g(x))', 'g(x)=g(y)', 'f(x)=y'],
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: OrientQuestion): OrientAnswer =>
  question.equations.map((source) => orientationOf(question, source))

function check(question: OrientQuestion, answer: OrientAnswer): Verdict {
  const truth = solve(question)
  const right = truth.filter((bin, index) => answer[index] === bin).length
  const total = truth.length

  if (right === total) {
    const rules = truth.filter((bin) => bin !== 'neither').length
    return {
      correct: true,
      message: `${rules} of ${total} can be rules`,
      detail:
        'A rule has to go down in the order — that is what makes reduction stop — and may not put a variable on the right that the left side does not have.',
    }
  }

  return {
    correct: false,
    // A count, never which: sprint shows this before the retry.
    message: `${total - right} in the wrong bin`,
    score: total === 0 ? 0 : right / total,
    detail:
      'Compare by symbol count first, watching that no variable is used less often on the bigger side. Only when that ties does the symbol order decide, and a variable at the deciding position means neither way.',
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
}: MinigameScreenProps<OrientQuestion, OrientAnswer>) {
  const [placed, setPlaced] = useState<OrientAnswer>([])
  const equations = useMemo(
    () => question.equations.map((source) => parseEquation(source, question.signature)),
    [question],
  )

  useEffect(() => {
    setPlaced(question.equations.map(() => null))
  }, [question])

  const remaining = placed.filter((bin) => bin === null).length

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Which way does each one point?
      </p>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Bigger first by symbol count, with no variable used less often. Ties broken by{' '}
        <span className="formula font-bold">{question.precedence.join(' < ')}</span>, argument by
        argument.
      </p>

      <div className="mt-3">
        <SortBoard
          bins={ORIENT_BINS}
          columns={3}
          tokens={equations.map((equation) => (
            <EquationText left={equation.left} right={equation.right} className="text-sm font-bold" />
          ))}
          placed={placed}
          onPlace={(index, bin) =>
            setPlaced((previous) => previous.map((entry, at) => (at === index ? bin : entry)))
          }
          locked={locked}
          solution={locked ? (solution ?? undefined) : undefined}
          hint="Drag each equation into a bin. Tap a placed one to send it back."
        />
      </div>

      {locked && (
        <div className="mt-3 flex flex-col gap-1 text-xs font-medium text-ink-soft">
          {question.equations.map((source, index) => {
            const equation = equations[index] as Equation
            const order = orderFor(question)
            const comparison = order.compare(equation.left, equation.right)
            const freshLeft = termVariables(equation.right).filter(
              (name) => !termVariables(equation.left).includes(name),
            )
            const freshRight = termVariables(equation.left).filter(
              (name) => !termVariables(equation.right).includes(name),
            )
            return (
              <p key={source} className="flex flex-wrap items-baseline gap-2">
                <span className="formula font-bold text-ink">{source}</span>
                <span>
                  {comparison === 'incomparable'
                    ? 'incomparable in this order'
                    : comparison === 'equal'
                      ? 'the same term'
                      : `${comparison === 'greater' ? 'left' : 'right'} is bigger`}
                  {freshLeft.length > 0 && comparison === 'greater'
                    ? ` — but ${freshLeft.join(', ')} appears only on the right`
                    : ''}
                  {freshRight.length > 0 && comparison === 'less'
                    ? ` — but ${freshRight.join(', ')} appears only on the left`
                    : ''}
                </span>
              </p>
            )
          })}
        </div>
      )}

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

export const orientGame = defineMinigame<OrientQuestion, OrientAnswer>({
  id: 'term-order',
  title: 'Point It Downhill',
  tagline: 'Orient each equation, or say it can never be a rule.',
  topics: ['rewriting'],
  icon: '🧭',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: OrientGuide,
  questionKey: (question) => question.equations.join(';'),
})
