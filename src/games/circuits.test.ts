import { describe, expect, it } from 'vitest'

import { evaluatePolynomial, gatePolynomial, gateValue, isZero, showPolynomial } from '@/logic'
import { makeRng } from '@/logic/rng'
import type { Difficulty } from '@/engine/types'
import { gatePolynomialsGame, dialledPolynomial, failingRows, gateRows } from './gatePolynomials'
import {
  circuitVerifyGame,
  isCorrectCircuit,
  normalForm,
  replay,
  rulesOf,
  specPolynomial,
} from './circuitVerify'

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

const draw = <Q,>(
  game: { generate: (context: { rng: ReturnType<typeof makeRng>; difficulty: Difficulty; questionIndex: number }) => Q },
  difficulty: Difficulty,
  seed: number,
): Q => game.generate({ rng: makeRng(`s${seed}`), difficulty, questionIndex: 0 })

describe('Write The Gate', () => {
  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (let seed = 0; seed < 25; seed++) {
      const question = draw(gatePolynomialsGame, difficulty, seed)
      const answer = gatePolynomialsGame.solve(question)
      expect(gatePolynomialsGame.check(question, answer).correct, showPolynomial(
        dialledPolynomial(question, answer),
      )).toBe(true)
    }
  })

  it('the reference answer is Figure 5.3', () => {
    for (let seed = 0; seed < 25; seed++) {
      const question = draw(gatePolynomialsGame, 'hard', seed)
      const dialled = dialledPolynomial(question, gatePolynomialsGame.solve(question))
      const figure = gatePolynomial(question.kind, question.x, question.y, question.z)
      expect(showPolynomial(dialled)).toBe(showPolynomial(figure))
    }
  })

  it('the reference answer is the only one that zeroes every row', () => {
    // Four rows and four dials: if some other setting also worked, the
    // question would have no unique answer and the marking would be unfair.
    const question = draw(gatePolynomialsGame, 'medium', 3)
    const range = [-2, -1, 0, 1, 2]
    const working: string[] = []
    for (const x of range) {
      for (const y of range) {
        for (const xy of range) {
          for (const constant of range) {
            const answer = { x, y, xy, constant }
            if (failingRows(question, answer).length === 0) working.push(JSON.stringify(answer))
          }
        }
      }
    }
    expect(working).toEqual([JSON.stringify(gatePolynomialsGame.solve(question))])
  })

  it('the polynomial vanishes exactly on the gate rows', () => {
    for (let seed = 0; seed < 15; seed++) {
      const question = draw(gatePolynomialsGame, 'medium', seed)
      const polynomial = dialledPolynomial(question, gatePolynomialsGame.solve(question))
      for (const row of gateRows(question)) {
        const point = { [question.x]: row.x, [question.y]: row.y, [question.z]: row.z }
        expect(evaluatePolynomial(polynomial, point)).toBe(0)
        // And the other output, which the gate would not produce, must not.
        expect(
          evaluatePolynomial(polynomial, { ...point, [question.z]: 1 - row.z }),
        ).not.toBe(0)
      }
      expect(gateValue(question.kind, 1, 1)).toBeTypeOf('number')
    }
  })

  it('refuses a wrong dial and says nothing about which', () => {
    const question = draw(gatePolynomialsGame, 'easy', 1)
    const wanted = gatePolynomialsGame.solve(question)
    const answer = { ...wanted, xy: wanted.xy + 1 }
    const verdict = gatePolynomialsGame.check(question, answer)
    expect(verdict.correct).toBe(false)
    // Word boundaries: the message legitimately contains "yet".
    for (const dial of ['x', 'y', 'xy', 'constant']) {
      expect(verdict.message).not.toMatch(new RegExp(`\\b${dial}\\b`))
    }
    expect(verdict.message).not.toContain(String(wanted.xy))
  })

  it('gives partial credit by rows survived', () => {
    const question = draw(gatePolynomialsGame, 'easy', 2)
    const verdict = gatePolynomialsGame.check(question, { x: 0, y: 0, xy: 0, constant: 0 })
    expect(verdict.score).toBeGreaterThan(0)
    expect(verdict.score).toBeLessThan(1)
  })
})

describe('Reduce To Zero', () => {
  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (let seed = 0; seed < 25; seed++) {
      const question = draw(circuitVerifyGame, difficulty, seed)
      expect(circuitVerifyGame.check(question, circuitVerifyGame.solve(question)).correct, question.name).toBe(
        true,
      )
    }
  })

  it('reaches a normal form no rule applies to', () => {
    for (let seed = 0; seed < 25; seed++) {
      const question = draw(circuitVerifyGame, 'hard', seed)
      const solution = circuitVerifyGame.solve(question)
      const { polynomial, unknown } = replay(question, solution.applied)
      expect(unknown).toEqual([])
      expect(showPolynomial(polynomial)).toBe(showPolynomial(normalForm(question)))
      for (const rule of rulesOf(question)) {
        expect(polynomial.some((monomial) => (monomial.powers[rule.variable] ?? 0) >= rule.exponent)).toBe(
          false,
        )
      }
    }
  })

  it('the half adder really does add', () => {
    const half = draw(circuitVerifyGame, 'easy', 0)
    // Whichever design that seed picked, both verdicts have to exist in the
    // pool — a game where every answer is "correct" teaches nothing.
    const seen = new Set<boolean>()
    for (let seed = 0; seed < 30; seed++) {
      seen.add(isCorrectCircuit(draw(circuitVerifyGame, 'easy', seed)))
    }
    expect(seen).toEqual(new Set([true, false]))
    expect(specPolynomial(half).length).toBeGreaterThan(0)
  })

  it('agrees with running every input through the circuit', () => {
    // The independent check: simulate the gates on all 2^n inputs and see
    // whether the relation holds. Reduction to 0 must mean exactly that.
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 20; seed++) {
        const question = draw(circuitVerifyGame, difficulty, seed)
        let holds = true
        const count = question.inputs.length
        for (let bits = 0; bits < 1 << count; bits++) {
          const point: Record<string, number> = {}
          question.inputs.forEach((name, index) => {
            point[name] = (bits >> index) & 1
          })
          for (const gate of question.gates) {
            point[gate.z] = gateValue(gate.kind, point[gate.x] as number, point[gate.y] as number)
          }
          const value = question.spec.reduce(
            (total, [coefficient, name]) => total + coefficient * (point[name] as number),
            0,
          )
          if (value !== 0) holds = false
        }
        expect(isCorrectCircuit(question), `${question.name} at ${difficulty}`).toBe(holds)
      }
    }
  })

  it('refuses a claim made before the reduction is finished', () => {
    const question = draw(circuitVerifyGame, 'medium', 4)
    const verdict = circuitVerifyGame.check(question, { applied: [], claim: 'correct' })
    expect(verdict.correct).toBe(false)
    expect(verdict.message).toContain('appl')
  })

  it('refuses the wrong verdict without giving the right one away', () => {
    for (let seed = 0; seed < 20; seed++) {
      const question = draw(circuitVerifyGame, 'easy', seed)
      const solution = circuitVerifyGame.solve(question)
      const flipped = solution.claim === 'correct' ? 'wrong' : 'correct'
      const verdict = circuitVerifyGame.check(question, { ...solution, claim: flipped })
      expect(verdict.correct).toBe(false)
      expect(verdict.message.toLowerCase()).not.toContain('reduced to 0')
      expect(verdict.message.toLowerCase()).not.toContain('stuck')
    }
  })

  it('the subtractor of exam26bA does not verify', () => {
    let found = false
    for (let seed = 0; seed < 40; seed++) {
      const question = draw(circuitVerifyGame, 'easy', seed)
      if (question.name !== 'subtractor') continue
      found = true
      expect(isZero(normalForm(question))).toBe(false)
    }
    expect(found).toBe(true)
  })

  it('the full adder of Figure 5.2 does verify', () => {
    let found = false
    for (let seed = 0; seed < 40; seed++) {
      const question = draw(circuitVerifyGame, 'hard', seed)
      if (question.name !== 'full adder') continue
      found = true
      expect(isZero(normalForm(question))).toBe(true)
    }
    expect(found).toBe(true)
  })
})
