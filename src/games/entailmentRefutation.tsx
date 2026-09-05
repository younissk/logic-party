/**
 * Prove an entailment by refutation — Exercise 2.
 *
 * The move that makes resolution useful: to show Γ ⊨ C, do not try to derive
 * C. Instead **negate the conclusion**, add it to the premises, and refute the
 * lot. Resolution is refutation complete, so if the entailment holds the empty
 * clause is always reachable.
 *
 * So the game has two phases, and the first is the one worth drilling. You are
 * shown the premises and the conclusion, and you have to assemble the right
 * starting set yourself: negating a clause of n literals gives n *unit*
 * clauses, and getting that wrong is where the marks go. Only then does the
 * resolution board open.
 */

import { useEffect, useMemo, useState } from 'react'
import type { Clause, Formula } from '@/logic'
import {
  clauseKey,
  clauses as clausesOf,
  entails,
  format,
  isTautologicalClause,
  parse,
  resolveOn,
  resolvents,
  shortestRefutation,
  showClause,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'
import { FormulaText } from '@/ui/FormulaText'
import { MovingItem, MovingList, Pop, Shakeable, useShake } from '@/ui/motion'
import { EntailmentRefutationGuide } from './entailmentRefutation.guide'

export interface EntailmentQuestion {
  premises: Formula[]
  conclusion: Formula
  /** Clauses of the premises. */
  premiseClauses: Clause[]
  /** The units the negated conclusion contributes. */
  negated: Clause[]
  par: number
}

export interface EntailmentAnswer {
  /** Whether the player assembled the right starting set. */
  setup: Clause[]
  /** The resolution steps taken from it. */
  steps: { left: Clause; right: Clause; pivot: string; resolvent: Clause }[]
}

const SEEDS: Record<Difficulty, [string[], string][]> = {
  easy: [
    [['p → q', '¬q'], '¬p'],
    [['p ∨ q', '¬p'], 'q'],
    [['p → q', 'p'], 'q'],
  ],
  medium: [
    [['p → q', 'q → r'], 'p → r'],
    [['p ∨ q', '¬p ∨ r', '¬q ∨ r'], 'r'],
    [['¬p ∨ q', '¬q ∨ r', 'p'], 'r'],
  ],
  hard: [
    [['p ∨ q', '¬q ∨ r', '¬r ∨ s', '¬p'], 's'],
    [['p → q', 'q → r', 'r → s'], 'p → s'],
    [['p ∨ q ∨ r', '¬p', '¬q'], 'r'],
  ],
}

function generate({ rng, difficulty }: GenerateContext): EntailmentQuestion {
  const seeds = SEEDS[difficulty]

  for (let attempt = 0; attempt < 60; attempt++) {
    const [premiseSources, conclusionSource] = rng.pick(seeds)
    // Rename the variables so the same shape is not the same question twice.
    const pool = rng.shuffle(['a', 'b', 'c', 'd', 's'])
    const rename = (source: string) =>
      source.replace(/[pqrs]/g, (letter) => {
        const index = 'pqrs'.indexOf(letter)
        return (pool[index] ?? letter) as string
      })

    let premises: Formula[]
    let conclusion: Formula
    try {
      premises = premiseSources.map((source) => parse(rename(source)))
      conclusion = parse(rename(conclusionSource))
    } catch {
      continue
    }

    if (!entails(premises, conclusion)) continue

    const premiseClauses = premises.flatMap((premise) => clausesOf(premise))
    const negated = clausesOf(parse(`¬(${format(conclusion)})`)).flatMap((clause) =>
      clause.length === 1 ? [clause] : clause.map((literal) => [literal]),
    )
    const whole = [...premiseClauses, ...negated]
    const refutation = shortestRefutation(whole)
    if (refutation === null || refutation.length === 0) continue

    return { premises, conclusion, premiseClauses, negated, par: refutation.length }
  }

  const premises = [parse('p → q'), parse('¬q')]
  const conclusion = parse('¬p')
  const premiseClauses = premises.flatMap((premise) => clausesOf(premise))
  const negated: Clause[] = [[{ name: 'p', negated: false }]]
  return {
    premises,
    conclusion,
    premiseClauses,
    negated,
    par: shortestRefutation([...premiseClauses, ...negated])?.length ?? 2,
  }
}

const startingSet = (question: EntailmentQuestion): Clause[] => [
  ...question.premiseClauses,
  ...question.negated,
]

function solve(question: EntailmentQuestion): EntailmentAnswer {
  return {
    setup: startingSet(question),
    steps: (shortestRefutation(startingSet(question)) ?? []).map((step) => ({
      left: step.left,
      right: step.right,
      pivot: step.pivot,
      resolvent: step.resolvent,
    })),
  }
}

function check(question: EntailmentQuestion, answer: EntailmentAnswer): Verdict {
  const wanted = new Set(startingSet(question).map(clauseKey))
  const given = new Set(answer.setup.map(clauseKey))
  if (wanted.size !== given.size || [...wanted].some((key) => !given.has(key))) {
    return {
      correct: false,
      message: 'That is not the right starting set',
      detail: `Premises as clauses, plus the *negated* conclusion: ${question.negated
        .map(showClause)
        .join(' ')}. Negating a clause of n literals gives n separate units.`,
    }
  }

  const available = answer.setup.map(clauseKey)
  for (const step of answer.steps) {
    if (!available.includes(clauseKey(step.left)) || !available.includes(clauseKey(step.right))) {
      return { correct: false, message: 'A step used a clause that was not there yet' }
    }
    const resolvent = resolveOn(step.left, step.right, step.pivot)
    if (resolvent === null || clauseKey(resolvent) !== clauseKey(step.resolvent)) {
      return { correct: false, message: 'That is not a legal resolution step' }
    }
    available.push(clauseKey(step.resolvent))
  }

  if (!available.includes('')) {
    return { correct: false, message: 'The empty clause was not reached' }
  }

  return {
    correct: true,
    message: `Entailment proved in ${answer.steps.length}`,
    score: Math.min(1, question.par / Math.max(answer.steps.length, 1)),
    detail: `Premises plus ¬conclusion is unsatisfiable, so no assignment satisfies the premises and falsifies the conclusion — which is exactly ⊨.`,
  }
}

// ---------------------------------------------------------------------------

interface Entry {
  clause: Clause
  step: { left: Clause; right: Clause; pivot: string; resolvent: Clause } | null
}

function Screen({ question, submit, locked, solution }: MinigameScreenProps<EntailmentQuestion, EntailmentAnswer>) {
  const [phase, setPhase] = useState<'setup' | 'resolve'>('setup')
  const [picked, setPicked] = useState<Clause[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [pivots, setPivots] = useState<{ a: number; b: number; options: string[] } | null>(null)
  const [shaking, shake] = useShake()

  useEffect(() => {
    setPhase('setup')
    setPicked([])
    setEntries([])
    setSelected(null)
    setPivots(null)
  }, [question])

  /** What you may add: the premise clauses, plus units from ¬conclusion, plus
   *  the tempting wrong ones — the un-negated conclusion. */
  const options = useMemo(() => {
    const conclusionClauses = clausesOf(question.conclusion)
    const decoys = conclusionClauses.filter(
      (clause) => !question.negated.some((entry) => clauseKey(entry) === clauseKey(clause)),
    )
    const all = [...question.premiseClauses, ...question.negated, ...decoys].filter(
      (clause) => !isTautologicalClause(clause),
    )
    const seen = new Set<string>()
    return all.filter((clause) => {
      const key = clauseKey(clause)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [question])

  const wanted = new Set(startingSet(question).map(clauseKey))
  const setupRight =
    picked.length === wanted.size && picked.every((clause) => wanted.has(clauseKey(clause)))

  const reachedEmpty = entries.some((entry) => entry.clause.length === 0)

  const addResolvent = (a: number, b: number, pivot: string) => {
    const left = (entries[a] as Entry).clause
    const right = (entries[b] as Entry).clause
    const resolvent = resolveOn(left, right, pivot)
    if (resolvent === null) return
    setEntries((previous) =>
      previous.some((entry) => clauseKey(entry.clause) === clauseKey(resolvent))
        ? previous
        : [...previous, { clause: resolvent, step: { left, right, pivot, resolvent } }],
    )
  }

  const pick = (index: number) => {
    if (locked || reachedEmpty || pivots !== null) return
    if (selected === null) return setSelected(index)
    if (selected === index) return setSelected(null)

    const found = resolvents((entries[selected] as Entry).clause, (entries[index] as Entry).clause)
    setSelected(null)
    if (found.length === 0) return shake()
    if (found.length === 1) return addResolvent(selected, index, (found[0] as { pivot: string }).pivot)
    setPivots({ a: selected, b: index, options: found.map((option) => option.pivot) })
  }

  if (phase === 'setup' && !locked) {
    return (
      <Card>
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Set up the refutation
        </p>

        <div className="mt-2 rounded-xl bg-card-shade px-3 py-2 text-center">
          <p className="text-base font-bold">
            {question.premises.map((premise, index) => (
              <span key={index}>
                {index > 0 && <span className="text-ink-soft">, </span>}
                <FormulaText formula={premise} />
              </span>
            ))}
            <span className="formula mx-2 text-ink-soft">⊨</span>
            <FormulaText formula={question.conclusion} />
          </p>
        </div>

        <p className="mt-2 text-xs font-medium text-ink-soft">
          To prove it, refute the premises together with the <strong>negation</strong> of the
          conclusion. Pick every clause that belongs in the starting set.
        </p>

        <Shakeable shaking={shaking}>
          <div className="mt-2 flex flex-col gap-1.5">
            {options.map((clause, index) => {
              const on = picked.some((entry) => clauseKey(entry) === clauseKey(clause))
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() =>
                    setPicked((previous) =>
                      on
                        ? previous.filter((entry) => clauseKey(entry) !== clauseKey(clause))
                        : [...previous, clause],
                    )
                  }
                  className={`tile flex items-center gap-2 px-3 py-2 text-left ${on ? 'bg-space-blue text-white' : 'bg-card'}`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-3 border-ink text-sm font-bold
                      ${on ? 'bg-white text-ink' : 'bg-white/60'}`}
                    aria-hidden
                  >
                    {on ? '✓' : ''}
                  </span>
                  <ClauseText clause={clause} className={`text-base font-bold ${on ? 'text-white' : ''}`} />
                </button>
              )
            })}
          </div>
        </Shakeable>

        <Button
          variant="coin"
          className="mt-3 w-full"
          onClick={() => {
            if (!setupRight) {
              shake()
              return
            }
            setEntries(picked.map((clause) => ({ clause, step: null })))
            setPhase('resolve')
          }}
        >
          {picked.length === 0 ? 'Pick the starting clauses' : 'Start resolving'}
        </Button>
      </Card>
    )
  }

  const shownSteps = entries
    .filter((entry): entry is Entry & { step: NonNullable<Entry['step']> } => entry.step !== null)
    .map((entry) => entry.step)

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Refute it
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {shownSteps.length} step{shownSteps.length === 1 ? '' : 's'} · par {question.par}
        </p>
      </div>

      <p className="mt-1 text-xs font-medium text-ink-soft">
        Premises plus ¬conclusion. Reach □ and the entailment is proved.
      </p>

      <Shakeable shaking={shaking}>
        <MovingList className="mt-2 flex flex-col gap-1.5">
          {entries.map((entry, index) => (
            <MovingItem
              key={`${index}:${clauseKey(entry.clause)}`}
              id={`${index}:${clauseKey(entry.clause)}`}
              disabled={locked || reachedEmpty || entry.clause.length === 0}
              onClick={() => pick(index)}
              className={`tile flex w-full items-center gap-2 px-3 py-2 text-left
                ${entry.clause.length === 0 ? 'bg-coin' : selected === index ? 'bg-space-blue text-white' : 'bg-card'}`}
            >
              <span className="w-5 shrink-0 text-xs font-bold opacity-60">{index + 1}</span>
              <ClauseText
                clause={entry.clause}
                className={`text-base font-bold ${selected === index ? 'text-white' : ''}`}
              />
              {entry.step !== null && (
                <span className="ml-auto text-xs font-semibold opacity-70">on {entry.step.pivot}</span>
              )}
            </MovingItem>
          ))}
        </MovingList>
      </Shakeable>

      {pivots !== null && (
        <Pop className="tile mt-3 bg-coin p-3">
          <p className="text-sm font-bold">Two clashes. One pivot per step.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pivots.options.map((pivot) => (
              <Button
                key={pivot}
                variant="secondary"
                onClick={() => {
                  addResolvent(pivots.a, pivots.b, pivot)
                  setPivots(null)
                }}
              >
                {pivot}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setPivots(null)}>
              Cancel
            </Button>
          </div>
        </Pop>
      )}

      {!locked && (
        <Button
          variant="coin"
          className="mt-3 w-full"
          disabled={!reachedEmpty}
          onClick={() => submit({ setup: picked, steps: shownSteps })}
        >
          {reachedEmpty ? 'Entailment proved' : 'Keep going until □'}
        </Button>
      )}

      {locked && solution !== null && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Negating the conclusion gave
          </p>
          <p className="formula mt-1 font-bold">{question.negated.map(showClause).join(' ')}</p>
        </Pop>
      )}
    </Card>
  )
}

export const entailmentRefutationGame = defineMinigame<EntailmentQuestion, EntailmentAnswer>({
  id: 'entailment-refutation',
  title: 'Prove It Wrong',
  tagline: 'Negate the conclusion, then refute everything.',
  topics: ['entailment', 'resolution'],
  icon: '⚖️',
  roundSeconds: 240,
  sprintQuestions: 5,
  generate,
  check,
  solve,
  Screen,
  Guide: EntailmentRefutationGuide,
  questionKey: (question) =>
    `${question.premises.map((premise) => format(premise)).join(',')}⊨${format(question.conclusion)}`,
})
