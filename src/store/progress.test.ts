import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearProgress,
  currentStreak,
  formatDuration,
  getBestTime,
  getHighScore,
  getProgress,
  overallStats,
  recordAttempt,
  statsForTopic,
  submitScore,
  submitTime,
  weakestTopics,
} from './progress'
import type { Attempt } from './progress'
import type { Topic } from '@/engine/types'

const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({
  gameId: 'truth-table',
  topics: ['truth-tables'],
  difficulty: 'medium',
  correct: true,
  score: 1,
  seed: 'seed',
  questionIndex: 0,
  at: Date.now(),
  ms: 1000,
  ...overrides,
})

beforeEach(() => {
  clearProgress()
})

describe('personal bests', () => {
  it('keeps the highest score, because higher is better', () => {
    expect(submitScore('truth-table', 'easy', 300)).toBe(true)
    expect(submitScore('truth-table', 'easy', 500)).toBe(true)
    expect(submitScore('truth-table', 'easy', 400)).toBe(false)
    expect(submitScore('truth-table', 'easy', 500)).toBe(false) // ties do not beat
    expect(getHighScore('truth-table', 'easy')).toBe(500)
  })

  it('keeps the lowest time, because lower is better', () => {
    expect(submitTime('truth-table', 'easy', 90_000)).toBe(true)
    expect(submitTime('truth-table', 'easy', 75_000)).toBe(true)
    expect(submitTime('truth-table', 'easy', 80_000)).toBe(false)
    expect(submitTime('truth-table', 'easy', 75_000)).toBe(false) // ties do not beat
    expect(getBestTime('truth-table', 'easy')).toBe(75_000)
  })

  it('accepts any first time, however slow', () => {
    expect(getBestTime('truth-table', 'hard')).toBeNull()
    expect(submitTime('truth-table', 'hard', 600_000)).toBe(true)
  })

  it('records bests per difficulty — a hard 800 is not a lesser easy 900', () => {
    submitScore('truth-table', 'easy', 900)
    submitScore('truth-table', 'hard', 800)
    expect(getHighScore('truth-table', 'easy')).toBe(900)
    expect(getHighScore('truth-table', 'hard')).toBe(800)
  })

  it('reports zero and null for a game never played', () => {
    expect(getHighScore('nope', 'easy')).toBe(0)
    expect(getBestTime('nope', 'easy')).toBeNull()
  })

  it('keeps scores and times when new attempts are recorded', () => {
    submitScore('truth-table', 'easy', 500)
    submitTime('truth-table', 'easy', 75_000)
    recordAttempt(attempt())
    expect(getHighScore('truth-table', 'easy')).toBe(500)
    expect(getBestTime('truth-table', 'easy')).toBe(75_000)
  })
})

describe('statistics', () => {
  it('averages partial credit rather than counting only perfect answers', () => {
    recordAttempt(attempt({ correct: true, score: 1 }))
    recordAttempt(attempt({ correct: false, score: 0.5 }))
    const stats = overallStats()
    expect(stats.attempts).toBe(2)
    expect(stats.correct).toBe(1)
    expect(stats.accuracy).toBe(0.75)
  })

  it('counts the streak back from the most recent answer', () => {
    recordAttempt(attempt({ correct: true }))
    recordAttempt(attempt({ correct: false, score: 0 }))
    recordAttempt(attempt({ correct: true }))
    recordAttempt(attempt({ correct: true }))
    expect(currentStreak()).toBe(2)
  })

  it('attributes an attempt to every topic the minigame covers', () => {
    recordAttempt(attempt({ topics: ['truth-tables', 'equivalence'] }))
    expect(statsForTopic('truth-tables').attempts).toBe(1)
    expect(statsForTopic('equivalence').attempts).toBe(1)
    expect(statsForTopic('resolution').attempts).toBe(0)
  })

  it('ranks a never-practised topic as weaker than a badly-played one', () => {
    // Never having touched resolution is more worth surfacing before an exam
    // than a topic that has at least been attempted.
    for (let i = 0; i < 10; i++) recordAttempt(attempt({ correct: false, score: 0 }))

    const topics: Topic[] = ['truth-tables', 'resolution']
    const ranked = weakestTopics(topics)
    expect(ranked[0]?.topic).toBe('resolution')
    expect(ranked[0]?.stats.attempts).toBe(0)
  })

  it('survives being cleared', () => {
    recordAttempt(attempt())
    submitScore('truth-table', 'easy', 500)
    clearProgress()
    expect(getProgress().attempts).toHaveLength(0)
    expect(getHighScore('truth-table', 'easy')).toBe(0)
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '0:00.0'],
    [1500, '0:01.5'],
    [59_900, '0:59.9'],
    [60_000, '1:00.0'],
    [132_631, '2:12.6'],
    [600_000, '10:00.0'],
  ])('renders %ims as %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected)
  })
})
