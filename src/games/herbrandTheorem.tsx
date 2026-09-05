/**
 * Herbrand's theorem — ln.pdf §4.3, Theorem 4.21.
 *
 * "A set of first-order clauses is unsatisfiable if and only if there exists a
 * finite unsatisfiable set of ground instances of it." The theorem is an
 * existence claim, and the way to feel what it claims is to go and find the
 * set — from an expansion that is already laid out in front of you.
 *
 * Two things the exercise turns on. The witness is usually much smaller than
 * the expansion, so picking everything is not an answer. And some clause sets
 * are satisfiable, in which case no subset works at all and the honest answer
 * is to say so.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  findFoRefutation,
  parseFoClauseSet,
  type FoClause,
  type FoSignature,
  type Signature,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'
import { Pop } from '@/ui/motion'
import { HerbrandTheoremGuide } from './herbrandTheorem.guide'

export interface HerbrandTheoremQuestion {
  predicates: Record<string, number>
  functions: Signature
  /** The ground clauses on offer — a slice of somebody's expansion. */
  ground: string[]
  /** The size of the smallest unsatisfiable subset, or 0 if there is none. */
  par: number
}

/** Indices into `ground` that were selected. Empty claims there is no subset. */
export type HerbrandTheoremAnswer = number[]

const signatureOf = (question: HerbrandTheoremQuestion): FoSignature => ({
  predicates: question.predicates,
  functions: question.functions,
})

export const groundOf = (question: HerbrandTheoremQuestion): FoClause[] =>
  parseFoClauseSet(question.ground, signatureOf(question))

export const isUnsatisfiable = (clauses: readonly FoClause[]): boolean =>
  clauses.length > 0 && findFoRefutation([...clauses], 300).refuted

/** The smallest unsatisfiable subset, or null when the whole set is fine. */
export function smallestSubset(question: HerbrandTheoremQuestion): number[] | null {
  const ground = groundOf(question)
  if (!isUnsatisfiable(ground)) return null
  for (let size = 1; size <= ground.length; size++) {
    for (const subset of choose(ground.length, size)) {
      if (isUnsatisfiable(subset.map((index) => ground[index] as FoClause))) return subset
    }
  }
  return null
}

function* choose(total: number, size: number, start = 0): Generator<number[]> {
  if (size === 0) {
    yield []
    return
  }
  for (let index = start; index <= total - size; index++) {
    for (const rest of choose(total, size - 1, index + 1)) yield [index, ...rest]
  }
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  predicates: Record<string, number>
  functions: Signature
  sets: string[][]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    predicates: { p: 1 },
    functions: { a: 0, f: 1 },
    sets: [
      ['p(a())', '¬p(a())', 'p(f(a()))'],
      ['p(a())', 'p(f(a()))', '¬p(f(a()))'],
      ['p(a())', 'p(f(a()))', '¬p(f(f(a())))'],
    ],
  },
  medium: {
    predicates: { p: 1, q: 1 },
    functions: { a: 0, b: 0 },
    sets: [
      ['p(a()) ∨ q(a())', '¬p(a())', '¬q(a())', 'p(b())'],
      ['p(a()) ∨ q(b())', '¬q(b())', 'p(b()) ∨ q(a())', '¬p(a())'],
      ['p(a()) ∨ q(a())', 'p(b())', '¬q(b())'],
    ],
  },
  hard: {
    predicates: { p: 2, q: 1 },
    functions: { a: 0, b: 0 },
    sets: [
      [
        'p(a(),a()) ∨ ¬q(a())',
        '¬p(a(),a())',
        '¬p(a(),b())',
        'p(a(),b()) ∨ q(a())',
        'q(b())',
      ],
      [
        'p(a(),b()) ∨ p(b(),a())',
        '¬p(a(),b())',
        '¬p(b(),a())',
        'q(a()) ∨ p(a(),a())',
      ],
      ['p(a(),b()) ∨ q(a())', '¬q(a())', 'q(b()) ∨ p(b(),b())'],
    ],
  },
}

function generate({ rng, difficulty }: GenerateContext): HerbrandTheoremQuestion {
  const profile = PROFILES[difficulty]
  const signature: FoSignature = {
    predicates: profile.predicates,
    functions: profile.functions,
  }
  // Draw the answer first, so "no such subset" is a live answer.
  const wanted = rng.bool()

  for (const set of rng.shuffle(profile.sets)) {
    try {
      parseFoClauseSet(set, signature)
    } catch {
      continue
    }
    const question: HerbrandTheoremQuestion = {
      predicates: profile.predicates,
      functions: profile.functions,
      ground: set,
      par: 0,
    }
    const subset = smallestSubset(question)
    if ((subset !== null) !== wanted) continue
    // A witness that is the whole set teaches nothing about "finite subset".
    if (subset !== null && subset.length === set.length) continue
    return { ...question, par: subset?.length ?? 0 }
  }

  const fallback = ['p(a())', '¬p(a())', 'p(f(a()))']
  const question: HerbrandTheoremQuestion = {
    predicates: { p: 1 },
    functions: { a: 0, f: 1 },
    ground: fallback,
    par: 0,
  }
  return { ...question, par: smallestSubset(question)?.length ?? 0 }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: HerbrandTheoremQuestion): HerbrandTheoremAnswer =>
  smallestSubset(question) ?? []

function check(question: HerbrandTheoremQuestion, answer: HerbrandTheoremAnswer): Verdict {
  const ground = groundOf(question)
  const chosen = [...new Set(answer)].map((index) => ground[index]).filter(
    (clause): clause is FoClause => clause !== undefined,
  )

  if (chosen.length === 0) {
    if (question.par === 0) {
      return {
        correct: true,
        message: 'No unsatisfiable subset — and there is none',
        detail:
          'These ground clauses have a model, so by Theorem 4.20 the set they came from need not be unsatisfiable either.',
      }
    }
    return {
      correct: false,
      // Says one exists, never which clauses.
      message: 'There is one',
      detail: 'Look for a ground atom that appears positively in one clause and negatively in another.',
    }
  }

  if (!isUnsatisfiable(chosen)) {
    return {
      correct: false,
      message: `Those ${chosen.length} are satisfiable together`,
      score: 0.2,
      detail:
        'A subset is a witness only if nothing satisfies all of it at once. Unit clauses are the place to start: they force their atom.',
    }
  }

  return {
    correct: true,
    message:
      chosen.length === question.par
        ? `${chosen.length} clauses — the smallest witness`
        : `${chosen.length} clauses, unsatisfiable`,
    detail:
      chosen.length === question.par
        ? 'That is Herbrand’s theorem made concrete: unsatisfiability of the original, witnessed by finitely many ground instances.'
        : `${question.par} of them is already enough. Both are witnesses; the theorem only asks for a finite one.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<HerbrandTheoremQuestion, HerbrandTheoremAnswer>) {
  const ground = useMemo(() => groundOf(question), [question])
  const [picked, setPicked] = useState<number[]>([])

  useEffect(() => {
    setPicked([])
  }, [question])

  const chosen = picked.map((index) => ground[index] as FoClause)
  const broken = chosen.length > 0 && isUnsatisfiable(chosen)

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Find the finite witness
        </p>
        <p className="text-xs font-bold text-ink-soft">{picked.length} picked</p>
      </div>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Ground clauses, so this is a propositional question. Pick a subset that cannot all be true.
      </p>

      <div className="mt-2 flex flex-col gap-1.5">
        {ground.map((clause, index) => {
          const on = picked.includes(index)
          return (
            <button
              key={index}
              type="button"
              disabled={locked}
              onClick={() =>
                setPicked((previous) =>
                  previous.includes(index)
                    ? previous.filter((entry) => entry !== index)
                    : [...previous, index],
                )
              }
              className={`tile flex w-full items-center gap-2 px-3 py-2 text-left
                ${on ? 'bg-space-blue text-white' : 'bg-card'}`}
            >
              <span className="w-4 shrink-0 text-xs font-bold opacity-60">{on ? '✓' : '·'}</span>
              <FoClauseText clause={clause} className={`text-base font-bold ${on ? 'text-white' : ''}`} />
            </button>
          )
        })}
      </div>

      <p
        className={`mt-2 rounded-xl px-3 py-1.5 text-xs font-bold ${
          broken ? 'bg-grass text-white' : 'bg-card-shade text-ink-soft'
        }`}
      >
        {picked.length === 0
          ? 'Nothing picked.'
          : broken
            ? 'Those cannot all be true — that is the witness.'
            : 'Those can all be true at once.'}
      </p>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            {question.par === 0 ? 'There is no such subset' : `${question.par} is enough`}
          </p>
          {question.par > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5">
              {(smallestSubset(question) ?? []).map((index) => (
                <li key={index}>
                  <FoClauseText clause={ground[index] as FoClause} className="font-bold" />
                </li>
              ))}
            </ul>
          )}
        </Pop>
      )}

      {!locked && (
        <div className="mt-3 flex flex-col gap-2">
          <Button variant={broken ? 'coin' : 'secondary'} onClick={() => submit(picked)}>
            {broken ? `Submit — ${picked.length} clauses` : 'Submit anyway'}
          </Button>
          <Button variant="danger" onClick={() => submit([])}>
            No subset is unsatisfiable
          </Button>
        </div>
      )}
    </Card>
  )
}

export const herbrandTheoremGame = defineMinigame<
  HerbrandTheoremQuestion,
  HerbrandTheoremAnswer
>({
  id: 'herbrand-theorem',
  title: 'The Finite Witness',
  tagline: 'Theorem 4.21 promises one exists. Go and take it out.',
  topics: ['herbrand'],
  icon: '🔍',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: HerbrandTheoremGuide,
  questionKey: (question) => question.ground.join(';'),
})
