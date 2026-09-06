/**
 * Rule cards — the twist drawn with each stop of a party run.
 *
 * The minigames are already good at being minigames. What a party mode adds is
 * a reason to play the *same* one differently: the wheel picks what you play,
 * the card picks how, and the payout is what makes the how matter. A card is
 * therefore not new game logic — it is a handful of round options and a
 * multiplier.
 *
 * Nothing here can end a run. A bad stop pays less and the run carries on,
 * which is the right shape for a study tool: the mode should never lock you
 * out of practising the thing you are worst at. Sudden Death still bites,
 * because it ends the *stop* — you keep what you banked and walk away early.
 */

import type { Difficulty } from '@/engine/types'

export interface RuleCard {
  id: string
  name: string
  /** One line, shown on the how-to-play card. */
  rule: string
  icon: string
  /** Everything the stop pays is multiplied by this. */
  multiplier: number
  /** How many questions the stop asks. */
  questions: number
  /** Forces a difficulty, whatever the run was set to. */
  difficulty?: Difficulty
  /** Hard cap on the stop, in seconds. */
  capSeconds?: number
  /** The first wrong answer ends the stop. */
  stopOnWrong?: boolean
  /** No verdict until the whole stop is over. */
  hideFeedback?: boolean
  /** Pays nothing unless every question is right. */
  allOrNothing?: boolean
  /** Draw the game from the topic the player is worst at. */
  weakestTopic?: boolean
  /** Kept off the wheel — dealt only at a fixed stop. */
  fixedOnly?: boolean
}

export const STRAIGHT_UP: RuleCard = {
  id: 'straight-up',
  name: 'Straight Up',
  rule: 'Three questions. No tricks.',
  icon: '🎯',
  multiplier: 1,
  questions: 3,
}

export const BOSS_FIGHT: RuleCard = {
  id: 'boss-fight',
  name: 'Boss Fight',
  rule: 'Five questions, hard difficulty, triple pay.',
  icon: '👑',
  multiplier: 3,
  questions: 5,
  difficulty: 'hard',
  fixedOnly: true,
}

export const CARDS: readonly RuleCard[] = [
  STRAIGHT_UP,
  {
    id: 'speed-trap',
    name: 'Speed Trap',
    rule: 'Twenty seconds for all three. The clock does not wait for you to read.',
    icon: '⏱️',
    multiplier: 2,
    questions: 3,
    capSeconds: 20,
  },
  {
    id: 'blindfold',
    name: 'Blindfold',
    rule: 'No feedback until the stop is over. Commit to every answer.',
    icon: '🙈',
    multiplier: 2,
    questions: 3,
    hideFeedback: true,
  },
  {
    id: 'sudden-death',
    name: 'Sudden Death',
    rule: 'One wrong answer ends the stop. You keep what you banked.',
    icon: '💀',
    multiplier: 3,
    questions: 3,
    stopOnWrong: true,
  },
  {
    id: 'grudge-match',
    name: 'Grudge Match',
    rule: 'Your worst topic, whether you like it or not.',
    icon: '😤',
    multiplier: 2,
    questions: 3,
    weakestTopic: true,
  },
  {
    id: 'double-or-nothing',
    name: 'Double Or Nothing',
    rule: 'All three right pays double. Anything less pays nothing at all.',
    icon: '🎲',
    multiplier: 2,
    questions: 3,
    allOrNothing: true,
  },
  BOSS_FIGHT,
]

export const cardById = (id: string): RuleCard =>
  CARDS.find((card) => card.id === id) ?? STRAIGHT_UP

/** The cards the wheel may draw. */
export const WHEEL_CARDS: readonly RuleCard[] = CARDS.filter((card) => card.fixedOnly !== true)

// ---------------------------------------------------------------------------
// Payout
// ---------------------------------------------------------------------------

export const PAYOUT = {
  /** Per correct answer, before the multiplier. */
  perCorrect: 10,
  /** For getting every question in the stop right. */
  allClear: 20,
  /** For finishing a capped stop in under half its time. */
  speed: 10,
  /** Per consecutive all-clear stop beyond the first. */
  streakStep: 5,
  /** Ceiling on the streak bonus, so one good run cannot run away. */
  maxStreak: 25,
} as const

export interface StopResult {
  card: RuleCard
  /** Questions answered correctly. */
  correct: number
  /** Questions actually put to the player — fewer if Sudden Death cut it short. */
  asked: number
  /** How long the stop took, for the speed bonus. */
  elapsedMs: number
  /** All-clear stops before this one, in a row. */
  streak: number
}

export interface Payout {
  base: number
  allClear: number
  speed: number
  multiplier: number
  streak: number
  /** What the stop is worth, all in. */
  total: number
  /** Every question asked was answered correctly. */
  perfect: boolean
}

/**
 * What a stop pays.
 *
 * "Perfect" means every question of the card was right — `card.questions`, not
 * `asked`. Otherwise Sudden Death would pay the all-clear bonus for getting one
 * right and then failing, which is the opposite of what it is for.
 */
export function payoutFor(result: StopResult): Payout {
  const perfect = result.correct >= result.card.questions
  const base = PAYOUT.perCorrect * result.correct
  const allClear = perfect ? PAYOUT.allClear : 0

  const cap = result.card.capSeconds
  const speed =
    perfect && cap !== undefined && result.elapsedMs <= (cap * 1000) / 2 ? PAYOUT.speed : 0

  const subtotal = base + allClear + speed
  const earned =
    result.card.allOrNothing === true && !perfect
      ? 0
      : Math.round(subtotal * result.card.multiplier)

  const streak =
    perfect && earned > 0
      ? Math.min(PAYOUT.maxStreak, Math.max(0, result.streak) * PAYOUT.streakStep)
      : 0

  return {
    base,
    allClear,
    speed,
    multiplier: result.card.multiplier,
    streak,
    total: earned + streak,
    perfect,
  }
}

/** The most a stop could possibly pay, for showing the stake up front. */
export function maximumFor(card: RuleCard): number {
  return payoutFor({
    card,
    correct: card.questions,
    asked: card.questions,
    elapsedMs: 0,
    streak: 0,
  }).total
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export interface Rank {
  letter: string
  title: string
}

const RANKS: readonly { at: number; letter: string; title: string }[] = [
  { at: 0, letter: 'D', title: 'Turned up' },
  { at: 200, letter: 'C', title: 'Getting the hang of it' },
  { at: 400, letter: 'B', title: 'Solid run' },
  { at: 650, letter: 'A', title: 'Sharp' },
  { at: 900, letter: 'S', title: 'Ran the table' },
]

export function rankFor(coins: number): Rank {
  let found = RANKS[0] as { at: number; letter: string; title: string }
  for (const rank of RANKS) if (coins >= rank.at) found = rank
  return { letter: found.letter, title: found.title }
}
