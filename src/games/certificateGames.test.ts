import { describe, expect, it } from 'vitest'

import {
  bce,
  bcp,
  blockingLiteral,
  clauseKey,
  clauseSetToFormula,
  hasRupProperty,
  isSatisfiable,
  makeRng,
  showClause,
  showClauseSet,
  type Clause,
} from '@/logic'
import { DIFFICULTIES, type Difficulty } from '@/engine/types'
import { rupGame, type RupQuestion } from './rupProof'
import { blockedClausesGame, type BlockedQuestion } from './blockedClauses'

const draw = <Q,>(game: { generate: (c: never) => Q }, difficulty: Difficulty, count: number): Q[] =>
  Array.from({ length: count }, (_, i) =>
    game.generate({ rng: makeRng(`c-${i}`), difficulty, questionIndex: i } as never),
  )

describe('RUP game', () => {
  const sample = (d: Difficulty, n: number) => draw<RupQuestion>(rupGame, d, n)

  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(rupGame.check(question, rupGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('every ticked candidate really has the property on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      const context = [...question.clauses, ...question.derived]
      question.candidates.forEach((clause, index) => {
        expect(question.rup.includes(index), showClause(clause)).toBe(hasRupProperty(context, clause))
      })
    }
  })

  it.each(DIFFICULTIES)('is never all and never none on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(question.rup.length).toBeGreaterThan(0)
      expect(question.rup.length).toBeLessThan(question.candidates.length)
    }
  })

  it.each(DIFFICULTIES)('always offers ⊥, and marks it right only when BCP alone crashes on %s', (difficulty) => {
    // The special case: negating ⊥ adds no units, so it has the property
    // exactly when plain propagation already reaches a conflict.
    for (const question of sample(difficulty, 60)) {
      const index = question.candidates.findIndex((clause) => clause.length === 0)
      expect(index, showClauseSet(question.clauses)).toBeGreaterThanOrEqual(0)
      const context = [...question.clauses, ...question.derived]
      expect(question.rup.includes(index)).toBe(bcp(context).outcome === 'unsatisfiable')
    }
  })

  it.each(DIFFICULTIES)('only poses formulas a RUP refutation exists for on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(isSatisfiable(clauseSetToFormula(question.clauses)), showClauseSet(question.clauses)).toBe(
        false,
      )
    }
  })

  it('accepts a correct answer in any order', () => {
    const rng = makeRng('order')
    for (const question of sample('medium', 40)) {
      const shuffled = rng.shuffle(rupGame.solve(question) as number[])
      expect(rupGame.check(question, shuffled).correct).toBe(true)
    }
  })
})

describe('blocked clauses game', () => {
  const sample = (d: Difficulty, n: number) => draw<BlockedQuestion>(blockedClausesGame, d, n)

  it.each(DIFFICULTIES)('marks the reference run correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 40)) {
      expect(blockedClausesGame.check(question, blockedClausesGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('every question can actually be emptied on %s', (difficulty) => {
    for (const question of sample(difficulty, 40)) {
      expect(bce(question.clauses).complete, showClauseSet(question.clauses)).toBe(true)
      expect(question.par).toBe(question.clauses.length)
    }
  })

  it.each(DIFFICULTIES)('always needs the definition, not only the shortcut on %s', (difficulty) => {
    // A run that is pure literals end to end never exercises the "for every D"
    // condition at all.
    for (const question of sample(difficulty, 40)) {
      expect(
        bce(question.clauses).steps.some((step) => !step.pure),
        showClauseSet(question.clauses),
      ).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('only poses satisfiable formulas on %s', (difficulty) => {
    // Removal preserves satisfiability, so emptying an unsatisfiable formula
    // would be impossible — and the puzzle unsolvable.
    for (const question of sample(difficulty, 40)) {
      expect(isSatisfiable(clauseSetToFormula(question.clauses))).toBe(true)
    }
  })

  it('rejects removing a clause that is not blocked', () => {
    for (const question of sample('medium', 30)) {
      const order = blockedClausesGame.solve(question) as Clause[]
      if (order.length < 2) continue
      const reversed = [...order].reverse()
      if (clauseKey(reversed[0] as Clause) === clauseKey(order[0] as Clause)) continue
      const verdict = blockedClausesGame.check(question, reversed)
      // Either the reversed order is legal too, or it is rejected for the
      // right reason — never silently accepted as incomplete.
      if (!verdict.correct) expect(verdict.message).toMatch(/not blocked|still standing/)
    }
  })

  it('rejects an incomplete run', () => {
    for (const question of sample('medium', 30)) {
      const order = (blockedClausesGame.solve(question) as Clause[]).slice(0, -1)
      expect(blockedClausesGame.check(question, order).correct).toBe(false)
    }
  })

  it('every step of the reference run was blocked when it was taken', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(difficulty, 30)) {
        let current = question.clauses
        for (const clause of blockedClausesGame.solve(question) as Clause[]) {
          expect(blockingLiteral(current, clause), showClause(clause)).not.toBeNull()
          current = current.filter((other) => clauseKey(other) !== clauseKey(clause))
        }
        expect(current).toHaveLength(0)
      }
    }
  })
})
