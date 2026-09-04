import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getMinigame } from '@/engine/registry'
import { RoundScreen } from '@/engine/RoundScreen'
import { DIFFICULTIES } from '@/engine/types'
import type { Difficulty } from '@/engine/types'
import { randomSeed } from '@/logic'
import { Button, Card } from '@/ui/primitives'

const isDifficulty = (value: string | null): value is Difficulty =>
  value !== null && (DIFFICULTIES as readonly string[]).includes(value)

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
        <h1 className="font-semibold">No such minigame</h1>
        <p className="mt-2 text-sm text-slate-400">
          Nothing is registered under <code>{gameId}</code>.
        </p>
        <Link to="/">
          <Button className="mt-4" variant="secondary">
            Back to games
          </Button>
        </Link>
      </Card>
    )
  }

  if (!seedParam) {
    return (
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="text-2xl font-bold">
            <span aria-hidden>{game.icon}</span> {game.title}
          </h1>
          <p className="mt-1 text-slate-400">{game.tagline}</p>
        </header>

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            Difficulty
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DIFFICULTIES.map((level) => (
              <Button
                key={level}
                variant={level === difficulty ? 'primary' : 'secondary'}
                onClick={() => setParam('difficulty', level)}
              >
                {level}
              </Button>
            ))}
          </div>
        </Card>

        <Button onClick={() => setParam('seed', randomSeed())}>Start round</Button>
        <Link to="/" className="self-center">
          <Button variant="ghost">Back to games</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
          ← Games
        </Link>
        <span className="text-sm text-slate-500">
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
