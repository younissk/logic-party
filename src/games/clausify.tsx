/**
 * Clausification — ln.pdf §4.2, the last step of the pipeline.
 *
 * Once the quantifiers are a ∀ prefix, what is left is the propositional CNF
 * transformation of chapter 2 applied to the matrix, and then reading the
 * result as a set of clauses. Three named steps, in an order that is forced:
 * you cannot push a negation through an implication that is still there, and
 * distributing before the negations are inside gets you nowhere.
 *
 * A step taken out of turn does nothing and costs a move. That is the whole
 * game: knowing which one comes next.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  clausesOfMatrix,
  cnfOfMatrix,
  parseFormula,
  removeImplications,
  showFoClauseSet,
  showFormula,
  splitPrenex,
  toNegationNormalForm,
  toPrenex,
  toSkolemNormalForm,
  type FoClause,
  type FoFormula,
  type FoSignature,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoText, FoClauseText } from '@/ui/FoText'
import { MovingItem, MovingList, Pop, ProgressBar } from '@/ui/motion'
import { ClausifyGuide } from './clausify.guide'

export type ClausifyStep = 'implications' | 'negations' | 'distribute'

export const STEP_LABELS: Readonly<Record<ClausifyStep, string>> = {
  implications: 'Remove → and ↔',
  negations: 'Push ¬ down to the atoms',
  distribute: 'Distribute ∨ over ∧',
}

export const STEP_BLURBS: Readonly<Record<ClausifyStep, string>> = {
  implications: 'φ→ψ becomes ¬φ∨ψ; φ↔ψ becomes two implications.',
  negations: 'De Morgan, until every ¬ sits on an atom.',
  distribute: '(φ∧ψ)∨χ becomes (φ∨χ)∧(ψ∨χ).',
}

export interface ClausifyQuestion {
  predicates: Record<string, number>
  functions: Record<string, number>
  /** The matrix, after Skolemization — quantifier-free. */
  matrix: string
  /** How many steps actually change anything. */
  par: number
}

/** The steps taken, in order. */
export type ClausifyAnswer = ClausifyStep[]

const signatureOf = (question: ClausifyQuestion): FoSignature => ({
  predicates: question.predicates,
  functions: question.functions,
})

export const matrixOf = (question: ClausifyQuestion): FoFormula =>
  parseFormula(question.matrix, signatureOf(question))

/** Apply one step. Out of turn it changes nothing, which is the cost. */
export function applyStep(formula: FoFormula, step: ClausifyStep): FoFormula {
  switch (step) {
    case 'implications':
      return removeImplications(formula)
    case 'negations':
      return toNegationNormalForm(formula)
    case 'distribute':
      return cnfOfMatrix(formula)
  }
}

export function drive(
  matrix: FoFormula,
  steps: readonly ClausifyStep[],
): { chain: FoFormula[]; wasted: number } {
  const chain: FoFormula[] = [matrix]
  let wasted = 0
  for (const step of steps) {
    const current = chain[chain.length - 1] as FoFormula
    const next = applyStep(current, step)
    if (showFormula(next) === showFormula(current)) {
      wasted++
      continue
    }
    chain.push(next)
  }
  return { chain, wasted }
}

export const isCnf = (formula: FoFormula): boolean =>
  showFormula(cnfOfMatrix(formula)) === showFormula(formula)

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  predicates: Record<string, number>
  functions: Record<string, number>
  templates: string[]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    predicates: { p: 1, q: 1 },
    functions: { a: 0, f: 1 },
    templates: [
      '∀x:(p(x)→q(x))',
      '∀x:¬(p(x)∧q(x))',
      '∀x:(p(f(x))∨(q(x)∧p(a())))',
      '∀x:¬(p(x)∨q(x))',
    ],
  },
  medium: {
    predicates: { p: 2, q: 1 },
    functions: { a: 0, f: 1 },
    templates: [
      '∀x:∀y:(p(x,y)→(q(x)∧q(y)))',
      '∀x:¬(p(x,x)→q(f(x)))',
      '∀x:∀y:((q(x)∧q(y))∨p(x,y))',
      '∀x:(q(x)↔p(x,a()))',
      '∀x:∀y:¬((p(x,y)∨q(x))∧q(y))',
    ],
  },
  hard: {
    predicates: { p: 2, q: 3 },
    functions: { a: 0, f: 1, g: 2 },
    templates: [
      '∀x:∀y:((p(x,y)∧q(x,y,a()))→(p(y,x)∨q(y,x,f(x))))',
      '∀x:∀y:¬((p(x,y)→q(x,y,a()))∧(q(y,x,f(y))∨p(y,y)))',
      '∀x:∀y:((p(x,y)∨q(x,y,a()))↔p(g(x,y),y))',
      '∀x:∀y:(p(x,y)∨(q(x,y,a())∧(p(y,x)∨q(y,y,f(x)))))',
    ],
  },
}

/** How many of the three steps actually do something, in the right order. */
function parOf(matrix: FoFormula): number {
  let current = matrix
  let count = 0
  for (const step of ['implications', 'negations', 'distribute'] as ClausifyStep[]) {
    const next = applyStep(current, step)
    if (showFormula(next) !== showFormula(current)) {
      count++
      current = next
    }
  }
  return count
}

function generate({ rng, difficulty }: GenerateContext): ClausifyQuestion {
  const profile = PROFILES[difficulty]
  const signature: FoSignature = {
    predicates: profile.predicates,
    functions: profile.functions,
  }

  for (const template of rng.shuffle(profile.templates)) {
    let formula: FoFormula
    try {
      formula = parseFormula(template, signature)
    } catch {
      continue
    }
    const { matrix } = splitPrenex(toPrenex(formula).result)
    const par = parOf(matrix)
    // A matrix already in CNF is not a question.
    if (par === 0) continue
    return {
      predicates: profile.predicates,
      functions: profile.functions,
      matrix: showFormula(matrix),
      par,
    }
  }

  const fallback: FoSignature = { predicates: { p: 1, q: 1 }, functions: { a: 0, f: 1 } }
  const formula = parseFormula('∀x:(p(x)→q(x))', fallback)
  const { matrix } = splitPrenex(toPrenex(formula).result)
  return {
    predicates: { p: 1, q: 1 },
    functions: { a: 0, f: 1 },
    matrix: showFormula(matrix),
    par: parOf(matrix),
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

function solve(question: ClausifyQuestion): ClausifyAnswer {
  const matrix = matrixOf(question)
  const steps: ClausifyStep[] = []
  let current = matrix
  for (const step of ['implications', 'negations', 'distribute'] as ClausifyStep[]) {
    const next = applyStep(current, step)
    if (showFormula(next) === showFormula(current)) continue
    steps.push(step)
    current = next
  }
  return steps
}

function check(question: ClausifyQuestion, answer: ClausifyAnswer): Verdict {
  const matrix = matrixOf(question)
  const { chain, wasted } = drive(matrix, answer)
  const end = chain[chain.length - 1] as FoFormula

  if (!isCnf(end)) {
    return {
      correct: false,
      // Says only that it is not CNF, never which step is missing.
      message: 'Not in CNF yet',
      score: Math.min(1, (chain.length - 1) / Math.max(question.par, 1)) * 0.6,
      detail:
        'CNF is a conjunction of disjunctions of literals. An implication anywhere, a negation above a connective, or a ∧ inside a ∨ all mean there is more to do.',
    }
  }

  const clauses = clausesOfMatrix(end)
  if (wasted === 0) {
    return {
      correct: true,
      message: `${clauses.length} clause${clauses.length === 1 ? '' : 's'}, nothing wasted`,
      detail: `${showFoClauseSet(clauses)} — every variable in them is universally quantified, which is why the prefix could be dropped.`,
    }
  }

  return {
    correct: false,
    message: `${wasted} step${wasted === 1 ? '' : 's'} did nothing`,
    score: Math.max(0.2, question.par / (question.par + wasted)),
    detail:
      'The order is forced: implications first, because a negation cannot be pushed through one; then negations, because distributing before they are down does nothing; then distribute.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const STEPS: ClausifyStep[] = ['implications', 'negations', 'distribute']

function Screen({ question, submit, locked }: MinigameScreenProps<ClausifyQuestion, ClausifyAnswer>) {
  const matrix = useMemo(() => matrixOf(question), [question])
  const [steps, setSteps] = useState<ClausifyStep[]>([])

  useEffect(() => {
    setSteps([])
  }, [question])

  const { chain, wasted } = drive(matrix, steps)
  const current = chain[chain.length - 1] as FoFormula
  const done = isCnf(current)
  const clauses: FoClause[] = done ? clausesOfMatrix(current) : []

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Drive it into clauses
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {chain.length - 1} of {question.par}
          {wasted > 0 && ` · ${wasted} wasted`}
        </p>
      </div>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        The ∀ prefix is already off. A step taken out of turn changes nothing and costs a move.
      </p>

      <MovingList className="mt-2 flex flex-col gap-1">
        {chain.map((formula, index) => (
          <MovingItem
            key={`${index}:${showFormula(formula)}`}
            id={`${index}`}
            disabled
            className={`tile flex w-full items-center gap-2 px-3 py-1.5 text-left
              ${index === chain.length - 1 ? (done ? 'bg-grass text-white' : 'bg-coin') : 'bg-card'}`}
          >
            <span className="w-4 shrink-0 text-[0.6rem] font-bold opacity-60">{index}</span>
            <FoText formula={formula} className="text-base font-bold" />
          </MovingItem>
        ))}
      </MovingList>

      <div className="mt-2">
        <ProgressBar value={Math.min(chain.length - 1, question.par)} total={question.par} />
      </div>

      {done && (
        <Pop className="tile mt-2 bg-card-shade px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Reads as {clauses.length} clause{clauses.length === 1 ? '' : 's'}
          </p>
          <div className="mt-1 flex flex-col gap-0.5">
            {clauses.map((clause, index) => (
              <FoClauseText key={index} clause={clause} className="text-sm font-bold" />
            ))}
          </div>
        </Pop>
      )}

      {!locked && (
        <>
          <div className="mt-3 flex flex-col gap-2">
            {STEPS.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setSteps((previous) => [...previous, step])}
                className="chunky bg-card px-4 py-2 text-left text-ink hover:bg-card-shade
                  focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin"
              >
                <span className="block text-base font-bold">{STEP_LABELS[step]}</span>
                <span className="formula block text-xs font-medium opacity-80">
                  {STEP_BLURBS[step]}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-2 flex gap-2">
            {steps.length > 0 && (
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setSteps((previous) => previous.slice(0, -1))}
              >
                ← Undo
              </Button>
            )}
            <Button
              variant={done && wasted === 0 ? 'coin' : 'secondary'}
              className="flex-1"
              onClick={() => submit(steps)}
            >
              {done ? 'Submit' : 'Submit anyway'}
            </Button>
          </div>
        </>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            The clause set
          </p>
          <p className="formula mt-1 font-bold">
            {showFoClauseSet(clausesOfMatrix(cnfOfMatrix(matrix)))}
          </p>
        </Pop>
      )}
    </Card>
  )
}

/** Shared with the guide, which shows the same three steps on one formula. */
export const pipelineOf = (formula: FoFormula) => toSkolemNormalForm(formula)

export const clausifyGame = defineMinigame<ClausifyQuestion, ClausifyAnswer>({
  id: 'clausify',
  title: 'Down To Clauses',
  tagline: 'Three steps, one order. Out of turn is a wasted move.',
  topics: ['fo-normal-forms'],
  icon: '🪓',
  roundSeconds: 150,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  Screen,
  Guide: ClausifyGuide,
  questionKey: (question) => question.matrix,
})
