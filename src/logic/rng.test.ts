import { describe, expect, it } from 'vitest'
import { deriveSeed, makeRng, randomSeed } from './rng'

describe('makeRng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng('exam')
    const b = makeRng('exam')
    const drawA = Array.from({ length: 50 }, () => a.next())
    const drawB = Array.from({ length: 50 }, () => b.next())
    expect(drawA).toEqual(drawB)
  })

  it('decorrelates short, similar seeds', () => {
    const first = Array.from({ length: 10 }, (_, i) => makeRng(String(i)).next())
    expect(new Set(first).size).toBe(10)
  })

  it('stays inside its bounds', () => {
    const rng = makeRng('bounds')
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(5)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(5)

      const r = rng.range(3, 7)
      expect(r).toBeGreaterThanOrEqual(3)
      expect(r).toBeLessThanOrEqual(7)
    }
  })

  it('shuffles without mutating or losing elements', () => {
    const rng = makeRng('shuffle')
    const source = [1, 2, 3, 4, 5, 6, 7, 8]
    const shuffled = rng.shuffle(source)
    expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...shuffled].sort((a, b) => a - b)).toEqual(source)
  })

  it('samples distinct elements', () => {
    const rng = makeRng('sample')
    const picked = rng.sample(['a', 'b', 'c', 'd'], 3)
    expect(picked).toHaveLength(3)
    expect(new Set(picked).size).toBe(3)
    expect(rng.sample(['a', 'b'], 99)).toHaveLength(2)
  })

  it('rejects empty and non-positive bounds', () => {
    const rng = makeRng('errors')
    expect(() => rng.pick([])).toThrow(RangeError)
    expect(() => rng.int(0)).toThrow(RangeError)
  })

  it('derives stable child seeds', () => {
    expect(deriveSeed('abc', 'round', 3)).toBe('abc:round:3')
    expect(makeRng(deriveSeed('abc', 3)).next()).toBe(makeRng(deriveSeed('abc', 3)).next())
  })

  it('generates seeds without look-alike characters', () => {
    for (let i = 0; i < 100; i++) {
      expect(randomSeed()).toMatch(/^[abcdefghijkmnopqrstuvwxyz23456789]{8}$/)
    }
  })
})
