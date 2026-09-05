// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getMinigame, MINIGAMES } from './registry'
import { skillTree } from './skillTree'
import { emptyProgress } from '@/store/progress'
import {
  CATEGORIES,
  CATEGORY_BY_ID,
  categoriesOf,
  sectionProgress,
  syllabusItems,
  TOPIC_CATEGORY,
} from './categories'
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

  it('points every syllabus item at a minigame that exists', () => {
    // A typo in a game id would silently render the item as "soon" forever —
    // it would look planned rather than broken.
    for (const category of CATEGORIES) {
      for (const item of syllabusItems(category.id)) {
        if (item.game === undefined) continue
        expect(getMinigame(item.game), `${category.id}: ${item.title}`).toBeDefined()
      }
    }
  })

  it('gives every registered minigame a place in its chapter plan', () => {
    // The other direction, and the one that actually bites: a new minigame
    // that nobody added to a section would be unreachable from the category
    // page even though it is registered.
    const placed = new Set(
      CATEGORIES.flatMap((category) => syllabusItems(category.id))
        .map((item) => item.game)
        .filter((id): id is string => id !== undefined),
    )
    for (const game of MINIGAMES) {
      const planned = categoriesOf(game.topics).some(
        (category) => CATEGORY_BY_ID[category].sections !== undefined,
      )
      if (!planned) continue
      expect(placed, `${game.id} is registered but in no section`).toContain(game.id)
    }
  })

  it('numbers the study plan without gaps or repeats', () => {
    // The plan numbers 1–75 across the whole course rather than restarting per
    // chapter, so this is one sequence, checked as one.
    const numbers = CATEGORIES.flatMap((category) => syllabusItems(category.id))
      .map((item) => item.n)
      .filter((n): n is number => n !== undefined)

    expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
    expect(new Set(numbers).size).toBe(numbers.length)
    expect(numbers).toEqual(numbers.map((_, index) => index + 1))
  })

  it('records nothing that is about one particular student', () => {
    // The syllabus is course material, so it has to be usable by anyone
    // taking the course. Anything derived from one person's own marks is not.
    for (const category of CATEGORIES) {
      for (const item of syllabusItems(category.id)) {
        expect(item, item.id).not.toHaveProperty('priority')
        expect(item, item.id).not.toHaveProperty('score')
        expect(item, item.id).not.toHaveProperty('weakness')
      }
    }
  })

  it('plans every chapter, not only the one with minigames', () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_BY_ID[category.id].sections, category.id).toBeDefined()
      expect(syllabusItems(category.id).length, category.id).toBeGreaterThan(0)
    }
  })

  it('says where every syllabus item comes from', () => {
    // Without a source line the plan is a list of names, and the point is to
    // be able to go back to the notes or the paper it was asked in.
    for (const category of CATEGORIES) {
      for (const item of syllabusItems(category.id)) {
        expect(item.source.length, item.title).toBeGreaterThan(3)
      }
    }
  })

  it('gives every syllabus item a unique id', () => {
    const ids = CATEGORIES.flatMap((category) => syllabusItems(category.id)).map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('points every prerequisite at an item that exists', () => {
    const ids = new Set(CATEGORIES.flatMap((category) => syllabusItems(category.id)).map((i) => i.id))
    for (const category of CATEGORIES) {
      for (const item of syllabusItems(category.id)) {
        for (const required of item.requires ?? []) {
          expect(ids, `${item.id} requires ${required}`).toContain(required)
        }
      }
    }
  })

  it('has no cycles in the skill tree', () => {
    // A cycle would lock both ends of it forever, and nothing in the UI would
    // say why — the nodes would simply never become available.
    const items = CATEGORIES.flatMap((category) => syllabusItems(category.id))
    const byId = new Map(items.map((item) => [item.id, item]))
    const state = new Map<string, 'visiting' | 'done'>()

    const walk = (id: string, trail: string[]): void => {
      if (state.get(id) === 'done') return
      expect(state.get(id), `cycle: ${[...trail, id].join(' → ')}`).not.toBe('visiting')
      state.set(id, 'visiting')
      for (const required of byId.get(id)?.requires ?? []) walk(required, [...trail, id])
      state.set(id, 'done')
    }

    for (const item of items) walk(item.id, [])
  })

  it('leaves at least one item open with no progress at all', () => {
    // A tree where everything is locked on a fresh install has no entry point.
    const fresh = emptyProgress()
    const open = skillTree(fresh).filter((node) => node.state === 'available')
    expect(open.length).toBeGreaterThan(0)
  })

  it('never explains a prerequisite it does not have', () => {
    for (const category of CATEGORIES) {
      for (const item of syllabusItems(category.id)) {
        if (item.why === undefined) continue
        expect((item.requires ?? []).length, `${item.id} has a why but no requires`).toBeGreaterThan(0)
      }
    }
  })

  it('explains every lock it imposes', () => {
    // A locked node with no reason is just an obstacle.
    for (const category of CATEGORIES) {
      for (const item of syllabusItems(category.id)) {
        if ((item.requires ?? []).length === 0) continue
        expect(item.why, `${item.id} locks without saying why`).toBeDefined()
      }
    }
  })

  it('reports how much of a chapter is built', () => {
    // Propositional is finished: every exercise type in the plan has a
    // minigame, so built and total are equal rather than one short.
    const propositional = sectionProgress('propositional')
    expect(propositional.built).toBe(propositional.total)
    expect(propositional.built).toBe(
      MINIGAMES.filter((game) => categoriesOf(game.topics).includes('propositional')).length,
    )
    // Equational is finished too.
    const equational = sectionProgress('equational')
    expect(equational.built).toBe(equational.total)

    // First-order is finished too.
    const firstOrder = sectionProgress('first-order')
    expect(firstOrder.built).toBe(firstOrder.total)

    // Theories is under way: some of it is built, never more than all of it.
    const theories = sectionProgress('fol-theories')
    expect(theories.built).toBeGreaterThan(0)
    expect(theories.built).toBeLessThanOrEqual(theories.total)
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
