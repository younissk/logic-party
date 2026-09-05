/**
 * The Herbrand universe — ln.pdf §4.3, Exercise 8 question 2.
 *
 * Take the constants and function symbols that actually occur in the clause
 * set, and close them up: every ground term you can build is an element. Three
 * things trip people, and all three are in the exercise's option list.
 *
 * A term with a variable in it is not in the universe — the universe is ground
 * terms only. An *atom* is not in it either; the universe holds terms, and
 * `p(a())` is a formula. And a symbol that does not occur in the clause set
 * cannot appear, however natural it looks.
 *
 * The fourth thing is the fallback: with no constant at all, one is invented,
 * because a universe has to be nonempty.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  herbrandLanguage,
  herbrandUniverse,
  parseFoClauseSet,
  showTerm,
  type FoClause,
  type FoSignature,
  type Signature,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'
import { TermText } from '@/ui/TermText'
import { MovingItem, MovingList, Pop, ProgressBar } from '@/ui/motion'
import { TermBuilder, hole, slotToTerm, type Slot } from '@/ui/TermBuilder'
import { HerbrandUniverseGuide } from './herbrandUniverse.guide'

export interface HerbrandUniverseQuestion {
  predicates: Record<string, number>
  functions: Signature
  clauses: string[]
  /** How deep to go. Depth 0 is the constants alone. */
  depth: number
  /** Every element at that depth, printed. */
  elements: string[]
  /** True when the clause set had no constant and one was invented. */
  invented: boolean
}

/** The ground terms produced, printed. */
export type HerbrandUniverseAnswer = string[]

const signatureOf = (question: HerbrandUniverseQuestion): FoSignature => ({
  predicates: question.predicates,
  functions: question.functions,
})

export const clausesOf = (question: HerbrandUniverseQuestion): FoClause[] =>
  parseFoClauseSet(question.clauses, signatureOf(question))

/** The signature the builder offers: the clause set's symbols, and no others. */
export const buildableSignature = (question: HerbrandUniverseQuestion): Signature => {
  const language = herbrandLanguage(clausesOf(question))
  const symbols: Record<string, number> = {}
  for (const constant of language.constants) symbols[(constant as { name: string }).name] = 0
  for (const [name, arity] of language.functions) symbols[name] = arity
  return symbols
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  predicates: Record<string, number>
  functions: Signature
  sets: string[][]
  depth: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    predicates: { p: 1, q: 1 },
    functions: { a: 0, b: 0, f: 1 },
    sets: [
      ['p(a())', '¬p(f(x))'],
      ['p(a()) ∨ q(b())', '¬q(x)'],
      ['¬p(x) ∨ p(f(x))', 'p(a())'],
    ],
    depth: 1,
  },
  medium: {
    predicates: { p: 1, q: 2 },
    functions: { a: 0, f: 1, g: 1 },
    sets: [
      ['p(a())', '¬p(f(x)) ∨ q(x,g(x))'],
      ['q(a(),f(a()))', '¬q(x,y) ∨ p(g(y))'],
      ['¬p(x) ∨ p(f(x))', 'p(g(a()))'],
    ],
    depth: 1,
  },
  hard: {
    predicates: { p: 2, q: 1 },
    functions: { a: 0, b: 0, f: 2 },
    sets: [
      ['p(a(),b())', '¬p(x,y) ∨ q(f(x,y))'],
      ['q(f(a(),a()))', '¬q(x) ∨ p(x,b())'],
    ],
    depth: 1,
  },
}

function generate({ rng, difficulty }: GenerateContext): HerbrandUniverseQuestion {
  const profile = PROFILES[difficulty]
  const signature: FoSignature = {
    predicates: profile.predicates,
    functions: profile.functions,
  }

  // Every few questions, strip the constants so the invented one comes up.
  const stripConstants = rng.bool(0.25)

  for (const set of rng.shuffle(profile.sets)) {
    const sources = stripConstants
      ? set.map((clause) => clause.replace(/\ba\(\)/g, 'x').replace(/\bb\(\)/g, 'y'))
      : set
    let clauses: FoClause[]
    try {
      clauses = parseFoClauseSet(sources, signature)
    } catch {
      continue
    }
    const language = herbrandLanguage(clauses)
    const elements = herbrandUniverse(clauses, profile.depth).map(showTerm)
    // Enough to find, and few enough to find inside a round.
    if (elements.length < 3 || elements.length > 9) continue

    return {
      predicates: profile.predicates,
      functions: profile.functions,
      clauses: sources,
      depth: profile.depth,
      elements,
      invented: language.invented,
    }
  }

  const fallback = ['p(a())', '¬p(f(x))']
  const clauses = parseFoClauseSet(fallback, {
    predicates: { p: 1 },
    functions: { a: 0, f: 1 },
  })
  return {
    predicates: { p: 1 },
    functions: { a: 0, f: 1 },
    clauses: fallback,
    depth: 1,
    elements: herbrandUniverse(clauses, 1).map(showTerm),
    invented: false,
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: HerbrandUniverseQuestion): HerbrandUniverseAnswer => [...question.elements]

function check(
  question: HerbrandUniverseQuestion,
  answer: HerbrandUniverseAnswer,
): Verdict {
  const wanted = new Set(question.elements)
  const found = new Set(answer)
  const missed = [...wanted].filter((term) => !found.has(term)).length
  // Everything in the tray was built from the clause set's own symbols, so an
  // extra can only be something too deep.
  const extra = [...found].filter((term) => !wanted.has(term)).length

  if (missed === 0 && extra === 0) {
    return {
      correct: true,
      message: `All ${wanted.size} found`,
      detail: question.invented
        ? 'The clause set has no constant of its own, so one was invented — a universe has to be nonempty.'
        : 'The universe is every ground term over the symbols that actually occur, and nothing else.',
    }
  }

  return {
    correct: false,
    // Counts, never terms: sprint shows this before the retry.
    message: missed > 0 ? `${missed} still to build` : `${extra} of those are too deep`,
    score: wanted.size === 0 ? 0 : Math.max(0, (wanted.size - missed - extra) / wanted.size),
    detail: `Start from the constants, then wrap each function symbol around what you already have. Depth ${question.depth} means at most ${question.depth} layer${question.depth === 1 ? '' : 's'} of wrapping.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<HerbrandUniverseQuestion, HerbrandUniverseAnswer>) {
  const clauses = useMemo(() => clausesOf(question), [question])
  const signature = useMemo(() => buildableSignature(question), [question])
  const [slot, setSlot] = useState<Slot>(hole())
  const [found, setFound] = useState<string[]>([])

  useEffect(() => {
    setSlot(hole())
    setFound([])
  }, [question])

  const built = slotToTerm(slot)
  const printed = built === null ? null : showTerm(built)
  const already = printed !== null && found.includes(printed)
  const tooDeep = printed !== null && !question.elements.includes(printed)

  const bank = () => {
    if (locked || printed === null || already) return
    setFound((previous) => [...previous, printed])
    setSlot(hole())
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Build the Herbrand universe
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {found.length} of {question.elements.length}
        </p>
      </div>

      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-ink-soft">The clauses</p>
      <div className="mt-1 flex flex-col gap-1">
        {clauses.map((clause, index) => (
          <div key={index} className="tile bg-card-shade px-3 py-1.5">
            <FoClauseText clause={clause} className="text-base font-bold" />
          </div>
        ))}
      </div>

      {question.invented && (
        <p className="mt-2 rounded-xl bg-coin px-3 py-1.5 text-xs font-bold">
          No constant occurs anywhere, so one is invented — the palette has it.
        </p>
      )}

      <p className="mt-3 text-xs font-medium text-ink-soft">
        Ground terms only, at most {question.depth} layer{question.depth === 1 ? '' : 's'} deep. The
        palette holds exactly the symbols the clauses use.
      </p>

      <div className="mt-2">
        <TermBuilder
          signature={signature}
          variables={[]}
          value={slot}
          onChange={setSlot}
          disabled={locked}
        />
      </div>

      {!locked && (
        <Button
          variant={printed !== null && !already && !tooDeep ? 'coin' : 'secondary'}
          className="mt-2 w-full"
          onClick={bank}
          disabled={printed === null || already}
        >
          {printed === null
            ? 'Bank it — still has a hole'
            : already
              ? 'Already in the tray'
              : tooDeep
                ? 'Bank it — deeper than asked'
                : 'Bank it'}
        </Button>
      )}

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">Your tray</p>
      <div className="mt-1">
        <ProgressBar value={found.length} total={question.elements.length} />
      </div>
      <MovingList className="mt-1 flex flex-wrap gap-1.5">
        {(locked ? question.elements : found).map((term) => (
          <MovingItem
            key={term}
            id={term}
            disabled
            className="tile bg-grass px-2.5 py-1 text-left text-white"
          >
            <TermText text={term} className="text-sm font-bold" />
          </MovingItem>
        ))}
        {found.length === 0 && !locked && (
          <p className="rounded-xl bg-card-shade px-3 py-2 text-sm font-semibold text-ink-soft">
            Nothing yet.
          </p>
        )}
      </MovingList>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium text-ink-soft">
          The universe is infinite whenever a function symbol of arity one or more occurs — this is
          the part of it up to depth {question.depth}.
        </Pop>
      )}

      {!locked && (
        <Button variant="coin" className="mt-3 w-full" onClick={() => submit(found)}>
          {found.length === question.elements.length
            ? 'Submit'
            : `Submit — ${question.elements.length - found.length} still missing`}
        </Button>
      )}
    </Card>
  )
}

export const herbrandUniverseGame = defineMinigame<
  HerbrandUniverseQuestion,
  HerbrandUniverseAnswer
>({
  id: 'herbrand-universe',
  title: 'Build The Universe',
  tagline: 'Ground terms over the symbols that are actually there — and no others.',
  topics: ['herbrand'],
  icon: '🌌',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: HerbrandUniverseGuide,
  questionKey: (question) => question.clauses.join(';'),
})
