/**
 * One stop of a party run.
 *
 * A thin shell around `useRound` rather than the full RoundScreen: a stop is
 * a few questions with a card's rules on top, and most of what a normal round
 * shows — high scores, replay, the scoreboard — belongs to the run instead.
 *
 * Everything the cards do is here:
 *
 *   capSeconds    a stop clock that ends the stop when it runs out
 *   stopOnWrong   the first wrong answer ends the stop
 *   hideFeedback  the verdict is never shown; the stop moves straight on
 *
 * Progress is recorded exactly as it is in a normal round. A party run is real
 * practice, and the topic stats should learn from it.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRound } from '@/engine/useRound'
import type { AnyMinigame, Difficulty } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { Confetti } from '@/ui/Confetti'
import { Pop, ProgressBar } from '@/ui/motion'
import type { RuleCard } from './cards'

export interface StopOutcome {
  correct: number
  asked: number
  elapsedMs: number
}

export interface PartyStopProps {
  game: AnyMinigame
  card: RuleCard
  difficulty: Difficulty
  seed: string
  /** A Shield was armed for this stop. */
  shielded?: boolean
  /** A Cash Out is held, so the stop may be ended early. */
  canCashOut?: boolean
  /** Called when the Cash Out is actually spent. */
  onCashOut?: () => void
  onDone: (outcome: StopOutcome) => void
}

export function PartyStop({
  game,
  card,
  difficulty,
  seed,
  shielded = false,
  canCashOut = false,
  onCashOut,
  onDone,
}: PartyStopProps) {
  const round = useRound({
    game,
    difficulty,
    format: 'sprint',
    seed,
    questionCount: card.questions,
    allowWrong: true,
  })

  const startedAt = useRef(Date.now())
  const [secondsLeft, setSecondsLeft] = useState<number | null>(card.capSeconds ?? null)
  const [burst, setBurst] = useState(0)
  const ended = useRef(false)

  /**
   * The Shield, and what it has already forgiven.
   *
   * A forgiven answer counts as correct — which is what lets a shielded stop
   * still be a clean one — so the count lives in a ref that `end` reads,
   * rather than being folded into the round's own tally.
   */
  const [shieldLeft, setShieldLeft] = useState(shielded ? 1 : 0)
  const [forgivenAt, setForgivenAt] = useState<number | null>(null)
  const forgiven = useRef(0)

  const end = useCallback(
    (correct: number, asked: number) => {
      if (ended.current) return
      ended.current = true
      onDone({
        correct: correct + forgiven.current,
        asked,
        elapsedMs: Date.now() - startedAt.current,
      })
    },
    [onDone],
  )

  // The stop clock, for the cards that have one.
  useEffect(() => {
    if (card.capSeconds === undefined) return
    const timer = window.setInterval(() => {
      setSecondsLeft((left) => (left === null ? null : Math.max(0, left - 1)))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [card.capSeconds])

  useEffect(() => {
    if (secondsLeft === 0) end(round.correctCount, round.answered)
  }, [secondsLeft, end, round.correctCount, round.answered])

  /**
   * React to a verdict — exactly once per question.
   *
   * Keyed on the question index rather than on the round object, which is a
   * new value every render: an effect that both depends on it and sets state
   * would re-run forever, and the confetti below does set state.
   */
  const handled = useRef(-1)
  const advance = useRef(round.next)
  advance.current = round.next

  useEffect(() => {
    if (round.verdict === null || handled.current === round.index) return
    handled.current = round.index

    if (round.verdict.correct) setBurst((count) => count + 1)

    // The counters are set in the same batch as the verdict, so by the time
    // this runs they already include this answer.
    const correct = round.correctCount
    const asked = round.answered

    // A Shield spends itself on the first wrong answer, which then counts as
    // right and cannot cut a Sudden Death stop short.
    const wrong = !round.verdict.correct
    const shielding = wrong && shieldLeft > 0
    if (shielding) {
      setShieldLeft(0)
      setForgivenAt(round.index)
      forgiven.current += 1
      setBurst((count) => count + 1)
    }

    // Sudden Death: the first wrong answer is the end of the stop.
    if (card.stopOnWrong === true && wrong && !shielding) {
      end(correct, asked)
      return
    }

    // Blindfold: there is nothing to read, so move straight on.
    //
    // Synchronously, not on a timer. A timer here can be cancelled by this
    // effect's own cleanup and then refused a reschedule by the guard above,
    // and the stop deadlocks with the verdict hidden and no control on screen.
    // The pause it bought was decorative; being unable to strand is not.
    if (card.hideFeedback === true) {
      if (round.index + 1 >= card.questions) end(correct, asked)
      else advance.current()
      return
    }
    return
  }, [round.verdict, round.index, round.correctCount, round.answered, card, end, shieldLeft])

  useEffect(() => {
    if (round.finished) end(round.correctCount, round.answered)
  }, [round.finished, end, round.correctCount, round.answered])

  const Screen = game.Screen
  const hide = card.hideFeedback === true

  return (
    <div className="flex flex-col gap-3">
      <Confetti burst={burst} pieces={40} />

      <div className="flex items-center justify-between gap-2 text-sm font-bold">
        <span className="flex items-center gap-1.5">
          <span className="text-lg leading-none">{card.icon}</span>
          {card.name}
        </span>
        <span className="tabular-nums text-ink-soft">
          {shieldLeft > 0 && <span className="mr-2">🛡️</span>}
          {Math.min(round.index + 1, card.questions)} / {card.questions}
          {secondsLeft !== null && (
            <span className={`ml-2 ${secondsLeft <= 5 ? 'text-space-red' : ''}`}>
              {secondsLeft}s
            </span>
          )}
        </span>
      </div>

      {secondsLeft !== null && card.capSeconds !== undefined && (
        <ProgressBar value={secondsLeft} total={card.capSeconds} />
      )}

      {round.error !== null ? (
        <Card className="bg-space-red/15">
          <p className="text-sm font-bold">{round.error}</p>
          <Button
            variant="secondary"
            className="mt-2 w-full"
            onClick={() => end(round.correctCount, round.answered)}
          >
            Move on
          </Button>
        </Card>
      ) : (
        round.question !== null && (
          <Screen
            question={round.question}
            difficulty={difficulty}
            submit={round.submit}
            locked={round.locked}
            verdict={hide ? null : round.verdict}
            solution={hide ? null : round.solution}
          />
        )
      )}

      {round.verdict === null && round.question !== null && (
        <div className="flex flex-col gap-1">
          <Button variant="ghost" className="w-full !min-h-10 !text-sm" onClick={round.reveal}>
            Skip this one — counts as wrong
          </Button>
          {canCashOut && (
            <Button
              variant="secondary"
              className="w-full !min-h-10 !text-sm"
              onClick={() => {
                onCashOut?.()
                end(round.correctCount, round.answered)
              }}
            >
              💰 Cash out — keep the {round.correctCount} you have
            </Button>
          )}
        </div>
      )}

      {!hide && round.verdict !== null && (
        <Pop
          className={`tile p-3 ${
            round.verdict.correct || forgivenAt === round.index
              ? 'bg-grass text-white'
              : 'bg-space-red text-white'
          }`}
        >
          <p className="text-base font-black">
            {forgivenAt === round.index
              ? '🛡️ Shield spent — that one counts as right'
              : round.verdict.message}
          </p>
          {round.verdict.detail !== undefined && (
            <p className="mt-1 text-sm font-medium opacity-90">{round.verdict.detail}</p>
          )}
          <Button
            variant="coin"
            className="mt-2 w-full"
            onClick={() => {
              if (round.index + 1 >= card.questions) end(round.correctCount, round.answered)
              else round.next()
            }}
          >
            {round.index + 1 >= card.questions ? 'Bank it' : 'Next question'}
          </Button>
        </Pop>
      )}
    </div>
  )
}
