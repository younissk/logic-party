/**
 * Gate polynomials — ln.pdf §5.3, Figure 5.3, Exercise 12 question 3.
 *
 * A gate becomes an equation. Give the gate's output its own variable z, and
 * write a polynomial that is zero exactly when z is what the gate would
 * actually put out. Figure 5.3 gives three:
 *
 *   AND   z − xy
 *   OR    z − x − y + xy
 *   XOR   z − x − y + 2xy
 *
 * Rather than have them recalled, this hands over the four dials the answer
 * has room for — the coefficients of x, y, xy and the constant, with z fixed
 * at +1 because a gate polynomial is always `z − (what the gate computes)`.
 * The board underneath evaluates the dialled polynomial on all four input
 * rows, so a wrong setting is visibly wrong on a row you can point at, which
 * is how the notes justify Figure 5.3 in the first place.
 *
 * Those four constraints pin the four dials down uniquely, so the reference
 * answer really is the only answer.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  GATE_LABELS,
  gatePolynomial,
  gateValue,
  polyConstant,
  polyVariable,
  multiply,
  add,
  rational,
  showPolynomial,
  evaluatePolynomial,
  type GateKind,
  type Polynomial,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { Pop } from '@/ui/motion'
import { GatePolynomialsGuide } from './gatePolynomials.guide'

export interface GateQuestion {
  kind: GateKind
  /** The two input variables and the output variable, in that order. */
  x: string
  y: string
  z: string
}

/** The four coefficients the player dials in. `z` is fixed at +1. */
export interface GateAnswer {
  x: number
  y: number
  xy: number
  constant: number
}

export const DIALS: readonly (keyof GateAnswer)[] = ['x', 'y', 'xy', 'constant']

export const EMPTY_ANSWER: GateAnswer = { x: 0, y: 0, xy: 0, constant: 0 }

/** The dial range. Wide enough for XOR's −2 and for wrong answers to exist. */
export const DIAL_RANGE = [-2, -1, 0, 1, 2] as const

// ---------------------------------------------------------------------------
// Turning dials into a polynomial
// ---------------------------------------------------------------------------

/** The polynomial the dials currently describe: z + a·x + b·y + c·xy + d. */
export function dialledPolynomial(question: GateQuestion, answer: GateAnswer): Polynomial {
  const X = polyVariable(question.x)
  const Y = polyVariable(question.y)
  const term = (coefficient: number, base: Polynomial): Polynomial =>
    multiply(polyConstant(rational(coefficient)), base)

  return add(
    add(
      add(polyVariable(question.z), term(answer.x, X)),
      add(term(answer.y, Y), term(answer.xy, multiply(X, Y))),
    ),
    polyConstant(rational(answer.constant)),
  )
}

/** The four input rows, each with the output the gate would actually give. */
export function gateRows(question: GateQuestion): { x: number; y: number; z: number }[] {
  const rows: { x: number; y: number; z: number }[] = []
  for (const x of [0, 1]) {
    for (const y of [0, 1]) rows.push({ x, y, z: gateValue(question.kind, x, y) })
  }
  return rows
}

/** Which of those rows the dialled polynomial fails to zero out. */
export function failingRows(question: GateQuestion, answer: GateAnswer): number[] {
  const polynomial = dialledPolynomial(question, answer)
  return gateRows(question)
    .map((row, index) => ({ index, row }))
    .filter(({ row }) => {
      const point = { [question.x]: row.x, [question.y]: row.y, [question.z]: row.z }
      return evaluatePolynomial(polynomial, point) !== 0
    })
    .map(({ index }) => index)
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const NAME_SETS: readonly [string, string, string][] = [
  ['x', 'y', 'z'],
  ['a', 'b', 'x1'],
  ['b', 'c', 'x2'],
  ['x2', 'x3', 's0'],
  ['a', 'c', 's1'],
]

const KINDS: Record<Difficulty, readonly GateKind[]> = {
  // AND first: its polynomial is the one with the fewest moving parts.
  easy: ['and', 'or'],
  medium: ['and', 'or', 'xor'],
  hard: ['or', 'xor'],
}

function generate({ rng, difficulty }: GenerateContext): GateQuestion {
  const kind = rng.pick([...KINDS[difficulty]])
  // Only the hard rounds rename the wires. On easy the names match Figure 5.3
  // exactly, so what is being asked is the shape and not the reading.
  const [x, y, z] =
    difficulty === 'hard' ? rng.pick([...NAME_SETS]) : (NAME_SETS[0] as [string, string, string])
  return { kind, x, y, z }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

export function solve(question: GateQuestion): GateAnswer {
  switch (question.kind) {
    case 'and':
      return { x: 0, y: 0, xy: -1, constant: 0 }
    case 'or':
      return { x: -1, y: -1, xy: 1, constant: 0 }
    case 'xor':
      return { x: -1, y: -1, xy: 2, constant: 0 }
  }
}

function check(question: GateQuestion, answer: GateAnswer): Verdict {
  const wanted = solve(question)
  const wrongDials = DIALS.filter((dial) => answer[dial] !== wanted[dial])
  const failing = failingRows(question, answer)

  if (wrongDials.length === 0) {
    return {
      correct: true,
      message: `${GATE_LABELS[question.kind]} is ${showPolynomial(gatePolynomial(question.kind, question.x, question.y, question.z))}`,
      detail:
        'Zero on all four rows, and no other setting of the four dials manages that — four rows, four unknowns.',
    }
  }

  return {
    correct: false,
    // A count of failing rows, never which dial or which way: the sprint
    // shows this before the retry, and the board already says which rows.
    message:
      failing.length === 0
        ? 'Zero on every row, but not in the form asked for'
        : `${failing.length} of the four rows is not zero yet`,
    score: (4 - failing.length) / 4,
    detail: `Evaluate your polynomial on the row where ${question.x} and ${question.y} are both 0 — that fixes the constant. Then one input at a time fixes the two single dials, and the last row fixes ${question.x}${question.y}.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const DIAL_LABELS: Readonly<Record<keyof GateAnswer, (question: GateQuestion) => string>> = {
  x: (question) => question.x,
  y: (question) => question.y,
  xy: (question) => `${question.x}${question.y}`,
  constant: () => '1',
}

function Dial({
  label,
  value,
  onChange,
  locked,
  reveal,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  locked: boolean
  reveal: number | null
}) {
  return (
    <div className="tile flex flex-col items-center gap-1 bg-card-shade px-2 py-2">
      <span className="font-logic text-base font-bold">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={locked || value <= (DIAL_RANGE[0] as number)}
          onClick={() => onChange(value - 1)}
          aria-label={`Lower the coefficient of ${label}`}
          className="chunky h-8 w-8 bg-card text-lg font-black leading-none disabled:opacity-40"
        >
          −
        </button>
        <span
          className={`w-10 text-center text-xl font-black tabular-nums ${
            value === 0 ? 'text-ink-soft' : ''
          }`}
        >
          {value > 0 ? `+${value}` : value}
        </span>
        <button
          type="button"
          disabled={locked || value >= (DIAL_RANGE[DIAL_RANGE.length - 1] as number)}
          onClick={() => onChange(value + 1)}
          aria-label={`Raise the coefficient of ${label}`}
          className="chunky h-8 w-8 bg-card text-lg font-black leading-none disabled:opacity-40"
        >
          +
        </button>
      </div>
      {reveal !== null && reveal !== value && (
        <span className="text-xs font-bold text-space-red">wanted {reveal > 0 ? `+${reveal}` : reveal}</span>
      )}
    </div>
  )
}

function GateDiagram({ question }: { question: GateQuestion }) {
  return (
    <div className="flex flex-col items-center gap-0">
      <div className="flex items-end gap-8">
        <span className="font-logic text-base font-bold">{question.x}</span>
        <span className="font-logic text-base font-bold">{question.y}</span>
      </div>
      <div className="flex gap-8">
        <span className="h-4 w-0.5 bg-ink/40" />
        <span className="h-4 w-0.5 bg-ink/40" />
      </div>
      <div className="chunky bg-space-blue px-5 py-1.5 text-sm font-black tracking-widest text-white">
        {GATE_LABELS[question.kind]}
      </div>
      <span className="h-4 w-0.5 bg-ink/40" />
      <span className="font-logic text-base font-bold">{question.z}</span>
    </div>
  )
}

function Screen({
  question,
  submit,
  locked,
  solution,
}: MinigameScreenProps<GateQuestion, GateAnswer>) {
  const [answer, setAnswer] = useState<GateAnswer>(EMPTY_ANSWER)

  useEffect(() => setAnswer(EMPTY_ANSWER), [question])

  const polynomial = useMemo(() => dialledPolynomial(question, answer), [question, answer])
  const rows = useMemo(() => gateRows(question), [question])
  const bad = useMemo(() => new Set(failingRows(question, answer)), [question, answer])

  const set = (dial: keyof GateAnswer, value: number) => {
    if (locked) return
    setAnswer((previous) => ({ ...previous, [dial]: value }))
  }

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Write the gate polynomial
      </p>

      <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-8">
        <GateDiagram question={question} />
        <p className="max-w-xs text-sm font-medium text-ink-soft">
          It has to be zero exactly when <span className="font-logic font-bold">{question.z}</span>{' '}
          is the output this gate really produces. Dial the four coefficients.
        </p>
      </div>

      <div className="mt-3 rounded-2xl bg-card-shade px-3 py-2 text-center">
        <span className="font-logic text-lg font-bold">{showPolynomial(polynomial)}</span>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {DIALS.map((dial) => (
          <Dial
            key={dial}
            label={DIAL_LABELS[dial](question)}
            value={answer[dial]}
            onChange={(value) => set(dial, value)}
            locked={locked}
            reveal={solution === null ? null : solution[dial]}
          />
        ))}
      </div>
      <p className="mt-1 text-center text-xs font-medium text-ink-soft">
        The <span className="font-logic font-bold">{question.z}</span> coefficient is fixed at +1 —
        a gate polynomial is always the output minus what the gate computes.
      </p>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
        Your polynomial on every input row
      </p>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full text-center text-sm font-bold tabular-nums">
          <thead className="text-xs uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-2 py-1 font-logic normal-case">{question.x}</th>
              <th className="px-2 py-1 font-logic normal-case">{question.y}</th>
              <th className="px-2 py-1 font-logic normal-case">{question.z}</th>
              <th className="px-2 py-1">value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const point = { [question.x]: row.x, [question.y]: row.y, [question.z]: row.z }
              const value = evaluatePolynomial(polynomial, point)
              return (
                <tr key={index} className={bad.has(index) ? 'bg-space-red/15' : 'bg-grass/15'}>
                  <td className="px-2 py-1">{row.x}</td>
                  <td className="px-2 py-1">{row.y}</td>
                  <td className="px-2 py-1">{row.z}</td>
                  <td className="px-2 py-1">{value}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {locked && solution !== null && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium text-ink-soft">
          Figure 5.3 gives{' '}
          <span className="font-logic font-bold text-ink">
            {showPolynomial(gatePolynomial(question.kind, question.x, question.y, question.z))}
          </span>
          .
        </Pop>
      )}

      {!locked && (
        <Button variant="coin" className="mt-3 w-full" onClick={() => submit(answer)}>
          {bad.size === 0 ? 'Submit' : `Submit — ${bad.size} row${bad.size === 1 ? '' : 's'} still off`}
        </Button>
      )}
    </Card>
  )
}

export const gatePolynomialsGame = defineMinigame<GateQuestion, GateAnswer>({
  id: 'gate-polynomials',
  title: 'Write The Gate',
  tagline: 'Dial the coefficients until the gate polynomial vanishes on every input row.',
  topics: ['circuits'],
  icon: '⚡',
  roundSeconds: 150,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  questionKey: (question) => `${question.kind}:${question.z}`,
  explain: (question) =>
    `${GATE_LABELS[question.kind]} has the gate polynomial ${showPolynomial(
      gatePolynomial(question.kind, question.x, question.y, question.z),
    )}.`,
  Screen,
  Guide: GatePolynomialsGuide,
})
