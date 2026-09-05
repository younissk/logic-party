import { describe, expect, it } from 'vitest'

import {
  CNF_STEPS,
  CNF_STEP_LABELS,
  applyCnfStep,
  format,
  isCNF,
  isEquivalent,
  makeRng,
  nextCnfStep,
  size,
  type CnfStep,
} from '@/logic'
import { DIFFICULTIES, type Difficulty } from '@/engine/types'
import { PROFILES, cnfPipelineGame, drive, type CnfPipelineQuestion } from './cnfPipeline'

const sample = (difficulty: Difficulty, count: number): CnfPipelineQuestion[] =>
  Array.from({ length: count }, (_, i) =>
    cnfPipelineGame.generate({ rng: makeRng(`cnf-${i}`), difficulty, questionIndex: i }),
  )

describe('generate', () => {
  it.each(DIFFICULTIES)('is deterministic on %s', (difficulty) => {
    const draw = () =>
      format(cnfPipelineGame.generate({ rng: makeRng('fixed'), difficulty, questionIndex: 0 }).formula)
    expect(draw()).toBe(draw())
  })

  it.each(DIFFICULTIES)('stays inside the size cap on %s', (difficulty) => {
    for (const question of sample(difficulty, 200)) {
      expect(size(question.formula), format(question.formula)).toBeLessThanOrEqual(
        PROFILES[difficulty].maxSize,
      )
    }
  })

  /**
   * Sampling formulas and taking whatever step fell out would bury 'clean' and
   * 'done', which only appear at the very end of a run — so the generator picks
   * the answer first. This is the check that it worked.
   */
  it.each(DIFFICULTIES)('opens on every rung of the ladder on %s', (difficulty) => {
    // 'done' is not among them: a formula already in CNF has nothing to drive.
    const questions = sample(difficulty, 400)
    for (const step of CNF_STEPS.filter((entry) => entry !== 'done')) {
      const share = questions.filter((q) => nextCnfStep(q.formula) === step).length / questions.length
      expect(share, `${step} on ${difficulty}`).toBeGreaterThan(0.06)
    }
  })

  it.each(DIFFICULTIES)('always has at least one move to make on %s', (difficulty) => {
    for (const question of sample(difficulty, 200)) {
      expect(question.par, format(question.formula)).toBeGreaterThan(0)
      expect(nextCnfStep(question.formula)).not.toBe('done')
    }
  })

  it.each(DIFFICULTIES)('every question is a real point on a real run on %s', (difficulty) => {
    // A question whose formula cannot be driven to CNF would be unanswerable.
    for (const question of sample(difficulty, 150)) {
      let current = question.formula
      for (let guard = 0; guard < 8; guard++) {
        const step = nextCnfStep(current)
        if (step === 'done') break
        current = applyCnfStep(current, step)
      }
      expect(isCNF(current), format(question.formula)).toBe(true)
      expect(isEquivalent(question.formula, current), format(question.formula)).toBe(true)
    }
  })
})

describe('check', () => {
  it.each(DIFFICULTIES)('marks the reference route correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 200)) {
      expect(
        cnfPipelineGame.check(question, cnfPipelineGame.solve(question)).correct,
        format(question.formula),
      ).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the reference route really reaches CNF on %s', (difficulty) => {
    for (const question of sample(difficulty, 200)) {
      const { result, wasted } = drive(question.formula, cnfPipelineGame.solve(question))
      expect(wasted, format(question.formula)).toBe(0)
      expect(nextCnfStep(result), format(question.formula)).toBe('done')
      expect(isEquivalent(question.formula, result), format(question.formula)).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('par is the length of that route on %s', (difficulty) => {
    for (const question of sample(difficulty, 200)) {
      expect(question.par).toBe(cnfPipelineGame.solve(question).length)
    }
  })

  it.each(DIFFICULTIES)('rejects stopping before CNF on %s', (difficulty) => {
    for (const question of sample(difficulty, 120)) {
      const short = cnfPipelineGame.solve(question).slice(0, -1)
      const verdict = cnfPipelineGame.check(question, short)
      expect(verdict.correct, format(question.formula)).toBe(false)
      expect(verdict.message).toBe('Not CNF yet')
    }
  })

  it.each(DIFFICULTIES)('a rule out of turn changes nothing on %s', (difficulty) => {
    // Which is what makes the order the algorithm rather than a preference.
    for (const question of sample(difficulty, 120)) {
      const due = nextCnfStep(question.formula)
      const other = CNF_STEPS.find((step) => step !== due && step !== 'done') as CnfStep
      const { result } = drive(question.formula, [other])
      expect(format(result), format(question.formula)).toBe(format(question.formula))
    }
  })

  it.each(DIFFICULTIES)('a wasted tap still reaches CNF but does not score full on %s', (difficulty) => {
    for (const question of sample(difficulty, 120)) {
      const due = nextCnfStep(question.formula)
      const other = CNF_STEPS.find((step) => step !== due && step !== 'done') as CnfStep
      const verdict = cnfPipelineGame.check(question, [other, ...cnfPipelineGame.solve(question)])
      expect(verdict.correct, format(question.formula)).toBe(false)
      expect(verdict.message).toBe('1 tap did nothing')
      expect(verdict.score ?? 0).toBeGreaterThan(0)
    }
  })

  it('never names the move that was due', () => {
    // Sprint shows `message` before the retry.
    const messages = new Set<string>()
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(difficulty, 80)) {
        messages.add(cnfPipelineGame.check(question, []).message)
      }
    }
    for (const message of messages) {
      for (const label of Object.values(CNF_STEP_LABELS)) {
        expect(message).not.toContain(label)
      }
    }
  })
})
