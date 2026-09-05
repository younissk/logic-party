/**
 * Prenex normal form — ln.pdf §4.2, Algorithm 4.12 and Figure 4.1.
 *
 * Pull every quantifier to the front by swapping subformulas for equivalent
 * ones. The algorithm does not say *which* subformula to take, and that freedom
 * is the point: Example 4.14 works the same formula two ways and gets two
 * different prefixes, both correct, and the choice changes the arity of the
 * Skolem functions later.
 *
 * So the board offers every applicable equivalence and lets you choose. The one
 * thing it will not let you do is skip the cleaning step — the notes show
 * `∀x:p(x)∨∀x:q(x)` getting stuck, and the formula arrives already clean.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  clean,
  isClean,
  isPrenex,
  parseFormula,
  pnfOptions,
  showFormula,
  splitPrenex,
  toPrenex,
  PNF_RULE_LABELS,
  type FoFormula,
  type FoSignature,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'
import { MovingItem, MovingList, Pop, ProgressBar } from '@/ui/motion'
import { PrenexGuide } from './prenex.guide'

export interface PrenexQuestion {
  predicates: Record<string, number>
  functions: Record<string, number>
  /** Already cleaned, so the run cannot get stuck. */
  source: string
  /** The fewest steps that reach a prenex form. */
  par: number
}

/** The moves taken, each an index into the options offered at the time. */
export type PrenexAnswer = number[]

const signatureOf = (question: PrenexQuestion): FoSignature => ({
  predicates: question.predicates,
  functions: question.functions,
})

export const formulaOf = (question: PrenexQuestion): FoFormula =>
  parseFormula(question.source, signatureOf(question))

/** Replay a list of choices, refusing any that is no longer on offer. */
export function replayPrenex(
  start: FoFormula,
  moves: readonly number[],
): { chain: FoFormula[]; broken: boolean } {
  const chain: FoFormula[] = [start]
  for (const move of moves) {
    const current = chain[chain.length - 1] as FoFormula
    const option = pnfOptions(current)[move]
    if (option === undefined) return { chain, broken: true }
    chain.push(option.result)
  }
  return { chain, broken: false }
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  predicates: Record<string, number>
  functions: Record<string, number>
  templates: string[]
  par: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    predicates: { p: 1, q: 1, r: 2 },
    functions: { a: 0 },
    templates: [
      '¬∀x:p(x)',
      '(∀x:p(x))∨q(a())',
      'q(a())∧(∃x:p(x))',
      '(∃x:p(x))→q(a())',
      '¬∃x:(p(x)∧q(x))',
    ],
    par: [1, 2],
  },
  medium: {
    predicates: { p: 1, q: 1, r: 2 },
    functions: { a: 0, f: 1 },
    templates: [
      '(∀x:p(x))→(∃y:q(y))',
      '¬(∀x:(p(x)→∃y:r(x,y)))',
      '(∃x:p(x))∧(∀y:q(f(y)))',
      '(∀x:p(x))↔q(a())',
      '¬((∃x:p(x))∨(∀y:q(y)))',
    ],
    par: [2, 4],
  },
  hard: {
    predicates: { p: 2, q: 3, r: 1 },
    functions: { a: 0, f: 1 },
    templates: [
      '∀x:∃y:((∃z:(p(x,z)∨p(y,z)))→¬∀w:¬q(x,y,w))',
      '((∀x:r(x))→(∃y:r(f(y))))∧(∃z:r(z))',
      '¬∃x:((∀y:p(x,y))∧(∃z:q(x,y,z)))',
      '(∀x:∃y:p(x,y))→(∃z:r(z))',
      '¬(∀x:(r(x)→∃y:∀z:q(x,y,z)))',
    ],
    par: [3, 6],
  },
}

function generate({ rng, difficulty }: GenerateContext): PrenexQuestion {
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
    // The board never asks you to clean, so the question arrives clean.
    const cleaned = isClean(formula) ? formula : clean(formula)
    if (isPrenex(cleaned)) continue
    const par = toPrenex(cleaned).steps.length
    if (par < profile.par[0] || par > profile.par[1]) continue

    return {
      predicates: profile.predicates,
      functions: profile.functions,
      source: showFormula(cleaned),
      par,
    }
  }

  const fallback: FoSignature = { predicates: { p: 1, q: 1 }, functions: { a: 0 } }
  const formula = parseFormula('(∀x:p(x))→q(a())', fallback)
  return {
    predicates: { p: 1, q: 1 },
    functions: { a: 0 },
    source: showFormula(formula),
    par: toPrenex(formula).steps.length,
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

/** The run Algorithm 4.12 takes when it always picks the outermost option. */
function solve(question: PrenexQuestion): PrenexAnswer {
  const moves: number[] = []
  let current = formulaOf(question)
  for (let guard = 0; guard < 40; guard++) {
    const options = pnfOptions(current)
    if (options.length === 0) break
    moves.push(0)
    current = (options[0] as { result: FoFormula }).result
  }
  return moves
}

function check(question: PrenexQuestion, answer: PrenexAnswer): Verdict {
  const start = formulaOf(question)
  const { chain, broken } = replayPrenex(start, answer)

  if (broken) {
    return {
      correct: false,
      message: 'That step is not available',
      detail: 'Every step replaces a subformula with the right-hand side of one of the equivalences.',
    }
  }

  const end = chain[chain.length - 1] as FoFormula
  if (!isPrenex(end)) {
    return {
      correct: false,
      // Says how far, never which rule is next.
      message: 'Not in prenex form yet',
      score: Math.min(1, (chain.length - 1) / Math.max(question.par, 1)) * 0.7,
      detail:
        'A formula is in PNF when every quantifier is in front and nothing but connectives and atoms follows. A connective sitting above a quantifier is what to look for.',
    }
  }

  const { prefix } = splitPrenex(end)
  const steps = chain.length - 1
  return {
    correct: true,
    message: `${prefix.map((entry) => (entry.quantifier === 'forall' ? '∀' : '∃')).join('')}${
      steps === question.par ? ` in ${steps} — the shortest` : ` in ${steps}`
    }`,
    detail:
      steps === question.par
        ? 'Every step used one of the equivalences of Figure 4.1, and the prefix is what your choices made it.'
        : `${question.par} steps is the shortest route. Yours is a prenex form too — and a different order of choices can give a different prefix.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked }: MinigameScreenProps<PrenexQuestion, PrenexAnswer>) {
  const start = useMemo(() => formulaOf(question), [question])
  const [moves, setMoves] = useState<number[]>([])

  useEffect(() => {
    setMoves([])
  }, [question])

  const { chain } = replayPrenex(start, moves)
  const current = chain[chain.length - 1] as FoFormula
  const options = locked ? [] : pnfOptions(current)
  const done = isPrenex(current)

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Pull the quantifiers out
        </p>
        <p className="text-xs font-bold text-ink-soft">{chain.length - 1} steps</p>
      </div>

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

      {!locked && (
        <>
          {done ? (
            <p className="mt-3 rounded-xl bg-grass px-3 py-2 text-sm font-bold text-white">
              Every quantifier is in front — this is a prenex normal form.
            </p>
          ) : (
            <>
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
                {options.length} equivalence{options.length === 1 ? '' : 's'} applies
              </p>
              <div className="mt-1 flex max-h-72 flex-col gap-1 overflow-y-auto">
                {options.map((option, index) => (
                  <button
                    key={`${index}:${showFormula(option.result)}`}
                    type="button"
                    onClick={() => setMoves((previous) => [...previous, index])}
                    className="tile flex w-full flex-col items-start gap-0.5 bg-card px-3 py-1.5 text-left hover:bg-card-shade
                      focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin"
                  >
                    <FoText formula={option.result} className="text-sm font-bold" />
                    <span className="formula text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
                      {PNF_RULE_LABELS[option.rule]}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="mt-2 flex gap-2">
            {moves.length > 0 && (
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setMoves((previous) => previous.slice(0, -1))}
              >
                ← Undo
              </Button>
            )}
            <Button
              variant={done ? 'coin' : 'secondary'}
              className="flex-1"
              onClick={() => submit(moves)}
            >
              {done ? 'Submit' : 'Submit anyway'}
            </Button>
          </div>
        </>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            One prenex form, in {question.par} steps
          </p>
          <p className="mt-1">
            <FoText formula={toPrenex(start).result} className="text-base font-bold" />
          </p>
          <p className="mt-1 text-ink-soft">
            Not the only one — a different order of choices gives a different prefix, and all of them
            are equivalent to the formula you started with.
          </p>
        </Pop>
      )}
    </Card>
  )
}

export const prenexGame = defineMinigame<PrenexQuestion, PrenexAnswer>({
  id: 'prenex',
  title: 'Pull Them Out',
  tagline: 'Every quantifier to the front — and the order is yours to choose.',
  topics: ['fo-normal-forms'],
  icon: '🪜',
  roundSeconds: 210,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: PrenexGuide,
  questionKey: (question) => question.source,
})
