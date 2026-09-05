/**
 * Paramodulation — ln.pdf §4.4, Definition 4.42, exam26bA Q3.2, Exercise 9.
 *
 * From a clause containing `s = t`, and another clause containing a term that
 * unifies with s, derive the second clause with *one occurrence* of that term
 * replaced by t — everything under the mgu.
 *
 * "One occurrence" is the whole subtlety. The replacement condition the notes
 * state is about a single occurrence, which is why with `a = b` the literal
 * `p(a,a)` gives `p(b,a)` and `p(a,b)` — and not `p(b,b)` in one step. The
 * equation may also be used right-to-left, because it is an equation.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  paramodulants,
  parseFoClauseSet,
  showFoClause,
  showFoLiteral,
  showPosition,
  showSubstitution,
  type FoClause,
  type FoSignature,
  type Signature,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'
import { MovingItem, MovingList, Pop, ProgressBar } from '@/ui/motion'
import { ParamodulationGuide } from './paramodulation.guide'

export interface ParamodulationQuestion {
  predicates: Record<string, number>
  functions: Signature
  /** The clause carrying the equation. */
  equation: string
  /** The clause being rewritten. */
  target: string
  /** Every clause one paramodulation step produces, printed. */
  results: string[]
}

export type ParamodulationAnswer = string[]

const signatureOf = (question: ParamodulationQuestion): FoSignature => ({
  predicates: { ...question.predicates, '=': 2 },
  functions: question.functions,
})

export const clausesOf = (
  question: ParamodulationQuestion,
): { equation: FoClause; target: FoClause } => {
  const [equation, target] = parseFoClauseSet(
    [question.equation, question.target],
    signatureOf(question),
  ) as [FoClause, FoClause]
  return { equation, target }
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  predicates: Record<string, number>
  functions: Signature
  pairs: [equation: string, target: string][]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    predicates: { p: 1, q: 1 },
    functions: { a: 0, b: 0, f: 1 },
    pairs: [
      ['=(a(),b())', 'p(a())'],
      ['=(f(x),x)', 'p(f(f(a())))'],
      ['=(a(),b())', 'p(a()) ∨ q(a())'],
      ['=(f(a()),b())', 'p(f(a()))'],
    ],
  },
  medium: {
    predicates: { p: 2, q: 1 },
    functions: { a: 0, b: 0, f: 1 },
    pairs: [
      ['=(a(),b())', 'p(a(),a())'],
      ['=(f(x),x)', 'p(f(a()),f(b()))'],
      ['=(f(x),g(x))', 'q(f(a())) ∨ p(f(a()),b())'],
      ['=(a(),b()) ∨ q(a())', 'p(a(),f(a()))'],
    ],
  },
  hard: {
    predicates: { p: 2, q: 1 },
    functions: { a: 0, b: 0, f: 1, g: 1 },
    pairs: [
      ['=(f(x),g(x)) ∨ q(x)', 'p(f(a()),f(b()))'],
      ['=(f(x),x)', 'q(f(f(f(a()))))'],
      ['=(g(x),a()) ∨ q(x)', 'p(g(b()),g(f(b())))'],
    ],
  },
}

function generate({ rng, difficulty }: GenerateContext): ParamodulationQuestion {
  const profile = PROFILES[difficulty]
  const signature: FoSignature = {
    predicates: { ...profile.predicates, '=': 2 },
    functions: profile.functions,
  }

  for (const [equationSource, targetSource] of rng.shuffle(profile.pairs)) {
    let equation: FoClause
    let target: FoClause
    try {
      ;[equation, target] = parseFoClauseSet([equationSource, targetSource], signature) as [
        FoClause,
        FoClause,
      ]
    } catch {
      continue
    }
    const results = paramodulants(equation, target).map((step) => showFoClause(step.clause))
    // Enough to find, and few enough to find inside a round.
    if (results.length < 2 || results.length > 6) continue

    return {
      predicates: profile.predicates,
      functions: profile.functions,
      equation: equationSource,
      target: targetSource,
      results,
    }
  }

  const signature2: FoSignature = {
    predicates: { p: 2, '=': 2 },
    functions: { a: 0, b: 0 },
  }
  const [equation, target] = parseFoClauseSet(['=(a(),b())', 'p(a(),a())'], signature2) as [
    FoClause,
    FoClause,
  ]
  return {
    predicates: { p: 2 },
    functions: { a: 0, b: 0 },
    equation: '=(a(),b())',
    target: 'p(a(),a())',
    results: paramodulants(equation, target).map((step) => showFoClause(step.clause)),
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: ParamodulationQuestion): ParamodulationAnswer => [...question.results]

function check(question: ParamodulationQuestion, answer: ParamodulationAnswer): Verdict {
  const wanted = new Set(question.results)
  const found = new Set(answer)
  const missed = [...wanted].filter((entry) => !found.has(entry)).length
  const extra = [...found].filter((entry) => !wanted.has(entry)).length

  if (missed === 0 && extra === 0) {
    return {
      correct: true,
      message: `All ${wanted.size} found`,
      detail:
        'One occurrence per step, and the equation reads both ways — so a term appearing twice gives two different results rather than one.',
    }
  }

  return {
    correct: false,
    // Counts, never clauses.
    message: missed > 0 ? `${missed} still to find` : `${extra} of those repeat`,
    score: wanted.size === 0 ? 0 : Math.max(0, (wanted.size - missed - extra) / wanted.size),
    detail:
      'Look at every subterm of every literal, not just the whole arguments — and remember the equation can be used from right to left as well.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<ParamodulationQuestion, ParamodulationAnswer>) {
  const { equation, target } = useMemo(() => clausesOf(question), [question])
  const steps = useMemo(() => paramodulants(equation, target), [equation, target])
  const [found, setFound] = useState<string[]>([])

  useEffect(() => {
    setFound([])
  }, [question])

  const take = (index: number) => {
    if (locked) return
    const step = steps[index]
    if (step === undefined) return
    const printed = showFoClause(step.clause)
    if (found.includes(printed)) return
    setFound((previous) => [...previous, printed])
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Rewrite inside the clause
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {found.length} of {question.results.length}
        </p>
      </div>

      <div className="mt-2 flex flex-col gap-1">
        <div className="tile bg-card-shade px-3 py-1.5">
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-ink-soft">
            the equation
          </p>
          <FoClauseText clause={equation} className="text-base font-bold" />
        </div>
        <div className="tile bg-card-shade px-3 py-1.5">
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-ink-soft">
            being rewritten
          </p>
          <FoClauseText clause={target} className="text-base font-bold" />
        </div>
      </div>

      {!locked && (
        <>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
            Every place the equation applies
          </p>
          <div className="mt-1 flex max-h-72 flex-col gap-1 overflow-y-auto">
            {steps.map((step, index) => {
              const printed = showFoClause(step.clause)
              const taken = found.includes(printed)
              return (
                <button
                  key={index}
                  type="button"
                  disabled={taken}
                  onClick={() => take(index)}
                  className={`tile flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left
                    focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                    ${taken ? 'bg-card-shade opacity-60' : 'bg-card hover:bg-card-shade'}`}
                >
                  <span className="formula text-sm font-bold">{printed}</span>
                  <span className="formula text-[0.6rem] font-bold uppercase tracking-wider text-ink-soft">
                    in {showFoLiteral(step.into)} at {showPosition(step.position)} ·{' '}
                    {step.reversed ? 'right to left' : 'left to right'}
                    {Object.keys(step.sigma).length > 0 && ` · ${showSubstitution(step.sigma)}`}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">Your tray</p>
      <div className="mt-1">
        <ProgressBar value={found.length} total={question.results.length} />
      </div>
      <MovingList className="mt-1 flex flex-col gap-1">
        {(locked ? question.results : found).map((entry) => (
          <MovingItem
            key={entry}
            id={entry}
            disabled
            className="tile bg-grass px-3 py-1.5 text-left text-white"
          >
            <span className="formula text-sm font-bold">{entry}</span>
          </MovingItem>
        ))}
        {found.length === 0 && !locked && (
          <p className="rounded-xl bg-card-shade px-3 py-2 text-sm font-semibold text-ink-soft">
            Nothing yet.
          </p>
        )}
      </MovingList>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-xs font-semibold text-ink-soft">
          Each result replaces one occurrence. Replacing two at once is two steps, not one.
        </Pop>
      )}

      {!locked && (
        <Button variant="coin" className="mt-3 w-full" onClick={() => submit(found)}>
          {found.length === question.results.length
            ? 'Submit'
            : `Submit — ${question.results.length - found.length} still out there`}
        </Button>
      )}
    </Card>
  )
}

export const paramodulationGame = defineMinigame<ParamodulationQuestion, ParamodulationAnswer>({
  id: 'paramodulation',
  title: 'Rewrite Inside',
  tagline: 'One occurrence, either direction, anywhere in the term.',
  topics: ['fo-equality'],
  icon: '🔁',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: ParamodulationGuide,
  questionKey: (question) => `${question.equation}|${question.target}`,
})
