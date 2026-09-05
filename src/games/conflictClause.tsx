/**
 * Refutation matching a given DPLL tree — ln.pdf §2.4, exam25a Q1.2.
 *
 * The hybrid, and the deepest idea in the chapter: a decision tree turned
 * upside down *is* a resolution refutation. Search and proof are the same
 * object.
 *
 * The sub-skill everything else rests on is reading the conflict clause off a
 * leaf: take the assignment along that path and find the input clause every
 * literal of which is false. Get that right at each leaf and the refutation
 * assembles itself, resolving on each variable in the reverse of the order it
 * was assigned.
 */

import { useEffect, useState } from 'react'
import type { Clause, DpllLeaf } from '@/logic'
import {
  clauseKey,
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
import { ConflictClauseGuide } from './conflictClause.guide'

export interface ConflictQuestion {
  clauses: Clause[]
  /** Which leaf, left to right, the player has to read. */
  leaf: number
  /** Index into `clauses` of the clause falsified there. */
  answer: number
}

export type ConflictAnswer = number

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

    const tree = dpll(clauses)
    if (!isUnsatisfiableTree(tree)) continue
    const total = countLeaves(tree)
    if (total < profile.leaves[0] || total > profile.leaves[1]) continue
    if (treeToRefutation(tree) === null) continue

    // Only leaves with exactly one falsified clause: with two, both answers
    // are right and the question has no single answer to mark.
    const usable = leaves(tree)
      .map((leaf, index) => ({ leaf, index, falsified: falsifiedAt(clauses, leaf) }))
      .filter((entry) => entry.falsified.length === 1)
    if (usable.length === 0) continue

    const chosen = rng.pick(usable)
    return { clauses, leaf: chosen.index, answer: chosen.falsified[0] as number }
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
  const tree = dpll(clauses)
  const first = leaves(tree)[0] as DpllLeaf
  return { clauses, leaf: 0, answer: falsifiedAt(clauses, first)[0] ?? 0 }
}

const solve = (question: ConflictQuestion): ConflictAnswer => question.answer

function check(question: ConflictQuestion, answer: ConflictAnswer): Verdict {
  const tree = dpll(question.clauses)
  const leaf = leaves(tree)[question.leaf] as DpllLeaf
  const path = leaf.path
    .map((literal) => `${literal.name} = ${literal.negated ? 'F' : 'T'}`)
    .join(', ')

  if (answer === question.answer) {
    const mirror = treeToRefutation(tree)
    return {
      correct: true,
      message: showClause(question.clauses[question.answer] as Clause),
      detail: `Under ${path}, every literal of it is false. Read one off each leaf and the tree becomes a resolution refutation in ${mirror?.steps.length ?? 0} steps.`,
    }
  }

  return {
    correct: false,
    message: 'Not the clause that failed',
    detail: `Under ${path}, the falsified clause is ${showClause(
      question.clauses[question.answer] as Clause,
    )} — every one of its literals is false there. A clause with even one true literal is still satisfied.`,
  }
}

function Screen({ question, submit, locked, solution }: MinigameScreenProps<ConflictQuestion, ConflictAnswer>) {
  const [, setPicked] = useState<number | null>(null)

  useEffect(() => {
    setPicked(null)
  }, [question])

  const tree = dpll(question.clauses)
  const leaf = leaves(tree)[question.leaf] as DpllLeaf

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Which clause failed here?
      </p>

      <div className="mt-2 rounded-2xl bg-card-shade p-2">
        <DecisionTree node={tree} highlight={question.leaf} showClauses={false} />
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-soft">
        At that leaf:
        {leaf.path.map((literal) => (
          <span key={literal.name} className="formula rounded-md bg-white px-1.5 font-bold text-ink">
            {literal.name} = {literal.negated ? 'F' : 'T'}
          </span>
        ))}
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {question.clauses.map((clause, index) => {
          const isAnswer = locked && solution === index
          return (
            <Button
              key={index}
              variant={isAnswer ? 'primary' : 'secondary'}
              disabled={locked}
              onClick={() => {
                setPicked(index)
                submit(index)
              }}
              className={`w-full justify-start py-2.5 text-left
                ${isAnswer ? 'revealed' : ''} ${locked && !isAnswer ? 'opacity-50' : ''}`}
            >
              <ClauseText clause={clause} className="text-base font-bold" />
            </Button>
          )
        })}
      </div>

      <p className="mt-3 text-xs font-medium text-ink-soft">
        Every literal of it has to be false. One true literal anywhere and the clause is satisfied.
      </p>
    </Card>
  )
}

export const conflictClauseGame = defineMinigame<ConflictQuestion, ConflictAnswer>({
  id: 'conflict-clause',
  title: 'Read the Leaf',
  tagline: 'Find the clause that went false, and mirror the tree.',
  topics: ['proof-systems', 'resolution'],
  icon: '🪞',
  roundSeconds: 180,
  sprintQuestions: 8,
  sprintPenaltySeconds: 10,
  generate,
  check,
  solve,
  Screen,
  Guide: ConflictClauseGuide,
  questionKey: (question) => `${question.leaf}|${question.clauses.map(clauseKey).join(';')}`,
})
