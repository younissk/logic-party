/**
 * Confetti cannons.
 *
 * Fires when `burst` changes value, so a parent triggers it by incrementing a
 * counter. Two cannons from the bottom corners firing inwards — the shape the
 * genre uses — with gravity, drag and tumbling.
 *
 * No dependency: a physics loop over a few hundred rectangles is smaller than
 * any confetti package, and this way the palette matches the board.
 */

import { useEffect, useRef } from 'react'

const COLOURS = ['#009bd9', '#e62310', '#fccf00', '#44af35', '#7b4bc9', '#ffffff']

const GRAVITY = 0.32
const DRAG = 0.988
/** Particles are culled once they fall this far below the viewport. */
const CULL_MARGIN = 40

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  width: number
  height: number
  rotation: number
  spin: number
  colour: string
}

export interface ConfettiProps {
  /** Increment to fire. Any change in value triggers a burst. */
  burst: number
  /** Particles per cannon. */
  pieces?: number
}

export function Confetti({ burst, pieces = 70 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particles = useRef<Particle[]>([])
  const frame = useRef<number | null>(null)

  useEffect(() => {
    // Never fired yet, or the user does not want animation.
    if (burst === 0) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const width = window.innerWidth
    const height = window.innerHeight

    canvas.width = width * ratio
    canvas.height = height * ratio
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context.setTransform(ratio, 0, 0, ratio, 0, 0)

    // Two cannons, bottom corners, angled inwards and up.
    for (const cannon of [
      { x: width * 0.08, direction: 1 },
      { x: width * 0.92, direction: -1 },
    ]) {
      for (let i = 0; i < pieces; i++) {
        const spread = 0.35 + Math.random() * 0.55
        const speed = 11 + Math.random() * 11
        particles.current.push({
          x: cannon.x,
          y: height + 10,
          vx: cannon.direction * speed * spread,
          vy: -speed * (0.85 + Math.random() * 0.5),
          width: 6 + Math.random() * 7,
          height: 9 + Math.random() * 8,
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.32,
          colour: COLOURS[Math.floor(Math.random() * COLOURS.length)] as string,
        })
      }
    }

    if (frame.current !== null) return // A loop is already running; it will pick these up.

    const step = () => {
      context.clearRect(0, 0, width, height)

      particles.current = particles.current.filter((p) => {
        p.vy += GRAVITY
        p.vx *= DRAG
        p.vy *= DRAG
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.spin

        context.save()
        context.translate(p.x, p.y)
        context.rotate(p.rotation)
        context.fillStyle = p.colour
        // Tumbling read: squash the width by the rotation phase.
        context.fillRect(-p.width / 2, -p.height / 2, p.width * Math.abs(Math.cos(p.rotation)), p.height)
        context.restore()

        return p.y < height + CULL_MARGIN
      })

      if (particles.current.length > 0) {
        frame.current = requestAnimationFrame(step)
      } else {
        context.clearRect(0, 0, width, height)
        frame.current = null
      }
    }

    frame.current = requestAnimationFrame(step)
  }, [burst, pieces])

  // Stop the loop if the round unmounts mid-flight.
  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
      particles.current = []
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50"
    />
  )
}
