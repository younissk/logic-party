/**
 * The chrome around every minigame: countdown, clock or stopwatch, score,
 * combo, feedback and the end-of-round scoreboard. Written once so a new
 * minigame is only its own question screen.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banner, Button, Card, Star } from '@/ui/primitives'
import { Confetti } from '@/ui/Confetti'
import { Countdown } from '@/ui/Countdown'
import { randomSeed } from '@/logic'
import { formatDuration, getBestTime, getHighScore, useProgress } from '@/store/progress'
import { useRound } from './useRound'
import type { AnyMinigame, Difficulty, RoundFormat } from './types'

export interface RoundScreenProps {
  game: AnyMinigame
  difficulty: Difficulty
  format: RoundFormat
  seed: string
  onNewSeed: (seed: string) => void
}

/**
 * Counts in, then hands over to the round.
 *
 * The round is mounted only after GO, so its clock starts at GO — nothing has
 * to be paused, and the two can never disagree about when the round began.
 */
export function RoundScreen(props: RoundScreenProps) {
  const [runId, setRunId] = useState(0)
  const [counting, setCounting] = useState(true)

  // A new seed, or a replay of the same one, counts in again.
  useEffect(() => {
    setCounting(true)
  }, [props.seed, runId])

  const done = useCallback(() => setCounting(false), [])

  if (counting) return <Countdown onDone={done} />

  return (
    <ActiveRound
      {...props}
      key={`${props.seed}:${runId}`}
      onReplay={() => setRunId((previous) => previous + 1)}
    />
  )
}

function ActiveRound({
  game,
  difficulty,
  format,
  seed,
  onNewSeed,
  onReplay,
}: RoundScreenProps & { onReplay: () => void }) {
  const round = useRound({ game, difficulty, format, seed })
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

  const isSprint = format === 'sprint'

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
    const best = isSprint
      ? getBestTime(game.id, difficulty, progress)
      : getHighScore(game.id, difficulty, progress)

    return (
      <>
        <Confetti burst={burst} pieces={burstSize} />
        <Card className="text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-ink-soft">
            {round.isNewBest ? 'New personal best!' : isSprint ? 'Finished' : "Time's up"}
          </p>

          <p className="shout mt-2 text-6xl text-coin tabular-nums">
            {isSprint && round.finalMs !== null ? formatDuration(round.finalMs) : round.points}
          </p>

          {round.isNewBest ? (
            <div className="mt-2 flex items-center justify-center gap-1 text-space-blue">
              <Star earned className="h-6 w-6" />
              <span className="font-bold">You beat your record</span>
              <Star earned className="h-6 w-6" />
            </div>
          ) : (
            <p className="mt-2 font-bold text-ink-soft">
              {isSprint
                ? best === null
                  ? 'No previous time'
                  : `Best on ${difficulty}: ${formatDuration(best)}`
                : `Best on ${difficulty}: ${best}`}
            </p>
          )}

          <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
            {isSprint ? (
              <>
                <Tally label="Solved" value={`${round.correctCount}`} />
                <Tally label="Mistakes" value={`${round.mistakes}`} />
                <Tally label="Penalty" value={`+${round.penaltySeconds}s`} />
              </>
            ) : (
              <>
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
              </>
            )}
          </dl>

          <p className="mt-4 text-xs font-semibold text-ink-soft">
            seed <code className="rounded-md bg-card-shade px-1.5 py-0.5">{seed}</code>
          </p>

          <div className="mt-5 flex flex-col gap-2">
            <Button variant="coin" onClick={() => onNewSeed(randomSeed())}>
              Play again
            </Button>
            <Button variant="secondary" onClick={onReplay}>
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
          {isSprint ? (
            <span className="text-sm font-bold uppercase tracking-wider text-ink">
              {Math.min(round.correctCount + 1, round.total ?? 0)} of {round.total}
            </span>
          ) : (
            <span className="shout text-3xl text-coin tabular-nums">{round.points}</span>
          )}

          <div className="flex items-center gap-2">
            {!isSprint && round.combo >= 2 && (
              <span className="chunky pop-in bg-grass px-3 py-1 text-sm font-bold text-white">
                ×{round.combo} combo
              </span>
            )}
            {isSprint && round.penaltySeconds > 0 && (
              <span className="chunky bg-space-red px-3 py-1 text-sm font-bold text-white">
                +{round.penaltySeconds}s
              </span>
            )}

            <span
              className={`chunky flex h-10 items-center justify-center px-3 text-lg font-bold tabular-nums ${
                timeIsShort ? 'bg-space-red text-white' : 'bg-card text-ink'
              }`}
              role="timer"
              aria-live="off"
            >
              {isSprint ? formatDuration(round.elapsedMs ?? 0) : (round.secondsLeft ?? 0)}
            </span>
          </div>
        </div>

        <div className="h-4 overflow-hidden rounded-full border-3 border-ink bg-card">
          {isSprint ? (
            <div
              className="h-full bg-space-blue transition-[width] duration-200"
              style={{ width: `${((round.correctCount / (round.total ?? 1)) * 100).toFixed(1)}%` }}
            />
          ) : (
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
          )}
        </div>
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
                  {isSprint
                    ? round.lastAward.penaltySeconds > 0
                      ? `+${round.lastAward.penaltySeconds}s`
                      : '✓'
                    : `${round.lastAward.points >= 0 ? '+' : ''}${round.lastAward.points}`}
                </span>
              )}
            </div>

            {!isSprint && round.lastAward && round.lastAward.comboBonus > 0 && (
              <p className="text-sm font-bold">
                includes +{round.lastAward.comboBonus} combo bonus (×{round.lastAward.combo})
              </p>
            )}

            {/*
              While the answer still has to be corrected, saying anything about
              *which* part was wrong would hand over the answer — on a boolean
              cell, "this one is wrong" is the answer.
            */}
            {round.awaitingRetry ? (
              <p className="mt-2 text-sm font-medium">
                Fix it to carry on. The stopwatch is still running.
              </p>
            ) : (
              <>
                {round.verdict.detail && (
                  <p className="mt-2 text-sm font-medium">{round.verdict.detail}</p>
                )}
                {game.explain && round.question !== null && (
                  <p className="mt-1 text-sm font-medium opacity-90">{game.explain(round.question)}</p>
                )}
              </>
            )}
          </div>

          <Button
            variant="coin"
            className="mt-4 w-full"
            onClick={round.awaitingRetry ? round.retry : round.next}
            autoFocus
          >
            {round.awaitingRetry
              ? 'Try again'
              : round.finalMs !== null
                ? 'See your time'
                : isSprint
                  ? 'Next — stopwatch is running'
                  : 'Next — clock is running'}
          </Button>
        </Banner>
      ) : (
        // Sprint has no skip: you cannot move on until the answer is right.
        !isSprint && (
          <Button variant="ghost" className="self-center" onClick={round.reveal}>
            Skip — costs points
          </Button>
        )
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
