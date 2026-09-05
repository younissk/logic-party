/**
 * Reduction — ln.pdf §3.3, Algorithm 3.21, exam26a Q2.4.
 *
 * A reduction system is a set of equations already pointed downhill, and
 * reducing a term means: find a subterm matching some rule's left side, replace
 * it by that rule's right side under the same substitution, repeat until
 * nothing matches.
 *
 * You do the finding. Every place a rule fires is a button, so what is being
 * practised is spotting a redex — including the ones buried two levels down
 * and the ones that only appear after an earlier step.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  isNormalForm,
  normalForms,
  parseTerm,
  redexes,
  reduce,
  rule,
  showRule,
  showTerm,
  termSize,
  termsEqual,
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
import { ReduceGuide } from './reduceTerm.guide'

export interface ReduceQuestion {
  signature: Signature
  /** Rules as `l->r` sources. */
  rules: string[]
  start: string
  /** How many steps the shortest run to a normal form takes. */
  par: number
}

/** The redexes chosen, each an index into the list offered at the time. */
export type ReduceAnswer = number[]

export const readRules = (question: ReduceQuestion): Rule[] =>
  question.rules.map((source) => {
    const [left, right] = source.split('->')
    return rule(
      parseTerm(left as string, question.signature),
      parseTerm(right as string, question.signature),
    )
  })

/** Replay a run, refusing any step that was not on offer. */
export function replayRun(
  rules: readonly Rule[],
  start: Term,
  choices: readonly number[],
): { chain: Term[]; broken: boolean } {
  const chain: Term[] = [start]
  for (const choice of choices) {
    const current = chain[chain.length - 1] as Term
    const options = redexes(rules, current)
    const next = options[choice]
    if (next === undefined) return { chain, broken: true }
    chain.push(next.result)
  }
  return { chain, broken: false }
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  systems: string[][]
  symbols: [name: string, arity: number][]
  variables: string[]
  start: [min: number, max: number]
  par: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    systems: [['f(f(x))->f(x)'], ['g(g(x))->x'], ['f(g(x))->g(f(x))']],
    symbols: [
      ['f', 1],
      ['g', 1],
    ],
    variables: ['x', 'y'],
    start: [4, 6],
    par: [2, 4],
  },
  medium: {
    systems: [
      ['g(f(x),y)->f(y)', 'h(x,f(y))->f(x)'],
      ['f(f(x))->g(x)', 'g(g(x))->f(x)'],
      ['h(x,y)->g(x)', 'g(f(x))->f(x)'],
    ],
    symbols: [
      ['f', 1],
      ['g', 2],
      ['h', 2],
    ],
    variables: ['x', 'y', 'z'],
    start: [6, 9],
    par: [2, 5],
  },
  hard: {
    systems: [
      ['g(f(x),y)->f(y)', 'h(x,f(y))->f(x)', 'f(f(x))->x'],
      ['h(g(x,y),z)->g(h(x,z),h(y,z))', 'f(f(x))->x'],
      ['g(h(x),y)->h(g(x,y))', 'h(h(x))->x'],
    ],
    symbols: [
      ['f', 1],
      ['g', 2],
      ['h', 2],
    ],
    variables: ['x', 'y', 'z'],
    start: [8, 12],
    par: [3, 6],
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

const parseRules = (sources: string[], signature: Signature): Rule[] =>
  sources.map((source) => {
    const [left, right] = source.split('->')
    return rule(parseTerm(left as string, signature), parseTerm(right as string, signature))
  })

function generate({ rng, difficulty }: GenerateContext): ReduceQuestion {
  const profile = PROFILES[difficulty]
  const signature: Signature = Object.fromEntries(profile.symbols)

  for (let attempt = 0; attempt < 400; attempt++) {
    const sources = rng.pick(profile.systems)
    const rules = parseRules(sources, signature)
    const start = randomTerm(rng, profile, rng.range(...profile.start))
    if (isNormalForm(rules, start)) continue

    const run = reduce(rules, start)
    const par = run.steps.length
    if (par < profile.par[0] || par > profile.par[1]) continue
    // A term with only ever one redex teaches nothing about choosing.
    if (redexes(rules, start).length < 2 && par < 3) continue

    return { signature, rules: sources, start: showTerm(start), par }
  }

  // Last resort, so a round can never stall: the exam's own question.
  const fallback: Signature = { f: 1, g: 2, h: 2 }
  return {
    signature: fallback,
    rules: ['g(f(x),y)->f(y)', 'h(x,f(y))->f(x)'],
    start: 'g(g(h(x,f(z)),y),f(x))',
    par: 2,
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

function solve(question: ReduceQuestion): ReduceAnswer {
  const rules = readRules(question)
  const start = parseTerm(question.start, question.signature)
  const choices: number[] = []
  let current = start
  for (let guard = 0; guard < 60; guard++) {
    const options = redexes(rules, current)
    if (options.length === 0) break
    choices.push(0)
    current = (options[0] as { result: Term }).result
  }
  return choices
}

function check(question: ReduceQuestion, answer: ReduceAnswer): Verdict {
  const rules = readRules(question)
  const start = parseTerm(question.start, question.signature)
  const { chain, broken } = replayRun(rules, start, answer)

  if (broken) {
    return {
      correct: false,
      message: 'That step is not available',
      detail: 'Every step replaces a subterm that matches some rule’s left side.',
    }
  }

  const end = chain[chain.length - 1] as Term
  if (!isNormalForm(rules, end)) {
    return {
      correct: false,
      // Says that something still matches, never what.
      message: 'Not a normal form yet',
      score: Math.min(1, (chain.length - 1) / Math.max(question.par, 1)) * 0.7,
      detail:
        'A normal form is a term with no subterm matching any rule. Look inside the arguments, not only at the top.',
    }
  }

  const possible = normalForms(rules, start)
  return {
    correct: true,
    message: `${showTerm(end)} in ${chain.length - 1} step${chain.length === 2 ? '' : 's'}`,
    detail:
      possible.length > 1
        ? `This system is not confluent: ${possible.length} different normal forms are reachable from that term, and yours is one of them.`
        : 'Every route from that term ends here — the choice of redex did not matter.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked }: MinigameScreenProps<ReduceQuestion, ReduceAnswer>) {
  const rules = useMemo(() => readRules(question), [question])
  const start = useMemo(
    () => parseTerm(question.start, question.signature),
    [question],
  )
  const [choices, setChoices] = useState<number[]>([])

  useEffect(() => {
    setChoices([])
  }, [question])

  const { chain } = replayRun(rules, start, choices)
  const current = chain[chain.length - 1] as Term
  const options = locked ? [] : redexes(rules, current)
  const done = options.length === 0

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Reduce to a normal form
        </p>
        <p className="text-xs font-bold text-ink-soft">{chain.length - 1} steps</p>
      </div>

      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-ink-soft">R</p>
      <div className="mt-1 flex flex-col gap-1">
        {rules.map((entry, index) => (
          <div key={index} className="tile bg-card-shade px-3 py-1.5">
            <EquationText left={entry.left} right={entry.right} arrow="→" className="text-base font-bold" />
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">Your run</p>
      <MovingList className="mt-1 flex flex-col gap-1">
        {chain.map((term, index) => (
          <MovingItem
            key={`${index}:${showTerm(term)}`}
            id={`${index}`}
            disabled
            className={`tile flex w-full items-center gap-2 px-3 py-1.5 text-left
              ${index === chain.length - 1 ? (done ? 'bg-grass text-white' : 'bg-coin') : 'bg-card'}`}
          >
            <span className="w-4 shrink-0 text-[0.6rem] font-bold opacity-60">{index}</span>
            <TermText term={term} className="text-base font-bold" />
          </MovingItem>
        ))}
      </MovingList>

      <div className="mt-2">
        <ProgressBar value={Math.min(chain.length - 1, question.par)} total={question.par} />
      </div>

      {!locked && (
        <>
          {options.length > 0 ? (
            <>
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
                {options.length} place{options.length === 1 ? '' : 's'} a rule fires
              </p>
              <div className="mt-1 flex flex-col gap-1">
                {options.map((option, index) => (
                  <button
                    key={`${index}:${showTerm(option.result)}`}
                    type="button"
                    onClick={() => setChoices((previous) => [...previous, index])}
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
            </>
          ) : (
            <p className="mt-3 rounded-xl bg-grass px-3 py-2 text-sm font-bold text-white">
              Nothing matches any rule — this is a normal form.
            </p>
          )}

          <div className="mt-2 flex gap-2">
            {choices.length > 0 && (
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setChoices((previous) => previous.slice(0, -1))}
              >
                ← Undo
              </Button>
            )}
            <Button
              variant={done ? 'coin' : 'secondary'}
              className="flex-1"
              onClick={() => submit(choices)}
            >
              {done ? 'Submit' : 'Submit anyway'}
            </Button>
          </div>
        </>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Reachable normal forms
          </p>
          <p className="mt-1 flex flex-wrap gap-2 font-bold">
            {normalForms(rules, start).map((term) => (
              <TermText key={showTerm(term)} term={term} />
            ))}
          </p>
        </Pop>
      )}
    </Card>
  )
}

/** Do all routes agree? Used by the guide. */
export const uniqueNormalForm = (rules: readonly Rule[], term: Term): boolean =>
  normalForms(rules, term).length === 1

export const sameTerm = termsEqual

export const reduceGame = defineMinigame<ReduceQuestion, ReduceAnswer>({
  id: 'reduce',
  title: 'Reduce It',
  tagline: 'Find every redex, including the ones two levels down.',
  topics: ['rewriting'],
  icon: '⬇️',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: ReduceGuide,
  questionKey: (question) => `${question.rules.join(';')}|${question.start}`,
})
