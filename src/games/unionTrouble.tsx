/**
 * Subsets, supersets and unions of theories — ln.pdf §5.1, Exercise 10
 * question 1, and the true/false question on all three exam papers.
 *
 * The claim worth understanding is the union one. Both T₁ and T₂ are closed
 * under consequence, and their union is not, because a formula can follow from
 * one axiom of each without following from either alone. Saying "the union
 * need not be a theory" is a sentence; producing the formula that breaks it is
 * the exercise.
 *
 * So that is what the game asks for: the witness. It is checked by running the
 * three membership tests — entailed by both together, in neither separately —
 * rather than compared against a stored answer, so any formula that works is
 * accepted. Some rounds hand over a pair where the union *is* closed, and then
 * the answer is that there is no witness; without those the "no witness"
 * button would be a tell.
 */

import { useEffect, useMemo, useState } from 'react'
import { inTheory, modelsOf, unionClosureModels, unionWitness, showFormula } from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'
import { MovingItem, MovingList, Pop } from '@/ui/motion'
import { CATALOGUE, CATALOGUE_FORMULAS, WORLD, parse } from './theoryWorld'
import { UnionTroubleGuide } from './unionTrouble.guide'

export interface UnionQuestion {
  left: string[]
  right: string[]
  bank: string[]
}

export interface UnionAnswer {
  /** Null means the claim that no witness exists. */
  witness: string | null
}

export const leftModels = (question: UnionQuestion): number[] =>
  modelsOf(WORLD, question.left.map(parse))

export const rightModels = (question: UnionQuestion): number[] =>
  modelsOf(WORLD, question.right.map(parse))

/** Entailed by the two theories together, and in neither of them. */
export function isWitness(question: UnionQuestion, source: string): boolean {
  const formula = parse(source)
  const both = unionClosureModels(leftModels(question), rightModels(question))
  return (
    inTheory(WORLD, both, formula) &&
    !inTheory(WORLD, leftModels(question), formula) &&
    !inTheory(WORLD, rightModels(question), formula)
  )
}

export const witnessOf = (question: UnionQuestion): string | null => {
  const found = unionWitness(WORLD, leftModels(question), rightModels(question), CATALOGUE_FORMULAS)
  if (found === null) return null
  // Prefer one the player can actually click.
  return question.bank.find((source) => isWitness(question, source)) ?? showFormula(found)
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Pairs of axiom sets.
 *
 * Some overlap so much that the union is already closed — those are the ones
 * where the honest answer is "no witness", and they have to be in the pool or
 * that button would never be right.
 */
const PAIRS: Record<Difficulty, readonly [string[], string[]][]> = {
  easy: [
    [['∃x:p(x)'], ['∃x:¬p(x)']],
    [['∀x:p(x)'], ['∃x:p(x)']],
    [['∀x:p(x)'], ['∀x:¬p(x)']],
  ],
  medium: [
    [['∃x:p(x)'], ['∃x:¬p(x)']],
    [['∃x:p(x)'], ['(∀x:p(x))∨(∀x:¬p(x))']],
    [['∃x:¬p(x)'], ['(∀x:p(x))∨(∀x:¬p(x))']],
    [['∀x:¬p(x)'], ['∃x:¬p(x)']],
  ],
  hard: [
    [['∃x:p(x)'], ['(∃x:p(x))→(∀x:p(x))']],
    [['∃x:¬p(x)'], ['(∃x:¬p(x))→(∀x:¬p(x))']],
    [['(∀x:p(x))∨(∀x:¬p(x))'], ['(∃x:p(x))∧(∃x:¬p(x))']],
    [['∀x:(p(x)∨¬p(x))'], ['∃x:p(x)']],
  ],
}

function generate({ rng, difficulty }: GenerateContext): UnionQuestion {
  const [left, right] = rng.pick([...PAIRS[difficulty]])
  const used = new Set([...left, ...right])
  const bank = rng.shuffle(CATALOGUE.filter((source) => !used.has(source))).slice(0, 6)
  const question: UnionQuestion = { left: [...left], right: [...right], bank }

  // If a witness exists it has to be on the board, or the question is unfair.
  const found = unionWitness(WORLD, leftModels(question), rightModels(question), CATALOGUE_FORMULAS)
  if (found !== null && !bank.some((source) => isWitness(question, source))) {
    return { ...question, bank: rng.shuffle([showFormula(found), ...bank.slice(0, 5)]) }
  }
  return question
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: UnionQuestion): UnionAnswer => ({ witness: witnessOf(question) })

function check(question: UnionQuestion, answer: UnionAnswer): Verdict {
  const exists = witnessOf(question) !== null

  if (answer.witness === null) {
    return exists
      ? {
          correct: false,
          // Naming it would answer the question.
          message: 'There is one — look at what the two axioms give together',
          score: 0,
          detail:
            'Take a structure satisfying the axioms of both. Anything true in all of those is entailed by the union; if one theory alone has a model falsifying it, that theory does not contain it.',
        }
      : {
          correct: true,
          message: 'Nothing escapes — this union really is closed',
          detail:
            'When one theory already contains the other, their union is the bigger one, and that is closed. The claim is only that a union *need not* be a theory, never that it cannot be.',
        }
  }

  if (!isWitness(question, answer.witness)) {
    const formula = parse(answer.witness)
    const inLeft = inTheory(WORLD, leftModels(question), formula)
    const inRight = inTheory(WORLD, rightModels(question), formula)
    const both = unionClosureModels(leftModels(question), rightModels(question))
    return {
      correct: false,
      // Says which of the three tests it failed, which is a real hint about
      // the method and not about which chip to click next.
      message: !inTheory(WORLD, both, formula)
        ? 'The two together do not entail that'
        : 'One of the two theories already contains it',
      score: 0.3,
      detail: `A witness has to pass all three tests: entailed by the axioms of both, in neither theory on its own. ${
        inLeft ? 'The first theory contains it. ' : ''
      }${inRight ? 'The second theory contains it.' : ''}`.trim(),
    }
  }

  return {
    correct: true,
    message: 'Entailed by both together and in neither — the union is not closed',
    detail:
      'That is the counterexample the claim needs. Adding a theory to a theory does not give a theory, because consequences of the mixture belong to neither part.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function TheoryCard({ title, axioms, tone }: { title: string; axioms: string[]; tone: string }) {
  return (
    <div className={`tile px-3 py-2 ${tone}`}>
      <p className="text-xs font-bold uppercase tracking-wider opacity-70">{title}</p>
      <div className="mt-1 flex flex-col gap-1">
        {axioms.map((axiom) => (
          <FoText key={axiom} text={axiom} className="text-sm font-bold" />
        ))}
      </div>
    </div>
  )
}

function Screen({ question, submit, locked }: MinigameScreenProps<UnionQuestion, UnionAnswer>) {
  const [picked, setPicked] = useState<string | null>(null)
  const wanted = useMemo(() => solve(question), [question])

  useEffect(() => setPicked(null), [question])

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Is the union of these two a theory?
      </p>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <TheoryCard title="T₁ is generated by" axioms={question.left} tone="bg-space-blue/15" />
        <TheoryCard title="T₂ is generated by" axioms={question.right} tone="bg-coin/50" />
      </div>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        over the four structures on {'{1,2}'}. Find a formula T₁ ∪ T₂ entails that neither theory
        contains — or say there is none.
      </p>

      {!locked && (
        <>
          <MovingList className="mt-3 flex flex-wrap gap-1.5">
            {question.bank.map((source) => (
              <MovingItem
                key={source}
                id={source}
                onClick={() => setPicked(source)}
                className={`tile px-2.5 py-1 ${picked === source ? 'bg-grass text-white' : 'bg-card'}`}
              >
                <FoText text={source} className="text-sm font-bold" />
              </MovingItem>
            ))}
          </MovingList>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant={picked === null ? 'secondary' : 'coin'}
              disabled={picked === null}
              onClick={() => submit({ witness: picked })}
            >
              This one breaks it
            </Button>
            <Button variant="secondary" onClick={() => submit({ witness: null })}>
              Nothing breaks it
            </Button>
          </div>
        </>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium text-ink-soft">
          {wanted.witness === null ? (
            <>One of these theories contains the other, so their union is already closed.</>
          ) : (
            <>
              <span className="font-logic font-bold text-ink">{wanted.witness}</span> follows from
              the two together and belongs to neither.
            </>
          )}
        </Pop>
      )}
    </Card>
  )
}

export const unionTroubleGame = defineMinigame<UnionQuestion, UnionAnswer>({
  id: 'theory-sets',
  title: 'Union Trouble',
  tagline: 'Find the formula two theories entail together and neither one contains.',
  topics: ['theories'],
  icon: '🔗',
  roundSeconds: 150,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  questionKey: (question) => `${question.left.join('∧')}|${question.right.join('∧')}`,
  explain: (question) => {
    const witness = witnessOf(question)
    return witness === null
      ? 'One of these theories contains the other, so the union is closed and is a theory.'
      : `${witness} follows from the axioms of both and is in neither theory, so the union is not closed.`
  },
  Screen,
  Guide: UnionTroubleGuide,
})
