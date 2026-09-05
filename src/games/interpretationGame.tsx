/**
 * Does the equation hold under this meaning? — Exercise 4, Collection Q12.
 *
 * The rest of the chapter insists a term is a meaningless string. This is the
 * one question that drops that: `f` really is multiplication, `g` really is
 * addition, and the equation is then true or false about numbers.
 *
 * You do not tick a box. You either **find the numbers where it breaks** —
 * which is a proof, checkable in a line — or claim it holds everywhere, which
 * is the harder claim and the one worth making carefully.
 */

import { useEffect, useState } from 'react'
import {
  INTERPRETATIONS,
  equationHoldsAt,
  equationVariables,
  evaluateTerm,
  findValueCounterexample,
  parseEquation,
  showTerm,
  showValueAssignment,
  type Equation,
  type Interpretation,
  type InterpretationId,
  type Signature,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { EquationText, TermText } from '@/ui/TermText'
import { Pop, Shakeable, useShake } from '@/ui/motion'
import { InterpretationGuide } from './interpretation.guide'

const SIG: Signature = { f: 2, g: 2 }

export interface InterpretationQuestion {
  id: InterpretationId
  /** The equation, as source so the question stays serialisable. */
  equation: string
  /** True when it holds for every value in the domain's sample. */
  holds: boolean
}

export interface InterpretationAnswer {
  /** Indices into the domain's sample, per variable. Null = claiming it holds. */
  values: Record<string, number> | null
}

const parse = (source: string): Equation => parseEquation(source, SIG)

const interpretationOf = (id: InterpretationId): Interpretation<unknown> =>
  INTERPRETATIONS[id] as Interpretation<unknown>

/** Turn the stored indices back into domain values. */
export function valuesOf(
  id: InterpretationId,
  indices: Record<string, number>,
): Record<string, unknown> {
  const { values } = interpretationOf(id).domain
  return Object.fromEntries(
    Object.entries(indices).map(([name, index]) => [name, values[index] as unknown]),
  )
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * The equations worth asking about.
 *
 * Distributivity is the exam's own. The others are laws that hold for some of
 * these readings and not others, so no interpretation is always the answer.
 */
const EQUATIONS: Record<Difficulty, string[]> = {
  easy: ['f(x,y)=f(y,x)', 'g(x,y)=g(y,x)', 'f(x,g(y,z))=g(f(x,y),f(x,z))'],
  medium: [
    'f(x,g(y,z))=g(f(x,y),f(x,z))',
    'f(x,f(y,z))=f(f(x,y),z)',
    'g(x,g(y,z))=g(g(x,y),z)',
    'f(x,y)=f(y,x)',
  ],
  hard: [
    'f(x,g(y,z))=g(f(x,y),f(x,z))',
    'g(x,f(y,z))=f(g(x,y),g(x,z))',
    'f(x,f(y,z))=f(f(x,y),z)',
    'f(g(x,y),z)=g(f(x,z),f(y,z))',
  ],
}

const IDS = Object.keys(INTERPRETATIONS) as InterpretationId[]

function generate({ rng, difficulty }: GenerateContext): InterpretationQuestion {
  // Draw the verdict first, so both answers come up. A round of nothing but
  // counterexamples would teach that "it holds" is never the answer.
  const wanted = rng.bool()

  for (let attempt = 0; attempt < 200; attempt++) {
    const id = rng.pick(IDS)
    const source = rng.pick(EQUATIONS[difficulty])
    const equation = parse(source)
    const holds = findValueCounterexample(interpretationOf(id), equation) === null
    if (holds !== wanted) continue
    return { id, equation: source, holds }
  }

  // Last resort: the exam's own pairing, which fails.
  const source = 'f(x,g(y,z))=g(f(x,y),f(x,z))'
  return { id: 'plusTimes', equation: source, holds: false }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

function solve(question: InterpretationQuestion): InterpretationAnswer {
  if (question.holds) return { values: null }
  const interpretation = interpretationOf(question.id)
  const found = findValueCounterexample(interpretation, parse(question.equation))
  if (found === null) return { values: null }
  const indices: Record<string, number> = {}
  for (const [name, value] of Object.entries(found)) {
    indices[name] = interpretation.domain.values.findIndex((candidate) =>
      interpretation.domain.equal(candidate, value as never),
    )
  }
  return { values: indices }
}

function check(question: InterpretationQuestion, answer: InterpretationAnswer): Verdict {
  const interpretation = interpretationOf(question.id)
  const equation = parse(question.equation)

  if (answer.values === null) {
    if (question.holds) {
      return {
        correct: true,
        message: 'It holds — no values break it',
        detail: `Under this reading the two sides denote the same thing whatever ${equationVariables(equation).join(', ')} are.`,
      }
    }
    const found = findValueCounterexample(interpretation, equation) as Record<string, unknown>
    return {
      correct: false,
      message: 'It does not hold here',
      detail: `There are values that break it — for instance ${showValueAssignment(interpretation, found)}.`,
    }
  }

  const values = valuesOf(question.id, answer.values)
  const missing = equationVariables(equation).filter((name) => values[name] === undefined)
  if (missing.length > 0) {
    return {
      correct: false,
      message: `No value chosen for ${missing.join(', ')}`,
      detail: 'A counterexample has to say what every variable is.',
    }
  }

  if (equationHoldsAt(interpretation, values as never, equation)) {
    const left = evaluateTerm(interpretation, values as never, equation.left)
    return {
      correct: false,
      message: 'Both sides agree there',
      detail: `At ${showValueAssignment(interpretation, values as never)} both sides come to ${interpretation.domain.show(left as never)}. A counterexample needs them to differ.`,
    }
  }

  const left = evaluateTerm(interpretation, values as never, equation.left)
  const right = evaluateTerm(interpretation, values as never, equation.right)
  return {
    correct: true,
    message: 'Broken — it does not hold',
    detail: `At ${showValueAssignment(interpretation, values as never)} the left side is ${interpretation.domain.show(left as never)} and the right is ${interpretation.domain.show(right as never)}.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<InterpretationQuestion, InterpretationAnswer>) {
  const interpretation = interpretationOf(question.id)
  const equation = parse(question.equation)
  const variables = equationVariables(equation)
  const [indices, setIndices] = useState<Record<string, number>>({})
  const [shaking, shake] = useShake()

  useEffect(() => {
    setIndices({})
  }, [question])

  const complete = variables.every((name) => indices[name] !== undefined)
  const values = complete ? (valuesOf(question.id, indices) as never) : null
  const left = values === null ? null : evaluateTerm(interpretation, values, equation.left)
  const right = values === null ? null : evaluateTerm(interpretation, values, equation.right)
  const differ =
    left !== null && right !== null && !interpretation.domain.equal(left as never, right as never)

  const bank = () => {
    if (locked) return
    if (!differ) return shake()
    submit({ values: indices })
  }

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Does it hold under this reading?
      </p>

      <div className="tile mt-2 bg-card-shade px-3 py-2">
        <EquationText left={equation.left} right={equation.right} className="text-lg font-bold" />
      </div>

      <ul className="mt-2 flex flex-col gap-1 text-sm font-semibold">
        <li className="text-ink-soft">
          <span className="formula font-bold text-ink">{interpretation.domain.label}</span> for the
          variables
        </li>
        {Object.entries(interpretation.describe).map(([symbol, words]) => (
          <li key={symbol} className="text-ink-soft">
            <span className="formula font-bold text-ink">{symbol}</span> … {words}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
        Try values — you are hunting for two sides that differ
      </p>

      <Shakeable shaking={shaking}>
        <div className="mt-1 flex flex-col gap-2">
          {variables.map((name) => (
            <div key={name} className="flex flex-wrap items-center gap-1.5">
              <span className="formula w-5 shrink-0 text-base font-bold">{name}</span>
              {interpretation.domain.values.map((value, index) => {
                const on = indices[name] === index
                return (
                  <button
                    key={index}
                    type="button"
                    disabled={locked}
                    onClick={() => setIndices((previous) => ({ ...previous, [name]: index }))}
                    className={`chunky min-h-10 px-3 text-sm font-bold
                      focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                      ${on ? 'bg-space-blue text-white' : 'bg-card text-ink hover:bg-card-shade'}`}
                  >
                    {interpretation.domain.show(value as never)}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </Shakeable>

      <div className="tile mt-3 flex flex-col gap-1 bg-card-shade px-3 py-2 text-sm font-bold">
        <Side
          label="left"
          term={showTerm(equation.left)}
          value={left === null ? '—' : interpretation.domain.show(left as never)}
        />
        <Side
          label="right"
          term={showTerm(equation.right)}
          value={right === null ? '—' : interpretation.domain.show(right as never)}
        />
        {complete && (
          <p className={`mt-1 text-xs uppercase tracking-wider ${differ ? 'text-space-red' : 'text-ink-soft'}`}>
            {differ ? 'they differ — that is a counterexample' : 'they agree here'}
          </p>
        )}
      </div>

      {!locked && (
        <div className="mt-3 flex flex-col gap-2">
          <Button variant={differ ? 'coin' : 'secondary'} onClick={bank}>
            {differ ? 'Submit this counterexample' : 'Submit counterexample'}
          </Button>
          <Button variant="secondary" onClick={() => submit({ values: null })}>
            It holds for every value
          </Button>
        </div>
      )}

      {locked && !question.holds && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            One set of values that breaks it
          </p>
          <p className="mt-1 font-bold">
            {showValueAssignment(
              interpretation,
              findValueCounterexample(interpretation, equation) as never,
            )}
          </p>
        </Pop>
      )}
    </Card>
  )
}

function Side({ label, term, value }: { label: string; term: string; value: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-2">
      <span className="w-10 shrink-0 text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
        {label}
      </span>
      <TermText text={term} className="font-bold" />
      <span className="opacity-60">=</span>
      <span className="formula font-bold">{value}</span>
    </p>
  )
}

export const interpretationGame = defineMinigame<InterpretationQuestion, InterpretationAnswer>({
  id: 'interpretation',
  title: 'Give It Meaning',
  tagline: 'Break the equation with real numbers, or show it cannot be broken.',
  topics: ['terms', 'equational-theory'],
  icon: '🧮',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: InterpretationGuide,
  questionKey: (question) => `${question.id}|${question.equation}`,
})
