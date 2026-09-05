/**
 * Minigame registry.
 *
 * One import line per game — that is the entire cost of adding one.
 */

import type { AnyMinigame, Minigame, Topic } from './types'
import type { Category } from './categories'
import { categoriesOf } from './categories'
import { bcpGame } from '@/games/bcpFixpoint'
import { blockedClausesGame } from '@/games/blockedClauses'
import { cnfPipelineGame } from '@/games/cnfPipeline'
import { conflictClauseGame } from '@/games/conflictClause'
import { dpGame } from '@/games/dpEliminate'
import { dpllGame } from '@/games/dpllLeaves'
import { derivableGame } from '@/games/derivable'
import { equivalenceGame } from '@/games/equivalence'
import { learnedClauseGame } from '@/games/learnedClause'
import { modelCountGame } from '@/games/modelCount'
import { propertyGame } from '@/games/property'
import { refutationGame } from '@/games/refutation'
import { rupGame } from '@/games/rupProof'
import { resolventsGame } from '@/games/resolvents'
import { tseitinGame } from '@/games/tseitin'
import { truthTableGame } from '@/games/truthTable'

/** Identity function that keeps a minigame's Question/Answer types inferred. */
export function defineMinigame<Question, Answer>(
  game: Minigame<Question, Answer>,
): Minigame<Question, Answer> {
  return game
}

export const MINIGAMES: readonly AnyMinigame[] = [
  truthTableGame,
  propertyGame,
  modelCountGame,
  cnfPipelineGame,
  tseitinGame,
  equivalenceGame,
  resolventsGame,
  derivableGame,
  refutationGame,
  bcpGame,
  dpGame,
  dpllGame,
  conflictClauseGame,
  learnedClauseGame,
  rupGame,
  blockedClausesGame,
]

export function getMinigame(id: string): AnyMinigame | undefined {
  return MINIGAMES.find((game) => game.id === id)
}

export function minigamesForTopic(topic: Topic): AnyMinigame[] {
  return MINIGAMES.filter((game) => game.topics.includes(topic))
}

export function minigamesInCategory(category: Category): AnyMinigame[] {
  return MINIGAMES.filter((game) => categoriesOf(game.topics).includes(category))
}

/** Topics that at least one implemented minigame covers. */
export function coveredTopics(): Topic[] {
  const topics = new Set<Topic>()
  for (const game of MINIGAMES) for (const topic of game.topics) topics.add(topic)
  return [...topics]
}
