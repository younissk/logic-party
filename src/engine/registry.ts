/**
 * Minigame registry.
 *
 * One import line per game — that is the entire cost of adding one.
 */

import type { AnyMinigame, Minigame, Topic } from './types'
import { truthTableGame } from '@/games/truthTable'

/** Identity function that keeps a minigame's Question/Answer types inferred. */
export function defineMinigame<Question, Answer>(
  game: Minigame<Question, Answer>,
): Minigame<Question, Answer> {
  return game
}

export const MINIGAMES: readonly AnyMinigame[] = [truthTableGame]

export function getMinigame(id: string): AnyMinigame | undefined {
  return MINIGAMES.find((game) => game.id === id)
}

export function minigamesForTopic(topic: Topic): AnyMinigame[] {
  return MINIGAMES.filter((game) => game.topics.includes(topic))
}

/** Topics that at least one implemented minigame covers. */
export function coveredTopics(): Topic[] {
  const topics = new Set<Topic>()
  for (const game of MINIGAMES) for (const topic of game.topics) topics.add(topic)
  return [...topics]
}
