/**
 * Formula parser.
 *
 * Accepts the notation students actually type, in every dialect their lecture
 * slides might use: unicode (¬ ∧ ∨ → ↔), ASCII (~ & | -> <->), LaTeX-ish
 * (/\ \/), C-ish (! && ||) and English words (not, and, or, implies, iff).
 *
 * Precedence, tightest first:  ¬  >  ∧  >  ∨  >  →  >  ↔
 * → and ↔ associate to the right; ∧ and ∨ to the left.
 *
 * Note: bare `T` and `F` are VARIABLES, not constants. Write ⊤/⊥, true/false
 * or 1/0 for the constants — otherwise a formula over variables T and F
 * silently changes meaning.
 */

import type { Formula } from './ast'
import { and, FALSE, iff, implies, not, or, TRUE, v } from './ast'

export class ParseError extends Error {
  constructor(
    message: string,
    readonly position: number,
    readonly source: string,
  ) {
    super(message)
    this.name = 'ParseError'
  }

  /** Multi-line rendering with a caret under the offending character. */
  annotated(): string {
    return `${this.source}\n${' '.repeat(Math.max(0, this.position))}^\n${this.message}`
  }
}

type TokenType = 'var' | 'const' | 'not' | 'and' | 'or' | 'implies' | 'iff' | '(' | ')' | 'eof'

interface Token {
  type: TokenType
  text: string
  position: number
  value?: boolean
}

const SYMBOLS: ReadonlyArray<readonly [string, TokenType]> = [
  // Longest first — '<->' must win over '<' and '->'.
  ['<->', 'iff'],
  ['<=>', 'iff'],
  ['↔', 'iff'],
  ['≡', 'iff'],
  ['->', 'implies'],
  ['=>', 'implies'],
  ['→', 'implies'],
  ['⊃', 'implies'],
  ['/\\', 'and'],
  ['\\/', 'or'],
  ['&&', 'and'],
  ['||', 'or'],
  ['&', 'and'],
  ['∧', 'and'],
  ['·', 'and'],
  ['|', 'or'],
  ['∨', 'or'],
  ['+', 'or'],
  ['¬', 'not'],
  ['~', 'not'],
  ['!', 'not'],
  ['(', '('],
  ['[', '('],
  [')', ')'],
  [']', ')'],
]

const WORDS: Readonly<Record<string, TokenType>> = {
  not: 'not',
  and: 'and',
  or: 'or',
  implies: 'implies',
  iff: 'iff',
}

const CONSTANTS: Readonly<Record<string, boolean>> = {
  '⊤': true,
  '⊥': false,
  true: true,
  false: false,
  '1': true,
  '0': false,
}

const isVarStart = (c: string) => /[A-Za-z]/.test(c)
const isVarPart = (c: string) => /[A-Za-z0-9_'₀-₉]/.test(c)

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < source.length) {
    const c = source[i] as string

    if (/\s/.test(c)) {
      i++
      continue
    }

    const constant = CONSTANTS[c]
    if (constant !== undefined) {
      tokens.push({ type: 'const', text: c, position: i, value: constant })
      i++
      continue
    }

    const symbol = SYMBOLS.find(([text]) => source.startsWith(text, i))
    if (symbol) {
      tokens.push({ type: symbol[1], text: symbol[0], position: i })
      i += symbol[0].length
      continue
    }

    if (isVarStart(c)) {
      const start = i
      while (i < source.length && isVarPart(source[i] as string)) i++
      const text = source.slice(start, i)
      const lower = text.toLowerCase()

      const word = WORDS[lower]
      if (word) {
        tokens.push({ type: word, text, position: start })
        continue
      }

      const wordConstant = CONSTANTS[lower]
      if (wordConstant !== undefined) {
        tokens.push({ type: 'const', text, position: start, value: wordConstant })
        continue
      }

      tokens.push({ type: 'var', text, position: start })
      continue
    }

    throw new ParseError(`Unexpected character ${JSON.stringify(c)}`, i, source)
  }

  tokens.push({ type: 'eof', text: '', position: source.length })
  return tokens
}

/** Parse a formula, or throw ParseError. */
export function parse(source: string): Formula {
  const tokens = tokenize(source)
  let pos = 0

  const peek = (): Token => tokens[pos] as Token
  const advance = (): Token => tokens[pos++] as Token

  const fail = (message: string, token: Token): never => {
    throw new ParseError(message, token.position, source)
  }

  const expect = (type: TokenType, what: string): Token => {
    const token = peek()
    if (token.type !== type) {
      fail(`Expected ${what}${token.type === 'eof' ? ' but the formula ended' : ` but found "${token.text}"`}`, token)
    }
    return advance()
  }

  // ¬ and atoms
  const parseUnary = (): Formula => {
    const token = peek()

    if (token.type === 'not') {
      advance()
      return not(parseUnary())
    }

    if (token.type === '(') {
      advance()
      const inner = parseIff()
      expect(')', 'a closing parenthesis')
      return inner
    }

    if (token.type === 'var') {
      advance()
      return v(token.text)
    }

    if (token.type === 'const') {
      advance()
      return token.value ? TRUE : FALSE
    }

    return fail(
      token.type === 'eof'
        ? 'Expected a formula but the input ended'
        : `Expected a variable, constant or "(" but found "${token.text}"`,
      token,
    )
  }

  // Left-associative levels.
  const parseAnd = (): Formula => {
    let left = parseUnary()
    while (peek().type === 'and') {
      advance()
      left = and(left, parseUnary())
    }
    return left
  }

  const parseOr = (): Formula => {
    let left = parseAnd()
    while (peek().type === 'or') {
      advance()
      left = or(left, parseAnd())
    }
    return left
  }

  // Right-associative levels.
  const parseImplies = (): Formula => {
    const left = parseOr()
    if (peek().type === 'implies') {
      advance()
      return implies(left, parseImplies())
    }
    return left
  }

  const parseIff = (): Formula => {
    const left = parseImplies()
    if (peek().type === 'iff') {
      advance()
      return iff(left, parseIff())
    }
    return left
  }

  if (peek().type === 'eof') {
    throw new ParseError('Empty formula', 0, source)
  }

  const formula = parseIff()
  const trailing = peek()
  if (trailing.type !== 'eof') {
    fail(`Unexpected "${trailing.text}" after the end of the formula`, trailing)
  }
  return formula
}

export type ParseResult =
  | { ok: true; formula: Formula }
  | { ok: false; message: string; position: number }

/** Non-throwing parse — what UI input fields should use. */
export function tryParse(source: string): ParseResult {
  try {
    return { ok: true, formula: parse(source) }
  } catch (error) {
    if (error instanceof ParseError) {
      return { ok: false, message: error.message, position: error.position }
    }
    throw error
  }
}
