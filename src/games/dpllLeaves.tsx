/**
 * DPLL decision trees — ln.pdf §2.4 Algorithm 2.42, Exercise 3.
 *
 * The loop is: BCP; if that conflicts, this branch is a ⊥ leaf; if it empties
 * the formula, a ✓ leaf; otherwise decide a variable and branch. The exam pins
 * down the two ambiguities so that the tree is unique — propagate as early as
 * possible, decide in alphabetical order — and this follows both literally,
 * taking false first as Example 2.43 does.
 *
 * The counting trap: leaves are the ⊥ and ✓ endpoints only. The propagation
 * nodes on the way down are not leaves, however many of them there are.
 */

import { useEffect, useState } from 'react'
import type { Clause } from '@/logic'
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
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { ClauseList } from '@/ui/ClauseSet'
import { DecisionTree } from '@/ui/DecisionTree'
import { DpllLeavesGuide } from './dpllLeaves.guide'

export interface DpllQuestion {
  clauses: Clause[]
}

export type DpllAnswer = number

interface Profile {
  variables: string[]
  clauses: [min: number, max: number]
  width: [min: number, max: number]
  leaves: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { variables: ['a', 'b'], clauses: [3, 4], width: [1, 2], leaves: [2, 3] },
  medium: { variables: ['a', 'b', 'c'], clauses: [4, 6], width: [2, 3], leaves: [2, 5] },
  hard: { variables: ['a', 'b', 'c', 'd'], clauses: [5, 7], width: [2, 4], leaves: [3, 8] },
}

const ATTEMPTS = 400

function generate({ rng, difficulty }: GenerateContext): DpllQuestion {
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
    // Unsatisfiable only. Algorithm 2.42 returns the moment a branch succeeds,
    // so on a satisfiable formula a real run stops early and "how many leaves"
    // has no single answer. Every branch failing means the whole tree is the
    // run, which is also the case every exam question about one is built on.
    if (!isUnsatisfiableTree(tree)) continue
    const total = countLeaves(tree)
    if (total < profile.leaves[0] || total > profile.leaves[1]) continue
    // At least one propagation somewhere, or the tree is a plain binary tree
    // and counting it needs no understanding of BCP at all.
    if (!leaves(tree).some((leaf) => leaf.propagated.length > 0)) continue

    return { clauses }
  }

  // Last resort, so a round can never stall: the exercise's own formula.
  const named: [string, boolean][][] = [
    [['a', true], ['d', false]],
    [['a', true], ['b', false], ['c', false], ['d', true]],
    [['a', true], ['b', true], ['d', true]],
    [['a', true], ['b', false], ['c', true], ['d', true]],
    [['a', false], ['d', false]],
    [['a', false], ['d', true]],
  ]
  return {
    clauses: named.map((clause) => clause.map(([name, negated]) => ({ name, negated }))),
  }
}

const solve = (question: DpllQuestion): DpllAnswer => countLeaves(dpll(question.clauses))

function check(question: DpllQuestion, answer: DpllAnswer): Verdict {
  const tree = dpll(question.clauses)
  const total = countLeaves(tree)
  const conflicts = leaves(tree).filter((leaf) => leaf.kind === 'conflict').length
  const decisions = total - 1

  if (answer === total) {
    return {
      correct: true,
      message: `${total} leaves`,
      detail: `${conflicts} conflict${conflicts === 1 ? '' : 's'} — every branch fails, so the formula is unsatisfiable. ${decisions} decision${decisions === 1 ? '' : 's'}; everything else was BCP.`,
    }
  }

  return {
    correct: false,
    message: 'Not the leaf count',
    detail: `There are ${total}. Count only the ⊥ and ✓ endpoints — the boxed propagations on the way down are not leaves.`,
  }
}

function Screen({ question, submit, locked }: MinigameScreenProps<DpllQuestion, DpllAnswer>) {
  const [entry, setEntry] = useState('')

  useEffect(() => {
    setEntry('')
  }, [question])

  const tree = dpll(question.clauses)

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        How many leaves?
      </p>

      <ClauseList set={question.clauses} className="mt-2" />

      <p className="mt-3 text-xs font-medium text-ink-soft">
        BCP as early as possible; decide alphabetically, false first. Every branch here ends in a
        conflict, so count the ⊥ endpoints — the boxed propagations on the way down are not leaves.
      </p>

      {!locked ? (
        <>
          <div className="mt-3 flex items-center justify-center">
            <span
              className={`tile flex h-14 min-w-24 items-center justify-center bg-white text-2xl font-bold tabular-nums ${
                entry === '' ? 'text-ink-soft' : 'text-ink'
              }`}
            >
              {entry === '' ? '?' : entry}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8'].map((digit) => (
              <Button
                key={digit}
                variant="secondary"
                onClick={() => setEntry(digit)}
                className={`px-0 text-lg ${entry === digit ? 'bg-coin' : ''}`}
              >
                {digit}
              </Button>
            ))}
          </div>
          <Button
            variant="coin"
            className="mt-3 w-full"
            disabled={entry === ''}
            onClick={() => submit(Number(entry))}
          >
            {entry === '' ? 'Pick a number' : `Answer ${entry}`}
          </Button>
        </>
      ) : (
        <div className="mt-3 rounded-2xl bg-card-shade p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">The tree</p>
          <div className="mt-2">
            <DecisionTree node={tree} />
          </div>
        </div>
      )}
    </Card>
  )
}

export const dpllGame = defineMinigame<DpllQuestion, DpllAnswer>({
  id: 'dpll',
  title: 'Branch Count',
  tagline: 'Run DPLL in your head and count the endpoints.',
  topics: ['satisfiability', 'proof-systems'],
  icon: '🌲',
  roundSeconds: 180,
  sprintQuestions: 6,
  sprintPenaltySeconds: 10,
  generate,
  check,
  solve,
  Screen,
  Guide: DpllLeavesGuide,
  questionKey: (question) => question.clauses.map(clauseKey).join(';'),
})
