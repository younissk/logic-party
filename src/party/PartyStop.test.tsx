// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { AnyMinigame, MinigameScreenProps } from '@/engine/types'
import { cardById } from './cards'
import { PartyStop, type StopOutcome } from './PartyStop'

/**
 * A minigame that answers however the test tells it to.
 *
 * The point is the shell, not the exercise: Shield and Cash Out are the two
 * pieces of party logic that sit between a verdict and the payout, and both
 * are easiest to be sure of against a game whose answers are decided by the
 * test rather than by a solver.
 */
function stub(alwaysCorrect: boolean): AnyMinigame {
  return {
    id: 'stub',
    title: 'Stub',
    tagline: 'A stub.',
    topics: ['syntax'],
    icon: '🧪',
    generate: () => ({ n: 1 }),
    check: () => ({
      correct: alwaysCorrect,
      message: alwaysCorrect ? 'Right' : 'Wrong',
    }),
    solve: () => true,
    Screen: ({ submit, locked }: MinigameScreenProps<unknown, unknown>) => (
      <button type="button" disabled={locked} onClick={() => submit(true)}>
        answer
      </button>
    ),
  } as AnyMinigame
}

const click = (label: string | RegExp) => {
  const button = screen.getByText(label).closest('button') as HTMLButtonElement
  act(() => button.click())
}

describe('a party stop', () => {
  it('ends a Sudden Death stop on the first wrong answer', () => {
    const onDone = vi.fn<(outcome: StopOutcome) => void>()
    render(
      <PartyStop
        game={stub(false)}
        card={cardById('sudden-death')}
        difficulty="easy"
        seed="t1"
        onDone={onDone}
      />,
    )
    click('answer')
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone.mock.calls[0]?.[0].correct).toBe(0)
    expect(onDone.mock.calls[0]?.[0].asked).toBe(1)
  })

  it('a shield keeps the stop alive and counts the wrong one as right', () => {
    const onDone = vi.fn<(outcome: StopOutcome) => void>()
    render(
      <PartyStop
        game={stub(false)}
        card={cardById('sudden-death')}
        difficulty="easy"
        seed="t2"
        shielded
        onDone={onDone}
      />,
    )
    click('answer')
    // Still going, and the banner says what was spent.
    expect(onDone).not.toHaveBeenCalled()
    expect(screen.getByText(/Shield spent/)).toBeTruthy()

    // The next wrong answer is not forgiven, and ends the stop.
    click('Next question')
    click('answer')
    expect(onDone).toHaveBeenCalledTimes(1)
    // One forgiven, so one counted as correct.
    expect(onDone.mock.calls[0]?.[0].correct).toBe(1)
  })

  it('spends the shield only once', () => {
    const onDone = vi.fn<(outcome: StopOutcome) => void>()
    render(
      <PartyStop
        game={stub(false)}
        card={cardById('straight-up')}
        difficulty="easy"
        seed="t3"
        shielded
        onDone={onDone}
      />,
    )
    click('answer')
    click('Next question')
    click('answer')
    expect(screen.queryByText(/Shield spent/)).toBeNull()
    click('Next question')
    click('answer')
    click('Bank it')
    expect(onDone.mock.calls[0]?.[0].correct).toBe(1)
    expect(onDone.mock.calls[0]?.[0].asked).toBe(3)
  })

  it('offers a cash out only when one is held, and ends the stop with it', () => {
    const onDone = vi.fn<(outcome: StopOutcome) => void>()
    const onCashOut = vi.fn()
    const { rerender } = render(
      <PartyStop
        game={stub(true)}
        card={cardById('straight-up')}
        difficulty="easy"
        seed="t4"
        onDone={onDone}
      />,
    )
    expect(screen.queryByText(/Cash out/)).toBeNull()

    rerender(
      <PartyStop
        game={stub(true)}
        card={cardById('straight-up')}
        difficulty="easy"
        seed="t4"
        canCashOut
        onCashOut={onCashOut}
        onDone={onDone}
      />,
    )
    click('answer')
    click('Next question')
    click(/Cash out/)
    expect(onCashOut).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledTimes(1)
    // One banked, one asked — the stop stopped where it was told to.
    expect(onDone.mock.calls[0]?.[0].correct).toBe(1)
    expect(onDone.mock.calls[0]?.[0].asked).toBe(1)
  })

  it('always offers a skip, which counts as wrong', () => {
    // Several minigames refuse to submit an incomplete answer, so without
    // this a stop on one of them has no exit at all.
    const onDone = vi.fn<(outcome: StopOutcome) => void>()
    render(
      <PartyStop
        game={stub(true)}
        card={cardById('straight-up')}
        difficulty="easy"
        seed="t5"
        onDone={onDone}
      />,
    )
    click(/Skip this one/)
    expect(screen.getByText('Skipped')).toBeTruthy()
    click('Next question')
    expect(screen.getByText(/Skip this one/)).toBeTruthy()
  })

  it('runs a blindfold stop straight through without showing a verdict', () => {
    const onDone = vi.fn<(outcome: StopOutcome) => void>()
    render(
      <PartyStop
        game={stub(true)}
        card={cardById('blindfold')}
        difficulty="easy"
        seed="t6"
        onDone={onDone}
      />,
    )
    click('answer')
    expect(screen.queryByText('Right')).toBeNull()
    click('answer')
    click('answer')
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone.mock.calls[0]?.[0].correct).toBe(3)
  })
})
