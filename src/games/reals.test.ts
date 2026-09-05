import { describe, expect, it } from 'vitest'

import { evaluateReal, showReal } from '@/logic'
import { makeRng } from '@/logic/rng'
import type { Difficulty } from '@/engine/types'
import {
  GRID,
  MIN_DISTANCE,
  REGIONS,
  cellCentre,
  pickThePictureGame,
  regionOf,
  sameShading,
  shading,
  shadingDistance,
} from './pickThePicture'
import {
  CHALLENGES,
  beatTheChallengerGame,
  boundBefore,
  challengeOf,
  formulaOf,
  movesAvailable,
  myMoves,
  play,
  winningMoves,
  winsEverywhere,
} from './beatTheChallenger'

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

describe('Pick The Picture', () => {
  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (let seed = 0; seed < 30; seed++) {
      const question = draw(pickThePictureGame, difficulty, seed)
      expect(pickThePictureGame.check(question, pickThePictureGame.solve(question)).correct).toBe(
        true,
      )
    }
  })

  it('no two regions in the catalogue look the same', () => {
    for (let i = 0; i < REGIONS.length; i++) {
      for (let j = i + 1; j < REGIONS.length; j++) {
        expect(
          sameShading((REGIONS[i] as (typeof REGIONS)[number]).formula, (REGIONS[j] as (typeof REGIONS)[number]).formula),
          `${REGIONS[i]?.id} and ${REGIONS[j]?.id}`,
        ).toBe(false)
      }
    }
  })

  it('never puts two indistinguishable pictures on the same board', () => {
    // Not merely "not identical": two regions differing only inside a small
    // lens are the same picture once shrunk to a thumbnail, and then the
    // question is a coin flip.
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 30; seed++) {
        const question = draw(pickThePictureGame, difficulty, seed)
        expect(question.options).toContain(question.formula)
        for (let i = 0; i < question.options.length; i++) {
          for (let j = i + 1; j < question.options.length; j++) {
            const apart = shadingDistance(
              regionOf(question.options[i] as string).formula,
              regionOf(question.options[j] as string).formula,
            )
            expect(apart, `${question.options[i]} vs ${question.options[j]}`).toBeGreaterThanOrEqual(
              MIN_DISTANCE,
            )
          }
        }
      }
    }
  })

  it('shades a point exactly when the formula holds there', () => {
    const region = regionOf('x2-le-y').formula
    const cells = shading(region)
    for (let row = 0; row < GRID; row += 7) {
      for (let column = 0; column < GRID; column += 7) {
        const point = { x: cellCentre(column), y: -cellCentre(row) }
        expect(cells[row * GRID + column]).toBe(evaluateReal(region, point))
      }
    }
  })

  it('an implication really does shade more than its conjunction', () => {
    // The trap of Exercise 12: the premise failing is enough to be in the set.
    const implication = shading(regionOf('implication').formula).filter(Boolean).length
    const conjunction = shading(regionOf('conjunction').formula).filter(Boolean).length
    expect(implication).toBeGreaterThan(conjunction * 4)
  })

  it('refuses a wrong picture and hands back a separating point', () => {
    for (let seed = 0; seed < 20; seed++) {
      const question = draw(pickThePictureGame, 'hard', seed)
      const wanted = pickThePictureGame.solve(question)
      const wrong = (wanted + 1) % question.options.length
      const verdict = pickThePictureGame.check(question, wrong)
      expect(verdict.correct).toBe(false)
      expect(verdict.detail).toMatch(/Probe/)
      expect(verdict.message).not.toMatch(/\d/)
    }
  })
})

describe('Beat The Challenger', () => {
  it.each(DIFFICULTIES)('marks the reference answer correct on %s', (difficulty) => {
    for (let seed = 0; seed < 30; seed++) {
      const question = draw(beatTheChallengerGame, difficulty, seed)
      expect(
        beatTheChallengerGame.check(question, beatTheChallengerGame.solve(question)).correct,
        question.id,
      ).toBe(true)
    }
  })

  it.each(CHALLENGES.map((challenge) => [challenge.id, challenge] as const))(
    'the search reproduces the real truth of %s',
    (_id, challenge) => {
      // A finite set of terms and replies is not a decision procedure for ℝ.
      // Every formula in the pool has to be one where the game's verdict and
      // the mathematics agree, and this is what enforces that.
      const question = { id: challenge.id }
      const winnable = winsEverywhere(question, winningMoves(question))
      expect(winnable, showReal(challenge.formula)).toBe(challenge.truth)
    },
  )

  it('a true formula has a line the challenger cannot beat', () => {
    for (const challenge of CHALLENGES) {
      if (!challenge.truth) continue
      const question = { id: challenge.id }
      expect(play(question, winningMoves(question)).won, challenge.id).toBe(true)
    }
  })

  it('a false formula loses on every line', () => {
    // Every choice of terms, against every reply — this is what makes "false"
    // the right answer rather than "I did not find a move".
    for (const challenge of CHALLENGES) {
      if (challenge.truth) continue
      const question = { id: challenge.id }
      const needed = myMoves(question)
      const lines = (moves: string[]): boolean => {
        if (moves.length === needed) return winsEverywhere(question, moves)
        return movesAvailable(boundBefore(question, moves.length)).some((move) =>
          lines([...moves, move.label]),
        )
      }
      expect(lines([]), challenge.id).toBe(false)
    }
  })

  it('the challenger really answers a losing play', () => {
    for (const challenge of CHALLENGES) {
      if (challenge.truth) continue
      const question = { id: challenge.id }
      const moves = Array.from({ length: myMoves(question) }, () => '1')
      const verdict = beatTheChallengerGame.check(question, { claim: 'true', moves })
      expect(verdict.correct).toBe(false)
    }
  })

  it('refuses "false" for a true formula without naming the winning value', () => {
    for (const challenge of CHALLENGES) {
      if (!challenge.truth) continue
      const question = { id: challenge.id }
      const verdict = beatTheChallengerGame.check(question, { claim: 'false', moves: [] })
      expect(verdict.correct).toBe(false)
      for (const value of winningMoves(question)) {
        expect(verdict.message).not.toContain(String(value))
      }
    }
  })

  it('every ∃ in the prefix is a move for the player', () => {
    for (const challenge of CHALLENGES) {
      const question = { id: challenge.id }
      const outcome = play(question, winningMoves(question))
      expect(outcome.history.filter((step) => step.mine)).toHaveLength(myMoves(question))
      expect(formulaOf(question)).toBe(challengeOf(question).formula)
    }
  })

  it('deals both true and false formulas at every difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      const seen = new Set<boolean>()
      for (let seed = 0; seed < 40; seed++) {
        seen.add(challengeOf(draw(beatTheChallengerGame, difficulty, seed)).truth)
      }
      expect(seen, difficulty).toEqual(new Set([true, false]))
    }
  })
})
