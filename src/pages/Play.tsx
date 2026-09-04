import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getMinigame } from '@/engine/registry'
import { RoundScreen } from '@/engine/RoundScreen'
import { DIFFICULTIES } from '@/engine/types'
import type { Difficulty } from '@/engine/types'
import { randomSeed } from '@/logic'
import { Button, Card } from '@/ui/primitives'

const isDifficulty = (value: string | null): value is Difficulty =>
  value !== null && (DIFFICULTIES as readonly string[]).includes(value)

/** Green / blue / red, in the order a board ramps up. */
const DIFFICULTY_COLOURS: Record<Difficulty, string> = {
  easy: 'bg-grass text-white',
  medium: 'bg-space-blue text-white',
  hard: 'bg-space-red text-white',
}

export function Play() {
  const { gameId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const game = getMinigame(gameId)

  // Seed and difficulty live in the URL, so a round is shareable and a
  // disputed question can be reproduced exactly.
  const seedParam = params.get('seed')
  const difficultyParam = params.get('difficulty')
  const difficulty: Difficulty = isDifficulty(difficultyParam) ? difficultyParam : 'medium'

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next, { replace: true })
  }

  if (!game) {
    return (
      <Card>
        <h1 className="text-lg font-bold">No such minigame</h1>
        <p className="mt-2 text-sm font-medium text-ink-soft">
          Nothing is registered under <code>{gameId}</code>.
        </p>
        <Link to="/">
          <Button variant="secondary" className="mt-4 w-full">
            Back to games
          </Button>
        </Link>
      </Card>
    )
  }

  if (!seedParam) {
    return (
      <div className="flex flex-col gap-4">
        <header className="pt-2 text-center">
          <span className="space inline-flex h-20 w-20 items-center justify-center bg-coin text-4xl">
            {game.icon}
          </span>
          <h1 className="shout mt-3 text-4xl text-white">{game.title}</h1>
          <p className="mt-1 font-semibold text-ink">{game.tagline}</p>
        </header>

        <Card>
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft">Difficulty</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DIFFICULTIES.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setParam('difficulty', level)}
                aria-pressed={level === difficulty}
                className={`chunky min-h-12 px-2 text-base font-bold capitalize
                  focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                  ${
                    level === difficulty
                      ? DIFFICULTY_COLOURS[level]
                      : 'bg-card text-ink hover:bg-card-shade'
                  }`}
              >
                {level}
              </button>
            ))}
          </div>
        </Card>

        <Button variant="coin" className="text-xl" onClick={() => setParam('seed', randomSeed())}>
          ★ Start round
        </Button>
        <Link to="/" className="self-center">
          <Button variant="ghost">Back to games</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/" className="text-sm font-bold text-ink hover:underline">
          ← Games
        </Link>
        <span className="text-sm font-bold text-ink capitalize">
          {game.title} · {difficulty}
        </span>
      </div>

      <RoundScreen
        game={game}
        difficulty={difficulty}
        seed={seedParam}
        onNewSeed={(seed) => setParam('seed', seed)}
      />
    </div>
  )
}
