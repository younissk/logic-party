import { describe, expect, it } from 'vitest'

import {
  clauseSetToFormula,
  countModelsOver,
  isTautologicalClause,
  makeRng,
  showClauseSet,
  sortedVariables,
} from '@/logic'
import { DIFFICULTIES, type Difficulty } from '@/engine/types'
import { modelCountGame, questionFormula, trace, type ModelCountQuestion } from './modelCount'

const sample = (difficulty: Difficulty, count: number): ModelCountQuestion[] =>
  Array.from({ length: count }, (_, i) =>
    modelCountGame.generate({ rng: makeRng(`count-${i}`), difficulty, questionIndex: i }),
  )

describe('trace', () => {
  /**
   * The whole point of the game is that the three-step shortcut gives the same
   * answer as enumerating 2ⁿ rows. This is what makes that safe to teach.
   */
  it.each(DIFFICULTIES)('agrees with counting every assignment on %s', (difficulty) => {
    for (const question of sample(difficulty, 200)) {
      expect(trace(question).total, showClauseSet(question.clauses)).toBe(
        countModelsOver(questionFormula(question), question.variables),
      )
    }
  })

  it('splits the exam question the way the method says', () => {
    // exam25a Q1.1a — two units, then a four-row table, no free variables.
    const question: ModelCountQuestion = {
      clauses: [
        [{ name: 'a', negated: false }],
        [{ name: 'b', negated: false }],
        [
          { name: 'c', negated: false },
          { name: 'd', negated: false },
        ],
        [
          { name: 'c', negated: true },
          { name: 'd', negated: false },
        ],
      ],
      variables: ['a', 'b', 'c', 'd'],
    }
    const result = trace(question)
    expect(result.forced).toEqual([
      { name: 'a', value: true },
      { name: 'b', value: true },
    ])
    expect(result.remainingVariables).toEqual(['c', 'd'])
    expect(result.free).toEqual([])
    expect(result.total).toBe(2)
  })

  it('counts a free variable as a doubling', () => {
    const question: ModelCountQuestion = {
      clauses: [[{ name: 'a', negated: false }, { name: 'b', negated: false }]],
      variables: ['a', 'b', 'c'],
    }
    const result = trace(question)
    expect(result.free).toEqual(['c'])
    expect(result.total).toBe(6)
  })

  it('reports zero when propagation hits a conflict', () => {
    const question: ModelCountQuestion = {
      clauses: [
        [{ name: 'a', negated: false }],
        [{ name: 'a', negated: true }],
      ],
      variables: ['a', 'b'],
    }
    expect(trace(question).total).toBe(0)
  })
})

describe('generate', () => {
  it.each(DIFFICULTIES)('is deterministic on %s', (difficulty) => {
    const draw = () =>
      showClauseSet(
        modelCountGame.generate({ rng: makeRng('fixed'), difficulty, questionIndex: 0 }).clauses,
      )
    expect(draw()).toBe(draw())
  })

  it.each(DIFFICULTIES)('never asks about a variable set that misses one on %s', (difficulty) => {
    for (const question of sample(difficulty, 150)) {
      for (const name of sortedVariables(questionFormula(question))) {
        expect(question.variables, showClauseSet(question.clauses)).toContain(name)
      }
    }
  })

  it.each(DIFFICULTIES)('produces no tautological or duplicate clauses on %s', (difficulty) => {
    for (const question of sample(difficulty, 150)) {
      const seen = new Set<string>()
      for (const clause of question.clauses) {
        // A tautological clause constrains nothing, so it is noise in a
        // counting question rather than a challenge.
        expect(isTautologicalClause(clause), showClauseSet(question.clauses)).toBe(false)
        const key = [...clause].map((l) => `${l.negated ? '¬' : ''}${l.name}`).sort().join(',')
        expect(seen.has(key), showClauseSet(question.clauses)).toBe(false)
        seen.add(key)
      }
    }
  })

  it.each(DIFFICULTIES)('keeps the answer inside the keypad on %s', (difficulty) => {
    for (const question of sample(difficulty, 150)) {
      const answer = modelCountGame.solve(question) as number
      expect(answer).toBeGreaterThanOrEqual(0)
      // Strictly fewer than every assignment: a formula every assignment
      // satisfies is not a counting question.
      expect(answer).toBeLessThan(2 ** question.variables.length)
    }
  })

  it.each(DIFFICULTIES)('is almost never zero on %s', (difficulty) => {
    const zeros = sample(difficulty, 200).filter((q) => modelCountGame.solve(q) === 0).length
    expect(zeros / 200).toBeLessThan(0.2)
  })

  it('exercises the free-variable rule at the harder levels', () => {
    for (const difficulty of ['medium', 'hard'] as const) {
      const withFree = sample(difficulty, 200).filter((q) => trace(q).free.length > 0).length
      expect(withFree, difficulty).toBeGreaterThan(10)
    }
  })

  it('gives unit propagation something to do on easy and medium', () => {
    for (const difficulty of ['easy', 'medium'] as const) {
      for (const question of sample(difficulty, 100)) {
        expect(trace(question).forced.length, showClauseSet(question.clauses)).toBeGreaterThan(0)
      }
    }
  })
})

describe('check', () => {
  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 150)) {
      expect(modelCountGame.check(question, modelCountGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('marks a neighbouring count wrong on %s', (difficulty) => {
    for (const question of sample(difficulty, 100)) {
      const answer = modelCountGame.solve(question) as number
      expect(modelCountGame.check(question, answer + 1).correct).toBe(false)
    }
  })

  it('names the free-variable mistake specifically', () => {
    // Answering 3 for (a ∨ b) over {a, b, c} is not a counting error, it is
    // the free-variable error, and the feedback should say which.
    const question: ModelCountQuestion = {
      clauses: [[{ name: 'a', negated: false }, { name: 'b', negated: false }]],
      variables: ['a', 'b', 'c'],
    }
    expect(modelCountGame.check(question, 3).detail ?? '').toMatch(/free/i)
    expect(modelCountGame.check(question, 3).detail ?? '').toContain('c')
  })

  it('never reveals the count in the retry message', () => {
    // Sprint shows `message` before a retry and hides `detail`; a message
    // carrying the number would simply hand the question over.
    const messages = new Set<string>()
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(difficulty, 60)) {
        const answer = modelCountGame.solve(question) as number
        messages.add(modelCountGame.check(question, answer + 1).message)
        messages.add(modelCountGame.check(question, answer + 2).message)
      }
    }
    expect([...messages]).toHaveLength(1)
  })
})

describe('clauseSetToFormula round trip', () => {
  it.each(DIFFICULTIES)('renders every question as a real formula on %s', (difficulty) => {
    for (const question of sample(difficulty, 100)) {
      expect(() => clauseSetToFormula(question.clauses)).not.toThrow()
      expect(question.clauses.length).toBeGreaterThan(0)
    }
  })
})
