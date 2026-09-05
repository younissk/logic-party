/**
 * Prove it or refute it — ln.pdf §3.3, Theorem 3.19.
 *
 * The theorem says ⊢ and ⊨ are the same relation: an equation follows from E
 * by the closure rules exactly when it is true under every interpretation
 * satisfying E. That turns one question into two very different jobs, and the
 * whole skill is deciding which one you are on.
 *
 * To prove, build a chain. To refute, find a meaning for the symbols that makes
 * every axiom true and the goal false — one such interpretation settles it, and
 * anyone can check it in a line. Searching for a chain that does not exist is
 * the way to lose the clock.
 *
 * Both answers are verified rather than compared against a stored flag: a chain
 * is replayed, an interpretation is evaluated. A correct answer of either kind
 * is accepted whatever the generator thought.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  INTERPRETATIONS,
  checkNamed,
  decide,
  derive,
  parseEquation,
  oneStep,
  showTerm,
  termsEqual,
  type Equation,
  type InterpretationId,
  type Signature,
  type Term,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { EquationText } from '@/ui/TermText'
import { Pop } from '@/ui/motion'
import { ChainBoard, replayChain, type ChainMove } from './chainBoard'
import { TheoryDecideGuide } from './theoryDecide.guide'

const SIG: Signature = { f: 2, g: 2 }

export interface TheoryDecideQuestion {
  axioms: string[]
  goal: string
  maxSize: number
  /** What the generator found. The marking does not depend on it. */
  derivable: boolean
}

export type TheoryDecideAnswer =
  | { kind: 'chain'; moves: ChainMove[] }
  | { kind: 'refute'; id: InterpretationId }

const readAxioms = (question: TheoryDecideQuestion): Equation[] =>
  question.axioms.map((source) => parseEquation(source, SIG))

const readGoal = (question: TheoryDecideQuestion): Equation => parseEquation(question.goal, SIG)

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const COMM = 'f(x,y)=f(y,x)'
const ASSOC = 'f(x,f(y,z))=f(f(x,y),z)'
const DIST = 'f(x,g(y,z))=g(f(x,y),f(x,z))'
const G_COMM = 'g(x,y)=g(y,x)'
const G_ASSOC = 'g(x,g(y,z))=g(g(x,y),z)'

/**
 * Questions built from laws, not from noise.
 *
 * An axiom set of random equations makes both jobs opaque: you cannot see a
 * chain and you cannot think of an interpretation. Commutativity,
 * associativity and distributivity are the ones every reader already has
 * meanings for, which is what makes refuting them a thought rather than a
 * search.
 */
const CANDIDATES: Record<Difficulty, { axioms: string[]; goal: string }[]> = {
  easy: [
    { axioms: [COMM], goal: 'f(g(x,y),g(y,x))=f(g(y,x),g(x,y))' },
    { axioms: [COMM], goal: DIST },
    { axioms: [COMM], goal: 'f(x,y)=f(y,x)' },
    { axioms: [ASSOC], goal: COMM },
    { axioms: [G_COMM], goal: 'g(f(x,y),z)=g(z,f(x,y))' },
  ],
  medium: [
    { axioms: [ASSOC], goal: 'f(x,f(f(y,z),w))=f(f(x,y),f(z,w))' },
    { axioms: [ASSOC], goal: DIST },
    { axioms: [DIST], goal: COMM },
    { axioms: [COMM, G_COMM], goal: 'f(g(x,y),g(z,w))=f(g(w,z),g(y,x))' },
    { axioms: [ASSOC], goal: 'f(f(x,y),f(z,w))=f(x,f(y,f(z,w)))' },
  ],
  hard: [
    { axioms: [ASSOC, COMM], goal: 'f(x,f(y,z))=f(z,f(y,x))' },
    { axioms: [ASSOC, COMM], goal: DIST },
    { axioms: [ASSOC, G_ASSOC], goal: COMM },
    { axioms: [DIST], goal: 'f(x,g(y,g(z,w)))=g(f(x,y),f(x,g(z,w)))' },
    { axioms: [COMM, ASSOC], goal: 'f(f(x,y),f(z,w))=f(f(w,z),f(y,x))' },
  ],
}

function generate({ rng, difficulty }: GenerateContext): TheoryDecideQuestion {
  // Draw the answer first, so both jobs come up.
  const wanted = rng.bool()

  for (const candidate of rng.shuffle(CANDIDATES[difficulty])) {
    const axioms = candidate.axioms.map((source) => parseEquation(source, SIG))
    const goal = parseEquation(candidate.goal, SIG)
    const maxSize = 16
    const verdict = decide(axioms, goal, { maxSize, maxTerms: 6000 })
    // "Unknown" is an honest answer for a decision procedure and a useless one
    // for a question, so those never make it onto the board.
    if (verdict.status === 'unknown') continue
    const derivable = verdict.status === 'derivable'
    if (derivable !== wanted) continue
    return { axioms: candidate.axioms, goal: candidate.goal, maxSize, derivable }
  }

  // Whatever the draw wanted, take a decidable one rather than stall.
  for (const candidate of CANDIDATES[difficulty]) {
    const axioms = candidate.axioms.map((source) => parseEquation(source, SIG))
    const goal = parseEquation(candidate.goal, SIG)
    const verdict = decide(axioms, goal, { maxSize: 16, maxTerms: 6000 })
    if (verdict.status === 'unknown') continue
    return {
      axioms: candidate.axioms,
      goal: candidate.goal,
      maxSize: 16,
      derivable: verdict.status === 'derivable',
    }
  }

  return { axioms: [ASSOC], goal: COMM, maxSize: 16, derivable: false }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

/** Does this interpretation satisfy every axiom and break the goal? */
export function refutes(question: TheoryDecideQuestion, id: InterpretationId): boolean {
  const goal = readGoal(question)
  const satisfiesAxioms = question.axioms.every(
    (source) => checkNamed(id, parseEquation(source, SIG)).holds,
  )
  return satisfiesAxioms && !checkNamed(id, goal).holds
}

function solve(question: TheoryDecideQuestion): TheoryDecideAnswer {
  const axioms = readAxioms(question)
  const goal = readGoal(question)
  const found = derive(axioms, goal, { maxSize: question.maxSize, maxTerms: 6000 })

  if (found.derivable) {
    const moves: ChainMove[] = []
    for (let index = 0; index + 1 < found.chain.length; index++) {
      const from = found.chain[index] as Term
      const to = found.chain[index + 1] as Term
      const options = stepsFrom(axioms, from, question.maxSize)
      const at = options.findIndex((option) => termsEqual(option, to))
      if (at === -1) break
      moves.push(at)
    }
    return { kind: 'chain', moves }
  }

  const id = (Object.keys(INTERPRETATIONS) as InterpretationId[]).find((candidate) =>
    refutes(question, candidate),
  )
  return { kind: 'refute', id: id ?? 'timesPlus' }
}

/**
 * The terms one step away, in the order the board lists them.
 *
 * The solver and the board must agree on that order, because a move is stored
 * as an index into it — so both read this one function.
 */
const stepsFrom = (axioms: readonly Equation[], term: Term, maxSize: number): Term[] =>
  oneStep(axioms, term, maxSize).map((step) => step.to)

function check(question: TheoryDecideQuestion, answer: TheoryDecideAnswer): Verdict {
  const axioms = readAxioms(question)
  const goal = readGoal(question)

  if (answer.kind === 'refute') {
    if (refutes(question, answer.id)) {
      const interpretation = INTERPRETATIONS[answer.id]
      const broken = checkNamed(answer.id, goal)
      return {
        correct: true,
        message: 'Refuted — E ⊬ it',
        detail: `Reading f as ${interpretation.describe.f} and g as ${interpretation.describe.g} makes every axiom true and the goal false at ${broken.counterexample}. By Theorem 3.19 that settles it.`,
      }
    }

    const satisfies = question.axioms.every(
      (source) => checkNamed(answer.id, parseEquation(source, SIG)).holds,
    )
    return {
      correct: false,
      message: satisfies ? 'That reading makes the goal true too' : 'That reading breaks an axiom',
      detail: satisfies
        ? 'A refutation needs the goal to fail. This one satisfies it, so it proves nothing.'
        : 'An interpretation that does not satisfy E says nothing about what follows from E.',
    }
  }

  const state = replayChain(axioms, goal.left, answer.moves, question.maxSize)
  if (state.broken) {
    return {
      correct: false,
      message: 'That chain does not replay',
      detail: 'Every link has to be one legal step from the one before it.',
    }
  }
  const end = state.chain[state.chain.length - 1] as Term
  if (termsEqual(end, goal.right)) {
    return {
      correct: true,
      message: `Proved in ${state.chain.length - 1} steps`,
      detail: 'A chain of legal rewrites from one side to the other is exactly what E ⊢ means.',
    }
  }

  return {
    correct: false,
    // Never says which job was the right one — that is the question.
    message: state.chain.length === 1 ? 'Nothing submitted' : 'The chain does not reach it',
    score: 0.2,
    detail:
      'Either finish the chain, or go the other way: find a reading of f and g making every axiom true and this equation false.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const IDS = Object.keys(INTERPRETATIONS) as InterpretationId[]

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<TheoryDecideQuestion, TheoryDecideAnswer>) {
  const axioms = useMemo(() => readAxioms(question), [question])
  const goal = useMemo(() => readGoal(question), [question])
  const [mode, setMode] = useState<'prove' | 'refute'>('prove')
  const [moves, setMoves] = useState<ChainMove[]>([])

  useEffect(() => {
    setMoves([])
    setMode('prove')
  }, [question])

  const state = replayChain(axioms, goal.left, moves, question.maxSize)
  const end = state.chain[state.chain.length - 1] as Term
  const arrived = termsEqual(end, goal.right)

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Does it follow from E?
      </p>
      <div className="tile mt-2 bg-card-shade px-3 py-2">
        <EquationText left={goal.left} right={goal.right} className="text-lg font-bold" />
      </div>

      {!locked && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant={mode === 'prove' ? 'primary' : 'secondary'}
            onClick={() => setMode('prove')}
          >
            Prove it
          </Button>
          <Button
            variant={mode === 'refute' ? 'primary' : 'secondary'}
            onClick={() => setMode('refute')}
          >
            Refute it
          </Button>
        </div>
      )}

      {mode === 'prove' ? (
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
          {!locked && (
            <Button
              variant={arrived ? 'coin' : 'secondary'}
              className="mt-3 w-full"
              onClick={() => submit({ kind: 'chain', moves })}
            >
              {arrived ? `Submit — proved in ${state.chain.length - 1}` : 'Submit — not there yet'}
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-xs font-medium text-ink-soft">
            Pick a reading that makes every axiom true and this equation false. One such reading is
            a complete proof that it does not follow.
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {IDS.map((id) => {
              const interpretation = INTERPRETATIONS[id]
              const keepsAxioms = question.axioms.every(
                (source) => checkNamed(id, parseEquation(source, SIG)).holds,
              )
              return (
                <button
                  key={id}
                  type="button"
                  disabled={locked}
                  onClick={() => submit({ kind: 'refute', id })}
                  className="tile flex w-full flex-col items-start bg-card px-3 py-2 text-left hover:bg-card-shade
                    focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin"
                >
                  <span className="text-sm font-bold">
                    <span className="formula">f</span> … {interpretation.describe.f}
                  </span>
                  <span className="text-sm font-bold">
                    <span className="formula">g</span> … {interpretation.describe.g}
                  </span>
                  <span className="mt-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
                    {keepsAxioms ? 'satisfies every axiom' : 'breaks an axiom'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            {question.derivable ? 'It does follow' : 'It does not follow'}
          </p>
          {question.derivable ? (
            <ol className="mt-1 flex flex-col gap-0.5">
              {derive(axioms, goal, { maxSize: question.maxSize, maxTerms: 6000 }).chain.map(
                (term, index) => (
                  <li key={index} className="formula font-bold">
                    {showTerm(term)}
                  </li>
                ),
              )}
            </ol>
          ) : (
            <p className="mt-1 font-bold">
              {(() => {
                const id = IDS.find((candidate) => refutes(question, candidate))
                if (id === undefined) return 'No reading on this list settles it.'
                const interpretation = INTERPRETATIONS[id]
                return `f as ${interpretation.describe.f}, g as ${interpretation.describe.g} — every axiom holds, the goal fails at ${checkNamed(id, goal).counterexample}.`
              })()}
            </p>
          )}
        </Pop>
      )}
    </Card>
  )
}

export const theoryDecideGame = defineMinigame<TheoryDecideQuestion, TheoryDecideAnswer>({
  id: 'theory-decide',
  title: 'Prove Or Refute',
  tagline: 'A chain, or a meaning that breaks it. Theorem 3.19 says either will do.',
  topics: ['equational-theory'],
  icon: '⚖️',
  roundSeconds: 210,
  sprintQuestions: 5,
  generate,
  check,
  solve,
  Screen,
  Guide: TheoryDecideGuide,
  questionKey: (question) => `${question.axioms.join(';')}|${question.goal}`,
})
