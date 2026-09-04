import { Link, useParams } from 'react-router-dom'
import { CATEGORY_BY_ID, type Category as CategoryId } from '@/engine/categories'
import { minigamesInCategory } from '@/engine/registry'
import { DIFFICULTIES, TOPIC_LABELS } from '@/engine/types'
import { Button, Card, Star } from '@/ui/primitives'
import {
  formatDuration,
  getBestTime,
  getHighScore,
  statsForGame,
  useProgress,
} from '@/store/progress'

const isCategory = (value: string): value is CategoryId => value in CATEGORY_BY_ID

export function Category() {
  const { categoryId = '' } = useParams()
  const progress = useProgress()

  if (!isCategory(categoryId)) {
    return (
      <Card>
        <h1 className="text-lg font-bold">No such category</h1>
        <Link to="/">
          <Button variant="secondary" className="mt-4 w-full">
            Back to the course
          </Button>
        </Link>
      </Card>
    )
  }

  const category = CATEGORY_BY_ID[categoryId]
  const games = minigamesInCategory(categoryId)

  return (
    <div className="flex flex-col gap-4">
      <Link to="/" className="text-sm font-bold text-ink hover:underline">
        ← Course
      </Link>

      <header className="text-center">
        <span
          className={`space formula inline-flex h-20 w-20 items-center justify-center text-4xl font-bold ${category.colour}`}
          aria-hidden
        >
          {category.icon}
        </span>
        <h1 className="shout mt-3 text-3xl text-white">{category.title}</h1>
        <p className="mt-1 font-semibold text-ink">{category.blurb}</p>
      </header>

      {games.length === 0 ? (
        <Card>
          <h2 className="text-lg font-bold">No minigames here yet</h2>
          <p className="mt-1 text-sm font-medium text-ink-soft">
            This is where these exercises will live once you build them:
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {category.planned.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 rounded-xl bg-card-shade px-3 py-2 text-sm font-semibold"
              >
                <span className="text-ink-soft" aria-hidden>
                  ○
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs font-medium text-ink-soft">
            That list is a placeholder — edit <code>planned</code> in{' '}
            <code>src/engine/categories.ts</code> to match your syllabus.
          </p>
        </Card>
      ) : (
        games.map((game) => {
          const gameStats = statsForGame(game.id, progress)
          const best = Math.max(...DIFFICULTIES.map((level) => getHighScore(game.id, level, progress)))
          const times = DIFFICULTIES.map((level) => getBestTime(game.id, level, progress)).filter(
            (time): time is number => time !== null,
          )
          const bestTime = times.length > 0 ? Math.min(...times) : null

          return (
            <Card key={game.id}>
              <div className="flex items-center gap-3">
                <span
                  className="space flex h-14 w-14 shrink-0 items-center justify-center bg-coin text-2xl"
                  aria-hidden
                >
                  {game.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold">{game.title}</h2>
                  <p className="mt-0.5 text-sm font-medium text-ink-soft">{game.tagline}</p>
                  <p className="mt-1 text-xs font-semibold text-ink-soft">
                    {game.topics.map((topic) => TOPIC_LABELS[topic]).join(' · ')}
                    {gameStats.attempts > 0 &&
                      ` — ${Math.round(gameStats.accuracy * 100)}% over ${gameStats.attempts}`}
                  </p>
                  {(best > 0 || bestTime !== null) && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold">
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

              <div className="mt-4 flex gap-2">
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
            </Card>
          )
        })
      )}
    </div>
  )
}
