/**
 * Drag tokens into labelled bins.
 *
 * The shape a judgement question should take once it stops being a checkbox
 * list: several things, several categories, and every thing has to end up
 * somewhere. Dragging keeps the whole board visible at once, which is what a
 * question like "which of these are unifiable" is really testing — you compare
 * them against each other, not one at a time.
 *
 * Hit testing is against live bounding boxes (see `Draggable`), so it works on
 * a phone. Tapping a placed token sends it back to the tray.
 */

import { useRef, type ReactNode } from 'react'
import { Draggable, Pop, Shakeable, useShake } from './motion'

export interface Bin<Id extends string> {
  id: Id
  label: string
  /** Tailwind classes for the bin's own colour. */
  style: string
}

export interface SortBoardProps<Id extends string> {
  bins: readonly Bin<Id>[]
  /** One entry per token, in a stable order. */
  tokens: readonly ReactNode[]
  /** Where each token currently sits; null while it is in the tray. */
  placed: readonly (Id | null)[]
  onPlace: (index: number, bin: Id | null) => void
  locked?: boolean
  /** The correct bin per token, revealed once locked. */
  solution?: readonly (Id | null)[]
  /** Columns for the bin grid. Two reads well on a phone. */
  columns?: 2 | 3
  /** Shown under the tray. */
  hint?: string
}

export function SortBoard<Id extends string>({
  bins,
  tokens,
  placed,
  onPlace,
  locked = false,
  solution,
  columns = 2,
  hint,
}: SortBoardProps<Id>) {
  const zones = useRef(new Map<string, HTMLElement | null>())
  const [shaking, shake] = useShake()

  const shown = locked && solution !== undefined ? placed : placed
  const remaining = shown.filter((bin) => bin === null).length

  const drop = (index: number, zone: string | null) => {
    if (locked) return
    const bin = bins.find((candidate) => candidate.id === zone)
    if (bin === undefined) {
      shake()
      return
    }
    onPlace(index, bin.id)
  }

  return (
    <div>
      <Shakeable shaking={shaking}>
        <div className="flex min-h-16 flex-wrap items-center justify-center gap-2 rounded-2xl border-3 border-dashed border-ink-soft/50 p-2">
          {tokens.map((token, index) =>
            shown[index] !== null ? null : (
              <Draggable
                key={index}
                zones={zones.current}
                disabled={locked}
                onDropped={(zone) => drop(index, zone)}
              >
                {token}
              </Draggable>
            ),
          )}
          {remaining === 0 && (
            <p className="text-sm font-semibold text-ink-soft">
              {locked ? 'All placed.' : 'All placed — check it.'}
            </p>
          )}
        </div>
      </Shakeable>

      {hint !== undefined && (
        <p className="mt-1 text-xs font-medium text-ink-soft">{hint}</p>
      )}

      <div className={`mt-2 grid gap-2 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {bins.map((bin) => (
          <div
            key={bin.id}
            ref={(element) => {
              zones.current.set(bin.id, element)
            }}
            className={`tile flex min-h-20 flex-col gap-1 border-3 p-2 ${bin.style}`}
          >
            <p className="text-[0.65rem] font-bold uppercase tracking-wider">{bin.label}</p>
            <div className="flex flex-wrap gap-1">
              {tokens.map((token, index) => {
                if (shown[index] !== bin.id) return null
                const right = locked && solution !== undefined && solution[index] === bin.id
                const wrong = locked && solution !== undefined && solution[index] !== bin.id
                return (
                  <Pop key={index}>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => onPlace(index, null)}
                      className={`rounded-md border-2 border-ink px-1 py-0.5
                        ${right ? 'bg-grass text-white' : wrong ? 'bg-space-red text-white' : 'bg-card'}`}
                    >
                      {token}
                    </button>
                  </Pop>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {locked && solution !== undefined && (
        <div className="mt-2 flex flex-col gap-1">
          {tokens.map((token, index) =>
            placed[index] === solution[index] ? null : (
              <p key={index} className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-md bg-card-shade px-1.5 py-0.5">{token}</span>
                <span className="text-ink-soft">
                  belongs in{' '}
                  <strong className="text-ink">
                    {bins.find((bin) => bin.id === solution[index])?.label ?? '—'}
                  </strong>
                </span>
              </p>
            ),
          )}
        </div>
      )}
    </div>
  )
}
