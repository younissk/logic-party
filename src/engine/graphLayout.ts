/**
 * Laying a skill tree out as an actual graph.
 *
 * Kept separate from the drawing so the geometry can be tested: an edge that
 * points at nothing, or a node placed on top of another, is a bug you want a
 * test to catch rather than a screenshot.
 *
 * Layers run top to bottom by *longest* path from a root rather than shortest,
 * which is what puts every prerequisite strictly above the thing it unlocks —
 * with shortest paths an edge can run sideways or backwards and the picture
 * stops meaning anything.
 */

export interface GraphInput {
  id: string
  /** Prerequisites. Ids outside this set are ignored, not dropped silently. */
  requires: readonly string[]
}

export interface PlacedNode {
  id: string
  /** Depth from a root, counting the longest route. */
  layer: number
  /** Position within the layer, left to right. */
  column: number
  x: number
  y: number
}

export interface GraphEdge {
  from: string
  to: string
  fromX: number
  fromY: number
  toX: number
  toY: number
}

export interface GraphLayout {
  nodes: PlacedNode[]
  edges: GraphEdge[]
  /** Prerequisites that live outside this graph, by node id. */
  external: Map<string, string[]>
  width: number
  height: number
  layers: number
}

export const NODE_WIDTH = 104
export const NODE_HEIGHT = 54
export const COLUMN_GAP = 10
const ROW_GAP = 8
const LAYER_GAP = 30
const PADDING = 10

/**
 * Longest-path layering.
 *
 * A cycle would make this diverge, so it is bounded by the node count and any
 * node not settled by then is pinned to the last layer. The skill tree is
 * tested acyclic elsewhere; this is what stops a future edit taking the page
 * down rather than failing a test.
 */
function layerOf(nodes: readonly GraphInput[]): Map<string, number> {
  const present = new Set(nodes.map((node) => node.id))
  const layers = new Map<string, number>(nodes.map((node) => [node.id, 0]))

  for (let round = 0; round < nodes.length; round++) {
    let changed = false
    for (const node of nodes) {
      const inside = node.requires.filter((id) => present.has(id))
      if (inside.length === 0) continue
      const deepest = Math.max(...inside.map((id) => layers.get(id) ?? 0))
      if (deepest + 1 > (layers.get(node.id) ?? 0)) {
        layers.set(node.id, deepest + 1)
        changed = true
      }
    }
    if (!changed) break
  }

  return layers
}

/**
 * Place every node, and every edge between two placed nodes.
 *
 * Within a layer, order is the order the nodes were given — which is the
 * study plan's own order, so the picture reads the way the list does.
 *
 * `maxPerRow` wraps a layer that is too wide onto further lines rather than
 * letting one broad layer set the width of the whole canvas. Seven roots on a
 * phone is otherwise a graph three screens wide, most of it empty. The wrapped
 * lines stay inside their layer's vertical band, so edges still only ever
 * point downwards.
 */
export function layoutGraph(nodes: readonly GraphInput[], maxPerRow = 4): GraphLayout {
  const present = new Set(nodes.map((node) => node.id))
  const layers = layerOf(nodes)
  const perRow = Math.max(1, Math.floor(maxPerRow))

  const byLayer = new Map<number, GraphInput[]>()
  for (const node of nodes) {
    const layer = layers.get(node.id) ?? 0
    byLayer.set(layer, [...(byLayer.get(layer) ?? []), node])
  }

  const ordered = [...byLayer.entries()].sort((a, b) => a[0] - b[0])
  const widest = Math.max(1, ...ordered.map(([, row]) => Math.min(row.length, perRow)))
  const rowWidth = widest * NODE_WIDTH + (widest - 1) * COLUMN_GAP
  const width = rowWidth + PADDING * 2

  const placed: PlacedNode[] = []
  let y = PADDING

  for (const [layer, row] of ordered) {
    const lines: GraphInput[][] = []
    for (let index = 0; index < row.length; index += perRow) {
      lines.push(row.slice(index, index + perRow))
    }

    lines.forEach((line, lineIndex) => {
      // Centre each line against the widest one, so the graph reads as a tree
      // rather than as a left-aligned staircase.
      const thisWidth = line.length * NODE_WIDTH + (line.length - 1) * COLUMN_GAP
      const offset = PADDING + (rowWidth - thisWidth) / 2

      line.forEach((node, column) => {
        placed.push({
          id: node.id,
          layer,
          column: lineIndex * perRow + column,
          x: offset + column * (NODE_WIDTH + COLUMN_GAP),
          y: y + lineIndex * (NODE_HEIGHT + ROW_GAP),
        })
      })
    })

    y += lines.length * NODE_HEIGHT + (lines.length - 1) * ROW_GAP + LAYER_GAP
  }

  const byId = new Map(placed.map((node) => [node.id, node]))
  const edges: GraphEdge[] = []
  const external = new Map<string, string[]>()

  for (const node of nodes) {
    for (const required of node.requires) {
      if (!present.has(required)) {
        external.set(node.id, [...(external.get(node.id) ?? []), required])
        continue
      }
      const from = byId.get(required)
      const to = byId.get(node.id)
      if (from === undefined || to === undefined) continue
      edges.push({
        from: required,
        to: node.id,
        fromX: from.x + NODE_WIDTH / 2,
        fromY: from.y + NODE_HEIGHT,
        toX: to.x + NODE_WIDTH / 2,
        toY: to.y,
      })
    }
  }

  return {
    nodes: placed,
    edges,
    external,
    width,
    // `y` has advanced past the last layer by one gap, which is the bottom
    // padding it needs anyway.
    height: y - LAYER_GAP + PADDING,
    layers: byLayer.size,
  }
}
