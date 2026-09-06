/**
 * Building a party run.
 *
 * Twelve stops, dealt from one seed. Seeding the whole run rather than each
 * stop means a run is reproducible and shareable — the same thing every other
 * part of this app does with questions, applied one level up.
 *
 * The shape is fixed on purpose:
 *
 *   stop 1    Straight Up, whatever game comes up. A warm-up, so the first
 *             thing that happens is not Sudden Death on your worst topic.
 *   stop 6    a fork: two games face up, you pick. The one stop where the
 *             wheel does not decide for you.
 *   stop 12   Boss Fight. Hard, five questions, triple pay.
 *   the rest  wheel picks the game, deck picks the card.
 *
 * No stop can end the run. See cards.ts for why.
 */

import { makeRng, type Rng } from '@/logic'
import { MINIGAMES } from '@/engine/registry'
import type { AnyMinigame, Difficulty, Topic } from '@/engine/types'
import { weakestTopics } from '@/store/progress'
import { BOSS_FIGHT, STRAIGHT_UP, WHEEL_CARDS, cardById, type RuleCard } from './cards'

export const RUN_LENGTH = 12
export const FORK_AT = 6

export interface Stop {
  /** 1-based, as shown on the track. */
  number: number
  /** Minigame ids. One, or two when the stop is a fork. */
  games: string[]
  cardId: string
  /** Seed for the round itself. */
  seed: string
}

export interface Run {
  seed: string
  difficulty: Difficulty
  stops: Stop[]
}

export const cardOf = (stop: Stop): RuleCard => cardById(stop.cardId)

export const isFork = (stop: Stop): boolean => stop.games.length > 1

export function gameOf(stop: Stop, choice = 0): AnyMinigame {
  const id = stop.games[Math.min(choice, stop.games.length - 1)]
  const game = MINIGAMES.find((entry) => entry.id === id)
  if (game === undefined) throw new Error(`No minigame called ${id}`)
  return game
}

/** The difficulty a stop is actually played at. */
export const difficultyOf = (run: Run, stop: Stop): Difficulty =>
  cardOf(stop).difficulty ?? run.difficulty

// ---------------------------------------------------------------------------
// Dealing
// ---------------------------------------------------------------------------

/**
 * The topic the player is worst at, or null when nothing is known yet.
 *
 * Passed in rather than read here so the run stays a pure function of its
 * inputs — which is what lets the tests deal thousands of runs without a
 * progress store.
 */
export type WeakestTopic = Topic | null

export function currentWeakestTopic(): WeakestTopic {
  const topics = [...new Set(MINIGAMES.flatMap((game) => [...game.topics]))]
  const ranked = weakestTopics(topics)
  return ranked[0]?.topic ?? null
}

const gamesForTopic = (topic: Topic): AnyMinigame[] =>
  MINIGAMES.filter((game) => game.topics.includes(topic))

/**
 * Pick a game for a card.
 *
 * Grudge Match narrows the pool to the weakest topic; everything else draws
 * from all of them. When the weakest topic is unknown or has no games, it
 * falls back to the whole list rather than dealing nothing.
 */
function pickGame(rng: Rng, card: RuleCard, weakest: WeakestTopic, avoid: Set<string>): AnyMinigame {
  const pool =
    card.weakestTopic === true && weakest !== null ? gamesForTopic(weakest) : [...MINIGAMES]
  const usable = pool.length > 0 ? pool : [...MINIGAMES]

  // Try not to repeat a game inside one run; give up rather than loop forever.
  const fresh = usable.filter((game) => !avoid.has(game.id))
  return rng.pick(fresh.length > 0 ? fresh : usable)
}

export interface BuildOptions {
  seed: string
  difficulty: Difficulty
  weakest?: WeakestTopic
}

export function buildRun({ seed, difficulty, weakest = null }: BuildOptions): Run {
  const rng = makeRng(`party:${seed}`)
  const stops: Stop[] = []
  const used = new Set<string>()

  for (let number = 1; number <= RUN_LENGTH; number++) {
    const card =
      number === RUN_LENGTH
        ? BOSS_FIGHT
        : number === 1
          ? STRAIGHT_UP
          : rng.pick([...WHEEL_CARDS])

    const games: string[] = []
    const wanted = number === FORK_AT ? 2 : 1
    for (let slot = 0; slot < wanted; slot++) {
      const game = pickGame(rng, card, weakest, new Set([...used, ...games]))
      games.push(game.id)
      used.add(game.id)
    }

    stops.push({ number, games, cardId: card.id, seed: `${seed}:${number}` })
  }

  return { seed, difficulty, stops }
}

// ---------------------------------------------------------------------------
// Progress through a run
// ---------------------------------------------------------------------------

export interface StopRecord {
  number: number
  gameId: string
  cardId: string
  correct: number
  asked: number
  coins: number
  perfect: boolean
}

export interface RunTotals {
  coins: number
  perfectStops: number
  correct: number
  asked: number
  /** The single best-paying stop, for the end screen. */
  best: StopRecord | null
}

export function totalsFor(records: readonly StopRecord[]): RunTotals {
  let best: StopRecord | null = null
  for (const record of records) {
    if (best === null || record.coins > best.coins) best = record
  }
  return {
    coins: records.reduce((sum, record) => sum + record.coins, 0),
    perfectStops: records.filter((record) => record.perfect).length,
    correct: records.reduce((sum, record) => sum + record.correct, 0),
    asked: records.reduce((sum, record) => sum + record.asked, 0),
    best,
  }
}

/** All-clear stops in a row, counting back from the end. */
export function streakOf(records: readonly StopRecord[]): number {
  let streak = 0
  for (let index = records.length - 1; index >= 0; index--) {
    if (!(records[index] as StopRecord).perfect) break
    streak += 1
  }
  return streak
}
