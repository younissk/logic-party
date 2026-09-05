/**
 * A clause, syntax-coloured, in the set notation the course uses.
 *
 * Goes through `FormulaText` so a variable keeps the same colour it has
 * everywhere else in the app, and the empty clause renders as □ rather than as
 * nothing at all.
 */

import type { Clause } from '@/logic'
import { FormulaText } from './FormulaText'

export function ClauseText({ clause, className = '' }: { clause: Clause; className?: string }) {
  if (clause.length === 0) {
    return (
      <span className={`formula font-bold ${className}`} aria-label="the empty clause">
        □
      </span>
    )
  }

  return (
    <FormulaText
      text={clause.map((literal) => `${literal.negated ? '¬' : ''}${literal.name}`).join(' ∨ ')}
      className={className}
    />
  )
}
