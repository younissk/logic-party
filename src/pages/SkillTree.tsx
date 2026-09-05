import { Link } from 'react-router-dom'
import { CATEGORY_BY_ID } from '@/engine/categories'
import { getMinigame } from '@/engine/registry'
import {
  CLEAR_ACCURACY,
  CLEAR_ATTEMPTS,
  skillTree,
  summarise,
  unlockedBy,
  type NodeState,
  type SkillNode,
} from '@/engine/skillTree'
import { Button, Card } from '@/ui/primitives'
import { useProgress } from '@/store/progress'

const STATE_STYLE: Record<NodeState, string> = {
  cleared: 'bg-grass text-white',
  available: 'bg-card',
  locked: 'bg-card/50',
  unbuilt: 'bg-card/40',
}

const STATE_BADGE: Record<NodeState, { label: string; icon: string }> = {
  cleared: { label: 'Cleared', icon: '★' },
  available: { label: 'Open', icon: '▶' },
  locked: { label: 'Locked', icon: '🔒' },
  unbuilt: { label: 'Not built', icon: '·' },
}

export function SkillTree() {
  const progress = useProgress()
  const nodes = skillTree(progress)
  const totals = summarise(nodes)

  // Grouped by section letter, which is already the order the course builds
  // things up in — so the rows of the tree are the chapter's own rows.
  const rows = [...new Set(nodes.map((node) => node.letter))].map((letter) => {
    const inRow = nodes.filter((node) => node.letter === letter)
    return { letter, title: (inRow[0] as SkillNode).section, nodes: inRow }
  })

  return (
    <div className="flex flex-col gap-4">
      <Link to="/" className="text-sm font-bold text-ink hover:underline">
        ← Course
      </Link>

      <header className="text-center">
        <span className="space inline-flex h-20 w-20 items-center justify-center bg-coin text-4xl" aria-hidden>
          🌳
        </span>
        <h1 className="shout mt-3 text-3xl text-white">Skill Tree</h1>
        <p className="mt-1 font-semibold text-ink">
          What you can do now, and what it opens next.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Tally value={totals.cleared} label="cleared" className="bg-grass text-white" />
        <Tally value={totals.available} label="open" className="bg-coin" />
        <Tally value={totals.locked + totals.unbuilt} label="shut" className="bg-card" />
      </div>

      <Card>
        <p className="text-sm font-medium">
          A skill counts as <strong>cleared</strong> once you have answered{' '}
          <strong>{CLEAR_ATTEMPTS}</strong> questions at{' '}
          <strong>{Math.round(CLEAR_ACCURACY * 100)}%</strong> or better. Clearing one opens
          whatever sits downstream of it.
        </p>
      </Card>

      {rows.map((row) => {
        const category = CATEGORY_BY_ID[(row.nodes[0] as SkillNode).category]
        return (
          <section key={row.letter} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2 px-1">
              <span className="shout text-xl text-white">
                {row.letter}. {row.title}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-white/75">
                {category.title}
              </span>
            </div>
            {row.nodes.map((node) => (
              <TreeNode key={node.item.id} node={node} />
            ))}
          </section>
        )
      })}
    </div>
  )
}

function Tally({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div className={`tile p-3 text-center ${className}`}>
      {/* Not `shout`: its dark outline on dark text turns a two-digit number
          into a smudge, and these tiles are cream and gold as well as green. */}
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wider">{label}</p>
    </div>
  )
}

function TreeNode({ node }: { node: SkillNode }) {
  const game = node.item.game === undefined ? undefined : getMinigame(node.item.game)
  const badge = STATE_BADGE[node.state]
  const opens = unlockedBy(node.item.id)
  const light = node.state === 'cleared'

  return (
    <div className={`tile px-3 py-2.5 ${STATE_STYLE[node.state]}`}>
      <div className="flex items-start gap-2.5">
        <span
          className={`space flex h-9 w-9 shrink-0 items-center justify-center text-base
            ${node.state === 'cleared' ? 'bg-coin' : node.state === 'available' ? 'bg-coin' : 'bg-card-shade'}`}
          aria-hidden
        >
          {node.state === 'locked' || node.state === 'unbuilt' ? badge.icon : (game?.icon ?? badge.icon)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className={`text-[0.95rem] font-bold ${light ? '' : node.state === 'available' ? '' : 'text-ink-soft'}`}>
              {node.item.n === undefined ? '' : `${node.item.n}. `}
              {game?.title ?? node.item.title}
            </p>
            <span
              className={`text-xs font-bold uppercase tracking-wider ${light ? 'text-white/80' : 'text-ink-soft'}`}
            >
              {badge.label}
            </span>
          </div>

          {game !== undefined && (
            <p className={`text-xs font-medium ${light ? 'text-white/85' : 'text-ink-soft'}`}>
              {node.item.title}
            </p>
          )}

          {node.state === 'locked' && (
            <p className="mt-1 text-xs font-semibold text-ink-soft">
              Needs {node.blockedBy.map((item) => item.title.split(' — ')[0]).join(' and ')}
              {node.item.why !== undefined && ` — ${node.item.why}`}
            </p>
          )}

          {node.state === 'available' && node.attempts > 0 && (
            <p className="mt-1 text-xs font-semibold text-ink-soft">
              {node.attempts} of {CLEAR_ATTEMPTS} answered · {Math.round(node.accuracy * 100)}% (need{' '}
              {Math.round(CLEAR_ACCURACY * 100)}%)
            </p>
          )}

          {node.state === 'cleared' && opens.length > 0 && (
            <p className="mt-1 text-xs font-semibold text-white/85">
              Opened {opens.map((item) => item.title.split(' — ')[0]).join(', ')}
            </p>
          )}

          {node.state === 'unbuilt' && (
            <p className="mt-1 text-xs font-medium text-ink-soft">{node.item.source}</p>
          )}
        </div>

        {game !== undefined && node.state !== 'locked' && (
          <Link to={`/play/${game.id}`} className="shrink-0 self-center">
            <Button variant={node.state === 'cleared' ? 'secondary' : 'coin'} className="min-h-10 px-4 text-sm">
              Play
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
