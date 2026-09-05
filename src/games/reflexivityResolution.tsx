/**
 * Reflexivity resolution — ln.pdf §4.4, Definition 4.40.
 *
 * A clause containing `s ≠ t` where s and t unify loses that literal, and the
 * mgu is applied to what remains. It is the rule that replaces the reflexivity
 * axiom: without it `∀x:x ≠ x` cannot be refuted at all, because there is
 * nothing for ordinary resolution to resolve against.
 *
 * The exam's own example is `f(x) ≠ f(a) ∨ p(x)`, which yields `p(a)`: the
 * unifier that makes the disequality false is the same one that instantiates
 * the rest of the clause.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  isEquality,
  parseFoClauseSet,
  reflexivitySteps,
  showFoClause,
  showFoLiteral,
  showSubstitution,
  type FoClause,
  type FoLiteral,
  type FoSignature,
  type Signature,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'
import { MovingItem, MovingList, Pop, ProgressBar, Shakeable, useShake } from '@/ui/motion'
import { ReflexivityGuide } from './reflexivityResolution.guide'

export interface ReflexivityQuestion {
  predicates: Record<string, number>
  functions: Signature
  clause: string
  /** Every clause derivable by one reflexivity resolution step, printed. */
  results: string[]
}

export type ReflexivityAnswer = string[]

const signatureOf = (question: ReflexivityQuestion): FoSignature => ({
  predicates: { ...question.predicates, '=': 2 },
  functions: question.functions,
})

export const clauseOf = (question: ReflexivityQuestion): FoClause =>
  parseFoClauseSet([question.clause], signatureOf(question))[0] as FoClause

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  predicates: Record<string, number>
  functions: Signature
  clauses: string[]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    predicates: { p: 1 },
    functions: { a: 0, b: 0, f: 1 },
    clauses: [
      '¬=(x,x)',
      '¬=(f(x),f(a())) ∨ p(x)',
      '¬=(x,a()) ∨ p(x)',
      '¬=(a(),b()) ∨ p(a())',
      '¬=(f(x),a()) ∨ p(x)',
    ],
  },
  medium: {
    predicates: { p: 1, q: 2 },
    functions: { a: 0, b: 0, f: 1, g: 2 },
    clauses: [
      '¬=(g(x,y),g(a(),b())) ∨ q(x,y)',
      '¬=(f(x),y) ∨ q(x,y) ∨ p(y)',
      '¬=(f(x),f(f(x))) ∨ p(x)',
      '¬=(x,f(x)) ∨ p(x)',
      '¬=(g(x,a()),g(b(),y)) ∨ p(x) ∨ q(y,y)',
    ],
  },
  hard: {
    predicates: { p: 2, q: 1 },
    functions: { a: 0, b: 0, f: 1, g: 2 },
    clauses: [
      '¬=(g(x,y),g(y,x)) ∨ p(x,y)',
      '¬=(f(x),a()) ∨ ¬=(x,b()) ∨ p(x,x)',
      '¬=(g(f(x),y),g(z,f(z))) ∨ q(x) ∨ p(y,z)',
      '¬=(x,g(x,y)) ∨ q(y)',
    ],
  },
}

function generate({ rng, difficulty }: GenerateContext): ReflexivityQuestion {
  const profile = PROFILES[difficulty]
  const signature: FoSignature = {
    predicates: { ...profile.predicates, '=': 2 },
    functions: profile.functions,
  }

  for (const source of rng.shuffle(profile.clauses)) {
    let clause: FoClause
    try {
      clause = parseFoClauseSet([source], signature)[0] as FoClause
    } catch {
      continue
    }
    const results = reflexivitySteps(clause).map((step) => showFoClause(step.clause))
    // A clause with nothing to cancel is not a question, and neither is one
    // where every disequality cancels — the point is telling them apart.
    if (results.length === 0) continue

    return {
      predicates: profile.predicates,
      functions: profile.functions,
      clause: source,
      results,
    }
  }

  const fallback = '¬=(f(x),f(a())) ∨ p(x)'
  const signature2: FoSignature = {
    predicates: { p: 1, '=': 2 },
    functions: { a: 0, f: 1 },
  }
  const clause = parseFoClauseSet([fallback], signature2)[0] as FoClause
  return {
    predicates: { p: 1 },
    functions: { a: 0, f: 1 },
    clause: fallback,
    results: reflexivitySteps(clause).map((step) => showFoClause(step.clause)),
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: ReflexivityQuestion): ReflexivityAnswer => [...question.results]

function check(question: ReflexivityQuestion, answer: ReflexivityAnswer): Verdict {
  const wanted = new Set(question.results)
  const found = new Set(answer)
  const missed = [...wanted].filter((entry) => !found.has(entry)).length
  const extra = [...found].filter((entry) => !wanted.has(entry)).length

  if (missed === 0 && extra === 0) {
    return {
      correct: true,
      message: wanted.size === 1 ? 'Found it' : `All ${wanted.size} found`,
      detail:
        'The mgu that makes the disequality false is applied to everything else in the clause — that is where the instantiation in the result comes from.',
    }
  }

  return {
    correct: false,
    // Counts, never clauses.
    message: missed > 0 ? `${missed} still to find` : `${extra} of those repeat`,
    score: wanted.size === 0 ? 0 : Math.max(0, (wanted.size - missed - extra) / wanted.size),
    detail:
      'Only a *negated* equality can be cancelled, and only when its two sides unify. A disequality whose sides clash, or whose sides need the occurs check, stays put.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<ReflexivityQuestion, ReflexivityAnswer>) {
  const clause = useMemo(() => clauseOf(question), [question])
  const [found, setFound] = useState<string[]>([])
  const [shaking, shake] = useShake()

  useEffect(() => {
    setFound([])
  }, [question])

  const cancel = (literal: FoLiteral) => {
    if (locked) return
    const step = reflexivitySteps(clause).find((candidate) => candidate.literal === literal)
    if (step === undefined) return shake()
    const printed = showFoClause(step.clause)
    if (found.includes(printed)) return shake()
    setFound((previous) => [...previous, printed])
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Cancel a disequality
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {found.length} of {question.results.length}
        </p>
      </div>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Tap a literal of the form s ≠ t whose two sides unify. Everything else is instantiated by the
        same unifier.
      </p>

      <Shakeable shaking={shaking}>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {clause.map((literal, index) => {
            const cancellable = isEquality(literal) && literal.negated
            return (
              <button
                key={index}
                type="button"
                disabled={locked}
                onClick={() => cancel(literal)}
                className={`chunky min-h-10 px-3 text-sm font-bold
                  focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                  ${cancellable ? 'bg-coin text-ink' : 'bg-card text-ink-soft'}`}
              >
                <span className="formula">{showFoLiteral(literal)}</span>
              </button>
            )
          })}
        </div>
      </Shakeable>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
        What you derived
      </p>
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
            <span className="formula text-base font-bold">{entry === '□' ? '□' : entry}</span>
          </MovingItem>
        ))}
        {found.length === 0 && !locked && (
          <p className="rounded-xl bg-card-shade px-3 py-2 text-sm font-semibold text-ink-soft">
            Nothing yet.
          </p>
        )}
      </MovingList>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Every step, with its unifier
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {reflexivitySteps(clause).map((step, index) => (
              <li key={index} className="formula text-xs font-semibold text-ink-soft">
                {showFoLiteral(step.literal)} · {showSubstitution(step.sigma)} →{' '}
                {showFoClause(step.clause)}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            <FoClauseText clause={clause} className="text-sm font-bold" />
          </p>
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

export const reflexivityGame = defineMinigame<ReflexivityQuestion, ReflexivityAnswer>({
  id: 'reflexivity-resolution',
  title: 'Cancel The Disequality',
  tagline: 'If the two sides unify, the literal is false — and it goes.',
  topics: ['fo-equality'],
  icon: '≠',
  roundSeconds: 150,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  Screen,
  Guide: ReflexivityGuide,
  questionKey: (question) => question.clause,
})
