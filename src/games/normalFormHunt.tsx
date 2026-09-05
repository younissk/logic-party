/**
 * Which terms can reduction produce? — Exercise 6 question 2, Example 3.23.
 *
 * Algorithm 3.21 says "pick such a subterm" and leaves the choice open. For a
 * system that is not confluent, different choices end in different terms — all
 * of them legitimate outputs, all of them equal in the theory, none of them
 * *the* normal form.
 *
 * So you go and find them. One run gives you one answer; the question is how
 * many others there are, and the only way to know is to take the other fork.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  isNormalForm,
  normalForms,
  parseTerm,
  redexes,
  rule,
  showRule,
  showTerm,
  termSize,
  variable,
  type Rng,
  type Rule,
  type Signature,
  type Term,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { EquationText, TermText } from '@/ui/TermText'
import { MovingItem, MovingList, Pop, ProgressBar } from '@/ui/motion'
import { NormalFormHuntGuide } from './normalFormHunt.guide'

export interface NormalFormQuestion {
  signature: Signature
  rules: string[]
  start: string
  /** Every term Algorithm 3.21 could return, printed. */
  outputs: string[]
}

/** The normal forms found, printed — the tray you fill. */
export type NormalFormAnswer = string[]

export const readRules = (question: NormalFormQuestion): Rule[] =>
  question.rules.map((source) => {
    const [left, right] = source.split('->')
    return rule(
      parseTerm(left as string, question.signature),
      parseTerm(right as string, question.signature),
    )
  })

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  systems: string[][]
  symbols: [name: string, arity: number][]
  variables: string[]
  start: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    systems: [
      ['g(x,f(y))->f(x)', 'g(f(x),y)->h(x)'],
      ['f(f(x))->g(x,x)', 'f(g(x,y))->g(y,x)'],
    ],
    symbols: [
      ['f', 1],
      ['g', 2],
      ['h', 1],
    ],
    variables: ['x', 'y'],
    start: [4, 6],
  },
  medium: {
    systems: [
      ['g(h(x))->f(x)', 'h(f(x))->g(x)', 'f(f(x))->h(x)', 'g(g(x))->f(x)'],
      ['g(x,f(y))->f(x)', 'g(f(x),y)->h(x)', 'h(h(x))->f(x)'],
    ],
    symbols: [
      ['f', 1],
      ['g', 1],
      ['h', 1],
    ],
    variables: ['x', 'y', 'z'],
    start: [4, 7],
  },
  hard: {
    systems: [
      ['g(h(x))->f(x)', 'h(f(x))->g(x)', 'f(f(x))->h(x)', 'g(g(x))->f(x)'],
      ['f(g(x))->g(f(x))', 'g(f(x))->f(g(x))', 'f(f(x))->h(x)'],
    ],
    symbols: [
      ['f', 1],
      ['g', 1],
      ['h', 1],
    ],
    variables: ['x', 'y', 'z'],
    start: [6, 9],
  },
}

function randomTerm(rng: Rng, profile: Profile, budget: number): Term {
  const usable = profile.symbols.filter(([, arity]) => arity + 1 <= budget)
  if (budget <= 1 || usable.length === 0) return variable(rng.pick(profile.variables))
  const [name, arity] = rng.pick(usable)
  const args: Term[] = []
  let left = budget - 1
  for (let index = 0; index < arity; index++) {
    const share = Math.max(1, Math.floor(left / (arity - index)))
    const arg = randomTerm(rng, profile, rng.range(1, share))
    args.push(arg)
    left -= termSize(arg)
  }
  return { kind: 'fn', name, args }
}

function generate({ rng, difficulty }: GenerateContext): NormalFormQuestion {
  const profile = PROFILES[difficulty]
  const signature: Signature = Object.fromEntries(profile.symbols)

  for (let attempt = 0; attempt < 400; attempt++) {
    const sources = rng.pick(profile.systems)
    const rules = sources.map((source) => {
      const [left, right] = source.split('->')
      return rule(parseTerm(left as string, signature), parseTerm(right as string, signature))
    })
    const start = randomTerm(rng, profile, rng.range(...profile.start))
    if (isNormalForm(rules, start)) continue

    const outputs = normalForms(rules, start)
    // The whole question is that there is more than one, and few enough to find.
    if (outputs.length < 2 || outputs.length > 4) continue

    return {
      signature,
      rules: sources,
      start: showTerm(start),
      outputs: outputs.map(showTerm),
    }
  }

  // Last resort, so a round can never stall: the exercise's own system.
  const fallback: Signature = { f: 1, g: 1, h: 1 }
  const rules = ['g(h(x))->f(x)', 'h(f(x))->g(x)', 'f(f(x))->h(x)', 'g(g(x))->f(x)']
  const parsed = rules.map((source) => {
    const [left, right] = source.split('->')
    return rule(parseTerm(left as string, fallback), parseTerm(right as string, fallback))
  })
  const start = parseTerm('g(h(f(z)))', fallback)
  return {
    signature: fallback,
    rules,
    start: showTerm(start),
    outputs: normalForms(parsed, start).map(showTerm),
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: NormalFormQuestion): NormalFormAnswer => [...question.outputs]

function check(question: NormalFormQuestion, answer: NormalFormAnswer): Verdict {
  const wanted = new Set(question.outputs)
  const found = new Set(answer)
  const missed = [...wanted].filter((term) => !found.has(term))
  // Everything in the tray was put there by the board, so an extra can only be
  // a term that is reachable but not in normal form — which the board refuses.
  const extra = [...found].filter((term) => !wanted.has(term))

  if (missed.length === 0 && extra.length === 0) {
    return {
      correct: true,
      message: `All ${wanted.size} found`,
      detail:
        'Every one of them is a legitimate output of Algorithm 3.21, and all of them are equal in the theory of R. A system where this can happen is not confluent.',
    }
  }

  return {
    correct: false,
    // Counts, never terms: sprint shows this before the retry.
    message:
      missed.length > 0 ? `${missed.length} still to find` : `${extra.length} of those are not outputs`,
    score: wanted.size === 0 ? 0 : Math.max(0, (wanted.size - missed.length - extra.length) / wanted.size),
    detail:
      'Take a different fork. Where two rules both apply, the one you skip leads somewhere else — and sometimes somewhere that cannot come back.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<NormalFormQuestion, NormalFormAnswer>) {
  const rules = useMemo(() => readRules(question), [question])
  const start = useMemo(() => parseTerm(question.start, question.signature), [question])
  const [path, setPath] = useState<number[]>([])
  const [found, setFound] = useState<string[]>([])

  useEffect(() => {
    setPath([])
    setFound([])
  }, [question])

  // Replay the current exploration.
  let current: Term = start
  const chain: Term[] = [start]
  for (const choice of path) {
    const options = redexes(rules, current)
    const next = options[choice]
    if (next === undefined) break
    current = next.result
    chain.push(current)
  }

  const options = locked ? [] : redexes(rules, current)
  const atNormalForm = options.length === 0
  const printed = showTerm(current)
  const alreadyFound = found.includes(printed)

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Find every possible output
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {found.length} of {question.outputs.length}
        </p>
      </div>

      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-ink-soft">R</p>
      <div className="mt-1 flex flex-col gap-1">
        {rules.map((entry, index) => (
          <div key={index} className="tile bg-card-shade px-3 py-1.5">
            <EquationText left={entry.left} right={entry.right} arrow="→" className="text-sm font-bold" />
          </div>
        ))}
      </div>

      <div className="tile mt-3 flex flex-wrap items-baseline gap-2 bg-card-shade px-3 py-2">
        <span className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">now</span>
        <TermText term={current} className="text-lg font-bold" />
        {chain.length > 1 && (
          <span className="ml-auto text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
            {chain.length - 1} step{chain.length === 2 ? '' : 's'} in
          </span>
        )}
      </div>

      {!locked && (
        <>
          {atNormalForm ? (
            <Button
              variant={alreadyFound ? 'secondary' : 'coin'}
              className="mt-2 w-full"
              disabled={alreadyFound}
              onClick={() => setFound((previous) => [...previous, printed])}
            >
              {alreadyFound ? 'Already in the tray' : 'Bank this normal form'}
            </Button>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              {options.map((option, index) => (
                <button
                  key={`${index}:${showTerm(option.result)}`}
                  type="button"
                  onClick={() => setPath((previous) => [...previous, index])}
                  className="tile flex w-full items-center gap-2 bg-card px-3 py-1.5 text-left hover:bg-card-shade
                    focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin"
                >
                  <TermText term={option.result} className="text-sm font-bold" />
                  <span className="ml-auto shrink-0 text-[0.6rem] font-bold uppercase tracking-wider text-ink-soft">
                    {showRule(rules[option.ruleIndex] as Rule)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 flex gap-2">
            {path.length > 0 && (
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setPath((previous) => previous.slice(0, -1))}
              >
                ← Back one
              </Button>
            )}
            <Button variant="ghost" className="flex-1" onClick={() => setPath([])}>
              Start over
            </Button>
          </div>
        </>
      )}

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">Your tray</p>
      <div className="mt-1">
        <ProgressBar value={found.length} total={question.outputs.length} />
      </div>
      <MovingList className="mt-1 flex flex-col gap-1">
        {found.map((term) => (
          <MovingItem
            key={term}
            id={term}
            disabled
            className="tile flex w-full items-center bg-grass px-3 py-1.5 text-left text-white"
          >
            <TermText text={term} className="text-base font-bold" />
          </MovingItem>
        ))}
        {found.length === 0 && (
          <p className="rounded-xl bg-card-shade px-3 py-2 text-sm font-semibold text-ink-soft">
            Nothing banked yet.
          </p>
        )}
      </MovingList>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Every output there is
          </p>
          <p className="mt-1 flex flex-wrap gap-2 font-bold">
            {question.outputs.map((term) => (
              <TermText key={term} text={term} />
            ))}
          </p>
        </Pop>
      )}

      {!locked && (
        <Button variant="coin" className="mt-3 w-full" onClick={() => submit(found)}>
          {found.length === question.outputs.length
            ? 'Submit'
            : `Submit — ${question.outputs.length - found.length} still out there`}
        </Button>
      )}
    </Card>
  )
}

export const normalFormHuntGame = defineMinigame<NormalFormQuestion, NormalFormAnswer>({
  id: 'normal-forms',
  title: 'Every Way Down',
  tagline: 'One term, several answers. Take the other fork.',
  topics: ['rewriting'],
  icon: '🍂',
  roundSeconds: 210,
  sprintQuestions: 5,
  generate,
  check,
  solve,
  Screen,
  Guide: NormalFormHuntGuide,
  questionKey: (question) => `${question.rules.join(';')}|${question.start}`,
})
