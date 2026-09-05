/**
 * Build a term to order — ln.pdf §3.1, Definition 3.1, Exercise 4 question 1.
 *
 * The exercise asks true/false questions about T(F, a, V): when is it
 * infinite, must every subterm be a term, can there be ground terms when V is
 * non-empty. Those are questions about what you can *build*, so here you build
 * it: a signature, a set of variables, and two or three conditions the term has
 * to meet at once.
 *
 * Nothing is ever asked that cannot be built — the generator finds a witness
 * first and reads the conditions off it.
 */

import { useEffect, useState } from 'react'
import {
  app,
  isGround,
  showTerm,
  termDepth,
  termSize,
  termSymbols,
  termVariables,
  variable,
  type Rng,
  type Signature,
  type Term,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { TermText } from '@/ui/TermText'
import { Pop } from '@/ui/motion'
import {
  TermBuilder,
  hole,
  slotToTerm,
  termToSlot,
  type Slot,
} from '@/ui/TermBuilder'
import { TermBuildGuide } from './termBuild.guide'

export type Goal =
  | { kind: 'ground' }
  | { kind: 'size'; n: number }
  | { kind: 'atLeast'; n: number }
  | { kind: 'depth'; n: number }
  | { kind: 'vars'; names: string[] }
  | { kind: 'uses'; symbol: string; times: number }
  | { kind: 'avoid'; symbol: string }

export interface TermBuildQuestion {
  signature: Signature
  variables: string[]
  goals: Goal[]
  /** A term meeting every goal — proof the question is answerable. */
  witness: string
}

/** The term under construction, holes and all. */
export type TermBuildAnswer = Slot

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

const occurrences = (term: Term, symbol: string): number => {
  if (term.kind === 'var') return term.name === symbol ? 1 : 0
  const here = term.name === symbol ? 1 : 0
  return here + term.args.reduce((total, arg) => total + occurrences(arg, symbol), 0)
}

export function goalHolds(goal: Goal, term: Term): boolean {
  switch (goal.kind) {
    case 'ground':
      return isGround(term)
    case 'size':
      return termSize(term) === goal.n
    case 'atLeast':
      return termSize(term) >= goal.n
    case 'depth':
      return termDepth(term) === goal.n
    case 'vars': {
      const found = new Set(termVariables(term))
      return found.size === goal.names.length && goal.names.every((name) => found.has(name))
    }
    case 'uses':
      return occurrences(term, goal.symbol) >= goal.times
    case 'avoid':
      return !termSymbols(term).includes(goal.symbol)
  }
}

export function goalLabel(goal: Goal): string {
  switch (goal.kind) {
    case 'ground':
      return 'ground — no variables at all'
    case 'size':
      return `exactly ${goal.n} symbols`
    case 'atLeast':
      return `at least ${goal.n} symbols`
    case 'depth':
      return `nested exactly ${goal.n} deep`
    case 'vars':
      return goal.names.length === 0
        ? 'var(t) = ∅'
        : `var(t) = {${[...goal.names].sort((a, b) => a.localeCompare(b)).join(', ')}}`
    case 'uses':
      return `uses ${goal.symbol} at least ${goal.times} time${goal.times === 1 ? '' : 's'}`
    case 'avoid':
      return `never uses ${goal.symbol}`
  }
}

const goalKey = (goal: Goal): string => `${goal.kind}:${goalLabel(goal)}`

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  symbols: [name: string, arity: number][]
  variables: string[]
  size: [min: number, max: number]
  goals: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    symbols: [
      ['f', 1],
      ['g', 2],
      ['c', 0],
    ],
    variables: ['x', 'y'],
    size: [3, 5],
    goals: 2,
  },
  medium: {
    symbols: [
      ['f', 1],
      ['g', 2],
      ['h', 2],
      ['c', 0],
    ],
    variables: ['x', 'y', 'z'],
    size: [5, 8],
    goals: 3,
  },
  hard: {
    symbols: [
      ['f', 2],
      ['g', 2],
      ['h', 1],
      ['c', 0],
      ['d', 0],
    ],
    variables: ['x', 'y', 'z'],
    size: [8, 12],
    goals: 3,
  },
}

function randomTerm(rng: Rng, profile: Profile, budget: number, allowVars: boolean): Term {
  const leaves = [
    ...profile.symbols.filter(([, arity]) => arity === 0).map(([name]) => app(name, [])),
    ...(allowVars ? profile.variables.map(variable) : []),
  ]
  const usable = profile.symbols.filter(([, arity]) => arity > 0 && arity + 1 <= budget)
  if (budget <= 1 || usable.length === 0) return rng.pick(leaves)
  const [name, arity] = rng.pick(usable)
  const args: Term[] = []
  let left = budget - 1
  for (let index = 0; index < arity; index++) {
    const share = Math.max(1, Math.floor(left / (arity - index)))
    const arg = randomTerm(rng, profile, rng.range(1, share), allowVars)
    args.push(arg)
    left -= termSize(arg)
  }
  return app(name, args)
}

/** Every goal the witness happens to satisfy, worth asking about. */
function goalsFor(rng: Rng, profile: Profile, witness: Term): Goal[] {
  const used = termSymbols(witness)
  const unused = profile.symbols
    .map(([name]) => name)
    .filter((name) => !used.includes(name))

  const candidates: Goal[] = [
    { kind: 'size', n: termSize(witness) },
    { kind: 'depth', n: termDepth(witness) },
    { kind: 'vars', names: termVariables(witness) },
    { kind: 'atLeast', n: Math.max(2, termSize(witness) - 1) },
  ]
  if (isGround(witness)) candidates.push({ kind: 'ground' })
  for (const symbol of used) {
    const times = occurrences(witness, symbol)
    if (times >= 2) candidates.push({ kind: 'uses', symbol, times })
  }
  for (const symbol of unused) candidates.push({ kind: 'avoid', symbol })

  return rng.shuffle(candidates).slice(0, profile.goals)
}

const ATTEMPTS = 300

function generate({ rng, difficulty }: GenerateContext): TermBuildQuestion {
  const profile = PROFILES[difficulty]
  const signature: Signature = Object.fromEntries(profile.symbols)

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    // A ground witness a third of the time, so "no variables at all" comes up.
    const witness = randomTerm(rng, profile, rng.range(...profile.size), !rng.bool(1 / 3))
    if (termSize(witness) < profile.size[0]) continue

    const goals = goalsFor(rng, profile, witness)
    if (goals.length < profile.goals) continue
    // Distinct goals, and none of them met by a bare variable — a question a
    // single tap answers is not a question.
    if (new Set(goals.map(goalKey)).size !== goals.length) continue
    if (goals.every((goal) => goalHolds(goal, variable(profile.variables[0] as string)))) continue
    // Both size-shaped goals at once is one goal wearing two hats.
    if (goals.filter((goal) => goal.kind === 'size' || goal.kind === 'atLeast').length > 1) continue

    return {
      signature,
      variables: profile.variables,
      goals,
      witness: showTerm(witness),
    }
  }

  // Last resort, so a round can never stall.
  return {
    signature: { f: 1, g: 2, c: 0 },
    variables: ['x', 'y'],
    goals: [
      { kind: 'vars', names: ['x'] },
      { kind: 'size', n: 4 },
    ],
    witness: 'g(f(x),x)',
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: TermBuildQuestion): TermBuildAnswer => {
  // The witness is stored printed; rebuilding it needs the signature back.
  const parse = (source: string): Term => {
    // Terms print with every function symbol bracketed, so a small reader here
    // avoids importing the parser only to hand it the signature again.
    let index = 0
    const read = (): Term => {
      let end = index
      while (end < source.length && /[A-Za-z0-9_]/.test(source[end] as string)) end++
      const name = source.slice(index, end)
      index = end
      if (source[index] !== '(') return variable(name)
      index++
      const args: Term[] = []
      if (source[index] !== ')') {
        args.push(read())
        while (source[index] === ',') {
          index++
          args.push(read())
        }
      }
      index++
      return app(name, args)
    }
    return read()
  }
  return termToSlot(parse(question.witness))
}

export function metGoals(question: TermBuildQuestion, term: Term): boolean[] {
  return question.goals.map((goal) => goalHolds(goal, term))
}

function check(question: TermBuildQuestion, answer: TermBuildAnswer): Verdict {
  const term = slotToTerm(answer)
  if (term === null) {
    return {
      correct: false,
      message: 'Not a finished term',
      detail: 'Every hole has to be filled. A function symbol of arity n needs n terms after it.',
      score: 0,
    }
  }

  const met = metGoals(question, term)
  const missed = met.filter((ok) => !ok).length
  if (missed === 0) {
    return {
      correct: true,
      message: `${showTerm(term)} meets all ${question.goals.length}`,
      detail: `${termSize(term)} symbols, nested ${termDepth(term)} deep, var(t) = {${termVariables(term).join(', ')}}.`,
    }
  }

  return {
    correct: false,
    // Counts, never which: sprint shows this before the retry.
    message: `${missed} condition${missed === 1 ? '' : 's'} not met`,
    score: (question.goals.length - missed) / question.goals.length,
    detail: `${showTerm(term)} has ${termSize(term)} symbols, depth ${termDepth(term)}, and var(t) = {${termVariables(term).join(', ')}}.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked }: MinigameScreenProps<TermBuildQuestion, TermBuildAnswer>) {
  const [slot, setSlot] = useState<Slot>(hole())

  useEffect(() => {
    setSlot(hole())
  }, [question])

  const term = slotToTerm(slot)
  const met = term === null ? question.goals.map(() => false) : metGoals(question, term)
  const allMet = term !== null && met.every(Boolean)

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Build a term that
      </p>

      <div className="mt-2 flex flex-col gap-1.5">
        {question.goals.map((goal, index) => (
          <div
            key={index}
            className={`tile flex items-center gap-2 px-3 py-2 text-sm font-bold
              ${met[index] ? 'bg-grass text-white' : 'bg-card-shade'}`}
          >
            <span aria-hidden>{met[index] ? '✓' : '·'}</span>
            <span className="formula">{goalLabel(goal)}</span>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <TermBuilder
          signature={question.signature}
          variables={question.variables}
          value={slot}
          onChange={setSlot}
          disabled={locked}
          label="Your term"
        />
      </div>

      {term !== null && !locked && (
        <p className="mt-2 text-xs font-medium text-ink-soft">
          {termSize(term)} symbols · depth {termDepth(term)} · var(t) ={' '}
          {termVariables(term).length === 0 ? '∅' : `{${termVariables(term).join(', ')}}`}
        </p>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            One that works
          </p>
          <TermText text={question.witness} className="mt-1 text-lg font-bold" />
          <p className="mt-1 text-xs font-medium text-ink-soft">
            Not the only one — any term meeting every condition scores.
          </p>
        </Pop>
      )}

      {!locked && (
        <Button
          variant={allMet ? 'coin' : 'secondary'}
          className="mt-3 w-full"
          onClick={() => submit(slot)}
        >
          {term === null ? 'Submit — still has holes' : allMet ? 'Submit' : 'Submit anyway'}
        </Button>
      )}
    </Card>
  )
}

export const termBuildGame = defineMinigame<TermBuildQuestion, TermBuildAnswer>({
  id: 'term-build',
  title: 'Term Foundry',
  tagline: 'A signature, some conditions, and a term you assemble yourself.',
  topics: ['terms'],
  icon: '🔨',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: TermBuildGuide,
  questionKey: (question) => question.goals.map(goalKey).join(';'),
})
