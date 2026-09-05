import { describe, expect, it } from 'vitest'

import { CATEGORIES } from './categories'
import { allItems } from './skillTree'
import { NODE_HEIGHT, NODE_WIDTH, layoutGraph, type GraphInput } from './graphLayout'
import { wrapLabel } from '@/pages/SkillTree'

const graph = (spec: Record<string, string[]>): GraphInput[] =>
  Object.entries(spec).map(([id, requires]) => ({ id, requires }))

describe('layoutGraph', () => {
  it('places a root above what it unlocks', () => {
    const layout = layoutGraph(graph({ a: [], b: ['a'] }))
    const [first, second] = layout.nodes
    expect(first?.layer).toBe(0)
    expect(second?.layer).toBe(1)
    expect((second?.y ?? 0) > (first?.y ?? 0)).toBe(true)
  })

  it('uses the longest path, not the shortest', () => {
    // c requires a directly *and* through b. Placing it one below a would draw
    // the b → c edge pointing sideways.
    const layout = layoutGraph(graph({ a: [], b: ['a'], c: ['a', 'b'] }))
    expect(layout.nodes.find((node) => node.id === 'c')?.layer).toBe(2)
  })

  it('never draws an edge that points upwards or sideways', () => {
    for (const category of CATEGORIES) {
      const items = allItems().filter((entry) => entry.category === category.id)
      const ids = new Set(items.map((entry) => entry.item.id))
      const layout = layoutGraph(
        items.map((entry) => ({
          id: entry.item.id,
          requires: (entry.item.requires ?? []).filter((id) => ids.has(id)),
        })),
      )
      for (const edge of layout.edges) {
        expect(edge.toY, `${edge.from} → ${edge.to} in ${category.id}`).toBeGreaterThan(edge.fromY)
      }
    }
  })

  it('never overlaps two nodes', () => {
    for (const category of CATEGORIES) {
      const items = allItems().filter((entry) => entry.category === category.id)
      const ids = new Set(items.map((entry) => entry.item.id))
      const layout = layoutGraph(
        items.map((entry) => ({
          id: entry.item.id,
          requires: (entry.item.requires ?? []).filter((id) => ids.has(id)),
        })),
      )

      for (let i = 0; i < layout.nodes.length; i++) {
        for (let j = i + 1; j < layout.nodes.length; j++) {
          const a = layout.nodes[i]
          const b = layout.nodes[j]
          if (a === undefined || b === undefined) continue
          const apart =
            Math.abs(a.x - b.x) >= NODE_WIDTH || Math.abs(a.y - b.y) >= NODE_HEIGHT
          expect(apart, `${a.id} overlaps ${b.id} in ${category.id}`).toBe(true)
        }
      }
    }
  })

  it('keeps every node inside the reported canvas', () => {
    for (const category of CATEGORIES) {
      const items = allItems().filter((entry) => entry.category === category.id)
      const ids = new Set(items.map((entry) => entry.item.id))
      const layout = layoutGraph(
        items.map((entry) => ({
          id: entry.item.id,
          requires: (entry.item.requires ?? []).filter((id) => ids.has(id)),
        })),
      )
      for (const node of layout.nodes) {
        expect(node.x).toBeGreaterThanOrEqual(0)
        expect(node.y).toBeGreaterThanOrEqual(0)
        expect(node.x + NODE_WIDTH).toBeLessThanOrEqual(layout.width)
        expect(node.y + NODE_HEIGHT).toBeLessThanOrEqual(layout.height)
      }
    }
  })

  it('reports prerequisites that live in another chapter rather than dropping them', () => {
    // First-order resolution genuinely needs unification from the equational
    // chapter. Silently ignoring that edge would make the graph a lie.
    const layout = layoutGraph(graph({ a: [], b: ['a', 'elsewhere'] }))
    expect(layout.edges).toHaveLength(1)
    expect(layout.external.get('b')).toEqual(['elsewhere'])
  })

  it('terminates on a cycle instead of diverging', () => {
    // The tree is tested acyclic; this is what stops a future edit taking the
    // page down rather than failing a test.
    const layout = layoutGraph(graph({ a: ['b'], b: ['a'] }))
    expect(layout.nodes).toHaveLength(2)
    expect(layout.nodes.every((node) => Number.isFinite(node.y))).toBe(true)
  })

  it('gives every chapter a graph with real depth', () => {
    // A chapter laid out in one flat row would mean nothing was connected.
    for (const category of CATEGORIES) {
      const items = allItems().filter((entry) => entry.category === category.id)
      const ids = new Set(items.map((entry) => entry.item.id))
      const layout = layoutGraph(
        items.map((entry) => ({
          id: entry.item.id,
          requires: (entry.item.requires ?? []).filter((id) => ids.has(id)),
        })),
      )
      expect(layout.layers, category.id).toBeGreaterThan(2)
      expect(layout.edges.length, category.id).toBeGreaterThan(items.length / 2)
    }
  })
})

describe('wrapLabel', () => {
  it('keeps a short title on one line', () => {
    expect(wrapLabel('Model Count')).toEqual(['Model Count'])
  })

  it('breaks on a word rather than mid-word', () => {
    expect(wrapLabel('CNF Assembly Line')).toEqual(['CNF Assembly', 'Line'])
  })

  it('drops a parenthetical rather than spending a line on it', () => {
    // Without dropping "(graph colouring)" the second line would have to be
    // cut; with it dropped the whole title fits.
    expect(wrapLabel('Encoding a problem into CNF (graph colouring)')).toEqual([
      'Encoding a',
      'problem into CNF',
    ])
  })

  it('marks what it cut', () => {
    const lines = wrapLabel('Refutation matching a given DPLL tree')
    expect(lines).toHaveLength(2)
    expect(lines[1]?.endsWith('…')).toBe(true)
  })

  it('never exceeds the line length', () => {
    for (const { item } of allItems()) {
      for (const line of wrapLabel(item.title)) {
        expect(line.length, item.title).toBeLessThanOrEqual(16)
      }
    }
  })

  it('cuts a single over-long word instead of overflowing', () => {
    expect(wrapLabel('Satisfiabilityequivalence')).toEqual(['Satisfiabilitye…'])
  })
})
