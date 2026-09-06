/**
 * A shop stop.
 *
 * Spends the run's own earnings, not the coins already banked from previous
 * runs. That is what makes a purchase a decision: every item is paid for out
 * of money that was otherwise going home with you, so the question is always
 * whether the stops still to come are worth more than the coins in hand.
 */

import { Button, Card } from '@/ui/primitives'
import { MovingItem, MovingList } from '@/ui/motion'
import { ITEMS, heldOf, purseOf, type Inventory, type ItemId } from './items'

export interface ShopProps {
  /** What the run has earned so far. */
  earned: number
  /** What it has already spent here. */
  spent: number
  inventory: Inventory
  onBuy: (id: ItemId) => void
  onLeave: () => void
}

export function Shop({ earned, spent, inventory, onBuy, onLeave }: ShopProps) {
  const purse = purseOf(earned, spent)

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="shout text-2xl text-space-blue">Shop</h2>
        <span className="text-lg font-black tabular-nums">🪙 {purse}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-ink-soft">
        Paid for out of this run&apos;s earnings. Whatever you do not spend goes home with you.
      </p>

      <MovingList className="mt-3 flex flex-col gap-2">
        {ITEMS.map((item) => {
          const held = heldOf(inventory, item.id)
          const affordable = purse >= item.price
          return (
            <MovingItem
              key={item.id}
              id={item.id}
              disabled={!affordable}
              onClick={() => affordable && onBuy(item.id)}
              className={`tile flex items-center gap-3 px-3 py-2 text-left ${
                affordable ? 'bg-card-shade' : 'bg-card-shade opacity-55'
              }`}
            >
              <span className="text-2xl leading-none">{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-sm font-black">{item.name}</span>
                  {held > 0 && (
                    <span className="rounded-full bg-grass px-2 text-xs font-black text-white">
                      ×{held}
                    </span>
                  )}
                </span>
                <span className="block text-xs font-medium text-ink-soft">{item.blurb}</span>
                <span className="block text-[0.65rem] font-medium text-ink-soft opacity-80">
                  {item.when}
                </span>
              </span>
              <span className="shrink-0 text-sm font-black tabular-nums">🪙 {item.price}</span>
            </MovingItem>
          )
        })}
      </MovingList>

      <Button variant="coin" className="mt-3 w-full" onClick={onLeave}>
        Leave the shop
      </Button>
    </Card>
  )
}
