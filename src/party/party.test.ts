import { describe, expect, it } from 'vitest'

import { MINIGAMES } from '@/engine/registry'
import type { Difficulty, Topic } from '@/engine/types'
import {
  BOSS_FIGHT,
  CARDS,
  PAYOUT,
  STRAIGHT_UP,
  WHEEL_CARDS,
  cardById,
  maximumFor,
  payoutFor,
  rankFor,
} from './cards'
import {
  FORK_AT,
  RUN_LENGTH,
  SHOPS_AT,
  buildRun,
  canReroll,
  canSwap,
  cardOf,
  difficultyOf,
  gameOf,
  isFork,
  isShop,
  rerollGame,
  streakOf,
  swapCard,
  totalsFor,
  type Stop,
  type StopRecord,
} from './run'
import { ITEMS, addItem, canAfford, heldOf, holdsAny, itemById, purseOf, useItem } from './items'

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

describe('rule cards', () => {
  it('has unique ids', () => {
    expect(new Set(CARDS.map((card) => card.id)).size).toBe(CARDS.length)
  })

  it('gives every card a rule the player can read', () => {
    for (const card of CARDS) {
      expect(card.rule.length, card.id).toBeGreaterThan(15)
      expect(card.questions, card.id).toBeGreaterThan(0)
      expect(card.multiplier, card.id).toBeGreaterThanOrEqual(1)
    }
  })

  it('pays more for the cards that ask more', () => {
    // A card with a bigger multiplier has to actually be riskier, or the
    // wheel is just handing out money.
    for (const card of CARDS) {
      if (card.multiplier <= 1) continue
      const risky =
        card.capSeconds !== undefined ||
        card.stopOnWrong === true ||
        card.hideFeedback === true ||
        card.allOrNothing === true ||
        card.weakestTopic === true ||
        card.difficulty === 'hard'
      expect(risky, card.id).toBe(true)
    }
  })

  it('keeps the boss off the wheel', () => {
    expect(WHEEL_CARDS).not.toContain(BOSS_FIGHT)
    expect(WHEEL_CARDS).toContain(STRAIGHT_UP)
  })

  it('falls back to Straight Up for an id it does not know', () => {
    expect(cardById('nonsense')).toBe(STRAIGHT_UP)
  })
})

describe('what a stop pays', () => {
  const stop = (over: Partial<Parameters<typeof payoutFor>[0]> = {}) =>
    payoutFor({
      card: STRAIGHT_UP,
      correct: 3,
      asked: 3,
      elapsedMs: 9_000,
      streak: 0,
      ...over,
    })

  it('pays per correct answer plus an all-clear bonus', () => {
    expect(stop().total).toBe(PAYOUT.perCorrect * 3 + PAYOUT.allClear)
  })

  it('pays nothing for a stop with nothing right', () => {
    expect(stop({ correct: 0 }).total).toBe(0)
  })

  it('withholds the all-clear bonus for a partial stop', () => {
    const partial = stop({ correct: 2 })
    expect(partial.allClear).toBe(0)
    expect(partial.perfect).toBe(false)
    expect(partial.total).toBe(PAYOUT.perCorrect * 2)
  })

  it('multiplies the whole stop by the card', () => {
    const boss = payoutFor({
      card: BOSS_FIGHT,
      correct: 5,
      asked: 5,
      elapsedMs: 0,
      streak: 0,
    })
    expect(boss.total).toBe((PAYOUT.perCorrect * 5 + PAYOUT.allClear) * BOSS_FIGHT.multiplier)
  })

  it('pays a speed bonus only on a capped card, and only when perfect', () => {
    const trap = cardById('speed-trap')
    const fast = payoutFor({
      card: trap,
      correct: 3,
      asked: 3,
      elapsedMs: 5_000,
      streak: 0,
    })
    const slow = payoutFor({
      card: trap,
      correct: 3,
      asked: 3,
      elapsedMs: 18_000,
      streak: 0,
    })
    const sloppy = payoutFor({
      card: trap,
      correct: 2,
      asked: 3,
      elapsedMs: 1_000,
      streak: 0,
    })
    expect(fast.speed).toBe(PAYOUT.speed)
    expect(slow.speed).toBe(0)
    expect(sloppy.speed).toBe(0)
    // An uncapped card has no clock to beat.
    expect(stop({ elapsedMs: 0 }).speed).toBe(0)
  })

  it('pays Double Or Nothing nothing at all for a near miss', () => {
    const card = cardById('double-or-nothing')
    expect(
      payoutFor({ card, correct: 3, asked: 3, elapsedMs: 0, streak: 0 }).total,
    ).toBeGreaterThan(0)
    expect(payoutFor({ card, correct: 2, asked: 3, elapsedMs: 0, streak: 0 }).total).toBe(0)
  })

  it('does not pay Sudden Death the all-clear bonus for a stop it cut short', () => {
    // One right and then out is not a clear round, however few were asked.
    const card = cardById('sudden-death')
    const cut = payoutFor({
      card,
      correct: 1,
      asked: 2,
      elapsedMs: 0,
      streak: 0,
    })
    expect(cut.perfect).toBe(false)
    expect(cut.allClear).toBe(0)
    expect(cut.total).toBe(PAYOUT.perCorrect * 1 * card.multiplier)
  })

  it('adds a streak bonus that cannot run away', () => {
    expect(stop({ streak: 0 }).streak).toBe(0)
    expect(stop({ streak: 2 }).streak).toBe(PAYOUT.streakStep * 2)
    expect(stop({ streak: 99 }).streak).toBe(PAYOUT.maxStreak)
    // A streak pays nothing on a stop that was not itself perfect.
    expect(stop({ correct: 1, streak: 5 }).streak).toBe(0)
  })

  it('quotes a stake that a perfect stop actually reaches', () => {
    for (const card of CARDS) {
      const best = payoutFor({
        card,
        correct: card.questions,
        asked: card.questions,
        elapsedMs: 0,
        streak: 0,
      })
      expect(maximumFor(card), card.id).toBe(best.total)
      expect(maximumFor(card), card.id).toBeGreaterThan(0)
    }
  })
})

describe('ranking', () => {
  it('runs from D upwards and never skips', () => {
    expect(rankFor(0).letter).toBe('D')
    expect(rankFor(-50).letter).toBe('D')
    expect(rankFor(100_000).letter).toBe('S')
    const letters = [0, 250, 500, 700, 1000].map((coins) => rankFor(coins).letter)
    expect(letters).toEqual(['D', 'C', 'B', 'A', 'S'])
  })

  it('gives every rank a title', () => {
    for (const coins of [0, 300, 500, 800, 1200]) {
      expect(rankFor(coins).title.length).toBeGreaterThan(3)
    }
  })
})

describe('building a run', () => {
  const run = (seed: string, difficulty: Difficulty = 'medium', weakest: Topic | null = null) =>
    buildRun({ seed, difficulty, weakest })

  it('always has the same length', () => {
    for (let seed = 0; seed < 40; seed++) {
      expect(run(`s${seed}`).stops).toHaveLength(RUN_LENGTH)
    }
  })

  it('is reproducible from its seed', () => {
    expect(JSON.stringify(run('abc'))).toBe(JSON.stringify(run('abc')))
    expect(JSON.stringify(run('abc'))).not.toBe(JSON.stringify(run('xyz')))
  })

  it('opens gently and ends on the boss', () => {
    for (let seed = 0; seed < 40; seed++) {
      const stops = run(`s${seed}`).stops
      expect(cardOf(stops[0]!)).toBe(STRAIGHT_UP)
      expect(cardOf(stops[RUN_LENGTH - 1]!)).toBe(BOSS_FIGHT)
    }
  })

  it('puts exactly one fork in, at the fork stop', () => {
    for (let seed = 0; seed < 40; seed++) {
      const stops = run(`s${seed}`).stops
      const forks = stops.filter(isFork)
      expect(forks).toHaveLength(1)
      expect(forks[0]!.number).toBe(FORK_AT)
      expect(forks[0]!.games).toHaveLength(2)
      expect(forks[0]!.games[0]).not.toBe(forks[0]!.games[1])
    }
  })

  it('never deals a game that does not exist', () => {
    const known = new Set(MINIGAMES.map((game) => game.id))
    for (let seed = 0; seed < 40; seed++) {
      for (const stop of run(`s${seed}`).stops) {
        if (isShop(stop)) continue
        for (const id of stop.games) expect(known.has(id), id).toBe(true)
        expect(() => gameOf(stop)).not.toThrow()
      }
    }
  })

  it('puts a shop where the plan says, and nothing else there', () => {
    for (let seed = 0; seed < 40; seed++) {
      const stops = run(`s${seed}`).stops
      const shops = stops.filter(isShop).map((stop) => stop.number)
      expect(shops).toEqual([...SHOPS_AT])
      for (const stop of stops.filter(isShop)) {
        expect(stop.games).toEqual([])
        expect(isFork(stop)).toBe(false)
      }
    }
  })

  it('leaves every other stop playable', () => {
    for (let seed = 0; seed < 20; seed++) {
      const playable = run(`s${seed}`).stops.filter((stop) => !isShop(stop))
      expect(playable).toHaveLength(RUN_LENGTH - SHOPS_AT.length)
      for (const stop of playable) expect(stop.games.length).toBeGreaterThan(0)
    }
  })

  it('does not ask for the same game twice in one run', () => {
    // There are far more minigames than stops, so a repeat would just be
    // sloppy dealing.
    for (let seed = 0; seed < 40; seed++) {
      const ids = run(`s${seed}`).stops.flatMap((stop) => stop.games)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('numbers the stops from one, in order', () => {
    const stops = run('numbers').stops
    expect(stops.map((stop) => stop.number)).toEqual(
      Array.from({ length: RUN_LENGTH }, (_, index) => index + 1),
    )
  })

  it('gives every stop its own question seed', () => {
    const seeds = run('seeds').stops.map((stop) => stop.seed)
    expect(new Set(seeds).size).toBe(seeds.length)
  })

  it.each(DIFFICULTIES)('plays at the run difficulty except on the boss, from %s', (difficulty) => {
    const built = run('diff', difficulty)
    for (const stop of built.stops) {
      if (isShop(stop)) continue
      const wanted = cardOf(stop).difficulty ?? difficulty
      expect(difficultyOf(built, stop)).toBe(wanted)
    }
    expect(difficultyOf(built, built.stops[RUN_LENGTH - 1]!)).toBe('hard')
  })

  it('draws a Grudge Match from the weakest topic', () => {
    for (let seed = 0; seed < 60; seed++) {
      const built = run(`g${seed}`, 'medium', 'herbrand')
      for (const stop of built.stops) {
        if (isShop(stop) || cardOf(stop).weakestTopic !== true) continue
        for (const id of stop.games) {
          const game = MINIGAMES.find((entry) => entry.id === id)
          expect(game?.topics, `${id} is not a herbrand game`).toContain('herbrand')
        }
      }
    }
  })

  it('still deals a Grudge Match when nothing is known about the player', () => {
    // A brand new player has no weakest topic. The stop has to exist anyway.
    for (let seed = 0; seed < 40; seed++) {
      const built = run(`n${seed}`, 'medium', null)
      for (const stop of built.stops.filter((stop) => !isShop(stop))) {
        expect(() => gameOf(stop)).not.toThrow()
      }
    }
  })

  it('deals every card eventually', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 200; seed++) {
      for (const stop of run(`c${seed}`).stops) if (!isShop(stop)) seen.add(stop.cardId)
    }
    for (const card of CARDS) expect(seen, card.id).toContain(card.id)
  })
})

describe('totals', () => {
  const record = (over: Partial<StopRecord> = {}): StopRecord => ({
    number: 1,
    gameId: 'bcp',
    cardId: 'straight-up',
    correct: 3,
    asked: 3,
    coins: 50,
    perfect: true,
    ...over,
  })

  it('adds up an empty run to nothing', () => {
    const totals = totalsFor([])
    expect(totals.coins).toBe(0)
    expect(totals.best).toBeNull()
  })

  it('adds coins, questions and clear stops', () => {
    const totals = totalsFor([record(), record({ correct: 1, coins: 10, perfect: false })])
    expect(totals.coins).toBe(60)
    expect(totals.correct).toBe(4)
    expect(totals.asked).toBe(6)
    expect(totals.perfectStops).toBe(1)
  })

  it('remembers the best-paying stop', () => {
    const totals = totalsFor([
      record({ coins: 10 }),
      record({ number: 2, coins: 90 }),
      record({ number: 3, coins: 40 }),
    ])
    expect(totals.best?.number).toBe(2)
  })

  it('counts a streak back from the most recent stop only', () => {
    expect(streakOf([])).toBe(0)
    expect(streakOf([record(), record()])).toBe(2)
    expect(streakOf([record(), record({ perfect: false })])).toBe(0)
    expect(streakOf([record({ perfect: false }), record(), record()])).toBe(2)
  })
})

describe('shop items', () => {
  it('has unique ids and a real explanation each', () => {
    expect(new Set(ITEMS.map((item) => item.id)).size).toBe(ITEMS.length)
    for (const item of ITEMS) {
      expect(item.price, item.id).toBeGreaterThan(0)
      expect(item.blurb.length, item.id).toBeGreaterThan(20)
      expect(item.when.length, item.id).toBeGreaterThan(10)
    }
  })

  it('prices everything within reach of one good stop', () => {
    // An item nobody can afford before the run ends is not an item. The
    // cheapest has to be buyable off a single clean Straight Up stop.
    const cheapest = Math.min(...ITEMS.map((item) => item.price))
    expect(cheapest).toBeLessThanOrEqual(maximumFor(cardById('straight-up')))
  })

  it('falls back rather than returning nothing for an unknown id', () => {
    expect(itemById('nonsense' as never)).toBe(ITEMS[0])
  })

  it('adds and spends without mutating', () => {
    const empty = {}
    const one = addItem(empty, 'shield')
    expect(empty).toEqual({})
    expect(heldOf(one, 'shield')).toBe(1)
    const two = addItem(one, 'shield')
    expect(heldOf(two, 'shield')).toBe(2)
    expect(heldOf(useItem(two, 'shield'), 'shield')).toBe(1)
  })

  it('cannot go below zero, even if the caller forgets to check', () => {
    const empty = {}
    expect(useItem(empty, 'reroll')).toEqual(empty)
    expect(heldOf(useItem(empty, 'reroll'), 'reroll')).toBe(0)
  })

  it('knows when the bag is empty', () => {
    expect(holdsAny({})).toBe(false)
    expect(holdsAny({ shield: 0 })).toBe(false)
    expect(holdsAny({ shield: 1 })).toBe(true)
  })

  it('spends the run purse, not the bank', () => {
    expect(purseOf(200, 60)).toBe(140)
    // Overspending is arithmetic that must not produce a negative payout.
    expect(purseOf(50, 90)).toBe(0)
    expect(canAfford(100, 0, itemById('shield'))).toBe(true)
    expect(canAfford(100, 40, itemById('shield'))).toBe(false)
  })
})

describe('what an item does to a stop', () => {
  const runOf = (seed: string) => buildRun({ seed, difficulty: 'medium', weakest: null })
  const gameStop = (seed: string): Stop => runOf(seed).stops.find((stop) => canReroll(stop)) as Stop

  it('offers a reroll on an ordinary stop and not at the fork', () => {
    const stops = runOf('items').stops
    expect(stops.filter(canReroll).every((stop) => !isFork(stop) && !isShop(stop))).toBe(true)
    expect(canReroll(stops[FORK_AT - 1] as Stop)).toBe(false)
    expect(canReroll(stops[SHOPS_AT[0]! - 1] as Stop)).toBe(false)
  })

  it('offers a card swap everywhere but the Boss and the shops', () => {
    const stops = runOf('items').stops
    expect(canSwap(stops[RUN_LENGTH - 1] as Stop)).toBe(false)
    expect(canSwap(stops[SHOPS_AT[0]! - 1] as Stop)).toBe(false)
    expect(canSwap(stops[1] as Stop)).toBe(true)
  })

  it('rerolls to a different game', () => {
    for (let seed = 0; seed < 30; seed++) {
      const stop = gameStop(`r${seed}`)
      const after = rerollGame(stop, null, seed)
      expect(after.games).toHaveLength(1)
      expect(after.games[0]).not.toBe(stop.games[0])
      // Everything else about the stop is untouched.
      expect(after.cardId).toBe(stop.cardId)
      expect(after.number).toBe(stop.number)
      expect(after.seed).toBe(stop.seed)
    }
  })

  it('keeps a rerolled Grudge Match inside the weakest topic', () => {
    // The item buys a different question, never a way out of the topic.
    for (let seed = 0; seed < 60; seed++) {
      const stop = runOf(`w${seed}`).stops.find(
        (entry) => cardOf(entry).weakestTopic === true && canReroll(entry),
      )
      if (stop === undefined) continue
      const after = rerollGame(stop, 'herbrand', seed)
      const game = MINIGAMES.find((entry) => entry.id === after.games[0])
      expect(game?.topics, after.games[0]).toContain('herbrand')
    }
  })

  it('swaps to a different card that the wheel could have dealt', () => {
    for (let seed = 0; seed < 30; seed++) {
      const stop = runOf(`s${seed}`).stops.find(canSwap) as Stop
      const after = swapCard(stop, seed)
      expect(after.cardId).not.toBe(stop.cardId)
      expect(WHEEL_CARDS.map((card) => card.id)).toContain(after.cardId)
      expect(after.games).toEqual(stop.games)
    }
  })

  it('gives a different result each time it is used', () => {
    // The nonce is what stops a second reroll handing back the first one.
    const stop = gameStop('nonce')
    const first = rerollGame(stop, null, 0)
    const second = rerollGame(first, null, 1)
    expect(second.games[0]).not.toBe(first.games[0])
  })
})
