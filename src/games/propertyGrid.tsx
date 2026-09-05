/**
 * Quantifier elimination against decidability — ln.pdf §5.2, Definition 5.4,
 * and the true/false lines on exam26a and exam26bA.
 *
 * The two properties get confused because one implies the other in every
 * example the course meets: a theory admitting QE whose quantifier-free
 * fragment can be evaluated is decidable. The implication does not run the
 * other way, and Presburger arithmetic is the standing counterexample —
 * decidable by automata, with no elimination available in its own signature.
 *
 * A true/false list lets that be answered one row at a time. A grid does not:
 * the same theories appear under both properties, so a row where the two
 * columns differ has to be recognised as such.
 */

import { useEffect, useMemo, useState } from 'react'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { Pop } from '@/ui/motion'
import { PropertyGridGuide } from './propertyGrid.guide'

export interface GridQuestion {
  /** Theory ids, in the order the rows appear. */
  rows: string[]
}

/** One entry per row per column, null while untouched. */
export type GridAnswer = (boolean | null)[][]

export const COLUMNS = ['qe', 'decidable'] as const
export type Column = (typeof COLUMNS)[number]

export const COLUMN_LABELS: Readonly<Record<Column, string>> = {
  qe: 'admits QE',
  decidable: 'decidable',
}

export interface TheoryRow {
  id: string
  name: string
  qe: boolean
  decidable: boolean
  why: string
  difficulty: Difficulty[]
}

/**
 * The chapter's theories.
 *
 * Every verdict is one the notes state. The interesting rows are the ones
 * where the two columns disagree — Presburger arithmetic, and the theory of a
 * single infinite structure — because those are what the grid exists to catch.
 */
export const THEORY_ROWS: readonly TheoryRow[] = [
  {
    id: 'reals',
    name: 'T(ℝ,=,+,*)',
    qe: true,
    decidable: true,
    why: "Tarski: quantifier elimination over polynomial comparisons, and so decidable — doubly exponentially.",
    difficulty: ['easy', 'medium', 'hard'],
  },
  {
    id: 'dlo',
    name: 'Unbounded dense linear orders',
    qe: true,
    decidable: true,
    why: 'Theorem 5.6. Density and unboundedness eliminate an ∃, and what is left is evaluated directly.',
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'presburger',
    name: 'T(ℕ,=,+)',
    qe: false,
    decidable: true,
    why: 'Decidable by automata. It admits no elimination in this signature — divisibility by constants has to be added first. The row that separates the two columns.',
    difficulty: ['easy', 'medium', 'hard'],
  },
  {
    id: 'nat-times',
    name: 'T(ℕ,=,+,*)',
    qe: false,
    decidable: false,
    why: 'Undecidable, so no elimination either — an elimination would decide it.',
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'integers',
    name: 'T(ℤ,=,+,*)',
    qe: false,
    decidable: false,
    why: 'ℕ is definable inside ℤ, so deciding this would decide arithmetic.',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'finite',
    name: 'A theory over a finite universe',
    qe: true,
    decidable: true,
    why: '∀ expands to a conjunction and ∃ to a disjunction over the elements, so nothing quantified survives.',
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'inconsistent',
    name: 'An inconsistent theory',
    qe: true,
    decidable: true,
    why: 'It contains every formula, so ⊤ is a quantifier-free equivalent of anything, and membership is answered "yes" without looking.',
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'valid',
    name: 'The set of all valid first-order formulas',
    qe: false,
    decidable: false,
    why: 'Church and Turing — validity is semi-decidable only.',
    difficulty: ['hard'],
  },
]

export const rowOf = (id: string): TheoryRow =>
  THEORY_ROWS.find((row) => row.id === id) ?? (THEORY_ROWS[0] as TheoryRow)

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const HOW_MANY: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 4 }

function generate({ rng, difficulty }: GenerateContext): GridQuestion {
  const pool = THEORY_ROWS.filter((row) => row.difficulty.includes(difficulty))
  const usable = pool.length >= HOW_MANY[difficulty] ? pool : THEORY_ROWS

  for (let attempt = 0; attempt < 30; attempt++) {
    const chosen = rng.sample(usable, HOW_MANY[difficulty])
    // Without a row where the columns disagree, ticking one column twice wins.
    if (!chosen.some((row) => row.qe !== row.decidable)) continue
    // And without both answers in a column, that column is a constant.
    if (new Set(chosen.map((row) => row.qe)).size < 2) continue
    return { rows: chosen.map((row) => row.id) }
  }
  return { rows: ['reals', 'presburger', 'nat-times'] }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: GridQuestion): GridAnswer =>
  question.rows.map((id) => COLUMNS.map((column) => rowOf(id)[column]))

function check(question: GridQuestion, answer: GridAnswer): Verdict {
  const wanted = solve(question)
  let wrong = 0
  wanted.forEach((row, index) => {
    row.forEach((value, column) => {
      if (answer[index]?.[column] !== value) wrong += 1
    })
  })
  const total = wanted.length * COLUMNS.length

  if (wrong === 0) {
    return {
      correct: true,
      message: `All ${total} cells right`,
      detail:
        'Quantifier elimination gives decidability whenever the quantifier-free fragment can be evaluated. Decidability gives nothing back.',
    }
  }

  return {
    correct: false,
    // A count and nothing more: the grid is small, and naming a cell is
    // naming the answer.
    message: `${wrong} of ${total} cells wrong`,
    score: (total - wrong) / total,
    detail:
      'Ask the QE column first — it is the stronger property. Then ask whether anything else decides the theory: an automaton, an evaluation, or nothing.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Cell({
  value,
  wanted,
  locked,
  onChange,
  label,
}: {
  value: boolean | null
  wanted: boolean
  locked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  const shown = locked ? wanted : value
  const right = locked && value === wanted
  return (
    <div className="flex justify-center gap-1">
      {[true, false].map((option) => (
        <button
          key={String(option)}
          type="button"
          disabled={locked}
          onClick={() => onChange(option)}
          aria-label={`${label}: ${option ? 'yes' : 'no'}`}
          className={`chunky h-9 w-11 text-xs font-black ${
            shown === option
              ? locked
                ? right
                  ? 'bg-grass text-white'
                  : 'bg-space-red text-white'
                : option
                  ? 'bg-space-blue text-white'
                  : 'bg-space-red text-white'
              : 'bg-card-shade text-ink-soft'
          }`}
        >
          {option ? 'yes' : 'no'}
        </button>
      ))}
    </div>
  )
}

function Screen({ question, submit, locked }: MinigameScreenProps<GridQuestion, GridAnswer>) {
  const wanted = useMemo(() => solve(question), [question])
  const [answer, setAnswer] = useState<GridAnswer>([])

  useEffect(
    () => setAnswer(question.rows.map(() => COLUMNS.map(() => null))),
    [question],
  )

  const remaining = answer.flat().filter((value) => value === null).length

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Which theories have which property?
      </p>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Quantifier elimination is the stronger of the two. One of these rows has the columns
        disagreeing.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-2 py-1">theory</th>
              {COLUMNS.map((column) => (
                <th key={column} className="px-2 py-1 text-center">
                  {COLUMN_LABELS[column]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {question.rows.map((id, index) => (
              <tr key={id} className={index % 2 === 0 ? 'bg-card-shade/50' : ''}>
                <td className="px-2 py-1.5 font-logic font-bold">{rowOf(id).name}</td>
                {COLUMNS.map((column, columnIndex) => (
                  <td key={column} className="px-2 py-1.5">
                    <Cell
                      value={answer[index]?.[columnIndex] ?? null}
                      wanted={wanted[index]?.[columnIndex] as boolean}
                      locked={locked}
                      label={`${rowOf(id).name} ${COLUMN_LABELS[column]}`}
                      onChange={(value) =>
                        setAnswer((previous) =>
                          previous.map((row, at) =>
                            at === index
                              ? row.map((cell, position) => (position === columnIndex ? value : cell))
                              : row,
                          ),
                        )
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3">
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm font-medium text-ink-soft">
            {question.rows.map((id) => (
              <li key={id}>
                <strong className="text-ink">{rowOf(id).name}</strong> — {rowOf(id).why}
              </li>
            ))}
          </ul>
        </Pop>
      )}

      {!locked && (
        <Button
          variant="coin"
          className="mt-3 w-full"
          disabled={remaining > 0}
          onClick={() => submit(answer)}
        >
          {remaining > 0 ? `${remaining} cells still blank` : 'Submit'}
        </Button>
      )}
    </Card>
  )
}

export const propertyGridGame = defineMinigame<GridQuestion, GridAnswer>({
  id: 'qe-basics',
  title: 'The Property Grid',
  tagline: 'Tick which theories admit quantifier elimination, and which are decidable.',
  topics: ['quantifier-elimination'],
  icon: '🧾',
  roundSeconds: 150,
  sprintQuestions: 6,
  // Six or eight yes/no cells is a lot of guesses away from right, but a
  // wrong submission still has to cost more than reading the rows.
  sprintPenaltySeconds: 8,
  generate,
  check,
  solve,
  questionKey: (question) => [...question.rows].sort().join(','),
  explain: (question) => rowOf(question.rows[0] as string).why,
  Screen,
  Guide: PropertyGridGuide,
})
