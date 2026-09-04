import { Link } from 'react-router-dom'
import { MINIGAMES, coveredTopics } from '@/engine/registry'
import { DIFFICULTIES, TOPIC_LABELS } from '@/engine/types'
import { Card, Star } from '@/ui/primitives'
import {
  currentStreak,
  formatDuration,
  getBestTime,
  getHighScore,
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
    <div className="flex flex-col gap-5">
      <header className="pt-2 text-center">
        <h1 className="shout text-5xl text-coin">Logic Party</h1>
        <p className="mt-2 font-semibold text-ink">Computational logic, one minigame at a time.</p>
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
        <h2 className="shout text-center text-2xl text-white">Minigames</h2>
        {MINIGAMES.map((game) => {
          const gameStats = statsForGame(game.id, progress)
          // One card, three difficulties and two modes — show the best of each.
          const best = Math.max(
            ...DIFFICULTIES.map((level) => getHighScore(game.id, level, progress)),
          )
          const times = DIFFICULTIES.map((level) => getBestTime(game.id, level, progress)).filter(
            (time): time is number => time !== null,
          )
          const bestTime = times.length > 0 ? Math.min(...times) : null
          return (
            <Link key={game.id} to={`/play/${game.id}`} className="block active:translate-y-1">
              <Card className="hover:bg-card-shade">
                <div className="flex items-center gap-3">
                  <span
                    className="space flex h-14 w-14 shrink-0 items-center justify-center bg-coin text-2xl"
                    aria-hidden
                  >
                    {game.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold">{game.title}</h3>
                    <p className="mt-0.5 text-sm font-medium text-ink-soft">{game.tagline}</p>
                    <p className="mt-1.5 text-xs font-semibold text-ink-soft">
                      {game.topics.map((topic) => TOPIC_LABELS[topic]).join(' · ')}
                      {gameStats.attempts > 0 &&
                        ` — ${Math.round(gameStats.accuracy * 100)}% over ${gameStats.attempts}`}
                    </p>
                    {(best > 0 || bestTime !== null) && (
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-ink">
                        {best > 0 && (
                          <span className="flex items-center gap-1">
                            <Star earned className="h-5 w-5" />
                            {best}
                          </span>
                        )}
                        {bestTime !== null && <span>⏱ {formatDuration(bestTime)}</span>}
                      </p>
                    )}
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
    <Card className="px-2 py-3 text-center">
      <p className="text-3xl font-bold tabular-nums text-space-blue">{value}</p>
      <p className="mt-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
        {label}
      </p>
    </Card>
  )
}

