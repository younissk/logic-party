/**
 * Skolemization — ln.pdf §4.2, on all three exam papers and Exercise 8.
 *
 * Every ∃ becomes a fresh function symbol applied to the universally quantified
 * variables *to its left*. That list is the whole exercise. Forget one and the
 * Skolem term claims a single witness works for every value of a variable it
 * actually depends on; add one that is not there and the arity is wrong for no
 * reason.
 *
 * So the board asks for the list, one existential at a time, and nothing else:
 * the fresh symbol names itself and the substitution is applied for you.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  parseFormula,
  showFormula,
  skolemize,
  splitPrenex,
  toPrenex,
  type FoFormula,
  type FoSignature,
  type Prefix,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'
import { Pop } from '@/ui/motion'
import { SkolemGuide } from './skolem.guide'

export interface SkolemQuestion {
  predicates: Record<string, number>
  functions: Record<string, number>
  /** A formula already in prenex normal form. */
  source: string
}

/** For each ∃ in the prefix, the variables its Skolem term takes. */
export type SkolemAnswer = string[][]

const signatureOf = (question: SkolemQuestion): FoSignature => ({
  predicates: question.predicates,
  functions: question.functions,
})

export const formulaOf = (question: SkolemQuestion): FoFormula =>
  parseFormula(question.source, signatureOf(question))

/** The prefix, and which of its entries are existential. */
export function existentials(formula: FoFormula): {
  prefix: Prefix[]
  spots: { variable: string; dependsOn: string[] }[]
} {
  const { prefix } = splitPrenex(formula)
  const spots: { variable: string; dependsOn: string[] }[] = []
  const universals: string[] = []
  for (const entry of prefix) {
    if (entry.quantifier === 'forall') {
      universals.push(entry.variable)
      continue
    }
    spots.push({ variable: entry.variable, dependsOn: [...universals] })
  }
  return { prefix, spots }
}

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
    predicates: { p: 1, q: 2 },
    functions: {},
    templates: ['∃x:p(x)', '∀x:∃y:q(x,y)', '∃x:∀y:q(x,y)', '∃x:∃y:q(x,y)'],
  },
  medium: {
    predicates: { p: 2, q: 3 },
    functions: {},
    templates: [
      '∀x:∃y:∀z:q(x,y,z)',
      '∃x:∀y:∃z:q(x,y,z)',
      '∀x:∀y:∃z:q(x,y,z)',
      '∃x:∀y:∀z:q(x,y,z)',
      '∀x:∃y:∃z:q(x,y,z)',
    ],
  },
  hard: {
    predicates: { p: 2, q: 3 },
    functions: { f: 1 },
    templates: [
      '∃x:∀y:∃z:∀w:(q(x,y,z)∧p(w,z))',
      '∀x:∃y:∀z:∃w:(p(x,y)∨q(z,w,y))',
      '∀x:∀y:∃z:∀w:(q(x,y,z)→p(w,f(z)))',
      '∃x:∃y:∀z:∃w:(p(x,z)∧q(y,z,w))',
    ],
  },
}

function generate({ rng, difficulty }: GenerateContext): SkolemQuestion {
  const profile = PROFILES[difficulty]
  const signature: FoSignature = {
    predicates: profile.predicates,
    functions: profile.functions,
  }

  for (const template of rng.shuffle(profile.templates)) {
    let formula: FoFormula
    try {
      formula = toPrenex(parseFormula(template, signature)).result
    } catch {
      continue
    }
    const { spots } = existentials(formula)
    if (spots.length === 0) continue
    return {
      predicates: profile.predicates,
      functions: profile.functions,
      source: showFormula(formula),
    }
  }

  return {
    predicates: { p: 1, q: 2 },
    functions: {},
    source: '∀x:∃y:q(x,y)',
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: SkolemQuestion): SkolemAnswer =>
  existentials(formulaOf(question)).spots.map((spot) => spot.dependsOn)

const sameList = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((name, index) => name === right[index])

function check(question: SkolemQuestion, answer: SkolemAnswer): Verdict {
  const formula = formulaOf(question)
  const { spots } = existentials(formula)

  const wrong = spots.filter(
    (spot, index) => !sameList(spot.dependsOn, [...(answer[index] ?? [])].sort(byPrefix(formula))),
  ).length

  if (wrong === 0) {
    const { result } = skolemize(formula)
    return {
      correct: true,
      message: `${showFormula(result)}`,
      detail:
        'Each Skolem term takes exactly the universally quantified variables to the left of its ∃ — no more, and no fewer.',
    }
  }

  return {
    correct: false,
    // A count, never which arguments belong where.
    message: `${wrong} of ${spots.length} argument list${spots.length === 1 ? '' : 's'} wrong`,
    score: spots.length === 0 ? 0 : (spots.length - wrong) / spots.length,
    detail:
      'Read left along the prefix. Every ∀ you pass is an argument; every ∃ you pass is not, because it has already been replaced. Nothing to the right counts.',
  }
}

/** Sort chosen names into prefix order, so the answer is order-insensitive. */
const byPrefix = (formula: FoFormula) => {
  const order = splitPrenex(formula).prefix.map((entry) => entry.variable)
  return (left: string, right: string) => order.indexOf(left) - order.indexOf(right)
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked }: MinigameScreenProps<SkolemQuestion, SkolemAnswer>) {
  const formula = useMemo(() => formulaOf(question), [question])
  const { prefix, spots } = useMemo(() => existentials(formula), [formula])
  const [chosen, setChosen] = useState<string[][]>([])

  useEffect(() => {
    setChosen(spots.map(() => []))
  }, [question, spots.length])

  const universals = prefix
    .filter((entry) => entry.quantifier === 'forall')
    .map((entry) => entry.variable)

  const toggle = (index: number, name: string) => {
    if (locked) return
    setChosen((previous) =>
      previous.map((entry, at) =>
        at === index
          ? entry.includes(name)
            ? entry.filter((existing) => existing !== name)
            : [...entry, name]
          : entry,
      ),
    )
  }

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        What does each witness depend on?
      </p>

      <div className="tile mt-2 bg-card-shade px-3 py-2">
        <FoText formula={formula} className="text-lg font-bold" />
      </div>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Already in prenex form. Pick the arguments of each Skolem term.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {spots.map((spot, index) => {
          const picked = chosen[index] ?? []
          return (
            <div key={spot.variable}>
              <p className="flex flex-wrap items-baseline gap-2 text-sm font-bold">
                <span className="formula">∃{spot.variable}</span>
                <span className="opacity-60">becomes</span>
                <span className="formula">
                  f{index + 1}(
                  {[...picked].sort(byPrefix(formula)).join(',')})
                </span>
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {universals.length === 0 && (
                  <span className="rounded-xl bg-card-shade px-3 py-1.5 text-xs font-semibold text-ink-soft">
                    No ∀ anywhere — a constant is the only option.
                  </span>
                )}
                {universals.map((name) => (
                  <button
                    key={name}
                    type="button"
                    disabled={locked}
                    onClick={() => toggle(index, name)}
                    className={`chunky formula min-h-10 px-3 text-sm font-bold
                      focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                      ${picked.includes(name) ? 'bg-space-blue text-white' : 'bg-card text-ink hover:bg-card-shade'}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Skolem normal form
          </p>
          <p className="mt-1">
            <FoText formula={skolemize(formula).result} className="text-base font-bold" />
          </p>
          <ul className="mt-2 flex flex-col gap-0.5 text-xs font-semibold text-ink-soft">
            {skolemize(formula).steps.map((step) => (
              <li key={step.variable} className="formula">
                {step.variable} ↦ {showFormula({ kind: 'atom', predicate: '', args: [step.term] }).slice(1, -1)}
                {step.dependsOn.length === 0 ? ' — a constant' : ` — depends on ${step.dependsOn.join(', ')}`}
              </li>
            ))}
          </ul>
        </Pop>
      )}

      {!locked && (
        <Button variant="coin" className="mt-3 w-full" onClick={() => submit(chosen)}>
          Submit
        </Button>
      )}
    </Card>
  )
}

export const skolemGame = defineMinigame<SkolemQuestion, SkolemAnswer>({
  id: 'skolem',
  title: 'Name The Witness',
  tagline: 'Every ∀ to its left is an argument. Nothing else is.',
  topics: ['fo-normal-forms'],
  icon: '✍️',
  roundSeconds: 150,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  Screen,
  Guide: SkolemGuide,
  questionKey: (question) => question.source,
})
