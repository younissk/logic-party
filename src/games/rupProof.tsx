/**
 * RUP proofs — ln.pdf §2.5, Definition 2.47, exam26a and exam26bA Q1.3.
 *
 * A clause has the RUP property when assuming it false and propagating
 * crashes. Mechanically: negate the clause — which gives one unit clause per
 * literal, and that is the only piece of notation to get wrong — add those
 * units, run BCP, look for ⊥.
 *
 * The point of RUP is that *checking* needs nothing but propagation, so this
 * game asks you to check rather than to search: which of these clauses can be
 * added at this step? More than one usually can.
 */

import { useEffect, useState } from 'react'
import type { Clause } from '@/logic'
import {
  bcp,
  clauseKey,
  hasRupProperty,
  isTautologicalClause,
  findRupProof,
  negateClause,
  normaliseClause,
  showClause,
  showClauseSet,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseList } from '@/ui/ClauseSet'
import { ClauseText } from '@/ui/ClauseText'
import { RupProofGuide } from './rupProof.guide'

export interface RupQuestion {
  /** The original formula. */
  clauses: Clause[]
  /** Lines already added to the proof — possibly none. */
  derived: Clause[]
  candidates: Clause[]
  /** Indices of candidates that have the RUP property here. */
  rup: number[]
}

export type RupAnswer = number[]

interface Profile {
  variables: string[]
  clauses: [min: number, max: number]
  width: [min: number, max: number]
  candidates: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['a', 'b'], clauses: [3, 4], width: [1, 2], candidates: 4 },
  medium: { variables: ['a', 'b', 'c'], clauses: [4, 5], width: [2, 3], candidates: 5 },
  hard: { variables: ['a', 'b', 'c', 'd'], clauses: [5, 6], width: [2, 3], candidates: 6 },
}

const ATTEMPTS = 400

function generate({ rng, difficulty }: GenerateContext): RupQuestion {
  const profile = PROFILES[difficulty]

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const count = rng.range(...profile.clauses)
    const clauses: Clause[] = []
    for (let index = 0; index < count; index++) {
      const width = Math.min(rng.range(...profile.width), profile.variables.length)
      const clause = normaliseClause(
        rng.sample(profile.variables, width).map((name) => ({ name, negated: rng.bool() })),
      )
      if (isTautologicalClause(clause)) break
      if (clauses.some((existing) => clauseKey(existing) === clauseKey(clause))) break
      clauses.push(clause)
    }
    if (clauses.length !== count) continue

    // Only formulas a RUP refutation actually exists for — otherwise the
    // exercise is not the exam's exercise.
    const proof = findRupProof(clauses)
    if (proof === null) continue

    // Sometimes ask about the first line, sometimes about a later one, so the
    // "each line makes the next easier" point is felt rather than described.
    const soFar = proof.length > 2 && rng.bool(0.4) ? proof.slice(0, 1) : []
    const context = [...clauses, ...soFar]

    const pool: Clause[] = []
    const push = (clause: Clause) => {
      if (clause.length > 0 && isTautologicalClause(clause)) return
      if (context.some((existing) => clauseKey(existing) === clauseKey(clause))) return
      if (pool.some((existing) => clauseKey(existing) === clauseKey(clause))) return
      pool.push(clause)
    }

    for (const name of profile.variables) {
      push([{ name, negated: false }])
      push([{ name, negated: true }])
    }
    for (let index = 0; index < 6; index++) {
      push(
        normaliseClause(
          rng
            .sample(profile.variables, Math.min(2, profile.variables.length))
            .map((name) => ({ name, negated: rng.bool() })),
        ),
      )
    }

    const candidates = rng.shuffle(pool).slice(0, profile.candidates - 1)
    // ⊥ is always on the list. Its RUP property is the special case worth
    // knowing — it holds exactly when BCP alone already reaches a conflict —
    // and having it there every time makes that a question rather than a
    // footnote.
    candidates.splice(rng.int(candidates.length + 1), 0, [])

    const rup = candidates
      .map((clause, index) => ({ clause, index }))
      .filter(({ clause }) => hasRupProperty(context, clause))
      .map(({ index }) => index)

    // Never all and never none, or ticking everything wins.
    if (rup.length === 0 || rup.length === candidates.length) continue

    return { clauses, derived: soFar, candidates, rup }
  }

  // Last resort, so a round can never stall: the exam's own question, with a
  // candidate list that satisfies the same never-all-never-none invariant.
  const named: [string, boolean][][] = [
    [['a', true], ['b', false]],
    [['a', true], ['b', true]],
    [['a', false], ['c', true]],
    [['a', false], ['c', false]],
  ]
  const clauses = named.map((clause) => clause.map(([name, negated]) => ({ name, negated })))
  const candidates: Clause[] = [
    [{ name: 'a', negated: true }],
    [{ name: 'b', negated: false }],
    [],
  ]
  return {
    clauses,
    derived: [],
    candidates,
    rup: candidates
      .map((clause, index) => ({ clause, index }))
      .filter(({ clause }) => hasRupProperty(clauses, clause))
      .map(({ index }) => index),
  }
}

const solve = (question: RupQuestion): RupAnswer => [...question.rup]

function check(question: RupQuestion, answer: RupAnswer): Verdict {
  const picked = new Set(answer)
  const expected = new Set(question.rup)
  const missed = [...expected].filter((index) => !picked.has(index))
  const extra = [...picked].filter((index) => !expected.has(index))

  const context = [...question.clauses, ...question.derived]

  if (missed.length === 0 && extra.length === 0) {
    return {
      correct: true,
      message: `${expected.size} can be added`,
      detail: question.rup
        .map((index) => {
          const clause = question.candidates[index] as Clause
          return `${showClause(clause)}: assume it false — add ${showClauseSet(
            negateClause(clause),
          )} — and propagation crashes.`
        })
        .join(' '),
    }
  }

  return {
    correct: false,
    message:
      missed.length > 0 && extra.length > 0
        ? `${missed.length} missed, ${extra.length} that do not crash`
        : missed.length > 0
          ? `${missed.length} missed`
          : `${extra.length} of those do not crash`,
    score: expected.size === 0 ? 0 : Math.max(0, (expected.size - missed.length - extra.length) / expected.size),
    detail: question.candidates
      .map((clause) => {
        const run = bcp([...context, ...negateClause(clause)])
        return `${showClause(clause)} → ${
          run.outcome === 'unsatisfiable' ? '⊥, so it can be added' : `${showClauseSet(run.result)}, no crash`
        }.`
      })
      .join(' '),
  }
}

function Screen({ question, submit, locked, solution }: MinigameScreenProps<RupQuestion, RupAnswer>) {
  const [picked, setPicked] = useState<number[]>([])

  useEffect(() => {
    setPicked([])
  }, [question])

  const toggle = (index: number) => {
    if (locked) return
    setPicked((previous) =>
      previous.includes(index) ? previous.filter((entry) => entry !== index) : [...previous, index],
    )
  }

  const expected = new Set(solution ?? [])
  const context = [...question.clauses, ...question.derived]

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Which have the RUP property?
      </p>

      <ClauseList set={question.clauses} className="mt-2" />

      {question.derived.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Already added to the proof
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {question.derived.map((clause, index) => (
              <span key={index} className="rounded-xl bg-coin px-2 py-1">
                <ClauseText clause={clause} className="text-sm font-bold" />
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs font-medium text-ink-soft">
        Negate the clause into units, add them, propagate. If it crashes, the clause can be added.
      </p>

      <div className="mt-2 flex flex-col gap-1.5">
        {question.candidates.map((clause, index) => {
          const isPicked = picked.includes(index)
          const shouldBe = locked && expected.has(index)
          const wrongPick = locked && isPicked && !expected.has(index)
          const run = locked ? bcp([...context, ...negateClause(clause)]) : null

          return (
            <button
              key={index}
              type="button"
              disabled={locked}
              onClick={() => toggle(index)}
              className={`tile flex flex-wrap items-center gap-2 px-3 py-2 text-left
                ${
                  locked
                    ? shouldBe
                      ? 'bg-grass text-white'
                      : wrongPick
                        ? 'bg-space-red text-white'
                        : 'bg-card-shade'
                    : isPicked
                      ? 'bg-space-blue text-white'
                      : 'bg-card'
                }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-3 border-ink text-sm font-bold
                  ${isPicked || shouldBe ? 'bg-white text-ink' : 'bg-white/60'}`}
                aria-hidden
              >
                {isPicked || shouldBe ? '✓' : ''}
              </span>
              <ClauseText
                clause={clause}
                className={`text-base font-bold ${locked && (shouldBe || wrongPick) ? 'text-white' : ''}`}
              />
              {run !== null && (
                <span className="formula ml-auto whitespace-nowrap text-xs font-bold">
                  {run.outcome === 'unsatisfiable' ? '→ ⊥' : `→ ${showClauseSet(run.result)}`}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {!locked && (
        <Button variant="coin" className="mt-4 w-full" onClick={() => submit(picked)}>
          {picked.length === 0 ? 'None of them' : `Check ${picked.length} selected`}
        </Button>
      )}
    </Card>
  )
}

export const rupGame = defineMinigame<RupQuestion, RupAnswer>({
  id: 'rup',
  title: 'Assume and Crash',
  tagline: 'Negate it, propagate, see if it falls over.',
  topics: ['proof-systems'],
  icon: '📜',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: RupProofGuide,
  questionKey: (question) =>
    `${question.clauses.map(clauseKey).join(';')}|${question.candidates.map(clauseKey).join(';')}`,
})
