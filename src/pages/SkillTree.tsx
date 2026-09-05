import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, CATEGORY_BY_ID, type Category, type Priority } from '@/engine/categories'
import { getMinigame } from '@/engine/registry'
import { COLUMN_GAP, NODE_HEIGHT, NODE_WIDTH, layoutGraph } from '@/engine/graphLayout'
import {
  CLEAR_ACCURACY,
  CLEAR_ATTEMPTS,
  itemById,
  skillTree,
  summarise,
  unlockedBy,
  type NodeState,
  type SkillNode,
} from '@/engine/skillTree'
import { Button, Card } from '@/ui/primitives'
import { useProgress } from '@/store/progress'

/** Fill and text per state, so the graph reads at a glance without a legend. */
const STATE_FILL: Record<NodeState, string> = {
  cleared: 'var(--color-grass)',
  available: 'var(--color-coin)',
  locked: 'rgba(255,253,245,0.55)',
  unbuilt: 'rgba(255,253,245,0.4)',
}

const STATE_TEXT: Record<NodeState, string> = {
  cleared: '#ffffff',
  available: 'var(--color-ink)',
  locked: 'var(--color-ink-soft)',
  unbuilt: 'var(--color-ink-soft)',
}

const PRIORITY_DOT: Record<Priority, string> = {
  lost: 'var(--color-space-red)',
  refresh: 'var(--color-coin-deep)',
  skim: 'transparent',
}

/**
 * The skill tree as an actual graph.
 *
 * One chapter at a time rather than all 76 nodes at once: the four chapters
 * are four almost separate components, and drawing them together makes a
 * picture nobody can read on a phone. The handful of genuine cross-chapter
 * prerequisites — first-order resolution really does need unification — are
 * reported on the node rather than drawn as an edge to somewhere off screen.
 */
export function SkillTree() {
  const progress = useProgress()
  const nodes = skillTree(progress)
  const totals = summarise(nodes)

  const [category, setCategory] = useState<Category>('propositional')
  const [selected, setSelected] = useState<string | null>(null)

  // How many nodes fit across, measured rather than guessed: a layer with
  // seven roots is otherwise a graph three phone-screens wide, most of it
  // empty. Falls back to four before the first measurement.
  const frame = useRef<HTMLDivElement>(null)
  const [perRow, setPerRow] = useState(4)

  useEffect(() => {
    const element = frame.current
    if (element === null) return

    const measure = () => {
      const available = element.clientWidth - 20
      setPerRow(Math.max(2, Math.floor((available + COLUMN_GAP) / (NODE_WIDTH + COLUMN_GAP))))
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const inCategory = useMemo(
    () => nodes.filter((node) => node.category === category),
    [nodes, category],
  )

  const { layout, external } = useMemo(() => {
    const ids = new Set(inCategory.map((node) => node.item.id))
    const outside = new Map<string, string[]>()

    const inputs = inCategory.map((node) => {
      const requires = node.item.requires ?? []
      const away = requires.filter((id) => !ids.has(id))
      if (away.length > 0) outside.set(node.item.id, away)
      return { id: node.item.id, requires: requires.filter((id) => ids.has(id)) }
    })

    return { layout: layoutGraph(inputs, perRow), external: outside }
  }, [inCategory, perRow])

  const byId = new Map(inCategory.map((node) => [node.item.id, node]))
  const chosen = selected === null ? null : (byId.get(selected) ?? null)

  return (
    <div className="flex flex-col gap-4">
      <Link to="/" className="text-sm font-bold text-ink hover:underline">
        ← Course
      </Link>

      <header className="text-center">
        <span className="space inline-flex h-16 w-16 items-center justify-center bg-coin text-3xl" aria-hidden>
          🌳
        </span>
        <h1 className="shout mt-2 text-3xl text-white">Skill Tree</h1>
        <p className="mt-1 text-sm font-semibold text-ink">
          What you can do now, and what it opens next.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Tally value={totals.cleared} label="cleared" className="bg-grass text-white" />
        <Tally value={totals.available} label="open" className="bg-coin" />
        <Tally value={totals.locked + totals.unbuilt} label="shut" className="bg-card" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {CATEGORIES.map((entry) => {
          const active = entry.id === category
          const built = nodes.filter(
            (node) => node.category === entry.id && node.state !== 'unbuilt',
          ).length
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setCategory(entry.id)
                setSelected(null)
              }}
              className={`chunky flex items-center gap-2 px-2.5 py-2 text-left text-xs font-bold
                focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                ${active ? 'bg-space-blue text-white' : 'bg-card text-ink hover:bg-card-shade'}`}
            >
              <span className="formula shrink-0 text-base" aria-hidden>
                {entry.icon}
              </span>
              <span className="min-w-0 flex-1 truncate">{entry.title}</span>
              <span className="shrink-0 opacity-70">{built}</span>
            </button>
          )
        })}
      </div>

      <Card className="bg-card p-2">
        <div ref={frame} className="overflow-x-auto">
          <svg
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="img"
            aria-label={`Dependency graph for ${CATEGORY_BY_ID[category].title}`}
            className="max-w-none"
          >
            {layout.edges.map((edge, index) => {
              // An S-curve rather than a straight line: several edges arriving
              // at one node overlap into a single thick stroke when straight,
              // and you cannot see how many prerequisites it actually has.
              const midY = (edge.fromY + edge.toY) / 2
              const lit = chosen !== null && (edge.to === chosen.item.id || edge.from === chosen.item.id)
              return (
                <path
                  key={index}
                  d={`M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${midY}, ${edge.toX} ${midY}, ${edge.toX} ${edge.toY}`}
                  fill="none"
                  stroke={lit ? 'var(--color-space-blue)' : 'var(--color-ink)'}
                  strokeWidth={lit ? 3 : 1.5}
                  strokeOpacity={lit ? 1 : chosen === null ? 0.35 : 0.15}
                />
              )
            })}

            {layout.nodes.map((placed) => {
              const node = byId.get(placed.id)
              if (node === undefined) return null
              const game = node.item.game === undefined ? undefined : getMinigame(node.item.game)
              const isChosen = chosen?.item.id === placed.id

              return (
                <g
                  key={placed.id}
                  transform={`translate(${placed.x}, ${placed.y})`}
                  onClick={() => setSelected(placed.id)}
                  className="cursor-pointer"
                >
                  <rect
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx={12}
                    fill={STATE_FILL[node.state]}
                    stroke="var(--color-ink)"
                    strokeWidth={isChosen ? 4 : 2}
                    strokeDasharray={node.state === 'unbuilt' ? '5 4' : undefined}
                  />
                  <text x={9} y={20} fontSize={13}>
                    {game?.icon ?? (node.state === 'locked' ? '🔒' : '·')}
                  </text>
                  <text x={30} y={19} fontSize={11} fontWeight={700} fill={STATE_TEXT[node.state]}>
                    {node.item.n === undefined ? 'warm-up' : `#${node.item.n}`}
                  </text>
                  {node.item.priority !== undefined && node.item.priority !== 'skim' && (
                    <circle cx={NODE_WIDTH - 12} cy={14} r={4} fill={PRIORITY_DOT[node.item.priority]} />
                  )}
                  {wrapLabel(game?.title ?? node.item.title).map((line, lineIndex) => (
                    <text
                      key={lineIndex}
                      x={9}
                      y={34 + lineIndex * 11}
                      fontSize={9.5}
                      fontWeight={600}
                      fill={STATE_TEXT[node.state]}
                    >
                      {line}
                    </text>
                  ))}
                </g>
              )
            })}
          </svg>
        </div>
        <p className="mt-1 px-1 text-[0.65rem] font-semibold text-ink-soft">
          Tap a node. Edges run downwards, from a skill to what it opens. A red dot marks an item
          the plan flags as lost marks.
        </p>
      </Card>

      {chosen === null ? (
        <Card>
          <p className="text-sm font-medium">
            A skill counts as <strong>cleared</strong> once you have answered{' '}
            <strong>{CLEAR_ATTEMPTS}</strong> questions at{' '}
            <strong>{Math.round(CLEAR_ACCURACY * 100)}%</strong> or better. Clearing one opens
            whatever sits below it.
          </p>
        </Card>
      ) : (
        <Detail node={chosen} external={external.get(chosen.item.id) ?? []} />
      )}
    </div>
  )
}

/**
 * A node label as up to two short lines.
 *
 * SVG does not wrap text, so this does it: one line truncated mid-phrase read
 * as "Encoding a problem," and told you nothing, which is worse than a smaller
 * font on two lines.
 */
export function wrapLabel(title: string, perLine = 16, lines = 2): string[] {
  const head = (title.split(/ — | – /)[0] ?? title).replace(/\s*\(.*\)\s*$/, '')
  const words = head.split(' ')
  const out: string[] = []
  let current = ''

  for (const word of words) {
    const next = current === '' ? word : `${current} ${word}`
    if (next.length <= perLine) {
      current = next
      continue
    }
    if (current !== '') out.push(current)
    if (out.length === lines) return truncateLast(out, perLine)
    // A single word longer than a line has to be cut somewhere.
    current = word.length > perLine ? `${word.slice(0, perLine - 1)}…` : word
  }
  if (current !== '') out.push(current)

  return out.length > lines ? truncateLast(out.slice(0, lines), perLine) : out
}

/** Mark that something was dropped, without pushing the line over the limit. */
function truncateLast(lines: string[], perLine: number): string[] {
  const last = lines[lines.length - 1] ?? ''
  const trimmed = last.length >= perLine ? `${last.slice(0, perLine - 1)}…` : `${last}…`
  return [...lines.slice(0, -1), trimmed]
}

function Tally({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div className={`tile p-2 text-center ${className}`}>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[0.65rem] font-bold uppercase tracking-wider">{label}</p>
    </div>
  )
}

function Detail({ node, external }: { node: SkillNode; external: string[] }) {
  const game = node.item.game === undefined ? undefined : getMinigame(node.item.game)
  const opens = unlockedBy(node.item.id)

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span
          className={`space flex h-12 w-12 shrink-0 items-center justify-center text-xl
            ${node.state === 'cleared' ? 'bg-grass' : node.state === 'available' ? 'bg-coin' : 'bg-card-shade'}`}
          aria-hidden
        >
          {game?.icon ?? (node.state === 'locked' ? '🔒' : '·')}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ink-soft">
            {node.item.n === undefined ? 'Warm-up' : `${node.item.n} · ${node.item.source}`}
          </p>
          <h2 className="text-lg font-bold">{game?.title ?? node.item.title}</h2>
          {game !== undefined && <p className="text-sm font-medium text-ink-soft">{node.item.title}</p>}
        </div>
      </div>

      {node.state === 'locked' && (
        <div className="mt-3 rounded-xl bg-card-shade px-3 py-2 text-sm font-medium">
          <p>
            <strong>Needs</strong>{' '}
            {node.blockedBy.map((item) => item.title.split(' — ')[0]).join(', ')}
          </p>
          {node.item.why !== undefined && <p className="mt-1 text-ink-soft">{node.item.why}</p>}
        </div>
      )}

      {node.state === 'unbuilt' && (
        <p className="mt-3 rounded-xl bg-card-shade px-3 py-2 text-sm font-medium text-ink-soft">
          No minigame for this one yet.
        </p>
      )}

      {node.state === 'available' && node.attempts > 0 && (
        <p className="mt-3 text-sm font-semibold text-ink-soft">
          {node.attempts} of {CLEAR_ATTEMPTS} answered · {Math.round(node.accuracy * 100)}% (need{' '}
          {Math.round(CLEAR_ACCURACY * 100)}%)
        </p>
      )}

      {external.length > 0 && (
        <p className="mt-2 text-sm font-medium text-ink-soft">
          <strong>Also needs</strong>{' '}
          {external.map((id) => itemById(id)?.title.split(' — ')[0] ?? id).join(', ')} — from another
          chapter, so it is not drawn above.
        </p>
      )}

      {opens.length > 0 && (
        <p className="mt-2 text-sm font-medium text-ink-soft">
          <strong>Opens</strong> {opens.map((item) => item.title.split(' — ')[0]).join(', ')}
        </p>
      )}

      {game !== undefined && node.state !== 'locked' && (
        <div className="mt-3 flex gap-2">
          <Link to={`/play/${game.id}`} className="flex-1">
            <Button variant="coin" className="w-full">
              Play
            </Button>
          </Link>
          {game.Guide && (
            <Link to={`/guide/${game.id}`} className="flex-1">
              <Button variant="secondary" className="w-full">
                How to
              </Button>
            </Link>
          )}
        </div>
      )}
    </Card>
  )
}
