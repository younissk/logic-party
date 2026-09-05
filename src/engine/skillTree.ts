/**
 * The skill tree: which exercises you can start, and which are still shut.
 *
 * Prerequisites live on the syllabus items rather than on the minigames,
 * because the tree has to cover exercises that have no minigame yet — an
 * unbuilt item still sits downstream of something.
 *
 * A prerequisite is *cleared* rather than merely played. The bar is low on
 * purpose: enough attempts that the mechanics are familiar, and enough
 * accuracy that the idea landed. It is a study aid, not a difficulty gate.
 */

import { CATEGORIES, type Category, type SyllabusItem } from './categories'
import { getMinigame } from './registry'
import { statsForGame, type ProgressState } from '@/store/progress'

/** Attempts needed before a prerequisite counts as cleared. */
export const CLEAR_ATTEMPTS = 5

/** Accuracy needed over those attempts. */
export const CLEAR_ACCURACY = 0.6

export type NodeState = 'cleared' | 'available' | 'locked' | 'unbuilt'

export interface SkillNode {
  item: SyllabusItem
  category: Category
  /** Section letter and name, so the tree lays out in the plan's own rows. */
  letter: string
  section: string
  state: NodeState
  /** Prerequisites not yet cleared. Empty unless `state` is 'locked'. */
  blockedBy: SyllabusItem[]
  /** Progress towards clearing this node itself. */
  attempts: number
  accuracy: number
}

/** Every syllabus item across every category, in plan order. */
export function allItems(): {
  item: SyllabusItem
  category: Category
  letter: string
  section: string
}[] {
  return CATEGORIES.flatMap((category) =>
    (category.sections ?? []).flatMap((section) =>
      section.items.map((item) => ({
        item,
        category: category.id,
        letter: section.letter,
        section: section.title,
      })),
    ),
  )
}

export function itemById(id: string): SyllabusItem | undefined {
  return allItems().find((entry) => entry.item.id === id)?.item
}

/** Has this item been practised enough to count as understood? */
export function isCleared(item: SyllabusItem, progress: ProgressState): boolean {
  if (item.game === undefined) return false
  const stats = statsForGame(item.game, progress)
  return stats.attempts >= CLEAR_ATTEMPTS && stats.accuracy >= CLEAR_ACCURACY
}

/**
 * The whole tree, resolved against saved progress.
 *
 * An item with no minigame is 'unbuilt' whatever its prerequisites say —
 * there is nothing to unlock, and showing it as locked would blame the player
 * for something that is simply not written yet.
 */
export function skillTree(progress: ProgressState): SkillNode[] {
  const entries = allItems()
  const byId = new Map(entries.map((entry) => [entry.item.id, entry.item]))

  return entries.map(({ item, category, letter, section }) => {
    const stats = item.game === undefined ? { attempts: 0, accuracy: 0 } : statsForGame(item.game, progress)
    const blockedBy = (item.requires ?? [])
      .map((id) => byId.get(id))
      .filter((required): required is SyllabusItem => required !== undefined)
      .filter((required) => !isCleared(required, progress))

    const state: NodeState =
      item.game === undefined || getMinigame(item.game) === undefined
        ? 'unbuilt'
        : isCleared(item, progress)
          ? 'cleared'
          : blockedBy.length > 0
            ? 'locked'
            : 'available'

    return { item, category, letter, section, state, blockedBy, attempts: stats.attempts, accuracy: stats.accuracy }
  })
}

/** Is this minigame playable yet? Unknown ids are treated as playable. */
export function unlockStateFor(gameId: string, progress: ProgressState): SkillNode | undefined {
  return skillTree(progress).find((node) => node.item.game === gameId)
}

export interface TreeSummary {
  cleared: number
  available: number
  locked: number
  unbuilt: number
}

export function summarise(nodes: readonly SkillNode[]): TreeSummary {
  return {
    cleared: nodes.filter((node) => node.state === 'cleared').length,
    available: nodes.filter((node) => node.state === 'available').length,
    locked: nodes.filter((node) => node.state === 'locked').length,
    unbuilt: nodes.filter((node) => node.state === 'unbuilt').length,
  }
}

/**
 * Items that become available the moment a given one is cleared.
 *
 * Shown on a node so the tree reads forwards as well as backwards: the point
 * of finishing something is what it opens.
 */
export function unlockedBy(id: string): SyllabusItem[] {
  return allItems()
    .map((entry) => entry.item)
    .filter((item) => (item.requires ?? []).includes(id))
}
