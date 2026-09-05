/**
 * Solution sets in the plane — ln.pdf §5.3, Exercise 12 question 2.
 *
 * A formula with two free variables carves out a region of ℝ². The exercise
 * shows ten shaded pictures and asks which one belongs to
 * `x²≤y → y≤x`, and the reason it is hard is that an implication's solution
 * set is mostly *everything*: every point where the premise fails is in it.
 *
 * The picture is drawn by evaluating the formula on a grid, so the shading is
 * the formula rather than an illustration of it. And a probe is provided:
 * clicking anywhere says whether that point satisfies the formula. Probing is
 * the method the exercise wants — pick a point where the premise holds and one
 * where it does not — so it is free and unlimited.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  evaluateReal,
  rand,
  rle,
  rlt,
  rimplies,
  rnot,
  rnum,
  ror,
  rsquare,
  rtimes,
  rx,
  rplus,
  showReal,
  type RealFormula,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { Pop } from '@/ui/motion'
import { PickThePictureGuide } from './pickThePicture.guide'

export interface PictureQuestion {
  /** Region ids: the first is the formula shown, all four are the options. */
  formula: string
  options: string[]
}

/** Which option was picked. */
export type PictureAnswer = number

// ---------------------------------------------------------------------------
// The regions
// ---------------------------------------------------------------------------

const X = rx('x')
const Y = rx('y')

interface Region {
  id: string
  formula: RealFormula
  difficulty: Difficulty[]
}

export const REGIONS: readonly Region[] = [
  { id: 'x2-le-y', formula: rle(rsquare(X), Y), difficulty: ['easy', 'medium'] },
  { id: 'y-le-x', formula: rle(Y, X), difficulty: ['easy'] },
  { id: 'x-le-y', formula: rle(X, Y), difficulty: ['easy'] },
  {
    id: 'implication',
    formula: rimplies(rle(rsquare(X), Y), rle(Y, X)),
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'conjunction',
    formula: rand(rle(rsquare(X), Y), rle(Y, X)),
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'disc',
    formula: rle(rplus(rsquare(X), rsquare(Y)), rnum(1)),
    difficulty: ['easy', 'medium'],
  },
  { id: 'hyperbola', formula: rle(rtimes(X, Y), rnum(1)), difficulty: ['medium', 'hard'] },
  { id: 'not-x2-le-y', formula: rnot(rle(rsquare(X), Y)), difficulty: ['medium'] },
  {
    id: 'union',
    formula: ror(rle(rsquare(X), Y), rle(Y, X)),
    difficulty: ['hard'],
  },
  { id: 'strip', formula: rand(rlt(rnum(-1), X), rlt(X, rnum(1))), difficulty: ['easy'] },
  {
    id: 'above-both',
    formula: rand(rle(rsquare(X), Y), rle(rnum(0), X)),
    difficulty: ['hard'],
  },
]

export const regionOf = (id: string): Region =>
  REGIONS.find((region) => region.id === id) ?? (REGIONS[0] as Region)

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** Grid resolution and the window on the plane. */
export const GRID = 33
export const SPAN = 2.5

export const cellCentre = (index: number): number =>
  -SPAN + ((index + 0.5) * (2 * SPAN)) / GRID

/** Which grid cells the region covers, row-major from the top. */
export function shading(formula: RealFormula): boolean[] {
  const cells: boolean[] = []
  for (let row = 0; row < GRID; row++) {
    const y = -cellCentre(row)
    for (let column = 0; column < GRID; column++) {
      cells.push(evaluateReal(formula, { x: cellCentre(column), y }))
    }
  }
  return cells
}

/** Two regions the grid cannot tell apart would make the question unfair. */
export const sameShading = (left: RealFormula, right: RealFormula): boolean =>
  shading(left).join('') === shading(right).join('')

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function generate({ rng, difficulty }: GenerateContext): PictureQuestion {
  const pool = REGIONS.filter((region) => region.difficulty.includes(difficulty))
  const usable = pool.length >= 4 ? pool : REGIONS

  for (let attempt = 0; attempt < 30; attempt++) {
    const chosen = rng.sample(usable, 4)
    const target = rng.pick(chosen)
    // Every option has to look different, or two answers would be right.
    let clash = false
    for (let i = 0; i < chosen.length && !clash; i++) {
      for (let j = i + 1; j < chosen.length; j++) {
        if (sameShading((chosen[i] as Region).formula, (chosen[j] as Region).formula)) clash = true
      }
    }
    if (clash) continue
    return { formula: target.id, options: chosen.map((region) => region.id) }
  }

  const fallback = ['x2-le-y', 'y-le-x', 'disc', 'strip']
  return { formula: 'x2-le-y', options: fallback }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: PictureQuestion): PictureAnswer =>
  question.options.indexOf(question.formula)

function check(question: PictureQuestion, answer: PictureAnswer): Verdict {
  const wanted = solve(question)
  if (answer === wanted) {
    return {
      correct: true,
      message: 'That is the region',
      detail:
        'Shading is decided point by point: a point is in the set exactly when substituting its coordinates makes the formula true.',
    }
  }

  // A point telling the two apart — the probe the player should have made.
  const target = regionOf(question.formula).formula
  const chosen = regionOf(question.options[answer] as string).formula
  let split: { x: number; y: number } | null = null
  for (let row = 0; row < GRID && split === null; row++) {
    for (let column = 0; column < GRID; column++) {
      const point = { x: cellCentre(column), y: -cellCentre(row) }
      if (evaluateReal(target, point) !== evaluateReal(chosen, point)) {
        split = point
        break
      }
    }
  }

  return {
    correct: false,
    // Says where to probe, never which picture.
    message: 'Not that one',
    score: 0,
    detail:
      split === null
        ? 'Probe a point where the premise of the formula fails, and one where it holds.'
        : `Probe (${split.x.toFixed(2)}, ${split.y.toFixed(2)}) — the formula and the picture you chose disagree there.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Plot({
  formula,
  probes,
  onProbe,
  size = 132,
}: {
  formula: RealFormula
  probes?: { x: number; y: number; value: boolean }[]
  onProbe?: (point: { x: number; y: number }) => void
  size?: number
}) {
  const cells = useMemo(() => shading(formula), [formula])
  const step = size / GRID

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={`rounded-xl bg-card ${onProbe === undefined ? '' : 'cursor-crosshair'}`}
      onClick={
        onProbe === undefined
          ? undefined
          : (event) => {
              const box = (event.target as SVGElement).ownerSVGElement?.getBoundingClientRect()
              const bounds = box ?? (event.currentTarget as SVGSVGElement).getBoundingClientRect()
              const fx = (event.clientX - bounds.left) / bounds.width
              const fy = (event.clientY - bounds.top) / bounds.height
              onProbe({ x: -SPAN + fx * 2 * SPAN, y: SPAN - fy * 2 * SPAN })
            }
      }
    >
      {cells.map((inside, index) =>
        inside ? (
          <rect
            key={index}
            x={(index % GRID) * step}
            y={Math.floor(index / GRID) * step}
            width={step + 0.4}
            height={step + 0.4}
            className="fill-space-blue/45"
          />
        ) : null,
      )}
      <line x1={0} y1={size / 2} x2={size} y2={size / 2} className="stroke-ink/35" strokeWidth={1} />
      <line x1={size / 2} y1={0} x2={size / 2} y2={size} className="stroke-ink/35" strokeWidth={1} />
      {(probes ?? []).map((probe, index) => (
        <circle
          key={index}
          cx={((probe.x + SPAN) / (2 * SPAN)) * size}
          cy={((SPAN - probe.y) / (2 * SPAN)) * size}
          r={3.5}
          className={probe.value ? 'fill-grass stroke-white' : 'fill-space-red stroke-white'}
          strokeWidth={1.2}
        />
      ))}
    </svg>
  )
}

function Screen({ question, submit, locked }: MinigameScreenProps<PictureQuestion, PictureAnswer>) {
  const formula = regionOf(question.formula).formula
  const wanted = useMemo(() => solve(question), [question])
  const [probes, setProbes] = useState<{ x: number; y: number; value: boolean }[]>([])
  const [picked, setPicked] = useState<number | null>(null)

  useEffect(() => {
    setProbes([])
    setPicked(null)
  }, [question])

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Which picture is the solution set?
      </p>

      <div className="mt-2 overflow-x-auto rounded-2xl bg-card-shade px-3 py-2 text-center">
        <span className="font-logic text-lg font-bold">{showReal(formula)}</span>
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
        Probe — tap the plane to test a point, as often as you like
      </p>
      <div className="mt-1 flex items-start gap-3">
        <Plot
          formula={{ kind: 'atom', relation: 'lt', left: rnum(1), right: rnum(0) }}
          probes={probes}
          onProbe={(point) =>
            setProbes((previous) => [
              ...previous.slice(-11),
              { ...point, value: evaluateReal(formula, point) },
            ])
          }
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink-soft">
            Blue dots are points the formula makes true, red ones false. The window runs from −
            {SPAN} to {SPAN} on both axes.
          </p>
          <div className="mt-1 flex flex-col gap-0.5">
            {probes.slice(-4).map((probe, index) => (
              <span key={index} className="font-logic text-xs font-bold">
                ({probe.x.toFixed(2)}, {probe.y.toFixed(2)}) → {String(probe.value)}
              </span>
            ))}
          </div>
          {probes.length > 0 && (
            <Button
              variant="ghost"
              className="mt-1 !min-h-8 !px-3 !text-xs"
              onClick={() => setProbes([])}
            >
              Clear the probes
            </Button>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">The candidates</p>
      <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {question.options.map((id, index) => (
          <button
            key={id}
            type="button"
            disabled={locked}
            onClick={() => setPicked(index)}
            className={`tile flex flex-col items-center gap-1 p-1.5 ${
              locked
                ? index === wanted
                  ? 'bg-grass/40'
                  : index === picked
                    ? 'bg-space-red/25'
                    : 'bg-card-shade'
                : picked === index
                  ? 'bg-coin'
                  : 'bg-card-shade'
            }`}
          >
            <Plot formula={regionOf(id).formula} size={108} />
            <span className="text-xs font-black">{index + 1}</span>
          </button>
        ))}
      </div>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium text-ink-soft">
          Picture {wanted + 1}. An implication shades everything where its premise fails, which is
          why its solution set is usually far larger than it looks like it should be.
        </Pop>
      )}

      {!locked && (
        <Button
          variant="coin"
          className="mt-3 w-full"
          disabled={picked === null}
          onClick={() => submit(picked as number)}
        >
          {picked === null ? 'Pick one' : `Submit picture ${picked + 1}`}
        </Button>
      )}
    </Card>
  )
}

export const pickThePictureGame = defineMinigame<PictureQuestion, PictureAnswer>({
  id: 'solution-set',
  title: 'Pick The Picture',
  tagline: 'Probe the plane, then choose the region the formula actually carves out.',
  topics: ['arithmetic-theories'],
  icon: '🖼️',
  roundSeconds: 150,
  sprintQuestions: 6,
  // Four pictures is two guesses away from the truth, and probing is free —
  // so guessing has to cost more than probing.
  sprintPenaltySeconds: 10,
  generate,
  check,
  solve,
  questionKey: (question) => `${question.formula}|${question.options.join(',')}`,
  explain: (question) =>
    `${showReal(regionOf(question.formula).formula)} holds at a point exactly when substituting its coordinates makes the formula true — picture ${solve(question) + 1}.`,
  Screen,
  Guide: PickThePictureGuide,
})
