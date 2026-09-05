import { describe, expect, it } from 'vitest'

import { eliminateConjunction } from '@/logic'
import { makeRng } from '@/logic/rng'
import type { Difficulty } from '@/engine/types'
import { qeFiniteGame, leavesOf, prefixOf, formulaOf, tuples } from './qeFinite'
import { conjunctsOf, qeDenseGame, parseConjunct, reference } from './qeDense'

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

describe('Fold The Quantifier', () => {
  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (let seed = 0; seed < 30; seed++) {
      const question = draw(qeFiniteGame, difficulty, seed)
      expect(qeFiniteGame.check(question, qeFiniteGame.solve(question)).correct).toBe(true)
    }
  })

  it('has one leaf per assignment of the prefix', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 20; seed++) {
        const question = draw(qeFiniteGame, difficulty, seed)
        const { quantifiers } = prefixOf(formulaOf(question))
        expect(leavesOf(question)).toHaveLength(question.universe.length ** quantifiers.length)
        expect(tuples(question)).toHaveLength(leavesOf(question).length)
      }
    }
  })

  it('every leaf is in the bank, and the bank holds decoys too', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 20; seed++) {
        const question = draw(qeFiniteGame, difficulty, seed)
        for (const leaf of leavesOf(question)) expect(question.bank).toContain(leaf)
        // The bank is every instance of the matrix and of its variables
        // swapped. For a symmetric prefix those two sets coincide, and then
        // the question is purely about placement — which is still the skill.
        expect(question.bank.length).toBeGreaterThanOrEqual(leavesOf(question).length)
      }
    }
  })

  it('every leaf is ground — the quantifiers really are gone', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 20; seed++) {
        const question = draw(qeFiniteGame, difficulty, seed)
        for (const leaf of leavesOf(question)) {
          expect(leaf).not.toMatch(/[∀∃]/)
          for (const name of ['x', 'y']) expect(leaf).not.toMatch(new RegExp(`\\b${name}\\b`))
        }
      }
    }
  })

  it('∀ takes ∧ and ∃ takes ∨', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 20; seed++) {
        const question = draw(qeFiniteGame, difficulty, seed)
        const { quantifiers } = prefixOf(formulaOf(question))
        const answer = qeFiniteGame.solve(question)
        quantifiers.forEach(({ quantifier }, index) => {
          expect(answer.connectives[index]).toBe(quantifier === 'forall' ? 'and' : 'or')
        })
      }
    }
  })

  it('refuses a swapped pair of leaves without saying which', () => {
    for (let seed = 0; seed < 20; seed++) {
      const question = draw(qeFiniteGame, 'medium', seed)
      const answer = qeFiniteGame.solve(question)
      const leaves = [...answer.leaves]
      const [first, second] = [leaves[0]!, leaves[1]!]
      if (first === second) continue
      leaves[0] = second
      leaves[1] = first
      const verdict = qeFiniteGame.check(question, { ...answer, leaves })
      expect(verdict.correct).toBe(false)
      expect(verdict.message).not.toContain(first)
      expect(verdict.message).not.toContain(second)
      expect(verdict.score).toBeGreaterThan(0)
    }
  })

  it('refuses a flipped connective', () => {
    const question = draw(qeFiniteGame, 'easy', 5)
    const answer = qeFiniteGame.solve(question)
    const connectives = answer.connectives.map((one) => (one === 'and' ? 'or' : 'and')) as (
      | 'and'
      | 'or'
    )[]
    expect(qeFiniteGame.check(question, { ...answer, connectives }).correct).toBe(false)
  })
})

describe('Squeeze It Out', () => {
  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (let seed = 0; seed < 40; seed++) {
      const question = draw(qeDenseGame, difficulty, seed)
      expect(
        qeDenseGame.check(question, qeDenseGame.solve(question)).correct,
        question.conjuncts.join(' ∧ '),
      ).toBe(true)
    }
  })

  it('never asks for an atom the bank cannot supply', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 40; seed++) {
        const question = draw(qeDenseGame, difficulty, seed)
        for (const atom of reference(question).atoms) expect(question.bank).toContain(atom)
      }
    }
  })

  it('offers both directions of every pair it offers at all', () => {
    // Otherwise the direction of the cross product could be read off the bank.
    for (let seed = 0; seed < 30; seed++) {
      const question = draw(qeDenseGame, 'hard', seed)
      for (const atom of question.bank) {
        const [left, right] = atom.split('<') as [string, string]
        expect(question.bank).toContain(`${right}<${left}`)
      }
    }
  })

  it('agrees with the elimination in the logic module', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 30; seed++) {
        const question = draw(qeDenseGame, difficulty, seed)
        const direct = eliminateConjunction(
          question.variable,
          question.conjuncts.map(parseConjunct),
        )
        const answer = qeDenseGame.solve(question)
        if (answer.verdict === 'true') expect(direct.kind).toBe('true')
        else if (answer.verdict === 'false') expect(direct.kind).toBe('false')
        else expect(conjunctsOf(direct)).toEqual(answer.atoms)
      }
    }
  })

  it('the eliminated variable never survives', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 40; seed++) {
        const question = draw(qeDenseGame, difficulty, seed)
        for (const atom of reference(question).atoms) {
          expect(atom).not.toContain(question.variable)
        }
      }
    }
  })

  it('produces all three outcomes across a round', () => {
    const seen = new Set<string>()
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 60; seed++) {
        seen.add(reference(draw(qeDenseGame, difficulty, seed)).verdict)
      }
    }
    expect(seen).toEqual(new Set(['atoms', 'true', 'false']))
  })

  it('refuses the wrong verdict without naming the right one', () => {
    for (let seed = 0; seed < 30; seed++) {
      const question = draw(qeDenseGame, 'medium', seed)
      const answer = qeDenseGame.solve(question)
      const wrong = answer.verdict === 'true' ? 'false' : 'true'
      const verdict = qeDenseGame.check(question, { verdict: wrong, atoms: [] })
      if (verdict.correct) continue
      expect(verdict.message).not.toContain('⊤')
      expect(verdict.message).not.toContain('⊥')
    }
  })

  it('refuses a reversed atom, and the message does not carry it', () => {
    for (let seed = 0; seed < 40; seed++) {
      const question = draw(qeDenseGame, 'medium', seed)
      const answer = qeDenseGame.solve(question)
      if (answer.verdict !== 'atoms' || answer.atoms.length === 0) continue
      const [left, right] = (answer.atoms[0] as string).split('<') as [string, string]
      const atoms = [`${right}<${left}`, ...answer.atoms.slice(1)]
      const verdict = qeDenseGame.check(question, { verdict: 'atoms', atoms })
      expect(verdict.correct).toBe(false)
      for (const atom of answer.atoms) expect(verdict.message).not.toContain(atom)
    }
  })

  it('an empty side is ⊤ and a shared variable is ⊥', () => {
    const above = { variable: 'x', conjuncts: ['y<x'], bank: ['y<z', 'z<y'] }
    expect(reference(above).verdict).toBe('true')
    const clash = { variable: 'x', conjuncts: ['y<x', 'x<y'], bank: ['y<z', 'z<y'] }
    expect(reference(clash).verdict).toBe('false')
  })

  it('crosses two bounds against two', () => {
    const question = {
      variable: 'x',
      conjuncts: ['u<x', 'v<x', 'x<y', 'x<z'],
      bank: [],
    }
    expect(new Set(reference(question).atoms)).toEqual(
      new Set(['u<y', 'u<z', 'v<y', 'v<z']),
    )
  })
})
