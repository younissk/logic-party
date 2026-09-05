import { describe, expect, it } from 'vitest'

import {
  bcp,
  clauseKey,
  clauseSetToFormula,
  colouringClauses,
  entails,
  evaluate,
  hasRupProperty,
  isBlockedOn,
  isColourable,
  isProperColouring,
  isSatisfiable,
  isTautologicalClause,
  makeRng,
  resolveOn,
  showClause,
  type Clause,
  type Literal,
} from '@/logic'
import { DIFFICULTIES, type Difficulty } from '@/engine/types'
import { colouringGame, type ColouringQuestion } from './colouring'
import { modelSortGame, regionOf, type ModelSortQuestion } from './modelSort'
import { oneStepGame, type OneStepQuestion } from './oneStep'
import { blockedLiteralGame, type BlockedLiteralQuestion } from './blockedLiteral'
import { rupBuilderGame, type RupBuilderQuestion } from './rupBuilder'
import { entailmentRefutationGame, type EntailmentQuestion } from './entailmentRefutation'

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
    game.generate({ rng: makeRng(`n-${i}`), difficulty, questionIndex: i } as never),
  )
  cache.set(id, made)
  return made
}

// ---------------------------------------------------------------------------

describe('Colour It', () => {
  const sample = (d: Difficulty, n: number) => draw<ColouringQuestion>(colouringGame, 'col', d, n)

  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(colouringGame.check(question, colouringGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the reference colouring really is proper on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      const answer = colouringGame.solve(question)
      if (answer.kind === 'impossible') {
        expect(isColourable(question.graph, question.colours)).toBe(false)
        continue
      }
      expect(isProperColouring(question.graph, new Map(Object.entries(answer.assignment)))).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the CNF is satisfiable exactly when the graph is colourable on %s', (difficulty) => {
    // The whole point of the exercise; if these disagree the puzzle is a lie.
    // Only checked on the encodings small enough for a truth table — six
    // vertices and three colours is already eighteen variables. The general
    // claim is tested exhaustively in the encoder's own suite.
    for (const question of sample(difficulty, 40)) {
      const variables = question.graph.vertices.length * question.colours
      if (variables > 14) continue
      expect(isSatisfiable(clauseSetToFormula(colouringClauses(question.graph, question.colours).all))).toBe(
        question.colourable,
      )
    }
  })

  it.each(DIFFICULTIES)('the graph is connected on %s', (difficulty) => {
    // Two disconnected pieces is two easier puzzles, not one.
    for (const question of sample(difficulty, 40)) {
      const seen = new Set([question.graph.vertices[0] as string])
      for (let pass = 0; pass < question.graph.vertices.length; pass++) {
        for (const [left, right] of question.graph.edges) {
          if (seen.has(left)) seen.add(right)
          if (seen.has(right)) seen.add(left)
        }
      }
      expect(seen.size).toBe(question.graph.vertices.length)
    }
  })

  it.each(DIFFICULTIES)('offers both answers on %s', (difficulty) => {
    // "Impossible" has to be right sometimes or it is a button that never
    // wins, which is worse than no button at all.
    const solvable = sample(difficulty, 120).filter((question) => question.colourable).length
    expect(solvable, `solvable on ${difficulty}`).toBeGreaterThan(60)
    expect(solvable, `solvable on ${difficulty}`).toBeLessThan(115)
  })

  it.each(DIFFICULTIES)('an impossible graph really cannot be coloured on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      expect(isColourable(question.graph, question.colours)).toBe(question.colourable)
    }
  })

  it('rejects a colouring that leaves an edge clashing', () => {
    for (const question of sample('medium', 30)) {
      if (!question.colourable) continue
      const flat = Object.fromEntries(question.graph.vertices.map((vertex) => [vertex, 0]))
      if (question.graph.edges.length === 0) continue
      expect(colouringGame.check(question, { kind: 'colouring', assignment: flat }).correct).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------

describe('Venn Sort', () => {
  const sample = (d: Difficulty, n: number) => draw<ModelSortQuestion>(modelSortGame, 'sort', d, n)

  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 80)) {
      expect(modelSortGame.check(question, modelSortGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('every region assignment matches the two evaluations on %s', (difficulty) => {
    for (const question of sample(difficulty, 60)) {
      for (const row of question.rows) {
        const left = evaluate(question.left, row)
        const right = evaluate(question.right, row)
        const expected = left && right ? 'both' : left ? 'left' : right ? 'right' : 'neither'
        expect(regionOf(question, row)).toBe(expected)
      }
    }
  })

  it.each(DIFFICULTIES)('uses at least two regions on %s', (difficulty) => {
    // A board where everything lands in one region teaches nothing.
    for (const question of sample(difficulty, 60)) {
      const used = new Set(question.rows.map((row) => regionOf(question, row)))
      expect(used.size).toBeGreaterThan(1)
    }
  })

  it('an empty "only φ" region really is entailment', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(difficulty, 60)) {
        const onlyLeft = question.rows.filter((row) => regionOf(question, row) === 'left')
        expect(onlyLeft.length === 0).toBe(entails([question.left], question.right))
      }
    }
  })

  it('rejects a single misplaced token', () => {
    for (const question of sample('medium', 40)) {
      const answer = modelSortGame.solve(question)
      const broken = [...answer]
      broken[0] = broken[0] === 'both' ? 'left' : 'both'
      expect(modelSortGame.check(question, broken).correct).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------

describe('One Move', () => {
  const sample = (d: Difficulty, n: number) => draw<OneStepQuestion>(oneStepGame, 'one', d, n)

  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 80)) {
      expect(oneStepGame.check(question, oneStepGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the named pair really produces the target on %s', (difficulty) => {
    for (const question of sample(difficulty, 80)) {
      if (question.pair === null) continue
      const [left, right] = question.pair
      const resolvent = resolveOn(
        question.clauses[left] as Clause,
        question.clauses[right] as Clause,
        question.pivot as string,
      )
      expect(resolvent).not.toBeNull()
      expect(clauseKey(resolvent as Clause)).toBe(clauseKey(question.target))
    }
  })

  it.each(DIFFICULTIES)('when it says no pair works, no pair works on %s', (difficulty) => {
    for (const question of sample(difficulty, 80)) {
      if (question.pair !== null) continue
      for (let i = 0; i < question.clauses.length; i++) {
        for (let j = i + 1; j < question.clauses.length; j++) {
          const left = question.clauses[i] as Clause
          const right = question.clauses[j] as Clause
          for (const literal of left) {
            const resolvent = resolveOn(left, right, literal.name)
            if (resolvent === null) continue
            expect(clauseKey(resolvent), showClause(question.target)).not.toBe(
              clauseKey(question.target),
            )
          }
        }
      }
    }
  })

  it('asks unreachable targets often enough to matter', () => {
    const none = sample('medium', 120).filter((question) => question.pair === null).length
    expect(none).toBeGreaterThan(15)
    expect(none).toBeLessThan(90)
  })
})

// ---------------------------------------------------------------------------

describe('Under the Microscope', () => {
  const sample = (d: Difficulty, n: number) =>
    draw<BlockedLiteralQuestion>(blockedLiteralGame, 'blk', d, n)

  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 80)) {
      expect(blockedLiteralGame.check(question, blockedLiteralGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('the named literal really blocks it on %s', (difficulty) => {
    for (const question of sample(difficulty, 80)) {
      const clause = question.clauses[question.target] as Clause
      if (question.answer === null) {
        for (const literal of clause) {
          expect(isBlockedOn(question.clauses, clause, literal), showClause(clause)).toBe(false)
        }
        continue
      }
      expect(isBlockedOn(question.clauses, clause, clause[question.answer] as Literal)).toBe(true)
    }
  })

  it('asks non-vacuous cases often enough', () => {
    // If every answer were a pure literal the game would only teach the
    // shortcut, never the definition.
    let nonVacuous = 0
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(difficulty, 80)) {
        if (question.answer === null) continue
        const clause = question.clauses[question.target] as Clause
        const literal = clause[question.answer] as Literal
        const opposite = { name: literal.name, negated: !literal.negated }
        const appears = question.clauses.some(
          (other) =>
            clauseKey(other) !== clauseKey(clause) &&
            other.some((entry) => entry.name === opposite.name && entry.negated === opposite.negated),
        )
        if (appears) nonVacuous++
      }
    }
    expect(nonVacuous).toBeGreaterThan(20)
  })

  it('rejects a literal that does not block', () => {
    for (const question of sample('medium', 60)) {
      const clause = question.clauses[question.target] as Clause
      const wrong = clause.findIndex(
        (literal) => !isBlockedOn(question.clauses, clause, literal),
      )
      if (wrong < 0) continue
      expect(blockedLiteralGame.check(question, wrong).correct).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------

describe('Write the Proof', () => {
  const sample = (d: Difficulty, n: number) => draw<RupBuilderQuestion>(rupBuilderGame, 'rupb', d, n)

  it.each(DIFFICULTIES)('marks the reference proof correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 40)) {
      expect(rupBuilderGame.check(question, rupBuilderGame.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('every question needs at least one line before ⊥ on %s', (difficulty) => {
    // A one-line proof means BCP already crashes and there is nothing to build.
    for (const question of sample(difficulty, 40)) {
      expect(bcp(question.clauses).outcome).not.toBe('unsatisfiable')
      expect(question.par).toBeGreaterThanOrEqual(2)
    }
  })

  it.each(DIFFICULTIES)('only poses unsatisfiable sets on %s', (difficulty) => {
    for (const question of sample(difficulty, 40)) {
      expect(isSatisfiable(clauseSetToFormula(question.clauses))).toBe(false)
    }
  })

  it('rejects a line propagation does not refute', () => {
    for (const question of sample('medium', 30)) {
      const bogus = question.palette
        .map((literal) => [literal] as Clause)
        .find((line) => !hasRupProperty(question.clauses, line))
      if (bogus === undefined) continue
      expect(rupBuilderGame.check(question, [bogus, []]).correct).toBe(false)
    }
  })

  it('rejects a proof that does not end in ⊥', () => {
    for (const question of sample('medium', 30)) {
      const proof = rupBuilderGame.solve(question) as Clause[]
      expect(rupBuilderGame.check(question, proof.slice(0, -1)).correct).toBe(false)
    }
  })

  it('offers both polarities of every variable', () => {
    for (const question of sample('hard', 30)) {
      const names = new Set(question.palette.map((literal) => literal.name))
      for (const name of names) {
        expect(question.palette.filter((literal) => literal.name === name)).toHaveLength(2)
      }
    }
  })
})

// ---------------------------------------------------------------------------

describe('Prove It Wrong', () => {
  const sample = (d: Difficulty, n: number) =>
    draw<EntailmentQuestion>(entailmentRefutationGame, 'ent', d, n)

  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (const question of sample(difficulty, 40)) {
      expect(
        entailmentRefutationGame.check(question, entailmentRefutationGame.solve(question)).correct,
      ).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('only poses entailments that actually hold on %s', (difficulty) => {
    for (const question of sample(difficulty, 40)) {
      expect(entails(question.premises, question.conclusion)).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('premises plus the negated conclusion are unsatisfiable on %s', (difficulty) => {
    // That is the whole method; if it did not hold the board would be unwinnable.
    for (const question of sample(difficulty, 40)) {
      const whole = [...question.premiseClauses, ...question.negated]
      expect(isSatisfiable(clauseSetToFormula(whole))).toBe(false)
    }
  })

  it.each(DIFFICULTIES)('the negated conclusion is units on %s', (difficulty) => {
    // Negating a clause of n literals gives n units — the thing the setup
    // phase exists to drill.
    for (const question of sample(difficulty, 40)) {
      for (const clause of question.negated) {
        expect(clause).toHaveLength(1)
        expect(isTautologicalClause(clause)).toBe(false)
      }
    }
  })

  it('rejects a starting set that keeps the conclusion un-negated', () => {
    for (const question of sample('medium', 30)) {
      const answer = entailmentRefutationGame.solve(question)
      const wrong = { ...answer, setup: question.premiseClauses }
      expect(entailmentRefutationGame.check(question, wrong).correct).toBe(false)
    }
  })
})
