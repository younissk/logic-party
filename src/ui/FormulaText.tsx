/**
 * A formula, syntax-coloured.
 *
 * Every occurrence of a variable gets the same colour everywhere in the app —
 * `p` is always the same red — so the eye can follow one variable through a
 * nested formula and down a truth table without re-reading it each time.
 * Parentheses share a single muted colour, which lets them recede: they are
 * structure, not content.
 *
 * Colouring works off `tokenize`, the same tokenizer the parser uses, applied
 * to the printer's own output. That keeps one definition of what a variable
 * is, rather than a second regex here that could drift from the grammar.
 */

import { useMemo, type ReactNode } from 'react'
import type { Formula } from '@/logic'
import { format, tokenize } from '@/logic'

/**
 * Chosen for contrast on the cream card background and for being tellable
 * apart by the common forms of colour blindness — the hues are spread rather
 * than sitting in the red/green pair.
 */
const VARIABLE_COLOURS = [
  '#c81e0f', // red
  '#0069c0', // blue
  '#1f7a30', // green
  '#7038c8', // purple
  '#b45309', // amber
  '#0f766e', // teal
  '#be185d', // magenta
  '#4d5c0b', // olive
] as const

const PARENTHESIS_COLOUR = '#8b93b0'

/**
 * Stable per name, so a variable keeps its colour across every formula and
 * every screen. Adjacent letters land on different entries, which is what
 * matters for the p/q/r/s pools the generators actually use.
 */
export function colourForVariable(name: string): string {
  const sum = [...name].reduce((total, character) => total + character.charCodeAt(0), 0)
  return VARIABLE_COLOURS[sum % VARIABLE_COLOURS.length] as string
}

/**
 * Either an AST, printed with minimal parentheses, or text to colour as-is.
 *
 * `text` exists for the places where the brackets *are* the lesson. The
 * printer correctly drops (a ∧ b) ∨ (c ∧ d) to a ∧ b ∨ c ∧ d, because ∧ binds
 * tighter — but a page explaining that three conjunctions give 2³ clauses
 * needs the reader to see the three pairs.
 */
export type FormulaTextProps = { className?: string } & (
  | { formula: Formula; text?: undefined }
  | { text: string; formula?: undefined }
)

export function FormulaText({ formula, text, className = '' }: FormulaTextProps) {
  const printed = text ?? format(formula)

  const parts = useMemo((): ReactNode[] => {
    let tokens: ReturnType<typeof tokenize>
    try {
      tokens = tokenize(printed)
    } catch {
      // The printer produced something the tokenizer rejects — that would be a
      // bug, but showing the formula uncoloured beats showing nothing.
      return [printed]
    }

    const nodes: ReactNode[] = []
    let cursor = 0

    tokens.forEach((token, index) => {
      if (token.type === 'eof') return

      // Whitespace between tokens, preserved verbatim.
      if (token.position > cursor) nodes.push(printed.slice(cursor, token.position))
      cursor = token.position + token.text.length

      if (token.type === 'var') {
        nodes.push(
          <span key={index} style={{ color: colourForVariable(token.text), fontWeight: 700 }}>
            {token.text}
          </span>,
        )
        return
      }

      if (token.type === '(' || token.type === ')') {
        nodes.push(
          <span key={index} style={{ color: PARENTHESIS_COLOUR }}>
            {token.text}
          </span>,
        )
        return
      }

      nodes.push(token.text)
    })

    if (cursor < printed.length) nodes.push(printed.slice(cursor))
    return nodes
  }, [printed])

  return (
    <span className={`formula ${className}`} aria-label={printed}>
      {parts}
    </span>
  )
}

/** A single variable name in its colour — for truth table headers. */
export function VariableName({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`formula font-bold ${className}`} style={{ color: colourForVariable(name) }}>
      {name}
    </span>
  )
}
