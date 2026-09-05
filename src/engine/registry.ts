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
import { blockedLiteralGame } from '@/games/blockedLiteral'
import { cnfPipelineGame } from '@/games/cnfPipeline'
import { colouringGame } from '@/games/colouring'
import { conflictClauseGame } from '@/games/conflictClause'
import { dpGame } from '@/games/dpEliminate'
import { dpllGame } from '@/games/dpllLeaves'
import { derivableGame } from '@/games/derivable'
import { entailmentRefutationGame } from '@/games/entailmentRefutation'
import { equivalenceGame } from '@/games/equivalence'
import { modelSortGame } from '@/games/modelSort'
import { oneStepGame } from '@/games/oneStep'
import { learnedClauseGame } from '@/games/learnedClause'
import { modelCountGame } from '@/games/modelCount'
import { propertyGame } from '@/games/property'
import { refutationGame } from '@/games/refutation'
import { rupBuilderGame } from '@/games/rupBuilder'
import { rupGame } from '@/games/rupProof'
import { resolventsGame } from '@/games/resolvents'
import { compositionGame } from '@/games/composition'
import { matchingGame } from '@/games/matching'
import { moreGeneralGame } from '@/games/moreGeneral'
import { mguGame } from '@/games/mgu'
import { occursCheckGame } from '@/games/occursCheck'
import { theoryChainGame } from '@/games/theoryChain'
import { normalFormHuntGame } from '@/games/normalFormHunt'
import { criticalPairsGame } from '@/games/criticalPairs'
import { completionGame } from '@/games/completion'
import { boundFreeGame } from '@/games/boundFree'
import { foEvaluateGame } from '@/games/foEvaluate'
import { prenexGame } from '@/games/prenex'
import { clausifyGame } from '@/games/clausify'
import { skolemGame } from '@/games/skolem'
import { wellFormedGame } from '@/games/wellFormed'
import { pairRenamingGame } from '@/games/pairRenaming'
import { orientGame } from '@/games/orientRules'
import { reduceGame } from '@/games/reduceTerm'
import { theoryDecideGame } from '@/games/theoryDecide'
import { unifiableSortGame } from '@/games/unifiableSort'
import { interpretationGame } from '@/games/interpretationGame'
import { termBuildGame } from '@/games/termBuild'
import { termFlatGame } from '@/games/termFlat'
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
  modelSortGame,
  colouringGame,
  oneStepGame,
  entailmentRefutationGame,
  rupBuilderGame,
  blockedLiteralGame,
  termFlatGame,
  termBuildGame,
  interpretationGame,
  compositionGame,
  moreGeneralGame,
  matchingGame,
  mguGame,
  unifiableSortGame,
  occursCheckGame,
  theoryChainGame,
  theoryDecideGame,
  reduceGame,
  normalFormHuntGame,
  orientGame,
  criticalPairsGame,
  pairRenamingGame,
  completionGame,
  wellFormedGame,
  boundFreeGame,
  foEvaluateGame,
  prenexGame,
  skolemGame,
  clausifyGame,
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
