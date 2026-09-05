/**
 * Encoding a problem into CNF — Exercise 1 Q4.
 *
 * The exercise where propositional logic stops being about p and q. Rather
 * than asking you to write the encoding out, this hands you the graph and lets
 * you *play* the constraints: tap a vertex to change its colour, and the
 * clauses that are currently violated light up on the edges.
 *
 * The encoding is on screen the whole time, with a live count of how many of
 * its clauses are satisfied — so the connection between "these two vertices
 * clash" and "(¬a1 ∨ ¬b1) is false" is something you watch happen rather than
 * something you are told.
 *
 * Some graphs cannot be coloured at all, and saying so is a legitimate answer:
 * that is precisely the case where the CNF is unsatisfiable.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  colouringClauses,
  conflictingEdges,
  findOddCycle,
  isColourable,
  type Graph,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { Pop, ProgressBar, useShake, Shakeable } from '@/ui/motion'
import { ColouringGuide } from './colouring.guide'

export interface ColouringQuestion {
  graph: Graph
  colours: number
  /** Whether a proper colouring exists at all. */
  colourable: boolean
}

export type ColouringAnswer =
  | { kind: 'colouring'; assignment: Record<string, number> }
  | { kind: 'impossible' }

export const PALETTE = ['#e62310', '#009bd9', '#44af35', '#fccf00'] as const
export const PALETTE_NAMES = ['red', 'blue', 'green', 'gold'] as const

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  vertices: [min: number, max: number]
  extraEdges: [min: number, max: number]
  /** Most colours the palette can show. */
  maxColours: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { vertices: [4, 4], extraEdges: [1, 2], maxColours: 3 },
  medium: { vertices: [5, 6], extraEdges: [2, 3], maxColours: 4 },
  hard: { vertices: [6, 7], extraEdges: [3, 5], maxColours: 4 },
}

/** Fewest colours this graph can be done in. */
function chromaticNumber(graph: Graph, limit: number): number {
  for (let colours = 1; colours <= limit; colours++) {
    if (isColourable(graph, colours)) return colours
  }
  return limit + 1
}

const NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const
const ATTEMPTS = 300

function generate({ rng, difficulty }: GenerateContext): ColouringQuestion {
  const profile = PROFILES[difficulty]

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const count = rng.range(...profile.vertices)
    const vertices = NAMES.slice(0, count) as unknown as string[]

    // Start from a cycle so the graph is always connected — a puzzle in two
    // pieces is two easier puzzles rather than one.
    const edges: [string, string][] = vertices.map((vertex, index) => [
      vertex,
      vertices[(index + 1) % count] as string,
    ])

    const extra = rng.range(...profile.extraEdges)
    for (let index = 0; index < extra; index++) {
      const [left, right] = rng.sample(vertices, 2)
      if (left === undefined || right === undefined) continue
      if (edges.some(([a, b]) => (a === left && b === right) || (a === right && b === left))) continue
      edges.push([left, right])
    }

    const graph: Graph = { vertices, edges }

    // Choose the palette against the graph rather than fixing it in the
    // profile. A five-vertex graph with a couple of extra edges is almost
    // always three-colourable, so a fixed three-colour palette would make
    // "Impossible" an answer that is never right — and a button that is never
    // right is worse than no button.
    const chromatic = chromaticNumber(graph, profile.maxColours)
    if (chromatic > profile.maxColours) continue

    const tight = rng.bool(0.25) && chromatic > 2
    const colours = tight ? chromatic - 1 : chromatic
    if (colours < 2 || colours > PALETTE.length) continue

    return { graph, colours, colourable: !tight }
  }

  // Last resort, so a round can never stall: the exercise's own graph.
  const graph: Graph = {
    vertices: ['a', 'b', 'c', 'd'],
    edges: [
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
      ['d', 'a'],
      ['a', 'c'],
    ],
  }
  return { graph, colours: 2, colourable: isColourable(graph, 2) }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

function solve(question: ColouringQuestion): ColouringAnswer {
  if (!question.colourable) return { kind: 'impossible' }

  const assignment = new Map<string, number>()
  const search = (index: number): boolean => {
    const vertex = question.graph.vertices[index]
    if (vertex === undefined) return true
    for (let colour = 0; colour < question.colours; colour++) {
      const clash = question.graph.edges.some(
        ([left, right]) =>
          (left === vertex && assignment.get(right) === colour) ||
          (right === vertex && assignment.get(left) === colour),
      )
      if (clash) continue
      assignment.set(vertex, colour)
      if (search(index + 1)) return true
      assignment.delete(vertex)
    }
    return false
  }
  search(0)

  return { kind: 'colouring', assignment: Object.fromEntries(assignment) }
}

function check(question: ColouringQuestion, answer: ColouringAnswer): Verdict {
  const encoding = colouringClauses(question.graph, question.colours)

  if (answer.kind === 'impossible') {
    if (question.colourable) {
      return {
        correct: false,
        message: 'It can be coloured',
        detail: `There is a proper colouring, so the ${encoding.all.length}-clause CNF is satisfiable. Keep going.`,
      }
    }
    const cycle = findOddCycle(question.graph)
    return {
      correct: true,
      message: 'Correct — no colouring exists',
      detail:
        cycle === null
          ? `The encoding is unsatisfiable, so the graph cannot be coloured with ${question.colours}.`
          : `${cycle.join('–')}–${cycle[0]} is a cycle of odd length ${cycle.length}, and an odd cycle can never be two-coloured. The ${encoding.all.length}-clause CNF is unsatisfiable.`,
    }
  }

  const assignment = new Map(Object.entries(answer.assignment))
  const missing = question.graph.vertices.filter((vertex) => !assignment.has(vertex))
  if (missing.length > 0) {
    return { correct: false, message: `${missing.length} vertices still uncoloured` }
  }

  const clashes = conflictingEdges(question.graph, assignment)
  if (clashes.length > 0) {
    return {
      correct: false,
      message: `${clashes.length} edge${clashes.length === 1 ? '' : 's'} still clash`,
      detail: `${clashes.map(([a, b]) => `${a}–${b}`).join(', ')} — each of those falsifies one of the ${encoding.edgeClauses.length} edge clauses.`,
    }
  }

  return {
    correct: true,
    message: 'Every clause satisfied',
    detail: `All ${encoding.all.length} clauses hold: ${encoding.atLeastOne.length} saying each vertex has a colour, ${encoding.atMostOne.length} saying it has only one, and ${encoding.edgeClauses.length} saying no edge shares one.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/** Vertices on a circle: readable at any size, and no layout to get wrong. */
function positions(graph: Graph, size: number): Map<string, { x: number; y: number }> {
  const radius = size / 2 - 26
  const centre = size / 2
  return new Map(
    graph.vertices.map((vertex, index) => {
      const angle = (index / graph.vertices.length) * Math.PI * 2 - Math.PI / 2
      return [vertex, { x: centre + radius * Math.cos(angle), y: centre + radius * Math.sin(angle) }]
    }),
  )
}

function Screen({ question, submit, locked, solution }: MinigameScreenProps<ColouringQuestion, ColouringAnswer>) {
  const [assignment, setAssignment] = useState<Map<string, number>>(new Map())
  const [shaking, shake] = useShake()
  const board = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setAssignment(new Map())
  }, [question])

  const size = 260
  const place = useMemo(() => positions(question.graph, size), [question])
  const encoding = useMemo(
    () => colouringClauses(question.graph, question.colours),
    [question],
  )

  const shown = locked && solution?.kind === 'colouring'
    ? new Map(Object.entries(solution.assignment))
    : assignment

  const clashes = conflictingEdges(question.graph, shown)
  const clashing = new Set(clashes.map(([a, b]) => `${a}|${b}`))
  const coloured = question.graph.vertices.filter((vertex) => shown.has(vertex)).length
  const satisfied = encoding.all.filter((clause) =>
    clause.some((literal) => {
      const [vertex, colour] = [literal.name.slice(0, -1), Number(literal.name.slice(-1)) - 1]
      const value = shown.get(vertex)
      if (value === undefined) return false
      return (value === colour) === !literal.negated
    }),
  ).length

  const cycle = (vertex: string) => {
    if (locked) return
    setAssignment((previous) => {
      const next = new Map(previous)
      const current = previous.get(vertex)
      const value = current === undefined ? 0 : current + 1
      if (value >= question.colours) next.delete(vertex)
      else next.set(vertex, value)
      return next
    })
  }

  const done = coloured === question.graph.vertices.length && clashes.length === 0

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Colour the graph
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {question.colours} colours · {question.graph.edges.length} edges
        </p>
      </div>

      <p className="mt-1 text-xs font-medium text-ink-soft">
        Tap a vertex to change its colour. No edge may join two of the same.
      </p>

      <Shakeable shaking={shaking}>
        <div ref={board} className="mt-2 flex justify-center">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Graph to colour">
            {question.graph.edges.map(([left, right], index) => {
              const a = place.get(left)
              const b = place.get(right)
              if (a === undefined || b === undefined) return null
              const bad = clashing.has(`${left}|${right}`)
              return (
                <motion.line
                  key={index}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={bad ? 'var(--color-space-red)' : 'var(--color-ink)'}
                  strokeWidth={bad ? 5 : 2.5}
                  strokeLinecap="round"
                  animate={bad ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
                  transition={bad ? { duration: 0.9, repeat: Infinity } : { duration: 0.2 }}
                />
              )
            })}

            {question.graph.vertices.map((vertex) => {
              const at = place.get(vertex)
              if (at === undefined) return null
              const colour = shown.get(vertex)
              return (
                <motion.g
                  key={vertex}
                  onClick={() => cycle(vertex)}
                  className={locked ? '' : 'cursor-pointer'}
                  whileTap={locked ? undefined : { scale: 0.88 }}
                  style={{ originX: `${at.x}px`, originY: `${at.y}px` }}
                >
                  <motion.circle
                    cx={at.x}
                    cy={at.y}
                    r={20}
                    fill={colour === undefined ? 'var(--color-card)' : PALETTE[colour]}
                    stroke="var(--color-ink)"
                    strokeWidth={3}
                    strokeDasharray={colour === undefined ? '4 3' : undefined}
                    animate={{ scale: 1 }}
                    initial={false}
                  />
                  <text
                    x={at.x}
                    y={at.y + 5}
                    textAnchor="middle"
                    fontSize={15}
                    fontWeight={700}
                    fill={colour === undefined ? 'var(--color-ink-soft)' : '#ffffff'}
                    pointerEvents="none"
                  >
                    {vertex}
                  </text>
                </motion.g>
              )
            })}
          </svg>
        </div>
      </Shakeable>

      <div className="mt-2">
        <ProgressBar value={satisfied} total={encoding.all.length} />
        <p className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 text-xs font-semibold text-ink-soft">
          <span>
            {satisfied} of {encoding.all.length} clauses satisfied
          </span>
          <span>
            {coloured}/{question.graph.vertices.length} coloured
            {clashes.length > 0 && ` · ${clashes.length} clashing`}
          </span>
        </p>
      </div>

      {!locked && (
        <div className="mt-3 flex gap-2">
          <Button
            variant="coin"
            className="flex-1"
            onClick={() => {
              if (!done) {
                shake()
                return
              }
              submit({ kind: 'colouring', assignment: Object.fromEntries(assignment) })
            }}
          >
            {done ? 'Done' : coloured < question.graph.vertices.length ? 'Colour them all' : 'Fix the clashes'}
          </Button>
          <Button variant="secondary" onClick={() => submit({ kind: 'impossible' })}>
            Impossible
          </Button>
        </div>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">The encoding</p>
          <p className="mt-1">
            <strong>{encoding.atLeastOne.length}</strong> clauses saying each vertex gets a colour,{' '}
            <strong>{encoding.atMostOne.length}</strong> saying it gets only one, and{' '}
            <strong>{encoding.edgeClauses.length}</strong> saying no edge shares one — one per edge
            per colour.
          </p>
        </Pop>
      )}
    </Card>
  )
}

export const colouringGame = defineMinigame<ColouringQuestion, ColouringAnswer>({
  id: 'colouring',
  title: 'Colour It',
  tagline: 'Solve the graph, watch the clauses.',
  topics: ['satisfiability'],
  icon: '🎨',
  roundSeconds: 210,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: ColouringGuide,
  questionKey: (question) =>
    `${question.colours}|${question.graph.edges.map(([a, b]) => `${a}${b}`).sort().join(',')}`,
})
