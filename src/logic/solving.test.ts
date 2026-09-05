import { describe, expect, it } from 'vitest'

import { clauses, showClause, showClauseSet, type Clause } from './normal'
import { parse } from './parse'
import { isSatisfiable } from './semantics'
import { clauseKey, resolveOn } from './resolution'
import {
  bcp,
  bcpStep,
  cdcl,
  countLeaves,
  dp,
  dpll,
  eliminateVariable,
  falsifiedClause,
  leaves,
  learnFromDecisions,
  treeToRefutation,
  type DpllNode,
} from './solving'

const S = (source: string): Clause[] => clauses(parse(source))
const show = (set: readonly Clause[]) => showClauseSet(set)

describe('bcpStep', () => {
  it('deletes clauses containing the literal and erases its complement', () => {
    // Definition 2.39, both moves and nothing else.
    const set = S('(a ∨ b) ∧ (¬a ∨ c) ∧ (d ∨ e)')
    const after = bcpStep(set, { name: 'a', negated: false })
    expect(show(after)).toBe('{{c}, {d, e}}')
  })

  it('leaves a clause mentioning neither untouched', () => {
    const set = S('(b ∨ c)')
    expect(show(bcpStep(set, { name: 'a', negated: false }))).toBe('{{b, c}}')
  })
})

describe('bcp to fixpoint', () => {
  it('answers the exam question', () => {
    // exam25a Q1.1c. a forces ¬c, which makes (c ∨ d) a unit, which forces d.
    const run = bcp(S('a ∧ (¬a ∨ c ∨ d) ∧ (¬a ∨ b ∨ ¬c) ∧ (¬a ∨ ¬c) ∧ (a ∨ b) ∧ (¬d ∨ e ∨ f)'))
    expect(show(run.result)).toBe('{{e, f}}')
    expect(run.outcome).toBe('undecided')
    expect(run.steps.map((step) => `${step.literal.negated ? '¬' : ''}${step.literal.name}`)).toEqual([
      'a',
      '¬c',
      'd',
    ])
  })

  /** Example 2.41 — the three outcomes, one formula each. */
  it('reaches the empty formula, which means satisfiable', () => {
    const run = bcp(S('(¬a ∨ b ∨ ¬c) ∧ (a ∨ b) ∧ (¬a ∨ ¬b) ∧ (a)'))
    expect(run.result).toHaveLength(0)
    expect(run.outcome).toBe('satisfiable')
  })

  it('reaches the empty clause, which means unsatisfiable', () => {
    const run = bcp(S('(¬a ∨ b ∨ ¬c) ∧ (a ∨ b) ∧ (¬a) ∧ (¬b)'))
    expect(run.result.some((clause) => clause.length === 0)).toBe(true)
    expect(run.outcome).toBe('unsatisfiable')
  })

  it('changes nothing when there is no unit clause', () => {
    const original = S('(¬a ∨ b ∨ ¬c) ∧ (a ∨ b) ∧ (¬a ∨ ¬b)')
    const run = bcp(original)
    expect(show(run.result)).toBe(show(original))
    expect(run.outcome).toBe('undecided')
  })

  it('never turns a satisfiable formula unsatisfiable, or the reverse', () => {
    // Theorem 2.40: BCP preserves satisfiability, and that is all it preserves.
    for (const source of [
      'a ∧ (¬a ∨ b) ∧ (¬b ∨ c)',
      '(a ∨ b) ∧ ¬a ∧ (¬b ∨ c) ∧ ¬c',
      'x ∧ ¬x',
      '(p ∨ q) ∧ (¬p ∨ q)',
      'a ∧ b ∧ (¬a ∨ ¬b)',
    ]) {
      const run = bcp(S(source))
      const satisfiable = isSatisfiable(parse(source))
      if (run.outcome === 'satisfiable') expect(satisfiable, source).toBe(true)
      if (run.outcome === 'unsatisfiable') expect(satisfiable, source).toBe(false)
    }
  })
})

describe('DP', () => {
  it('eliminates a variable the way the exam does', () => {
    // exam26a Q1.2, first step: 4 positives × 2 negatives, five tautologies.
    const set = S(
      '(¬x ∨ y ∨ z) ∧ (x ∨ ¬y) ∧ (x ∨ ¬y ∨ ¬z) ∧ (x ∨ y ∨ ¬z) ∧ (x ∨ y ∨ z) ∧ (¬x ∨ ¬z)',
    )
    const step = eliminateVariable(set, 'x')
    expect(step.removed).toHaveLength(6)
    expect(step.discarded.length).toBeGreaterThan(0)
    expect(show(step.result)).toBe('{{¬y, ¬z}, {y, ¬z}, {y, z}}')
  })

  it('runs the exam question to the empty formula', () => {
    const run = dp(
      S('(¬x ∨ y ∨ z) ∧ (x ∨ ¬y) ∧ (x ∨ ¬y ∨ ¬z) ∧ (x ∨ y ∨ ¬z) ∧ (x ∨ y ∨ z) ∧ (¬x ∨ ¬z)'),
    )
    expect(run.verdict).toBe('satisfiable')
    expect(run.result).toHaveLength(0)
    expect(run.steps.map((step) => step.variable)).toEqual(['x', 'y', 'z'])
  })

  it('reproduces the exercise elimination', () => {
    // Exercise 2, DP question: eliminating z from the given formula.
    const set = S('(¬y ∨ z) ∧ (x ∨ ¬z) ∧ (¬x ∨ ¬y ∨ ¬z) ∧ (x ∨ y)')
    expect(show(eliminateVariable(set, 'z').result)).toBe('{{x, y}, {x, ¬y}, {¬x, ¬y}}')
  })

  it('decides satisfiability correctly', () => {
    for (const source of [
      '(a ∨ b) ∧ (¬a ∨ c)',
      'a ∧ ¬a',
      '(p ∨ q) ∧ (¬p ∨ q) ∧ (p ∨ ¬q) ∧ (¬p ∨ ¬q)',
      '(x ∨ y) ∧ (¬x ∨ y) ∧ (x ∨ ¬y)',
      '(a ∨ b ∨ c) ∧ (¬a ∨ ¬b) ∧ (¬c)',
    ]) {
      expect(dp(S(source)).verdict === 'satisfiable', source).toBe(isSatisfiable(parse(source)))
    }
  })

  it('drops every tautological resolvent', () => {
    const step = eliminateVariable(S('(a ∨ b) ∧ (¬a ∨ ¬b)'), 'a')
    // (b ∨ ¬b) is the only resolvent, and it is a tautology.
    expect(step.added).toHaveLength(0)
    expect(step.discarded).toHaveLength(1)
    expect(step.result).toHaveLength(0)
  })
})

describe('DPLL', () => {
  it('runs the exercise to two leaves', () => {
    // Exercise 3: one decision on a, everything else BCP, both sides conflict.
    const tree = dpll(
      S('(¬a ∨ d) ∧ (¬a ∨ b ∨ c ∨ ¬d) ∧ (¬a ∨ ¬b ∨ ¬d) ∧ (¬a ∨ b ∨ ¬c ∨ ¬d) ∧ (a ∨ d) ∧ (a ∨ ¬d)'),
    )
    expect(countLeaves(tree)).toBe(2)
    expect(leaves(tree).every((leaf) => leaf.kind === 'conflict')).toBe(true)
    expect((tree as { variable: string }).variable).toBe('a')
  })

  it('reproduces the tree from the notes', () => {
    // Example 2.43 / Figure 2.4: decisions on a then b, four leaves.
    const tree = dpll(
      S('(a ∨ b ∨ c) ∧ (a ∨ ¬b ∨ c) ∧ (a ∨ b ∨ ¬c) ∧ (a ∨ ¬b ∨ ¬c) ∧ (¬a ∨ c) ∧ (¬a ∨ ¬c)'),
    )
    expect(countLeaves(tree)).toBe(3)
    expect(leaves(tree).every((leaf) => leaf.kind === 'conflict')).toBe(true)
  })

  it('finds a model when there is one', () => {
    const tree = dpll(S('(a ∨ b) ∧ (¬a ∨ c)'))
    expect(leaves(tree).some((leaf) => leaf.kind === 'model')).toBe(true)
  })

  it('says unsatisfiable exactly when every leaf conflicts', () => {
    for (const source of [
      '(a ∨ b) ∧ (¬a ∨ c)',
      'a ∧ ¬a',
      '(p ∨ q) ∧ (¬p ∨ q) ∧ (p ∨ ¬q) ∧ (¬p ∨ ¬q)',
      '(a ∨ b ∨ c) ∧ (¬a ∨ ¬b)',
    ]) {
      const allConflict = leaves(dpll(S(source))).every((leaf) => leaf.kind === 'conflict')
      expect(allConflict, source).toBe(!isSatisfiable(parse(source)))
    }
  })

  it('annotates every conflict leaf with a clause that really is false there', () => {
    const set = S('(a ∨ b ∨ c) ∧ (a ∨ ¬b ∨ c) ∧ (a ∨ b ∨ ¬c) ∧ (a ∨ ¬b ∨ ¬c) ∧ (¬a ∨ c) ∧ (¬a ∨ ¬c)')
    for (const leaf of leaves(dpll(set))) {
      if (leaf.kind !== 'conflict') continue
      expect(leaf.conflict, showClause(leaf.conflict ?? [])).not.toBeNull()
      const assigned = new Map(leaf.path.map((literal) => [literal.name, !literal.negated]))
      for (const literal of leaf.conflict as Clause) {
        expect(assigned.get(literal.name)).toBe(literal.negated)
      }
    }
  })
})

describe('falsifiedClause', () => {
  it('finds the one clause false under an assignment', () => {
    const set = S('(x ∨ y ∨ z) ∧ (¬x ∨ y) ∧ (x ∨ ¬y)')
    const found = falsifiedClause(set, [
      { name: 'x', negated: true },
      { name: 'y', negated: true },
      { name: 'z', negated: true },
    ])
    expect(showClause(found as Clause)).toBe('{x, y, z}')
  })

  it('returns null when nothing is falsified', () => {
    expect(falsifiedClause(S('(x ∨ y)'), [{ name: 'x', negated: false }])).toBeNull()
  })
})

describe('the mirror', () => {
  /**
   * The deepest claim in the chapter: a DPLL tree, upside down, *is* a
   * resolution refutation. This is what makes it more than a slogan.
   */
  const unsatisfiable = [
    '(a ∨ b ∨ c) ∧ (a ∨ ¬b ∨ c) ∧ (a ∨ b ∨ ¬c) ∧ (a ∨ ¬b ∨ ¬c) ∧ (¬a ∨ c) ∧ (¬a ∨ ¬c)',
    '(¬a ∨ d) ∧ (¬a ∨ b ∨ c ∨ ¬d) ∧ (¬a ∨ ¬b ∨ ¬d) ∧ (¬a ∨ b ∨ ¬c ∨ ¬d) ∧ (a ∨ d) ∧ (a ∨ ¬d)',
    '(p ∨ q) ∧ (¬p ∨ q) ∧ (p ∨ ¬q) ∧ (¬p ∨ ¬q)',
    'a ∧ ¬a',
    '(x ∨ y ∨ z) ∧ (x ∨ ¬y) ∧ (¬x ∨ z) ∧ (¬z) ∧ (x ∨ y ∨ ¬z)',
  ]

  it.each(unsatisfiable)('turns the tree for %s into a refutation ending in □', (source) => {
    const set = S(source)
    const mirror = treeToRefutation(dpll(set))
    expect(mirror, source).not.toBeNull()
    expect(clauseKey((mirror as { clause: Clause }).clause), source).toBe('')
  })

  it.each(unsatisfiable)('every step of the mirrored refutation for %s is legal', (source) => {
    const set = S(source)
    const mirror = treeToRefutation(dpll(set)) as { steps: { left: Clause; right: Clause; pivot: string; resolvent: Clause }[] }
    const available = set.map(clauseKey)
    for (const step of mirror.steps) {
      expect(available, source).toContain(clauseKey(step.left))
      expect(available, source).toContain(clauseKey(step.right))
      expect(clauseKey(resolveOn(step.left, step.right, step.pivot) as Clause)).toBe(
        clauseKey(step.resolvent),
      )
      available.push(clauseKey(step.resolvent))
    }
    expect(available, source).toContain('')
  })

  it('cancels variables in the reverse of the order they were assigned', () => {
    // The observation the exercise is really about — and note it is the
    // reverse of the *assignment* order, not just the decision order: c is
    // propagated rather than decided here, and it still cancels first, exactly
    // as Example 2.44 has it.
    const set = S('(a ∨ b ∨ c) ∧ (a ∨ ¬b ∨ c) ∧ (a ∨ b ∨ ¬c) ∧ (a ∨ ¬b ∨ ¬c) ∧ (¬a ∨ c) ∧ (¬a ∨ ¬c)')
    const tree = dpll(set)
    const mirror = treeToRefutation(tree) as { steps: { pivot: string }[] }

    const assignedDown: string[] = []
    const walk = (node: DpllNode): void => {
      for (const entry of node.propagated) assignedDown.push(entry.literal.name)
      if (node.kind !== 'branch') return
      assignedDown.push(node.variable)
      walk(node.whenFalse)
    }
    walk(tree)

    const pivots = [...new Set(mirror.steps.map((step) => step.pivot))]
    expect(pivots).toEqual(['c', 'b', 'a'])
    expect(pivots).toEqual([...new Set(assignedDown)].reverse())
  })

  it('returns null for a tree with a model in it', () => {
    expect(treeToRefutation(dpll(S('(a ∨ b) ∧ (¬a ∨ c)')))).toBeNull()
  })
})

describe('clause learning', () => {
  it('negates the decisions', () => {
    expect(
      showClause(
        learnFromDecisions([
          { name: 'a', negated: true },
          { name: 'b', negated: true },
        ]).clause,
      ),
    ).toBe('{a, b}')
  })

  it('reproduces the sequence from the notes', () => {
    // Example 2.45 learns (a ∨ b), then (a), then reaches ⊥ with no decision.
    const run = cdcl(
      S('(a ∨ b ∨ c) ∧ (a ∨ ¬b ∨ c) ∧ (a ∨ b ∨ ¬c) ∧ (a ∨ ¬b ∨ ¬c) ∧ (¬a ∨ c) ∧ (¬a ∨ ¬c)'),
    )
    expect(run.steps.map((step) => showClause(step.learned))).toEqual(['{a, b}', '{a}'])
    expect(run.unsatisfiable).toBe(true)
  })

  it('learns nothing from a satisfiable formula', () => {
    expect(cdcl(S('(a ∨ b) ∧ (¬a ∨ c)')).unsatisfiable).toBe(false)
  })
})
