/**
 * The first-order minigames, checked the way the others are: the reference
 * answer marks correct, a wrong one does not, the retry message leaks nothing,
 * and a round can never stall.
 */

import { describe, expect, it } from 'vitest'
import { makeRng } from '@/logic'
import { evaluateFormula, isClean, isClosed, parseFormula, showFormula } from '@/logic'
import { DIFFICULTIES, type Difficulty, type GenerateContext } from '@/engine/types'
import { wellFormedGame, wellnessOf } from './wellFormed'
import { boundFreeGame, formulaOf as boundFormulaOf, occurrences } from './boundFree'
import {
  STRUCTURES,
  foEvaluateGame,
  formulaOf as evalFormulaOf,
  prefixOf,
  type StructureSpec,
} from './foEvaluate'
import type { Structure } from '@/logic'

const SEEDS = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6']

function sample<Q>(
  game: { generate: (context: GenerateContext) => Q },
  difficulty: Difficulty,
): Q[] {
  return SEEDS.map((seed, index) =>
    game.generate({ rng: makeRng(`${seed}:${difficulty}`), difficulty, questionIndex: index }),
  )
}

describe('Is That A Formula?', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference sort correct on ${difficulty}`, () => {
      for (const question of sample(wellFormedGame, difficulty)) {
        expect(wellFormedGame.check(question, wellFormedGame.solve(question)).correct).toBe(true)
      }
    })

    it(`fills all three bins on ${difficulty}`, () => {
      for (const question of sample(wellFormedGame, difficulty)) {
        const bins = new Set(question.candidates.map((source) => wellnessOf(question, source)))
        expect(bins).toEqual(new Set(['formula', 'term', 'neither']))
      }
    })
  }

  it('calls a term a term, not a formula', () => {
    const question = {
      predicates: { weekend: 1 },
      functions: { monday: 0, next: 1 },
      variables: ['x'],
      candidates: [],
    }
    expect(wellnessOf(question, 'next(monday())')).toBe('term')
    expect(wellnessOf(question, 'weekend(next(monday()))')).toBe('formula')
  })

  it('refuses a predicate inside a term and a predicate at the wrong arity', () => {
    const question = {
      predicates: { triangle: 1 },
      functions: { rotate: 1 },
      variables: ['x'],
      candidates: [],
    }
    expect(wellnessOf(question, 'triangle(triangle(x))')).toBe('neither')
    expect(wellnessOf(question, 'triangle(x,x)')).toBe('neither')
    expect(wellnessOf(question, 'triangle(rotate(x))')).toBe('formula')
  })

  it('gives partial credit and never names a candidate', () => {
    const question = wellFormedGame.generate({
      rng: makeRng('w1'),
      difficulty: 'medium',
      questionIndex: 0,
    })
    const verdict = wellFormedGame.check(question, question.candidates.map(() => null))
    expect(verdict.correct).toBe(false)
    for (const source of question.candidates) expect(verdict.message).not.toContain(source)
  })
})

describe('Bound Or Free', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference answer correct on ${difficulty}`, () => {
      for (const question of sample(boundFreeGame, difficulty)) {
        expect(boundFreeGame.check(question, boundFreeGame.solve(question)).correct).toBe(true)
      }
    })

    it(`always has an occurrence to judge on ${difficulty}`, () => {
      for (const question of sample(boundFreeGame, difficulty)) {
        expect(occurrences(boundFormulaOf(question)).length).toBeGreaterThanOrEqual(2)
      }
    })

    it(`positions every occurrence where the printed formula has it on ${difficulty}`, () => {
      for (const question of sample(boundFreeGame, difficulty)) {
        const formula = boundFormulaOf(question)
        const printed = showFormula(formula)
        for (const spot of occurrences(formula)) {
          expect([printed, printed.slice(spot.at, spot.at + spot.name.length)]).toEqual([
            printed,
            spot.name,
          ])
        }
      }
    })
  }

  it('skips the variable beside a quantifier', () => {
    const question = { predicates: { p: 1 }, functions: {}, source: '∀x:p(x)' }
    const spots = occurrences(boundFormulaOf(question))
    expect(spots).toHaveLength(1)
    expect(spots[0]?.bound).toBe(true)
  })

  it('sees one letter as bound in one place and free in another', () => {
    const question = { predicates: { p: 1, q: 1 }, functions: {}, source: '(p(x)∨∃x:q(x))' }
    const spots = occurrences(boundFormulaOf(question))
    expect(spots.map((spot) => spot.bound)).toEqual([false, true])
  })

  it('agrees with isClosed and isClean', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(boundFreeGame, difficulty)) {
        const formula = boundFormulaOf(question)
        const reference = boundFreeGame.solve(question)
        expect(reference.closed).toBe(isClosed(formula))
        expect(reference.clean).toBe(isClean(formula))
      }
    }
  })

  it('scores a partly right answer partly', () => {
    const question = boundFreeGame.generate({
      rng: makeRng('bf1'),
      difficulty: 'medium',
      questionIndex: 0,
    })
    const reference = boundFreeGame.solve(question)
    const verdict = boundFreeGame.check(question, { ...reference, closed: !reference.closed })
    expect(verdict.correct).toBe(false)
    expect(verdict.score ?? 0).toBeGreaterThan(0.5)
  })
})

describe('Name The Element', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference play correct on ${difficulty}`, () => {
      for (const question of sample(foEvaluateGame, difficulty)) {
        const verdict = foEvaluateGame.check(question, foEvaluateGame.solve(question))
        expect([question.source, verdict.correct]).toEqual([question.source, true])
      }
    })

    it(`stores a verdict the evaluator agrees with on ${difficulty}`, () => {
      for (const question of sample(foEvaluateGame, difficulty)) {
        const structure = (STRUCTURES[question.spec] as { structure: Structure }).structure
        expect([question.source, question.holds]).toEqual([
          question.source,
          evaluateFormula(structure, {}, evalFormulaOf(question)),
        ])
      }
    })
  }

  it('asks both answers across a round', () => {
    const verdicts = new Set(
      DIFFICULTIES.flatMap((difficulty) =>
        sample(foEvaluateGame, difficulty).map((question) => question.holds),
      ),
    )
    expect(verdicts).toEqual(new Set([true, false]))
  })

  it('refuses a witness that does not witness', () => {
    const question = { spec: 'mod4', source: '∃x:∀y:r(x,y)', holds: false }
    // No x works, so any element chosen as a witness must be refused.
    const verdict = foEvaluateGame.check(question, [0, null])
    expect(verdict.correct).toBe(false)
  })

  it('refuses "none works" when one does', () => {
    const question = { spec: 'mod4', source: '∃x:(p(x)∨∃y:r(x,y))', holds: true }
    const verdict = foEvaluateGame.check(question, [null])
    expect(verdict.correct).toBe(false)
    expect(verdict.detail ?? '').toContain('does make the rest true')
  })

  it('only poses sentences whose prefix can actually be played', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(foEvaluateGame, difficulty)) {
        const layers = prefixOf(evalFormulaOf(question))
        const reference = foEvaluateGame.solve(question)
        if (layers.length === 0) {
          // Quantifier-free: the answer is the single true/false the board asks.
          expect(reference).toHaveLength(1)
          continue
        }
        // Either every layer was answered, or a "none" ended it early.
        expect(
          reference.length === layers.length || reference[reference.length - 1] === null,
        ).toBe(true)
      }
    }
  })

  it('parses every sentence it can pose', () => {
    for (const entry of Object.values(STRUCTURES)) {
      expect(entry.spec.describe.length).toBeGreaterThan(0)
    }
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(foEvaluateGame, difficulty)) {
        const spec = (STRUCTURES[question.spec] as { spec: StructureSpec }).spec
        expect(() => parseFormula(question.source, spec.signature)).not.toThrow()
      }
    }
  })
})
