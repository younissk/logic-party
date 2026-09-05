import { describe, expect, it } from 'vitest'

import {
  bcp,
  clauseKey,
  normaliseClause,
  clauseSetToFormula,
  countLeaves,
  dpll,
  eliminateVariable,
  isSatisfiable,
  isUnsatisfiableTree,
  leaves,
  learnFromDecisions,
  makeRng,
  showClauseSet,
  treeToRefutation,
  type Clause,
} from '@/logic'
import { DIFFICULTIES, type Difficulty } from '@/engine/types'
import { bcpGame, replay, type BcpQuestion } from './bcpFixpoint'
import { dpGame, runElimination, verdictOf, type DpQuestion } from './dpEliminate'
import { dpllGame, type DpllQuestion } from './dpllLeaves'
import { conflictClauseGame, type ConflictQuestion } from './conflictClause'
import { learnedClauseGame, type LearnedQuestion } from './learnedClause'

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
    game.generate({ rng: makeRng(`s-${i}`), difficulty, questionIndex: i } as never),
  )
  cache.set(id, made)
  return made
}

describe('BCP game', () => {
  const sample = (d: Difficulty, n: number) => draw<BcpQuestion>(bcpGame, 'bcpGame', d, n)

  it.each(DIFFICULTIES)('marks the reference run correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 100)) {
      expect(bcpGame.check(question, bcpGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the reference run really reaches the fixpoint on %s', (difficulty) => {
    for (const question of sample(difficulty, 100)) {
      const { result, illegal } = replay(question.clauses, bcpGame.solve(question))
      expect(illegal, showClauseSet(question.clauses)).toBeNull()
      expect(showClauseSet(result)).toBe(showClauseSet(bcp(question.clauses).result))

      // Either nothing is forced any more, or a conflict ended the run — a
      // conflict stops BCP whatever else is still on the table.
      const conflicted = result.some((clause) => clause.length === 0)
      expect(conflicted || !result.some((clause) => clause.length === 1)).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('rejects stopping one propagation early on %s', (difficulty) => {
    // "Until fixpoint" is the whole question, so stopping short has to fail.
    for (const question of sample(difficulty, 100)) {
      const full = bcpGame.solve(question)
      const verdict = bcpGame.check(question, full.slice(0, -1))
      expect(verdict.correct, showClauseSet(question.clauses)).toBe(false)
      expect(verdict.message).toBe('Not at fixpoint yet')
    }
  })

  it.each(DIFFICULTIES)('rejects propagating something that was not a unit on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      const bogus = [{ name: 'zz', negated: false }]
      expect(bcpGame.check(question, bogus).correct).toBe(false)
    }
  })

  it.each(DIFFICULTIES)('always needs more than one propagation on %s', (difficulty) => {
    for (const question of sample(difficulty, 100)) {
      expect(bcp(question.clauses).steps.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('asks about all three outcomes', () => {
    for (const difficulty of DIFFICULTIES) {
      const outcomes = sample(difficulty, 200).map((q) => bcp(q.clauses).outcome)
      for (const outcome of ['satisfiable', 'unsatisfiable', 'undecided'] as const) {
        expect(outcomes.filter((o) => o === outcome).length, `${outcome} on ${difficulty}`).toBeGreaterThan(10)
      }
    }
  })

  it('accepts any order that reaches the fixpoint', () => {
    // The notes prove the order does not matter, so the game must not care
    // either — only that you got there.
    const rng = makeRng('order')
    for (const question of sample('medium', 60)) {
      const reference = bcpGame.solve(question)
      if (reference.length < 2) continue
      const shuffled = rng.shuffle(reference)
      const verdict = bcpGame.check(question, shuffled)
      // A shuffle is only legal when each literal was still a unit when taken;
      // when it is, the run must be accepted.
      if (replay(question.clauses, shuffled).illegal === null) {
        expect(verdict.correct, showClauseSet(question.clauses)).toBe(true)
      }
    }
  })
})

describe('DP game', () => {
  const sample = (d: Difficulty, n: number) => draw<DpQuestion>(dpGame, 'dpGame', d, n)

  it.each(DIFFICULTIES)('marks the reference run correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 100)) {
      expect(dpGame.check(question, dpGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the reference run ends at the empty formula or the empty clause on %s', (difficulty) => {
    // The endpoint rule is the whole question; anything else is not an ending.
    for (const question of sample(difficulty, 100)) {
      const result = runElimination(question.clauses, dpGame.solve(question))
      const conflicted = result.some((clause) => clause.length === 0)
      expect(conflicted || result.length === 0, showClauseSet(question.clauses)).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the ending agrees with satisfiability on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      const result = runElimination(question.clauses, dpGame.solve(question))
      expect(verdictOf(result) === 'satisfiable').toBe(
        isSatisfiable(clauseSetToFormula(question.clauses)),
      )
    }
  })

  it.each(DIFFICULTIES)('rejects stopping with clauses still standing on %s', (difficulty) => {
    for (const question of sample(difficulty, 100)) {
      const short = dpGame.solve(question).slice(0, -1)
      const result = runElimination(question.clauses, short)
      // Eliminating all but one variable sometimes already empties the
      // formula, and stopping there is a real ending rather than a mistake.
      if (result.length === 0 || result.some((clause) => clause.length === 0)) continue
      expect(dpGame.check(question, short).correct, showClauseSet(question.clauses)).toBe(false)
    }
  })

  it.each(DIFFICULTIES)('a variable that is not there changes nothing on %s', (difficulty) => {
    // Skipped rather than refused, because eliminating one variable routinely
    // takes another with it — so asking for one already gone is a no-op.
    for (const question of sample(difficulty, 60)) {
      expect(showClauseSet(runElimination(question.clauses, ['zz']))).toBe(
        showClauseSet(question.clauses),
      )
      expect(dpGame.check(question, ['zz']).correct).toBe(false)
    }
  })

  it.each(DIFFICULTIES)('always has a tautology to drop somewhere on %s', (difficulty) => {
    // The rule being tested is "throw away the tautologies", so a question
    // where none ever appears never exercises it.
    for (const question of sample(difficulty, 100)) {
      expect(
        question.variables.some(
          (variable) => eliminateVariable(question.clauses, variable).discarded.length > 0,
        ),
        showClauseSet(question.clauses),
      ).toBe(true)
    }
  })

  it('accepts any elimination order', () => {
    // DP has no required order, so the game must not invent one.
    const rng = makeRng('dp-order')
    for (const question of sample('medium', 60)) {
      expect(dpGame.check(question, rng.shuffle(question.variables)).correct).toBe(true)
    }
  })
})

describe('DPLL game', () => {
  const sample = (d: Difficulty, n: number) => draw<DpllQuestion>(dpllGame, 'dpllGame', d, n)

  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 80)) {
      expect(dpllGame.check(question, dpllGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the answer is the leaf count on %s', (difficulty) => {
    for (const question of sample(difficulty, 80)) {
      expect(dpllGame.solve(question)).toBe(countLeaves(dpll(question.clauses)))
    }
  })

  it.each(DIFFICULTIES)('always involves propagation somewhere on %s', (difficulty) => {
    // Without it the count is just 2ⁿ and needs no understanding of BCP.
    for (const question of sample(difficulty, 80)) {
      expect(
        leaves(dpll(question.clauses)).some((leaf) => leaf.propagated.length > 0),
        showClauseSet(question.clauses),
      ).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('only ever poses an unsatisfiable set on %s', (difficulty) => {
    // Algorithm 2.42 returns as soon as a branch succeeds, so on a satisfiable
    // formula a real run stops early and the leaf count is not well defined.
    for (const question of sample(difficulty, 80)) {
      expect(isSatisfiable(clauseSetToFormula(question.clauses)), showClauseSet(question.clauses)).toBe(false)
      expect(isUnsatisfiableTree(dpll(question.clauses))).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('keeps the answer inside the keypad on %s', (difficulty) => {
    for (const question of sample(difficulty, 80)) {
      const answer = dpllGame.solve(question) as number
      expect(answer).toBeGreaterThanOrEqual(1)
      expect(answer).toBeLessThanOrEqual(8)
    }
  })
})

describe('conflict clause game', () => {
  const sample = (d: Difficulty, n: number) =>
    draw<ConflictQuestion>(conflictClauseGame, 'conflictClauseGame', d, n)

  it.each(DIFFICULTIES)('marks the reference reading correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(conflictClauseGame.check(question, conflictClauseGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('every named clause really is false at its leaf on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      const found = leaves(dpll(question.clauses))
      question.answers.forEach((index, leafIndex) => {
        const leaf = found[leafIndex]
        const assigned = new Map((leaf?.path ?? []).map((literal) => [literal.name, !literal.negated]))
        for (const literal of question.clauses[index] as Clause) {
          expect(assigned.get(literal.name), showClauseSet(question.clauses)).toBe(literal.negated)
        }
      })
    }
  })

  it.each(DIFFICULTIES)('asks about every leaf, and each has one answer on %s', (difficulty) => {
    // Two falsified clauses at a leaf would make two readings right and the
    // question unmarkable.
    for (const question of sample(difficulty, 60)) {
      const found = leaves(dpll(question.clauses))
      expect(question.answers).toHaveLength(found.length)
      for (const leaf of found) {
        const assigned = new Map(leaf.path.map((literal) => [literal.name, !literal.negated]))
        const falsified = question.clauses.filter((clause) =>
          clause.every((literal) => assigned.get(literal.name) === literal.negated),
        )
        expect(falsified, showClauseSet(question.clauses)).toHaveLength(1)
      }
    }
  })

  it.each(DIFFICULTIES)('every question folds into a real refutation on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      const mirror = treeToRefutation(dpll(question.clauses))
      expect(mirror, showClauseSet(question.clauses)).not.toBeNull()
      expect(clauseKey((mirror as { clause: Clause }).clause)).toBe('')
    }
  })

  it('gives partial credit for reading most leaves right', () => {
    for (const question of sample('medium', 40)) {
      if (question.answers.length < 3) continue
      const answer = [...conflictClauseGame.solve(question)]
      answer[0] = answer[0] === 0 ? 1 : 0
      const verdict = conflictClauseGame.check(question, answer)
      expect(verdict.correct).toBe(false)
      expect(verdict.score ?? 0).toBeGreaterThan(0)
      expect(verdict.score ?? 1).toBeLessThan(1)
    }
  })

  it('rejects leaving a leaf unread', () => {
    for (const question of sample('medium', 40)) {
      const answer = [...conflictClauseGame.solve(question)]
      answer[0] = null
      expect(conflictClauseGame.check(question, answer).correct).toBe(false)
    }
  })
})

describe('learned clause game', () => {
  const sample = (d: Difficulty, n: number) =>
    draw<LearnedQuestion>(learnedClauseGame, 'learnedClauseGame', d, n)

  it.each(DIFFICULTIES)('marks the reference clause correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(learnedClauseGame.check(question, learnedClauseGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the reference clause is the negation of the decisions on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(clauseKey(learnedClauseGame.solve(question))).toBe(
        clauseKey(learnFromDecisions(question.decisions).clause),
      )
    }
  })

  it.each(DIFFICULTIES)('always shows both a decision and a propagation on %s', (difficulty) => {
    // Telling the two apart is the whole question.
    for (const question of sample(difficulty, 60)) {
      expect(question.decisions.length).toBeGreaterThan(0)
      expect(question.propagated.length).toBeGreaterThan(0)
    }
  })

  it('accepts the literals in any order', () => {
    const rng = makeRng('learn-order')
    for (const question of sample('medium', 60)) {
      const shuffled = rng.shuffle(learnedClauseGame.solve(question))
      expect(learnedClauseGame.check(question, shuffled).correct).toBe(true)
    }
  })

  it('names the propagation mistake specifically', () => {
    // Adding a propagated literal gives a longer, weaker clause — a different
    // error from not negating, and worth saying which.
    for (const question of sample('medium', 60)) {
      const propagated = question.propagated[0]
      if (propagated === undefined) continue
      const weaker = normaliseClause([
        ...learnedClauseGame.solve(question),
        { name: propagated.name, negated: !propagated.negated },
      ])
      const verdict = learnedClauseGame.check(question, weaker)
      expect(verdict.correct).toBe(false)
      expect(verdict.message).toBe('That includes something BCP derived')
    }
  })

  it('names the un-negated mistake specifically', () => {
    for (const question of sample('medium', 60)) {
      const verdict = learnedClauseGame.check(question, normaliseClause(question.decisions))
      expect(verdict.correct).toBe(false)
      expect(verdict.message).toBe('That is the combination you tried, not the one to forbid')
    }
  })

  it('never reveals the clause in the retry message', () => {
    const messages = new Set<string>()
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(difficulty, 40)) {
        messages.add(learnedClauseGame.check(question, normaliseClause(question.decisions)).message)
        messages.add(learnedClauseGame.check(question, []).message)
      }
    }
    for (const message of messages) {
      expect(message).not.toMatch(/[{}∨¬]/)
    }
  })
})
