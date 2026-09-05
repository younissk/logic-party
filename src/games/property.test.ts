import { describe, expect, it } from 'vitest'

import {
  classify,
  format,
  isEquivalent,
  makeRng,
  parse,
  randomFormula,
  size,
  sortedVariables,
  type Classification,
  type Formula,
} from '@/logic'
import { DIFFICULTIES, type Difficulty } from '@/engine/types'
import {
  CLASSIFICATIONS,
  CONTRADICTION_SCHEMAS,
  PROFILES,
  TAUTOLOGY_SCHEMAS,
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
  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 150)) {
      const verdict = propertyGame.check(question, propertyGame.solve(question))
      expect(verdict.correct, format(question.formula)).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('marks every other answer wrong on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      const truth = propertyGame.solve(question)
      for (const option of CLASSIFICATIONS.filter((c) => c !== truth)) {
        expect(propertyGame.check(question, option).correct, format(question.formula)).toBe(false)
      }
    }
  })

  /**
   * Sprint shows `message` before you retry but hides `detail`, so a message
   * that named the right answer would hand the question over — and with three
   * options that is the whole question.
   */
  it('never reveals the answer in the retry message', () => {
    // The invariant is stronger than "does not name the answer": the message
    // for a wrong pick must depend on the pick alone. If it is the same string
    // whatever the formula turned out to be, it carries no information about
    // the formula, and there is nothing to read off it.
    const seen = new Map<Classification, Set<string>>()
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(difficulty, 100)) {
        const truth = propertyGame.solve(question)
        for (const option of CLASSIFICATIONS.filter((c) => c !== truth)) {
          const messages = seen.get(option) ?? new Set<string>()
          messages.add(propertyGame.check(question, option).message)
          seen.set(option, messages)
        }
      }
    }

    expect([...seen.keys()].sort()).toEqual([...CLASSIFICATIONS].sort())
    for (const [option, messages] of seen) {
      expect([...messages], `messages for ${option}`).toHaveLength(1)
    }
  })

  it('explains a wrong answer with the witness Definition 2.6 asks for', () => {
    const cases: [string, Classification, RegExp][] = [
      ['p ∨ ¬p', 'tautology', /no assignment makes it false/i],
      ['p ∧ ¬p', 'contradiction', /no assignment makes it true/i],
      ['p → q', 'contingent', /model:.*counter-model:/is],
    ]
    for (const [source, truth, pattern] of cases) {
      const formula = parse(source)
      const question: PropertyQuestion = { formula, variables: sortedVariables(formula) }
      expect(propertyGame.solve(question)).toBe(truth)
      const wrong = CLASSIFICATIONS.find((c) => c !== truth) as Classification
      expect(propertyGame.check(question, wrong).detail ?? '').toMatch(pattern)
    }
  })
})

describe('sprint penalty', () => {
  /**
   * Sprint blocks until you are right, so three options are always at most two
   * wrong guesses from the truth. The penalty has to make that cost more than
   * thinking, which the shared default does not.
   */
  it('is raised above the default for a three-way choice', () => {
    expect(propertyGame.sprintPenaltySeconds).toBeGreaterThan(5)
  })
})
