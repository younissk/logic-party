/**
 * A first-order formula, syntax-coloured.
 *
 * Variables keep the colour they have everywhere else in the app, predicate and
 * function symbols stay ink-dark, and brackets recede. Quantifiers are drawn a
 * shade stronger than the connectives because where a quantifier sits is the
 * whole difficulty of the chapter.
 */

import type { ReactNode } from 'react'
import { showFormula, showFoClause, showFoLiteral, type FoClause, type FoFormula, type FoLiteral } from '@/logic'
import { colourForVariable } from './FormulaText'

const PUNCTUATION = '#8b93b0'
const QUANTIFIER = '#7038c8'
const CONNECTIVE = '#4b5563'

/**
 * Colour a printed formula.
 *
 * A name followed by `(` is a symbol, anything else is a variable — the
 * printer always brackets function and predicate symbols, constants included,
 * so the rule needs no signature. The one exception is a quantified variable,
 * which follows ∀ or ∃ directly.
 */
export function colourFormula(source: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let index = 0
  let key = 0
  let afterQuantifier = false

  while (index < source.length) {
    const character = source[index] as string

    if (/[A-Za-z_]/.test(character)) {
      let end = index + 1
      while (end < source.length && /[A-Za-z0-9_']/.test(source[end] as string)) end++
      const name = source.slice(index, end)
      const isSymbol = source[end] === '(' && !afterQuantifier
      nodes.push(
        isSymbol ? (
          <span key={key++} className="font-bold">
            {name}
          </span>
        ) : (
          <span key={key++} className="font-bold" style={{ color: colourForVariable(name) }}>
            {name}
          </span>
        ),
      )
      afterQuantifier = false
      index = end
      continue
    }

    if (character === '∀' || character === '∃') {
      nodes.push(
        <span key={key++} className="font-bold" style={{ color: QUANTIFIER }}>
          {character}
        </span>,
      )
      afterQuantifier = true
      index++
      continue
    }

    const colour = '∧∨→↔¬'.includes(character) ? CONNECTIVE : PUNCTUATION
    nodes.push(
      <span key={key++} style={{ color: colour }}>
        {character}
      </span>,
    )
    index++
  }

  return nodes
}

export type FoTextProps = { className?: string } & (
  | { formula: FoFormula; text?: undefined }
  | { text: string; formula?: undefined }
)

export function FoText({ formula, text, className = '' }: FoTextProps) {
  const source = text ?? (formula === undefined ? '' : showFormula(formula))
  return <span className={`formula ${className}`}>{colourFormula(source)}</span>
}

/** A first-order clause, with □ for the empty one. */
export function FoClauseText({ clause, className = '' }: { clause: FoClause; className?: string }) {
  if (clause.length === 0) {
    return (
      <span className={`formula font-bold ${className}`} aria-label="the empty clause">
        □
      </span>
    )
  }
  return <FoText text={showFoClause(clause)} className={className} />
}

export function FoLiteralText({
  literal,
  className = '',
}: {
  literal: FoLiteral
  className?: string
}) {
  return <FoText text={showFoLiteral(literal)} className={className} />
}
