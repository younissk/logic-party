/**
 * Progress tracking.
 *
 * The point of the whole app: know which topics are weak and drill those.
 * Every answered question lands here, and the home screen reads back
 * per-topic accuracy so the next round can be aimed at the weak spots
 * rather than the comfortable ones.
 *
 * Storage is localStorage, wrapped so a private window or a browser with
 * site data blocked degrades to in-memory rather than crashing.
 */

import { useSyncExternalStore } from 'react'
import type { Difficulty, Topic } from '@/engine/types'

const STORAGE_KEY = 'comp-logics-game/progress/v1'

/** Keep the log bounded; older attempts stop being informative anyway. */
const MAX_ATTEMPTS = 2000

export interface Attempt {
  gameId: string
  topics: Topic[]
  difficulty: Difficulty
  correct: boolean
  /** Partial credit in [0, 1]. */
  score: number
  /** Seed of the round, so a disputed question can be replayed exactly. */
  seed: string
  questionIndex: number
  /** Epoch milliseconds. */
  at: number
  /** Time taken, in milliseconds. */
  ms: number
}

export interface ProgressState {
  version: 1
  attempts: Attempt[]
  /** Best time-attack score, keyed by `gameId:difficulty`. Higher is better. */
  highScores: Record<string, number>
  /** Best sprint time in ms, keyed by `gameId:difficulty`. Lower is better. */
  bestTimes: Record<string, number>
}

const EMPTY: ProgressState = { version: 1, attempts: [], highScores: {}, bestTimes: {} }

function readStorage(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'attempts' in parsed &&
      Array.isArray((parsed as ProgressState).attempts)
    ) {
      const state = parsed as Partial<ProgressState>
      // highScores and bestTimes were added after the first release; saved
      // data may predate either.
      return {
        version: 1,
        attempts: state.attempts ?? [],
        highScores: state.highScores ?? {},
        bestTimes: state.bestTimes ?? {},
      }
    }
    return EMPTY
  } catch {
    // Corrupt JSON, or storage blocked entirely. Start clean rather than die.
    return EMPTY
  }
}

let state: ProgressState = readStorage()
const listeners = new Set<() => void>()

function commit(next: ProgressState): void {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Out of quota or storage disabled — keep going in memory.
  }
  for (const listener of listeners) listener()
}

export function getProgress(): ProgressState {
  return state
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function recordAttempt(attempt: Attempt): void {
  const attempts = [...state.attempts, attempt].slice(-MAX_ATTEMPTS)
  commit({ ...state, attempts })
}

// ---------------------------------------------------------------------------
// High scores — the leaderboard you play against yourself
// ---------------------------------------------------------------------------

/** Scores are per difficulty: a hard 800 is not a lesser easy 900. */
export const highScoreKey = (gameId: string, difficulty: Difficulty): string =>
  `${gameId}:${difficulty}`

export function getHighScore(
  gameId: string,
  difficulty: Difficulty,
  progress: ProgressState = state,
): number {
  return progress.highScores[highScoreKey(gameId, difficulty)] ?? 0
}

/** Saves the score if it beats the stored best. Returns true when it did. */
export function submitScore(gameId: string, difficulty: Difficulty, score: number): boolean {
  const key = highScoreKey(gameId, difficulty)
  const previous = state.highScores[key] ?? 0
  if (score <= previous) return false
  commit({ ...state, highScores: { ...state.highScores, [key]: score } })
  return true
}

/** Best sprint time in milliseconds, or null if this one has never been run. */
export function getBestTime(
  gameId: string,
  difficulty: Difficulty,
  progress: ProgressState = state,
): number | null {
  return progress.bestTimes[highScoreKey(gameId, difficulty)] ?? null
}

/** Saves the time if it beats the stored best. Lower wins. */
export function submitTime(gameId: string, difficulty: Difficulty, ms: number): boolean {
  const key = highScoreKey(gameId, difficulty)
  const previous = state.bestTimes[key]
  if (previous !== undefined && ms >= previous) return false
  commit({ ...state, bestTimes: { ...state.bestTimes, [key]: ms } })
  return true
}

/** Milliseconds as `M:SS.d` — the shape a stopwatch should read in. */
export function formatDuration(ms: number): string {
  const totalSeconds = ms / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
}

export function clearProgress(): void {
  commit(EMPTY)
}

/** Subscribe a component to progress changes. */
export function useProgress(): ProgressState {
  return useSyncExternalStore(subscribe, getProgress, () => EMPTY)
}

// ---------------------------------------------------------------------------
// Derived statistics
// ---------------------------------------------------------------------------

export interface Stats {
  attempts: number
  correct: number
  /** Mean partial credit in [0, 1]; 0 when there are no attempts. */
  accuracy: number
  /** Median answer time in milliseconds; 0 when there are no attempts. */
  medianMs: number
}

function summarise(attempts: readonly Attempt[]): Stats {
  if (attempts.length === 0) return { attempts: 0, correct: 0, accuracy: 0, medianMs: 0 }

  const totalScore = attempts.reduce((sum, a) => sum + a.score, 0)
  const times = attempts.map((a) => a.ms).sort((a, b) => a - b)
  const middle = Math.floor(times.length / 2)
  const medianMs =
    times.length % 2 === 1
      ? (times[middle] as number)
      : ((times[middle - 1] as number) + (times[middle] as number)) / 2

  return {
    attempts: attempts.length,
    correct: attempts.filter((a) => a.correct).length,
    accuracy: totalScore / attempts.length,
    medianMs,
  }
}

export const overallStats = (progress: ProgressState = state): Stats => summarise(progress.attempts)

export function statsForGame(gameId: string, progress: ProgressState = state): Stats {
  return summarise(progress.attempts.filter((a) => a.gameId === gameId))
}

export function statsForTopic(topic: Topic, progress: ProgressState = state): Stats {
  return summarise(progress.attempts.filter((a) => a.topics.includes(topic)))
}

export interface TopicStanding {
  topic: Topic
  stats: Stats
}

/**
 * Topics ranked worst first.
 *
 * Topics with too few attempts to judge are ranked as *unknown*, not as
 * strong: never having practised something is exactly the case worth
 * surfacing before an exam.
 */
export function weakestTopics(
  topics: readonly Topic[],
  progress: ProgressState = state,
  minimumAttempts = 5,
): TopicStanding[] {
  return topics
    .map((topic) => ({ topic, stats: statsForTopic(topic, progress) }))
    .sort((a, b) => {
      const aUntested = a.stats.attempts < minimumAttempts
      const bUntested = b.stats.attempts < minimumAttempts
      if (aUntested !== bUntested) return aUntested ? -1 : 1
      return a.stats.accuracy - b.stats.accuracy
    })
}

/** Consecutive correct answers, counting back from the most recent attempt. */
export function currentStreak(progress: ProgressState = state): number {
  let streak = 0
  for (let i = progress.attempts.length - 1; i >= 0; i--) {
    if (!(progress.attempts[i] as Attempt).correct) break
    streak++
  }
  return streak
}

/** Distinct days with at least one attempt — a cheap "did I revise today". */
export function daysPractised(progress: ProgressState = state): number {
  const days = new Set(progress.attempts.map((a) => new Date(a.at).toDateString()))
  return days.size
}
