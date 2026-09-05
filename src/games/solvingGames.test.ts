import { describe, expect, it } from 'vitest'

import {
  bcp,
  clauseKey,
  clauseSetToFormula,
  countLeaves,
  dpll,
  eliminateVariable,
  isSatisfiable,
  isTautologicalClause,
  isUnsatisfiableTree,
  leaves,
  learnFromDecisions,
  makeRng,
  showClauseSet,
  treeToRefutation,
  type Clause,
} from '@/logic'
import { DIFFICULTIES, type Difficulty } from '@/engine/types'
import { bcpGame, type BcpQuestion } from './bcpFixpoint'
import { dpGame, type DpQuestion } from './dpEliminate'
import { dpllGame, type DpllQuestion } from './dpllLeaves'
import { conflictClauseGame, type ConflictQuestion } from './conflictClause'
import { learnedClauseGame, type LearnedQuestion } from './learnedClause'

/**
 * Generation is expensive for these games — several need a *satisfiable* or
 * *unsatisfiable* clause set found by rejection sampling — so each sample is
 * built once per difficulty and shared across the assertions that use it.
 * Without this the suite is slow enough to time out on a slower machine.
 */
const cache = new Map<string, unknown[]>()

const draw = <Q,>(
  game: { generate: (c: never) => Q },
  key: string,
  difficulty: Difficulty,
  count: number,
): Q[] => {
  const id = `${key}:${difficulty}:${count}`
  const seen = cache.get(id)
  if (seen !== undefined) return seen as Q[]
  const made = Array.from({ length: count }, (_, i) =>
    game.generate({ rng: makeRng(`s-${i}`), difficulty, questionIndex: i } as never),
  )
  cache.set(id, made)
  return made
}

const setKey = (set: readonly Clause[]) => [...set.map(clauseKey)].sort().join(';')

describe('BCP game', () => {
  const sample = (d: Difficulty, n: number) => draw<BcpQuestion>(bcpGame, 'bcpGame', d, n)

  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 100)) {
      expect(bcpGame.check(question, bcpGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the right option really is the fixpoint on %s', (difficulty) => {
    for (const question of sample(difficulty, 100)) {
      const truth = bcp(question.clauses).result
      expect(setKey(question.options[question.answer] as Clause[]), showClauseSet(question.clauses)).toBe(
        setKey(truth),
      )
    }
  })

  it.each(DIFFICULTIES)('no wrong option is secretly right on %s', (difficulty) => {
    for (const question of sample(difficulty, 100)) {
      const truth = setKey(bcp(question.clauses).result)
      question.options.forEach((option, index) => {
        if (index === question.answer) return
        expect(setKey(option), showClauseSet(question.clauses)).not.toBe(truth)
      })
    }
  })

  it.each(DIFFICULTIES)('always needs more than one propagation on %s', (difficulty) => {
    for (const question of sample(difficulty, 100)) {
      expect(bcp(question.clauses).steps.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('asks about all three outcomes', () => {
    for (const difficulty of DIFFICULTIES) {
      const outcomes = sample(difficulty, 200).map((q) => bcp(q.clauses).outcome)
      for (const outcome of ['satisfiable', 'unsatisfiable', 'undecided'] as const) {
        expect(outcomes.filter((o) => o === outcome).length, `${outcome} on ${difficulty}`).toBeGreaterThan(10)
      }
    }
  })
})

describe('DP game', () => {
  const sample = (d: Difficulty, n: number) => draw<DpQuestion>(dpGame, 'dpGame', d, n)

  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 100)) {
      expect(dpGame.check(question, dpGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the right option really is the elimination on %s', (difficulty) => {
    for (const question of sample(difficulty, 100)) {
      const truth = eliminateVariable(question.clauses, question.variable).result
      expect(setKey(question.options[question.answer] as Clause[])).toBe(setKey(truth))
    }
  })

  it.each(DIFFICULTIES)('never leaves a tautology in the right answer on %s', (difficulty) => {
    for (const question of sample(difficulty, 100)) {
      for (const clause of question.options[question.answer] as Clause[]) {
        expect(isTautologicalClause(clause), showClauseSet(question.clauses)).toBe(false)
      }
    }
  })

  it.each(DIFFICULTIES)('always has a tautology to drop on %s', (difficulty) => {
    // The rule being tested is "throw away the tautologies", so a question
    // with none never exercises it.
    for (const question of sample(difficulty, 100)) {
      expect(
        eliminateVariable(question.clauses, question.variable).discarded.length,
        showClauseSet(question.clauses),
      ).toBeGreaterThan(0)
    }
  })

  it.each(DIFFICULTIES)('preserves satisfiability on %s', (difficulty) => {
    // DP's whole licence: elimination is satisfiability-preserving.
    for (const question of sample(difficulty, 60)) {
      const before = isSatisfiable(clauseSetToFormula(question.clauses))
      const after = eliminateVariable(question.clauses, question.variable).result
      expect(isSatisfiable(clauseSetToFormula(after)), showClauseSet(question.clauses)).toBe(before)
    }
  })
})

describe('DPLL game', () => {
  const sample = (d: Difficulty, n: number) => draw<DpllQuestion>(dpllGame, 'dpllGame', d, n)

  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 80)) {
      expect(dpllGame.check(question, dpllGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the answer is the leaf count on %s', (difficulty) => {
    for (const question of sample(difficulty, 80)) {
      expect(dpllGame.solve(question)).toBe(countLeaves(dpll(question.clauses)))
    }
  })

  it.each(DIFFICULTIES)('always involves propagation somewhere on %s', (difficulty) => {
    // Without it the count is just 2ⁿ and needs no understanding of BCP.
    for (const question of sample(difficulty, 80)) {
      expect(
        leaves(dpll(question.clauses)).some((leaf) => leaf.propagated.length > 0),
        showClauseSet(question.clauses),
      ).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('only ever poses an unsatisfiable set on %s', (difficulty) => {
    // Algorithm 2.42 returns as soon as a branch succeeds, so on a satisfiable
    // formula a real run stops early and the leaf count is not well defined.
    for (const question of sample(difficulty, 80)) {
      expect(isSatisfiable(clauseSetToFormula(question.clauses)), showClauseSet(question.clauses)).toBe(false)
      expect(isUnsatisfiableTree(dpll(question.clauses))).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('keeps the answer inside the keypad on %s', (difficulty) => {
    for (const question of sample(difficulty, 80)) {
      const answer = dpllGame.solve(question) as number
      expect(answer).toBeGreaterThanOrEqual(1)
      expect(answer).toBeLessThanOrEqual(8)
    }
  })
})

describe('conflict clause game', () => {
  const sample = (d: Difficulty, n: number) => draw<ConflictQuestion>(conflictClauseGame, 'conflictClauseGame', d, n)

  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(conflictClauseGame.check(question, conflictClauseGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the named clause really is false at that leaf on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      const leaf = leaves(dpll(question.clauses))[question.leaf]
      const assigned = new Map((leaf?.path ?? []).map((literal) => [literal.name, !literal.negated]))
      for (const literal of question.clauses[question.answer] as Clause) {
        expect(assigned.get(literal.name), showClauseSet(question.clauses)).toBe(literal.negated)
      }
    }
  })

  it.each(DIFFICULTIES)('exactly one clause is false at the asked leaf on %s', (difficulty) => {
    // Two would make two answers right, and the question unmarkable.
    for (const question of sample(difficulty, 60)) {
      const leaf = leaves(dpll(question.clauses))[question.leaf]
      const assigned = new Map((leaf?.path ?? []).map((literal) => [literal.name, !literal.negated]))
      const falsified = question.clauses.filter((clause) =>
        clause.every((literal) => assigned.get(literal.name) === literal.negated),
      )
      expect(falsified, showClauseSet(question.clauses)).toHaveLength(1)
    }
  })

  it.each(DIFFICULTIES)('every question mirrors into a real refutation on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      const mirror = treeToRefutation(dpll(question.clauses))
      expect(mirror, showClauseSet(question.clauses)).not.toBeNull()
      expect(clauseKey((mirror as { clause: Clause }).clause)).toBe('')
    }
  })
})

describe('learned clause game', () => {
  const sample = (d: Difficulty, n: number) => draw<LearnedQuestion>(learnedClauseGame, 'learnedClauseGame', d, n)

  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(learnedClauseGame.check(question, learnedClauseGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the right option is the negation of the decisions on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(clauseKey(question.options[question.answer] as Clause)).toBe(
        clauseKey(learnFromDecisions(question.decisions).clause),
      )
    }
  })

  it.each(DIFFICULTIES)('always shows both a decision and a propagation on %s', (difficulty) => {
    // Telling the two apart is the whole question.
    for (const question of sample(difficulty, 60)) {
      expect(question.decisions.length).toBeGreaterThan(0)
      expect(question.propagated.length).toBeGreaterThan(0)
    }
  })

  it.each(DIFFICULTIES)('never offers the same clause twice on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      const keys = question.options.map(clauseKey)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('never puts a propagated literal in the right answer', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(difficulty, 60)) {
        const propagated = new Set(question.propagated.map((literal) => literal.name))
        for (const literal of question.options[question.answer] as Clause) {
          expect(propagated.has(literal.name), showClauseSet(question.clauses)).toBe(false)
        }
      }
    }
  })
})
