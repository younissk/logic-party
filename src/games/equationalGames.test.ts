/**
 * Every equational minigame, checked the same way the propositional ones are:
 * the reference answer must mark correct, a wrong answer must not, a retry
 * message must not leak the answer, and a round must never stall.
 */

import { describe, expect, it } from 'vitest'
import { makeRng } from '@/logic'
import { DIFFICULTIES, type Difficulty, type GenerateContext } from '@/engine/types'
import { termFlatGame } from './termFlat'
import { goalHolds, metGoals, termBuildGame } from './termBuild'
import { interpretationGame, valuesOf } from './interpretationGame'
import { compositionGame, composedOf } from './composition'
import { matchingGame } from './matching'
import { mguGame } from './mgu'
import { replay } from './unifyDriver'
import { generalityOf, moreGeneralGame } from './moreGeneral'
import { fateOf, unifiableSortGame } from './unifiableSort'
import { naiveStep, occursCheckGame, unfold } from './occursCheck'
import { areVariants, termsEqual, type Term } from '@/logic'
import { moreGeneral, showTerm, substitutionDomain, unify } from '@/logic'
import { slotToTerm, hole } from '@/ui/TermBuilder'
import {
  INTERPRETATIONS,
  equationHoldsAt,
  equationVariables,
  parseEquation,
  parseTerm,
  type Interpretation,
  type Signature,
} from '@/logic'

const SEEDS = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8']

/** A spread of questions for one game and difficulty. */
function sample<Q>(
  game: { generate: (context: GenerateContext) => Q },
  difficulty: Difficulty,
): Q[] {
  return SEEDS.map((seed, index) =>
    game.generate({ rng: makeRng(`${seed}:${difficulty}`), difficulty, questionIndex: index }),
  )
}

describe('Broken Keyboard', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference answer correct on ${difficulty}`, () => {
      for (const question of sample(termFlatGame, difficulty)) {
        const verdict = termFlatGame.check(question, termFlatGame.solve(question))
        expect([question.letters, verdict.correct]).toEqual([question.letters, true])
      }
    })

    it(`always produces letters that read back as the term on ${difficulty}`, () => {
      for (const question of sample(termFlatGame, difficulty)) {
        // Every target really is at the span the question claims.
        for (const target of question.targets) {
          expect(target.end).toBeGreaterThan(target.start)
          expect(target.end).toBeLessThanOrEqual(question.letters.length)
        }
        expect(question.variables.length).toBeGreaterThanOrEqual(2)
        // The chip row must include a variable that is not in the term, or
        // ticking everything would always work.
        expect(question.variablePool.length).toBeGreaterThan(question.variables.length)
      }
    })
  }

  it('refuses a span that is off by one', () => {
    const question = termFlatGame.generate({ rng: makeRng('x1'), difficulty: 'medium', questionIndex: 0 })
    const reference = termFlatGame.solve(question)
    const first = reference.spans[0] as [number, number]
    const nudged = {
      ...reference,
      spans: [[first[0], first[1] + 1] as [number, number], ...reference.spans.slice(1)],
    }
    expect(termFlatGame.check(question, nudged).correct).toBe(false)
  })

  it('refuses a var(t) with an extra letter in it', () => {
    const question = termFlatGame.generate({ rng: makeRng('x2'), difficulty: 'medium', questionIndex: 0 })
    const reference = termFlatGame.solve(question)
    const extra = question.variablePool.find((name) => !question.variables.includes(name))
    expect(extra).toBeDefined()
    const verdict = termFlatGame.check(question, {
      ...reference,
      variables: [...reference.variables, extra as string],
    })
    expect(verdict.correct).toBe(false)
  })

  it('gives partial credit rather than nothing for a half-right answer', () => {
    const question = termFlatGame.generate({ rng: makeRng('x3'), difficulty: 'hard', questionIndex: 0 })
    const reference = termFlatGame.solve(question)
    const verdict = termFlatGame.check(question, { ...reference, variables: [] })
    expect(verdict.correct).toBe(false)
    expect(verdict.score ?? 0).toBeGreaterThan(0.5)
  })

  it('never names the answer in the retry message', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(termFlatGame, difficulty)) {
        const verdict = termFlatGame.check(question, { spans: [], variables: [] })
        expect(verdict.correct).toBe(false)
        expect(verdict.message).not.toContain(question.source)
        for (const target of question.targets) {
          expect(verdict.message).not.toContain(target.text)
        }
      }
    }
  })

  it('gives distinct questions across seeds', () => {
    const keys = new Set(
      sample(termFlatGame, 'medium').map((question) => termFlatGame.questionKey?.(question)),
    )
    expect(keys.size).toBeGreaterThan(1)
  })
})

describe('Term Foundry', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the witness correct on ${difficulty}`, () => {
      for (const question of sample(termBuildGame, difficulty)) {
        const verdict = termBuildGame.check(question, termBuildGame.solve(question))
        expect([question.witness, verdict.correct]).toEqual([question.witness, true])
      }
    })

    it(`only ever asks for something buildable on ${difficulty}`, () => {
      for (const question of sample(termBuildGame, difficulty)) {
        const witness = slotToTerm(termBuildGame.solve(question))
        expect(witness).not.toBeNull()
        for (const goal of question.goals) {
          expect([question.witness, goalHolds(goal, witness as never)]).toEqual([
            question.witness,
            true,
          ])
        }
      }
    })

    it(`never asks a question a single variable answers on ${difficulty}`, () => {
      for (const question of sample(termBuildGame, difficulty)) {
        const lazy = { kind: 'var' as const, name: question.variables[0] as string }
        expect(metGoals(question, slotToTerm(lazy) as never).every(Boolean)).toBe(false)
      }
    })
  }

  it('refuses a term with a hole still in it', () => {
    const question = termBuildGame.generate({ rng: makeRng('t1'), difficulty: 'medium', questionIndex: 0 })
    const verdict = termBuildGame.check(question, hole())
    expect(verdict.correct).toBe(false)
    expect(verdict.message).toContain('finished')
  })

  it('gives partial credit when some conditions are met', () => {
    const question = termBuildGame.generate({ rng: makeRng('t2'), difficulty: 'hard', questionIndex: 0 })
    const lazy = { kind: 'var' as const, name: question.variables[0] as string }
    const verdict = termBuildGame.check(question, lazy)
    expect(verdict.correct).toBe(false)
    expect(verdict.score ?? 0).toBeGreaterThanOrEqual(0)
    expect(verdict.score ?? 1).toBeLessThan(1)
  })

  it('accepts any term meeting the conditions, not only the witness', () => {
    const sig: Signature = { f: 1, g: 2, c: 0 }
    const question = {
      signature: sig,
      variables: ['x', 'y'],
      goals: [{ kind: 'size' as const, n: 4 }, { kind: 'vars' as const, names: ['x'] }],
      witness: 'g(f(x),x)',
    }
    const other = parseTerm('f(f(f(x)))', sig)
    const verdict = termBuildGame.check(question, {
      kind: 'fn',
      name: 'f',
      args: [{ kind: 'fn', name: 'f', args: [{ kind: 'fn', name: 'f', args: [{ kind: 'var', name: 'x' }] }] }],
    })
    expect(other).toBeDefined()
    expect(verdict.correct).toBe(true)
  })
})

describe('Give It Meaning', () => {
  const SIG: Signature = { f: 2, g: 2 }

  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference answer correct on ${difficulty}`, () => {
      for (const question of sample(interpretationGame, difficulty)) {
        const verdict = interpretationGame.check(question, interpretationGame.solve(question))
        expect([question.id, question.equation, verdict.correct]).toEqual([
          question.id,
          question.equation,
          true,
        ])
      }
    })

    it(`stores a verdict that matches the interpretation on ${difficulty}`, () => {
      for (const question of sample(interpretationGame, difficulty)) {
        const reference = interpretationGame.solve(question)
        // holds ⇔ there is no counterexample to hand.
        expect([question.equation, question.holds]).toEqual([
          question.equation,
          reference.values === null,
        ])
      }
    })
  }

  it('asks both answers across a round', () => {
    const verdicts = new Set(
      DIFFICULTIES.flatMap((difficulty) =>
        sample(interpretationGame, difficulty).map((question) => question.holds),
      ),
    )
    expect(verdicts).toEqual(new Set([true, false]))
  })

  it('refuses values where the two sides agree', () => {
    const question = { id: 'plusTimes' as const, equation: 'f(x,g(y,z))=g(f(x,y),f(x,z))', holds: false }
    // x = 0 makes both sides 0 under addition-over-multiplication.
    const zeros = Object.fromEntries(
      equationVariables(parseEquation(question.equation, SIG)).map((name) => [name, 0]),
    )
    const interpretation = INTERPRETATIONS[question.id] as Interpretation<unknown>
    const agree = equationHoldsAt(
      interpretation,
      valuesOf(question.id, zeros) as never,
      parseEquation(question.equation, SIG),
    )
    if (agree) {
      const verdict = interpretationGame.check(question, { values: zeros })
      expect(verdict.correct).toBe(false)
      expect(verdict.message).toContain('agree')
    }
  })

  it('refuses a counterexample that leaves a variable unset', () => {
    const question = { id: 'plusTimes' as const, equation: 'f(x,g(y,z))=g(f(x,y),f(x,z))', holds: false }
    const verdict = interpretationGame.check(question, { values: { x: 2 } })
    expect(verdict.correct).toBe(false)
    expect(verdict.message).toContain('No value chosen')
  })

  it('refuses "it holds" when it does not, and says so without naming values', () => {
    const question = { id: 'plusTimes' as const, equation: 'f(x,g(y,z))=g(f(x,y),f(x,z))', holds: false }
    const verdict = interpretationGame.check(question, { values: null })
    expect(verdict.correct).toBe(false)
    expect(verdict.message).toBe('It does not hold here')
  })
})

describe('Compose It', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the composition correct on ${difficulty}`, () => {
      for (const question of sample(compositionGame, difficulty)) {
        const verdict = compositionGame.check(question, compositionGame.solve(question))
        expect([JSON.stringify(question.outer), verdict.correct]).toEqual([
          JSON.stringify(question.outer),
          true,
        ])
      }
    })

    it(`asks only for variables the composition actually moves on ${difficulty}`, () => {
      for (const question of sample(compositionGame, difficulty)) {
        expect(question.domain).toEqual(substitutionDomain(composedOf(question)))
        expect(question.domain.length).toBeGreaterThanOrEqual(2)
      }
    })
  }

  it('refuses an unfinished image', () => {
    const question = compositionGame.generate({ rng: makeRng('c1'), difficulty: 'medium', questionIndex: 0 })
    const verdict = compositionGame.check(question, {})
    expect(verdict.correct).toBe(false)
  })

  it('refuses the other order', () => {
    const question = {
      signature: { f: 1 } as Signature,
      variables: ['x', 'y'],
      outer: { x: 'y' },
      inner: { y: 'f(x)' },
      domain: ['x', 'y'],
    }
    // σ′ ∘ σ is {x ↦ f(x), y ↦ f(x)} — a different substitution.
    const wrong = {
      x: { kind: 'fn' as const, name: 'f', args: [{ kind: 'var' as const, name: 'x' }] },
      y: { kind: 'fn' as const, name: 'f', args: [{ kind: 'var' as const, name: 'x' }] },
    }
    expect(compositionGame.check(question, wrong).correct).toBe(false)
  })

  it('never names the answer in the retry message', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(compositionGame, difficulty)) {
        const verdict = compositionGame.check(question, {})
        const composed = composedOf(question)
        for (const name of question.domain) {
          expect(verdict.message).not.toContain(showTerm(composed[name] as never))
        }
      }
    }
  })
})

describe('Run The Matcher', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the algorithm's own run correct on ${difficulty}`, () => {
      for (const question of sample(matchingGame, difficulty)) {
        const verdict = matchingGame.check(question, matchingGame.solve(question))
        expect([question.pattern, question.target, verdict.correct]).toEqual([
          question.pattern,
          question.target,
          true,
        ])
      }
    })

    it(`stores a verdict that matches moreGeneral on ${difficulty}`, () => {
      for (const question of sample(matchingGame, difficulty)) {
        const pattern = parseTerm(question.pattern, question.signature)
        const target = parseTerm(question.target, question.signature)
        expect([question.pattern, question.matches]).toEqual([
          question.pattern,
          moreGeneral(pattern, target),
        ])
      }
    })
  }

  it('asks both answers across a round', () => {
    const seen = new Set(
      DIFFICULTIES.flatMap((difficulty) =>
        sample(matchingGame, difficulty).map((question) => question.matches),
      ),
    )
    expect(seen).toEqual(new Set([true, false]))
  })

  it('refuses stopping early', () => {
    const question = matchingGame.generate({ rng: makeRng('m1'), difficulty: 'medium', questionIndex: 0 })
    const verdict = matchingGame.check(question, [])
    expect(verdict.correct).toBe(false)
    expect(verdict.message).toContain('finished')
  })

  it('refuses a move the rules do not allow', () => {
    // Binding on the right is never legal in matching.
    const question = matchingGame.generate({ rng: makeRng('m2'), difficulty: 'medium', questionIndex: 0 })
    const verdict = matchingGame.check(question, [{ kind: 'bind', side: 'right' }])
    expect(verdict.correct).toBe(false)
  })

  it('never lets a wrong ending pass', () => {
    for (const question of sample(matchingGame, 'medium')) {
      const pattern = parseTerm(question.pattern, question.signature)
      const target = parseTerm(question.target, question.signature)
      const state = replay('match', pattern, target, matchingGame.solve(question))
      expect(state.outcome === 'unified').toBe(question.matches)
    }
  })
})

describe('Unify It', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the algorithm's own run correct on ${difficulty}`, () => {
      for (const question of sample(mguGame, difficulty)) {
        const verdict = mguGame.check(question, mguGame.solve(question))
        expect([question.left, question.right, verdict.correct]).toEqual([
          question.left,
          question.right,
          true,
        ])
      }
    })

    it(`stores the ending unify agrees with on ${difficulty}`, () => {
      for (const question of sample(mguGame, difficulty)) {
        const result = unify(
          parseTerm(question.left, question.signature),
          parseTerm(question.right, question.signature),
        )
        const ending = result.unified ? 'unified' : result.failure.reason
        expect([question.left, question.outcome]).toEqual([question.left, ending])
      }
    })
  }

  it('asks all three endings across a round', () => {
    const endings = new Set(
      DIFFICULTIES.flatMap((difficulty) =>
        sample(mguGame, difficulty).map((question) => question.outcome),
      ),
    )
    expect(endings.size).toBeGreaterThanOrEqual(2)
    expect(endings.has('occurs')).toBe(true)
  })

  it('marks the wrong failure wrong, even though "no unifier" was right', () => {
    const clash = sample(mguGame, 'medium').find((question) => question.outcome === 'clash')
    if (clash !== undefined) {
      const verdict = mguGame.check(clash, [{ kind: 'occurs' }])
      expect(verdict.correct).toBe(false)
    }
  })

  it('never names the substitution in the retry message', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(mguGame, difficulty)) {
        const verdict = mguGame.check(question, [])
        expect(verdict.correct).toBe(false)
        expect(verdict.message).not.toContain('↦')
      }
    }
  })
})

describe('Instance Or Not', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference sort correct on ${difficulty}`, () => {
      for (const question of sample(moreGeneralGame, difficulty)) {
        const verdict = moreGeneralGame.check(question, moreGeneralGame.solve(question))
        expect([question.target, verdict.correct]).toEqual([question.target, true])
      }
    })

    it(`always has something in the outer two bins on ${difficulty}`, () => {
      for (const question of sample(moreGeneralGame, difficulty)) {
        const bins = new Set(question.candidates.map((source) => generalityOf(question, source)))
        expect([question.target, bins.has('general'), bins.has('no')]).toEqual([
          question.target,
          true,
          true,
        ])
      }
    })

    it(`agrees with moreGeneral and areVariants on ${difficulty}`, () => {
      for (const question of sample(moreGeneralGame, difficulty)) {
        const target = parseTerm(question.target, question.signature)
        for (const source of question.candidates) {
          const candidate = parseTerm(source, question.signature)
          const expected = areVariants(candidate, target)
            ? 'variant'
            : moreGeneral(candidate, target)
              ? 'general'
              : 'no'
          expect([source, generalityOf(question, source)]).toEqual([source, expected])
        }
      }
    })
  }

  it('gives partial credit for a partly right sort', () => {
    const question = moreGeneralGame.generate({ rng: makeRng('g1'), difficulty: 'hard', questionIndex: 0 })
    const reference = moreGeneralGame.solve(question)
    const spoiled = [...reference]
    spoiled[0] = spoiled[0] === 'no' ? 'general' : 'no'
    const verdict = moreGeneralGame.check(question, spoiled)
    expect(verdict.correct).toBe(false)
    expect(verdict.score ?? 0).toBeGreaterThan(0.5)
  })

  it('never names a candidate in the retry message', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const question of sample(moreGeneralGame, difficulty)) {
        const verdict = moreGeneralGame.check(question, question.candidates.map(() => null))
        for (const source of question.candidates) {
          expect(verdict.message).not.toContain(source)
        }
      }
    }
  })
})

describe('Unifiable Sweep', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference sort correct on ${difficulty}`, () => {
      for (const question of sample(unifiableSortGame, difficulty)) {
        const verdict = unifiableSortGame.check(question, unifiableSortGame.solve(question))
        expect(verdict.correct).toBe(true)
      }
    })

    it(`always fills all three bins on ${difficulty}`, () => {
      for (const question of sample(unifiableSortGame, difficulty)) {
        const bins = new Set(question.pairs.map((pair) => fateOf(question, pair)))
        expect(bins).toEqual(new Set(['unified', 'clash', 'occurs']))
      }
    })

    it(`agrees with unify on every pair on ${difficulty}`, () => {
      for (const question of sample(unifiableSortGame, difficulty)) {
        for (const pair of question.pairs) {
          const result = unify(
            parseTerm(pair.left, question.signature),
            parseTerm(pair.right, question.signature),
          )
          expect([pair.left, fateOf(question, pair)]).toEqual([
            pair.left,
            result.unified ? 'unified' : result.failure.reason,
          ])
        }
      }
    })
  }

  it('calls out the two failures being swapped as its own mistake', () => {
    const question = unifiableSortGame.generate({ rng: makeRng('u1'), difficulty: 'medium', questionIndex: 0 })
    const reference = unifiableSortGame.solve(question)
    const swapped = reference.map((fate) =>
      fate === 'clash' ? 'occurs' : fate === 'occurs' ? 'clash' : fate,
    )
    const verdict = unifiableSortGame.check(question, swapped)
    expect(verdict.correct).toBe(false)
    expect(verdict.message).toContain('failure bin')
  })
})

describe('Push It Along', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`marks the reference answer correct on ${difficulty}`, () => {
      for (const question of sample(occursCheckGame, difficulty)) {
        const verdict = occursCheckGame.check(question, occursCheckGame.solve(question))
        expect([question.left, verdict.correct]).toEqual([question.left, true])
      }
    })

    it(`stores a verdict that unify agrees with on ${difficulty}`, () => {
      for (const question of sample(occursCheckGame, difficulty)) {
        const result = unify(
          parseTerm(question.left, question.signature),
          parseTerm(question.right, question.signature),
        )
        // The pair is built so its only mismatch is the one binding, so the
        // whole unification succeeds exactly when that binding is safe.
        expect([question.left, question.resolves]).toEqual([question.left, result.unified])
      }
    })

    it(`asks both answers on ${difficulty}`, () => {
      const answers = new Set(
        sample(occursCheckGame, difficulty).map((question) => question.resolves),
      )
      expect(answers.size).toBe(2)
    })
  }

  it('runs away exactly when the variable occurs in the term', () => {
    for (const question of sample(occursCheckGame, 'medium')) {
      const left = parseTerm(question.left, question.signature)
      const right = parseTerm(question.right, question.signature)
      const chain = unfold(left, right, 6)
      const last = chain[chain.length - 1] as { left: Term; right: Term }
      const met = termsEqual(last.left, last.right)
      expect([question.left, met]).toEqual([question.left, question.resolves])
    }
  })

  it('grows the terms rather than repairing them when it runs away', () => {
    const runaway = sample(occursCheckGame, 'medium').find((question) => !question.resolves)
    expect(runaway).toBeDefined()
    if (runaway !== undefined) {
      const left = parseTerm(runaway.left, runaway.signature)
      const right = parseTerm(runaway.right, runaway.signature)
      const chain = unfold(left, right, 4)
      expect(chain.length).toBeGreaterThan(2)
      // Strictly bigger every step: that is what "the mismatch only moves" means.
      for (let index = 1; index < chain.length; index++) {
        const before = chain[index - 1] as { left: Term }
        const after = chain[index] as { left: Term }
        expect(showTerm(after.left).length).toBeGreaterThan(showTerm(before.left).length)
      }
    }
  })

  it('does nothing once the two terms agree', () => {
    const term = parseTerm('f(x)', { f: 1 })
    expect(naiveStep(term, term)).toBeNull()
  })

  it('never says which way the claim was wrong', () => {
    for (const question of sample(occursCheckGame, 'hard')) {
      const verdict = occursCheckGame.check(question, { resolves: !question.resolves, applied: 0 })
      expect(verdict.correct).toBe(false)
      expect(verdict.message).toBe('Not what happens')
    }
  })
})
