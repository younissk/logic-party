import { describe, expect, it } from 'vitest'
import { parse } from './parse'
import { format } from './print'

const roundTrip = (source: string) => format(parse(source))

describe('format', () => {
  it('omits parentheses that precedence already implies', () => {
    expect(roundTrip('(¬p) ∧ q')).toBe('¬p ∧ q')
    expect(roundTrip('(p ∧ q) ∨ r')).toBe('p ∧ q ∨ r')
    expect(roundTrip('(p ∨ q) → r')).toBe('p ∨ q → r')
  })

  it('keeps parentheses that change the reading', () => {
    expect(roundTrip('p ∧ (q ∨ r)')).toBe('p ∧ (q ∨ r)')
    expect(roundTrip('¬(p ∧ q)')).toBe('¬(p ∧ q)')
    expect(roundTrip('(p → q) → r')).toBe('(p → q) → r')
    expect(roundTrip('(p ∧ q) ∧ r')).toBe('p ∧ q ∧ r')
    expect(roundTrip('p ∧ (q ∧ r)')).toBe('p ∧ (q ∧ r)')
  })

  it('renders ascii and word notation', () => {
    expect(format(parse('p ∧ ¬q → r'), { notation: 'ascii' })).toBe('p & ~q -> r')
    expect(format(parse('p ∧ ¬q'), { notation: 'words' })).toBe('p and not q')
  })

  it('can show every parenthesis, for teaching precedence', () => {
    expect(format(parse('p ∧ q ∨ r'), { fullyParenthesized: true })).toBe('((p ∧ q) ∨ r)')
  })
})
