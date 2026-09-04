/**
 * Formula rendering, with the minimum parentheses needed to round-trip
 * through `parse`.
 */

import type { Formula } from './ast'

export type Notation = 'unicode' | 'ascii' | 'words'

interface Glyphs {
  not: string
  and: string
  or: string
  implies: string
  iff: string
  top: string
  bottom: string
  /** Spaces around binary operators. Word notation needs them. */
  spaced: boolean
}

const NOTATIONS: Readonly<Record<Notation, Glyphs>> = {
  unicode: { not: '¬', and: '∧', or: '∨', implies: '→', iff: '↔', top: '⊤', bottom: '⊥', spaced: true },
  ascii: { not: '~', and: '&', or: '|', implies: '->', iff: '<->', top: '1', bottom: '0', spaced: true },
  words: { not: 'not ', and: 'and', or: 'or', implies: 'implies', iff: 'iff', top: 'true', bottom: 'false', spaced: true },
}

const PRECEDENCE: Readonly<Record<Formula['kind'], number>> = {
  iff: 1,
  implies: 2,
  or: 3,
  and: 4,
  not: 5,
  var: 6,
  const: 6,
}

const RIGHT_ASSOCIATIVE = new Set<Formula['kind']>(['implies', 'iff'])

export interface FormatOptions {
  notation?: Notation
  /** Parenthesise every binary node, however obvious. Useful for teaching precedence. */
  fullyParenthesized?: boolean
}

export function format(formula: Formula, options: FormatOptions = {}): string {
  const glyphs = NOTATIONS[options.notation ?? 'unicode']
  const full = options.fullyParenthesized ?? false

  const render = (f: Formula): string => {
    switch (f.kind) {
      case 'var':
        return f.name
      case 'const':
        return f.value ? glyphs.top : glyphs.bottom
      case 'not': {
        const inner = render(f.arg)
        const needsParens = PRECEDENCE[f.arg.kind] < PRECEDENCE.not
        return `${glyphs.not}${needsParens ? `(${inner})` : inner}`
      }
      default: {
        const op = glyphs[f.kind]
        const gap = glyphs.spaced ? ' ' : ''
        const left = wrap(f.left, f, 'left')
        const right = wrap(f.right, f, 'right')
        const body = `${left}${gap}${op}${gap}${right}`
        return full ? `(${body})` : body
      }
    }
  }

  const wrap = (child: Formula, parent: Formula, side: 'left' | 'right'): string => {
    const text = render(child)
    if (full) return text

    const childPrecedence = PRECEDENCE[child.kind]
    const parentPrecedence = PRECEDENCE[parent.kind]

    if (childPrecedence > parentPrecedence) return text
    if (childPrecedence < parentPrecedence) return `(${text})`

    // Equal precedence: parenthesise the side associativity would re-bracket.
    const rightAssociative = RIGHT_ASSOCIATIVE.has(parent.kind)
    const needsParens = rightAssociative ? side === 'left' : side === 'right'
    return needsParens ? `(${text})` : text
  }

  return render(formula)
}

/** Shorthand for the default rendering — used all over the UI. */
export const show = (formula: Formula): string => format(formula)
