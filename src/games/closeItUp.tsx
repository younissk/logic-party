/**
 * What makes a set of formulas a theory — ln.pdf §5.1, Definition 5.1, and the
 * true/false question on all three exam papers.
 *
 * A theory is a set of closed formulas closed under logical consequence. The
 * exams ask about that closure in the abstract — is every subset of a theory a
 * theory, is every superset — and the answers all come from the same place:
 * consequence is not something you get to opt out of.
 *
 * Rather than ask the abstract question, this makes it concrete and decidable.
 * The universe is fixed at two elements with a single unary predicate, which
 * gives four structures in total. A set of axioms picks out the structures
 * satisfying it, and the theory it generates is everything true in all of
 * those. That is Definition 5.1 with the "all structures" replaced by a list
 * you can point at — and the closure behaves exactly the same way.
 */

import { useEffect, useMemo, useState } from 'react'
import { inTheory, modelsOf, showFormula } from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'
import { SortBoard, type Bin } from '@/ui/SortBoard'
import { Pop } from '@/ui/motion'
import { CATALOGUE, WORLD, parse } from './theoryWorld'
import { CloseItUpGuide } from './closeItUp.guide'

export interface CloseItUpQuestion {
  /** The axioms generating the theory. */
  axioms: string[]
  /** The formulas to sort. */
  candidates: string[]
}

/** Where each candidate was dropped. */
export type CloseItUpAnswer = ('in' | 'out' | null)[]

export const modelsOfQuestion = (question: CloseItUpQuestion): number[] =>
  modelsOf(WORLD, question.axioms.map(parse))

export function belongs(question: CloseItUpQuestion, candidate: string): boolean {
  return inTheory(WORLD, modelsOfQuestion(question), parse(candidate))
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const AXIOM_SETS: Record<Difficulty, readonly string[][]> = {
  easy: [['∀x:p(x)'], ['∀x:¬p(x)'], ['∃x:p(x)']],
  medium: [
    ['∃x:p(x)', '∃x:¬p(x)'],
    ['∃x:¬p(x)'],
    ['(∀x:p(x))∨(∀x:¬p(x))'],
  ],
  hard: [
    ['(∃x:p(x))→(∀x:p(x))'],
    ['∀x:(p(x)∨¬p(x))'],
    ['(∀x:p(x))→(∃x:¬p(x))'],
    ['∃x:(p(x)∧¬p(x))'],
  ],
}

const HOW_MANY: Record<Difficulty, number> = { easy: 4, medium: 5, hard: 6 }

function generate({ rng, difficulty }: GenerateContext): CloseItUpQuestion {
  for (let attempt = 0; attempt < 40; attempt++) {
    const axioms = rng.pick([...AXIOM_SETS[difficulty]])
    const pool = CATALOGUE.filter((formula) => !axioms.includes(formula))
    const candidates = rng.sample(pool, HOW_MANY[difficulty])
    const question = { axioms: [...axioms], candidates }
    const verdicts = candidates.map((candidate) => belongs(question, candidate))
    // A board that is all one colour is not a question.
    if (!verdicts.includes(true) || !verdicts.includes(false)) continue
    return question
  }
  return {
    axioms: ['∃x:p(x)'],
    candidates: ['∀x:p(x)', '∃x:¬p(x)', '(∀x:p(x))→(∃x:p(x))', '∀x:¬p(x)'],
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: CloseItUpQuestion): CloseItUpAnswer =>
  question.candidates.map((candidate) => (belongs(question, candidate) ? 'in' : 'out'))

function check(question: CloseItUpQuestion, answer: CloseItUpAnswer): Verdict {
  const wanted = solve(question)
  const wrong = wanted.filter((bin, index) => answer[index] !== bin).length
  const models = modelsOfQuestion(question)

  if (wrong === 0) {
    return {
      correct: true,
      message: `The axioms have ${models.length} model${models.length === 1 ? '' : 's'} here`,
      detail: `A formula is in the theory exactly when it is true in every structure satisfying the axioms — ${
        models.length === 0
          ? 'and with no models at all, everything is in it, which is what inconsistent means.'
          : `here that is ${models.map((index) => WORLD.labels[index]).join(', ')}.`
      }`,
    }
  }

  return {
    correct: false,
    // A count, never which one: the sprint shows this before the retry.
    message: `${wrong} of ${wanted.length} in the wrong bin`,
    score: (wanted.length - wrong) / wanted.length,
    detail:
      'Find the structures satisfying every axiom first. Then a formula belongs exactly when all of those make it true — one structure that satisfies the axioms and falsifies the formula is enough to keep it out.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const BINS: readonly Bin<'in' | 'out'>[] = [
  { id: 'in', label: 'In the theory', style: 'bg-grass/25' },
  { id: 'out', label: 'Not in it', style: 'bg-space-red/15' },
]

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<CloseItUpQuestion, CloseItUpAnswer>) {
  const [placed, setPlaced] = useState<CloseItUpAnswer>([])
  const wanted = useMemo(() => solve(question), [question])

  useEffect(() => setPlaced(question.candidates.map(() => null)), [question])

  const place = (index: number, bin: 'in' | 'out' | null) => {
    setPlaced((previous) => {
      const next = [...previous]
      next[index] = bin
      return next
    })
  }

  const remaining = placed.filter((bin) => bin === null).length

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Which formulas does the theory contain?
      </p>

      <p className="mt-2 text-xs font-bold uppercase tracking-wider text-ink-soft">
        The structures — universe {'{1,2}'}, one unary predicate
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {WORLD.labels.map((label) => (
          <span key={label} className="tile bg-card-shade px-2.5 py-1 font-logic text-sm font-bold">
            {label}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">The axioms</p>
      <div className="mt-1 flex flex-col gap-1">
        {question.axioms.map((axiom) => (
          <div key={axiom} className="tile bg-coin px-3 py-1.5">
            <FoText text={axiom} className="text-base font-bold" />
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        The theory they generate is everything true in every structure satisfying them.
      </p>

      <div className="mt-3">
        <SortBoard
          bins={BINS}
          tokens={question.candidates.map((candidate) => (
            <FoText key={candidate} text={candidate} className="text-sm font-bold" />
          ))}
          placed={locked ? wanted : placed}
          onPlace={place}
          locked={locked}
          solution={wanted}
          hint="A formula is in the theory when every model of the axioms makes it true."
        />
      </div>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium text-ink-soft">
          Models of the axioms:{' '}
          <span className="font-logic font-bold text-ink">
            {modelsOfQuestion(question)
              .map((index) => WORLD.labels[index])
              .join(', ') || 'none — the axioms are contradictory'}
          </span>
          .
        </Pop>
      )}

      {!locked && (
        <button
          type="button"
          onClick={() => submit(placed)}
          disabled={remaining > 0}
          className="chunky mt-3 min-h-12 w-full bg-coin px-6 text-base font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {remaining > 0 ? `${remaining} still in the tray` : 'Submit'}
        </button>
      )}
    </Card>
  )
}

export const closeItUpGame = defineMinigame<CloseItUpQuestion, CloseItUpAnswer>({
  id: 'theory-tf',
  title: 'Close It Up',
  tagline: 'A theory holds everything its axioms entail — sort the formulas in or out.',
  topics: ['theories'],
  icon: '🧱',
  roundSeconds: 150,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  questionKey: (question) => `${question.axioms.join('∧')}|${question.candidates.join(',')}`,
  explain: (question) => {
    const models = modelsOfQuestion(question)
    return `The axioms hold in ${models.map((index) => WORLD.labels[index]).join(', ') || 'no structure'}, and a formula is in the theory exactly when all of those satisfy it — for instance ${showFormula(parse(question.candidates[0] as string))}.`
  },
  Screen,
  Guide: CloseItUpGuide,
})
