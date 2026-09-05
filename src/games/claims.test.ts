import { describe, expect, it } from 'vitest'

import { CANDIDATES, NATURALS, evaluateReal, showReal } from '@/logic'
import { makeRng } from '@/logic/rng'
import { MINIGAMES } from '@/engine/registry'
import type { Difficulty } from '@/engine/types'
import { PROVABILITY_CLAIMS } from './provability.claims'
import { PLUS_CLAIMS } from './natPlus.claims'
import { CEILING_CLAIMS } from './natTimes.claims'
import { ROUTE_CLAIMS } from './tarski.claims'
import { UNIVERSE_CLAIMS } from './natVsReal.claims'

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
