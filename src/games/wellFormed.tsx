/**
 * Well-formed formulas — ln.pdf §4.1, Definition 4.1.
 *
 * Three kinds of string look alike and are not alike. A **formula** is a
 * predicate symbol applied to terms, or those combined with connectives and
 * quantifiers. A **term** is a function symbol applied to terms — `next(x)` is
 * a perfectly good term and is not a formula, because there is nothing in it
 * that can be true. And a string can simply be **malformed**: a predicate at
 * the wrong arity, a predicate inside a term, a function symbol where a
 * predicate belongs.
 *
 * So three bins. The middle one is the interesting one, and the notes flag it
 * twice: "terms such as next(monday()) are themselves not formulas", and
 * "triangle(triangle(x)) is not a formula".
 */

import { useEffect, useState } from 'react'
import {
  parseFormula,
  parseTerm,
  type FoSignature,
  type Rng,
  type Signature,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'
import { SortBoard, type Bin } from '@/ui/SortBoard'
import { WellFormedGuide } from './wellFormed.guide'

export type Wellness = 'formula' | 'term' | 'neither'

export const WELLNESS_BINS: readonly Bin<Wellness>[] = [
  { id: 'formula', label: 'a formula', style: 'border-ink bg-grass/25' },
  { id: 'term', label: 'a term', style: 'border-ink bg-coin/40' },
  { id: 'neither', label: 'neither', style: 'border-ink bg-space-red/15' },
]

export interface WellFormedQuestion {
  predicates: Record<string, number>
  functions: Signature
  variables: string[]
  candidates: string[]
}

export type WellFormedAnswer = (Wellness | null)[]

const signatureOf = (question: WellFormedQuestion): FoSignature => ({
  predicates: question.predicates,
  functions: question.functions,
})

/**
 * Which of the three a string is.
 *
 * Decided by the parsers rather than by a rule written twice: if the formula
 * parser accepts it, it is a formula; failing that, if the term parser accepts
 * it *and every symbol in it is a function symbol*, it is a term.
 */
export function wellnessOf(question: WellFormedQuestion, source: string): Wellness {
  try {
    parseFormula(source, signatureOf(question))
    return 'formula'
  } catch {
    // fall through
  }
  try {
    const term = parseTerm(source, question.functions)
    const symbols: string[] = []
    const walk = (node: typeof term): void => {
      if (node.kind === 'var') return
      symbols.push(node.name)
      for (const arg of node.args) walk(arg)
    }
    walk(term)
    if (symbols.some((name) => question.functions[name] === undefined)) return 'neither'
    if (symbols.some((name) => question.predicates[name] !== undefined)) return 'neither'
    return 'term'
  } catch {
    return 'neither'
  }
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  predicates: Record<string, number>
  functions: Signature
  variables: string[]
  candidates: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    predicates: { p: 1, r: 2 },
    functions: { a: 0, f: 1 },
    variables: ['x', 'y'],
    candidates: 4,
  },
  medium: {
    predicates: { weekend: 1, before: 2 },
    functions: { monday: 0, next: 1 },
    variables: ['x', 'y'],
    candidates: 5,
  },
  hard: {
    predicates: { triangle: 1, circle: 1, contained: 2 },
    functions: { rotate: 1, origin: 0 },
    variables: ['x', 'y', 'z'],
    candidates: 6,
  },
}

/** Templates, with the profile's own symbols substituted in. */
function candidatesFor(rng: Rng, profile: Profile): string[] {
  const unary = Object.entries(profile.predicates).find(([, arity]) => arity === 1)?.[0] as string
  const binary = Object.entries(profile.predicates).find(([, arity]) => arity === 2)?.[0] as string
  const fn = Object.entries(profile.functions).find(([, arity]) => arity === 1)?.[0] as string
  const constant = Object.entries(profile.functions).find(([, arity]) => arity === 0)?.[0] as string
  const [x, y] = profile.variables as [string, string]

  const formulas = [
    `¬∀${x}:${unary}(${x})`,
    `∀${x}:(${unary}(${x})→∃${y}:${binary}(${y},${x}))`,
    `∀${x}:${binary}(${constant}(),${x})`,
    `∀${x}:(${unary}(${x})→¬${unary}(${fn}(${fn}(${x}))))`,
    `${unary}(${fn}(${constant}()))`,
  ]
  const terms = [`${fn}(${constant}())`, `${fn}(${fn}(${x}))`, `${constant}()`, x]
  const broken = [
    `${unary}(${unary}(${x}))`,
    `${unary}(${x},${y})`,
    `${fn}(${x},${y})`,
    `∀${x}:${fn}(${x})`,
    `${binary}(${x})`,
  ]

  return [
    ...rng.shuffle(formulas).slice(0, 3),
    ...rng.shuffle(terms).slice(0, 2),
    ...rng.shuffle(broken).slice(0, 2),
  ]
}

function generate({ rng, difficulty }: GenerateContext): WellFormedQuestion {
  const profile = PROFILES[difficulty]
  const base: WellFormedQuestion = {
    predicates: profile.predicates,
    functions: profile.functions,
    variables: profile.variables,
    candidates: [],
  }

  for (let attempt = 0; attempt < 100; attempt++) {
    const pool = rng.shuffle(candidatesFor(rng, profile))
    const candidates = [...new Set(pool)].slice(0, profile.candidates)
    const question = { ...base, candidates }
    const bins = new Set(candidates.map((source) => wellnessOf(question, source)))
    // All three bins live, or the board answers itself.
    if (bins.size < 3) continue
    return question
  }

  return {
    predicates: { weekend: 1, before: 2 },
    functions: { monday: 0, next: 1 },
    variables: ['x', 'y'],
    candidates: [
      '¬∀x:weekend(x)',
      '∀x:before(monday(),x)',
      'next(monday())',
      'weekend(weekend(x))',
      'before(x)',
    ],
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: WellFormedQuestion): WellFormedAnswer =>
  question.candidates.map((source) => wellnessOf(question, source))

function check(question: WellFormedQuestion, answer: WellFormedAnswer): Verdict {
  const truth = solve(question)
  const right = truth.filter((bin, index) => answer[index] === bin).length
  const total = truth.length

  if (right === total) {
    return {
      correct: true,
      message: `${truth.filter((bin) => bin === 'formula').length} of ${total} are formulas`,
      detail:
        'A formula has a predicate symbol at its head; a term has a function symbol. Nothing built only from function symbols can be true or false, so it is not a formula.',
    }
  }

  return {
    correct: false,
    // A count, never which: sprint shows this before the retry.
    message: `${total - right} in the wrong bin`,
    score: total === 0 ? 0 : right / total,
    detail:
      'Check the head symbol first, then the arity of every symbol under it. A predicate inside a term, or a predicate at the wrong arity, makes the whole string malformed.',
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
}: MinigameScreenProps<WellFormedQuestion, WellFormedAnswer>) {
  const [placed, setPlaced] = useState<WellFormedAnswer>([])

  useEffect(() => {
    setPlaced(question.candidates.map(() => null))
  }, [question])

  const remaining = placed.filter((bin) => bin === null).length

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Formula, term, or neither?
      </p>

      <div className="tile mt-2 flex flex-col gap-1 bg-card-shade px-3 py-2 text-xs font-semibold">
        <p>
          <span className="text-ink-soft">predicates</span>{' '}
          <span className="formula font-bold">
            {Object.entries(question.predicates)
              .map(([name, arity]) => `${name}/${arity}`)
              .join(' · ')}
          </span>
        </p>
        <p>
          <span className="text-ink-soft">functions</span>{' '}
          <span className="formula font-bold">
            {Object.entries(question.functions)
              .map(([name, arity]) => `${name}/${arity}`)
              .join(' · ')}
          </span>
        </p>
        <p>
          <span className="text-ink-soft">variables</span>{' '}
          <span className="formula font-bold">{question.variables.join(', ')}</span>
        </p>
      </div>

      <div className="mt-3">
        <SortBoard
          bins={WELLNESS_BINS}
          columns={3}
          tokens={question.candidates.map((source) => (
            <FoText text={source} className="text-sm font-bold" />
          ))}
          placed={placed}
          onPlace={(index, bin) =>
            setPlaced((previous) => previous.map((entry, at) => (at === index ? bin : entry)))
          }
          locked={locked}
          solution={locked ? (solution ?? undefined) : undefined}
          hint="Drag each string into a bin. Tap a placed one to send it back."
        />
      </div>

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

export const wellFormedGame = defineMinigame<WellFormedQuestion, WellFormedAnswer>({
  id: 'signature',
  title: 'Is That A Formula?',
  tagline: 'Predicate at the head, or function symbol. Only one of them can be true.',
  topics: ['fo-syntax'],
  icon: '🔤',
  roundSeconds: 150,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: WellFormedGuide,
  questionKey: (question) => question.candidates.join(';'),
})
