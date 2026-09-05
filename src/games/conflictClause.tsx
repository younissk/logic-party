/**
 * Refutation matching a given DPLL tree — ln.pdf §2.4, exam25a Q1.2.
 *
 * The hybrid, and the deepest idea in the chapter: a decision tree turned
 * upside down *is* a resolution refutation. Search and proof are the same
 * object.
 *
 * So you do the whole conversion rather than one instance of it. Every leaf
 * needs its conflict clause — the input clause every literal of which is false
 * under that path — and once they are all in, the tree folds into the
 * refutation in front of you, cancelling each variable in the reverse of the
 * order it was assigned.
 *
 * Tapping a clause evaluates it against the current leaf's assignment, literal
 * by literal, so this is reading rather than guessing: a clause with one true
 * literal is still satisfied, and you can see which one.
 */

import { useEffect, useMemo, useState } from 'react'
import type { Clause, DpllLeaf } from '@/logic'
import {
  clauseKey,
  clauseSetToFormula,
  isSatisfiable,
  countLeaves,
  dpll,
  isTautologicalClause,
  isUnsatisfiableTree,
  leaves,
  normaliseClause,
  showClause,
  treeToRefutation,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'
import { DecisionTree } from '@/ui/DecisionTree'
import { Pop } from '@/ui/motion'
import { ConflictClauseGuide } from './conflictClause.guide'

export interface ConflictQuestion {
  clauses: Clause[]
  /** One entry per leaf, left to right: the index of the clause false there. */
  answers: number[]
}

/** One clause index per leaf; null while a leaf is unanswered. */
export type ConflictAnswer = (number | null)[]

interface Profile {
  variables: string[]
  clauses: [min: number, max: number]
  width: [min: number, max: number]
  leaves: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['x', 'y'], clauses: [3, 4], width: [1, 2], leaves: [2, 3] },
  medium: { variables: ['x', 'y', 'z'], clauses: [4, 6], width: [2, 3], leaves: [2, 4] },
  hard: { variables: ['x', 'y', 'z'], clauses: [5, 7], width: [2, 3], leaves: [3, 6] },
}

const ATTEMPTS = 400

/** Clauses of the set that are false under this leaf's path. */
function falsifiedAt(clauses: readonly Clause[], leaf: DpllLeaf): number[] {
  const assigned = new Map(leaf.path.map((literal) => [literal.name, !literal.negated]))
  return clauses
    .map((clause, index) => ({ clause, index }))
    .filter(({ clause }) =>
      clause.every((literal) => {
        const value = assigned.get(literal.name)
        return value !== undefined && value === literal.negated
      }),
    )
    .map(({ index }) => index)
}

function generate({ rng, difficulty }: GenerateContext): ConflictQuestion {
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

    // Cheap check first: building the whole decision tree to discover the
    // formula was satisfiable is the expensive way to find that out, and most
    // random clause sets are.
    if (isSatisfiable(clauseSetToFormula(clauses))) continue

    const tree = dpll(clauses)
    if (!isUnsatisfiableTree(tree)) continue
    const total = countLeaves(tree)
    if (total < profile.leaves[0] || total > profile.leaves[1]) continue
    if (treeToRefutation(tree) === null) continue

    // Every leaf must have exactly one falsified clause: with two, both are
    // right and there is nothing single to mark.
    const perLeaf = leaves(tree).map((leaf) => falsifiedAt(clauses, leaf))
    if (perLeaf.some((found) => found.length !== 1)) continue

    return { clauses, answers: perLeaf.map((found) => found[0] as number) }
  }

  // Last resort, so a round can never stall: the notes' own formula.
  const named: [string, boolean][][] = [
    [['a', false], ['b', false], ['c', false]],
    [['a', false], ['b', true], ['c', false]],
    [['a', false], ['b', false], ['c', true]],
    [['a', false], ['b', true], ['c', true]],
    [['a', true], ['c', false]],
    [['a', true], ['c', true]],
  ]
  const clauses = named.map((clause) => clause.map(([name, negated]) => ({ name, negated })))
  return {
    clauses,
    answers: leaves(dpll(clauses)).map((leaf) => falsifiedAt(clauses, leaf)[0] ?? 0),
  }
}

const solve = (question: ConflictQuestion): ConflictAnswer => [...question.answers]

function check(question: ConflictQuestion, answer: ConflictAnswer): Verdict {
  const tree = dpll(question.clauses)
  const found = leaves(tree)

  const wrong = question.answers
    .map((expected, index) => ({ expected, index }))
    .filter(({ expected, index }) => answer[index] !== expected)

  if (wrong.length === 0) {
    const mirror = treeToRefutation(tree)
    return {
      correct: true,
      message: `All ${question.answers.length} leaves read`,
      detail: `Upside down, that is a ${mirror?.steps.length ?? 0}-step resolution refutation, cancelling ${[
        ...new Set((mirror?.steps ?? []).map((step) => step.pivot)),
      ].join(', ')} — the reverse of the order they were assigned.`,
    }
  }

  const first = wrong[0] as { expected: number; index: number }
  const leaf = found[first.index] as DpllLeaf
  return {
    correct: false,
    score: (question.answers.length - wrong.length) / question.answers.length,
    // Names the leaf, never the clause: sprint shows this before the retry.
    message:
      wrong.length === 1 ? 'One leaf is wrong' : `${wrong.length} of ${question.answers.length} leaves are wrong`,
    detail: `Under ${leaf.path
      .map((literal) => `${literal.name} = ${literal.negated ? 'F' : 'T'}`)
      .join(', ')}, the falsified clause is ${showClause(
      question.clauses[first.expected] as Clause,
    )} — every one of its literals is false there. A clause with even one true literal is still satisfied.`,
  }
}

function Screen({ question, submit, locked, solution }: MinigameScreenProps<ConflictQuestion, ConflictAnswer>) {
  const [picked, setPicked] = useState<ConflictAnswer>(() => question.answers.map(() => null))
  const [leaf, setLeaf] = useState(0)

  useEffect(() => {
    setPicked(question.answers.map(() => null))
    setLeaf(0)
  }, [question])

  const tree = useMemo(() => dpll(question.clauses), [question])
  const all = useMemo(() => leaves(tree), [tree])
  const current = all[leaf] as DpllLeaf | undefined
  const assigned = useMemo(
    () => new Map((current?.path ?? []).map((literal) => [literal.name, !literal.negated])),
    [current],
  )

  const shown = locked ? (solution ?? picked) : picked
  const remaining = shown.filter((entry) => entry === null).length

  const choose = (index: number) => {
    if (locked) return
    setPicked((previous) => previous.map((entry, i) => (i === leaf ? index : entry)))
    // Move on to the next unanswered leaf, so the whole conversion flows.
    const next = shown.findIndex((entry, i) => i !== leaf && entry === null)
    if (next >= 0) setLeaf(next)
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Read every leaf
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {question.answers.length - remaining} of {question.answers.length}
        </p>
      </div>

      <div className="mt-2 rounded-2xl bg-card-shade p-2">
        <DecisionTree node={tree} highlight={leaf} showClauses={false} />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {all.map((_leaf, index) => (
          <button
            key={index}
            type="button"
            disabled={locked}
            onClick={() => setLeaf(index)}
            className={`chunky h-9 px-3 text-xs font-bold
              ${index === leaf ? 'bg-space-blue text-white' : shown[index] !== null ? 'bg-grass text-white' : 'bg-card'}`}
          >
            Leaf {index + 1}
            {shown[index] !== null && ' ✓'}
          </button>
        ))}
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-soft">
        At leaf {leaf + 1}:
        {(current?.path ?? []).map((literal) => (
          <span key={literal.name} className="formula rounded-md bg-white px-1.5 font-bold text-ink">
            {literal.name} = {literal.negated ? 'F' : 'T'}
          </span>
        ))}
      </p>

      <div className="mt-2 flex flex-col gap-1.5">
        {question.clauses.map((clause, index) => {
          const chosen = shown[leaf] === index
          const right = locked && solution?.[leaf] === index
          const wrong = locked && picked[leaf] === index && solution?.[leaf] !== index

          return (
            <button
              key={index}
              type="button"
              disabled={locked}
              onClick={() => choose(index)}
              className={`tile flex flex-wrap items-center gap-1.5 px-3 py-2 text-left
                ${right ? 'bg-grass text-white' : wrong ? 'bg-space-red text-white' : chosen ? 'bg-space-blue text-white' : 'bg-card'}`}
            >
              <span className="formula text-base font-bold">(</span>
              {clause.map((literal, position) => {
                // Evaluated against this leaf's path, so picking a clause is
                // reading rather than guessing.
                const value = assigned.get(literal.name)
                const satisfied = value !== undefined && value !== literal.negated
                return (
                  <span key={position} className="flex items-center gap-1.5">
                    {position > 0 && <span className="formula font-bold">∨</span>}
                    <span
                      className={`formula rounded-md px-1.5 text-base font-bold
                        ${value === undefined ? 'text-ink-soft' : satisfied ? 'bg-space-blue text-white' : 'bg-space-red text-white'}`}
                    >
                      {literal.negated ? '¬' : ''}
                      {literal.name}
                    </span>
                  </span>
                )
              })}
              <span className="formula text-base font-bold">)</span>
            </button>
          )
        })}
      </div>

      <p className="mt-2 text-xs font-medium text-ink-soft">
        Red is false under this leaf, blue is true. The conflict clause is the one that is all red.
      </p>

      {!locked && (
        <Button
          variant="coin"
          className="mt-3 w-full"
          disabled={remaining > 0}
          onClick={() => submit(picked)}
        >
          {remaining === 0 ? 'Fold the tree' : `${remaining} leaf${remaining === 1 ? '' : 'ves'} to go`}
        </Button>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            The same tree, upside down
          </p>
          <div className="mt-1 flex flex-col gap-1">
            {(treeToRefutation(tree)?.steps ?? []).map((step, index) => (
              <Pop key={index} delay={index * 0.08}>
                <p className="formula flex flex-wrap items-center gap-1.5 text-xs font-bold">
                  <ClauseText clause={step.left} />
                  <ClauseText clause={step.right} />
                  <span className="text-ink-soft">on {step.pivot} →</span>
                  <ClauseText clause={step.resolvent} />
                </p>
              </Pop>
            ))}
          </div>
        </Pop>
      )}
    </Card>
  )
}

export const conflictClauseGame = defineMinigame<ConflictQuestion, ConflictAnswer>({
  id: 'conflict-clause',
  title: 'Read the Leaf',
  tagline: 'Read every leaf, then watch the tree become a proof.',
  topics: ['proof-systems', 'resolution'],
  icon: '🪞',
  roundSeconds: 180,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  Screen,
  Guide: ConflictClauseGuide,
  questionKey: (question) => question.clauses.map(clauseKey).join(';'),
})
