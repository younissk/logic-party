/**
 * Derivable in one step only — Exercise 2.
 *
 * The multi-step question asks what resolution can reach eventually. This one
 * asks what it can reach *now*, which is a different skill: you are looking
 * for a single pair whose resolvent is exactly the target, and often there
 * isn't one.
 *
 * So it is a pairing game. Tap two clauses; if they clash on more than one
 * variable you pick the pivot; the resolvent slides out and you see whether it
 * is what you were after. Saying "not in one step" is a real answer and is
 * correct about a third of the time.
 */

import { useEffect, useState } from 'react'
import type { Clause } from '@/logic'
import {
  clauseKey,
  isTautologicalClause,
  normaliseClause,
  resolveOn,
  resolvents,
  showClause,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'
import { MovingItem, MovingList, Pop, Shakeable, useShake } from '@/ui/motion'
import { OneStepGuide } from './oneStep.guide'

export interface OneStepQuestion {
  clauses: Clause[]
  target: Clause
  /** Indices of a pair that works, or null when none does. */
  pair: [number, number] | null
  pivot: string | null
}

export type OneStepAnswer = { kind: 'pair'; left: number; right: number; pivot: string } | { kind: 'none' }

interface Profile {
  variables: string[]
  clauses: [min: number, max: number]
  width: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['a', 'b', 'c'], clauses: [3, 4], width: [2, 2] },
  medium: { variables: ['a', 'b', 'c', 'd'], clauses: [4, 5], width: [2, 3] },
  hard: { variables: ['a', 'b', 'c', 'd', 'e'], clauses: [5, 6], width: [2, 3] },
}

const ATTEMPTS = 400

function generate({ rng, difficulty }: GenerateContext): OneStepQuestion {
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

    const reachable: { clause: Clause; pair: [number, number]; pivot: string }[] = []
    for (let i = 0; i < clauses.length; i++) {
      for (let j = i + 1; j < clauses.length; j++) {
        for (const step of resolvents(clauses[i] as Clause, clauses[j] as Clause)) {
          if (isTautologicalClause(step.resolvent)) continue
          if (step.resolvent.length === 0) continue
          reachable.push({ clause: step.resolvent, pair: [i, j], pivot: step.pivot })
        }
      }
    }
    if (reachable.length === 0) continue

    // A third of the time, ask about something that is *not* one step away —
    // knowing when to stop looking is half the skill.
    if (rng.bool(0.33)) {
      const decoy = normaliseClause(
        rng
          .sample(profile.variables, Math.min(2, profile.variables.length))
          .map((name) => ({ name, negated: rng.bool() })),
      )
      if (isTautologicalClause(decoy)) continue
      if (reachable.some((entry) => clauseKey(entry.clause) === clauseKey(decoy))) continue
      if (clauses.some((clause) => clauseKey(clause) === clauseKey(decoy))) continue
      return { clauses, target: decoy, pair: null, pivot: null }
    }

    const chosen = rng.pick(reachable)
    return { clauses, target: chosen.clause, pair: chosen.pair, pivot: chosen.pivot }
  }

  const clauses: Clause[] = [
    [
      { name: 'a', negated: false },
      { name: 'b', negated: false },
    ],
    [
      { name: 'a', negated: true },
      { name: 'c', negated: false },
    ],
  ]
  return {
    clauses,
    target: normaliseClause([
      { name: 'b', negated: false },
      { name: 'c', negated: false },
    ]),
    pair: [0, 1],
    pivot: 'a',
  }
}

const solve = (question: OneStepQuestion): OneStepAnswer =>
  question.pair === null || question.pivot === null
    ? { kind: 'none' }
    : { kind: 'pair', left: question.pair[0], right: question.pair[1], pivot: question.pivot }

function check(question: OneStepQuestion, answer: OneStepAnswer): Verdict {
  if (answer.kind === 'none') {
    if (question.pair === null) {
      return {
        correct: true,
        message: 'Right — no single step reaches it',
        detail: `Every pair either shares no variable, clashes nowhere, or gives something else. ${showClause(
          question.target,
        )} may still be derivable in more than one step — this question is only about one.`,
      }
    }
    const [left, right] = question.pair
    return {
      correct: false,
      message: 'There is a pair that works',
      detail: `${showClause(question.clauses[left] as Clause)} and ${showClause(
        question.clauses[right] as Clause,
      )} resolve on ${question.pivot} to give it.`,
    }
  }

  const left = question.clauses[answer.left]
  const right = question.clauses[answer.right]
  if (left === undefined || right === undefined) {
    return { correct: false, message: 'That is not a pair of clauses on the table' }
  }

  const resolvent = resolveOn(left, right, answer.pivot)
  if (resolvent === null) {
    return { correct: false, message: 'Those two do not clash on that variable' }
  }
  if (clauseKey(resolvent) !== clauseKey(question.target)) {
    return {
      correct: false,
      message: `That gives ${showClause(resolvent)}`,
      detail: `The target is ${showClause(question.target)}. Keep looking, or decide no single step reaches it.`,
    }
  }

  return {
    correct: true,
    message: `${showClause(question.target)} in one step`,
    detail: `Res_${answer.pivot} of ${showClause(left)} and ${showClause(right)}.`,
  }
}

// ---------------------------------------------------------------------------

function Screen({ question, submit, locked, solution }: MinigameScreenProps<OneStepQuestion, OneStepAnswer>) {
  const [selected, setSelected] = useState<number | null>(null)
  const [pivots, setPivots] = useState<{ a: number; b: number; options: string[] } | null>(null)
  const [tried, setTried] = useState<{ clause: Clause; pivot: string } | null>(null)
  const [shaking, shake] = useShake()

  useEffect(() => {
    setSelected(null)
    setPivots(null)
    setTried(null)
  }, [question])

  const attempt = (a: number, b: number, pivot: string) => {
    const left = question.clauses[a] as Clause
    const right = question.clauses[b] as Clause
    const resolvent = resolveOn(left, right, pivot)
    if (resolvent === null) return
    setTried({ clause: resolvent, pivot })
    if (clauseKey(resolvent) === clauseKey(question.target)) {
      submit({ kind: 'pair', left: a, right: b, pivot })
    } else {
      shake()
    }
  }

  const pick = (index: number) => {
    if (locked || pivots !== null) return
    if (selected === null) {
      setSelected(index)
      return
    }
    if (selected === index) {
      setSelected(null)
      return
    }

    const options = resolvents(question.clauses[selected] as Clause, question.clauses[index] as Clause)
    setSelected(null)
    if (options.length === 0) {
      setTried(null)
      shake()
      return
    }
    if (options.length === 1) {
      attempt(selected, index, (options[0] as { pivot: string }).pivot)
      return
    }
    setPivots({ a: selected, b: index, options: options.map((option) => option.pivot) })
  }

  const answer = locked ? solution : null

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        One step to the target
      </p>

      <div className="tile mt-2 bg-plum px-3 py-2 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">Target</p>
        <ClauseText clause={question.target} className="text-xl font-bold text-white" />
      </div>

      <p className="mt-2 text-xs font-medium text-ink-soft">
        Tap two clauses to resolve them. One resolution step only — no chains.
      </p>

      <Shakeable shaking={shaking}>
        <MovingList className="mt-2 flex flex-col gap-1.5">
          {question.clauses.map((clause, index) => (
            <MovingItem
              key={clauseKey(clause)}
              id={clauseKey(clause)}
              disabled={locked}
              onClick={() => pick(index)}
              className={`tile flex w-full items-center gap-2 px-3 py-2 text-left
                ${selected === index ? 'bg-space-blue text-white' : 'bg-card'}`}
            >
              <span className="w-5 shrink-0 text-xs font-bold opacity-60">{index + 1}</span>
              <ClauseText
                clause={clause}
                className={`text-base font-bold ${selected === index ? 'text-white' : ''}`}
              />
            </MovingItem>
          ))}
        </MovingList>
      </Shakeable>

      {pivots !== null && !locked && (
        <Pop className="tile mt-3 bg-coin p-3">
          <p className="text-sm font-bold">
            They clash on {pivots.options.length} variables. One pivot per step.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pivots.options.map((pivot) => (
              <Button
                key={pivot}
                variant="secondary"
                onClick={() => {
                  attempt(pivots.a, pivots.b, pivot)
                  setPivots(null)
                }}
              >
                {pivot}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setPivots(null)}>
              Cancel
            </Button>
          </div>
        </Pop>
      )}

      {tried !== null && !locked && (
        <Pop className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-card-shade px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            on {tried.pivot} gives
          </span>
          <ClauseText clause={tried.clause} className="text-base font-bold" />
          <span className="ml-auto text-xs font-bold text-space-red">not the target</span>
        </Pop>
      )}

      {!locked && (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => submit({ kind: 'none' })}>
          No single step reaches it
        </Button>
      )}

      {locked && answer !== null && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          {answer.kind === 'none' ? (
            <p>No pair of these clauses resolves to the target in one step.</p>
          ) : (
            <p>
              <ClauseText clause={question.clauses[answer.left] as Clause} className="font-bold" /> and{' '}
              <ClauseText clause={question.clauses[answer.right] as Clause} className="font-bold" /> on{' '}
              <span className="formula font-bold">{answer.pivot}</span>.
            </p>
          )}
        </Pop>
      )}
    </Card>
  )
}

export const oneStepGame = defineMinigame<OneStepQuestion, OneStepAnswer>({
  id: 'one-step',
  title: 'One Move',
  tagline: 'Reach the target in a single resolution, or prove you cannot.',
  topics: ['resolution'],
  icon: '🎱',
  roundSeconds: 180,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  Screen,
  Guide: OneStepGuide,
  questionKey: (question) => `${clauseKey(question.target)}|${question.clauses.map(clauseKey).join(';')}`,
})
