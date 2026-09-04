/**
 * The 3 · 2 · 1 · GO before a round starts.
 *
 * Exists to stop the clock from starting while the player is still looking at
 * the button they pressed — in a timed mode the first second is the most
 * expensive one. Mounting the round only after GO means the stopwatch and the
 * countdown cannot disagree about when the round began.
 */

import { useEffect, useState } from 'react'

const STEPS = ['3', '2', '1', 'GO!'] as const

/** Milliseconds each number is on screen. */
const STEP_MS = 700

export interface CountdownProps {
  onDone: () => void
}

export function Countdown({ onDone }: CountdownProps) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (step >= STEPS.length) {
      onDone()
      return
    }
    const timer = window.setTimeout(() => setStep((previous) => previous + 1), STEP_MS)
    return () => window.clearTimeout(timer)
  }, [step, onDone])

  const label = STEPS[Math.min(step, STEPS.length - 1)] as string
  const isGo = label === 'GO!'

  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="assertive">
      <span
        // Keyed by step so the pop animation restarts on every number.
        key={step}
        className={`countdown-pop shout tabular-nums ${
          isGo ? 'text-8xl text-grass' : 'text-9xl text-coin'
        }`}
      >
        {label}
      </span>
    </div>
  )
}
