import { describe, expect, it } from 'vitest'
import {
  AVATAR_STYLES,
  TITLES,
  avatarUrl,
  levelFromXp,
  levelStanding,
  rollAvatar,
  titleForLevel,
  xpForAnswer,
  xpForLevel,
  xpToNextLevel,
  XP_FOR_TRYING,
} from './player'

describe('levels', () => {
  it('starts everyone at level 1', () => {
    expect(levelFromXp(0)).toBe(1)
    expect(levelFromXp(-5)).toBe(1)
    expect(levelFromXp(99)).toBe(1)
  })

  it('has xpForLevel and levelFromXp as exact inverses at every boundary', () => {
    for (let level = 1; level <= 40; level++) {
      const threshold = xpForLevel(level)
      expect(levelFromXp(threshold)).toBe(level)
      // One short of the threshold is still the level below.
      if (level > 1) expect(levelFromXp(threshold - 1)).toBe(level - 1)
    }
  })

  it('makes each level cost 50 more than the last', () => {
    for (let level = 1; level <= 20; level++) {
      expect(xpForLevel(level + 1) - xpForLevel(level)).toBe(xpToNextLevel(level))
      expect(xpToNextLevel(level)).toBe(100 + 50 * (level - 1))
    }
  })

  it('reports progress into the current level, not into the total', () => {
    // 100 XP is exactly level 2; 150 is level 2 with 50 of the 150 needed.
    expect(levelStanding(100)).toMatchObject({ level: 2, into: 0, needed: 150 })
    const half = levelStanding(175)
    expect(half.level).toBe(2)
    expect(half.into).toBe(75)
    expect(half.fraction).toBeCloseTo(0.5)
  })

  it('never runs out of titles', () => {
    expect(titleForLevel(1)).toBe(TITLES[0])
    expect(titleForLevel(6)).toBe(TITLES[1])
    expect(titleForLevel(500)).toBe(TITLES[TITLES.length - 1])
  })
})

describe('xpForAnswer', () => {
  it('pays something for a wrong answer, so trying always counts', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      expect(xpForAnswer({ difficulty, score: 0, combo: 0 })).toBe(XP_FOR_TRYING)
    }
  })

  it('pays more for harder questions', () => {
    const at = (difficulty: 'easy' | 'medium' | 'hard') =>
      xpForAnswer({ difficulty, score: 1, combo: 1 })
    expect(at('easy')).toBeLessThan(at('medium'))
    expect(at('medium')).toBeLessThan(at('hard'))
  })

  it('scales with partial credit', () => {
    const full = xpForAnswer({ difficulty: 'hard', score: 1, combo: 1 })
    const half = xpForAnswer({ difficulty: 'hard', score: 0.5, combo: 1 })
    expect(half).toBeLessThan(full)
    expect(half).toBeGreaterThan(XP_FOR_TRYING)
  })

  it('pays a combo bonus only on a fully correct answer, and caps it', () => {
    const base = xpForAnswer({ difficulty: 'medium', score: 1, combo: 1 })
    expect(xpForAnswer({ difficulty: 'medium', score: 1, combo: 4 })).toBe(base + 6)
    // A partial answer breaks the bonus even though the combo count is high.
    expect(xpForAnswer({ difficulty: 'medium', score: 0.9, combo: 9 })).toBeLessThan(base)
    // Capped, so a long streak cannot outweigh the question itself.
    expect(xpForAnswer({ difficulty: 'medium', score: 1, combo: 200 })).toBe(base + 20)
  })

  it('is never negative and always an integer', () => {
    for (const score of [-1, 0, 0.3, 0.77, 1, 2]) {
      const xp = xpForAnswer({ difficulty: 'hard', score, combo: 3 })
      expect(Number.isInteger(xp)).toBe(true)
      expect(xp).toBeGreaterThanOrEqual(XP_FOR_TRYING)
    }
  })
})

describe('avatars', () => {
  it('builds a DiceBear URL for the chosen style and seed', () => {
    const url = new URL(avatarUrl('bottts', 'hello', 96))
    expect(url.origin).toBe('https://api.dicebear.com')
    expect(url.pathname).toBe('/9.x/bottts/svg')
    expect(url.searchParams.get('seed')).toBe('hello')
    expect(url.searchParams.get('size')).toBe('96')
  })

  it('escapes a seed that would otherwise break the query string', () => {
    const url = new URL(avatarUrl('lorelei', 'a&b=c d'))
    expect(url.searchParams.get('seed')).toBe('a&b=c d')
  })

  it('rolls a style from the list and a non-empty seed', () => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const rolled = rollAvatar()
      expect(AVATAR_STYLES).toContain(rolled.style)
      expect(rolled.seed).not.toBe('')
    }
  })

  it('eventually rolls more than one style', () => {
    const seen = new Set(Array.from({ length: 200 }, () => rollAvatar().style))
    expect(seen.size).toBeGreaterThan(1)
  })
})
