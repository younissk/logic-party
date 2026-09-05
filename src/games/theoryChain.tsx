/**
 * Building a proof in an equational theory — ln.pdf §3.3, Definition 3.16.
 *
 * `E ⊢ t=t′` is defined by four closure rules, and the exam asks which
 * equations follow from a given E. Ticking a box for that is a coin flip; the
 * honest answer is a chain of equalities from t to t′, each step swapping a
 * subterm that matches one side of an axiom for the other side.
 *
 * So you build the chain. Every question here is derivable — the generator
 * walks a real chain to find the target — and what varies is how long the walk
 * is and how many wrong turnings sit next to the right one.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  derive,
  equation,
  oneStep,
  parseEquation,
  parseTerm,
  showEquation,
  showTerm,
  termSize,
  termsEqual,
  variable,
  type Equation,
  type Rng,
  type Signature,
  type Term,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { EquationText } from '@/ui/TermText'
import { Pop } from '@/ui/motion'
import { ChainBoard, replayChain, type ChainMove } from './chainBoard'
import { TheoryChainGuide } from './theoryChain.guide'

export interface TheoryChainQuestion {
  signature: Signature
  /** The axiom set, as sources. */
  axioms: string[]
  goal: string
  /** Terms bigger than this are off the board — it keeps the search finite. */
  maxSize: number
  /** How many steps the shortest chain takes. */
  par: number
}

export type TheoryChainAnswer = ChainMove[]

const readAxioms = (question: TheoryChainQuestion): Equation[] =>
  question.axioms.map((source) => parseEquation(source, question.signature))

const readGoal = (question: TheoryChainQuestion): Equation =>
  parseEquation(question.goal, question.signature)

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  symbols: [name: string, arity: number][]
  variables: string[]
  axioms: string[][]
  start: [min: number, max: number]
  walk: [min: number, max: number]
  headroom: number
}

/**
 * Axiom sets worth deriving in.
 *
 * Each is small enough to hold in your head and generates an interesting
 * theory: idempotence, commuting functions, associativity, distribution.
 */
const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    symbols: [
      ['f', 1],
      ['g', 1],
    ],
    variables: ['x', 'y'],
    axioms: [['f(f(x))=f(x)'], ['f(g(x))=g(f(x))'], ['g(g(x))=x']],
    start: [3, 4],
    walk: [2, 3],
    headroom: 3,
  },
  medium: {
    symbols: [
      ['f', 1],
      ['g', 1],
      ['h', 2],
    ],
    variables: ['x', 'y'],
    axioms: [
      ['f(g(x))=g(f(x))', 'f(f(x))=x'],
      ['h(x,y)=h(y,x)', 'f(f(x))=x'],
      ['h(x,x)=x', 'f(g(x))=g(f(x))'],
    ],
    start: [4, 6],
    walk: [3, 4],
    headroom: 3,
  },
  hard: {
    symbols: [
      ['f', 1],
      ['g', 1],
      ['h', 2],
    ],
    variables: ['x', 'y', 'z'],
    axioms: [
      ['h(x,h(y,z))=h(h(x,y),z)', 'f(f(x))=x'],
      ['h(x,y)=h(y,x)', 'h(x,x)=f(x)'],
      ['f(h(x,y))=h(f(x),f(y))', 'f(f(x))=x'],
    ],
    start: [5, 8],
    walk: [4, 5],
    headroom: 4,
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

function generate({ rng, difficulty }: GenerateContext): TheoryChainQuestion {
  const profile = PROFILES[difficulty]
  const signature: Signature = Object.fromEntries(profile.symbols)

  for (let attempt = 0; attempt < 200; attempt++) {
    const sources = rng.pick(profile.axioms)
    const axioms = sources.map((source) => parseEquation(source, signature))
    const start = randomTerm(rng, profile, rng.range(...profile.start))
    if (start.kind === 'var') continue

    const maxSize = termSize(start) + profile.headroom

    // Walk a real chain, so the target is derivable by construction rather
    // than by hope.
    let current: Term = start
    const steps = rng.range(...profile.walk)
    for (let step = 0; step < steps; step++) {
      const options = oneStep(axioms, current, maxSize)
      if (options.length === 0) break
      current = (rng.pick(options) as { to: Term }).to
    }
    if (termsEqual(current, start)) continue

    const goal = equation(start, current)
    const found = derive(axioms, goal, { maxSize, maxTerms: 4000 })
    if (!found.derivable) continue
    const par = found.chain.length - 1
    // Too short and it is not a search; too long and the clock decides it.
    if (par < 2 || par > 5) continue

    return {
      signature,
      axioms: sources,
      goal: showEquation(goal),
      maxSize,
      par,
    }
  }

  // Last resort, so a round can never stall: Example 3.17's own theory.
  const fallback: Signature = { f: 1, g: 2 }
  return {
    signature: fallback,
    axioms: ['f(x)=f(f(x))'],
    goal: 'g(x,f(f(x)))=g(x,f(x))',
    maxSize: 8,
    par: 1,
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

/** The shortest chain, expressed as choices among the offered moves. */
function solve(question: TheoryChainQuestion): TheoryChainAnswer {
  const axioms = readAxioms(question)
  const goal = readGoal(question)
  const found = derive(axioms, goal, { maxSize: question.maxSize, maxTerms: 4000 })
  if (!found.derivable) return []

  const moves: ChainMove[] = []
  for (let index = 0; index + 1 < found.chain.length; index++) {
    const from = found.chain[index] as Term
    const to = found.chain[index + 1] as Term
    const options = oneStep(axioms, from, question.maxSize)
    const at = options.findIndex((option) => termsEqual(option.to, to))
    if (at === -1) return moves
    moves.push(at)
  }
  return moves
}

function check(question: TheoryChainQuestion, answer: TheoryChainAnswer): Verdict {
  const axioms = readAxioms(question)
  const goal = readGoal(question)
  const state = replayChain(axioms, goal.left, answer, question.maxSize)

  if (state.broken) {
    return {
      correct: false,
      message: 'That chain does not replay',
      detail: 'Every link has to be one legal step from the one before it.',
    }
  }

  const end = state.chain[state.chain.length - 1] as Term
  if (!termsEqual(end, goal.right)) {
    return {
      correct: false,
      // Says how far, never which way: sprint shows this before the retry.
      message: state.chain.length === 1 ? 'No steps taken' : 'Chain ends somewhere else',
      score: Math.min(0.6, (state.chain.length - 1) / Math.max(question.par, 1)) * 0.6,
      detail:
        'Each step swaps a subterm matching one side of an axiom for the other side. Axioms work in both directions — that is what symmetry in Definition 3.16 buys you.',
    }
  }

  const steps = state.chain.length - 1
  return {
    correct: true,
    message:
      steps === question.par
        ? `Derived in ${steps} — the shortest there is`
        : `Derived in ${steps}`,
    detail:
      steps === question.par
        ? 'Every step used an axiom on a subterm, and the chain is the proof.'
        : `The shortest chain takes ${question.par}. Yours is a proof too — a longer one.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<TheoryChainQuestion, TheoryChainAnswer>) {
  const axioms = useMemo(() => readAxioms(question), [question])
  const goal = useMemo(() => readGoal(question), [question])
  const [moves, setMoves] = useState<ChainMove[]>([])

  useEffect(() => {
    setMoves([])
  }, [question])

  const state = replayChain(axioms, goal.left, moves, question.maxSize)
  const end = state.chain[state.chain.length - 1] as Term
  const arrived = termsEqual(end, goal.right)

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Derive it from the axioms
      </p>
      <div className="tile mt-2 bg-card-shade px-3 py-2">
        <EquationText left={goal.left} right={goal.right} className="text-lg font-bold" />
      </div>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Shortest chain: {question.par} step{question.par === 1 ? '' : 's'}. Terms may not grow past{' '}
        {question.maxSize} symbols.
      </p>

      <div className="mt-3">
        <ChainBoard
          axioms={axioms}
          goal={goal}
          state={state}
          maxSize={question.maxSize}
          onMove={(move) => setMoves((previous) => [...previous, move])}
          onUndo={() => setMoves((previous) => previous.slice(0, -1))}
          locked={locked}
        />
      </div>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            One shortest chain
          </p>
          <ol className="mt-1 flex flex-col gap-0.5">
            {derive(axioms, goal, { maxSize: question.maxSize, maxTerms: 4000 }).chain.map(
              (term, index) => (
                <li key={index} className="formula font-bold">
                  {showTerm(term)}
                </li>
              ),
            )}
          </ol>
        </Pop>
      )}

      {!locked && (
        <Button
          variant={arrived ? 'coin' : 'secondary'}
          className="mt-3 w-full"
          onClick={() => submit(moves)}
        >
          {arrived ? `Submit — ${state.chain.length - 1} steps` : 'Submit — not there yet'}
        </Button>
      )}
    </Card>
  )
}

export const theoryChainGame = defineMinigame<TheoryChainQuestion, TheoryChainAnswer>({
  id: 'theory-chain',
  title: 'Chain It',
  tagline: 'Walk from one term to the other, one axiom at a time.',
  topics: ['equational-theory'],
  icon: '⛓️',
  roundSeconds: 210,
  sprintQuestions: 5,
  generate,
  check,
  solve,
  Screen,
  Guide: TheoryChainGuide,
  questionKey: (question) => `${question.axioms.join(';')}|${question.goal}`,
})

/** Shared with the guide so the worked chains use the game's own reader. */
export const chainOf = (
  axioms: readonly Equation[],
  goal: Equation,
  maxSize: number,
): Term[] => derive(axioms, goal, { maxSize, maxTerms: 4000 }).chain

export const parseWith = (source: string, signature: Signature): Term =>
  parseTerm(source, signature)
