// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ITEMS, itemById } from './items'
import { Shop } from './Shop'

const shelf = (item: (typeof ITEMS)[number]) =>
  screen.getByText(item.name).closest('button') as HTMLButtonElement

describe('the shop', () => {
  it('shows every item with its price', () => {
    render(<Shop earned={500} spent={0} inventory={{}} onBuy={() => {}} onLeave={() => {}} />)
    for (const item of ITEMS) {
      expect(screen.getByText(item.name)).toBeTruthy()
      expect(screen.getAllByText(`🪙 ${item.price}`).length).toBeGreaterThan(0)
    }
  })

  it('shows the purse as what the run has left, not what it has earned', () => {
    render(<Shop earned={200} spent={60} inventory={{}} onBuy={() => {}} onLeave={() => {}} />)
    expect(screen.getByText('🪙 140')).toBeTruthy()
  })

  it('buys an item you can afford', () => {
    const onBuy = vi.fn()
    render(<Shop earned={500} spent={0} inventory={{}} onBuy={onBuy} onLeave={() => {}} />)
    shelf(itemById('shield')).click()
    expect(onBuy).toHaveBeenCalledWith('shield')
  })

  it('refuses one you cannot, without calling back', () => {
    const onBuy = vi.fn()
    // Enough for the cheapest and nothing else.
    const cheapest = ITEMS.reduce((low, item) => (item.price < low.price ? item : low))
    const dearest = ITEMS.reduce((high, item) => (item.price > high.price ? item : high))
    render(
      <Shop earned={cheapest.price} spent={0} inventory={{}} onBuy={onBuy} onLeave={() => {}} />,
    )
    expect(shelf(dearest).disabled).toBe(true)
    shelf(dearest).click()
    expect(onBuy).not.toHaveBeenCalled()

    shelf(cheapest).click()
    expect(onBuy).toHaveBeenCalledWith(cheapest.id)
  })

  it('counts what is already in the bag', () => {
    render(
      <Shop
        earned={500}
        spent={0}
        inventory={{ shield: 2, reroll: 1 }}
        onBuy={() => {}}
        onLeave={() => {}}
      />,
    )
    expect(screen.getByText('×2')).toBeTruthy()
    // One is worth showing too — on a shelf the question is what you own,
    // not whether you own several. (The header abbreviates; this does not.)
    expect(screen.getByText('×1')).toBeTruthy()
    expect(screen.queryByText('×3')).toBeNull()
  })

  it('can always be left, even with nothing affordable', () => {
    const onLeave = vi.fn()
    render(<Shop earned={0} spent={0} inventory={{}} onBuy={() => {}} onLeave={onLeave} />)
    for (const item of ITEMS) expect(shelf(item).disabled).toBe(true)
    screen.getByText('Leave the shop').click()
    expect(onLeave).toHaveBeenCalled()
  })
})
