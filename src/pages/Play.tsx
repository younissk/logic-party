import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getMinigame } from '@/engine/registry'
import { RoundScreen } from '@/engine/RoundScreen'
import {
  DEFAULT_ROUND_SECONDS,
  DEFAULT_SPRINT_QUESTIONS,
  DIFFICULTIES,
  ROUND_FORMATS,
  ROUND_FORMAT_BLURBS,
  ROUND_FORMAT_LABELS,
  SCORING,
} from '@/engine/types'
import type { Difficulty, RoundFormat } from '@/engine/types'
import { randomSeed } from '@/logic'
import { Button, Card, Star } from '@/ui/primitives'
import { formatDuration, getBestTime, getHighScore, useProgress } from '@/store/progress'

const isDifficulty = (value: string | null): value is Difficulty =>
  value !== null && (DIFFICULTIES as readonly string[]).includes(value)

const isFormat = (value: string | null): value is RoundFormat =>
  value !== null && (ROUND_FORMATS as readonly string[]).includes(value)

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
  const progress = useProgress()

  // Seed, mode and difficulty live in the URL, so a round is shareable and a
  // disputed question can be reproduced exactly.
  const seedParam = params.get('seed')
  const difficultyParam = params.get('difficulty')
  const modeParam = params.get('mode')
  const difficulty: Difficulty = isDifficulty(difficultyParam) ? difficultyParam : 'medium'
  const format: RoundFormat = isFormat(modeParam) ? modeParam : 'time-attack'

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
    const formats = game.formats ?? ROUND_FORMATS
    const isSprint = format === 'sprint'
    const bestScore = getHighScore(game.id, difficulty, progress)
    const bestTime = getBestTime(game.id, difficulty, progress)
    const questions = game.sprintQuestions ?? DEFAULT_SPRINT_QUESTIONS
    const seconds = game.roundSeconds ?? DEFAULT_ROUND_SECONDS
    const penalty = game.sprintPenaltySeconds ?? SCORING.sprintPenaltySeconds

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
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft">Mode</h2>
          <div className="mt-3 flex flex-col gap-2">
            {formats.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setParam('mode', mode)}
                aria-pressed={mode === format}
                className={`chunky px-4 py-3 text-left
                  focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                  ${mode === format ? 'bg-space-blue text-white' : 'bg-card text-ink hover:bg-card-shade'}`}
              >
                <span className="block text-base font-bold">{ROUND_FORMAT_LABELS[mode]}</span>
                <span className="block text-sm font-medium opacity-90">
                  {ROUND_FORMAT_BLURBS[mode]}
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="bg-card text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-ink-soft">
            Your best on {difficulty}
          </p>
          <p className="shout mt-1 flex items-center justify-center gap-2 text-4xl text-coin tabular-nums">
            <Star earned className="h-7 w-7" />
            {isSprint ? (bestTime === null ? '—' : formatDuration(bestTime)) : bestScore}
          </p>
          <p className="mt-2 text-sm font-semibold text-ink-soft">
            {isSprint
              ? `${questions} questions against a stopwatch. You cannot move on until the answer is right, and every wrong attempt adds ${penalty} seconds. Beat your own time.`
              : `${seconds} seconds · +100 per correct answer, −50 for a wrong one, combo bonus for a streak. Beat your own record.`}
          </p>
        </Card>

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

        {game.Guide && (
          <Link to={`/guide/${game.id}`}>
            <Button variant="secondary" className="w-full">
              How to do these
            </Button>
          </Link>
        )}

        <Link to="/" className="self-center">
          <Button variant="ghost">Back to the course</Button>
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
        <span className="text-sm font-bold capitalize text-ink">
          {ROUND_FORMAT_LABELS[format]} · {difficulty}
        </span>
      </div>

      <RoundScreen
        game={game}
        difficulty={difficulty}
        format={format}
        seed={seedParam}
        onNewSeed={(seed) => setParam('seed', seed)}
      />
    </div>
  )
}
