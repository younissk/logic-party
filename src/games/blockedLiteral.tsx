/**
 * Blocked clause with a *named* blocking literal — Exercise 3, Quiz 1.
 *
 * Different question from eliminating everything: here one clause is under the
 * microscope and you have to say *which literal* blocks it, or that none does.
 *
 * So you tap the literal itself, inside the clause. Every clause containing its
 * complement then deals itself out as a card, each showing its resolvent and
 * whether that resolvent is a tautology — because the definition is a
 * for-all, and a single non-tautology anywhere kills it. A literal whose
 * complement appears nowhere deals no cards at all, which is what "vacuously
 * blocked" looks like.
 */

import { useEffect, useMemo, useState } from 'react'
import type { Clause, Literal } from '@/logic'
import {
  blockingLiteral,
  clauseKey,
  isBlockedOn,
  isTautologicalClause,
  normaliseClause,
  pureLiterals,
  resolveOn,
  showClause,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'
import { Pop, Shakeable, useShake } from '@/ui/motion'
import { BlockedLiteralGuide } from './blockedLiteral.guide'

export interface BlockedLiteralQuestion {
  clauses: Clause[]
  /** Index into `clauses` of the one under the microscope. */
  target: number
  /** Index into that clause of a blocking literal, or null when none blocks. */
  answer: number | null
}

export type BlockedLiteralAnswer = number | null

const literalKey = (literal: Literal) => `${literal.negated ? '¬' : ''}${literal.name}`

interface Profile {
  variables: string[]
  clauses: [min: number, max: number]
  width: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['a', 'b', 'c', 'd'], clauses: [3, 4], width: [2, 3] },
  medium: { variables: ['a', 'b', 'c', 'd', 'e'], clauses: [4, 5], width: [2, 3] },
  hard: { variables: ['a', 'b', 'c', 'd', 'e'], clauses: [5, 6], width: [3, 4] },
}

const ATTEMPTS = 400

function generate({ rng, difficulty }: GenerateContext): BlockedLiteralQuestion {
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

    const target = rng.int(clauses.length)
    const clause = clauses[target] as Clause
    const blocking = clause.findIndex((literal) => isBlockedOn(clauses, clause, literal))

    // Half the questions should be non-vacuous — a literal whose complement
    // really does appear, where the resolvents have to be checked. Otherwise
    // the game is only ever "spot the pure literal".
    if (blocking >= 0) {
      const literal = clause[blocking] as Literal
      const pure = pureLiterals(clauses).some((entry) => literalKey(entry) === literalKey(literal))
      if (pure && !rng.bool(0.4)) continue
    }

    return { clauses, target, answer: blocking >= 0 ? blocking : null }
  }

  // Last resort: the notes' own non-vacuous case.
  const clauses: Clause[] = [
    normaliseClause([
      { name: 'a', negated: false },
      { name: 'b', negated: false },
    ]),
    normaliseClause([
      { name: 'a', negated: true },
      { name: 'b', negated: true },
    ]),
    normaliseClause([
      { name: 'b', negated: false },
      { name: 'c', negated: false },
    ]),
  ]
  const clause = clauses[0] as Clause
  return {
    clauses,
    target: 0,
    answer: clause.findIndex((literal) => isBlockedOn(clauses, clause, literal)),
  }
}

const solve = (question: BlockedLiteralQuestion): BlockedLiteralAnswer => question.answer

function check(question: BlockedLiteralQuestion, answer: BlockedLiteralAnswer): Verdict {
  const clause = question.clauses[question.target] as Clause

  if (answer === null) {
    if (question.answer === null) {
      return {
        correct: true,
        message: 'Not blocked on any literal',
        detail: `Every literal of ${showClause(clause)} has some clause with its complement whose resolvent is not a tautology.`,
      }
    }
    const literal = clause[question.answer] as Literal
    return {
      correct: false,
      message: 'It is blocked',
      detail: `On ${literalKey(literal)} — every clause containing ${literalKey({ ...literal, negated: !literal.negated })} resolves with it to a tautology.`,
    }
  }

  const literal = clause[answer]
  if (literal === undefined) return { correct: false, message: 'Not a literal of this clause' }

  if (isBlockedOn(question.clauses, clause, literal)) {
    const pure = pureLiterals(question.clauses).some((entry) => literalKey(entry) === literalKey(literal))
    return {
      correct: true,
      message: `Blocked on ${literalKey(literal)}`,
      detail: pure
        ? `${literalKey({ ...literal, negated: !literal.negated })} appears nowhere, so there was nothing to check — vacuously blocked.`
        : `Every clause containing ${literalKey({ ...literal, negated: !literal.negated })} resolves with it to a tautology.`,
    }
  }

  const opposite = { name: literal.name, negated: !literal.negated }
  const culprit = question.clauses
    .filter((other) => clauseKey(other) !== clauseKey(clause))
    .filter((other) => other.some((entry) => literalKey(entry) === literalKey(opposite)))
    .find((other) => {
      const resolvent = resolveOn(clause, other, literal.name)
      return resolvent !== null && !isTautologicalClause(resolvent)
    })

  return {
    correct: false,
    message: `Not blocked on ${literalKey(literal)}`,
    detail:
      culprit === undefined
        ? 'That literal is not in the clause in that polarity.'
        : `Resolving with ${showClause(culprit)} gives ${showClause(
            resolveOn(clause, culprit, literal.name) as Clause,
          )}, which is not a tautology. One is enough to break it.`,
  }
}

// ---------------------------------------------------------------------------

function Screen({ question, submit, locked, solution }: MinigameScreenProps<BlockedLiteralQuestion, BlockedLiteralAnswer>) {
  const [inspecting, setInspecting] = useState<number | null>(null)
  const [shaking, shake] = useShake()

  useEffect(() => {
    setInspecting(null)
  }, [question])

  const clause = question.clauses[question.target] as Clause
  const others = useMemo(
    () => question.clauses.filter((_, index) => index !== question.target),
    [question],
  )

  const shown = locked ? solution ?? null : inspecting
  const literal = shown === null ? null : clause[shown] ?? null

  const cards = useMemo(() => {
    if (literal === null) return []
    const opposite = { name: literal.name, negated: !literal.negated }
    return others
      .filter((other) => other.some((entry) => literalKey(entry) === literalKey(opposite)))
      .map((other) => {
        const resolvent = resolveOn(clause, other, literal.name)
        return {
          other,
          resolvent,
          tautology: resolvent !== null && isTautologicalClause(resolvent),
        }
      })
  }, [literal, others, clause])

  const blocked = literal !== null && isBlockedOn(question.clauses, clause, literal)

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Which literal blocks it?
      </p>

      <div className="mt-2 flex flex-col gap-1.5">
        {others.map((other, index) => (
          <div key={index} className="rounded-xl bg-card-shade px-3 py-1.5">
            <ClauseText clause={other} className="text-sm font-bold" />
          </div>
        ))}
      </div>

      <Shakeable shaking={shaking}>
        <div className="tile mt-3 bg-coin p-3">
          <p className="text-xs font-bold uppercase tracking-wider">Under the microscope</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="formula text-xl font-bold">(</span>
            {clause.map((entry, index) => (
              <span key={literalKey(entry)} className="flex items-center gap-1.5">
                {index > 0 && <span className="formula font-bold">∨</span>}
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => setInspecting(shown === index ? null : index)}
                  className={`chunky formula h-10 px-3 text-base font-bold
                    ${shown === index ? 'bg-space-blue text-white' : 'bg-card text-ink hover:bg-white'}`}
                >
                  {literalKey(entry)}
                </button>
              </span>
            ))}
            <span className="formula text-xl font-bold">)</span>
          </div>
          <p className="mt-1.5 text-xs font-semibold">
            Tap a literal to check it. Every clause with its complement has to resolve to a tautology.
          </p>
        </div>
      </Shakeable>

      {literal !== null && (
        <Pop className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Clauses containing {literalKey({ name: literal.name, negated: !literal.negated })}
          </p>
          {cards.length === 0 ? (
            <p className="mt-1 rounded-xl bg-grass px-3 py-2 text-sm font-bold text-white">
              None at all — the condition holds vacuously, so it is blocked.
            </p>
          ) : (
            <div className="mt-1 flex flex-col gap-1.5">
              {cards.map((card, index) => (
                <Pop key={index} delay={index * 0.06}>
                  <div
                    className={`tile flex flex-wrap items-center gap-2 px-3 py-2 text-sm
                      ${card.tautology ? 'bg-grass text-white' : 'bg-space-red text-white'}`}
                  >
                    <ClauseText clause={card.other} className="font-bold" />
                    <span className="opacity-80">→</span>
                    {card.resolvent === null ? (
                      <span className="font-bold">—</span>
                    ) : (
                      <ClauseText clause={card.resolvent} className="font-bold" />
                    )}
                    <span className="ml-auto whitespace-nowrap text-xs font-bold">
                      {card.tautology ? 'tautology ✓' : 'not a tautology ✗'}
                    </span>
                  </div>
                </Pop>
              ))}
            </div>
          )}
          {!locked && (
            <Button
              variant={blocked ? 'coin' : 'secondary'}
              className="mt-2 w-full"
              onClick={() => {
                if (!blocked) {
                  shake()
                  return
                }
                submit(shown)
              }}
            >
              {blocked ? `It is blocked on ${literalKey(literal)}` : 'This one does not block it'}
            </Button>
          )}
        </Pop>
      )}

      {!locked && (
        <Button variant="secondary" className="mt-2 w-full" onClick={() => submit(null)}>
          No literal blocks it
        </Button>
      )}

      {locked && solution === null && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          Nothing blocks this clause: {blockingLiteral(question.clauses, clause) === null ? 'every' : 'some'}{' '}
          literal has a clause whose resolvent survives.
        </Pop>
      )}
    </Card>
  )
}

export const blockedLiteralGame = defineMinigame<BlockedLiteralQuestion, BlockedLiteralAnswer>({
  id: 'blocked-literal',
  title: 'Under the Microscope',
  tagline: 'Find the literal that blocks it, or prove none does.',
  topics: ['resolution'],
  icon: '🔬',
  roundSeconds: 180,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  Screen,
  Guide: BlockedLiteralGuide,
  questionKey: (question) => `${question.target}|${question.clauses.map(clauseKey).join(';')}`,
})
