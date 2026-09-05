import { describe, expect, it } from 'vitest'

import { holdsUpTo } from '@/logic/arithmetic'
import { makeRng } from '@/logic/rng'
import type { Difficulty } from '@/engine/types'
import {
  LIMIT,
  PROPERTIES,
  RANGE_START,
  propertyOf,
  sayItInTheLanguageGame,
  verifyProperty,
} from './sayItInTheLanguage'

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

describe('the formulas really define the properties', () => {
  it.each(PROPERTIES.map((property) => [property.id, property] as const))(
    '%s agrees with plain arithmetic',
    (_id, property) => {
      // The formula and the predicate are written independently; if they part
      // company anywhere in range, the game would teach a wrong pairing.
      const { agrees, firstDisagreement } = verifyProperty(property)
      expect(agrees, `disagrees at n = ${firstDisagreement}`).toBe(true)
    },
  )

  it('no two properties pick out the same numbers', () => {
    const signatures = PROPERTIES.map((property) =>
      Array.from({ length: LIMIT }, (_, index) => (property.holds(index + RANGE_START) ? '1' : '0')).join(''),
    )
    expect(new Set(signatures).size).toBe(PROPERTIES.length)
  })

  it('picks out the numbers you would expect', () => {
    const hits = (id: string) =>
      Array.from({ length: LIMIT }, (_, index) => index + RANGE_START).filter((n) =>
        holdsUpTo(propertyOf(id).formula, { n }, LIMIT),
      )
    expect(hits('prime').slice(0, 5)).toEqual([2, 3, 5, 7, 11])
    expect(hits('square').slice(0, 5)).toEqual([1, 4, 9, 16, 25])
    // 49 is past the range the formulas are checked over.
    expect(hits('square-of-prime')).toEqual([4, 9, 25])
    expect(hits('semiprime').slice(0, 5)).toEqual([4, 6, 9, 10, 14])
    expect(hits('power-of-two').slice(0, 6)).toEqual([1, 2, 4, 8, 16, 32])
    expect(hits('two-primes').slice(0, 5)).toEqual([6, 10, 12, 14, 15])
    // 1 is both squarefree and squareful; 12 is neither.
    expect(hits('squarefree')).toContain(1)
    expect(hits('squareful')).toContain(1)
    expect(hits('squarefree')).not.toContain(12)
    expect(hits('squareful')).not.toContain(12)
  })
})

describe('Say It In The Language', () => {
  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (let seed = 0; seed < 30; seed++) {
      const question = draw(sayItInTheLanguageGame, difficulty, seed)
      expect(
        sayItInTheLanguageGame.check(question, sayItInTheLanguageGame.solve(question)).correct,
      ).toBe(true)
    }
  })

  it('never puts two properties that agree in range on the same board', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 30; seed++) {
        const question = draw(sayItInTheLanguageGame, difficulty, seed)
        const signatures = question.formulas.map((id) =>
          Array.from({ length: LIMIT }, (_, index) =>
            propertyOf(id).holds(index + RANGE_START) ? '1' : '0',
          ).join(''),
        )
        expect(new Set(signatures).size).toBe(question.formulas.length)
      }
    }
  })

  it('shows the same set of properties on both sides', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 20; seed++) {
        const question = draw(sayItInTheLanguageGame, difficulty, seed)
        expect([...question.descriptions].sort()).toEqual([...question.formulas].sort())
      }
    }
  })

  it('refuses a swapped pair and hands back a separating n', () => {
    for (let seed = 0; seed < 20; seed++) {
      const question = draw(sayItInTheLanguageGame, 'hard', seed)
      const answer = [...sayItInTheLanguageGame.solve(question)]
      const [first, second] = [answer[0] as number, answer[1] as number]
      answer[0] = second
      answer[1] = first
      const verdict = sayItInTheLanguageGame.check(question, answer)
      expect(verdict.correct).toBe(false)
      expect(verdict.detail).toMatch(/n = \d+|Try each formula/)
      for (const id of question.formulas) {
        expect(verdict.message).not.toContain(propertyOf(id).description)
      }
    }
  })
})
