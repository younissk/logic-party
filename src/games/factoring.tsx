/**
 * Factoring — ln.pdf §4.3, Definition 4.26, Exercise 9 question 1.
 *
 * Two literals of the *same* sign in one clause, unified: the clause is
 * instantiated by the mgu and the two collapse into one, because a clause is a
 * set. It exists because binary resolution alone is incomplete — the barber of
 * Example 4.25 resolves only to tautologies, and factoring is what gets ⊥ out
 * of it.
 *
 * The exercise's wrong answers are all the same mistake in different clothes:
 * dropping a literal without unifying anything, or instantiating a variable to
 * something no pair of literals demanded.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  foFactors,
  foClausesEqual,
  parseFoClauseSet,
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
import { MovingItem, MovingList, Pop, ProgressBar, Shakeable, useShake } from '@/ui/motion'
import { FactoringGuide } from './factoring.guide'

export interface FactoringQuestion {
  predicates: Record<string, number>
  functions: Signature
  clause: string
  /** Every distinct factor, printed. */
  factors: string[]
}

/** The factors produced, printed. */
export type FactoringAnswer = string[]

const signatureOf = (question: FactoringQuestion): FoSignature => ({
  predicates: question.predicates,
  functions: question.functions,
})

export const clauseOf = (question: FactoringQuestion): FoClause =>
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
    predicates: { p: 1, q: 1 },
    functions: { a: 0, b: 0, f: 1 },
    clauses: [
      'p(x) ∨ p(a())',
      'p(x) ∨ p(f(y)) ∨ q(x)',
      'p(a()) ∨ p(x) ∨ q(y)',
      '¬p(x) ∨ ¬p(a()) ∨ q(b())',
    ],
  },
  medium: {
    predicates: { p: 2, q: 1 },
    functions: { a: 0, b: 0, f: 1 },
    clauses: [
      'p(x,a()) ∨ p(b(),y) ∨ q(x)',
      'p(x,x) ∨ p(a(),y) ∨ q(y)',
      '¬p(a(),x) ∨ ¬p(y,y) ∨ q(f(x))',
      'p(f(x),y) ∨ p(z,a()) ∨ q(z)',
    ],
  },
  hard: {
    predicates: { p: 1, q: 1, shaves: 2 },
    functions: { a: 0, b: 0, f: 1, barber: 0 },
    clauses: [
      '¬shaves(barber(),x) ∨ ¬shaves(x,x)',
      'shaves(barber(),x) ∨ shaves(x,x)',
      'p(a()) ∨ p(b()) ∨ p(x) ∨ q(x) ∨ q(y) ∨ p(f(x)) ∨ ¬p(x)',
      'p(x) ∨ p(f(y)) ∨ p(f(f(a()))) ∨ q(y)',
    ],
  },
}

function generate({ rng, difficulty }: GenerateContext): FactoringQuestion {
  const profile = PROFILES[difficulty]
  const signature: FoSignature = {
    predicates: profile.predicates,
    functions: profile.functions,
  }

  for (const source of rng.shuffle(profile.clauses)) {
    let clause: FoClause
    try {
      clause = parseFoClauseSet([source], signature)[0] as FoClause
    } catch {
      continue
    }
    const found = foFactors(clause).map((factor) => showFoClause(factor.clause))
    // Something to find, and few enough to find inside a round.
    if (found.length < 1 || found.length > 5) continue

    return {
      predicates: profile.predicates,
      functions: profile.functions,
      clause: source,
      factors: found,
    }
  }

  const fallback = '¬shaves(barber(),x) ∨ ¬shaves(x,x)'
  const signature2: FoSignature = {
    predicates: { shaves: 2 },
    functions: { barber: 0 },
  }
  const clause = parseFoClauseSet([fallback], signature2)[0] as FoClause
  return {
    predicates: { shaves: 2 },
    functions: { barber: 0 },
    clause: fallback,
    factors: foFactors(clause).map((factor) => showFoClause(factor.clause)),
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: FactoringQuestion): FactoringAnswer => [...question.factors]

function check(question: FactoringQuestion, answer: FactoringAnswer): Verdict {
  const wanted = new Set(question.factors)
  const found = new Set(answer)
  const missed = [...wanted].filter((entry) => !found.has(entry)).length
  // Everything in the tray came from the board, so an extra is a duplicate.
  const extra = [...found].filter((entry) => !wanted.has(entry)).length

  if (missed === 0 && extra === 0) {
    return {
      correct: true,
      message: `All ${wanted.size} factor${wanted.size === 1 ? '' : 's'} found`,
      detail:
        'Each one unifies two literals of the same sign and applies that mgu to the whole clause. The two merge because a clause is a set.',
    }
  }

  return {
    correct: false,
    // A count, never a clause: sprint shows this before the retry.
    message: missed > 0 ? `${missed} still to find` : `${extra} of those repeat`,
    score: wanted.size === 0 ? 0 : Math.max(0, (wanted.size - missed - extra) / wanted.size),
    detail:
      'Try every pair of literals with the same sign and the same predicate. A pair that does not unify gives nothing, and a pair that unifies trivially gives the clause back.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked }: MinigameScreenProps<FactoringQuestion, FactoringAnswer>) {
  const clause = useMemo(() => clauseOf(question), [question])
  const [selected, setSelected] = useState<number | null>(null)
  const [found, setFound] = useState<string[]>([])
  const [shaking, shake] = useShake()

  useEffect(() => {
    setSelected(null)
    setFound([])
  }, [question])

  const pick = (index: number) => {
    if (locked) return
    if (selected === null) return setSelected(index)
    if (selected === index) return setSelected(null)

    const left = clause[selected] as FoLiteral
    const right = clause[index] as FoLiteral
    setSelected(null)

    const factor = foFactors(clause).find(
      (candidate) =>
        (candidate.left === left && candidate.right === right) ||
        (candidate.left === right && candidate.right === left),
    )
    if (factor === undefined) return shake()

    const printed = showFoClause(factor.clause)
    if (found.includes(printed)) return shake()
    setFound((previous) => [...previous, printed])
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Merge every pair that can merge
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {found.length} of {question.factors.length}
        </p>
      </div>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Tap two literals of the same sign. If they unify, the mgu is applied to the whole clause.
      </p>

      <Shakeable shaking={shaking}>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {clause.map((literal, index) => (
            <button
              key={index}
              type="button"
              disabled={locked}
              onClick={() => pick(index)}
              className={`chunky min-h-10 px-3 text-sm font-bold
                focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                ${selected === index ? 'bg-space-blue text-white' : 'bg-card text-ink hover:bg-card-shade'}`}
            >
              <span className="formula">{showFoLiteral(literal)}</span>
            </button>
          ))}
        </div>
      </Shakeable>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">Your tray</p>
      <div className="mt-1">
        <ProgressBar value={found.length} total={question.factors.length} />
      </div>
      <MovingList className="mt-1 flex flex-col gap-1">
        {(locked ? question.factors : found).map((entry) => (
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
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Every factor, with the pair that made it
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {foFactors(clause).map((factor, index) => (
              <li key={index} className="formula text-xs font-semibold text-ink-soft">
                {showFoLiteral(factor.left)} with {showFoLiteral(factor.right)} ·{' '}
                {showSubstitution(factor.sigma)} → {showFoClause(factor.clause)}
              </li>
            ))}
          </ul>
        </Pop>
      )}

      {!locked && (
        <Button variant="coin" className="mt-3 w-full" onClick={() => submit(found)}>
          {found.length === question.factors.length
            ? 'Submit'
            : `Submit — ${question.factors.length - found.length} still out there`}
        </Button>
      )}
    </Card>
  )
}

export const sameClause = foClausesEqual

export const factoringGame = defineMinigame<FactoringQuestion, FactoringAnswer>({
  id: 'factoring',
  title: 'Merge Them',
  tagline: 'Two literals of one sign, unified — and the clause is a set.',
  topics: ['fo-resolution'],
  icon: '🔀',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: FactoringGuide,
  questionKey: (question) => question.clause,
})
