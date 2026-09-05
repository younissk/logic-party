import { describe, expect, it } from 'vitest'

import { clauseSetToFormula, showClauseSet } from './normal'
import { isSatisfiable } from './semantics'
import {
  colouringClauses,
  colouringToLiterals,
  conflictingEdges,
  findOddCycle,
  isColourable,
  isProperColouring,
  type Graph,
} from './encoding'

/** Exercise 1 Q4: ({a,b,c,d}, {(a,b),(b,c),(c,d),(d,a),(a,c)}). */
const EXERCISE: Graph = {
  vertices: ['a', 'b', 'c', 'd'],
  edges: [
    ['a', 'b'],
    ['b', 'c'],
    ['c', 'd'],
    ['d', 'a'],
    ['a', 'c'],
  ],
}

const SQUARE: Graph = {
  vertices: ['a', 'b', 'c', 'd'],
  edges: [
    ['a', 'b'],
    ['b', 'c'],
    ['c', 'd'],
    ['d', 'a'],
  ],
}

describe('colouringClauses', () => {
  it('produces the three families in the right sizes', () => {
    const encoding = colouringClauses(EXERCISE, 2)
    // One "at least one colour" clause per vertex.
    expect(encoding.atLeastOne).toHaveLength(4)
    // With two colours there is one pair per vertex.
    expect(encoding.atMostOne).toHaveLength(4)
    // One clause per edge per colour.
    expect(encoding.edgeClauses).toHaveLength(10)
  })

  it('says an edge clause forbids sharing without naming a winner', () => {
    const encoding = colouringClauses({ vertices: ['a', 'b'], edges: [['a', 'b']] }, 2)
    expect(showClauseSet(encoding.edgeClauses)).toBe('{{¬a1, ¬b1}, {¬a2, ¬b2}}')
  })
})

describe('the exercise question', () => {
  it('cannot be two-coloured', () => {
    // The exam's own answer: this graph is not 2-colourable.
    expect(isColourable(EXERCISE, 2)).toBe(false)
    expect(isSatisfiable(clauseSetToFormula(colouringClauses(EXERCISE, 2).all))).toBe(false)
  })

  it('can be three-coloured', () => {
    expect(isColourable(EXERCISE, 3)).toBe(true)
    expect(isSatisfiable(clauseSetToFormula(colouringClauses(EXERCISE, 3).all))).toBe(true)
  })

  it('is the triangle that blocks it', () => {
    // a–b–c–a is an odd cycle, and an odd cycle is exactly why two colours fail.
    const cycle = findOddCycle(EXERCISE) as string[]
    expect(cycle.length % 2).toBe(1)
    expect(cycle.length).toBeGreaterThanOrEqual(3)
  })
})

describe('the encoding agrees with the puzzle', () => {
  const cases: [string, Graph, number][] = [
    ['exercise, 2 colours', EXERCISE, 2],
    ['exercise, 3 colours', EXERCISE, 3],
    ['square, 2 colours', SQUARE, 2],
    ['triangle, 2 colours', { vertices: ['x', 'y', 'z'], edges: [['x', 'y'], ['y', 'z'], ['z', 'x']] }, 2],
    ['triangle, 3 colours', { vertices: ['x', 'y', 'z'], edges: [['x', 'y'], ['y', 'z'], ['z', 'x']] }, 3],
    ['no edges', { vertices: ['p', 'q'], edges: [] }, 2],
  ]

  /**
   * The point of the exercise: the CNF is satisfiable exactly when the graph
   * is colourable. If those ever disagree the encoding is wrong, and the
   * puzzle would be unwinnable or trivially winnable without saying so.
   */
  it.each(cases)('%s', (_label, graph, colours) => {
    expect(isSatisfiable(clauseSetToFormula(colouringClauses(graph, colours).all))).toBe(
      isColourable(graph, colours),
    )
  })

  it('a proper colouring satisfies every clause', () => {
    const assignment = new Map([
      ['a', 0],
      ['b', 1],
      ['c', 2],
      ['d', 1],
    ])
    expect(isProperColouring(EXERCISE, assignment)).toBe(true)

    const literals = colouringToLiterals(EXERCISE, 3, assignment)
    const value = new Map(literals.map((literal) => [literal.name, !literal.negated]))
    for (const clause of colouringClauses(EXERCISE, 3).all) {
      expect(clause.some((literal) => value.get(literal.name) === !literal.negated)).toBe(true)
    }
  })

  it('names the edges that clash', () => {
    const assignment = new Map([
      ['a', 0],
      ['b', 0],
      ['c', 1],
      ['d', 1],
    ])
    expect(conflictingEdges(EXERCISE, assignment)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
    expect(isProperColouring(EXERCISE, assignment)).toBe(false)
  })
})

describe('findOddCycle', () => {
  it('finds nothing in a bipartite graph', () => {
    expect(findOddCycle(SQUARE)).toBeNull()
  })

  it('finds nothing when there are no edges', () => {
    expect(findOddCycle({ vertices: ['a', 'b'], edges: [] })).toBeNull()
  })

  it('agrees with two-colourability', () => {
    for (const [, graph] of [
      ['square', SQUARE],
      ['exercise', EXERCISE],
      ['triangle', { vertices: ['x', 'y', 'z'], edges: [['x', 'y'], ['y', 'z'], ['z', 'x']] } as Graph],
      ['path', { vertices: ['a', 'b', 'c'], edges: [['a', 'b'], ['b', 'c']] } as Graph],
    ] as [string, Graph][]) {
      expect(findOddCycle(graph) === null).toBe(isColourable(graph, 2))
    }
  })
})
