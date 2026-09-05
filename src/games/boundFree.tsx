/**
 * Bound and free — ln.pdf §4.1, Exercise 7 question 1.
 *
 * The notes are precise about this and the precision matters: "it would be more
 * precise to say that a particular *occurrence* of a variable is bound or
 * free", because `p(x)∨∃x:q(x)` has one of each. So the question is asked one
 * occurrence at a time: tap the letters in the formula and say which are under
 * a quantifier for their own name.
 *
 * Then two judgements that follow from the tally. **Closed** means no free
 * occurrence anywhere. **Clean** means every variable is free or bound by
 * exactly one quantifier — and a formula can be closed and unclean at once.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  isClean,
  isClosed,
  parseFormula,
  showFormula,
  type FoFormula,
  type FoSignature,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'
import { Pop, Shakeable, useShake } from '@/ui/motion'
import { BoundFreeGuide } from './boundFree.guide'

export interface BoundFreeQuestion {
  predicates: Record<string, number>
  functions: Record<string, number>
  source: string
}

export interface BoundFreeAnswer {
  /** Character index in the printed formula → 'bound' or 'free'. */
  marks: Record<number, 'bound' | 'free'>
  closed: boolean | null
  clean: boolean | null
}

const signatureOf = (question: BoundFreeQuestion): FoSignature => ({
  predicates: question.predicates,
  functions: question.functions,
})

export const formulaOf = (question: BoundFreeQuestion): FoFormula =>
  parseFormula(question.source, signatureOf(question))

/** One occurrence of a variable in the printed formula. */
export interface Occurrence {
  /** Index of its first character in `showFormula(formula)`. */
  at: number
  name: string
  bound: boolean
}

/**
 * Every variable occurrence *inside an atom*, with its position in the print.
 *
 * The variable written next to a quantifier is not an occurrence to judge —
 * it is the binder itself — so those are skipped, which is also how the notes
 * read the tree.
 */
export function occurrences(formula: FoFormula): Occurrence[] {
  const found: Occurrence[] = []
  let cursor = 0

  const emit = (text: string): void => {
    cursor += text.length
  }

  const walkTerm = (term: { kind: string; name: string; args?: unknown[] }, bound: string[]): void => {
    if (term.kind === 'var') {
      found.push({ at: cursor, name: term.name, bound: bound.includes(term.name) })
      emit(term.name)
      return
    }
    emit(`${term.name}(`)
    const args = (term.args ?? []) as typeof term[]
    args.forEach((arg, index) => {
      if (index > 0) emit(',')
      walkTerm(arg, bound)
    })
    emit(')')
  }

  const walk = (node: FoFormula, bound: string[]): void => {
    switch (node.kind) {
      case 'true':
      case 'false':
        emit(showFormula(node))
        return
      case 'atom':
        emit(node.args.length === 0 ? node.predicate : `${node.predicate}(`)
        node.args.forEach((arg, index) => {
          if (index > 0) emit(',')
          walkTerm(arg as never, bound)
        })
        if (node.args.length > 0) emit(')')
        return
      case 'not':
        emit('¬')
        walk(node.body, bound)
        return
      case 'binary':
        emit('(')
        walk(node.left, bound)
        emit(CONNECTIVE[node.connective] as string)
        walk(node.right, bound)
        emit(')')
        return
      case 'quantified':
        emit(node.quantifier === 'forall' ? '∀' : '∃')
        emit(node.variable)
        emit(':')
        walk(node.body, [...bound, node.variable])
        return
    }
  }

  walk(formula, [])
  return found
}

const CONNECTIVE: Record<string, string> = {
  and: '∧',
  or: '∨',
  implies: '→',
  iff: '↔',
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  predicates: Record<string, number>
  functions: Record<string, number>
  templates: string[]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    predicates: { p: 1, q: 1, r: 2 },
    functions: { a: 0 },
    templates: [
      '∀x:r(x,y)',
      'p(x)∨∃x:q(x)',
      '∀x:(p(x)→q(x))',
      '∃x:(p(x)∧r(x,a()))',
      'p(x)∧q(y)',
    ],
  },
  medium: {
    predicates: { s: 1, t: 2, p: 1 },
    functions: { a: 0, f: 1 },
    templates: [
      '∃x:(¬s(x)∧∀y:t(y,x))∧s(a())',
      '∀x:(s(x)→∃y:t(x,y))',
      '(∀x:s(x))∨(∃x:p(x))',
      '∃x:∀y:(t(x,y)∨s(f(y)))',
      's(x)∨∀y:t(x,y)',
    ],
  },
  hard: {
    predicates: { p: 2, q: 3, r: 1 },
    functions: { a: 0, f: 1, g: 2 },
    templates: [
      '∀x:∃y:(p(x,y)→∀z:q(x,y,z))',
      '(∃x:p(x,y))∧(∀y:r(g(x,y)))',
      '∀x:(r(f(x))→∃y:p(y,x))∨q(x,x,x)',
      '∃x:∀y:∃z:q(f(x),y,g(y,z))',
      '∀x:p(x,y)∧∃y:r(g(x,y))',
    ],
  },
}

function generate({ rng, difficulty }: GenerateContext): BoundFreeQuestion {
  const profile = PROFILES[difficulty]
  const base = { predicates: profile.predicates, functions: profile.functions }

  for (const template of rng.shuffle(profile.templates)) {
    const question = { ...base, source: template }
    try {
      const formula = formulaOf(question)
      const spots = occurrences(formula)
      // Something to judge, and not all of one kind.
      if (spots.length < 2) continue
      return { ...base, source: showFormula(formula) }
    } catch {
      continue
    }
  }

  return {
    predicates: { s: 1, t: 2 },
    functions: { a: 0 },
    source: showFormula(
      parseFormula('∃x:(¬s(x)∧∀y:t(y,x))∧s(a())', {
        predicates: { s: 1, t: 2 },
        functions: { a: 0 },
      }),
    ),
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

function solve(question: BoundFreeQuestion): BoundFreeAnswer {
  const formula = formulaOf(question)
  const marks: Record<number, 'bound' | 'free'> = {}
  for (const spot of occurrences(formula)) marks[spot.at] = spot.bound ? 'bound' : 'free'
  return { marks, closed: isClosed(formula), clean: isClean(formula) }
}

function check(question: BoundFreeQuestion, answer: BoundFreeAnswer): Verdict {
  const formula = formulaOf(question)
  const spots = occurrences(formula)
  const wrong = spots.filter(
    (spot) => answer.marks[spot.at] !== (spot.bound ? 'bound' : 'free'),
  ).length

  const closedRight = answer.closed === isClosed(formula)
  const cleanRight = answer.clean === isClean(formula)
  const parts = spots.length + 2
  const right = spots.length - wrong + (closedRight ? 1 : 0) + (cleanRight ? 1 : 0)

  if (wrong === 0 && closedRight && cleanRight) {
    const free = spots.filter((spot) => !spot.bound).length
    return {
      correct: true,
      message: free === 0 ? 'Every occurrence bound' : `${free} free, ${spots.length - free} bound`,
      detail: `${isClosed(formula) ? 'Closed' : 'Not closed'} — a formula is closed when no occurrence is free. ${
        isClean(formula) ? 'Clean' : 'Not clean'
      } — clean means every variable is free, or bound by exactly one quantifier.`,
    }
  }

  return {
    correct: false,
    // Counts, never which: sprint shows this before the retry.
    message:
      wrong > 0
        ? `${wrong} occurrence${wrong === 1 ? '' : 's'} marked wrongly`
        : 'The occurrences are right; the two judgements are not',
    score: parts === 0 ? 0 : right / parts,
    detail:
      'An occurrence is bound when a quantifier for its own name sits above it on the path to the root. Nothing else binds it — not a quantifier for a different variable, and not one somewhere else in the formula.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked }: MinigameScreenProps<BoundFreeQuestion, BoundFreeAnswer>) {
  const formula = useMemo(() => formulaOf(question), [question])
  const printed = showFormula(formula)
  const spots = useMemo(() => occurrences(formula), [formula])

  const [marks, setMarks] = useState<Record<number, 'bound' | 'free'>>({})
  const [closed, setClosed] = useState<boolean | null>(null)
  const [cleanClaim, setCleanClaim] = useState<boolean | null>(null)
  const [shaking, shake] = useShake()

  useEffect(() => {
    setMarks({})
    setClosed(null)
    setCleanClaim(null)
  }, [question])

  /** The formula's characters, with the judgeable ones tappable. */
  const pieces: { text: string; spot: Occurrence | null }[] = []
  let cursor = 0
  for (const spot of spots) {
    if (spot.at > cursor) pieces.push({ text: printed.slice(cursor, spot.at), spot: null })
    pieces.push({ text: spot.name, spot })
    cursor = spot.at + spot.name.length
  }
  if (cursor < printed.length) pieces.push({ text: printed.slice(cursor), spot: null })

  const cycle = (spot: Occurrence) => {
    if (locked) return
    setMarks((previous) => {
      const current = previous[spot.at]
      const next = current === undefined ? 'bound' : current === 'bound' ? 'free' : undefined
      const updated = { ...previous }
      if (next === undefined) delete updated[spot.at]
      else updated[spot.at] = next
      return updated
    })
  }

  const unmarked = spots.filter((spot) => marks[spot.at] === undefined).length
  const ready = unmarked === 0 && closed !== null && cleanClaim !== null

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Mark every occurrence
      </p>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Tap a variable to cycle bound → free → unmarked. The name next to a quantifier is the binder,
        not an occurrence.
      </p>

      <Shakeable shaking={shaking}>
        <p className="tile mt-2 flex flex-wrap items-center bg-card-shade px-3 py-3 text-lg leading-loose">
          {pieces.map((piece, index) =>
            piece.spot === null ? (
              <FoText key={index} text={piece.text} className="text-lg font-bold" />
            ) : (
              <button
                key={index}
                type="button"
                disabled={locked}
                onClick={() => cycle(piece.spot as Occurrence)}
                className={`formula mx-0.5 rounded-md border-3 px-1 text-lg font-bold
                  focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coin
                  ${
                    marks[piece.spot.at] === 'bound'
                      ? 'border-ink bg-space-blue text-white'
                      : marks[piece.spot.at] === 'free'
                        ? 'border-ink bg-coin text-ink'
                        : 'border-dashed border-ink-soft/60 bg-card'
                  }`}
              >
                {piece.text}
              </button>
            ),
          )}
        </p>
      </Shakeable>

      <div className="mt-1 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-space-blue" aria-hidden /> bound
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-coin" aria-hidden /> free
        </span>
        <span>{unmarked} left</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Choice label="Closed?" value={closed} onChange={setClosed} disabled={locked} />
        <Choice label="Clean?" value={cleanClaim} onChange={setCleanClaim} disabled={locked} />
      </div>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">How it reads</p>
          <p className="mt-1 font-bold">
            {isClosed(formula) ? 'Closed' : 'Not closed'} · {isClean(formula) ? 'Clean' : 'Not clean'}
          </p>
          <p className="mt-1 text-ink-soft">
            {spots.filter((spot) => !spot.bound).length} free occurrence
            {spots.filter((spot) => !spot.bound).length === 1 ? '' : 's'},{' '}
            {spots.filter((spot) => spot.bound).length} bound.
          </p>
        </Pop>
      )}

      {!locked && (
        <Button
          variant={ready ? 'coin' : 'secondary'}
          className="mt-3 w-full"
          onClick={() => {
            if (!ready) return shake()
            submit({ marks, closed, clean: cleanClaim })
          }}
        >
          {ready ? 'Submit' : 'Submit — something is unanswered'}
        </Button>
      )}
    </Card>
  )
}

function Choice({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: boolean | null
  onChange: (next: boolean) => void
  disabled: boolean
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{label}</p>
      <div className="mt-1 grid grid-cols-2 gap-1">
        {[true, false].map((option) => (
          <button
            key={String(option)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={`chunky min-h-10 px-2 text-sm font-bold
              focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
              ${value === option ? 'bg-space-blue text-white' : 'bg-card text-ink hover:bg-card-shade'}`}
          >
            {option ? 'yes' : 'no'}
          </button>
        ))}
      </div>
    </div>
  )
}

export const boundFreeGame = defineMinigame<BoundFreeQuestion, BoundFreeAnswer>({
  id: 'fo-vocabulary',
  title: 'Bound Or Free',
  tagline: 'One occurrence at a time — the same letter can be both.',
  topics: ['fo-syntax'],
  icon: '🔗',
  roundSeconds: 150,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: BoundFreeGuide,
  questionKey: (question) => question.source,
})
