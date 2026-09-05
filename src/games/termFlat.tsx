/**
 * The broken keyboard — ln.pdf §3.1, Exercise 4, Collection Q11.
 *
 * Somebody typed a term on a keyboard whose comma and bracket keys are dead,
 * and you have to read it back. That is possible only because the arities are
 * known: each symbol announces how many terms must follow it, so the structure
 * lives in the signature and not in the string.
 *
 * You point at it rather than tick it. Given a subterm, select the stretch of
 * letters it occupies — which cannot be done by eye, only by counting
 * arguments, which is the skill the exercise is after.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  flatSpans,
  flatten,
  parseTerm,
  showTerm,
  termSize,
  termVariables,
  variable,
  type Rng,
  type Signature,
  type Term,
} from '@/logic'
import { app } from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { TermText } from '@/ui/TermText'
import { Pop, Shakeable, useShake } from '@/ui/motion'
import { TermFlatGuide } from './termFlat.guide'

export interface FlatTarget {
  /** The subterm, printed the ordinary way. */
  text: string
  start: number
  end: number
}

export interface TermFlatQuestion {
  signature: Signature
  letters: string
  /** The term itself — the answer to "what did they type". */
  source: string
  targets: FlatTarget[]
  /** var(t), for the second half of the question. */
  variables: string[]
  /** Every letter that could be a variable, so the chips are not a giveaway. */
  variablePool: string[]
}

export interface TermFlatAnswer {
  /** One span per target, or null where none was banked. */
  spans: ([number, number] | null)[]
  /** The letters claimed to be in var(t). */
  variables: string[]
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  symbols: [name: string, arity: number][]
  variables: string[]
  size: [min: number, max: number]
  targets: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    symbols: [
      ['f', 2],
      ['g', 1],
    ],
    variables: ['x', 'y'],
    size: [5, 7],
    targets: 2,
  },
  medium: {
    symbols: [
      ['f', 2],
      ['g', 2],
      ['h', 1],
    ],
    variables: ['x', 'y', 'z'],
    size: [8, 11],
    targets: 3,
  },
  hard: {
    symbols: [
      ['f', 2],
      ['g', 1],
      ['h', 3],
    ],
    variables: ['x', 'y', 'z', 'w'],
    size: [11, 15],
    targets: 3,
  },
}

const ATTEMPTS = 400

function randomTerm(rng: Rng, profile: Profile, budget: number): Term {
  if (budget <= 1) return variable(rng.pick(profile.variables))
  const usable = profile.symbols.filter(([, arity]) => arity + 1 <= budget)
  if (usable.length === 0) return variable(rng.pick(profile.variables))
  const [name, arity] = rng.pick(usable)
  const args: Term[] = []
  let left = budget - 1
  for (let index = 0; index < arity; index++) {
    const remaining = arity - index
    const share = Math.max(1, Math.floor(left / remaining))
    args.push(randomTerm(rng, profile, rng.range(1, share)))
    left -= termSize(args[index] as Term)
  }
  return app(name, args)
}

function generate({ rng, difficulty }: GenerateContext): TermFlatQuestion {
  const profile = PROFILES[difficulty]
  const signature: Signature = Object.fromEntries(profile.symbols)

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const term = randomTerm(rng, profile, rng.range(...profile.size))
    if (termSize(term) < profile.size[0]) continue
    const variables = termVariables(term)
    // Both halves of the question need something to say.
    if (variables.length < 2) continue
    if (variables.length === profile.variables.length) continue

    const spans = flatSpans(term)
    // Proper subterms with some structure: a bare variable is not a question.
    const usable = spans.filter(
      (span) => span.term.kind === 'fn' && span.end - span.start >= 2 && span.start > 0,
    )
    // Distinct printed subterms, so no target is answered twice over.
    const seen = new Set<string>()
    const choices = rng
      .shuffle(usable)
      .filter((span) => {
        const key = showTerm(span.term)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, profile.targets)

    if (choices.length < profile.targets) continue

    return {
      signature,
      letters: flatten(term),
      source: showTerm(term),
      targets: choices
        .map((span) => ({ text: showTerm(span.term), start: span.start, end: span.end }))
        .sort((a, b) => a.start - b.start),
      variables,
      variablePool: profile.variables,
    }
  }

  // Last resort, so a round can never stall: Exercise 4's own string.
  const fallback: Signature = { f: 2, g: 2, h: 1 }
  const term = parseTerm('f(g(x,h(y)),g(z,f(x,y)))', fallback)
  const spans = flatSpans(term)
  const pick = (text: string): FlatTarget => {
    const span = spans.find((entry) => showTerm(entry.term) === text) as (typeof spans)[number]
    return { text, start: span.start, end: span.end }
  }
  return {
    signature: fallback,
    letters: flatten(term),
    source: showTerm(term),
    targets: [pick('g(x,h(y))'), pick('g(z,f(x,y))'), pick('f(x,y)')],
    variables: ['x', 'y', 'z'],
    variablePool: ['x', 'y', 'z', 'w'],
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: TermFlatQuestion): TermFlatAnswer => ({
  spans: question.targets.map((target) => [target.start, target.end]),
  variables: [...question.variables],
})

function check(question: TermFlatQuestion, answer: TermFlatAnswer): Verdict {
  const spansRight = question.targets.filter((target, index) => {
    const span = answer.spans[index]
    return span !== null && span !== undefined && span[0] === target.start && span[1] === target.end
  }).length

  const claimed = new Set(answer.variables)
  const wanted = new Set(question.variables)
  const varsRight =
    claimed.size === wanted.size && [...wanted].every((name) => claimed.has(name))

  const parts = question.targets.length + 1
  const score = (spansRight + (varsRight ? 1 : 0)) / parts

  if (spansRight === question.targets.length && varsRight) {
    return {
      correct: true,
      message: `Read back as ${question.source}`,
      detail: `var(t) = {${question.variables.join(', ')}}. Nothing in the letters told you where the brackets go — the arities did.`,
    }
  }

  return {
    correct: false,
    // Counts, never which: sprint shows this before the retry.
    message:
      spansRight < question.targets.length && !varsRight
        ? `${question.targets.length - spansRight} span${question.targets.length - spansRight === 1 ? '' : 's'} off, and var(t) is wrong`
        : varsRight
          ? `${question.targets.length - spansRight} span${question.targets.length - spansRight === 1 ? '' : 's'} off`
          : 'The spans are right; var(t) is not',
    score,
    detail: `The term is ${question.source}. Read left to right: each symbol takes exactly as many terms as its arity, and those terms are read the same way.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked }: MinigameScreenProps<TermFlatQuestion, TermFlatAnswer>) {
  const [spans, setSpans] = useState<([number, number] | null)[]>([])
  const [active, setActive] = useState(0)
  const [anchor, setAnchor] = useState<number | null>(null)
  const [variables, setVariables] = useState<string[]>([])
  const [shaking, shake] = useShake()

  useEffect(() => {
    setSpans(question.targets.map(() => null))
    setActive(0)
    setAnchor(null)
    setVariables([])
  }, [question])

  const arities = useMemo(
    () => Object.entries(question.signature).sort(([a], [b]) => a.localeCompare(b)),
    [question],
  )

  const target = question.targets[active]
  const banked = spans[active] ?? null

  const tap = (index: number) => {
    if (locked || target === undefined) return
    if (anchor === null) {
      setAnchor(index)
      return
    }
    const start = Math.min(anchor, index)
    const end = Math.max(anchor, index) + 1
    setAnchor(null)
    if (start === target.start && end === target.end) {
      setSpans((previous) => {
        const next = [...previous]
        next[active] = [start, end]
        return next
      })
      const nextOpen = question.targets.findIndex(
        (_, slot) => slot !== active && (spans[slot] ?? null) === null,
      )
      if (nextOpen !== -1) setActive(nextOpen)
      return
    }
    shake()
  }

  const inSpan = (index: number, span: readonly [number, number] | null): boolean =>
    span !== null && index >= span[0] && index < span[1]

  const pending =
    anchor === null ? null : ([Math.min(anchor, anchor), Math.max(anchor, anchor) + 1] as const)

  const allBanked = spans.every((span) => span !== null)

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Read the term back
      </p>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        The comma and bracket keys were broken. Arities:{' '}
        {arities.map(([name, arity]) => `${name}/${arity}`).join(' · ')}
      </p>

      <Shakeable shaking={shaking}>
        <div className="tile mt-2 flex flex-wrap justify-center gap-0.5 bg-card-shade px-2 py-3">
          {[...question.letters].map((letter, index) => {
            const done = spans.some((span, slot) => slot !== active && inSpan(index, span))
            const here = inSpan(index, banked)
            const held = pending !== null && index >= pending[0] && index < pending[1]
            return (
              <button
                key={index}
                type="button"
                disabled={locked}
                onClick={() => tap(index)}
                className={`formula h-9 w-7 rounded-lg border-3 text-base font-bold
                  focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coin
                  ${
                    here
                      ? 'border-ink bg-grass text-white'
                      : held
                        ? 'border-ink bg-space-blue text-white'
                        : done
                          ? 'border-transparent bg-card text-ink-soft'
                          : 'border-transparent bg-card text-ink hover:bg-white'
                  }`}
              >
                {letter}
              </button>
            )
          })}
        </div>
      </Shakeable>

      <p className="mt-1 text-center text-xs font-medium text-ink-soft">
        {anchor === null ? 'Tap the first letter, then the last.' : 'Now the last letter.'}
      </p>

      <div className="mt-3 flex flex-col gap-1.5">
        {question.targets.map((entry, index) => {
          const found = spans[index] ?? null
          return (
            <button
              key={index}
              type="button"
              disabled={locked}
              onClick={() => {
                setActive(index)
                setAnchor(null)
              }}
              className={`tile flex w-full items-center gap-2 px-3 py-2 text-left
                ${found !== null ? 'bg-grass text-white' : index === active ? 'bg-coin' : 'bg-card'}`}
            >
              <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                {found !== null ? '✓' : index === active ? 'find' : '·'}
              </span>
              <TermText text={entry.text} className="text-base font-bold" />
              {found !== null && (
                <span className="ml-auto text-xs font-bold tabular-nums">
                  letters {found[0] + 1}–{found[1]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
        And var(t) — which of these actually occur?
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        {question.variablePool.map((name) => {
          const on = variables.includes(name)
          return (
            <button
              key={name}
              type="button"
              disabled={locked}
              onClick={() =>
                setVariables((previous) =>
                  previous.includes(name)
                    ? previous.filter((entry) => entry !== name)
                    : [...previous, name],
                )
              }
              className={`chunky formula min-h-11 px-4 text-base font-bold
                focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                ${on ? 'bg-space-blue text-white' : 'bg-card text-ink hover:bg-card-shade'}`}
            >
              {name}
            </button>
          )
        })}
      </div>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">What was typed</p>
          <TermText text={question.source} className="mt-1 text-lg font-bold" />
        </Pop>
      )}

      {!locked && (
        <Button
          variant="coin"
          className="mt-3 w-full"
          onClick={() => submit({ spans, variables })}
        >
          {allBanked ? 'Submit' : `Submit — ${spans.filter((s) => s === null).length} not found`}
        </Button>
      )}
    </Card>
  )
}

export const termFlatGame = defineMinigame<TermFlatQuestion, TermFlatAnswer>({
  id: 'term-flat',
  title: 'Broken Keyboard',
  tagline: 'No commas, no brackets. The arities put them back.',
  topics: ['terms'],
  icon: '⌨️',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: TermFlatGuide,
  questionKey: (question) => `${question.letters}|${question.targets.map((t) => t.text).join(';')}`,
})
