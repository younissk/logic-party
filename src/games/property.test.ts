import { describe, expect, it } from 'vitest'

import {
  classify,
  evaluate,
  findCounterexample,
  findModel,
  format,
  isEquivalent,
  makeRng,
  parse,
  randomFormula,
  size,
  sortedVariables,
  type Formula,
} from '@/logic'
import { DIFFICULTIES, type Difficulty } from '@/engine/types'
import {
  CLASSIFICATIONS,
  CONTRADICTION_SCHEMAS,
  PROFILES,
  PROPERTY_LABELS,
  TAUTOLOGY_SCHEMAS,
  classifyFromWitnesses,
  commute,
  fullClauseSet,
  propertyGame,
  type PropertyQuestion,
} from './property'

const draw = (seed: string, difficulty: Difficulty, index = 0): PropertyQuestion =>
  propertyGame.generate({ rng: makeRng(seed), difficulty, questionIndex: index })

const sample = (difficulty: Difficulty, count: number): PropertyQuestion[] =>
  Array.from({ length: count }, (_, i) => draw(`sample-${i}`, difficulty, i))

/** Arbitrary formulas to substitute into a schema, deliberately not just variables. */
const substitutions = (count: number): Formula[][] => {
  const rng = makeRng('substitutions')
  return Array.from({ length: count }, () =>
    Array.from({ length: 3 }, () =>
      randomFormula(rng, {
        variables: ['a', 'b', 'c'],
        depth: rng.range(1, 3),
        connectives: ['not', 'and', 'or', 'implies', 'iff'],
      }),
    ),
  )
}

describe('tautology schemas', () => {
  // The whole generator rests on these being valid for *every* substitution.
  // A mistyped schema would otherwise just fail the classify check in `fits`,
  // vanish from the output, and never be noticed.
  it.each(TAUTOLOGY_SCHEMAS.map((schema, index) => [index, schema] as const))(
    'schema %i is valid under every substitution',
    (_index, schema) => {
      for (const parts of substitutions(40)) {
        const built = schema.build(parts.slice(0, schema.arity))
        expect(classify(built), format(built)).toBe('tautology')
      }
    },
  )
})

describe('contradiction schemas', () => {
  it.each(CONTRADICTION_SCHEMAS.map((schema, index) => [index, schema] as const))(
    'schema %i is unsatisfiable under every substitution',
    (_index, schema) => {
      for (const parts of substitutions(40)) {
        const built = schema.build(parts.slice(0, schema.arity))
        expect(classify(built), format(built)).toBe('contradiction')
      }
    },
  )
})

describe('fullClauseSet', () => {
  it.each([1, 2, 3])('over %i variables is unsatisfiable', (count) => {
    const built = fullClauseSet(['x', 'y', 'z'].slice(0, count))
    expect(classify(built)).toBe('contradiction')
  })

  it('is the shape used by the course exercise', () => {
    expect(isEquivalent(fullClauseSet(['x', 'y']), parse('(x ∨ y) ∧ (¬x ∨ y) ∧ (x ∨ ¬y) ∧ (¬x ∨ ¬y)'))).toBe(
      true,
    )
  })
})

describe('commute', () => {
  it('never changes what a formula means', () => {
    const rng = makeRng('commute')
    for (let i = 0; i < 200; i++) {
      const original = randomFormula(rng, {
        variables: ['p', 'q', 'r'],
        depth: rng.range(2, 5),
        connectives: ['not', 'and', 'or', 'implies', 'iff'],
      })
      expect(isEquivalent(original, commute(rng, original)), format(original)).toBe(true)
    }
  })
})

describe('generate', () => {
  it.each(DIFFICULTIES)('is deterministic on %s', (difficulty) => {
    expect(format(draw('fixed', difficulty).formula)).toBe(format(draw('fixed', difficulty).formula))
  })

  it.each(DIFFICULTIES)('uses at least two variables on %s', (difficulty) => {
    for (const question of sample(difficulty, 120)) {
      expect(sortedVariables(question.formula).length, format(question.formula)).toBeGreaterThanOrEqual(2)
    }
  })

  it.each(DIFFICULTIES)('stays inside the size window on %s', (difficulty) => {
    const profile = PROFILES[difficulty]
    for (const question of sample(difficulty, 200)) {
      const width = size(question.formula)
      expect(width, format(question.formula)).toBeGreaterThanOrEqual(profile.minSize)
      expect(width, format(question.formula)).toBeLessThanOrEqual(profile.maxSize)
    }
  })

  it.each(DIFFICULTIES)('reports the variables it actually uses on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(question.variables).toEqual(sortedVariables(question.formula))
    }
  })

  it.each(DIFFICULTIES)('draws all three properties roughly evenly on %s', (difficulty) => {
    const questions = sample(difficulty, 300)
    for (const property of CLASSIFICATIONS) {
      const share = questions.filter((q) => classify(q.formula) === property).length / questions.length
      expect(share, `${property} on ${difficulty}`).toBeGreaterThan(0.2)
      expect(share, `${property} on ${difficulty}`).toBeLessThan(0.47)
    }
  })

  /**
   * The anti-tell invariant.
   *
   * A schema-built tautology is naturally longer than a freely drawn contingent
   * formula. If that difference is allowed to grow, the player can answer from
   * the length of the formula without reading it, and the exercise stops
   * teaching anything. Two nodes of slack is small enough that no one could
   * exploit it and loose enough not to fail on a harmless retune.
   */
  it.each(DIFFICULTIES)('does not leak the answer through formula length on %s', (difficulty) => {
    const questions = sample(difficulty, 300)
    const means = CLASSIFICATIONS.map((property) => {
      const widths = questions
        .filter((q) => classify(q.formula) === property)
        .map((q) => size(q.formula))
      return widths.reduce((total, width) => total + width, 0) / widths.length
    })
    expect(Math.max(...means) - Math.min(...means), means.join(' / ')).toBeLessThan(2)
  })
})

describe('check', () => {
  it.each(DIFFICULTIES)('marks the reference witnesses correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 150)) {
      const verdict = propertyGame.check(question, propertyGame.solve(question))
      expect(verdict.correct, format(question.formula)).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the reference witnesses really are witnesses on %s', (difficulty) => {
    // Independent of `check`: a banked model has to make the formula true and
    // a banked counter-model false, and a null has to mean none exists.
    for (const question of sample(difficulty, 150)) {
      const answer = propertyGame.solve(question)
      if (answer.model === null) expect(findModel(question.formula)).toBeNull()
      else expect(evaluate(question.formula, answer.model), format(question.formula)).toBe(true)

      if (answer.counter === null) expect(findCounterexample(question.formula)).toBeNull()
      else expect(evaluate(question.formula, answer.counter), format(question.formula)).toBe(false)
    }
  })

  it.each(DIFFICULTIES)('the witnesses determine the classification on %s', (difficulty) => {
    for (const question of sample(difficulty, 150)) {
      expect(classifyFromWitnesses(propertyGame.solve(question))).toBe(classify(question.formula))
    }
  })

  it.each(DIFFICULTIES)('rejects a row that does not do what it claims on %s', (difficulty) => {
    for (const question of sample(difficulty, 100)) {
      const answer = propertyGame.solve(question)
      // Swap the two slots: a model banked as a counter-model is exactly the
      // mistake of not checking which way round you were looking.
      const swapped = { model: answer.counter, counter: answer.model }
      if (
        (swapped.model === null) === (answer.model === null) &&
        (swapped.counter === null) === (answer.counter === null) &&
        classify(question.formula) !== 'contingent'
      ) {
        continue
      }
      expect(propertyGame.check(question, swapped).correct, format(question.formula)).toBe(false)
    }
  })

  it('rejects claiming no model when there is one', () => {
    for (const question of sample('medium', 100)) {
      if (findModel(question.formula) === null) continue
      const answer = propertyGame.solve(question)
      expect(propertyGame.check(question, { ...answer, model: null }).correct).toBe(false)
    }
  })

  it('rejects claiming no counter-model when there is one', () => {
    for (const question of sample('medium', 100)) {
      if (findCounterexample(question.formula) === null) continue
      const answer = propertyGame.solve(question)
      expect(propertyGame.check(question, { ...answer, counter: null }).correct).toBe(false)
    }
  })

  it('gives half credit for getting one slot right', () => {
    for (const question of sample('medium', 60)) {
      const answer = propertyGame.solve(question)
      if (answer.model === null || answer.counter === null) continue
      const half = propertyGame.check(question, { model: answer.counter, counter: answer.counter })
      expect(half.correct).toBe(false)
      expect(half.score).toBe(0.5)
    }
  })

  it('never reveals the answer in the retry message', () => {
    // Sprint shows `message` before the retry and hides `detail`, so a *wrong*
    // answer's message must not name what the formula is. A correct one names
    // it on purpose — that is the reward, not a leak.
    const messages = new Set<string>()
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(difficulty, 60)) {
        const answer = propertyGame.solve(question)
        for (const attempt of [
          { model: null, counter: null },
          { ...answer, model: null },
          { ...answer, counter: null },
          { model: answer.counter, counter: answer.model },
        ]) {
          const verdict = propertyGame.check(question, attempt)
          if (verdict.correct) continue
          messages.add(verdict.message)
        }
      }
    }

    expect(messages.size).toBeGreaterThan(0)
    for (const message of messages) {
      for (const label of Object.values(PROPERTY_LABELS)) {
        expect(message.toLowerCase(), message).not.toContain(label.toLowerCase())
      }
    }
  })
})

describe('sprint penalty', () => {
  it('is back to the shared default now that there is nothing to guess', () => {
    // It used to be raised: with three buttons, sprint's block-until-right
    // meant you were never more than two guesses from the truth. Hunting a
    // witness has 2ⁿ rows and no shortlist, so guessing is no longer the
    // cheaper strategy and the override has no reason left.
    expect(propertyGame.sprintPenaltySeconds).toBeUndefined()
  })
})
