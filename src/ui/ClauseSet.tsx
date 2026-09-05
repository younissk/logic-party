/**
 * A clause set, and the pick-one-of-these control the solving games share.
 *
 * The empty formula and the empty clause are the two answers those games turn
 * on, and both are easy to render as "nothing at all" by accident — so they
 * get explicit, labelled treatment here rather than in four separate screens.
 */

import type { Clause } from '@/logic'
import { ClauseText } from './ClauseText'
import { Button } from './primitives'

export function ClauseSetText({ set, className = '' }: { set: readonly Clause[]; className?: string }) {
  if (set.length === 0) {
    return (
      <span className={`formula font-bold ${className}`} aria-label="the empty formula">
        ⊤ <span className="text-xs font-semibold opacity-70">(empty formula)</span>
      </span>
    )
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 ${className}`}>
      {set.map((clause, index) => (
        <span key={index} className="inline-flex items-center gap-1.5">
          {index > 0 && <span className="formula text-ink-soft">∧</span>}
          <span className="formula">
            (<ClauseText clause={clause} />)
          </span>
        </span>
      ))}
    </span>
  )
}

/** The clause set laid out one clause per line, for a set you have to read carefully. */
export function ClauseList({ set, className = '' }: { set: readonly Clause[]; className?: string }) {
  if (set.length === 0) {
    return <p className={`formula text-base font-bold ${className}`}>⊤ — the empty formula</p>
  }
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {set.map((clause, index) => (
        <div key={index} className="rounded-xl bg-card-shade px-3 py-1.5">
          <ClauseText clause={clause} className="text-base font-bold" />
        </div>
      ))}
    </div>
  )
}

export interface ClauseSetChoiceProps {
  options: readonly Clause[][]
  /** Index of the right answer, revealed once locked. */
  solution: number | null
  locked: boolean
  onPick: (index: number) => void
}

export function ClauseSetChoice({ options, solution, locked, onPick }: ClauseSetChoiceProps) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {options.map((option, index) => {
        const isAnswer = locked && solution === index
        return (
          <Button
            key={index}
            variant={isAnswer ? 'primary' : 'secondary'}
            disabled={locked}
            onClick={() => onPick(index)}
            className={`w-full items-start py-3 text-left
              ${isAnswer ? 'revealed' : ''} ${locked && !isAnswer ? 'opacity-50' : ''}`}
          >
            <ClauseSetText set={option} className="text-[0.95rem] font-bold" />
          </Button>
        )
      })}
    </div>
  )
}
