/**
 * The chrome around every minigame: progress stars, timer, feedback and the
 * end-of-round scoreboard. Written once so a new minigame is only its own
 * question screen.
 */

import { Link } from 'react-router-dom'
import { Banner, Button, Card, Star } from '@/ui/primitives'
import { randomSeed } from '@/logic'
import { useRound } from './useRound'
import type { AnyMinigame, Difficulty } from './types'

export interface RoundScreenProps {
  game: AnyMinigame
  difficulty: Difficulty
  seed: string
  onNewSeed: (seed: string) => void
}

export function RoundScreen({ game, difficulty, seed, onNewSeed }: RoundScreenProps) {
  const round = useRound({ game, difficulty, seed })

  if (round.error) {
    return (
      <Card className="bg-space-red text-white">
        <h2 className="text-lg font-bold">Something went wrong</h2>
        <p className="mt-2 text-sm">{round.error}</p>
        <Button variant="coin" className="mt-4" onClick={() => onNewSeed(randomSeed())}>
          Try another round
        </Button>
      </Card>
    )
  }

  if (round.finished) {
    const stars = Math.round(round.score)
    const percentage = Math.round((round.score / round.total) * 100)

    return (
      <Card className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Round complete
        </p>

        <div className="mt-3 flex justify-center gap-1">
          {Array.from({ length: round.total }, (_, i) => (
            <Star key={i} earned={i < stars} className="h-9 w-9" />
          ))}
        </div>

        <p className="shout mt-4 text-6xl text-coin">{percentage}%</p>
        <p className="mt-2 text-sm text-ink-soft">
          {round.correctCount} of {round.total} correct · seed{' '}
          <code className="rounded-md bg-card-shade px-1.5 py-0.5 text-xs">{seed}</code>
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Button variant="coin" onClick={() => onNewSeed(randomSeed())}>
            Play again
          </Button>
          <Button variant="secondary" onClick={() => round.restart()}>
            Retry this seed
          </Button>
          <Link to="/">
            <Button variant="ghost" className="w-full">
              Back to games
            </Button>
          </Link>
        </div>
      </Card>
    )
  }

  const { Screen } = game
  const timeIsShort = round.secondsLeft !== null && round.secondsLeft <= 10

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div
          className="flex items-center gap-0.5"
          aria-label={`Question ${round.index + 1} of ${round.total}`}
        >
          {Array.from({ length: round.total }, (_, i) => (
            <Star key={i} earned={i < round.index} className={i === round.index ? 'scale-125' : ''} />
          ))}
        </div>

        {round.secondsLeft !== null && (
          <span
            className={`chunky flex h-11 min-w-16 items-center justify-center px-3 text-lg font-bold tabular-nums ${
              timeIsShort ? 'bg-space-red text-white' : 'bg-card text-ink'
            }`}
            role="timer"
            aria-live="off"
          >
            {round.secondsLeft}
          </span>
        )}
      </header>

      <Screen
        question={round.question}
        difficulty={difficulty}
        submit={round.submit}
        locked={round.locked}
        verdict={round.verdict}
        solution={round.solution}
      />

      {round.verdict ? (
        <Banner tone={round.verdict.correct ? 'good' : 'bad'}>
          <div aria-live="polite" className="text-white">
            <p className="shout text-2xl">
              {round.verdict.correct ? '★ ' : '✗ '}
              {round.verdict.message}
            </p>
            {round.verdict.detail && <p className="mt-2 text-sm font-medium">{round.verdict.detail}</p>}
            {game.explain && round.question !== null && (
              <p className="mt-1 text-sm font-medium opacity-90">{game.explain(round.question)}</p>
            )}
          </div>
          <Button variant="coin" className="mt-4 w-full" onClick={round.next} autoFocus>
            {round.index + 1 >= round.total ? 'See results' : 'Next question'}
          </Button>
        </Banner>
      ) : (
        <Button variant="ghost" className="self-center" onClick={round.reveal}>
          Skip — show me the answer
        </Button>
      )}
    </div>
  )
}
