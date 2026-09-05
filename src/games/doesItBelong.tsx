/**
 * Membership in the theory of a fixed interpretation — ln.pdf §5.1,
 * exam26a Q4.2, Exercise 10 question 3.
 *
 * Fix an interpretation and take every closed formula true in it. That set is
 * a theory — the theory of a structure always is, and it is always complete.
 * Deciding membership is then plain evaluation: Definition 4.3, run over a
 * universe small enough to run over.
 *
 * The question the exam asks is yes or no, which is one bit and guessable. So
 * what the game asks for is the evaluation itself: for each element of the
 * universe, is the body true when the outermost variable takes that value? The
 * verdict follows from those, and getting it right by accident stops being
 * possible.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  elementLabel,
  evaluateFormula,
  holdsIn,
  makeStructure,
  parseFormula,
  showFormula,
  type FoFormula,
  type FoSignature,
  type Structure,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card, SpaceToken } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'
import { Pop } from '@/ui/motion'
import { DoesItBelongGuide } from './doesItBelong.guide'

export interface BelongQuestion {
  /** Which interpretation, by name. */
  world: string
  /** The formula, whose outermost connective is a quantifier. */
  source: string
}

export interface BelongAnswer {
  /** One per element of the universe: is the body true at that value? */
  rows: (boolean | null)[]
}

// ---------------------------------------------------------------------------
// The interpretations
// ---------------------------------------------------------------------------

interface World {
  name: string
  blurb: string
  labels: string[]
  signature: FoSignature
  structure: Structure
  formulas: Record<Difficulty, string[]>
}

/** exam26a Q4.2: U = {a,b}, f swaps them, p holds of a only. */
const SWAP: World = (() => {
  const labels = ['a', 'b']
  return {
    name: 'swap',
    blurb: 'f(a)=b, f(b)=a, p(a) true, p(b) false',
    labels,
    signature: { predicates: { p: 1 }, functions: { f: 1 } },
    structure: makeStructure({
      size: 2,
      labels,
      functions: { f: { arity: 1, value: ([x]) => 1 - (x as number) } },
      predicates: { p: { arity: 1, value: ([x]) => x === 0 } },
    }),
    formulas: {
      easy: ['∀x:p(x)', '∃x:p(x)', '∀x:p(f(x))', '∃x:¬p(f(x))'],
      medium: ['∃x:∀y:(p(x)→p(f(y)))', '∀x:∃y:(p(x)∧¬p(y))', '∀x:(p(x)↔¬p(f(x)))'],
      hard: [
        '∃x:∀y:(p(x)→p(f(y)))',
        '∀x:∀y:((p(x)∧p(y))→p(f(f(x))))',
        '∃x:(p(f(x))∧¬p(x))',
        '∀x:((∃y:p(f(y)))→p(f(f(x))))',
      ],
    },
  }
})()

/** Exercise 10 Q3: U = {a,b,c}, f cycles, p is the table from the sheet. */
const CYCLE: World = (() => {
  const labels = ['a', 'b', 'c']
  // Row x, column y, exactly as the exercise prints it.
  const table: boolean[][] = [
    [true, true, false],
    [true, false, true],
    [false, true, true],
  ]
  return {
    name: 'cycle',
    blurb: 'f(a)=b, f(b)=c, f(c)=a, with p given by the table',
    labels,
    signature: { predicates: { p: 2 }, functions: { f: 1 } },
    structure: makeStructure({
      size: 3,
      labels,
      functions: { f: { arity: 1, value: ([x]) => ((x as number) + 1) % 3 } },
      predicates: {
        p: { arity: 2, value: ([x, y]) => table[x as number]?.[y as number] === true },
      },
    }),
    formulas: {
      easy: ['∀x:p(x,x)', '∃x:p(f(x),x)', '∀x:∃y:p(x,y)'],
      medium: ['∀y:∃x:p(f(y),x)', '∃x:∀y:p(x,y)', '∀x:∀y:(p(x,y)→p(y,x))'],
      hard: [
        '∀y:((∃x:p(f(y),x))↔(p(f(y),a())∨p(f(y),b())))',
        '∀y:((∃x:p(f(y),x))↔(p(f(y),a())∧p(f(y),b())))',
        '∃x:∀y:(p(x,y)→p(y,f(x)))',
      ],
    },
  }
})()

export const WORLDS: readonly World[] = [SWAP, CYCLE]

export const worldOf = (question: BelongQuestion): World =>
  WORLDS.find((world) => world.name === question.world) ?? SWAP

/** The signature grows a constant per element, as Exercise 10 assumes. */
export function signatureWithNames(world: World): FoSignature {
  const functions = { ...world.signature.functions }
  for (const label of world.labels) functions[label] = 0
  return { predicates: world.signature.predicates, functions }
}

export const formulaOf = (question: BelongQuestion): FoFormula =>
  parseFormula(question.source, signatureWithNames(worldOf(question)))

/** The outermost quantifier, which is what the rows range over. */
export function outermost(question: BelongQuestion): {
  quantifier: 'forall' | 'exists'
  variable: string
  body: FoFormula
} {
  const formula = formulaOf(question)
  if (formula.kind !== 'quantified') {
    throw new Error(`${question.source} does not start with a quantifier`)
  }
  return { quantifier: formula.quantifier, variable: formula.variable, body: formula.body }
}

/** Truth of the body at each element, in universe order. */
export function rowsOf(question: BelongQuestion): boolean[] {
  const world = worldOf(question)
  const { variable, body } = outermost(question)
  return world.labels.map((_, element) =>
    evaluateFormula(world.structure, { [variable]: element }, body),
  )
}

export const belongs = (question: BelongQuestion): boolean =>
  holdsIn(worldOf(question).structure, formulaOf(question))

/** What the rows add up to, which is the membership answer. */
export const verdictFrom = (
  quantifier: 'forall' | 'exists',
  rows: readonly (boolean | null)[],
): boolean =>
  quantifier === 'forall' ? rows.every((row) => row === true) : rows.some((row) => row === true)

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function generate({ rng, difficulty }: GenerateContext): BelongQuestion {
  for (let attempt = 0; attempt < 30; attempt++) {
    const world = rng.pick([...WORLDS])
    const source = rng.pick(world.formulas[difficulty])
    const question = { world: world.name, source }
    try {
      // Generation must never deal a question the evaluator cannot answer.
      rowsOf(question)
    } catch {
      continue
    }
    return question
  }
  return { world: SWAP.name, source: '∃x:p(x)' }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: BelongQuestion): BelongAnswer => ({ rows: rowsOf(question) })

function check(question: BelongQuestion, answer: BelongAnswer): Verdict {
  const wanted = rowsOf(question)
  const wrong = wanted.filter((row, index) => answer.rows[index] !== row).length
  const world = worldOf(question)
  const { quantifier, variable } = outermost(question)

  if (wrong === 0) {
    const holds = belongs(question)
    return {
      correct: true,
      message: holds ? 'It belongs to the theory' : 'It does not belong',
      detail: `${quantifier === 'forall' ? 'Every' : 'Some'} value of ${variable} had to work, and ${
        quantifier === 'forall'
          ? holds
            ? 'every one did'
            : `${variable}=${world.labels[wanted.indexOf(false)]} does not`
          : holds
            ? `${variable}=${world.labels[wanted.indexOf(true)]} does`
            : 'none did'
      }.`,
    }
  }

  return {
    correct: false,
    // A count, never which row: with two or three rows, naming one is the
    // answer.
    message: `${wrong} of the ${wanted.length} rows is not right`,
    score: (wanted.length - wrong) / wanted.length,
    detail: `Substitute the element for ${variable} and evaluate the body against the tables. Then ${
      quantifier === 'forall' ? 'all' : 'at least one'
    } of the rows has to be true for the formula to hold.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Tables({ world }: { world: World }) {
  const { structure, labels } = world
  return (
    <div className="flex flex-wrap gap-3">
      {Object.entries(structure.functions).map(([name, table]) => (
        <div key={name} className="tile bg-card-shade px-3 py-2">
          <p className="font-logic text-xs font-bold">{name}</p>
          <div className="mt-1 flex flex-col gap-0.5 text-sm font-bold">
            {labels.map((label, element) => (
              <span key={label} className="font-logic">
                {name}({label}) = {elementLabel(structure, table[element] as number)}
              </span>
            ))}
          </div>
        </div>
      ))}
      {Object.entries(structure.predicates).map(([name, table]) => {
        const arity = Math.round(Math.log(table.length) / Math.log(structure.size))
        return (
          <div key={name} className="tile bg-card-shade px-3 py-2">
            <p className="font-logic text-xs font-bold">{name}</p>
            {arity === 1 ? (
              <div className="mt-1 flex flex-col gap-0.5 text-sm font-bold">
                {labels.map((label, element) => (
                  <span key={label} className="flex items-center gap-1.5 font-logic">
                    {name}({label}) <SpaceToken value={table[element] === true} />
                  </span>
                ))}
              </div>
            ) : (
              <table className="mt-1 text-center text-xs font-bold">
                <tbody>
                  <tr>
                    <td />
                    {labels.map((label) => (
                      <td key={label} className="px-1 font-logic">
                        {label}
                      </td>
                    ))}
                  </tr>
                  {labels.map((row, x) => (
                    <tr key={row}>
                      <td className="pr-1 font-logic">{row}</td>
                      {labels.map((column, y) => (
                        <td key={column} className="px-1">
                          <SpaceToken value={table[x * structure.size + y] === true} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Screen({ question, submit, locked }: MinigameScreenProps<BelongQuestion, BelongAnswer>) {
  const world = worldOf(question)
  const { quantifier, variable, body } = useMemo(() => outermost(question), [question])
  const wanted = useMemo(() => rowsOf(question), [question])
  const [rows, setRows] = useState<(boolean | null)[]>(world.labels.map(() => null))

  useEffect(() => setRows(world.labels.map(() => null)), [question, world.labels])

  const shown = locked ? wanted : rows
  const ready = rows.every((row) => row !== null)
  const verdict = verdictFrom(quantifier, shown)

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Does it belong to the theory?
      </p>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        T is every closed formula true in this interpretation — {world.blurb}
      </p>

      <div className="mt-2">
        <Tables world={world} />
      </div>

      <div className="mt-3 tile bg-card-shade px-3 py-2 text-center">
        <FoText text={question.source} className="text-lg font-bold" />
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
        Evaluate the body at each value of {variable}
      </p>
      <div className="mt-1 flex flex-col gap-1">
        {world.labels.map((label, element) => (
          <div key={label} className="tile flex items-center gap-2 bg-card px-3 py-1.5">
            <span className="font-logic text-sm font-bold">
              {variable} = {label}
            </span>
            <span className="min-w-0 flex-1 overflow-x-auto">
              <FoText text={showFormula(body)} className="text-sm font-bold" />
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={locked}
                onClick={() =>
                  setRows((previous) => previous.map((row, index) => (index === element ? true : row)))
                }
                className={`chunky h-8 px-2 text-xs font-black ${
                  shown[element] === true ? 'bg-space-blue text-white' : 'bg-card-shade'
                }`}
              >
                true
              </button>
              <button
                type="button"
                disabled={locked}
                onClick={() =>
                  setRows((previous) =>
                    previous.map((row, index) => (index === element ? false : row)),
                  )
                }
                className={`chunky h-8 px-2 text-xs font-black ${
                  shown[element] === false ? 'bg-space-red text-white' : 'bg-card-shade'
                }`}
              >
                false
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-2 rounded-2xl bg-card-shade px-3 py-2 text-center text-sm font-bold">
        {quantifier === 'forall' ? 'Every row must be true' : 'One true row is enough'} — so as it
        stands, the formula is {verdict ? 'in T' : 'not in T'}.
      </p>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium text-ink-soft">
          The theory of a structure is complete: for every closed formula it contains that formula
          or its negation, because the structure decides each one.
        </Pop>
      )}

      {!locked && (
        <Button
          variant="coin"
          className="mt-3 w-full"
          disabled={!ready}
          onClick={() => submit({ rows })}
        >
          {ready ? 'Submit' : 'Judge every row first'}
        </Button>
      )}
    </Card>
  )
}

export const doesItBelongGame = defineMinigame<BelongQuestion, BelongAnswer>({
  id: 'theory-membership',
  title: 'Does It Belong?',
  tagline: 'Evaluate the body at every element, then let the quantifier decide.',
  topics: ['theories', 'fo-syntax'],
  icon: '🔍',
  roundSeconds: 150,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  questionKey: (question) => `${question.world}:${question.source}`,
  explain: (question) => {
    const world = worldOf(question)
    const { quantifier, variable } = outermost(question)
    const rows = rowsOf(question)
    const shown = world.labels.map((label, index) => `${variable}=${label}: ${rows[index]}`).join(', ')
    const needed =
      quantifier === 'forall'
        ? belongs(question)
          ? 'every row is true'
          : 'not every row is true'
        : belongs(question)
          ? 'one row is true'
          : 'no row is true'
    return `${shown} — ${needed}, so the formula is ${belongs(question) ? '' : 'not '}in the theory.`
  },
  Screen,
  Guide: DoesItBelongGuide,
})
