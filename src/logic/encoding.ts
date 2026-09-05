/**
 * Encoding a problem into CNF — Exercise 1 Q4, the graph colouring question.
 *
 * The exercise everyone remembers, because it is the first time propositional
 * logic stops being about p and q and starts being about something. Two
 * families of clause and that is the whole encoding:
 *
 *   at least one colour   (v_a1 ∨ v_a2 ∨ … ) for every vertex
 *   not two at once       (¬v_ai ∨ ¬v_aj)   for every vertex and pair of colours
 *   adjacent differ       (¬v_ai ∨ ¬v_bi)   for every edge and colour
 *
 * The third family is the interesting one: it says nothing about which colour,
 * only that the two ends cannot share one.
 */

import type { Clause, Literal } from './normal'
import { normaliseClause } from './resolution'

export interface Graph {
  vertices: string[]
  /** Undirected; each pair appears once. */
  edges: [string, string][]
}

/** The variable meaning "vertex has this colour". */
export const colourVariable = (vertex: string, colour: number): string => `${vertex}${colour + 1}`

export interface ColouringEncoding {
  /** One clause per vertex: it gets at least one colour. */
  atLeastOne: Clause[]
  /** One clause per vertex per pair of colours: never two at once. */
  atMostOne: Clause[]
  /** One clause per edge per colour: the ends do not share it. */
  edgeClauses: Clause[]
  all: Clause[]
}

export function colouringClauses(graph: Graph, colours: number): ColouringEncoding {
  const atLeastOne: Clause[] = []
  const atMostOne: Clause[] = []
  const edgeClauses: Clause[] = []

  for (const vertex of graph.vertices) {
    atLeastOne.push(
      normaliseClause(
        Array.from({ length: colours }, (_, colour) => ({
          name: colourVariable(vertex, colour),
          negated: false,
        })),
      ),
    )
    for (let a = 0; a < colours; a++) {
      for (let b = a + 1; b < colours; b++) {
        atMostOne.push(
          normaliseClause([
            { name: colourVariable(vertex, a), negated: true },
            { name: colourVariable(vertex, b), negated: true },
          ]),
        )
      }
    }
  }

  for (const [left, right] of graph.edges) {
    for (let colour = 0; colour < colours; colour++) {
      edgeClauses.push(
        normaliseClause([
          { name: colourVariable(left, colour), negated: true },
          { name: colourVariable(right, colour), negated: true },
        ]),
      )
    }
  }

  return { atLeastOne, atMostOne, edgeClauses, all: [...atLeastOne, ...atMostOne, ...edgeClauses] }
}

/** A colouring as the assignment the encoding talks about. */
export function colouringToLiterals(
  graph: Graph,
  colours: number,
  assignment: ReadonlyMap<string, number>,
): Literal[] {
  return graph.vertices.flatMap((vertex) =>
    Array.from({ length: colours }, (_, colour) => ({
      name: colourVariable(vertex, colour),
      negated: assignment.get(vertex) !== colour,
    })),
  )
}

/** Edges whose two ends currently share a colour. */
export function conflictingEdges(
  graph: Graph,
  assignment: ReadonlyMap<string, number>,
): [string, string][] {
  return graph.edges.filter(([left, right]) => {
    const a = assignment.get(left)
    const b = assignment.get(right)
    return a !== undefined && b !== undefined && a === b
  })
}

export const isProperColouring = (
  graph: Graph,
  assignment: ReadonlyMap<string, number>,
): boolean =>
  graph.vertices.every((vertex) => assignment.get(vertex) !== undefined) &&
  conflictingEdges(graph, assignment).length === 0

/**
 * Can this graph be coloured with this many colours?
 *
 * Brute force over colours^vertices. The graphs here are small by design —
 * the exam's is four vertices — and being exact matters more than being fast,
 * because a puzzle you cannot actually solve is worse than a slow one.
 */
export function isColourable(graph: Graph, colours: number): boolean {
  const assignment = new Map<string, number>()

  const search = (index: number): boolean => {
    const vertex = graph.vertices[index]
    if (vertex === undefined) return true
    for (let colour = 0; colour < colours; colour++) {
      const clash = graph.edges.some(
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

  return search(0)
}

/** Vertices of an odd cycle, which is the reason a graph needs three colours. */
export function findOddCycle(graph: Graph): string[] | null {
  const neighbours = new Map<string, string[]>()
  for (const vertex of graph.vertices) neighbours.set(vertex, [])
  for (const [left, right] of graph.edges) {
    neighbours.get(left)?.push(right)
    neighbours.get(right)?.push(left)
  }

  const side = new Map<string, number>()
  const parent = new Map<string, string>()

  for (const start of graph.vertices) {
    if (side.has(start)) continue
    side.set(start, 0)
    const queue = [start]

    while (queue.length > 0) {
      const current = queue.shift() as string
      for (const next of neighbours.get(current) ?? []) {
        if (!side.has(next)) {
          side.set(next, 1 - (side.get(current) ?? 0))
          parent.set(next, current)
          queue.push(next)
          continue
        }
        if (side.get(next) !== side.get(current)) continue

        // Same side and adjacent: walk both back to their meeting point.
        const path = (from: string): string[] => {
          const out = [from]
          let at = from
          while (parent.has(at)) {
            at = parent.get(at) as string
            out.push(at)
          }
          return out
        }
        const left = path(current)
        const right = path(next)
        const meet = left.find((vertex) => right.includes(vertex))
        if (meet === undefined) continue
        return [
          ...left.slice(0, left.indexOf(meet) + 1),
          ...right.slice(0, right.indexOf(meet)).reverse(),
        ]
      }
    }
  }

  return null
}
