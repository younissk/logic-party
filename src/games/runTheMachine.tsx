/**
 * Running a finite automaton — ln.pdf §5.2, Exercise 11 question 2.
 *
 * Automata are in this chapter for one reason: they are how T(ℕ,=,+) is shown
 * decidable. Write numbers in binary least significant bit first, feed a tuple
 * of them to an automaton one column of bits at a time, and a Presburger
 * formula becomes an automaton — conjunction is a product, negation is a
 * complement, and ∃ is a projection. The formula is in the theory exactly when
 * its automaton accepts everything.
 *
 * So the drill is running one. Not "is this word accepted", which is a coin
 * flip, but the run itself: pick the state after each letter. The addition
 * automaton is in the pool because its two states really do mean something —
 * "carry" and "no carry" — and following it is following the schoolbook
 * algorithm.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  ADDITION_AUTOMATON,
  EQUALITY_AUTOMATON,
  INTEGER_LITERAL,
  accepts,
  chunk,
  isDeterministic,
  reachableStates,
  tripleOf,
  tripleWord,
  type Automaton,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { MovingItem, MovingList, Pop } from '@/ui/motion'
import { RunTheMachineGuide } from './runTheMachine.guide'

export interface MachineQuestion {
  machine: string
  /** The word, already split into letters. */
  letters: string[]
  /** What the word means, when it means something. */
  reading: string | null
}

/** The state after each letter. The initial state is not part of the answer. */
export type MachineAnswer = (string | null)[]

// ---------------------------------------------------------------------------
// The machines
// ---------------------------------------------------------------------------

/** Exercise 11's shape: three states over {a,b,c}, and a trap on every letter. */
const ABC: Automaton = {
  states: ['q0', 'q1', 'q2'],
  alphabet: ['a', 'b', 'c'],
  initial: 'q0',
  accepting: ['q2'],
  transitions: [
    { from: 'q0', to: 'q1', letters: ['a'] },
    { from: 'q0', to: 'q0', letters: ['b'] },
    { from: 'q0', to: 'q2', letters: ['c'] },
    { from: 'q1', to: 'q1', letters: ['a', 'b'] },
    { from: 'q1', to: 'q2', letters: ['c'] },
    { from: 'q2', to: 'q0', letters: ['a'] },
    { from: 'q2', to: 'q2', letters: ['b', 'c'] },
  ],
}

interface Machine {
  name: string
  title: string
  blurb: string
  automaton: Automaton
  /** Letters are read one character at a time, or three at a time for triples. */
  letterSize: number
  difficulty: Difficulty[]
  /** How to describe a word in words, when it stands for numbers. */
  read?: (word: string) => string
}

const MACHINES: readonly Machine[] = [
  {
    name: 'abc',
    title: 'Three states over a, b, c',
    blurb: 'accepting state q2',
    automaton: ABC,
    letterSize: 1,
    difficulty: ['easy', 'medium'],
  },
  {
    name: 'integer',
    title: 'The integer-literal automaton',
    blurb: 'an optional sign, then 0 alone or a non-zero digit and any digits',
    automaton: INTEGER_LITERAL,
    letterSize: 1,
    difficulty: ['easy', 'medium'],
  },
  {
    name: 'equality',
    title: 'The equality automaton',
    blurb: 'a bit from each of two numbers, least significant first',
    automaton: EQUALITY_AUTOMATON,
    letterSize: 2,
    difficulty: [],
  },
  {
    name: 'addition',
    title: 'The addition automaton',
    blurb: 'state a is no carry, state b is a carry pending',
    automaton: ADDITION_AUTOMATON,
    letterSize: 3,
    difficulty: ['medium', 'hard'],
    read: (word) => {
      const [x, y, sum] = tripleOf(word)
      return `${x} + ${y} = ${sum}?`
    },
  },
]

export const machineOf = (question: MachineQuestion): Machine =>
  MACHINES.find((machine) => machine.name === question.machine) ?? MACHINES[0]!

export const automatonOf = (question: MachineQuestion): Automaton => machineOf(question).automaton

/** The run: the state after each letter. Deterministic, so exactly one each. */
export function run(question: MachineQuestion): (string | null)[] {
  const automaton = automatonOf(question)
  const states: (string | null)[] = []
  for (let index = 0; index < question.letters.length; index++) {
    const reached = reachableStates(automaton, question.letters.slice(0, index + 1))
    states.push(reached[0] ?? null)
  }
  return states
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const LENGTHS: Record<Difficulty, [number, number]> = {
  easy: [3, 4],
  medium: [4, 5],
  hard: [5, 6],
}

function generate({ rng, difficulty }: GenerateContext): MachineQuestion {
  const pool = MACHINES.filter((machine) => machine.difficulty.includes(difficulty))
  const usable = pool.length > 0 ? pool : MACHINES.filter((m) => m.difficulty.length > 0)

  for (let attempt = 0; attempt < 40; attempt++) {
    const machine = rng.pick([...usable])
    const length = rng.range(...LENGTHS[difficulty])

    // The addition automaton only gets words that stand for a real sum half the
    // time, so "does it accept" is a genuine question rather than a formality.
    let letters: string[]
    if (machine.name === 'addition' && rng.bool(0.5)) {
      const x = rng.range(0, 2 ** (length - 1) - 1)
      const y = rng.range(0, 2 ** (length - 1) - 1)
      const sum = rng.bool(0.5) ? x + y : x + y + rng.range(1, 3)
      letters = chunk(tripleWord(x, y, sum, length), 3)
    } else {
      letters = Array.from({ length }, () => rng.pick(machine.automaton.alphabet))
    }

    const question: MachineQuestion = {
      machine: machine.name,
      letters,
      reading: machine.read === undefined ? null : machine.read(letters.join('')),
    }

    // A word that falls off the machine leaves nothing to pick, so the run has
    // to stay alive the whole way.
    if (run(question).some((state) => state === null)) continue
    if (!isDeterministic(machine.automaton)) continue
    return question
  }

  const fallback: MachineQuestion = { machine: 'abc', letters: ['a', 'c', 'b'], reading: null }
  return fallback
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: MachineQuestion): MachineAnswer => run(question)

function check(question: MachineQuestion, answer: MachineAnswer): Verdict {
  const wanted = run(question)
  const firstWrong = wanted.findIndex((state, index) => answer[index] !== state)
  const automaton = automatonOf(question)
  const accepted = accepts(automaton, question.letters)

  if (firstWrong === -1) {
    return {
      correct: true,
      message: accepted ? 'Accepted' : 'Rejected — it ends outside the accepting states',
      detail: `The run ends in ${wanted[wanted.length - 1]}, and the accepting states are ${automaton.accepting.join(', ')}.`,
    }
  }

  const wrong = wanted.filter((state, index) => answer[index] !== state).length
  return {
    correct: false,
    // A count, and never the state: naming it would finish the run.
    message: `${wrong} step${wrong === 1 ? '' : 's'} off the rails`,
    score: (wanted.length - wrong) / wanted.length,
    detail:
      'Take one letter at a time from the state you are in, and look up the edge that carries that letter. Once a step is wrong, everything after it is too.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function TransitionTable({ automaton }: { automaton: Automaton }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-ink-soft">
          <tr>
            <th className="px-2 py-1">from</th>
            <th className="px-2 py-1">on</th>
            <th className="px-2 py-1">to</th>
          </tr>
        </thead>
        <tbody>
          {automaton.transitions.map((edge, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-card-shade/50' : ''}>
              <td className="px-2 py-1 font-logic font-bold">{edge.from}</td>
              <td className="px-2 py-1 font-logic">{edge.letters.join(' ')}</td>
              <td className="px-2 py-1 font-logic font-bold">{edge.to}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Screen({ question, submit, locked }: MinigameScreenProps<MachineQuestion, MachineAnswer>) {
  const machine = machineOf(question)
  const automaton = machine.automaton
  const wanted = useMemo(() => run(question), [question])
  const [path, setPath] = useState<(string | null)[]>(question.letters.map(() => null))

  useEffect(() => setPath(question.letters.map(() => null)), [question])

  const shown = locked ? wanted : path
  const step = path.findIndex((state) => state === null)
  const ready = step === -1
  const last = shown[shown.length - 1]
  const from = step === -1 ? null : step === 0 ? automaton.initial : (path[step - 1] as string)

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Run the word through the machine
      </p>
      <p className="mt-1 text-sm font-bold">{machine.title}</p>
      <p className="text-xs font-medium text-ink-soft">
        start {automaton.initial}, accept {automaton.accepting.join(', ')} — {machine.blurb}
      </p>

      <div className="mt-2">
        <TransitionTable automaton={automaton} />
      </div>

      {question.reading !== null && (
        <p className="mt-2 rounded-xl bg-coin px-3 py-1.5 text-center text-sm font-bold">
          The columns read {question.reading}
        </p>
      )}

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">The run</p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className="tile bg-space-blue px-2.5 py-1 font-logic text-sm font-bold text-white">
          {automaton.initial}
        </span>
        {question.letters.map((letter, index) => (
          <span key={index} className="flex items-center gap-1">
            <span className="font-logic text-xs font-bold text-ink-soft">—{letter}→</span>
            <span
              className={`tile min-w-11 px-2.5 py-1 text-center font-logic text-sm font-bold ${
                shown[index] === null
                  ? 'bg-card-shade text-ink-soft'
                  : locked
                    ? shown[index] === wanted[index]
                      ? 'bg-grass text-white'
                      : 'bg-space-red text-white'
                    : 'bg-coin'
              }`}
            >
              {shown[index] ?? '◻'}
            </span>
          </span>
        ))}
      </div>

      {!locked && (
        <>
          {from !== null && (
            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
              From {from}, reading {question.letters[step]} — go to
            </p>
          )}
          <MovingList className="mt-1 flex flex-wrap gap-1.5">
            {automaton.states.map((state) => (
              <MovingItem
                key={state}
                id={state}
                disabled={ready}
                onClick={() =>
                  setPath((previous) => {
                    const index = previous.findIndex((entry) => entry === null)
                    if (index === -1) return previous
                    const next = [...previous]
                    next[index] = state
                    return next
                  })
                }
                className="tile bg-card px-3 py-1.5 font-logic text-sm font-bold"
              >
                {state}
              </MovingItem>
            ))}
          </MovingList>

          {path.some((state) => state !== null) && (
            <Button
              variant="secondary"
              className="mt-2 w-full"
              onClick={() =>
                setPath((previous) => {
                  const next = [...previous]
                  const last = next.reduce(
                    (found, state, index) => (state !== null ? index : found),
                    -1,
                  )
                  if (last >= 0) next[last] = null
                  return next
                })
              }
            >
              Undo the last step
            </Button>
          )}

          <Button
            variant="coin"
            className="mt-2 w-full"
            disabled={!ready}
            onClick={() => submit(path)}
          >
            {ready
              ? `Submit — this run ${automaton.accepting.includes(last as string) ? 'accepts' : 'rejects'}`
              : `${path.filter((state) => state === null).length} letters to go`}
          </Button>
        </>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium text-ink-soft">
          {machine.name === 'addition'
            ? 'The two states are the carry bit. Following this automaton is doing the addition column by column — which is why T(ℕ,=,+) is decidable.'
            : 'A word is accepted when the run ends in an accepting state. Nothing about the path matters except where it finishes.'}
        </Pop>
      )}
    </Card>
  )
}

export const runTheMachineGame = defineMinigame<MachineQuestion, MachineAnswer>({
  id: 'automata',
  title: 'Run The Machine',
  tagline: 'Follow the automaton one letter at a time — including the one that does addition.',
  topics: ['arithmetic-theories'],
  icon: '🤖',
  roundSeconds: 150,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  questionKey: (question) => `${question.machine}:${question.letters.join('')}`,
  explain: (question) =>
    `The run visits ${[automatonOf(question).initial, ...run(question)].join(' → ')}, so the word is ${
      accepts(automatonOf(question), question.letters) ? 'accepted' : 'rejected'
    }.`,
  Screen,
  Guide: RunTheMachineGuide,
})
