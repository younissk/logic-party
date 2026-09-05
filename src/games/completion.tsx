/**
 * Knuth-Bendix completion — ln.pdf §3.4, Algorithm 3.26, Exercise 6 question 4,
 * exam26bA Q2.1.
 *
 * The loop is short: take a critical pair, reduce both sides, and if they do
 * not meet, turn the two results into a rule pointing the way the term order
 * allows. Adding that rule can create new critical pairs, which go back in the
 * queue. It ends when the queue empties — or it does not end at all.
 *
 * You run the loop. What the game makes visible is the thing the algorithm's
 * pseudocode hides: most pairs cost nothing because both sides already join,
 * and the whole difficulty is the few that do not.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  canonicalVariables,
  combinedOrder,
  complete,
  criticalPairs,
  isConfluent,
  parseTerm,
  reduce,
  rule,
  samePair,
  showTerm,
  termsEqual,
  type Rule,
  type Signature,
  type Term,
  type TermOrder,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { EquationText, TermText } from '@/ui/TermText'
import { MovingItem, MovingList, Pop, Shakeable, useShake } from '@/ui/motion'
import { CompletionGuide } from './completion.guide'

export interface CompletionQuestion {
  signature: Signature
  precedence: string[]
  rules: string[]
  /** What Algorithm 3.26 does with them. */
  outcome: 'completed' | 'failed'
}

/**
 * One decision per pending critical pair, plus the ending.
 *
 * A pair is identified by its content rather than by an index, because adding a
 * rule reorders the queue — and an index into a list that has changed is a bug
 * waiting for a slow afternoon.
 */
export type CompletionMove =
  | { kind: 'join'; pair: [string, string] }
  | { kind: 'orient'; pair: [string, string] }
  | { kind: 'fail' }

export type CompletionAnswer = CompletionMove[]

export const orderFor = (question: CompletionQuestion): TermOrder =>
  combinedOrder(question.precedence)

export const readRules = (question: CompletionQuestion): Rule[] =>
  question.rules.map((source) => {
    const [left, right] = source.split('->')
    return rule(
      parseTerm(left as string, question.signature),
      parseTerm(right as string, question.signature),
    )
  })

// ---------------------------------------------------------------------------
// Running the loop
// ---------------------------------------------------------------------------

export interface RunState {
  rules: Rule[]
  /** Pairs seen and dealt with, so they do not come back. */
  handled: { left: Term; right: Term }[]
  status: 'running' | 'completed' | 'failed'
  /** Set when a move was not one the rules allow. */
  illegal: CompletionMove | null
}

const startRun = (rules: readonly Rule[]): RunState => ({
  rules: [...rules],
  handled: [],
  status: 'running',
  illegal: null,
})

/** The critical pairs still waiting, in a stable order. */
export function pending(state: RunState): { left: Term; right: Term }[] {
  return criticalPairs(state.rules).filter(
    (pair) => !state.handled.some((done) => samePair(done, pair)),
  )
}

const parsePair = (
  pair: [string, string],
  signature: Signature,
): { left: Term; right: Term } => ({
  left: parseTerm(pair[0], signature),
  right: parseTerm(pair[1], signature),
})

export function step(
  state: RunState,
  order: TermOrder,
  signature: Signature,
  move: CompletionMove,
): RunState {
  if (state.status !== 'running') return state

  if (move.kind === 'fail') {
    // Declaring failure is only right when some waiting pair cannot be oriented.
    const stuck = pending(state).some((pair) => {
      const left = reduce(state.rules, pair.left).result
      const right = reduce(state.rules, pair.right).result
      if (termsEqual(left, right)) return false
      const comparison = order.compare(left, right)
      return comparison === 'incomparable' || comparison === 'equal'
    })
    return stuck
      ? { ...state, status: 'failed' }
      : { ...state, illegal: move }
  }

  const chosen = parsePair(move.pair, signature)
  const waiting = pending(state).find((pair) => samePair(pair, chosen))
  if (waiting === undefined) return { ...state, illegal: move }

  const left = reduce(state.rules, waiting.left).result
  const right = reduce(state.rules, waiting.right).result
  const joins = termsEqual(left, right)

  if (move.kind === 'join') {
    // Discarding a pair whose sides do not meet loses the rule that would fix it.
    if (!joins) return { ...state, illegal: move }
    return { ...state, handled: [...state.handled, waiting] }
  }

  // 'orient'
  if (joins) return { ...state, illegal: move }
  const comparison = order.compare(left, right)
  if (comparison === 'incomparable' || comparison === 'equal') {
    return { ...state, illegal: move }
  }
  const added = canonicalVariables(
    comparison === 'greater' ? rule(left, right) : rule(right, left),
  )
  return {
    rules: [...state.rules, added],
    handled: [...state.handled, waiting],
    status: 'running',
    illegal: null,
  }
}

export function replayRun(
  question: CompletionQuestion,
  moves: readonly CompletionMove[],
): RunState {
  const order = orderFor(question)
  let state = startRun(readRules(question))
  for (const move of moves) {
    state = step(state, order, question.signature, move)
    if (state.illegal !== null) break
  }
  if (state.status === 'running' && pending(state).length === 0) {
    state = { ...state, status: 'completed' }
  }
  return state
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const SYSTEMS: Record<Difficulty, { signature: Signature; precedence: string[]; rules: string[] }[]> =
  {
    easy: [
      { signature: { f: 1, g: 1 }, precedence: ['g', 'f'], rules: ['f(f(x))->g(x)'] },
      { signature: { f: 1, g: 2, h: 1 }, precedence: ['f', 'g', 'h'], rules: ['g(x,f(y))->f(x)', 'g(f(x),y)->h(x)'] },
    ],
    medium: [
      { signature: { f: 1, g: 1, h: 1 }, precedence: ['f', 'g', 'h'], rules: ['f(g(x))->f(x)', 'g(f(y))->f(y)', 'h(g(z))->f(z)'] },
      { signature: { f: 1, h: 1 }, precedence: ['h', 'f'], rules: ['f(h(x))->x', 'f(f(x))->h(x)'] },
      { signature: { f: 1, g: 1 }, precedence: ['g', 'f'], rules: ['f(f(x))->g(x)', 'g(g(x))->x'] },
    ],
    hard: [
      { signature: { f: 2, g: 1 }, precedence: ['g', 'f'], rules: ['f(g(x),y)->g(f(x,y))', 'g(g(x))->x'] },
      { signature: { f: 1, g: 1, h: 1 }, precedence: ['f', 'g', 'h'], rules: ['h(f(x))->h(g(x))', 'f(g(x))->g(f(x))'] },
      { signature: { f: 2, g: 1 }, precedence: ['f', 'g'], rules: ['f(x,y)->g(x)', 'f(x,y)->g(y)'] },
    ],
  }

function generate({ rng, difficulty }: GenerateContext): CompletionQuestion {
  for (const system of rng.shuffle(SYSTEMS[difficulty])) {
    const rules = system.rules.map((source) => {
      const [left, right] = source.split('->')
      return rule(
        parseTerm(left as string, system.signature),
        parseTerm(right as string, system.signature),
      )
    })
    const done = complete(rules, combinedOrder(system.precedence), 30)
    // "Ran out" is a real behaviour of the algorithm and a useless question:
    // there is no ending to reach inside a round.
    if (done.status === 'ran-out') continue
    // Something to do, and not so much that the clock decides it.
    if (done.status === 'completed' && done.steps.length > 8) continue
    return {
      signature: system.signature,
      precedence: system.precedence,
      rules: system.rules,
      outcome: done.status,
    }
  }

  // Last resort, so a round can never stall: Example 3.27.2.
  return {
    signature: { f: 1, g: 1 },
    precedence: ['g', 'f'],
    rules: ['f(f(x))->g(x)'],
    outcome: 'completed',
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

/** Run the loop the way the algorithm would, and record the moves. */
function solve(question: CompletionQuestion): CompletionAnswer {
  const order = orderFor(question)
  const moves: CompletionMove[] = []
  let state = startRun(readRules(question))

  for (let guard = 0; guard < 40; guard++) {
    const queue = pending(state)
    if (queue.length === 0) break
    const pair = queue[0] as { left: Term; right: Term }
    const left = reduce(state.rules, pair.left).result
    const right = reduce(state.rules, pair.right).result
    const printed: [string, string] = [showTerm(pair.left), showTerm(pair.right)]

    if (termsEqual(left, right)) {
      moves.push({ kind: 'join', pair: printed })
    } else {
      const comparison = order.compare(left, right)
      if (comparison === 'incomparable' || comparison === 'equal') {
        moves.push({ kind: 'fail' })
        return moves
      }
      moves.push({ kind: 'orient', pair: printed })
    }
    state = step(state, order, question.signature, moves[moves.length - 1] as CompletionMove)
    if (state.illegal !== null) break
  }
  return moves
}

function check(question: CompletionQuestion, answer: CompletionAnswer): Verdict {
  const state = replayRun(question, answer)

  if (state.illegal !== null) {
    return {
      correct: false,
      message: ILLEGAL_MESSAGE[state.illegal.kind],
      detail:
        'Reduce both sides first. If they meet, the pair is already handled. If they do not, orient the two results — and only give up when the order cannot order them.',
    }
  }

  if (state.status === 'running') {
    return {
      correct: false,
      message: `${pending(state).length} pair${pending(state).length === 1 ? '' : 's'} still waiting`,
      score: 0.3,
      detail: 'The loop ends when no critical pair is left, not when the ones you started with are.',
    }
  }

  if (state.status !== question.outcome) {
    return {
      correct: false,
      // Names what was claimed, never what is true.
      message: state.status === 'failed' ? 'It does not have to fail' : 'It does not complete',
      detail:
        'Failure means a pair reduced to two terms the order cannot compare. Anything else has a rule in it somewhere.',
    }
  }

  if (state.status === 'failed') {
    return {
      correct: true,
      message: 'Failed, correctly',
      detail:
        'A critical pair reduced to two incomparable terms, so no rule can be made of it. A different term order might do better — that is the first thing to try.',
    }
  }

  const added = state.rules.length - question.rules.length
  return {
    correct: true,
    message: added === 0 ? 'Already confluent' : `Completed with ${added} new rule${added === 1 ? '' : 's'}`,
    detail: isConfluent(state.rules)
      ? 'Every critical pair now joins, so Algorithm 3.21 gives one answer whatever route it takes — that is Theorem 3.28.'
      : 'The queue is empty.',
  }
}

const ILLEGAL_MESSAGE: Record<CompletionMove['kind'], string> = {
  join: 'Those two sides do not meet',
  orient: 'That pair cannot be made into a rule',
  fail: 'Nothing is stuck yet',
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<CompletionQuestion, CompletionAnswer>) {
  const order = useMemo(() => orderFor(question), [question])
  const [moves, setMoves] = useState<CompletionMove[]>([])
  const [chosen, setChosen] = useState<[string, string] | null>(null)
  const [shaking, shake] = useShake()

  useEffect(() => {
    setMoves([])
    setChosen(null)
  }, [question])

  const state = replayRun(question, moves)
  const queue = pending(state)
  const start = readRules(question)

  const selected =
    chosen === null
      ? null
      : queue.find((pair) => samePair(pair, parsePair(chosen, question.signature))) ?? null

  const reducedLeft = selected === null ? null : reduce(state.rules, selected.left).result
  const reducedRight = selected === null ? null : reduce(state.rules, selected.right).result
  const joins =
    reducedLeft !== null && reducedRight !== null && termsEqual(reducedLeft, reducedRight)
  const comparison =
    reducedLeft === null || reducedRight === null
      ? 'equal'
      : order.compare(reducedLeft, reducedRight)

  const play = (move: CompletionMove) => {
    if (locked) return
    const next = step(state, order, question.signature, move)
    if (next.illegal !== null) {
      shake()
      return
    }
    setMoves((previous) => [...previous, move])
    setChosen(null)
  }

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Complete the system
      </p>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Order: size first, ties by{' '}
        <span className="formula font-bold">{question.precedence.join(' < ')}</span>.
      </p>

      <p className="mt-2 text-xs font-bold uppercase tracking-wider text-ink-soft">R</p>
      <MovingList className="mt-1 flex flex-col gap-1">
        {state.rules.map((entry, index) => (
          <MovingItem
            key={`${showTerm(entry.left)}->${showTerm(entry.right)}`}
            id={`${index}`}
            disabled
            className={`tile flex w-full items-center px-3 py-1.5 text-left
              ${index >= start.length ? 'bg-coin' : 'bg-card-shade'}`}
          >
            <EquationText left={entry.left} right={entry.right} arrow="→" className="text-base font-bold" />
            {index >= start.length && (
              <span className="ml-auto text-[0.6rem] font-bold uppercase tracking-wider">added</span>
            )}
          </MovingItem>
        ))}
      </MovingList>

      <Shakeable shaking={shaking}>
        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
          Waiting critical pairs — {queue.length}
        </p>
        <div className="mt-1 flex flex-col gap-1">
          {queue.map((pair) => {
            const printed: [string, string] = [showTerm(pair.left), showTerm(pair.right)]
            const on = chosen !== null && chosen[0] === printed[0] && chosen[1] === printed[1]
            return (
              <button
                key={printed.join('|')}
                type="button"
                disabled={locked}
                onClick={() => setChosen(on ? null : printed)}
                className={`tile flex w-full items-center gap-1 px-3 py-1.5 text-left
                  ${on ? 'bg-space-blue text-white' : 'bg-card'}`}
              >
                <span className="formula font-bold">(</span>
                <TermText text={printed[0]} className={`text-sm font-bold ${on ? 'text-white' : ''}`} />
                <span className="formula font-bold opacity-60">,</span>
                <TermText text={printed[1]} className={`text-sm font-bold ${on ? 'text-white' : ''}`} />
                <span className="formula font-bold">)</span>
              </button>
            )
          })}
          {queue.length === 0 && (
            <p className="rounded-xl bg-grass px-3 py-2 text-sm font-bold text-white">
              No critical pairs left — the loop is done.
            </p>
          )}
        </div>
      </Shakeable>

      {selected !== null && !locked && (
        <Pop className="tile mt-2 bg-coin p-3">
          <p className="text-xs font-bold uppercase tracking-wider">Both sides reduced</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-2 text-base font-bold">
            <TermText term={reducedLeft as Term} />
            <span className="opacity-60">and</span>
            <TermText term={reducedRight as Term} />
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {joins ? (
              <Button variant="secondary" onClick={() => play({ kind: 'join', pair: chosen as [string, string] })}>
                They meet — discard the pair
              </Button>
            ) : comparison === 'incomparable' || comparison === 'equal' ? (
              <Button variant="danger" onClick={() => play({ kind: 'fail' })}>
                Cannot be ordered — fail
              </Button>
            ) : (
              <Button variant="primary" onClick={() => play({ kind: 'orient', pair: chosen as [string, string] })}>
                Add{' '}
                <span className="formula">
                  {comparison === 'greater'
                    ? `${showTerm(reducedLeft as Term)} → ${showTerm(reducedRight as Term)}`
                    : `${showTerm(reducedRight as Term)} → ${showTerm(reducedLeft as Term)}`}
                </span>
              </Button>
            )}
          </div>
        </Pop>
      )}

      {!locked && (
        <div className="mt-3 flex gap-2">
          {moves.length > 0 && (
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setMoves((previous) => previous.slice(0, -1))}
            >
              ← Undo
            </Button>
          )}
          <Button
            variant={state.status !== 'running' ? 'coin' : 'secondary'}
            className="flex-1"
            onClick={() => submit(moves)}
          >
            {state.status === 'completed'
              ? 'Submit — completed'
              : state.status === 'failed'
                ? 'Submit — failed'
                : 'Submit anyway'}
          </Button>
        </div>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            What the algorithm does
          </p>
          <p className="mt-1 font-bold">
            {question.outcome === 'completed'
              ? 'It completes, and the finished system is confluent.'
              : 'It fails: some pair reduces to two terms this order cannot compare.'}
          </p>
        </Pop>
      )}
    </Card>
  )
}

export const completionGame = defineMinigame<CompletionQuestion, CompletionAnswer>({
  id: 'completion',
  title: 'Complete It',
  tagline: 'Reduce, orient, repeat — until the queue empties or nothing can be ordered.',
  topics: ['rewriting'],
  icon: '🔧',
  roundSeconds: 240,
  sprintQuestions: 4,
  generate,
  check,
  solve,
  Screen,
  Guide: CompletionGuide,
  questionKey: (question) => question.rules.join(';'),
})
