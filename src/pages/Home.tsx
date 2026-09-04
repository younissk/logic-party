import { Link } from 'react-router-dom'
import { MINIGAMES, coveredTopics } from '@/engine/registry'
import { TOPIC_LABELS } from '@/engine/types'
import { Card } from '@/ui/primitives'
import {
  currentStreak,
  overallStats,
  statsForGame,
  useProgress,
  weakestTopics,
} from '@/store/progress'

export function Home() {
  const progress = useProgress()
  const stats = overallStats(progress)
  const streak = currentStreak(progress)
  const weak = weakestTopics(coveredTopics(), progress).slice(0, 3)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Logic Party</h1>
        <p className="mt-1 text-slate-400">Computational logic, one minigame at a time.</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Answered" value={String(stats.attempts)} />
        <Stat
          label="Accuracy"
          value={stats.attempts === 0 ? '—' : `${Math.round(stats.accuracy * 100)}%`}
        />
        <Stat label="Streak" value={String(streak)} />
      </div>

      {stats.attempts > 0 && (
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            Weakest topics
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {weak.map(({ topic, stats: topicStats }) => (
              <li key={topic} className="flex items-center justify-between text-sm">
                <span>{TOPIC_LABELS[topic]}</span>
                <span className="tabular-nums text-slate-400">
                  {topicStats.attempts === 0
                    ? 'not practised'
                    : `${Math.round(topicStats.accuracy * 100)}% of ${topicStats.attempts}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Minigames</h2>
        {MINIGAMES.map((game) => {
          const gameStats = statsForGame(game.id, progress)
          return (
            <Link key={game.id} to={`/play/${game.id}`} className="block">
              <Card className="transition-colors hover:border-indigo-600 hover:bg-slate-900">
                <div className="flex items-start gap-3">
                  <span className="text-2xl" aria-hidden>
                    {game.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{game.title}</h3>
                    <p className="mt-0.5 text-sm text-slate-400">{game.tagline}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {game.topics.map((topic) => TOPIC_LABELS[topic]).join(' · ')}
                      {gameStats.attempts > 0 &&
                        ` — ${Math.round(gameStats.accuracy * 100)}% over ${gameStats.attempts}`}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="text-center">
      <p className="text-2xl font-bold tabular-nums text-indigo-300">{value}</p>
      <p className="mt-0.5 text-xs uppercase tracking-wider text-slate-500">{label}</p>
    </Card>
  )
}
