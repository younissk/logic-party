/**
 * A term, syntax-coloured.
 *
 * Variables keep one colour each, function symbols stay ink-dark, brackets and
 * commas recede — the same division `FormulaText` makes, for the same reason:
 * a term is a tree written flat, and the eye needs help finding the tree.
 *
 * The colour for a variable is shared with the propositional side of the app,
 * so `x` looks the same here as it does in a truth table.
 */

import type { ReactNode } from 'react'
import { showTerm, type Substitution, type Term } from '@/logic'
import { colourForVariable } from './FormulaText'

const PUNCTUATION_COLOUR = '#8b93b0'

/** Highlight one subterm inside a bigger one, by its printed text. */
export interface TermTextProps {
  term?: Term
  /** Pre-printed text, for when the string is the lesson (a flattened term). */
  text?: string
  className?: string
  /** Variables to draw struck through — used when a substitution consumes them. */
  faded?: readonly string[]
}

export function TermText({ term, text, className = '', faded = [] }: TermTextProps) {
  const source = text ?? (term === undefined ? '' : showTerm(term))
  return (
    <span className={`formula ${className}`}>{colourTerm(source, faded)}</span>
  )
}

/**
 * Colour a printed term.
 *
 * A name is a variable when it is *not* followed by an opening bracket, which
 * is exactly the printer's own convention: every function symbol prints its
 * brackets, constants included (`c()`). So the rule needs no signature.
 */
export function colourTerm(source: string, faded: readonly string[] = []): ReactNode[] {
  const nodes: ReactNode[] = []
  let index = 0
  let key = 0

  while (index < source.length) {
    const character = source[index] as string

    if (/[A-Za-z_]/.test(character)) {
      let end = index + 1
      while (end < source.length && /[A-Za-z0-9_']/.test(source[end] as string)) end++
      const name = source.slice(index, end)
      const isFunction = source[end] === '('
      nodes.push(
        isFunction ? (
          <span key={key++} className="font-bold">
            {name}
          </span>
        ) : (
          <span
            key={key++}
            className={`font-bold ${faded.includes(name) ? 'line-through opacity-50' : ''}`}
            style={{ color: colourForVariable(name) }}
          >
            {name}
          </span>
        ),
      )
      index = end
      continue
    }

    nodes.push(
      <span key={key++} style={{ color: PUNCTUATION_COLOUR }}>
        {character}
      </span>,
    )
    index++
  }

  return nodes
}

/** `t = t′`, both sides coloured. */
export function EquationText({
  left,
  right,
  arrow = '=',
  className = '',
}: {
  left: Term
  right: Term
  /** `=` for an equation, `→` for a rule. */
  arrow?: string
  className?: string
}) {
  return (
    <span className={`formula ${className}`}>
      {colourTerm(showTerm(left))}
      <span className="px-1.5 font-bold opacity-70">{arrow}</span>
      {colourTerm(showTerm(right))}
    </span>
  )
}

/** `{x ↦ f(y), z ↦ c()}`, with the variables coloured on both sides. */
export function SubstitutionText({
  sigma,
  className = '',
}: {
  sigma: Substitution
  className?: string
}) {
  const names = Object.keys(sigma).sort((a, b) => a.localeCompare(b))
  if (names.length === 0) {
    return (
      <span className={`formula ${className}`} aria-label="the empty substitution">
        {'{}'}
      </span>
    )
  }
  return (
    <span className={`formula ${className}`}>
      <span style={{ color: PUNCTUATION_COLOUR }}>{'{'}</span>
      {names.map((name, index) => (
        <span key={name}>
          {index > 0 && <span style={{ color: PUNCTUATION_COLOUR }}>, </span>}
          <span className="font-bold" style={{ color: colourForVariable(name) }}>
            {name}
          </span>
          <span className="px-1 opacity-70">↦</span>
          {colourTerm(showTerm(sigma[name] as Term))}
        </span>
      ))}
      <span style={{ color: PUNCTUATION_COLOUR }}>{'}'}</span>
    </span>
  )
}
