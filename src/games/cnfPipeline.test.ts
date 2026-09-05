import { describe, expect, it } from 'vitest'

import {
  CNF_STEPS,
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
import { PROFILES, cnfPipelineGame, type CnfPipelineQuestion } from './cnfPipeline'

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
  it.each(DIFFICULTIES)('asks about every step on %s', (difficulty) => {
    const questions = sample(difficulty, 400)
    for (const step of CNF_STEPS) {
      const share = questions.filter((q) => nextCnfStep(q.formula) === step).length / questions.length
      expect(share, `${step} on ${difficulty}`).toBeGreaterThan(0.06)
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
  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 200)) {
      expect(
        cnfPipelineGame.check(question, cnfPipelineGame.solve(question)).correct,
        format(question.formula),
      ).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('marks every other move wrong on %s', (difficulty) => {
    for (const question of sample(difficulty, 80)) {
      const truth = cnfPipelineGame.solve(question) as CnfStep
      for (const step of CNF_STEPS.filter((s) => s !== truth)) {
        expect(cnfPipelineGame.check(question, step).correct, format(question.formula)).toBe(false)
      }
    }
  })

  it('never reveals the move in the retry message', () => {
    // Sprint shows `message` before the retry and hides `detail`; a message
    // that named the right move would hand the question over.
    const seen = new Map<CnfStep, Set<string>>()
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(difficulty, 80)) {
        const truth = cnfPipelineGame.solve(question) as CnfStep
        for (const step of CNF_STEPS.filter((s) => s !== truth)) {
          const messages = seen.get(step) ?? new Set<string>()
          messages.add(cnfPipelineGame.check(question, step).message)
          seen.set(step, messages)
        }
      }
    }
    for (const [step, messages] of seen) {
      expect([...messages], `messages for ${step}`).toHaveLength(1)
    }
  })

  it('explains what the right move produces', () => {
    for (const question of sample('medium', 40)) {
      const detail = cnfPipelineGame.check(question, cnfPipelineGame.solve(question)).detail ?? ''
      expect(detail, format(question.formula)).toMatch(/^(Becomes|Every conjunct)/)
    }
  })
})
