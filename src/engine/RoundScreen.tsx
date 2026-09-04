/**
 * The chrome around every minigame: progress, timer, score, feedback and
 * the end-of-round summary. Written once so a new minigame is only its
 * own question screen.
 */

import { Link } from 'react-router-dom'
import { Button, Card } from '@/ui/primitives'
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
      <Card className="border-rose-800 bg-rose-950/40">
        <h2 className="font-semibold text-rose-200">Something went wrong</h2>
        <p className="mt-2 text-sm text-rose-200/80">{round.error}</p>
        <Button className="mt-4" onClick={() => onNewSeed(randomSeed())}>
          Try another round
        </Button>
      </Card>
    )
  }

  if (round.finished) {
    const percentage = Math.round((round.score / round.total) * 100)
    return (
      <Card className="text-center">
        <p className="text-sm uppercase tracking-widest text-slate-400">Round complete</p>
        <p className="mt-3 text-5xl font-bold text-indigo-300">{percentage}%</p>
        <p className="mt-2 text-sm text-slate-400">
          {round.correctCount} of {round.total} correct · seed{' '}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">{seed}</code>
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => onNewSeed(randomSeed())}>Play again</Button>
          <Button variant="secondary" onClick={() => round.restart()}>
            Retry this seed
          </Button>
          <Link to="/">
            <Button variant="ghost">Back to games</Button>
          </Link>
        </div>
      </Card>
    )
  }

  const { Screen } = game
  const timeIsShort = round.secondsLeft !== null && round.secondsLeft <= 5

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" aria-label={`Question ${round.index + 1} of ${round.total}`}>
          {Array.from({ length: round.total }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full ${
                i < round.index ? 'bg-indigo-500' : i === round.index ? 'bg-indigo-300' : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        {round.secondsLeft !== null && (
          <span
            className={`tabular-nums text-sm font-semibold ${timeIsShort ? 'text-rose-400' : 'text-slate-400'}`}
            role="timer"
            aria-live="off"
          >
            {round.secondsLeft}s
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
        <Card
          className={
            round.verdict.correct
              ? 'border-emerald-700 bg-emerald-950/40'
              : 'border-rose-800 bg-rose-950/40'
          }
        >
          <div aria-live="polite">
            <p
              className={`font-semibold ${
                round.verdict.correct ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {round.verdict.correct ? '✓ ' : '✗ '}
              {round.verdict.message}
            </p>
            {round.verdict.detail && (
              <p className="mt-1 text-sm text-slate-300">{round.verdict.detail}</p>
            )}
            {game.explain && round.question !== null && (
              <p className="mt-2 text-sm text-slate-400">{game.explain(round.question)}</p>
            )}
          </div>
          <Button className="mt-4 w-full" onClick={round.next} autoFocus>
            {round.index + 1 >= round.total ? 'See results' : 'Next question'}
          </Button>
        </Card>
      ) : (
        <Button variant="ghost" className="self-center" onClick={round.reveal}>
          Skip — show me the answer
        </Button>
      )}
    </div>
  )
}
