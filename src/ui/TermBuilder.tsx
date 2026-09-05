/**
 * Build a term by tapping symbols.
 *
 * Construction is top-down and prefix: tapping a function symbol drops it into
 * the leftmost hole and opens one new hole per argument, tapping a variable
 * fills a hole outright. Which is the comma-less reading of Exercise 4 run
 * backwards — the arity of each symbol says how many terms must follow it, so
 * the brackets are never typed and can never be typed wrongly.
 *
 * A partial term is a `Slot`, not a `Term`: `Term` has no hole, and giving it
 * one to make an editor easier would put an impossible value inside the type
 * the whole logic core is built on.
 */

import { useMemo } from 'react'
import { app, showTerm, variable, type Signature, type Term } from '@/logic'
import { Button } from './primitives'
import { colourTerm } from './TermText'

export type Slot =
  | { kind: 'hole' }
  | { kind: 'var'; name: string }
  | { kind: 'fn'; name: string; args: Slot[] }

export const hole = (): Slot => ({ kind: 'hole' })

/** The character a hole prints as. Not a legal symbol, so it cannot collide. */
export const HOLE = '◻'

export function showSlot(slot: Slot): string {
  if (slot.kind === 'hole') return HOLE
  if (slot.kind === 'var') return slot.name
  return `${slot.name}(${slot.args.map(showSlot).join(',')})`
}

export const slotComplete = (slot: Slot): boolean =>
  slot.kind === 'var' || (slot.kind === 'fn' && slot.args.every(slotComplete))

/** The finished term, or null while a hole is still open. */
export function slotToTerm(slot: Slot): Term | null {
  if (slot.kind === 'hole') return null
  if (slot.kind === 'var') return variable(slot.name)
  const args: Term[] = []
  for (const child of slot.args) {
    const term = slotToTerm(child)
    if (term === null) return null
    args.push(term)
  }
  return app(slot.name, args)
}

export const termToSlot = (term: Term): Slot =>
  term.kind === 'var'
    ? { kind: 'var', name: term.name }
    : { kind: 'fn', name: term.name, args: term.args.map(termToSlot) }

/** How many holes are still open — what the "n to go" counter reads. */
export function holeCount(slot: Slot): number {
  if (slot.kind === 'hole') return 1
  if (slot.kind === 'var') return 0
  return slot.args.reduce((total, child) => total + holeCount(child), 0)
}

/** Fill the leftmost hole. Returns the same slot when there is none. */
export function fillFirstHole(slot: Slot, replacement: Slot): Slot {
  if (slot.kind === 'hole') return replacement
  if (slot.kind === 'var') return slot
  const args = [...slot.args]
  for (let index = 0; index < args.length; index++) {
    const child = args[index] as Slot
    if (holeCount(child) === 0) continue
    args[index] = fillFirstHole(child, replacement)
    return { kind: 'fn', name: slot.name, args }
  }
  return slot
}

/**
 * Undo the last placement.
 *
 * "Last" means the deepest, right-most filled node before the first hole —
 * which is exactly what a prefix build placed most recently. Rebuilding the
 * whole slot from a move list would be tidier, but this keeps the caller's
 * state to one value.
 */
export function undoLast(slot: Slot): Slot {
  if (slot.kind === 'hole') return slot
  if (slot.kind === 'var') return hole()
  const args = [...slot.args]
  // The last child that has anything in it.
  for (let index = args.length - 1; index >= 0; index--) {
    const child = args[index] as Slot
    if (child.kind === 'hole') continue
    const undone = undoLast(child)
    args[index] = undone
    return { kind: 'fn', name: slot.name, args }
  }
  // Every argument is a hole, so this node itself was the last placement.
  return hole()
}

export interface TermBuilderProps {
  signature: Signature
  /** Variable names offered on the palette. */
  variables: readonly string[]
  value: Slot
  onChange: (next: Slot) => void
  disabled?: boolean
  /** Shown above the palette. */
  label?: string
  /** Extra symbols to grey out, e.g. one the question forbids. */
  forbidden?: readonly string[]
}

export function TermBuilder({
  signature,
  variables,
  value,
  onChange,
  disabled = false,
  label,
  forbidden = [],
}: TermBuilderProps) {
  const symbols = useMemo(
    () => Object.keys(signature).sort((a, b) => a.localeCompare(b)),
    [signature],
  )
  const open = holeCount(value)
  const text = showSlot(value)

  const place = (slot: Slot) => {
    if (disabled || open === 0) return
    onChange(fillFirstHole(value, slot))
  }

  return (
    <div>
      {label !== undefined && (
        <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{label}</p>
      )}

      <div
        className="tile mt-1 flex min-h-14 items-center gap-2 bg-card-shade px-3 py-2"
        aria-live="polite"
      >
        <span className="formula break-all text-lg font-bold">
          {text === HOLE ? (
            <span className="opacity-40">{HOLE}</span>
          ) : (
            colourTerm(text)
          )}
        </span>
        {open > 0 && (
          <span className="ml-auto shrink-0 text-xs font-bold uppercase tracking-wider text-ink-soft">
            {open} to fill
          </span>
        )}
      </div>

      {!disabled && (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {symbols.map((name) => {
              const arity = signature[name] as number
              const off = forbidden.includes(name) || open === 0
              return (
                <button
                  key={name}
                  type="button"
                  disabled={off}
                  onClick={() =>
                    place({ kind: 'fn', name, args: Array.from({ length: arity }, hole) })
                  }
                  className={`chunky min-h-11 px-3 text-base font-bold disabled:opacity-40
                    focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                    ${off ? 'bg-card-shade text-ink-soft' : 'bg-card text-ink hover:bg-card-shade'}`}
                >
                  <span className="formula">{name}</span>
                  <span className="ml-1 text-[0.65rem] opacity-60">/{arity}</span>
                </button>
              )
            })}
            {variables.map((name) => {
              const off = forbidden.includes(name) || open === 0
              return (
                <button
                  key={name}
                  type="button"
                  disabled={off}
                  onClick={() => place({ kind: 'var', name })}
                  className={`chunky min-h-11 px-3 text-base font-bold disabled:opacity-40
                    focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                    ${off ? 'bg-card-shade text-ink-soft' : 'bg-coin text-ink hover:brightness-105'}`}
                >
                  <span className="formula">{name}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex gap-2">
            <Button
              variant="ghost"
              className="min-h-10 flex-1 px-3 text-sm"
              onClick={() => onChange(undoLast(value))}
            >
              ← Undo
            </Button>
            <Button
              variant="ghost"
              className="min-h-10 flex-1 px-3 text-sm"
              onClick={() => onChange(hole())}
            >
              Clear
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

/** For a verdict line: what the player built, printed. */
export const describeSlot = (slot: Slot): string => {
  const term = slotToTerm(slot)
  return term === null ? showSlot(slot) : showTerm(term)
}
