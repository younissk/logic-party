import { describe, expect, it } from 'vitest'
import { parseTerm, showTerm, type Signature } from '@/logic'
import {
  fillFirstHole,
  hole,
  holeCount,
  showSlot,
  slotComplete,
  slotToTerm,
  termToSlot,
  undoLast,
  type Slot,
} from './TermBuilder'

const SIG: Signature = { f: 2, g: 1, c: 0 }
const fn = (name: string, arity: number): Slot => ({
  kind: 'fn',
  name,
  args: Array.from({ length: arity }, hole),
})
const v = (name: string): Slot => ({ kind: 'var', name })

/** Play a sequence of palette taps. */
const build = (taps: Slot[]): Slot => taps.reduce((slot, tap) => fillFirstHole(slot, tap), hole())

describe('building prefix, one tap per symbol', () => {
  it('fills holes left to right', () => {
    const slot = build([fn('f', 2), fn('g', 1), v('x'), v('y')])
    expect(showSlot(slot)).toBe('f(g(x),y)')
    expect(slotComplete(slot)).toBe(true)
    expect(showTerm(slotToTerm(slot) as never)).toBe('f(g(x),y)')
  })

  it('counts the holes still open', () => {
    expect(holeCount(hole())).toBe(1)
    expect(holeCount(build([fn('f', 2)]))).toBe(2)
    expect(holeCount(build([fn('f', 2), v('x')]))).toBe(1)
    expect(holeCount(build([fn('f', 2), v('x'), v('y')]))).toBe(0)
  })

  it('has no term until the last hole is filled', () => {
    expect(slotToTerm(build([fn('f', 2), v('x')]))).toBeNull()
    expect(slotToTerm(hole())).toBeNull()
  })

  it('treats a constant as a symbol that opens no holes', () => {
    const slot = build([fn('c', 0)])
    expect(showSlot(slot)).toBe('c()')
    expect(slotComplete(slot)).toBe(true)
  })

  it('ignores a tap once the term is finished', () => {
    const done = build([v('x')])
    expect(showSlot(fillFirstHole(done, v('y')))).toBe('x')
  })
})

describe('undo', () => {
  it('takes back exactly the last tap, every time', () => {
    const taps = [fn('f', 2), fn('g', 1), v('x'), v('y')]
    // Undoing after each prefix must give the prefix before it.
    for (let count = 1; count <= taps.length; count++) {
      const after = build(taps.slice(0, count))
      const before = build(taps.slice(0, count - 1))
      expect([count, showSlot(undoLast(after))]).toEqual([count, showSlot(before)])
    }
  })

  it('does nothing to an empty builder', () => {
    expect(showSlot(undoLast(hole()))).toBe('◻')
  })
})

describe('termToSlot', () => {
  it('round-trips any term', () => {
    for (const source of ['x', 'f(x,y)', 'g(g(g(x)))', 'f(g(c()),f(x,c()))']) {
      const term = parseTerm(source, SIG)
      const slot = termToSlot(term)
      expect(holeCount(slot)).toBe(0)
      expect(showTerm(slotToTerm(slot) as never)).toBe(source)
    }
  })
})
