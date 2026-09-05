/**
 * The bonus question of exam26bA.
 *
 * "Let φ be a propositional formula in which the literal l is pure. Show that
 * any clause C of φ with l ∈ C is a blocked clause."
 *
 * The proof is two lines and the second one is the point. Blockedness of C on
 * l (Definition 2.33) asks that for every clause D of φ containing ¬l, the
 * resolvent of C and D on l is a tautology. If l is pure then ¬l occurs
 * nowhere, so there are no such D — and a condition over an empty set holds
 * vacuously. No resolvent ever has to be computed.
 *
 * So the game is that argument, carried out on a formula: find a literal whose
 * complement occurs nowhere, then collect every clause it appears in. Those
 * clauses are exactly the ones the bonus proves blocked, and the app confirms
 * it against `isBlockedOn` — which does the general check, not the shortcut.
 */

import { useEffect, useMemo, useState } from 'react'
import type { Clause, Literal } from '@/logic'
import {
  clauseKey,
  isBlockedOn,
  isTautologicalClause,
  literalsEqual,
  normaliseClause,
  pureLiterals,
  showClause,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'
import { MovingItem, MovingList, Pop } from '@/ui/motion'
import { PureMeansBlockedGuide } from './pureMeansBlocked.guide'

export interface PureQuestion {
  clauses: Clause[]
}

export interface PureAnswer {
  /** The literal claimed pure; null means "there is none". */
  literal: Literal | null
  /** Indices of the clauses containing it. */
  clauses: number[]
}

export const literalKey = (literal: Literal): string =>
  `${literal.negated ? '¬' : ''}${literal.name}`

/** Every literal occurring anywhere, in a stable order. */
export function literalsOf(question: PureQuestion): Literal[] {
  const seen = new Map<string, Literal>()
  for (const clause of question.clauses) {
    for (const literal of clause) seen.set(literalKey(literal), literal)
  }
  return [...seen.values()].sort((a, b) =>
    a.name === b.name ? Number(a.negated) - Number(b.negated) : a.name < b.name ? -1 : 1,
  )
}

export const clausesContaining = (question: PureQuestion, literal: Literal): number[] =>
  question.clauses
    .map((clause, index) => ({ clause, index }))
    .filter(({ clause }) => clause.some((entry) => literalsEqual(entry, literal)))
    .map(({ index }) => index)

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  variables: string[]
  clauses: [number, number]
  width: [number, number]
  /** How often to deal a formula with no pure literal at all. */
  none: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['a', 'b', 'c', 'd'], clauses: [3, 4], width: [2, 3], none: 0.15 },
  medium: { variables: ['a', 'b', 'c', 'd', 'e'], clauses: [4, 5], width: [2, 3], none: 0.25 },
  hard: { variables: ['a', 'b', 'c', 'd', 'e', 'f'], clauses: [5, 6], width: [2, 4], none: 0.3 },
}

function generate({ rng, difficulty }: GenerateContext): PureQuestion {
  const profile = PROFILES[difficulty]
  const wantNone = rng.bool(profile.none)

  for (let attempt = 0; attempt < 400; attempt++) {
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

    const pure = pureLiterals(clauses)
    if (wantNone ? pure.length !== 0 : pure.length === 0) continue
    // With every literal pure the formula is trivial and the question is not
    // really being asked.
    if (!wantNone && pure.length > 3) continue
    return { clauses }
  }

  // Last resort, so a round never stalls: a formula with one pure literal.
  const clause = (entries: [string, boolean][]): Clause =>
    normaliseClause(entries.map(([name, negated]) => ({ name, negated })))
  return {
    clauses: [
      clause([
        ['a', false],
        ['b', false],
      ]),
      clause([
        ['a', true],
        ['c', false],
      ]),
      clause([
        ['b', true],
        ['c', false],
      ]),
    ],
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

function solve(question: PureQuestion): PureAnswer {
  const pure = pureLiterals(question.clauses)
  const literal = pure[0]
  if (literal === undefined) return { literal: null, clauses: [] }
  return { literal, clauses: clausesContaining(question, literal) }
}

function check(question: PureQuestion, answer: PureAnswer): Verdict {
  const pure = pureLiterals(question.clauses)

  if (answer.literal === null) {
    return pure.length === 0
      ? {
          correct: true,
          message: 'Nothing is pure here — every literal meets its complement',
          detail:
            'The bonus only says a pure literal makes its clauses blocked. Without one, blockedness has to be checked the long way, resolvent by resolvent.',
        }
      : {
          correct: false,
          // Never names the literal.
          message: 'One of these literals never meets its complement',
          score: 0,
          detail:
            'Go variable by variable: does the formula contain the literal both plain and negated? If one form is missing, that form is pure.',
        }
  }

  const claimed = answer.literal
  if (!pure.some((literal) => literalsEqual(literal, claimed))) {
    return {
      correct: false,
      message: `${literalKey({ name: claimed.name, negated: !claimed.negated })} occurs too`,
      score: 0,
      detail: 'A pure literal is one whose complement appears nowhere in the formula.',
    }
  }

  const wanted = clausesContaining(question, claimed)
  const given = [...new Set(answer.clauses)].sort((a, b) => a - b)
  const missing = wanted.filter((index) => !given.includes(index)).length
  const extra = given.filter((index) => !wanted.includes(index)).length

  if (missing > 0 || extra > 0) {
    return {
      correct: false,
      // Counts only, never which clause.
      message:
        missing > 0
          ? `${missing} clause${missing === 1 ? '' : 's'} containing it not marked`
          : `${extra} marked clause${extra === 1 ? ' does' : 's do'} not contain it`,
      score: Math.max(0, (wanted.length - missing - extra) / Math.max(1, wanted.length)),
      detail: 'Every clause the pure literal occurs in is blocked — and only those.',
    }
  }

  // The proof, confirmed by the general definition rather than the shortcut.
  const allBlocked = wanted.every((index) =>
    isBlockedOn(question.clauses, question.clauses[index] as Clause, claimed),
  )

  return {
    correct: true,
    message: allBlocked
      ? `${wanted.length} blocked clause${wanted.length === 1 ? '' : 's'}, with nothing to resolve against`
      : 'Marked correctly',
    detail: `Blockedness on ${literalKey(claimed)} asks that every clause containing ${literalKey({ name: claimed.name, negated: !claimed.negated })} resolves to a tautology. There are none, so the condition holds vacuously — that is the whole proof.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked }: MinigameScreenProps<PureQuestion, PureAnswer>) {
  const literals = useMemo(() => literalsOf(question), [question])
  const wanted = useMemo(() => solve(question), [question])
  const [picked, setPicked] = useState<Literal | null>(null)
  const [marked, setMarked] = useState<number[]>([])

  useEffect(() => {
    setPicked(null)
    setMarked([])
  }, [question])

  const shownLiteral = locked ? wanted.literal : picked
  const shownMarks = locked ? wanted.clauses : marked
  const opposite =
    shownLiteral === null
      ? null
      : literalKey({ name: shownLiteral.name, negated: !shownLiteral.negated })
  const meets =
    shownLiteral === null
      ? []
      : question.clauses.filter((clause) =>
          clause.some(
            (entry) =>
              entry.name === shownLiteral.name && entry.negated !== shownLiteral.negated,
          ),
        )

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Pure means blocked
      </p>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Find a literal whose complement occurs nowhere, then mark every clause it appears in. Those
        are blocked, and no resolvent has to be computed.
      </p>

      <div className="mt-3 flex flex-col gap-1">
        {question.clauses.map((clause, index) => {
          const contains =
            shownLiteral !== null &&
            clause.some((entry) => literalsEqual(entry, shownLiteral))
          const right = locked && shownMarks.includes(index) === wanted.clauses.includes(index)
          return (
            <button
              key={clauseKey(clause)}
              type="button"
              disabled={locked || picked === null}
              onClick={() =>
                setMarked((previous) =>
                  previous.includes(index)
                    ? previous.filter((entry) => entry !== index)
                    : [...previous, index],
                )
              }
              className={`tile px-3 py-1.5 text-left ${
                locked
                  ? right
                    ? 'bg-grass/25'
                    : 'bg-space-red/20'
                  : shownMarks.includes(index)
                    ? 'bg-grass text-white'
                    : contains
                      ? 'bg-card-shade'
                      : 'bg-card-shade opacity-70'
              }`}
            >
              <span className="formula text-base font-bold">
                (<ClauseText clause={clause} />)
              </span>
            </button>
          )
        })}
      </div>

      {!locked && (
        <>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
            Which literal is pure?
          </p>
          <MovingList className="mt-1 flex flex-wrap gap-1.5">
            {literals.map((literal) => (
              <MovingItem
                key={literalKey(literal)}
                id={literalKey(literal)}
                onClick={() => {
                  setPicked(literal)
                  setMarked([])
                }}
                className={`tile px-2.5 py-1 formula text-sm font-bold ${
                  picked !== null && literalsEqual(picked, literal)
                    ? 'bg-grass text-white'
                    : 'bg-card'
                }`}
              >
                {literalKey(literal)}
              </MovingItem>
            ))}
          </MovingList>

          {picked !== null && (
            <p className="mt-2 rounded-xl bg-card-shade px-3 py-1.5 text-center text-sm font-bold">
              Clauses containing {opposite}: {meets.length}
              {meets.length === 0
                ? ' — nothing to resolve against'
                : ` — ${literalKey(picked)} is not pure`}
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant={picked === null ? 'secondary' : 'coin'}
              disabled={picked === null}
              onClick={() => submit({ literal: picked, clauses: marked })}
            >
              Submit these
            </Button>
            <Button
              variant="secondary"
              onClick={() => submit({ literal: null, clauses: [] })}
            >
              No pure literal here
            </Button>
          </div>
        </>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium text-ink-soft">
          {wanted.literal === null ? (
            <>Every literal in this formula meets its complement, so the shortcut does not apply.</>
          ) : (
            <>
              <span className="formula font-bold text-ink">{literalKey(wanted.literal)}</span> is
              pure, so Definition 2.33 has nothing to quantify over and each of{' '}
              {wanted.clauses.map((index) => showClause(question.clauses[index] as Clause)).join(', ')}{' '}
              is blocked.
            </>
          )}
        </Pop>
      )}
    </Card>
  )
}

export const pureMeansBlockedGame = defineMinigame<PureQuestion, PureAnswer>({
  id: 'short-proof',
  title: 'Pure Means Blocked',
  tagline: "Find the pure literal, and get its clauses' blockedness for free.",
  // Chapter 5's bonus, even though the machinery is chapter 2's — the
  // syllabus item lives here, and a game's topics decide which chapter it is
  // counted in.
  topics: ['theories'],
  icon: '🎁',
  roundSeconds: 150,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  questionKey: (question) => question.clauses.map(clauseKey).sort().join('|'),
  explain: (question) => {
    const answer = solve(question)
    return answer.literal === null
      ? 'Every literal here occurs in both forms, so no clause is blocked for free.'
      : `${literalKey(answer.literal)} is pure, so no clause contains its complement and Definition 2.33 holds vacuously for the ${answer.clauses.length} clause(s) containing it.`
  },
  Screen,
  Guide: PureMeansBlockedGuide,
})
