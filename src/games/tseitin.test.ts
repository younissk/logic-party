import { describe, expect, it } from 'vitest'

import {
  clauseSetToFormula,
  definitionClauses,
  format,
  isEquivalent,
  makeRng,
  showClauseSet,
  sortedVariables,
  type Clause,
  type Literal,
} from '@/logic'
import { DIFFICULTIES, type Difficulty } from '@/engine/types'
import { definitionFormula, tseitinGame, type TseitinQuestion } from './tseitin'

const sample = (difficulty: Difficulty, count: number): TseitinQuestion[] =>
  Array.from({ length: count }, (_, i) =>
    tseitinGame.generate({ rng: makeRng(`gate-${i}`), difficulty, questionIndex: i }),
  )

const solutionOf = (question: TseitinQuestion): Literal[][] =>
  tseitinGame.solve(question) as Literal[][]

describe('generate', () => {
  it.each(DIFFICULTIES)('is deterministic on %s', (difficulty) => {
    const draw = () => {
      const q = tseitinGame.generate({ rng: makeRng('fixed'), difficulty, questionIndex: 0 })
      return `${q.name}:${format(q.body)}`
    }
    expect(draw()).toBe(draw())
  })

  it.each(DIFFICULTIES)('always names a compound over literals on %s', (difficulty) => {
    for (const question of sample(difficulty, 150)) {
      // Algorithm 2.19 only ever names a *simple* subformula: one whose
      // immediate subformulas are literals. Anything deeper means the
      // inside-out order was broken somewhere.
      expect(question.body.kind).not.toBe('var')
      const body = question.body
      const parts =
        body.kind === 'not' ? [body.arg] : body.kind === 'var' || body.kind === 'const' ? [] : [body.left, body.right]
      expect(parts.length, format(body)).toBeGreaterThan(0)
      for (const part of parts) {
        const isLiteral = part.kind === 'var' || (part.kind === 'not' && part.arg.kind === 'var')
        expect(isLiteral, format(question.body)).toBe(true)
      }
    }
  })

  it.each(DIFFICULTIES)('offers both polarities of everything and nothing else on %s', (difficulty) => {
    for (const question of sample(difficulty, 150)) {
      const mentioned = new Set([question.name, ...sortedVariables(question.body)])
      const offered = new Set(question.palette.map((l) => l.name))
      expect([...offered].sort()).toEqual([...mentioned].sort())
      // Narrowing the palette to the signs that happen to be in the answer
      // would give the polarity trap away, so both must always be there.
      for (const name of mentioned) {
        expect(question.palette.filter((l) => l.name === name)).toHaveLength(2)
      }
    }
  })

  it.each(DIFFICULTIES)('states the right clause count on %s', (difficulty) => {
    for (const question of sample(difficulty, 150)) {
      expect(question.clauseCount).toBe(definitionClauses(question.name, question.body).length)
    }
  })

  it('keeps the hard connective out of the easy levels', () => {
    for (const question of sample('easy', 150)) {
      expect(['and', 'or']).toContain(question.body.kind)
    }
    for (const question of sample('medium', 150)) {
      expect(['and', 'or', 'implies']).toContain(question.body.kind)
    }
  })

  it('reaches the four-clause biconditional on hard', () => {
    const withIff = sample('hard', 300).filter((q) => q.body.kind === 'iff').length
    expect(withIff).toBeGreaterThan(5)
  })

  it('places every gate inside the run it came from', () => {
    for (const question of sample('medium', 100)) {
      expect(question.index).toBeGreaterThanOrEqual(0)
      expect(question.index).toBeLessThan(question.gates)
    }
  })
})

describe('check', () => {
  it.each(DIFFICULTIES)('marks the reference wiring correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 150)) {
      expect(tseitinGame.check(question, solutionOf(question)).correct, format(question.body)).toBe(
        true,
      )
    }
  })

  /**
   * The reason marking is semantic rather than a table lookup: the clause table
   * is one correct encoding of t ↔ χ, not the only one. Reordering the clauses,
   * or the literals inside them, must still pass.
   */
  it.each(DIFFICULTIES)('accepts a correct wiring in any order on %s', (difficulty) => {
    const rng = makeRng('shuffle')
    for (const question of sample(difficulty, 100)) {
      const shuffled = rng.shuffle(solutionOf(question).map((clause) => rng.shuffle(clause)))
      expect(tseitinGame.check(question, shuffled).correct, format(question.body)).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('rejects a single flipped sign on %s', (difficulty) => {
    // Polarity is the whole exercise. Flipping one literal anywhere must fail.
    for (const question of sample(difficulty, 100)) {
      const solution = solutionOf(question)
      for (let clause = 0; clause < solution.length; clause++) {
        const broken = solution.map((literals, index) =>
          index === clause
            ? literals.map((literal, position) =>
                position === 0 ? { name: literal.name, negated: !literal.negated } : literal,
              )
            : literals,
        )
        expect(
          tseitinGame.check(question, broken).correct,
          `${format(question.body)} → ${showClauseSet(broken as Clause[])}`,
        ).toBe(false)
      }
    }
  })

  it.each(DIFFICULTIES)('rejects a wiring with an empty clause on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      const withHole = solutionOf(question).map((clause, index) => (index === 0 ? [] : clause))
      expect(tseitinGame.check(question, withHole).correct).toBe(false)
    }
  })

  it('rejects dropping a clause even when the rest are right', () => {
    for (const question of sample('medium', 60)) {
      const short = solutionOf(question).slice(1)
      expect(tseitinGame.check(question, short).correct).toBe(false)
    }
  })

  it.each(DIFFICULTIES)('the reference wiring really means t ↔ χ on %s', (difficulty) => {
    // Independent of `check`: the solution the game will show has to be a
    // correct encoding of the definition, not merely something check accepts.
    for (const question of sample(difficulty, 150)) {
      expect(
        isEquivalent(clauseSetToFormula(solutionOf(question) as Clause[]), definitionFormula(question)),
        format(question.body),
      ).toBe(true)
    }
  })

  it('points at the assignment where a wrong wiring disagrees', () => {
    for (const question of sample('medium', 40)) {
      const solution = solutionOf(question)
      const first = solution[0] as Literal[]
      const broken = solution.map((clause, index) =>
        index === 0
          ? [{ name: (first[0] as Literal).name, negated: !(first[0] as Literal).negated }, ...first.slice(1)]
          : clause,
      )
      const verdict = tseitinGame.check(question, broken)
      expect(verdict.correct).toBe(false)
      expect(verdict.detail ?? '').toMatch(/=\s*[TF]/)
    }
  })

  it('never reveals the wiring in the retry message', () => {
    const messages = new Set<string>()
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(difficulty, 60)) {
        const solution = solutionOf(question)
        const first = solution[0] as Literal[]
        const broken = solution.map((clause, index) =>
          index === 0
            ? [{ name: (first[0] as Literal).name, negated: !(first[0] as Literal).negated }, ...first.slice(1)]
            : clause,
        )
        messages.add(tseitinGame.check(question, broken).message)
      }
    }
    expect([...messages]).toHaveLength(1)
  })
})
