/**
 * Herbrand interpretations and models — ln.pdf §4.3, Example 4.19.
 *
 * A Herbrand interpretation has nothing left to choose except which ground
 * atoms are true: the universe is the ground terms, and every function symbol
 * is fixed to build the term that names it. So an interpretation *is* a set of
 * ground atoms, and the game is picking that set.
 *
 * Theorem 4.20 is why it is worth doing: a clause set is unsatisfiable exactly
 * when no Herbrand model exists. Failing to find one here is not a shrug, it is
 * half of a proof.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  foLiteralsEqual,
  herbrandBase,
  herbrandUniverse,
  isHerbrandModel,
  parseFoClauseSet,
  showFoLiteral,
  showTerm,
  type FoClause,
  type FoLiteral,
  type FoSignature,
  type Signature,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoClauseText, FoText } from '@/ui/FoText'
import { TermText } from '@/ui/TermText'
import { Pop } from '@/ui/motion'
import { HerbrandModelGuide } from './herbrandModel.guide'

export interface HerbrandModelQuestion {
  predicates: Record<string, number>
  functions: Signature
  /** Ground clauses — the part of an expansion being judged. */
  clauses: string[]
  /** True when some subset of the base is a model. */
  hasModel: boolean
}

/** Indices into the Herbrand base that are true. Null claims there is no model. */
export type HerbrandModelAnswer = number[] | null

const signatureOf = (question: HerbrandModelQuestion): FoSignature => ({
  predicates: question.predicates,
  functions: question.functions,
})

export const clausesOf = (question: HerbrandModelQuestion): FoClause[] =>
  parseFoClauseSet(question.clauses, signatureOf(question))

/** The ground atoms that can be switched on, in a stable order. */
export const baseOf = (question: HerbrandModelQuestion): FoLiteral[] =>
  herbrandBase(clausesOf(question), 0)

/** Is there any subset of the base that satisfies every clause? */
export function someModelExists(question: HerbrandModelQuestion): boolean {
  const clauses = clausesOf(question)
  const base = baseOf(question)
  const total = 2 ** base.length
  for (let mask = 0; mask < total; mask++) {
    const trueAtoms = base.filter((_, index) => (mask & (1 << index)) !== 0)
    if (isHerbrandModel(clauses, trueAtoms, 0)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  predicates: Record<string, number>
  functions: Signature
  sets: string[][]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    predicates: { p: 1, q: 1 },
    functions: { a: 0, b: 0 },
    sets: [
      ['¬p(a())', 'p(a())'],
      ['p(a()) ∨ q(a())', '¬p(a())'],
      ['p(a())', '¬q(a())'],
      ['p(a()) ∨ p(b())', '¬p(a())', '¬p(b())'],
    ],
  },
  medium: {
    predicates: { p: 1, q: 2 },
    functions: { a: 0, b: 0 },
    sets: [
      ['p(a()) ∨ q(a(),b())', '¬q(a(),b())', '¬p(a()) ∨ q(b(),a())'],
      ['¬p(a()) ∨ p(b())', 'p(a())', '¬p(b())'],
      ['p(a()) ∨ p(b())', '¬p(a()) ∨ q(a(),a())', '¬q(a(),a())'],
    ],
  },
  hard: {
    predicates: { p: 2, q: 1 },
    functions: { a: 0, b: 0 },
    sets: [
      [
        'p(a(),a()) ∨ ¬q(a())',
        '¬p(a(),a())',
        '¬p(a(),b())',
        'p(a(),b()) ∨ q(a())',
      ],
      [
        'p(a(),b()) ∨ p(b(),a())',
        '¬p(a(),b()) ∨ q(a())',
        '¬p(b(),a()) ∨ q(b())',
        '¬q(a())',
      ],
    ],
  },
}

function generate({ rng, difficulty }: GenerateContext): HerbrandModelQuestion {
  const profile = PROFILES[difficulty]
  const signature: FoSignature = {
    predicates: profile.predicates,
    functions: profile.functions,
  }
  // Draw the answer first, so "no model" comes up as often as a model does.
  const wanted = rng.bool()

  for (const set of rng.shuffle(profile.sets)) {
    try {
      parseFoClauseSet(set, signature)
    } catch {
      continue
    }
    const question: HerbrandModelQuestion = {
      predicates: profile.predicates,
      functions: profile.functions,
      clauses: set,
      hasModel: false,
    }
    // Small enough to search by brute force, which is what makes the "no model"
    // answer a fact rather than a failure to find one.
    if (baseOf(question).length > 8) continue
    const hasModel = someModelExists(question)
    if (hasModel !== wanted) continue
    return { ...question, hasModel }
  }

  const fallback = ['¬p(a())', 'p(a())']
  const question: HerbrandModelQuestion = {
    predicates: { p: 1 },
    functions: { a: 0 },
    clauses: fallback,
    hasModel: false,
  }
  return { ...question, hasModel: someModelExists(question) }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

function solve(question: HerbrandModelQuestion): HerbrandModelAnswer {
  const clauses = clausesOf(question)
  const base = baseOf(question)
  const total = 2 ** base.length
  for (let mask = 0; mask < total; mask++) {
    const chosen = base.map((_, index) => index).filter((index) => (mask & (1 << index)) !== 0)
    if (isHerbrandModel(clauses, chosen.map((index) => base[index] as FoLiteral), 0)) return chosen
  }
  return null
}

function check(question: HerbrandModelQuestion, answer: HerbrandModelAnswer): Verdict {
  const clauses = clausesOf(question)
  const base = baseOf(question)

  if (answer === null) {
    if (!someModelExists(question)) {
      return {
        correct: true,
        message: 'No Herbrand model — unsatisfiable',
        detail:
          'Every assignment of truth values to the ground atoms falsifies some clause, and by Theorem 4.20 that is exactly unsatisfiability.',
      }
    }
    return {
      correct: false,
      // Says one exists, never which atoms it switches on.
      message: 'There is a model',
      detail: `${base.length} ground atom${base.length === 1 ? '' : 's'} means ${2 ** base.length} interpretations, and at least one of them satisfies every clause.`,
    }
  }

  const trueAtoms = answer
    .map((index) => base[index])
    .filter((literal): literal is FoLiteral => literal !== undefined)

  if (isHerbrandModel(clauses, trueAtoms, 0)) {
    return {
      correct: true,
      message: `A model with ${trueAtoms.length} atom${trueAtoms.length === 1 ? '' : 's'} true`,
      detail:
        'A Herbrand interpretation is exactly the set of ground atoms it makes true — nothing else about it is free to choose.',
    }
  }

  const broken = clauses.findIndex(
    (clause) =>
      !clause.some((literal) => {
        const positive = trueAtoms.some((entry) =>
          foLiteralsEqual({ ...entry, negated: false }, { ...literal, negated: false }),
        )
        return literal.negated ? !positive : positive
      }),
  )

  return {
    correct: false,
    // Names that a clause fails, never which atoms would fix it.
    message: 'That set falsifies a clause',
    score: 0.2,
    detail:
      broken === -1
        ? 'Every clause needs at least one literal true under your choice.'
        : `Clause ${broken + 1} has no true literal under it. A negative literal is true exactly when its atom is switched off.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<HerbrandModelQuestion, HerbrandModelAnswer>) {
  const clauses = useMemo(() => clausesOf(question), [question])
  const base = useMemo(() => baseOf(question), [question])
  const universe = useMemo(() => herbrandUniverse(clauses, 0), [clauses])
  const [on, setOn] = useState<number[]>([])

  useEffect(() => {
    setOn([])
  }, [question])

  const trueAtoms = on.map((index) => base[index] as FoLiteral)
  const satisfied = (clause: FoClause): boolean =>
    clause.some((literal) => {
      const positive = trueAtoms.some((entry) =>
        foLiteralsEqual({ ...entry, negated: false }, { ...literal, negated: false }),
      )
      return literal.negated ? !positive : positive
    })

  const allSatisfied = clauses.every(satisfied)

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Switch on a Herbrand model
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-2 text-xs font-medium text-ink-soft">
        <span className="font-bold uppercase tracking-wider">universe</span>
        {universe.map((term) => (
          <span key={showTerm(term)} className="rounded-md bg-card-shade px-1.5 py-0.5">
            <TermText term={term} className="font-bold" />
          </span>
        ))}
      </p>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
        Ground atoms — tap to make true
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {base.map((literal, index) => (
          <button
            key={showFoLiteral(literal)}
            type="button"
            disabled={locked}
            onClick={() =>
              setOn((previous) =>
                previous.includes(index)
                  ? previous.filter((entry) => entry !== index)
                  : [...previous, index],
              )
            }
            className={`chunky min-h-10 px-3 text-sm font-bold
              focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
              ${on.includes(index) ? 'bg-space-blue text-white' : 'bg-card text-ink hover:bg-card-shade'}`}
          >
            <FoText
              text={showFoLiteral(literal)}
              className={on.includes(index) ? 'text-white' : ''}
            />
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
        The clauses — {clauses.filter(satisfied).length} of {clauses.length} satisfied
      </p>
      <div className="mt-1 flex flex-col gap-1">
        {clauses.map((clause, index) => (
          <div
            key={index}
            className={`tile px-3 py-1.5 ${satisfied(clause) ? 'bg-grass text-white' : 'bg-card-shade'}`}
          >
            <FoClauseText clause={clause} className="text-base font-bold" />
          </div>
        ))}
      </div>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            {question.hasModel ? 'One model' : 'No model exists'}
          </p>
          <p className="mt-1 font-bold">
            {question.hasModel
              ? (solve(question) ?? [])
                  .map((index) => showFoLiteral(base[index] as FoLiteral))
                  .join(', ') || 'the empty set — every atom false'
              : `All ${2 ** base.length} interpretations falsify some clause, so the set is unsatisfiable.`}
          </p>
        </Pop>
      )}

      {!locked && (
        <div className="mt-3 flex flex-col gap-2">
          <Button variant={allSatisfied ? 'coin' : 'secondary'} onClick={() => submit(on)}>
            {allSatisfied ? 'Submit this model' : 'Submit anyway'}
          </Button>
          <Button variant="danger" onClick={() => submit(null)}>
            No Herbrand model exists
          </Button>
        </div>
      )}
    </Card>
  )
}

export const herbrandModelGame = defineMinigame<HerbrandModelQuestion, HerbrandModelAnswer>({
  id: 'herbrand-models',
  title: 'Switch It On',
  tagline: 'An interpretation is just the set of ground atoms you make true.',
  topics: ['herbrand'],
  icon: '💡',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: HerbrandModelGuide,
  questionKey: (question) => question.clauses.join(';'),
})
