import { describe, expect, it } from 'vitest'

import { holdsIn, inTheory, isConsistent, modelsOf, unionClosureModels } from '@/logic'
import { makeRng } from '@/logic/rng'
import type { Difficulty } from '@/engine/types'
import { CATALOGUE, CATALOGUE_FORMULAS, WORLD, parse } from './theoryWorld'
import { belongs, closeItUpGame, modelsOfQuestion } from './closeItUp'
import { theoryPropertiesGame, undecided } from './theoryProperties'
import { isWitness, leftModels, rightModels, unionTroubleGame, witnessOf } from './unionTrouble'

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

const draw = <Q,>(
  game: {
    generate: (context: {
      rng: ReturnType<typeof makeRng>
      difficulty: Difficulty
      questionIndex: number
    }) => Q
  },
  difficulty: Difficulty,
  seed: number,
): Q => game.generate({ rng: makeRng(`s${seed}`), difficulty, questionIndex: 0 })

describe('the shared world', () => {
  it('holds every structure on two elements', () => {
    expect(WORLD.structures).toHaveLength(4)
    expect(WORLD.labels).toEqual(['p={}', 'p={1}', 'p={2}', 'p={1,2}'])
  })

  it('parses every formula in the catalogue', () => {
    expect(CATALOGUE_FORMULAS).toHaveLength(CATALOGUE.length)
  })

  it('separates the structures — no two agree on everything', () => {
    // If two structures satisfied the same catalogue formulas, a question
    // could hinge on a distinction the language cannot make.
    const signatures = WORLD.structures.map((structure) =>
      CATALOGUE_FORMULAS.map((formula) => (holdsIn(structure, formula) ? '1' : '0')).join(''),
    )
    // p={1} and p={2} are isomorphic, so they must agree; nothing else may.
    expect(signatures[1]).toBe(signatures[2])
    expect(new Set(signatures).size).toBe(3)
  })

  it('a tautology is in every theory and a contradiction in none that has a model', () => {
    for (const models of [[0], [1, 2], [0, 1, 2, 3]]) {
      expect(inTheory(WORLD, models, parse('∀x:(p(x)∨¬p(x))'))).toBe(true)
      expect(inTheory(WORLD, models, parse('∃x:(p(x)∧¬p(x))'))).toBe(false)
    }
  })

  it('an inconsistent theory contains everything', () => {
    const none = modelsOf(WORLD, [parse('∀x:p(x)'), parse('∃x:¬p(x)')])
    expect(isConsistent(none)).toBe(false)
    for (const formula of CATALOGUE_FORMULAS) expect(inTheory(WORLD, none, formula)).toBe(true)
  })
})

describe('Close It Up', () => {
  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (let seed = 0; seed < 30; seed++) {
      const question = draw(closeItUpGame, difficulty, seed)
      expect(closeItUpGame.check(question, closeItUpGame.solve(question)).correct).toBe(true)
    }
  })

  it('never deals a board that is all one colour', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 30; seed++) {
        const question = draw(closeItUpGame, difficulty, seed)
        const answer = closeItUpGame.solve(question)
        expect(answer).toContain('in')
        expect(answer).toContain('out')
      }
    }
  })

  it('agrees with evaluating in every model of the axioms', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 20; seed++) {
        const question = draw(closeItUpGame, difficulty, seed)
        const models = modelsOfQuestion(question)
        for (const candidate of question.candidates) {
          const byHand = models.every((index) =>
            holdsIn(WORLD.structures[index]!, parse(candidate)),
          )
          expect(belongs(question, candidate)).toBe(byHand)
        }
      }
    }
  })

  it('never asks about a formula it also gives as an axiom', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 20; seed++) {
        const question = draw(closeItUpGame, difficulty, seed)
        for (const candidate of question.candidates) {
          expect(question.axioms).not.toContain(candidate)
        }
      }
    }
  })

  it('gives partial credit and names no formula when wrong', () => {
    const question = draw(closeItUpGame, 'medium', 2)
    const answer = closeItUpGame.solve(question)
    const flipped = [...answer]
    flipped[0] = flipped[0] === 'in' ? 'out' : 'in'
    const verdict = closeItUpGame.check(question, flipped)
    expect(verdict.correct).toBe(false)
    expect(verdict.score).toBeGreaterThan(0)
    for (const candidate of question.candidates) expect(verdict.message).not.toContain(candidate)
  })
})

describe('Name The Property', () => {
  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (let seed = 0; seed < 30; seed++) {
      const question = draw(theoryPropertiesGame, difficulty, seed)
      expect(
        theoryPropertiesGame.check(question, theoryPropertiesGame.solve(question)).correct,
        question.axioms.join(', '),
      ).toBe(true)
    }
  })

  it('offers a workable witness whenever the theory is incomplete', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 30; seed++) {
        const question = draw(theoryPropertiesGame, difficulty, seed)
        const answer = theoryPropertiesGame.solve(question)
        if (answer.complete || !answer.consistent) continue
        expect(answer.witness).not.toBeNull()
        expect(undecided(question, answer.witness as string)).toBe(true)
        expect(question.bank).toContain(answer.witness)
      }
    }
  })

  it('accepts any witness that works, not only the stored one', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 20; seed++) {
        const question = draw(theoryPropertiesGame, difficulty, seed)
        const answer = theoryPropertiesGame.solve(question)
        if (answer.complete || !answer.consistent) continue
        for (const source of question.bank) {
          if (!undecided(question, source)) continue
          expect(theoryPropertiesGame.check(question, { ...answer, witness: source }).correct).toBe(
            true,
          )
        }
      }
    }
  })

  it('refuses a witness the theory does decide', () => {
    for (let seed = 0; seed < 30; seed++) {
      const question = draw(theoryPropertiesGame, 'medium', seed)
      const answer = theoryPropertiesGame.solve(question)
      if (answer.complete || !answer.consistent) continue
      const decided = question.bank.find((source) => !undecided(question, source))
      if (decided === undefined) continue
      const verdict = theoryPropertiesGame.check(question, { ...answer, witness: decided })
      expect(verdict.correct).toBe(false)
      expect(verdict.message).not.toContain(answer.witness as string)
    }
  })

  it('produces consistent, inconsistent and complete theories across a round', () => {
    const seen = new Set<string>()
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 40; seed++) {
        const answer = theoryPropertiesGame.solve(draw(theoryPropertiesGame, difficulty, seed))
        seen.add(`${answer.consistent}/${answer.complete}`)
      }
    }
    expect(seen.has('false/false')).toBe(true)
    expect(seen.has('true/true')).toBe(true)
    expect(seen.has('true/false')).toBe(true)
  })

  it('calls an inconsistent theory inconsistent', () => {
    const question = { axioms: ['∀x:p(x)', '∃x:¬p(x)'], bank: [...CATALOGUE].slice(0, 4) }
    expect(theoryPropertiesGame.solve(question).consistent).toBe(false)
  })
})

describe('Union Trouble', () => {
  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (let seed = 0; seed < 30; seed++) {
      const question = draw(unionTroubleGame, difficulty, seed)
      expect(
        unionTroubleGame.check(question, unionTroubleGame.solve(question)).correct,
        `${question.left.join()} | ${question.right.join()}`,
      ).toBe(true)
    }
  })

  it('puts a workable witness on the board whenever one exists', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 30; seed++) {
        const question = draw(unionTroubleGame, difficulty, seed)
        const witness = witnessOf(question)
        if (witness === null) continue
        expect(question.bank).toContain(witness)
        expect(isWitness(question, witness)).toBe(true)
      }
    }
  })

  it('a witness really is entailed by both and in neither', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 30; seed++) {
        const question = draw(unionTroubleGame, difficulty, seed)
        const witness = witnessOf(question)
        if (witness === null) continue
        const formula = parse(witness)
        const both = unionClosureModels(leftModels(question), rightModels(question))
        expect(inTheory(WORLD, both, formula)).toBe(true)
        expect(inTheory(WORLD, leftModels(question), formula)).toBe(false)
        expect(inTheory(WORLD, rightModels(question), formula)).toBe(false)
      }
    }
  })

  it('deals both outcomes — some unions are closed', () => {
    const seen = new Set<boolean>()
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 40; seed++) {
        seen.add(witnessOf(draw(unionTroubleGame, difficulty, seed)) === null)
      }
    }
    expect(seen).toEqual(new Set([true, false]))
  })

  it('refuses "nothing breaks it" when something does, without naming it', () => {
    for (let seed = 0; seed < 40; seed++) {
      const question = draw(unionTroubleGame, 'medium', seed)
      const witness = witnessOf(question)
      if (witness === null) continue
      const verdict = unionTroubleGame.check(question, { witness: null })
      expect(verdict.correct).toBe(false)
      expect(verdict.message).not.toContain(witness)
    }
  })

  it('refuses a formula one of the theories already contains', () => {
    for (let seed = 0; seed < 40; seed++) {
      const question = draw(unionTroubleGame, 'hard', seed)
      const inLeft = question.bank.find((source) =>
        inTheory(WORLD, leftModels(question), parse(source)),
      )
      if (inLeft === undefined) continue
      expect(unionTroubleGame.check(question, { witness: inLeft }).correct).toBe(false)
    }
  })
})
