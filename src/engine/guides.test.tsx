// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MINIGAMES } from './registry'
import { CATEGORIES, CATEGORY_BY_ID, categoriesOf, TOPIC_CATEGORY } from './categories'
import type { Topic } from './types'

const guides = MINIGAMES.filter((game) => game.Guide !== undefined)

describe('guides', () => {
  it('every minigame has one', () => {
    // A minigame without a guide is one you cannot revise from, only be tested
    // by. If this fails, write the guide rather than deleting the assertion.
    expect(MINIGAMES.map((game) => game.id).filter((id) => !guides.some((g) => g.id === id))).toEqual(
      [],
    )
  })

  it.each(guides.map((game) => [game.id, game] as const))(
    'the %s guide renders without throwing',
    (_id, game) => {
      const GuideBody = game.Guide as React.ComponentType
      // Guides parse formula strings while rendering, so a typo in one is a
      // crashed page rather than a type error. This is what catches it.
      expect(() => render(<GuideBody />)).not.toThrow()
    },
  )

  it.each(guides.map((game) => [game.id, game] as const))(
    'the %s guide actually says something',
    (_id, game) => {
      const GuideBody = game.Guide as React.ComponentType
      const { container } = render(<GuideBody />)
      expect(container.textContent?.length ?? 0).toBeGreaterThan(500)
      expect(screen.getAllByRole('table').length).toBeGreaterThan(0)
    },
  )
})

describe('categories', () => {
  it('has unique ids', () => {
    const ids = CATEGORIES.map((category) => category.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('indexes every category by id', () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_BY_ID[category.id]).toBe(category)
    }
  })

  it('places every topic in a category that exists', () => {
    for (const category of Object.values(TOPIC_CATEGORY)) {
      expect(CATEGORY_BY_ID[category]).toBeDefined()
    }
  })

  it('gives every minigame a home', () => {
    for (const game of MINIGAMES) {
      expect(categoriesOf(game.topics).length, game.id).toBeGreaterThan(0)
    }
  })

  it('describes what an empty category is for', () => {
    // An empty category with no planned list is a dead end for the reader.
    for (const category of CATEGORIES) {
      expect(category.planned.length, category.id).toBeGreaterThan(0)
    }
  })

  it('de-duplicates when several topics share a chapter', () => {
    const topics: Topic[] = ['truth-tables', 'equivalence', 'resolution']
    expect(categoriesOf(topics)).toEqual(['propositional'])
  })
})
