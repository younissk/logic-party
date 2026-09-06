/**
 * The spin.
 *
 * A reel of minigame tiles that scrolls past a fixed pointer and eases to a
 * stop on the one that was already chosen. The choice is made by the seeded
 * run, never here — this only animates a decision that is already recorded, so
 * a spin cannot disagree with the run it belongs to.
 *
 * Which is also why it is honest to skip it: tapping during the spin lands it
 * immediately on the same tile.
 */

import { useEffect, useMemo, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { AnyMinigame } from '@/engine/types'
import { MINIGAMES } from '@/engine/registry'
import { makeRng } from '@/logic'

/** Tile width plus its gap, in pixels. Must match the classes below. */
const STRIDE = 88

/** How many tiles scroll past before the winner. Enough to read as a spin. */
const RUN_UP = 22

/** How long the reel takes to stop. */
const SPIN_MS = 2600

export interface WheelProps {
  /** The game the reel must land on. */
  winner: AnyMinigame
  /** Stable across re-renders — the reel is dealt from it. */
  seed: string
  onDone: () => void
}

export function Wheel({ winner, seed, onDone }: WheelProps) {
  const reduced = useReducedMotion()
  const settled = useRef(false)

  /** The tiles that scroll past, ending on the winner. */
  const tiles = useMemo(() => {
    const rng = makeRng(`wheel:${seed}`)
    const others = MINIGAMES.filter((game) => game.id !== winner.id)
    const filler = Array.from({ length: RUN_UP }, () => rng.pick(others))
    return [...filler, winner]
  }, [seed, winner])

  const target = -(tiles.length - 1) * STRIDE

  /**
   * Hand over the moment the reel lands, with no victory pause.
   *
   * A background tab throttles timers to a crawl and stops delivering
   * animation frames, so a pause here is not a pause — it is a run that never
   * continues. The brief card that follows is the reveal anyway.
   */
  const finish = () => {
    if (settled.current) return
    settled.current = true
    onDone()
  }

  /**
   * Land the reel on a wall clock as well as on the animation.
   *
   * `onAnimationComplete` runs off requestAnimationFrame, which a browser
   * stops delivering to a hidden tab. Spin, switch tabs, come back, and the
   * animation callback has never fired — the run would sit on "Spinning…"
   * forever. `finish` is idempotent, so whichever arrives first wins.
   */
  useEffect(() => {
    const timer = window.setTimeout(finish, reduced ? 300 : SPIN_MS + 300)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm font-bold uppercase tracking-widest text-ink-soft">Spinning…</p>

      <button
        type="button"
        onClick={finish}
        aria-label="Stop the wheel"
        className="relative w-full overflow-hidden rounded-3xl bg-card-shade py-3"
      >
        {/* The pointer the reel lands under. */}
        <span className="pointer-events-none absolute inset-y-0 left-1/2 z-10 -ml-10 w-20 rounded-2xl border-4 border-coin" />

        <motion.div
          className="flex gap-2 pl-[calc(50%-40px)]"
          initial={{ x: 0 }}
          animate={{ x: reduced ? target : target }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: 'tween', ease: [0.12, 0.72, 0.16, 1], duration: SPIN_MS / 1000 }
          }
          onAnimationComplete={finish}
        >
          {tiles.map((game, index) => (
            <span
              key={`${game.id}:${index}`}
              className={`tile flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-0.5 ${
                index === tiles.length - 1 ? 'bg-coin' : 'bg-card'
              }`}
            >
              <span className="text-2xl leading-none">{game.icon}</span>
              <span className="line-clamp-2 px-1 text-center text-[10px] font-bold leading-tight text-ink-soft">
                {game.title}
              </span>
            </span>
          ))}
        </motion.div>
      </button>

      <p className="text-xs font-medium text-ink-soft">Tap the reel to stop it early.</p>
    </div>
  )
}
