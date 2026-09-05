/**
 * Critical pairs, up to variable renaming — Exercise 6 question 3.
 *
 * The exercise is careful about this: "marking an option (t₁, t₂) means there
 * is some renaming σ such that σ(t₁) and σ(t₂) form a critical pair". Which
 * variable names the algorithm invented is an accident of the order it ran in,
 * so a pair wearing different letters is the same pair — and a fork has no
 * preferred branch, so swapping the two sides changes nothing either.
 *
 * What is *not* the same is a pair whose two sides happen to be reachable from
 * one term by several steps. A critical pair comes from a single fork, and
 * telling those apart is the whole question.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  applySubstitution,
  criticalPairs,
  parseTerm,
  reduce,
  rule,
  samePair,
  showTerm,
  termVariables,
  variable,
  type Rng,
  type Rule,
  type Signature,
  type Term,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { EquationText, TermText } from '@/ui/TermText'
import { SortBoard, type Bin } from '@/ui/SortBoard'
import { PairRenamingGuide } from './pairRenaming.guide'

export type PairVerdict = 'yes' | 'no'

export const PAIR_BINS: readonly Bin<PairVerdict>[] = [
  { id: 'yes', label: 'is a critical pair', style: 'border-ink bg-grass/25' },
  { id: 'no', label: 'is not', style: 'border-ink bg-space-red/15' },
]

export interface PairRenamingQuestion {
  signature: Signature
  rules: string[]
  candidates: [string, string][]
}

export type PairRenamingAnswer = (PairVerdict | null)[]

export const readRules = (question: PairRenamingQuestion): Rule[] =>
  question.rules.map((source) => {
    const [left, right] = source.split('->')
    return rule(
      parseTerm(left as string, question.signature),
      parseTerm(right as string, question.signature),
    )
  })

export function verdictFor(
  question: PairRenamingQuestion,
  candidate: [string, string],
): PairVerdict {
  const rules = readRules(question)
  const pair = {
    left: parseTerm(candidate[0], question.signature),
    right: parseTerm(candidate[1], question.signature),
  }
  return criticalPairs(rules).some((real) => samePair(real, pair)) ? 'yes' : 'no'
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const SYSTEMS: Record<Difficulty, { signature: Signature; rules: string[] }[]> = {
  easy: [
    { signature: { f: 1, h: 1 }, rules: ['f(h(x))->f(x)', 'h(f(x))->h(x)'] },
    { signature: { f: 1, g: 1 }, rules: ['f(f(x))->g(x)'] },
    { signature: { f: 1, h: 1 }, rules: ['f(h(x))->x', 'f(f(x))->h(x)'] },
  ],
  medium: [
    { signature: { f: 1, g: 2, h: 1 }, rules: ['g(x,f(y))->f(x)', 'g(f(x),y)->h(x)'] },
    { signature: { f: 1, g: 1, h: 1 }, rules: ['h(f(x))->h(g(x))', 'f(g(x))->g(f(x))'] },
    { signature: { f: 1, g: 1, h: 1 }, rules: ['f(g(x))->f(x)', 'g(f(y))->f(y)', 'h(g(z))->f(z)'] },
  ],
  hard: [
    {
      signature: { f: 2, g: 2, h: 1 },
      rules: ['f(g(X,Y),Z)->h(Y)', 'g(X,h(Y))->f(X,Y)', 'g(h(X),Y)->f(X,h(Y))'],
    },
    {
      signature: { f: 1, g: 1, h: 1 },
      rules: ['f(f(x))->g(x)', 'g(g(x))->h(x)', 'h(h(x))->f(x)'],
    },
  ],
}

const RENAMINGS = [
  ['x', 'y', 'z'],
  ['y', 'z', 'x'],
  ['u', 'v', 'w'],
  ['z', 'x', 'y'],
]

/** The same pair wearing different letters, and sometimes the other way round. */
function disguise(rng: Rng, pair: { left: Term; right: Term }): [string, string] {
  const names = termVariables(pair.left).concat(termVariables(pair.right))
  const target = rng.pick(RENAMINGS)
  const renaming: Record<string, Term> = {}
  ;[...new Set(names)].forEach((name, index) => {
    renaming[name] = variable(target[index % target.length] as string)
  })
  const left = applySubstitution(renaming, pair.left)
  const right = applySubstitution(renaming, pair.right)
  return rng.bool() ? [showTerm(left), showTerm(right)] : [showTerm(right), showTerm(left)]
}

/**
 * A pair that looks like a fork and is not.
 *
 * Both sides are reachable from the same term, but by several steps rather
 * than by one fork — which is the distinction the exercise is testing.
 */
function nearMiss(
  rng: Rng,
  rules: readonly Rule[],
  pair: { left: Term; right: Term },
): [string, string] | null {
  const reducedLeft = reduce(rules, pair.left).result
  const reducedRight = reduce(rules, pair.right).result
  const options: [Term, Term][] = [
    [reducedLeft, pair.right],
    [pair.left, reducedRight],
    [reducedLeft, reducedRight],
    [pair.left, pair.left],
  ]
  for (const [left, right] of rng.shuffle(options)) {
    if (showTerm(left) === showTerm(right)) continue
    return [showTerm(left), showTerm(right)]
  }
  return null
}

function generate({ rng, difficulty }: GenerateContext): PairRenamingQuestion {
  for (const system of rng.shuffle(SYSTEMS[difficulty])) {
    const rules = system.rules.map((source) => {
      const [left, right] = source.split('->')
      return rule(
        parseTerm(left as string, system.signature),
        parseTerm(right as string, system.signature),
      )
    })
    const real = criticalPairs(rules)
    if (real.length === 0) continue

    const question: PairRenamingQuestion = {
      signature: system.signature,
      rules: system.rules,
      candidates: [],
    }

    const add = (candidate: [string, string] | null) => {
      if (candidate === null) return
      if (question.candidates.some(([a, b]) => a === candidate[0] && b === candidate[1])) return
      question.candidates.push(candidate)
    }

    for (const pair of rng.shuffle(real).slice(0, 3)) add(disguise(rng, pair))
    for (const pair of rng.shuffle(real).slice(0, 3)) add(nearMiss(rng, rules, pair))

    question.candidates = rng.shuffle(question.candidates).slice(0, 5)
    const bins = new Set(question.candidates.map((candidate) => verdictFor(question, candidate)))
    // Both bins live, or the board answers itself.
    if (bins.size < 2) continue
    if (question.candidates.length < 4) continue

    return question
  }

  // Last resort, so a round can never stall: the exercise's own four options.
  const signature: Signature = { f: 1, h: 1 }
  return {
    signature,
    rules: ['f(h(x))->f(x)', 'h(f(x))->h(x)'],
    candidates: [
      ['f(f(x))', 'f(h(x))'],
      ['f(f(x))', 'h(h(x))'],
      ['f(h(f(x)))', 'h(f(h(x)))'],
      ['h(h(x))', 'h(f(x))'],
    ],
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: PairRenamingQuestion): PairRenamingAnswer =>
  question.candidates.map((candidate) => verdictFor(question, candidate))

function check(question: PairRenamingQuestion, answer: PairRenamingAnswer): Verdict {
  const truth = solve(question)
  const right = truth.filter((bin, index) => answer[index] === bin).length
  const total = truth.length

  if (right === total) {
    const real = truth.filter((bin) => bin === 'yes').length
    return {
      correct: true,
      message: `${real} of ${total} are critical pairs`,
      detail:
        'Renaming the variables and swapping the two sides both leave a critical pair unchanged. Reducing either side does not — that gives a pair of terms reachable from one term, which is a weaker thing.',
    }
  }

  return {
    correct: false,
    // A count, never which: sprint shows this before the retry.
    message: `${total - right} in the wrong bin`,
    score: total === 0 ? 0 : right / total,
    detail:
      'Compute the pairs yourself first, then compare up to renaming. A candidate that is one reduction step away from a real pair is the trap.',
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
}: MinigameScreenProps<PairRenamingQuestion, PairRenamingAnswer>) {
  const rules = useMemo(() => readRules(question), [question])
  const [placed, setPlaced] = useState<PairRenamingAnswer>([])

  useEffect(() => {
    setPlaced(question.candidates.map(() => null))
  }, [question])

  const remaining = placed.filter((bin) => bin === null).length

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Which are critical pairs?
      </p>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Up to renaming, and either way round — the letters and the order carry no information.
      </p>

      <p className="mt-2 text-xs font-bold uppercase tracking-wider text-ink-soft">R</p>
      <div className="mt-1 flex flex-col gap-1">
        {rules.map((entry, index) => (
          <div key={index} className="tile bg-card-shade px-3 py-1.5">
            <EquationText left={entry.left} right={entry.right} arrow="→" className="text-base font-bold" />
          </div>
        ))}
      </div>

      <div className="mt-3">
        <SortBoard
          bins={PAIR_BINS}
          tokens={question.candidates.map((candidate) => (
            <span className="formula flex items-center gap-1 text-sm font-bold">
              <span>(</span>
              <TermText text={candidate[0]} />
              <span className="opacity-60">,</span>
              <TermText text={candidate[1]} />
              <span>)</span>
            </span>
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

      {locked && (
        <div className="mt-3 rounded-2xl bg-card-shade p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            The pairs this system really has
          </p>
          <div className="mt-1 flex flex-col gap-1">
            {criticalPairs(rules).map((pair, index) => (
              <p key={index} className="formula text-sm font-bold">
                ({showTerm(pair.left)}, {showTerm(pair.right)})
              </p>
            ))}
          </div>
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

export const pairRenamingGame = defineMinigame<PairRenamingQuestion, PairRenamingAnswer>({
  id: 'pair-renaming',
  title: 'Same Fork?',
  tagline: 'Different letters, same pair. One reduction later, a different thing.',
  topics: ['rewriting'],
  icon: '🔤',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: PairRenamingGuide,
  questionKey: (question) =>
    `${question.rules.join(';')}|${question.candidates.map((pair) => pair.join('~')).join(';')}`,
})
