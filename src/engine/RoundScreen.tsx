/**
 * The chrome around every minigame: clock, score, combo, feedback and the
 * end-of-round scoreboard. Written once so a new minigame is only its own
 * question screen.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banner, Button, Card, Star } from '@/ui/primitives'
import { Confetti } from '@/ui/Confetti'
import { randomSeed } from '@/logic'
import { getHighScore, useProgress } from '@/store/progress'
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
  const progress = useProgress()

  // Confetti fires on a correct answer, and much harder on a new best.
  const [burst, setBurst] = useState(0)
  const [burstSize, setBurstSize] = useState(70)

  const correctCount = round.correctCount
  useEffect(() => {
    if (correctCount === 0) return
    setBurstSize(45)
    setBurst((previous) => previous + 1)
  }, [correctCount])

  const { isNewBest } = round
  useEffect(() => {
    if (!isNewBest) return
    setBurstSize(160)
    setBurst((previous) => previous + 1)
  }, [isNewBest])

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
    // The store already holds this round's score, so the previous best has to
    // come from the round itself when it was beaten.
    const best = getHighScore(game.id, difficulty, progress)

    return (
      <>
        <Confetti burst={burst} pieces={burstSize} />
        <Card className="text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-ink-soft">
            {round.isNewBest ? 'New personal best!' : "Time's up"}
          </p>

          <p className="shout mt-2 text-6xl text-coin">{round.points}</p>

          {round.isNewBest ? (
            <div className="mt-2 flex items-center justify-center gap-1 text-space-blue">
              <Star earned className="h-6 w-6" />
              <span className="font-bold">You beat your record</span>
              <Star earned className="h-6 w-6" />
            </div>
          ) : (
            <p className="mt-2 font-bold text-ink-soft">
              Best on {difficulty}: {best}
              {best > 0 && round.points < best && ` — ${best - round.points} short`}
            </p>
          )}

          <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
            <Tally label="Correct" value={`${round.correctCount}/${round.answered}`} />
            <Tally label="Best combo" value={`×${round.bestCombo}`} />
            <Tally
              label="Accuracy"
              value={
                round.answered === 0
                  ? '—'
                  : `${Math.round((round.correctCount / round.answered) * 100)}%`
              }
            />
          </dl>

          <p className="mt-4 text-xs font-semibold text-ink-soft">
            seed <code className="rounded-md bg-card-shade px-1.5 py-0.5">{seed}</code>
          </p>

          <div className="mt-5 flex flex-col gap-2">
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
      </>
    )
  }

  const { Screen } = game
  const timeIsShort = round.secondsLeft !== null && round.secondsLeft <= 10

  return (
    <div className="flex flex-col gap-4">
      <Confetti burst={burst} pieces={burstSize} />

      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="shout text-3xl text-coin tabular-nums">{round.points}</span>

          <div className="flex items-center gap-2">
            {round.combo >= 2 && (
              <span className="chunky pop-in bg-grass px-3 py-1 text-sm font-bold text-white">
                ×{round.combo} combo
              </span>
            )}
            {round.secondsLeft !== null && (
              <span
                className={`chunky flex h-10 min-w-14 items-center justify-center px-3 text-lg font-bold tabular-nums ${
                  timeIsShort ? 'bg-space-red text-white' : 'bg-card text-ink'
                }`}
                role="timer"
                aria-live="off"
              >
                {round.secondsLeft}
              </span>
            )}
          </div>
        </div>

        {round.secondsLeft !== null && (
          <div className="h-4 overflow-hidden rounded-full border-3 border-ink bg-card">
            <div
              className={`h-full transition-[width] duration-1000 ease-linear ${
                round.timeFraction > 0.5
                  ? 'bg-grass'
                  : round.timeFraction > 0.2
                    ? 'bg-coin'
                    : 'bg-space-red'
              }`}
              style={{ width: `${Math.max(0, round.timeFraction) * 100}%` }}
            />
          </div>
        )}

        {round.total !== null && (
          <p className="text-xs font-bold uppercase tracking-wider text-ink">
            Question {round.index + 1} of {round.total}
          </p>
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
            <div className="flex items-start justify-between gap-3">
              <p className="shout text-2xl">
                {round.verdict.correct ? '★ ' : '✗ '}
                {round.verdict.message}
              </p>
              {round.lastAward && (
                <span className="shout shrink-0 text-2xl tabular-nums">
                  {round.lastAward.points >= 0 ? '+' : ''}
                  {round.lastAward.points}
                </span>
              )}
            </div>

            {round.lastAward && round.lastAward.comboBonus > 0 && (
              <p className="text-sm font-bold">
                includes +{round.lastAward.comboBonus} combo bonus (×{round.lastAward.combo})
              </p>
            )}

            {round.verdict.detail && <p className="mt-2 text-sm font-medium">{round.verdict.detail}</p>}
            {game.explain && round.question !== null && (
              <p className="mt-1 text-sm font-medium opacity-90">{game.explain(round.question)}</p>
            )}
          </div>

          <Button variant="coin" className="mt-4 w-full" onClick={round.next} autoFocus>
            {round.format === 'time-attack' ? 'Next — clock is running' : 'Next question'}
          </Button>
        </Banner>
      ) : (
        <Button variant="ghost" className="self-center" onClick={round.reveal}>
          Skip — costs points
        </Button>
      )}
    </div>
  )
}

function Tally({ label, value }: { label: string; value: string }) {
  return (
    <div className="tile bg-card-shade px-1 py-2">
      <dt className="text-[0.6rem] font-bold uppercase tracking-wider text-ink-soft">{label}</dt>
      <dd className="text-lg font-bold tabular-nums text-ink">{value}</dd>
    </div>
  )
}
