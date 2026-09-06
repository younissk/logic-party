/**
 * Shop items.
 *
 * Bought mid-run out of what the run has earned so far, not out of the coins
 * already banked from earlier runs. That is the whole design: an item is
 * always paid for with money you were about to take home, so buying one is a
 * bet on the stops still to come rather than a purchase.
 *
 * Every item had to be generic. The minigames answer in a dozen different
 * shapes — sort boards, term builders, truth tables — so anything that wanted
 * to "halve the options" or "fill in a cell" could only ever work for a few of
 * them. What is left are four things that act on the *run* rather than on an
 * answer, and none of them is an answer key: the app's whole position is that
 * a wrong answer must not be a hint, and a coin does not change that.
 */

export type ItemId = 'reroll' | 'swap' | 'shield' | 'cash-out'

export interface Item {
  id: ItemId
  name: string
  icon: string
  price: number
  /** One line, on the shop shelf. */
  blurb: string
  /** When it can be used, for the shop's own explanation. */
  when: string
}

export const ITEMS: readonly Item[] = [
  {
    id: 'cash-out',
    name: 'Cash Out',
    icon: '💰',
    price: 30,
    blurb: 'End a stop early and keep what you have answered.',
    when: 'While playing a stop.',
  },
  {
    id: 'reroll',
    name: 'Reroll',
    icon: '🎲',
    price: 40,
    blurb: 'Spin again for a different minigame at this stop.',
    when: 'Before a stop begins. Not at the fork — that is already a choice.',
  },
  {
    id: 'swap',
    name: 'Card Swap',
    icon: '🃏',
    price: 60,
    blurb: 'Draw a different rule card.',
    when: 'Before a stop begins. The Boss keeps its card.',
  },
  {
    id: 'shield',
    name: 'Shield',
    icon: '🛡️',
    price: 80,
    blurb: 'One wrong answer forgiven — it counts as right and cannot end the stop.',
    when: 'Armed before a stop begins, spent on the first wrong answer.',
  },
]

export const itemById = (id: ItemId): Item =>
  ITEMS.find((item) => item.id === id) ?? (ITEMS[0] as Item)

export type Inventory = Partial<Record<ItemId, number>>

export const heldOf = (inventory: Inventory, id: ItemId): number => inventory[id] ?? 0

export const holdsAny = (inventory: Inventory): boolean =>
  ITEMS.some((item) => heldOf(inventory, item.id) > 0)

/** Add one, without mutating what was passed in. */
export const addItem = (inventory: Inventory, id: ItemId): Inventory => ({
  ...inventory,
  [id]: heldOf(inventory, id) + 1,
})

/**
 * Take one, if there is one. Returns the inventory unchanged when there is
 * not, so a caller that forgets to check cannot go negative.
 */
export function useItem(inventory: Inventory, id: ItemId): Inventory {
  const held = heldOf(inventory, id)
  if (held <= 0) return inventory
  return { ...inventory, [id]: held - 1 }
}

/** What the run has left to spend: what it has earned, minus what it has spent. */
export const purseOf = (earned: number, spent: number): number => Math.max(0, earned - spent)

export const canAfford = (earned: number, spent: number, item: Item): boolean =>
  purseOf(earned, spent) >= item.price
