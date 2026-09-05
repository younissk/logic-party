/**
 * Entailment and equivalence — Definitions 2.9–2.11, Exercise 1.
 *
 * Both notions are statements about *model sets*, so the game is a sorting
 * board rather than a question: every assignment is a token, and you drag each
 * one into the region it belongs to — satisfies only φ, both, only ψ, or
 * neither.
 *
 * Once the tokens are placed, the answer is the shape. Nothing in the left
 * region means every model of φ is a model of ψ, which is φ ⊨ ψ. Nothing in
 * either outer region means the model sets are equal, which is φ ≡ ψ. The
 * relationship is read off the board rather than recalled.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Assignment, Formula } from '@/logic'
import {
  allAssignments,
  entails,
  evaluate,
  format,
  isEquivalent,
  randomFormulaWhere,
  showAssignment,
  size,
  sortedVariables,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FormulaText } from '@/ui/FormulaText'
import { Draggable, Pop, ProgressBar, Shakeable, useShake } from '@/ui/motion'
import { ModelSortGuide } from './modelSort.guide'

/** Where an assignment belongs. The four regions of the Venn diagram. */
export type Region = 'left' | 'both' | 'right' | 'neither'

export const REGIONS: readonly Region[] = ['left', 'both', 'right', 'neither']

export interface ModelSortQuestion {
  left: Formula
  right: Formula
  variables: string[]
  rows: Assignment[]
}

/** Region per row, by index. Null while a token is still unplaced. */
export type ModelSortAnswer = (Region | null)[]

export function regionOf(question: ModelSortQuestion, row: Assignment): Region {
  const inLeft = evaluate(question.left, row)
  const inRight = evaluate(question.right, row)
  if (inLeft && inRight) return 'both'
  if (inLeft) return 'left'
  if (inRight) return 'right'
  return 'neither'
}

/** What the finished board says, in the course's vocabulary. */
export function relationship(question: ModelSortQuestion): string {
  const { left, right } = question
  if (isEquivalent(left, right)) return 'φ ≡ ψ — the model sets are equal'
  if (entails([left], right)) return 'φ ⊨ ψ — every model of φ is a model of ψ'
  if (entails([right], left)) return 'ψ ⊨ φ — every model of ψ is a model of φ'
  return 'Neither entails the other'
}

// ---------------------------------------------------------------------------

const PROFILES: Record<Difficulty, { variables: string[]; depth: number }> = {
  easy: { variables: ['p', 'q'], depth: 3 },
  medium: { variables: ['p', 'q'], depth: 4 },
  hard: { variables: ['p', 'q', 'r'], depth: 4 },
}

const ATTEMPTS = 200

function generate({ rng, difficulty }: GenerateContext): ModelSortQuestion {
  const profile = PROFILES[difficulty]

  const draw = () =>
    randomFormulaWhere(
      rng,
      {
        variables: profile.variables,
        depth: rng.range(2, profile.depth),
        connectives: ['not', 'and', 'or', 'implies', 'iff'],
        minDistinctVariables: 2,
      },
      (candidate) => size(candidate) <= 12,
    )

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    let left: Formula
    let right: Formula
    try {
      left = draw()
      right = rng.bool(0.35)
        ? // Often make one a consequence of the other, so entailment is not
          // always the boring "neither" answer.
          ({ kind: 'or', left, right: draw() } as Formula)
        : draw()
    } catch {
      continue
    }

    if (format(left) === format(right)) continue

    const variables = [...new Set([...sortedVariables(left), ...sortedVariables(right)])].sort()
    if (variables.length < 2 || variables.length > 3) continue

    const rows = allAssignments(variables)
    const question: ModelSortQuestion = { left, right, variables, rows }

    // A board where every token goes in one region teaches nothing about the
    // regions.
    const used = new Set(rows.map((row) => regionOf(question, row)))
    if (used.size < 2) continue

    return question
  }

  const fallback: Formula = { kind: 'var', name: 'p' }
  const other: Formula = { kind: 'or', left: fallback, right: { kind: 'var', name: 'q' } }
  const variables = ['p', 'q']
  return { left: fallback, right: other, variables, rows: allAssignments(variables) }
}

const solve = (question: ModelSortQuestion): ModelSortAnswer =>
  question.rows.map((row) => regionOf(question, row))

function check(question: ModelSortQuestion, answer: ModelSortAnswer): Verdict {
  const expected = solve(question)
  const wrong = expected
    .map((region, index) => ({ region, index }))
    .filter(({ region, index }) => answer[index] !== region)

  if (wrong.length === 0) {
    return {
      correct: true,
      message: relationship(question),
      detail: `Nothing in a region is what makes a claim: an empty "only φ" region is exactly φ ⊨ ψ, and both outer regions empty is φ ≡ ψ.`,
    }
  }

  const first = wrong[0] as { region: Region; index: number }
  return {
    correct: false,
    score: (expected.length - wrong.length) / expected.length,
    message: wrong.length === 1 ? 'One token is in the wrong region' : `${wrong.length} tokens misplaced`,
    detail: `With ${showAssignment(question.rows[first.index] as Assignment)}, ${format(
      question.left,
    )} is ${evaluate(question.left, question.rows[first.index] as Assignment) ? 'true' : 'false'} and ${format(
      question.right,
    )} is ${evaluate(question.right, question.rows[first.index] as Assignment) ? 'true' : 'false'}.`,
  }
}

// ---------------------------------------------------------------------------

const REGION_STYLE: Record<Region, string> = {
  left: 'bg-space-blue/20 border-space-blue',
  both: 'bg-plum/25 border-plum',
  right: 'bg-space-red/20 border-space-red',
  neither: 'bg-card-shade border-ink-soft',
}

function Screen({ question, submit, locked, solution }: MinigameScreenProps<ModelSortQuestion, ModelSortAnswer>) {
  const [placed, setPlaced] = useState<ModelSortAnswer>(() => question.rows.map(() => null))
  const [shaking, shake] = useShake()
  const zones = useRef(new Map<string, HTMLElement | null>())

  useEffect(() => {
    setPlaced(question.rows.map(() => null))
  }, [question])

  const labels: Record<Region, string> = useMemo(
    () => ({
      left: 'only φ',
      both: 'both',
      right: 'only ψ',
      neither: 'neither',
    }),
    [],
  )

  const remaining = placed.filter((region) => region === null).length
  const shownPlacement = locked ? (solution ?? placed) : placed

  const place = (index: number, region: string | null) => {
    if (locked) return
    if (region === null || !(REGIONS as readonly string[]).includes(region)) {
      shake()
      return
    }
    setPlaced((previous) => previous.map((entry, i) => (i === index ? (region as Region) : entry)))
  }

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Sort the assignments
      </p>

      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-space-blue/15 px-2 py-1.5">
          <p className="formula text-xs font-bold text-ink-soft">φ</p>
          <FormulaText formula={question.left} className="font-bold" />
        </div>
        <div className="rounded-xl bg-space-red/15 px-2 py-1.5">
          <p className="formula text-xs font-bold text-ink-soft">ψ</p>
          <FormulaText formula={question.right} className="font-bold" />
        </div>
      </div>

      <Shakeable shaking={shaking}>
        <div className="mt-3 flex min-h-16 flex-wrap items-center justify-center gap-2 rounded-2xl border-3 border-dashed border-ink-soft/50 p-2">
          {question.rows.map((row, index) =>
            shownPlacement[index] !== null ? null : (
              <Draggable
                key={index}
                zones={zones.current}
                disabled={locked}
                onDropped={(zone) => place(index, zone)}
              >
                <span className="chunky formula flex h-10 items-center bg-coin px-2.5 text-sm font-bold">
                  {question.variables.map((name) => `${name}=${row[name] ? 'T' : 'F'}`).join(' ')}
                </span>
              </Draggable>
            ),
          )}
          {remaining === 0 && !locked && (
            <p className="text-sm font-semibold text-ink-soft">All placed — check it.</p>
          )}
        </div>
      </Shakeable>

      <p className="mt-1 text-xs font-medium text-ink-soft">
        Drag each assignment into the region whose formulas it satisfies. Tap a placed token to send
        it back.
      </p>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {REGIONS.map((region) => {
          const inside = question.rows
            .map((row, index) => ({ row, index }))
            .filter(({ index }) => shownPlacement[index] === region)

          return (
            <div
              key={region}
              ref={(element) => {
                zones.current.set(region, element)
              }}
              className={`tile flex min-h-20 flex-col gap-1 border-3 p-2 ${REGION_STYLE[region]}`}
            >
              <p className="formula text-xs font-bold uppercase tracking-wider">{labels[region]}</p>
              <div className="flex flex-wrap gap-1">
                {inside.map(({ row, index }) => {
                  const right = locked && solution?.[index] === region
                  const wrong = locked && placed[index] === region && solution?.[index] !== region
                  return (
                    <Pop key={index}>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() =>
                          setPlaced((previous) => previous.map((entry, i) => (i === index ? null : entry)))
                        }
                        className={`formula rounded-md border-2 border-ink px-1.5 py-0.5 text-xs font-bold
                          ${wrong ? 'bg-space-red text-white' : right ? 'bg-grass text-white' : 'bg-white'}`}
                      >
                        {question.variables.map((name) => `${name}=${row[name] ? 'T' : 'F'}`).join(' ')}
                      </button>
                    </Pop>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-2">
        <ProgressBar value={question.rows.length - remaining} total={question.rows.length} />
      </div>

      {!locked && (
        <Button
          variant="coin"
          className="mt-3 w-full"
          disabled={remaining > 0}
          onClick={() => submit(placed)}
        >
          {remaining === 0 ? 'Read the board' : `${remaining} still to place`}
        </Button>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">What it says</p>
          <p className="formula mt-1 text-base font-bold">{relationship(question)}</p>
        </Pop>
      )}
    </Card>
  )
}

export const modelSortGame = defineMinigame<ModelSortQuestion, ModelSortAnswer>({
  id: 'model-sort',
  title: 'Venn Sort',
  tagline: 'Drag every assignment where it belongs.',
  topics: ['entailment', 'equivalence'],
  icon: '🧲',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: ModelSortGuide,
  questionKey: (question) => `${format(question.left)}|${format(question.right)}`,
})
