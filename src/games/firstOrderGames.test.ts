/**
 * The first-order minigames, checked the way the others are: the reference
 * answer marks correct, a wrong one does not, the retry message leaks nothing,
 * and a round can never stall.
 */

import { describe, expect, it } from 'vitest'
import { makeRng } from '@/logic'
import { evaluateFormula, isClean, isClosed, parseFormula, showFormula } from '@/logic'
import { DIFFICULTIES, type Difficulty, type GenerateContext } from '@/engine/types'
import { wellFormedGame, wellnessOf } from './wellFormed'
import { boundFreeGame, formulaOf as boundFormulaOf, occurrences } from './boundFree'
import {
  STRUCTURES,
  foEvaluateGame,
  formulaOf as evalFormulaOf,
  prefixOf,
  type StructureSpec,
} from './foEvaluate'
import type { FoFormula, Structure } from '@/logic'
import { isPrenex, pnfOptions, showFormula as show, splitPrenex, toPrenex } from '@/logic'
import { prenexGame, formulaOf as prenexFormulaOf, replayPrenex } from './prenex'
import { existentials, skolemGame, formulaOf as skolemFormulaOf } from './skolem'
import { clausifyGame, drive, isCnf, matrixOf } from './clausify'
import {
  buildableSignature,
  clausesOf as universeClausesOf,
  herbrandUniverseGame,
} from './herbrandUniverse'
import { expansionOf, herbrandExpansionGame } from './herbrandExpansion'
import { baseOf, herbrandModelGame, someModelExists } from './herbrandModel'
import { groundOf, herbrandTheoremGame, isUnsatisfiable, smallestSubset } from './herbrandTheorem'
import { availableInstances, gilmoreGame, isContradictory, smallestRefutation } from './gilmore'
import { findFoRefutation, herbrandLanguage, herbrandUniverse, parseFoClauseSet, showTerm } from '@/logic'

const SEEDS = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6']

function sample<Q>(
  game: { generate: (context: GenerateContext) => Q },
  difficulty: Difficulty,
): Q[] {
  return SEEDS.map((seed, index) =>
    game.generate({ rng: makeRng(`${seed}:${difficulty}`), difficulty, questionIndex: index }),
  )
}

describe('Is That A Formula?', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference sort correct on ${difficulty}`, () => {
      for (const question of sample(wellFormedGame, difficulty)) {
        expect(wellFormedGame.check(question, wellFormedGame.solve(question)).correct).toBe(true)
      }
    })

    it(`fills all three bins on ${difficulty}`, () => {
      for (const question of sample(wellFormedGame, difficulty)) {
        const bins = new Set(question.candidates.map((source) => wellnessOf(question, source)))
        expect(bins).toEqual(new Set(['formula', 'term', 'neither']))
      }
    })
  }

  it('calls a term a term, not a formula', () => {
    const question = {
      predicates: { weekend: 1 },
      functions: { monday: 0, next: 1 },
      variables: ['x'],
      candidates: [],
    }
    expect(wellnessOf(question, 'next(monday())')).toBe('term')
    expect(wellnessOf(question, 'weekend(next(monday()))')).toBe('formula')
  })

  it('refuses a predicate inside a term and a predicate at the wrong arity', () => {
    const question = {
      predicates: { triangle: 1 },
      functions: { rotate: 1 },
      variables: ['x'],
      candidates: [],
    }
    expect(wellnessOf(question, 'triangle(triangle(x))')).toBe('neither')
    expect(wellnessOf(question, 'triangle(x,x)')).toBe('neither')
    expect(wellnessOf(question, 'triangle(rotate(x))')).toBe('formula')
  })

  it('gives partial credit and never names a candidate', () => {
    const question = wellFormedGame.generate({
      rng: makeRng('w1'),
      difficulty: 'medium',
      questionIndex: 0,
    })
    const verdict = wellFormedGame.check(question, question.candidates.map(() => null))
    expect(verdict.correct).toBe(false)
    for (const source of question.candidates) expect(verdict.message).not.toContain(source)
  })
})

describe('Bound Or Free', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference answer correct on ${difficulty}`, () => {
      for (const question of sample(boundFreeGame, difficulty)) {
        expect(boundFreeGame.check(question, boundFreeGame.solve(question)).correct).toBe(true)
      }
    })

    it(`always has an occurrence to judge on ${difficulty}`, () => {
      for (const question of sample(boundFreeGame, difficulty)) {
        expect(occurrences(boundFormulaOf(question)).length).toBeGreaterThanOrEqual(2)
      }
    })

    it(`positions every occurrence where the printed formula has it on ${difficulty}`, () => {
      for (const question of sample(boundFreeGame, difficulty)) {
        const formula = boundFormulaOf(question)
        const printed = showFormula(formula)
        for (const spot of occurrences(formula)) {
          expect([printed, printed.slice(spot.at, spot.at + spot.name.length)]).toEqual([
            printed,
            spot.name,
          ])
        }
      }
    })
  }

  it('skips the variable beside a quantifier', () => {
    const question = { predicates: { p: 1 }, functions: {}, source: '∀x:p(x)' }
    const spots = occurrences(boundFormulaOf(question))
    expect(spots).toHaveLength(1)
    expect(spots[0]?.bound).toBe(true)
  })

  it('sees one letter as bound in one place and free in another', () => {
    const question = { predicates: { p: 1, q: 1 }, functions: {}, source: '(p(x)∨∃x:q(x))' }
    const spots = occurrences(boundFormulaOf(question))
    expect(spots.map((spot) => spot.bound)).toEqual([false, true])
  })

  it('agrees with isClosed and isClean', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(boundFreeGame, difficulty)) {
        const formula = boundFormulaOf(question)
        const reference = boundFreeGame.solve(question)
        expect(reference.closed).toBe(isClosed(formula))
        expect(reference.clean).toBe(isClean(formula))
      }
    }
  })

  it('scores a partly right answer partly', () => {
    const question = boundFreeGame.generate({
      rng: makeRng('bf1'),
      difficulty: 'medium',
      questionIndex: 0,
    })
    const reference = boundFreeGame.solve(question)
    const verdict = boundFreeGame.check(question, { ...reference, closed: !reference.closed })
    expect(verdict.correct).toBe(false)
    expect(verdict.score ?? 0).toBeGreaterThan(0.5)
  })
})

describe('Name The Element', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference play correct on ${difficulty}`, () => {
      for (const question of sample(foEvaluateGame, difficulty)) {
        const verdict = foEvaluateGame.check(question, foEvaluateGame.solve(question))
        expect([question.source, verdict.correct]).toEqual([question.source, true])
      }
    })

    it(`stores a verdict the evaluator agrees with on ${difficulty}`, () => {
      for (const question of sample(foEvaluateGame, difficulty)) {
        const structure = (STRUCTURES[question.spec] as { structure: Structure }).structure
        expect([question.source, question.holds]).toEqual([
          question.source,
          evaluateFormula(structure, {}, evalFormulaOf(question)),
        ])
      }
    })
  }

  it('asks both answers across a round', () => {
    const verdicts = new Set(
      DIFFICULTIES.flatMap((difficulty) =>
        sample(foEvaluateGame, difficulty).map((question) => question.holds),
      ),
    )
    expect(verdicts).toEqual(new Set([true, false]))
  })

  it('refuses a witness that does not witness', () => {
    const question = { spec: 'mod4', source: '∃x:∀y:r(x,y)', holds: false }
    // No x works, so any element chosen as a witness must be refused.
    const verdict = foEvaluateGame.check(question, [0, null])
    expect(verdict.correct).toBe(false)
  })

  it('refuses "none works" when one does', () => {
    const question = { spec: 'mod4', source: '∃x:(p(x)∨∃y:r(x,y))', holds: true }
    const verdict = foEvaluateGame.check(question, [null])
    expect(verdict.correct).toBe(false)
    expect(verdict.detail ?? '').toContain('does make the rest true')
  })

  it('only poses sentences whose prefix can actually be played', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(foEvaluateGame, difficulty)) {
        const layers = prefixOf(evalFormulaOf(question))
        const reference = foEvaluateGame.solve(question)
        if (layers.length === 0) {
          // Quantifier-free: the answer is the single true/false the board asks.
          expect(reference).toHaveLength(1)
          continue
        }
        // Either every layer was answered, or a "none" ended it early.
        expect(
          reference.length === layers.length || reference[reference.length - 1] === null,
        ).toBe(true)
      }
    }
  })

  it('parses every sentence it can pose', () => {
    for (const entry of Object.values(STRUCTURES)) {
      expect(entry.spec.describe.length).toBeGreaterThan(0)
    }
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(foEvaluateGame, difficulty)) {
        const spec = (STRUCTURES[question.spec] as { spec: StructureSpec }).spec
        expect(() => parseFormula(question.source, spec.signature)).not.toThrow()
      }
    }
  })
})

describe('Pull Them Out', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference run correct on ${difficulty}`, () => {
      for (const question of sample(prenexGame, difficulty)) {
        const verdict = prenexGame.check(question, prenexGame.solve(question))
        expect([question.source, verdict.correct]).toEqual([question.source, true])
      }
    })

    it(`hands over a clean formula that is not already prenex on ${difficulty}`, () => {
      for (const question of sample(prenexGame, difficulty)) {
        const formula = prenexFormulaOf(question)
        expect([question.source, isClean(formula)]).toEqual([question.source, true])
        expect([question.source, isPrenex(formula)]).toEqual([question.source, false])
        expect(question.par).toBeGreaterThan(0)
      }
    })

    it(`stores the shortest length on ${difficulty}`, () => {
      for (const question of sample(prenexGame, difficulty)) {
        expect([question.source, question.par]).toEqual([
          question.source,
          toPrenex(prenexFormulaOf(question)).steps.length,
        ])
      }
    })
  }

  it('accepts a different order of choices that still reaches PNF', () => {
    for (const question of sample(prenexGame, 'medium')) {
      const start = prenexFormulaOf(question)
      // Always take the *last* option rather than the first.
      const moves: number[] = []
      let current = start
      for (let guard = 0; guard < 40; guard++) {
        const options = pnfOptions(current)
        if (options.length === 0) break
        const last = options.length - 1
        moves.push(last)
        current = (options[last] as { result: FoFormula }).result
      }
      expect(replayPrenex(start, moves).broken).toBe(false)
      expect([question.source, prenexGame.check(question, moves).correct]).toEqual([
        question.source,
        true,
      ])
    }
  })

  it('refuses stopping early and refuses a move that is not on offer', () => {
    const question = prenexGame.generate({ rng: makeRng('pn1'), difficulty: 'medium', questionIndex: 0 })
    expect(prenexGame.check(question, []).correct).toBe(false)
    expect(prenexGame.check(question, [99]).message).toContain('not available')
  })

  it('never names a rule or the prefix in the retry message', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(prenexGame, difficulty)) {
        const verdict = prenexGame.check(question, [])
        expect(verdict.message).not.toContain('∀')
        expect(verdict.message).not.toContain('∃')
      }
    }
  })
})

describe('Name The Witness', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference lists correct on ${difficulty}`, () => {
      for (const question of sample(skolemGame, difficulty)) {
        const verdict = skolemGame.check(question, skolemGame.solve(question))
        expect([question.source, verdict.correct]).toEqual([question.source, true])
      }
    })

    it(`always poses a prenex formula with at least one ∃ on ${difficulty}`, () => {
      for (const question of sample(skolemGame, difficulty)) {
        const formula = skolemFormulaOf(question)
        expect([question.source, isPrenex(formula)]).toEqual([question.source, true])
        expect(existentials(formula).spots.length).toBeGreaterThan(0)
      }
    })

    it(`asks only for ∀s to the left on ${difficulty}`, () => {
      for (const question of sample(skolemGame, difficulty)) {
        const formula = skolemFormulaOf(question)
        const { prefix, spots } = existentials(formula)
        const names = prefix.map((entry) => entry.variable)
        for (const spot of spots) {
          const at = names.indexOf(spot.variable)
          for (const argument of spot.dependsOn) {
            expect(names.indexOf(argument)).toBeLessThan(at)
            expect(prefix[names.indexOf(argument)]?.quantifier).toBe('forall')
          }
        }
      }
    })
  }

  it('accepts the arguments in any order', () => {
    const question = { predicates: { q: 3 }, functions: {}, source: '∀x:∀y:∃z:q(x,y,z)' }
    expect(skolemGame.check(question, [['y', 'x']]).correct).toBe(true)
    expect(skolemGame.check(question, [['x', 'y']]).correct).toBe(true)
  })

  it('refuses a constant where a function is needed', () => {
    const question = { predicates: { q: 2 }, functions: {}, source: '∀x:∃y:q(x,y)' }
    expect(skolemGame.check(question, [[]]).correct).toBe(false)
  })

  it('refuses a dependency on a variable to the right', () => {
    const question = { predicates: { q: 3 }, functions: {}, source: '∃x:∀y:∀z:q(x,y,z)' }
    expect(skolemGame.check(question, [['y']]).correct).toBe(false)
    expect(skolemGame.check(question, [[]]).correct).toBe(true)
  })

  it('never names the right arguments in the retry message', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(skolemGame, difficulty)) {
        const verdict = skolemGame.check(question, existentials(skolemFormulaOf(question)).spots.map(() => []))
        if (verdict.correct) continue
        expect(verdict.message).not.toContain('(')
      }
    }
  })
})

describe('Down To Clauses', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference run correct on ${difficulty}`, () => {
      for (const question of sample(clausifyGame, difficulty)) {
        const verdict = clausifyGame.check(question, clausifyGame.solve(question))
        expect([question.matrix, verdict.correct]).toEqual([question.matrix, true])
      }
    })

    it(`never poses a matrix that is already CNF on ${difficulty}`, () => {
      for (const question of sample(clausifyGame, difficulty)) {
        expect([question.matrix, isCnf(matrixOf(question))]).toEqual([question.matrix, false])
        expect(question.par).toBeGreaterThan(0)
      }
    })
  }

  it('counts a step taken out of turn as wasted, not as progress', () => {
    const question = clausifyGame.generate({
      rng: makeRng('cl1'),
      difficulty: 'medium',
      questionIndex: 0,
    })
    const reference = clausifyGame.solve(question)
    const spoiled = ['distribute' as const, ...reference]
    const run = drive(matrixOf(question), spoiled)
    if (run.wasted > 0) {
      const verdict = clausifyGame.check(question, spoiled)
      expect(verdict.correct).toBe(false)
      expect(verdict.message).toContain('did nothing')
    }
  })

  it('refuses stopping before CNF', () => {
    const question = clausifyGame.generate({
      rng: makeRng('cl2'),
      difficulty: 'medium',
      questionIndex: 0,
    })
    const verdict = clausifyGame.check(question, [])
    expect(verdict.correct).toBe(false)
    expect(verdict.message).toContain('CNF')
  })

  it('never names the clause set in the retry message', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(clausifyGame, difficulty)) {
        const verdict = clausifyGame.check(question, [])
        expect(verdict.message).not.toContain('∨')
        expect(show(matrixOf(question))).toBeTruthy()
        expect(splitPrenex(matrixOf(question)).prefix).toHaveLength(0)
      }
    }
  })
})

describe('Build The Universe', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference tray correct on ${difficulty}`, () => {
      for (const question of sample(herbrandUniverseGame, difficulty)) {
        const verdict = herbrandUniverseGame.check(question, herbrandUniverseGame.solve(question))
        expect([question.clauses.join(';'), verdict.correct]).toEqual([
          question.clauses.join(';'),
          true,
        ])
      }
    })

    it(`stores exactly what herbrandUniverse produces on ${difficulty}`, () => {
      for (const question of sample(herbrandUniverseGame, difficulty)) {
        const clauses = universeClausesOf(question)
        expect(new Set(question.elements)).toEqual(
          new Set(herbrandUniverse(clauses, question.depth).map(showTerm)),
        )
      }
    })

    it(`offers exactly the clause set's own symbols on ${difficulty}`, () => {
      for (const question of sample(herbrandUniverseGame, difficulty)) {
        const language = herbrandLanguage(universeClausesOf(question))
        const palette = buildableSignature(question)
        for (const constant of language.constants) {
          expect(palette[(constant as { name: string }).name]).toBe(0)
        }
        for (const [name, arity] of language.functions) expect(palette[name]).toBe(arity)
        // Nothing else — a symbol the clauses never use cannot be built.
        expect(Object.keys(palette).length).toBe(
          language.constants.length + language.functions.length,
        )
      }
    })
  }

  it('says when a constant had to be invented', () => {
    const question = {
      predicates: { p: 1 },
      functions: { f: 1 },
      clauses: ['¬p(x)', 'p(f(x))'],
      depth: 1,
      elements: [],
      invented: true,
    }
    const language = herbrandLanguage(universeClausesOf(question))
    expect(language.invented).toBe(true)
    expect(buildableSignature(question).a).toBe(0)
  })

  it('never names an element in the retry message', () => {
    for (const question of sample(herbrandUniverseGame, 'medium')) {
      const verdict = herbrandUniverseGame.check(question, [])
      for (const element of question.elements) expect(verdict.message).not.toContain(element)
    }
  })
})

describe('Ground It', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference tray correct on ${difficulty}`, () => {
      for (const question of sample(herbrandExpansionGame, difficulty)) {
        expect(
          herbrandExpansionGame.check(question, herbrandExpansionGame.solve(question)).correct,
        ).toBe(true)
      }
    })

    it(`always has a variable to ground on ${difficulty}`, () => {
      for (const question of sample(herbrandExpansionGame, difficulty)) {
        expect(question.instances.length).toBeGreaterThanOrEqual(3)
        expect(new Set(question.instances)).toEqual(new Set(expansionOf(question)))
      }
    })
  }

  it('gives one instance per tuple, not per variable', () => {
    // Both constants have to *occur*, or they are not in the universe — a
    // signature that merely declares them is not enough.
    const question = {
      predicates: { q: 2 },
      functions: { a: 0, b: 0 },
      clauses: ['q(x,y)', 'q(a(),b())'],
      depth: 0,
      instances: [] as string[],
    }
    // Two constants, two variables — four instances of the open clause.
    expect(expansionOf(question)).toHaveLength(4)
  })

  it('moves both occurrences of one variable together', () => {
    const question = {
      predicates: { q: 2 },
      functions: { a: 0, b: 0 },
      clauses: ['q(x,x)', 'q(a(),b())'],
      depth: 0,
      instances: [] as string[],
    }
    expect(expansionOf(question)).toEqual(['q(a(),a())', 'q(b(),b())', 'q(a(),b())'])
  })

  it('invents a constant when none occurs, so the universe is nonempty', () => {
    const question = {
      predicates: { q: 2 },
      functions: { a: 0, b: 0 },
      clauses: ['q(x,y)'],
      depth: 0,
      instances: [] as string[],
    }
    expect(expansionOf(question)).toEqual(['q(a(),a())'])
  })
})

describe('Switch It On', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference answer correct on ${difficulty}`, () => {
      for (const question of sample(herbrandModelGame, difficulty)) {
        expect(herbrandModelGame.check(question, herbrandModelGame.solve(question)).correct).toBe(
          true,
        )
      }
    })

    it(`stores a verdict the exhaustive search agrees with on ${difficulty}`, () => {
      for (const question of sample(herbrandModelGame, difficulty)) {
        expect([question.clauses.join(';'), question.hasModel]).toEqual([
          question.clauses.join(';'),
          someModelExists(question),
        ])
      }
    })

    it(`keeps the base small enough to search on ${difficulty}`, () => {
      for (const question of sample(herbrandModelGame, difficulty)) {
        expect(baseOf(question).length).toBeLessThanOrEqual(8)
      }
    })
  }

  it('asks both answers across a round', () => {
    const answers = new Set(
      DIFFICULTIES.flatMap((difficulty) =>
        sample(herbrandModelGame, difficulty).map((question) => question.hasModel),
      ),
    )
    expect(answers).toEqual(new Set([true, false]))
  })

  it('refuses a set of atoms that falsifies a clause', () => {
    const question = {
      predicates: { p: 1 },
      functions: { a: 0 },
      clauses: ['p(a())', '¬p(a())'],
      hasModel: false,
    }
    expect(herbrandModelGame.check(question, [0]).correct).toBe(false)
    expect(herbrandModelGame.check(question, []).correct).toBe(false)
    expect(herbrandModelGame.check(question, null).correct).toBe(true)
  })
})

describe('The Finite Witness', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference subset correct on ${difficulty}`, () => {
      for (const question of sample(herbrandTheoremGame, difficulty)) {
        expect(
          herbrandTheoremGame.check(question, herbrandTheoremGame.solve(question)).correct,
        ).toBe(true)
      }
    })

    it(`never poses a witness that is the whole set on ${difficulty}`, () => {
      for (const question of sample(herbrandTheoremGame, difficulty)) {
        if (question.par === 0) continue
        expect(question.par).toBeLessThan(question.ground.length)
      }
    })

    it(`stores a par the search agrees with on ${difficulty}`, () => {
      for (const question of sample(herbrandTheoremGame, difficulty)) {
        expect([question.ground.join(';'), question.par]).toEqual([
          question.ground.join(';'),
          smallestSubset(question)?.length ?? 0,
        ])
      }
    })
  }

  it('asks both answers across a round', () => {
    const answers = new Set(
      DIFFICULTIES.flatMap((difficulty) =>
        sample(herbrandTheoremGame, difficulty).map((question) => question.par === 0),
      ),
    )
    expect(answers).toEqual(new Set([true, false]))
  })

  it('accepts a bigger witness, and says the smaller one exists', () => {
    const question = herbrandTheoremGame.generate({
      rng: makeRng('ht1'),
      difficulty: 'medium',
      questionIndex: 0,
    })
    if (question.par === 0) return
    const all = question.ground.map((_, index) => index)
    if (isUnsatisfiable(groundOf(question))) {
      const verdict = herbrandTheoremGame.check(question, all)
      expect(verdict.correct).toBe(true)
    }
  })

  it('refuses a satisfiable subset', () => {
    const question = {
      predicates: { p: 1 },
      functions: { a: 0, f: 1 },
      ground: ['p(a())', '¬p(a())', 'p(f(a()))'],
      par: 2,
    }
    expect(herbrandTheoremGame.check(question, [0, 2]).correct).toBe(false)
    expect(herbrandTheoremGame.check(question, [0, 1]).correct).toBe(true)
  })
})

describe('Instantiate Until It Breaks', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the smallest witness correct on ${difficulty}`, () => {
      for (const question of sample(gilmoreGame, difficulty)) {
        expect(gilmoreGame.check(question, gilmoreGame.solve(question)).correct).toBe(true)
      }
    })

    it(`only poses unsatisfiable clause sets on ${difficulty}`, () => {
      for (const question of sample(gilmoreGame, difficulty)) {
        const clauses = parseFoClauseSet(question.clauses, {
          predicates: question.predicates,
          functions: question.functions,
        })
        expect([question.clauses.join(';'), findFoRefutation(clauses, 300).refuted]).toEqual([
          question.clauses.join(';'),
          true,
        ])
        expect(question.par).toBeGreaterThan(0)
      }
    })

    it(`can always be won at the offered depth on ${difficulty}`, () => {
      for (const question of sample(gilmoreGame, difficulty)) {
        const witness = smallestRefutation(question)
        expect(witness).not.toBeNull()
        expect(witness?.length).toBe(question.par)
        for (const entry of witness ?? []) {
          expect(availableInstances(question)).toContain(entry)
        }
      }
    })
  }

  it('refuses an instance that is not one', () => {
    const question = gilmoreGame.generate({
      rng: makeRng('gm1'),
      difficulty: 'easy',
      questionIndex: 0,
    })
    const verdict = gilmoreGame.check(question, ['p(nonsense())'])
    expect(verdict.correct).toBe(false)
    expect(verdict.message).toContain('not a ground instance')
  })

  it('refuses a set that is still satisfiable', () => {
    const question = gilmoreGame.generate({
      rng: makeRng('gm2'),
      difficulty: 'easy',
      questionIndex: 0,
    })
    const one = availableInstances(question).slice(0, 1)
    if (!isContradictory(parseFoClauseSet(one, { predicates: question.predicates, functions: question.functions }))) {
      const verdict = gilmoreGame.check(question, one)
      expect(verdict.correct).toBe(false)
      expect(verdict.message).toContain('satisfiable')
    }
  })
})
