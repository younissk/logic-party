/**
 * Movement primitives, so a minigame can be played rather than filled in.
 *
 * Everything here is DOM plus `motion` rather than a canvas engine. Formulas
 * are the content of this app, and on a canvas they would lose the per-variable
 * colouring, the font stack chosen for logic glyphs, text selection and screen
 * reader access — all of which the games are built on. What was actually
 * missing was not a renderer but *motion*: things that slide, snap, and can be
 * dragged.
 *
 * Every animation here is skipped under `prefers-reduced-motion`, which the
 * library honours through `MotionConfig` at the app root.
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/** A spring that settles quickly — the board-game "snap into place" feel. */
export const SNAP = { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 } as const

/** Slower and looser, for something arriving rather than being placed. */
export const DROP = { type: 'spring', stiffness: 320, damping: 26 } as const

/**
 * A list whose items animate as they are added, removed and reordered.
 *
 * `layout` is what makes this worth a library: when a clause is deleted, the
 * ones below it *travel* upwards rather than teleporting, so you can see what
 * happened. Doing that by hand means measuring before and after every render.
 */
export function MovingList({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </div>
  )
}

export function MovingItem({
  id,
  children,
  className = '',
  onClick,
  disabled = false,
}: {
  id: string
  children: ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
}) {
  const still = useReducedMotion()
  return (
    <motion.button
      key={id}
      layout={still ? false : 'position'}
      type="button"
      disabled={disabled}
      onClick={onClick}
      initial={still ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={still ? { opacity: 0 } : { opacity: 0, scale: 0.85, transition: { duration: 0.18 } }}
      transition={SNAP}
      className={className}
    >
      {children}
    </motion.button>
  )
}

/** A thing that pops when it appears — for a derived clause or a new line. */
export function Pop({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const still = useReducedMotion()
  return (
    <motion.div
      initial={still ? false : { scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...DROP, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * A short horizontal shake, for a move the rules do not allow.
 *
 * Refusing a move silently reads as a broken button; refusing it with a shake
 * reads as "not that one", which is the feedback a game gives.
 */
export function useShake(): [boolean, () => void] {
  const [shaking, setShaking] = useState(false)
  const timer = useRef<number | null>(null)

  const shake = useCallback(() => {
    setShaking(true)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShaking(false), 420)
  }, [])

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  return [shaking, shake]
}

export function Shakeable({
  shaking,
  children,
  className = '',
}: {
  shaking: boolean
  children: ReactNode
  className?: string
}) {
  const still = useReducedMotion()
  return (
    <motion.div
      animate={shaking && !still ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
      transition={{ duration: 0.38 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * A draggable token that reports which drop zone it was released over.
 *
 * Hit testing is done against the live bounding boxes rather than using the
 * HTML drag-and-drop API, which does not fire on touch — and this is a game
 * that has to work on a phone.
 */
export function Draggable({
  children,
  onDropped,
  zones,
  className = '',
  disabled = false,
}: {
  children: ReactNode
  /** Called with the id of the zone it was dropped on, or null. */
  onDropped: (zone: string | null) => void
  /** Live element refs for the drop zones, by id. */
  zones: Map<string, HTMLElement | null>
  className?: string
  disabled?: boolean
}) {
  const still = useReducedMotion()

  return (
    <motion.div
      drag={!disabled}
      dragSnapToOrigin
      dragElastic={0.18}
      dragMomentum={false}
      whileDrag={{ scale: 1.12, zIndex: 40, cursor: 'grabbing' }}
      transition={still ? { duration: 0 } : SNAP}
      onDragEnd={(_event, info) => {
        const { x, y } = info.point
        for (const [id, element] of zones) {
          if (element === null) continue
          const box = element.getBoundingClientRect()
          if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
            onDropped(id)
            return
          }
        }
        onDropped(null)
      }}
      className={`touch-none ${className}`}
    >
      {children}
    </motion.div>
  )
}

/** A meter that fills as the puzzle is solved — progress you can watch. */
export function ProgressBar({ value, total }: { value: number; total: number }) {
  const fraction = total === 0 ? 0 : Math.min(1, value / total)
  return (
    <div className="tile h-3 overflow-hidden bg-card-shade p-0">
      <motion.div
        className="h-full bg-grass"
        initial={false}
        animate={{ width: `${fraction * 100}%` }}
        transition={SNAP}
      />
    </div>
  )
}
