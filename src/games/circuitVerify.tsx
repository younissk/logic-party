/**
 * Verifying a circuit by polynomial reduction — ln.pdf §5.3, exam26a Q4.4,
 * exam26bA Q4.4, Exercise 12 question 4.
 *
 * Every gate becomes a rule `z → q` — the gate polynomial `z - q` with its
 * signs flipped — and every variable gets `x² → x` to keep it a bit. Then take
 * the relation the circuit is *supposed* to satisfy and reduce it by that
 * system. Reduce to 0 and the circuit is correct; get stuck on anything else
 * and it is not.
 *
 * The player drives the reduction one rule at a time and then calls it. Both
 * halves matter: exam26bA's question hands you a circuit that does *not*
 * satisfy the stated relation, so "keep reducing until it hits zero" is not a
 * strategy — you have to be able to recognise a normal form that is not zero.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  GATE_LABELS,
  applyPolyRule,
  booleanRule,
  gatePolynomial,
  gateRule,
  isZero,
  multiply,
  normalise,
  polyConstant,
  polyVariable,
  rational,
  reducePolynomial,
  ruleApplies,
  showPolynomial,
  showPolyRule,
  type GateKind,
  type Polynomial,
  type PolyRule,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { MovingItem, MovingList, Pop } from '@/ui/motion'
import { CircuitVerifyGuide } from './circuitVerify.guide'

export interface Gate {
  kind: GateKind
  x: string
  y: string
  z: string
}

export interface CircuitQuestion {
  /** Which circuit, for the question key. */
  name: string
  /** What the circuit is meant to do, in words. */
  claim: string
  inputs: string[]
  /** In topological order: a gate's inputs are always already defined. */
  gates: Gate[]
  /** The relation to verify, as coefficient/variable pairs summed. */
  spec: [number, string][]
}

export interface CircuitAnswer {
  /** Rule labels, in the order applied. */
  applied: string[]
  /** What the player says the reduction shows. */
  claim: 'correct' | 'wrong'
}

// ---------------------------------------------------------------------------
// The reduction system
// ---------------------------------------------------------------------------

const linear = (spec: readonly [number, string][]): Polynomial =>
  normalise(
    spec.flatMap(([coefficient, name]) =>
      multiply(polyConstant(rational(coefficient)), polyVariable(name)),
    ),
  )

export const specPolynomial = (question: CircuitQuestion): Polynomial => linear(question.spec)

/**
 * Gate rules first, in reverse topological order, then the x²→x rules.
 *
 * The order only decides which rule `reducePolynomial` reaches for first; §5.3
 * is explicit that any choice is fine. Outputs first keeps the intermediate
 * polynomials small, and squares only appear once gates have been substituted,
 * so the boolean rules belong at the end.
 */
export function rulesOf(question: CircuitQuestion): PolyRule[] {
  const gates = [...question.gates]
    .reverse()
    .map((gate) => gateRule(gate.kind, gate.x, gate.y, gate.z))
  return [...gates, ...question.inputs.map(booleanRule)]
}

export const labelOf = (rule: PolyRule): string => showPolyRule(rule)

/** Replay a list of rule labels from the specification polynomial. */
export function replay(
  question: CircuitQuestion,
  applied: readonly string[],
): { polynomial: Polynomial; unknown: string[] } {
  const rules = rulesOf(question)
  const unknown: string[] = []
  let current = specPolynomial(question)

  for (const label of applied) {
    const rule = rules.find((candidate) => labelOf(candidate) === label)
    if (rule === undefined) {
      unknown.push(label)
      continue
    }
    current = applyPolyRule(current, rule)
  }
  return { polynomial: current, unknown }
}

/** Where the reduction ends, whatever order the rules are taken in. */
export const normalForm = (question: CircuitQuestion): Polynomial =>
  reducePolynomial(specPolynomial(question), rulesOf(question)).result

export const isCorrectCircuit = (question: CircuitQuestion): boolean =>
  isZero(normalForm(question))

// ---------------------------------------------------------------------------
// The circuits
// ---------------------------------------------------------------------------

interface Design {
  name: string
  claim: string
  inputs: string[]
  gates: Gate[]
  spec: [number, string][]
  difficulty: Difficulty[]
}

/**
 * Every design here is one the course actually asks about, and each is stored
 * as gates plus a relation — never as a pre-computed answer, so whether it
 * verifies is decided by running the reduction.
 */
const DESIGNS: readonly Design[] = [
  {
    name: 'half adder',
    claim: 'adds its two input bits',
    inputs: ['a', 'b'],
    gates: [
      { kind: 'and', x: 'a', y: 'b', z: 's1' },
      { kind: 'xor', x: 'a', y: 'b', z: 's0' },
    ],
    spec: [
      [1, 'a'],
      [1, 'b'],
      [-2, 's1'],
      [-1, 's0'],
    ],
    difficulty: ['easy', 'medium'],
  },
  {
    // exam26bA Q4.4 — the same two gates, asked to subtract instead.
    name: 'subtractor',
    claim: 'subtracts its second input bit from its first',
    inputs: ['a', 'b'],
    gates: [
      { kind: 'and', x: 'a', y: 'b', z: 's1' },
      { kind: 'xor', x: 'a', y: 'b', z: 's0' },
    ],
    spec: [
      [1, 'a'],
      [-1, 'b'],
      [-2, 's1'],
      [1, 's0'],
    ],
    difficulty: ['easy', 'medium'],
  },
  {
    name: 'OR-based adder',
    claim: 'adds its two input bits',
    inputs: ['a', 'b'],
    gates: [
      { kind: 'and', x: 'a', y: 'b', z: 's1' },
      { kind: 'or', x: 'a', y: 'b', z: 's0' },
    ],
    spec: [
      [1, 'a'],
      [1, 'b'],
      [-2, 's1'],
      [-1, 's0'],
    ],
    difficulty: ['easy', 'medium'],
  },
  {
    // Figure 5.2 — the worked example of §5.3.
    name: 'full adder',
    claim: 'adds its three input bits',
    inputs: ['a', 'b', 'c'],
    gates: [
      { kind: 'and', x: 'a', y: 'c', z: 'x1' },
      { kind: 'xor', x: 'a', y: 'c', z: 'x2' },
      { kind: 'and', x: 'b', y: 'x2', z: 'x3' },
      { kind: 'xor', x: 'b', y: 'x2', z: 's0' },
      { kind: 'or', x: 'x1', y: 'x3', z: 's1' },
    ],
    spec: [
      [1, 'a'],
      [1, 'b'],
      [1, 'c'],
      [-2, 's1'],
      [-1, 's0'],
    ],
    difficulty: ['medium', 'hard'],
  },
  {
    name: 'full adder with an AND carry',
    claim: 'adds its three input bits',
    inputs: ['a', 'b', 'c'],
    gates: [
      { kind: 'and', x: 'a', y: 'c', z: 'x1' },
      { kind: 'xor', x: 'a', y: 'c', z: 'x2' },
      { kind: 'and', x: 'b', y: 'x2', z: 'x3' },
      { kind: 'xor', x: 'b', y: 'x2', z: 's0' },
      { kind: 'and', x: 'x1', y: 'x3', z: 's1' },
    ],
    spec: [
      [1, 'a'],
      [1, 'b'],
      [1, 'c'],
      [-2, 's1'],
      [-1, 's0'],
    ],
    difficulty: ['hard'],
  },
  {
    name: 'three-bit OR chain',
    claim: 'outputs 1 exactly when at least one input bit is 1',
    inputs: ['a', 'b', 'c'],
    gates: [
      { kind: 'or', x: 'a', y: 'b', z: 'x1' },
      { kind: 'or', x: 'x1', y: 'c', z: 's0' },
      { kind: 'or', x: 'b', y: 'c', z: 'x2' },
      { kind: 'or', x: 'a', y: 'x2', z: 's1' },
    ],
    // The two output wires are built in different orders; the claim is that
    // they always agree.
    spec: [
      [1, 's0'],
      [-1, 's1'],
    ],
    difficulty: ['medium', 'hard'],
  },
]

const toQuestion = (design: Design): CircuitQuestion => ({
  name: design.name,
  claim: design.claim,
  inputs: design.inputs,
  gates: design.gates,
  spec: design.spec,
})

function generate({ rng, difficulty }: GenerateContext): CircuitQuestion {
  const pool = DESIGNS.filter((design) => design.difficulty.includes(difficulty))
  const usable = pool.length > 0 ? pool : DESIGNS.filter((design) => design.difficulty.length > 0)
  return toQuestion(rng.pick([...usable]))
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

function solve(question: CircuitQuestion): CircuitAnswer {
  const { used } = reducePolynomial(specPolynomial(question), rulesOf(question))
  return {
    applied: used.map(labelOf),
    claim: isCorrectCircuit(question) ? 'correct' : 'wrong',
  }
}

function check(question: CircuitQuestion, answer: CircuitAnswer): Verdict {
  const { polynomial } = replay(question, answer.applied)
  const rules = rulesOf(question)
  const stillApplies = rules.filter((rule) => ruleApplies(polynomial, rule))
  const truth = isCorrectCircuit(question)

  if (stillApplies.length > 0) {
    return {
      correct: false,
      message: `${stillApplies.length} rule${stillApplies.length === 1 ? ' still applies' : 's still apply'}`,
      score: 0.25,
      detail:
        'A reduction is only finished when no left-hand side occurs any more. Keep going until every gate variable and every square is gone.',
    }
  }

  if (answer.claim === (truth ? 'correct' : 'wrong')) {
    return {
      correct: true,
      message: truth
        ? 'Reduced to 0 — the circuit satisfies the relation'
        : `Stuck at ${showPolynomial(polynomial)} — the circuit does not satisfy it`,
      detail: truth
        ? 'Reduction to 0 means the relation follows from the gate equations, so it holds for every input.'
        : `A normal form other than 0 is a counterexample waiting to happen: any assignment of bits making ${showPolynomial(polynomial)} nonzero breaks the claim.`,
    }
  }

  return {
    correct: false,
    // The polynomial they ended on is already on their screen; naming the
    // verdict would hand over the retry.
    message: 'Read the polynomial you ended on again',
    score: 0.5,
    detail:
      'Zero means the relation holds for every input. Anything else means it does not — the reduction has finished either way.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function GateRow({ gate }: { gate: Gate }) {
  return (
    <div className="flex items-center gap-2 text-sm font-bold">
      <span className="chunky bg-space-blue px-2 py-0.5 text-xs font-black tracking-wider text-white">
        {GATE_LABELS[gate.kind]}
      </span>
      <span className="font-logic">
        {gate.x}, {gate.y}
      </span>
      <span className="text-ink-soft">→</span>
      <span className="font-logic">{gate.z}</span>
      <span className="ml-auto font-logic text-xs text-ink-soft">
        {showPolynomial(gatePolynomial(gate.kind, gate.x, gate.y, gate.z))}
      </span>
    </div>
  )
}

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<CircuitQuestion, CircuitAnswer>) {
  const rules = useMemo(() => rulesOf(question), [question])
  const [applied, setApplied] = useState<string[]>([])

  useEffect(() => setApplied([]), [question])

  const { polynomial } = useMemo(() => replay(question, applied), [question, applied])
  const live = rules.filter((rule) => ruleApplies(polynomial, rule))
  const finished = live.length === 0

  const apply = (rule: PolyRule) => {
    if (locked || !ruleApplies(polynomial, rule)) return
    setApplied((previous) => [...previous, labelOf(rule)])
  }

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Reduce it to zero — or show that you cannot
      </p>
      <p className="mt-1 text-sm font-medium">
        The claim: this circuit <strong>{question.claim}</strong>.
      </p>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">The gates</p>
      <div className="mt-1 flex flex-col gap-1">
        {question.gates.map((gate) => (
          <div key={gate.z} className="tile bg-card-shade px-3 py-1.5">
            <GateRow gate={gate} />
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
        The polynomial, after {applied.length} step{applied.length === 1 ? '' : 's'}
      </p>
      <div
        className={`mt-1 overflow-x-auto rounded-2xl px-3 py-2 text-center ${
          finished ? (isZero(polynomial) ? 'bg-grass/25' : 'bg-space-red/15') : 'bg-card-shade'
        }`}
      >
        <span className="font-logic text-lg font-bold">{showPolynomial(polynomial)}</span>
      </div>

      {!locked && (
        <>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
            Rules — greyed out when their left side does not occur
          </p>
          <MovingList className="mt-1 flex flex-col gap-1">
            {rules.map((rule) => {
              const usable = ruleApplies(polynomial, rule)
              return (
                <MovingItem
                  key={labelOf(rule)}
                  id={labelOf(rule)}
                  disabled={!usable}
                  onClick={() => apply(rule)}
                  className={`tile px-3 py-1.5 text-left font-logic text-sm font-bold ${
                    usable ? 'bg-coin' : 'bg-card-shade text-ink-soft opacity-60'
                  }`}
                >
                  {labelOf(rule)}
                </MovingItem>
              )
            })}
          </MovingList>

          {applied.length > 0 && (
            <Button
              variant="secondary"
              className="mt-2 w-full"
              onClick={() => setApplied((previous) => previous.slice(0, -1))}
            >
              Undo the last step
            </Button>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant={finished && isZero(polynomial) ? 'coin' : 'secondary'}
              onClick={() => submit({ applied, claim: 'correct' })}
            >
              It reduced to 0
            </Button>
            <Button
              variant={finished && !isZero(polynomial) ? 'coin' : 'secondary'}
              onClick={() => submit({ applied, claim: 'wrong' })}
            >
              It is stuck, not 0
            </Button>
          </div>
          {!finished && (
            <p className="mt-1 text-center text-xs font-medium text-ink-soft">
              {live.length === 1 ? '1 rule still applies.' : `${live.length} rules still apply.`}
            </p>
          )}
        </>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium text-ink-soft">
          The reduction ends at{' '}
          <span className="font-logic font-bold text-ink">{showPolynomial(normalForm(question))}</span>
          {isCorrectCircuit(question)
            ? ' — the relation follows from the gate equations.'
            : ' — so the relation does not follow, and the claim is false.'}
        </Pop>
      )}
    </Card>
  )
}

export const circuitVerifyGame = defineMinigame<CircuitQuestion, CircuitAnswer>({
  id: 'circuit-verify',
  title: 'Reduce To Zero',
  tagline: 'Drive the polynomial reduction and say whether the circuit really does what it claims.',
  topics: ['circuits'],
  icon: '🔌',
  roundSeconds: 210,
  sprintQuestions: 5,
  generate,
  check,
  solve,
  questionKey: (question) => question.name,
  explain: (question) =>
    `Reducing ${showPolynomial(specPolynomial(question))} by the gate rules ends at ${showPolynomial(
      normalForm(question),
    )}.`,
  Screen,
  Guide: CircuitVerifyGuide,
})
