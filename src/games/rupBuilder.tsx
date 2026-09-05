/**
 * RUP proof — build the sequence to ⊥. exam26a and exam26bA Q1.3, Exercise 3.
 *
 * The checkbox version asks whether a clause has the property. This one makes
 * you *write the proof*: build a line out of literal chips, watch propagation
 * run on it live, and add it if it crashes. Each line you add makes the next
 * easier, and the last line is always ⊥.
 *
 * The live BCP readout under the builder is the point. You are not guessing
 * whether a line works — you can see the units your negation added and what
 * they propagated to, which is exactly the check Algorithm 2.50 performs.
 */

import { useEffect, useMemo, useState } from 'react'
import type { Clause, Literal } from '@/logic'
import {
  bcp,
  clauseKey,
  clauseSetToFormula,
  findRupProof,
  hasRupProperty,
  isSatisfiable,
  isTautologicalClause,
  negateClause,
  normaliseClause,
  showClause,
  showClauseSet,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'
import { MovingItem, MovingList, Pop, ProgressBar, Shakeable, useShake } from '@/ui/motion'
import { RupBuilderGuide } from './rupBuilder.guide'

export interface RupBuilderQuestion {
  clauses: Clause[]
  /** Lines in a reference proof — the par to match. */
  par: number
  /** Both polarities of every variable, for the chip palette. */
  palette: Literal[]
}

/** The proof: the lines added, in order. The last must be ⊥. */
export type RupBuilderAnswer = Clause[]

const literalKey = (literal: Literal) => `${literal.negated ? '¬' : ''}${literal.name}`

interface Profile {
  variables: string[]
  clauses: [min: number, max: number]
  width: [min: number, max: number]
  par: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['a', 'b'], clauses: [3, 4], width: [1, 2], par: [2, 2] },
  medium: { variables: ['a', 'b', 'c'], clauses: [4, 5], width: [2, 3], par: [2, 3] },
  hard: { variables: ['a', 'b', 'c', 'd'], clauses: [5, 6], width: [2, 3], par: [2, 4] },
}

const ATTEMPTS = 400

function generate({ rng, difficulty }: GenerateContext): RupBuilderQuestion {
  const profile = PROFILES[difficulty]

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const count = rng.range(...profile.clauses)
    const clauses: Clause[] = []
    for (let index = 0; index < count; index++) {
      const width = Math.min(rng.range(...profile.width), profile.variables.length)
      const clause = normaliseClause(
        rng.sample(profile.variables, width).map((name) => ({ name, negated: rng.bool() })),
      )
      if (isTautologicalClause(clause)) break
      if (clauses.some((existing) => clauseKey(existing) === clauseKey(clause))) break
      clauses.push(clause)
    }
    if (clauses.length !== count) continue

    // Cheap check before the proof search: most random sets are satisfiable
    // and a RUP refutation only exists for the ones that are not.
    if (isSatisfiable(clauseSetToFormula(clauses))) continue

    const proof = findRupProof(clauses)
    if (proof === null) continue
    if (proof.length < profile.par[0] || proof.length > profile.par[1]) continue
    // A proof of one line means BCP already crashes, and there is nothing to
    // build.
    if (proof.length < 2) continue

    return {
      clauses,
      par: proof.length,
      palette: profile.variables.flatMap((name) => [
        { name, negated: false },
        { name, negated: true },
      ]),
    }
  }

  // Last resort, so a round can never stall: the exam's own question.
  const named: [string, boolean][][] = [
    [['a', true], ['b', false]],
    [['a', true], ['b', true]],
    [['a', false], ['c', true]],
    [['a', false], ['c', false]],
  ]
  const clauses = named.map((clause) => clause.map(([name, negated]) => ({ name, negated })))
  return {
    clauses,
    par: findRupProof(clauses)?.length ?? 2,
    palette: ['a', 'b', 'c'].flatMap((name) => [
      { name, negated: false },
      { name, negated: true },
    ]),
  }
}

const solve = (question: RupBuilderQuestion): RupBuilderAnswer => findRupProof(question.clauses) ?? []

function check(question: RupBuilderQuestion, answer: RupBuilderAnswer): Verdict {
  // Replay it: `check` has to be right on any input, not only on what the
  // builder allows through.
  const current = question.clauses.map((clause) => normaliseClause(clause))
  for (let index = 0; index < answer.length; index++) {
    const line = answer[index] as Clause
    if (!hasRupProperty(current, line)) {
      return {
        correct: false,
        message: `Line ${index + 1} does not have the property`,
        detail: `Assuming ${showClause(line)} false adds ${showClauseSet(
          negateClause(line),
        )}, and propagation survives it.`,
      }
    }
    current.push(normaliseClause(line))
  }

  const last = answer[answer.length - 1]
  if (last === undefined || last.length !== 0) {
    return { correct: false, message: 'A refutation has to end in ⊥' }
  }

  return {
    correct: true,
    message: answer.length <= question.par ? `⊥ in ${answer.length} lines` : `⊥ in ${answer.length}, par ${question.par}`,
    score: Math.min(1, question.par / Math.max(answer.length, 1)),
    detail: `Every line was already implied, so adding it could not change satisfiability — and the last one says plain propagation is now enough.`,
  }
}

// ---------------------------------------------------------------------------

function Screen({ question, submit, locked, solution }: MinigameScreenProps<RupBuilderQuestion, RupBuilderAnswer>) {
  const [proof, setProof] = useState<Clause[]>([])
  const [draft, setDraft] = useState<Literal[]>([])
  const [shaking, shake] = useShake()

  useEffect(() => {
    setProof([])
    setDraft([])
  }, [question])

  const current = useMemo(() => [...question.clauses, ...proof], [question, proof])

  // The live check, which is the whole point: negate the draft, add the units,
  // propagate, and show what survived.
  const preview = useMemo(() => bcp([...current, ...negateClause(draft)]), [current, draft])
  const draftWorks = preview.outcome === 'unsatisfiable'
  const emptyWorks = useMemo(() => bcp(current).outcome === 'unsatisfiable', [current])

  const toggle = (literal: Literal) => {
    if (locked) return
    setDraft((previous) =>
      previous.some((entry) => literalKey(entry) === literalKey(literal))
        ? previous.filter((entry) => literalKey(entry) !== literalKey(literal))
        : [...previous, literal],
    )
  }

  const addLine = () => {
    if (!draftWorks || draft.length === 0) {
      shake()
      return
    }
    setProof((previous) => [...previous, normaliseClause(draft)])
    setDraft([])
  }

  const finish = () => {
    if (!emptyWorks) {
      shake()
      return
    }
    submit([...proof, []])
  }

  const shownProof = locked ? (solution ?? proof) : proof

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Build the refutation
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {shownProof.length} line{shownProof.length === 1 ? '' : 's'} · par {question.par}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-card-shade px-3 py-2">
        {question.clauses.map((clause, index) => (
          <ClauseText key={index} clause={clause} className="text-sm font-bold" />
        ))}
      </div>

      {shownProof.length > 0 && (
        <MovingList className="mt-2 flex flex-col gap-1.5">
          {shownProof.map((line, index) => (
            <MovingItem
              key={`${index}:${clauseKey(line)}`}
              id={`${index}:${clauseKey(line)}`}
              disabled
              className="tile flex w-full items-center gap-2 bg-grass px-3 py-1.5 text-left text-white"
            >
              <span className="w-5 shrink-0 text-xs font-bold opacity-80">{index + 1}</span>
              <ClauseText clause={line} className="text-base font-bold" />
              <span className="ml-auto text-xs font-bold opacity-80">added</span>
            </MovingItem>
          ))}
        </MovingList>
      )}

      {!locked && (
        <>
          <Shakeable shaking={shaking}>
            <div className="tile mt-3 bg-coin p-3">
              <p className="text-xs font-bold uppercase tracking-wider">Next line</p>
              <div className="mt-1.5 flex min-h-11 flex-wrap items-center gap-1.5">
                <span className="formula text-lg font-bold">(</span>
                {draft.length === 0 && (
                  <span className="text-sm font-semibold opacity-70">tap literals below</span>
                )}
                {draft.map((literal, index) => (
                  <span key={literalKey(literal)} className="flex items-center gap-1.5">
                    {index > 0 && <span className="formula font-bold">∨</span>}
                    <button
                      type="button"
                      onClick={() => toggle(literal)}
                      className="chunky formula h-9 bg-space-blue px-2.5 text-sm font-bold text-white"
                    >
                      {literalKey(literal)}
                    </button>
                  </span>
                ))}
                <span className="formula text-lg font-bold">)</span>
              </div>

              <div className="mt-2 rounded-xl bg-white/60 px-2 py-1.5 text-xs font-semibold">
                <p>
                  Assume it false → add{' '}
                  <span className="formula font-bold">
                    {draft.length === 0 ? 'nothing' : showClauseSet(negateClause(normaliseClause(draft)))}
                  </span>
                </p>
                <p className="mt-0.5">
                  Propagates to{' '}
                  <span className={`formula font-bold ${draftWorks ? 'text-grass-deep' : 'text-space-red'}`}>
                    {draftWorks ? '⊥ — it can be added' : showClauseSet(preview.result)}
                  </span>
                </p>
              </div>
            </div>
          </Shakeable>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {question.palette.map((literal) => (
              <button
                key={literalKey(literal)}
                type="button"
                onClick={() => toggle(literal)}
                className={`chunky formula h-10 px-3 text-base font-bold
                  ${draft.some((entry) => literalKey(entry) === literalKey(literal))
                    ? 'bg-space-blue text-white'
                    : 'bg-card text-ink hover:bg-card-shade'}`}
              >
                {literalKey(literal)}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <ProgressBar value={proof.length} total={question.par} />
          </div>

          <div className="mt-2 flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={draft.length === 0} onClick={addLine}>
              Add this line
            </Button>
            <Button variant="coin" className="flex-1" onClick={finish}>
              {emptyWorks ? 'Finish with ⊥' : 'Not yet ⊥'}
            </Button>
          </div>
        </>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">A reference proof</p>
          <p className="formula mt-1 font-bold">
            {(findRupProof(question.clauses) ?? []).map((line) => showClause(line)).join(', ')}
          </p>
        </Pop>
      )}
    </Card>
  )
}

export const rupBuilderGame = defineMinigame<RupBuilderQuestion, RupBuilderAnswer>({
  id: 'rup-builder',
  title: 'Write the Proof',
  tagline: 'Add lines until plain propagation reaches ⊥.',
  topics: ['proof-systems'],
  icon: '✍️',
  roundSeconds: 240,
  sprintQuestions: 5,
  generate,
  check,
  solve,
  Screen,
  Guide: RupBuilderGuide,
  questionKey: (question) => question.clauses.map(clauseKey).join(';'),
})
