/**
 * Every equational minigame, checked the same way the propositional ones are:
 * the reference answer must mark correct, a wrong answer must not, a retry
 * message must not leak the answer, and a round must never stall.
 */

import { describe, expect, it } from 'vitest'
import { makeRng } from '@/logic'
import { DIFFICULTIES, type Difficulty, type GenerateContext } from '@/engine/types'
import { termFlatGame } from './termFlat'
import { goalHolds, metGoals, termBuildGame } from './termBuild'
import { interpretationGame, valuesOf } from './interpretationGame'
import { slotToTerm, hole } from '@/ui/TermBuilder'
import {
  INTERPRETATIONS,
  equationHoldsAt,
  equationVariables,
  parseEquation,
  parseTerm,
  type Interpretation,
  type Signature,
} from '@/logic'

const SEEDS = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8']

/** A spread of questions for one game and difficulty. */
function sample<Q>(
  game: { generate: (context: GenerateContext) => Q },
  difficulty: Difficulty,
): Q[] {
  return SEEDS.map((seed, index) =>
    game.generate({ rng: makeRng(`${seed}:${difficulty}`), difficulty, questionIndex: index }),
  )
}

describe('Broken Keyboard', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference answer correct on ${difficulty}`, () => {
      for (const question of sample(termFlatGame, difficulty)) {
        const verdict = termFlatGame.check(question, termFlatGame.solve(question))
        expect([question.letters, verdict.correct]).toEqual([question.letters, true])
      }
    })

    it(`always produces letters that read back as the term on ${difficulty}`, () => {
      for (const question of sample(termFlatGame, difficulty)) {
        // Every target really is at the span the question claims.
        for (const target of question.targets) {
          expect(target.end).toBeGreaterThan(target.start)
          expect(target.end).toBeLessThanOrEqual(question.letters.length)
        }
        expect(question.variables.length).toBeGreaterThanOrEqual(2)
        // The chip row must include a variable that is not in the term, or
        // ticking everything would always work.
        expect(question.variablePool.length).toBeGreaterThan(question.variables.length)
      }
    })
  }

  it('refuses a span that is off by one', () => {
    const question = termFlatGame.generate({ rng: makeRng('x1'), difficulty: 'medium', questionIndex: 0 })
    const reference = termFlatGame.solve(question)
    const first = reference.spans[0] as [number, number]
    const nudged = {
      ...reference,
      spans: [[first[0], first[1] + 1] as [number, number], ...reference.spans.slice(1)],
    }
    expect(termFlatGame.check(question, nudged).correct).toBe(false)
  })

  it('refuses a var(t) with an extra letter in it', () => {
    const question = termFlatGame.generate({ rng: makeRng('x2'), difficulty: 'medium', questionIndex: 0 })
    const reference = termFlatGame.solve(question)
    const extra = question.variablePool.find((name) => !question.variables.includes(name))
    expect(extra).toBeDefined()
    const verdict = termFlatGame.check(question, {
      ...reference,
      variables: [...reference.variables, extra as string],
    })
    expect(verdict.correct).toBe(false)
  })

  it('gives partial credit rather than nothing for a half-right answer', () => {
    const question = termFlatGame.generate({ rng: makeRng('x3'), difficulty: 'hard', questionIndex: 0 })
    const reference = termFlatGame.solve(question)
    const verdict = termFlatGame.check(question, { ...reference, variables: [] })
    expect(verdict.correct).toBe(false)
    expect(verdict.score ?? 0).toBeGreaterThan(0.5)
  })

  it('never names the answer in the retry message', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(termFlatGame, difficulty)) {
        const verdict = termFlatGame.check(question, { spans: [], variables: [] })
        expect(verdict.correct).toBe(false)
        expect(verdict.message).not.toContain(question.source)
        for (const target of question.targets) {
          expect(verdict.message).not.toContain(target.text)
        }
      }
    }
  })

  it('gives distinct questions across seeds', () => {
    const keys = new Set(
      sample(termFlatGame, 'medium').map((question) => termFlatGame.questionKey?.(question)),
    )
    expect(keys.size).toBeGreaterThan(1)
  })
})

describe('Term Foundry', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the witness correct on ${difficulty}`, () => {
      for (const question of sample(termBuildGame, difficulty)) {
        const verdict = termBuildGame.check(question, termBuildGame.solve(question))
        expect([question.witness, verdict.correct]).toEqual([question.witness, true])
      }
    })

    it(`only ever asks for something buildable on ${difficulty}`, () => {
      for (const question of sample(termBuildGame, difficulty)) {
        const witness = slotToTerm(termBuildGame.solve(question))
        expect(witness).not.toBeNull()
        for (const goal of question.goals) {
          expect([question.witness, goalHolds(goal, witness as never)]).toEqual([
            question.witness,
            true,
          ])
        }
      }
    })

    it(`never asks a question a single variable answers on ${difficulty}`, () => {
      for (const question of sample(termBuildGame, difficulty)) {
        const lazy = { kind: 'var' as const, name: question.variables[0] as string }
        expect(metGoals(question, slotToTerm(lazy) as never).every(Boolean)).toBe(false)
      }
    })
  }

  it('refuses a term with a hole still in it', () => {
    const question = termBuildGame.generate({ rng: makeRng('t1'), difficulty: 'medium', questionIndex: 0 })
    const verdict = termBuildGame.check(question, hole())
    expect(verdict.correct).toBe(false)
    expect(verdict.message).toContain('finished')
  })

  it('gives partial credit when some conditions are met', () => {
    const question = termBuildGame.generate({ rng: makeRng('t2'), difficulty: 'hard', questionIndex: 0 })
    const lazy = { kind: 'var' as const, name: question.variables[0] as string }
    const verdict = termBuildGame.check(question, lazy)
    expect(verdict.correct).toBe(false)
    expect(verdict.score ?? 0).toBeGreaterThanOrEqual(0)
    expect(verdict.score ?? 1).toBeLessThan(1)
  })

  it('accepts any term meeting the conditions, not only the witness', () => {
    const sig: Signature = { f: 1, g: 2, c: 0 }
    const question = {
      signature: sig,
      variables: ['x', 'y'],
      goals: [{ kind: 'size' as const, n: 4 }, { kind: 'vars' as const, names: ['x'] }],
      witness: 'g(f(x),x)',
    }
    const other = parseTerm('f(f(f(x)))', sig)
    const verdict = termBuildGame.check(question, {
      kind: 'fn',
      name: 'f',
      args: [{ kind: 'fn', name: 'f', args: [{ kind: 'fn', name: 'f', args: [{ kind: 'var', name: 'x' }] }] }],
    })
    expect(other).toBeDefined()
    expect(verdict.correct).toBe(true)
  })
})

describe('Give It Meaning', () => {
  const SIG: Signature = { f: 2, g: 2 }

  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference answer correct on ${difficulty}`, () => {
      for (const question of sample(interpretationGame, difficulty)) {
        const verdict = interpretationGame.check(question, interpretationGame.solve(question))
        expect([question.id, question.equation, verdict.correct]).toEqual([
          question.id,
          question.equation,
          true,
        ])
      }
    })

    it(`stores a verdict that matches the interpretation on ${difficulty}`, () => {
      for (const question of sample(interpretationGame, difficulty)) {
        const reference = interpretationGame.solve(question)
        // holds ⇔ there is no counterexample to hand.
        expect([question.equation, question.holds]).toEqual([
          question.equation,
          reference.values === null,
        ])
      }
    })
  }

  it('asks both answers across a round', () => {
    const verdicts = new Set(
      DIFFICULTIES.flatMap((difficulty) =>
        sample(interpretationGame, difficulty).map((question) => question.holds),
      ),
    )
    expect(verdicts).toEqual(new Set([true, false]))
  })

  it('refuses values where the two sides agree', () => {
    const question = { id: 'plusTimes' as const, equation: 'f(x,g(y,z))=g(f(x,y),f(x,z))', holds: false }
    // x = 0 makes both sides 0 under addition-over-multiplication.
    const zeros = Object.fromEntries(
      equationVariables(parseEquation(question.equation, SIG)).map((name) => [name, 0]),
    )
    const interpretation = INTERPRETATIONS[question.id] as Interpretation<unknown>
    const agree = equationHoldsAt(
      interpretation,
      valuesOf(question.id, zeros) as never,
      parseEquation(question.equation, SIG),
    )
    if (agree) {
      const verdict = interpretationGame.check(question, { values: zeros })
      expect(verdict.correct).toBe(false)
      expect(verdict.message).toContain('agree')
    }
  })

  it('refuses a counterexample that leaves a variable unset', () => {
    const question = { id: 'plusTimes' as const, equation: 'f(x,g(y,z))=g(f(x,y),f(x,z))', holds: false }
    const verdict = interpretationGame.check(question, { values: { x: 2 } })
    expect(verdict.correct).toBe(false)
    expect(verdict.message).toContain('No value chosen')
  })

  it('refuses "it holds" when it does not, and says so without naming values', () => {
    const question = { id: 'plusTimes' as const, equation: 'f(x,g(y,z))=g(f(x,y),f(x,z))', holds: false }
    const verdict = interpretationGame.check(question, { values: null })
    expect(verdict.correct).toBe(false)
    expect(verdict.message).toBe('It does not hold here')
  })
})
