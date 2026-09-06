import { Link } from 'react-router-dom'
import { CATEGORIES, topicsInCategory } from '@/engine/categories'
import { minigamesInCategory, MINIGAMES } from '@/engine/registry'
import { TOPIC_LABELS } from '@/engine/types'
import { Card } from '@/ui/primitives'
import { Avatar, LevelBar } from '@/ui/Avatar'
import { levelStanding, usePlayer } from '@/store/player'
import { Search } from '@/ui/Search'
import { skillTree, summarise } from '@/engine/skillTree'
import { currentStreak, overallStats, statsForTopic, useProgress, weakestTopics } from '@/store/progress'
import type { ProgressState } from '@/store/progress'
import type { CategoryInfo } from '@/engine/categories'

export function Home() {
  const progress = useProgress()
  const player = usePlayer()
  const standing = levelStanding(player.xp)
  const stats = overallStats(progress)
  const streak = currentStreak(progress)
  const tree = summarise(skillTree(progress))

  const practisedTopics = MINIGAMES.flatMap((game) => game.topics)
  const weak = weakestTopics([...new Set(practisedTopics)], progress).slice(0, 3)

  return (
    <div className="flex flex-col gap-5">
      <header className="pt-2 text-center">
        <h1 className="shout text-5xl text-coin">Logic Party</h1>
        <p className="mt-2 font-semibold text-ink">Computational logic, one minigame at a time.</p>
      </header>

      <Link to="/me" className="block active:translate-y-1">
        <Card className="bg-card hover:bg-card-shade">
          <div className="flex items-center gap-3">
            <Avatar style={player.style} seed={player.seed} name={player.name} size={56} />
            <LevelBar {...standing} />
            <span className="text-xl" aria-hidden>
              ›
            </span>
          </div>
        </Card>
      </Link>

      <Link to="/party" className="block active:translate-y-1">
        <Card className="bg-space-blue text-white hover:brightness-110">
          <div className="flex items-center gap-3">
            <span className="space flex h-12 w-12 shrink-0 items-center justify-center bg-coin text-2xl" aria-hidden>
              🎡
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold">Party Run</h2>
              <p className="text-sm font-semibold opacity-85">
                Twelve stops. The wheel picks the game, a rule card picks the rules.
              </p>
            </div>
            <span className="text-xl" aria-hidden>
              ›
            </span>
          </div>
        </Card>
      </Link>

      <Search />

      <Link to="/tree" className="block active:translate-y-1">
        <Card className="bg-coin">
          <div className="flex items-center gap-3">
            <span className="space flex h-12 w-12 shrink-0 items-center justify-center bg-card text-2xl" aria-hidden>
              🌳
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold">Skill Tree</h2>
              <p className="text-sm font-semibold text-ink-soft">
                {tree.cleared} cleared · {tree.available + tree.locked} playable · {tree.unbuilt} not built yet
              </p>
            </div>
            <span className="text-xl" aria-hidden>
              ›
            </span>
          </div>
        </Card>
      </Link>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Answered" value={String(stats.attempts)} />
        <Stat
          label="Accuracy"
          value={stats.attempts === 0 ? '—' : `${Math.round(stats.accuracy * 100)}%`}
        />
        <Stat label="Streak" value={String(streak)} />
      </div>

      {stats.attempts > 0 && weak.length > 0 && (
        <Card>
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft">
            Work on these next
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {weak.map(({ topic, stats: topicStats }) => (
              <li key={topic} className="flex items-center justify-between gap-3 text-sm font-semibold">
                <span>{TOPIC_LABELS[topic]}</span>
                <span className="tabular-nums text-ink-soft">
                  {topicStats.attempts === 0
                    ? 'not played'
                    : `${Math.round(topicStats.accuracy * 100)}% of ${topicStats.attempts}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="shout text-center text-2xl text-white">Course</h2>
        {CATEGORIES.map((category) => (
          <CategoryCard key={category.id} category={category} progress={progress} />
        ))}
      </section>
    </div>
  )
}

function CategoryCard({
  category,
  progress,
}: {
  category: CategoryInfo
  progress: ProgressState
}) {
  const games = minigamesInCategory(category.id)
  const topics = topicsInCategory(category.id)
  const attempts = topics.reduce((total, topic) => total + statsForTopic(topic, progress).attempts, 0)
  const accuracy =
    attempts === 0
      ? null
      : topics.reduce(
          (total, topic) => {
            const topicStats = statsForTopic(topic, progress)
            return total + topicStats.accuracy * topicStats.attempts
          },
          0,
        ) / attempts

  return (
    <Link to={`/category/${category.id}`} className="block active:translate-y-1">
      <Card className="hover:bg-card-shade">
        <div className="flex items-center gap-3">
          <span
            className={`space formula flex h-14 w-14 shrink-0 items-center justify-center text-2xl font-bold ${category.colour}`}
            aria-hidden
          >
            {category.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold">{category.title}</h3>
            <p className="mt-0.5 text-sm font-medium text-ink-soft">{category.blurb}</p>
            <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-ink-soft">
              {games.length === 0
                ? 'No minigames yet'
                : `${games.length} minigame${games.length === 1 ? '' : 's'}`}
              {accuracy !== null && ` · ${Math.round(accuracy * 100)}% over ${attempts}`}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="px-2 py-3 text-center">
      <p className="text-3xl font-bold tabular-nums text-space-blue">{value}</p>
      <p className="mt-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
        {label}
      </p>
    </Card>
  )
}
