import { describe, expect, it } from 'vitest'

import {
  CANDIDATES,
  NATURALS,
  evaluateReal,
  isBlockedOn,
  pureLiterals,
  showClause,
  showReal,
} from '@/logic'
import { makeRng } from '@/logic/rng'
import { MINIGAMES } from '@/engine/registry'
import type { Difficulty } from '@/engine/types'
import { PROVABILITY_CLAIMS } from './provability.claims'
import { PLUS_CLAIMS } from './natPlus.claims'
import { CEILING_CLAIMS } from './natTimes.claims'
import { ROUTE_CLAIMS } from './tarski.claims'
import { UNIVERSE_CLAIMS } from './natVsReal.claims'
import { THEORY_ROWS, propertyGridGame, rowOf } from './propertyGrid'
import { ENTRIES, entryOf, nameTheLogicianGame } from './nameTheLogician'
import {
  clausesContaining,
  literalKey,
  literalsOf,
  pureMeansBlockedGame,
} from './pureMeansBlocked'

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

const SORTS = [
  ['provability', PROVABILITY_CLAIMS],
  ['nat-plus', PLUS_CLAIMS],
  ['nat-times', CEILING_CLAIMS],
  ['tarski', ROUTE_CLAIMS],
  ['nat-vs-real', UNIVERSE_CLAIMS],
] as const

describe.each(SORTS)('%s', (id, claims) => {
  const game = MINIGAMES.find((entry) => entry.id === id)

  it('is registered', () => {
    expect(game).toBeDefined()
  })

  it('has unique claim ids', () => {
    expect(new Set(claims.map((claim) => claim.id)).size).toBe(claims.length)
  })

  it('gives every claim a reason and a difficulty', () => {
    for (const claim of claims) {
      expect(claim.why.length, claim.id).toBeGreaterThan(20)
      expect(claim.difficulty.length, claim.id).toBeGreaterThan(0)
    }
  })

  it('has claims for every bin', () => {
    // A bin nothing ever lands in is a bin that gives the game away.
    const bins = new Set(claims.map((claim) => claim.bin))
    expect(bins.size).toBeGreaterThan(1)
  })

  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (let seed = 0; seed < 30; seed++) {
      const question = game!.generate({
        rng: makeRng(`s${seed}`),
        difficulty,
        questionIndex: 0,
      })
      expect(game!.check(question, game!.solve(question)).correct).toBe(true)
    }
  })

  it.each(DIFFICULTIES)('never deals a board that is all one bin on %s', (difficulty) => {
    for (let seed = 0; seed < 30; seed++) {
      const question = game!.generate({
        rng: makeRng(`s${seed}`),
        difficulty,
        questionIndex: 0,
      })
      const answer = game!.solve(question) as string[]
      expect(new Set(answer).size).toBeGreaterThan(1)
    }
  })

  it.each(DIFFICULTIES)('refuses a misplaced claim without naming it on %s', (difficulty) => {
    for (let seed = 0; seed < 10; seed++) {
      const question = game!.generate({
        rng: makeRng(`s${seed}`),
        difficulty,
        questionIndex: 0,
      })
      const answer = [...(game!.solve(question) as (string | null)[])]
      answer[0] = null
      const verdict = game!.check(question, answer)
      expect(verdict.correct).toBe(false)
      expect(verdict.score).toBeGreaterThan(0)
      for (const claim of claims) {
        if (!(question as { claims: string[] }).claims.includes(claim.id)) continue
        expect(verdict.message).not.toContain(claim.text)
      }
    }
  })
})

describe('Which Universe, where a search can check it', () => {
  const checkable = UNIVERSE_CLAIMS.filter(
    (claim) => claim.checkable && claim.formula !== undefined,
  )

  it('has some claims a search can settle', () => {
    expect(checkable.length).toBeGreaterThan(4)
  })

  it.each(checkable.map((claim) => [claim.id, claim] as const))(
    '%s falls in the bin the search finds',
    (_id, claim) => {
      // The bin is written by hand; this evaluates the formula over both
      // universes and insists the two agree. A claim whose verdict a bounded
      // search cannot see carries checkable: false and is excluded.
      const inNat = evaluateReal(claim.formula!, {}, NATURALS)
      const inReal = evaluateReal(claim.formula!, {}, CANDIDATES)
      const bin = inNat ? (inReal ? 'both' : 'nat') : inReal ? 'real' : 'neither'
      expect(bin, showReal(claim.formula!)).toBe(claim.bin)
    },
  )

  it('says why for every claim a search cannot settle', () => {
    for (const claim of UNIVERSE_CLAIMS) {
      if (claim.checkable) continue
      // Density, unboundedness and irrational witnesses are the three reasons,
      // and each such claim has to name one rather than being unexplained.
      expect(claim.why, claim.id).toMatch(
        /dens|least|successor|immediate|√|halv|rational|between/i,
      )
    }
  })
})

describe('The Property Grid', () => {
  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (let seed = 0; seed < 30; seed++) {
      const question = propertyGridGame.generate({
        rng: makeRng(`s${seed}`),
        difficulty,
        questionIndex: 0,
      })
      expect(propertyGridGame.check(question, propertyGridGame.solve(question)).correct).toBe(true)
    }
  })

  it('always deals a row where the two columns disagree', () => {
    // Otherwise ticking one column twice is a winning strategy.
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 30; seed++) {
        const question = propertyGridGame.generate({
          rng: makeRng(`s${seed}`),
          difficulty,
          questionIndex: 0,
        })
        expect(question.rows.some((id) => rowOf(id).qe !== rowOf(id).decidable)).toBe(true)
      }
    }
  })

  it('never claims a theory admits QE without being decidable', () => {
    // Every quantifier-free fragment in this chapter can be evaluated, so QE
    // implies decidability throughout. A row breaking that would be an error
    // in the data rather than a subtlety.
    for (const row of THEORY_ROWS) {
      if (row.qe) expect(row.decidable, row.name).toBe(true)
    }
  })

  it('agrees with how the sorting game routes the same theories', () => {
    const byRoute = new Map(ROUTE_CLAIMS.map((claim) => [claim.text, claim.bin]))
    for (const row of THEORY_ROWS) {
      const route = byRoute.get(row.name)
      if (route === undefined) continue
      expect(route === 'qe', row.name).toBe(row.qe)
      expect(route !== 'undecidable', row.name).toBe(row.decidable)
    }
  })

  it('refuses a wrong cell without naming it', () => {
    const question = propertyGridGame.generate({
      rng: makeRng('grid'),
      difficulty: 'medium',
      questionIndex: 0,
    })
    const answer = propertyGridGame.solve(question).map((row) => [...row])
    answer[0]![0] = !answer[0]![0]
    const verdict = propertyGridGame.check(question, answer)
    expect(verdict.correct).toBe(false)
    expect(verdict.score).toBeGreaterThan(0)
    for (const id of question.rows) expect(verdict.message).not.toContain(rowOf(id).name)
  })
})

describe('Name The Logician', () => {
  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (let seed = 0; seed < 30; seed++) {
      const question = nameTheLogicianGame.generate({
        rng: makeRng(`s${seed}`),
        difficulty,
        questionIndex: 0,
      })
      expect(nameTheLogicianGame.check(question, nameTheLogicianGame.solve(question)).correct).toBe(
        true,
      )
    }
  })

  it('never puts two entries with the same surname on one board', () => {
    // Both Gödel theorems exist in the pool, and a board with both would have
    // two identically labelled names.
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 30; seed++) {
        const question = nameTheLogicianGame.generate({
          rng: makeRng(`s${seed}`),
          difficulty,
          questionIndex: 0,
        })
        const surnames = question.results.map((id) => entryOf(id).name.replace(', again', ''))
        expect(new Set(surnames).size).toBe(surnames.length)
      }
    }
  })

  it('shows the same entries on both sides', () => {
    for (let seed = 0; seed < 20; seed++) {
      const question = nameTheLogicianGame.generate({
        rng: makeRng(`s${seed}`),
        difficulty: 'hard',
        questionIndex: 0,
      })
      expect([...question.names].sort()).toEqual([...question.results].sort())
    }
  })

  it('gives every entry a place in the course', () => {
    for (const entry of ENTRIES) {
      expect(entry.where.length, entry.id).toBeGreaterThan(20)
    }
  })
})

describe('Pure Means Blocked', () => {
  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (let seed = 0; seed < 40; seed++) {
      const question = pureMeansBlockedGame.generate({
        rng: makeRng(`s${seed}`),
        difficulty,
        questionIndex: 0,
      })
      expect(pureMeansBlockedGame.check(question, pureMeansBlockedGame.solve(question)).correct).toBe(
        true,
      )
    }
  })

  it('proves the bonus: a clause with a pure literal really is blocked', () => {
    // Checked with isBlockedOn, which runs the general definition and computes
    // resolvents — so this confirms the shortcut rather than assuming it.
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 40; seed++) {
        const question = pureMeansBlockedGame.generate({
          rng: makeRng(`s${seed}`),
          difficulty,
          questionIndex: 0,
        })
        for (const literal of pureLiterals(question.clauses)) {
          for (const index of clausesContaining(question, literal)) {
            expect(
              isBlockedOn(question.clauses, question.clauses[index]!, literal),
              `${showClause(question.clauses[index]!)} on ${literalKey(literal)}`,
            ).toBe(true)
          }
        }
      }
    }
  })

  it('deals formulas with and without a pure literal', () => {
    const seen = new Set<boolean>()
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 40; seed++) {
        const question = pureMeansBlockedGame.generate({
          rng: makeRng(`s${seed}`),
          difficulty,
          questionIndex: 0,
        })
        seen.add(pureLiterals(question.clauses).length === 0)
      }
    }
    expect(seen).toEqual(new Set([true, false]))
  })

  it('accepts any pure literal, not only the first', () => {
    for (let seed = 0; seed < 40; seed++) {
      const question = pureMeansBlockedGame.generate({
        rng: makeRng(`s${seed}`),
        difficulty: 'hard',
        questionIndex: 0,
      })
      for (const literal of pureLiterals(question.clauses)) {
        expect(
          pureMeansBlockedGame.check(question, {
            literal,
            clauses: clausesContaining(question, literal),
          }).correct,
        ).toBe(true)
      }
    }
  })

  it('refuses a literal that is not pure, and a wrong clause set', () => {
    for (let seed = 0; seed < 40; seed++) {
      const question = pureMeansBlockedGame.generate({
        rng: makeRng(`s${seed}`),
        difficulty: 'medium',
        questionIndex: 0,
      })
      const pure = pureLiterals(question.clauses)
      const impure = literalsOf(question).find(
        (literal) => !pure.some((other) => literalKey(other) === literalKey(literal)),
      )
      if (impure !== undefined) {
        expect(pureMeansBlockedGame.check(question, { literal: impure, clauses: [] }).correct).toBe(
          false,
        )
      }
      const literal = pure[0]
      if (literal === undefined) continue
      const verdict = pureMeansBlockedGame.check(question, { literal, clauses: [] })
      expect(verdict.correct).toBe(false)
      // Word boundaries: variables are single letters, and "clauses" has one.
      expect(verdict.message).not.toMatch(new RegExp(`\\b${literal.name}\\b`))
    }
  })

  it('refuses "no pure literal" when there is one', () => {
    for (let seed = 0; seed < 40; seed++) {
      const question = pureMeansBlockedGame.generate({
        rng: makeRng(`s${seed}`),
        difficulty: 'easy',
        questionIndex: 0,
      })
      if (pureLiterals(question.clauses).length === 0) continue
      const verdict = pureMeansBlockedGame.check(question, { literal: null, clauses: [] })
      expect(verdict.correct).toBe(false)
      for (const literal of pureLiterals(question.clauses)) {
        expect(verdict.message).not.toMatch(new RegExp(`\\b${literal.name}\\b`))
      }
    }
  })
})
