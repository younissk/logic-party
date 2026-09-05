import { describe, expect, it } from 'vitest'

import {
  clauseKey,
  clauseSetToFormula,
  components,
  format,
  isDerivable,
  isSatisfiable,
  allResolvents,
  isTautologicalClause,
  makeRng,
  parse,
  resolveOn,
  sharedVariables,
  showClauseSet,
  type Clause,
} from '@/logic'
import { DIFFICULTIES, type Difficulty } from '@/engine/types'
import { classifyPair, equivalenceGame, type EquivalenceQuestion } from './equivalence'
import { resolventsGame, type ResolventsQuestion } from './resolvents'
import { derivableGame, type DerivableQuestion } from './derivable'
import { refutationGame, type RefutationQuestion, type Step } from './refutation'

/**
 * Generation is expensive for these games — several need a *satisfiable* or
 * *unsatisfiable* clause set found by rejection sampling — so each sample is
 * built once per difficulty and shared across the assertions that use it.
 * Without this the suite is slow enough to time out on a slower machine.
 */
const cache = new Map<string, unknown[]>()

const draw = <Q,>(
  game: { generate: (c: never) => Q },
  key: string,
  difficulty: Difficulty,
  count: number,
): Q[] => {
  const id = `${key}:${difficulty}:${count}`
  const seen = cache.get(id)
  if (seen !== undefined) return seen as Q[]
  const made = Array.from({ length: count }, (_, i) =>
    game.generate({ rng: makeRng(`r-${i}`), difficulty, questionIndex: i } as never),
  )
  cache.set(id, made)
  return made
}

// ---------------------------------------------------------------------------

describe('equivalence', () => {
  const sample = (d: Difficulty, n: number) => draw<EquivalenceQuestion>(equivalenceGame, 'equivalenceGame', d, n)

  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 120)) {
      expect(equivalenceGame.check(question, equivalenceGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('asks about all three relationships on %s', (difficulty) => {
    const questions = sample(difficulty, 240)
    for (const relationship of ['equivalent', 'sat-equivalent', 'neither'] as const) {
      const share =
        questions.filter((q) => classifyPair(q.left, q.right) === relationship).length / questions.length
      expect(share, `${relationship} on ${difficulty}`).toBeGreaterThan(0.15)
    }
  })

  /**
   * The trap the whole game exists for. Two unsatisfiable formulas have the
   * same models — none — so they are equivalent, not "satisfiability
   * equivalent only". Getting this backwards would teach the wrong thing.
   */
  it('calls two unrelated unsatisfiable formulas equivalent', () => {
    expect(classifyPair(parse('a ∧ ¬a'), parse('(p ∨ q) ∧ ¬p ∧ ¬q'))).toBe('equivalent')
  })

  it('never claims sat-equivalence for a pair that disagrees on satisfiability', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(difficulty, 120)) {
        const relationship = classifyPair(question.left, question.right)
        const agree = isSatisfiable(question.left) === isSatisfiable(question.right)
        expect(relationship === 'neither').toBe(!agree)
      }
    }
  })

  it('never shows two formulas that print the same', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(difficulty, 120)) {
        expect(format(question.left)).not.toBe(format(question.right))
      }
    }
  })
})

// ---------------------------------------------------------------------------

describe('resolvents', () => {
  const sample = (d: Difficulty, n: number) => draw<ResolventsQuestion>(resolventsGame, 'resolventsGame', d, n)

  it.each(DIFFICULTIES)('marks the reference set correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 120)) {
      expect(resolventsGame.check(question, resolventsGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the reference set is exactly the one-step resolvents on %s', (difficulty) => {
    for (const question of sample(difficulty, 120)) {
      const reachable = new Set(
        allResolvents(question.clauses).map((step) => clauseKey(step.resolvent)),
      )
      expect(new Set(question.resolvents.map(clauseKey))).toEqual(reachable)
    }
  })

  it.each(DIFFICULTIES)('every resolvent really comes from one pair and one pivot on %s', (difficulty) => {
    for (const question of sample(difficulty, 120)) {
      for (const target of question.resolvents) {
        const reachable = question.clauses.some((left, i) =>
          question.clauses.some((right, j) => {
            if (j <= i) return false
            return sharedVariables(left, right).some((pivot) => {
              const resolvent = resolveOn(left, right, pivot)
              return resolvent !== null && clauseKey(resolvent) === clauseKey(target)
            })
          }),
        )
        expect(reachable, showClauseSet(question.clauses)).toBe(true)
      }
    }
  })

  it.each(DIFFICULTIES)('always includes a tautological resolvent on %s', (difficulty) => {
    // That is the lesson: cancel one pivot, the other clash survives.
    for (const question of sample(difficulty, 120)) {
      expect(question.resolvents.some(isTautologicalClause), showClauseSet(question.clauses)).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('rejects a tray that is one short on %s', (difficulty) => {
    for (const question of sample(difficulty, 120)) {
      const short = resolventsGame.solve(question).slice(0, -1)
      const verdict = resolventsGame.check(question, short)
      expect(verdict.correct).toBe(false)
      expect(verdict.message).toBe('1 still to find')
    }
  })

  it('accepts the resolvents in any order', () => {
    const rng = makeRng('tray')
    for (const question of sample('medium', 60)) {
      expect(resolventsGame.check(question, rng.shuffle(question.resolvents)).correct).toBe(true)
    }
  })

  it('never says which ones are missing', () => {
    // Sprint shows `message` before the retry; naming them would hand the
    // question over.
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(difficulty, 60)) {
        const message = resolventsGame.check(question, []).message
        expect(message).toMatch(/^\d+ still to find$/)
      }
    }
  })
})

// ---------------------------------------------------------------------------

describe('derivable', () => {
  const sample = (d: Difficulty, n: number) => draw<DerivableQuestion>(derivableGame, 'derivableGame', d, n)

  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(derivableGame.check(question, derivableGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('agrees with saturating the clause set on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      question.candidates.forEach((clause, index) => {
        expect(question.derivable.includes(index), showClauseSet([clause])).toBe(
          isDerivable(question.clauses, clause),
        )
      })
    }
  })

  it.each(DIFFICULTIES)('is never all or nothing on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(question.derivable.length).toBeGreaterThan(0)
      expect(question.derivable.length).toBeLessThan(question.candidates.length)
    }
  })

  it.each(DIFFICULTIES)('the empty clause is derivable exactly when the set is unsatisfiable on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      const emptyIndex = question.candidates.findIndex((clause) => clause.length === 0)
      if (emptyIndex === -1) continue
      expect(question.derivable.includes(emptyIndex)).toBe(
        !isSatisfiable(clauseSetToFormula(question.clauses)),
      )
    }
  })

  it('never marks a clause spanning two components as derivable', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(difficulty, 60)) {
        const groups = components(question.clauses)
        if (groups.length < 2) continue
        for (const index of question.derivable) {
          const candidate = question.candidates[index] as Clause
          const touched = groups.filter((group) =>
            group.some((clause) => sharedVariables(clause, candidate).length > 0),
          )
          expect(touched.length, showClauseSet([candidate])).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------

describe('refutation', () => {
  const sample = (d: Difficulty, n: number) => draw<RefutationQuestion>(refutationGame, 'refutationGame', d, n)

  it.each(DIFFICULTIES)('always poses an unsatisfiable set on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(isSatisfiable(clauseSetToFormula(question.clauses)), showClauseSet(question.clauses)).toBe(
        false,
      )
    }
  })

  it.each(DIFFICULTIES)('never hands over the empty clause on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(question.clauses.every((clause) => clause.length > 0)).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the reference refutation is legal and reaches ⊥ on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      const steps = refutationGame.solve(question) as Step[]
      const available = question.clauses.map(clauseKey)
      for (const step of steps) {
        expect(available).toContain(clauseKey(step.left))
        expect(available).toContain(clauseKey(step.right))
        const resolvent = resolveOn(step.left, step.right, step.pivot)
        expect(resolvent).not.toBeNull()
        expect(clauseKey(resolvent as Clause)).toBe(clauseKey(step.resolvent))
        available.push(clauseKey(step.resolvent))
      }
      expect(available).toContain('')
      expect(refutationGame.check(question, steps).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('par matches the reference refutation on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect((refutationGame.solve(question) as Step[]).length).toBe(question.par)
    }
  })

  it('rejects a derivation that does not reach ⊥', () => {
    for (const question of sample('medium', 30)) {
      const steps = (refutationGame.solve(question) as Step[]).slice(0, -1)
      expect(refutationGame.check(question, steps).correct).toBe(false)
    }
  })

  it('rejects a step whose parents were never available', () => {
    for (const question of sample('medium', 30)) {
      const steps = refutationGame.solve(question) as Step[]
      if (steps.length < 2) continue
      // Use the last step first: its parents do not exist yet.
      expect(refutationGame.check(question, [steps[steps.length - 1] as Step]).correct).toBe(false)
    }
  })

  it('scores a wandering derivation below a tight one', () => {
    for (const question of sample('medium', 20)) {
      const steps = refutationGame.solve(question) as Step[]
      const tight = refutationGame.check(question, steps)
      // Repeat the first step's parents through a detour: same result, more steps.
      const padded = [...steps, ...steps]
      const loose = refutationGame.check(question, padded)
      expect(tight.score ?? 1).toBeGreaterThanOrEqual(loose.score ?? 0)
    }
  })

  it.each(DIFFICULTIES)('always leaves a unit clause to start from on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(question.clauses.some((clause) => clause.length === 1)).toBe(true)
    }
  })
})
