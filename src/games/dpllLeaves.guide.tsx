/**
 * How to run DPLL and count the leaves.
 *
 * Both trees on this page are produced by `dpll` — the same function the game
 * marks with — so the exercise's answer of two leaves is computed here.
 */

import type { ReactNode } from 'react'

import { clauses, countLeaves, dpll, leaves, parse, type Clause } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { ClauseSetText } from '@/ui/ClauseSet'
import { DecisionTree } from '@/ui/DecisionTree'

const S = (source: string): Clause[] => clauses(parse(source))

const EXERCISE =
  '(¬a ∨ d) ∧ (¬a ∨ b ∨ c ∨ ¬d) ∧ (¬a ∨ ¬b ∨ ¬d) ∧ (¬a ∨ b ∨ ¬c ∨ ¬d) ∧ (a ∨ d) ∧ (a ∨ ¬d)'
const NOTES = '(a ∨ b ∨ c) ∧ (a ∨ ¬b ∨ c) ∧ (a ∨ b ∨ ¬c) ∧ (a ∨ ¬b ∨ ¬c) ∧ (¬a ∨ c) ∧ (¬a ∨ ¬c)'

export function DpllLeavesGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The loop">
        <Card>
          <Prose>
            <p>DPLL is 1962, and every solver since still has this skeleton:</p>
          </Prose>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-3 border-ink">
                  <th className="py-2 pr-2 w-9">#</th>
                  <th className="py-2 pr-3">Do</th>
                  <th className="py-2">Then</th>
                </tr>
              </thead>
              <tbody>
                <Step n="1" does="BCP — propagate every unit clause" then="Look at what is left" />
                <Step n="2" does="A clause went empty" then={<><strong>Conflict.</strong> This branch is a <Sym>⊥</Sym> leaf.</>} />
                <Step n="3" does="The formula went empty" then={<><strong>Satisfied.</strong> This branch is a <Sym>✓</Sym> leaf.</>} />
                <Step n="4" does="Neither" then="Decide a variable and branch on both values" />
              </tbody>
            </table>
          </div>
        </Card>

        <Callout tone="tip" title="The exam removes the ambiguity for you">
          <p>
            A run of DPLL is not unique unless you fix two choices, and the question does:{' '}
            <strong>BCP as early as possible</strong>, and <strong>decide in alphabetical
            order</strong>. Follow that literally and everyone's tree is the same tree.
          </p>
          <p className="mt-2">
            Example 2.43 takes the false branch first, which is the dashed edge in Figure 2.4 — and
            what this game does too.
          </p>
        </Callout>

        <Callout tone="warn" title="The counting trap">
          <p>
            Leaves are the <Sym>⊥</Sym> and <Sym>✓</Sym> endpoints, <em>only</em>. The boxed
            propagation nodes on the way down are not leaves however many of them there are, and a
            branch that runs six propagations deep before failing still contributes exactly one.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The exercise, worked">
        <Tree source={EXERCISE} caption="Exercise 3" />
        <Prose>
          <p>
            <strong>One decision.</strong> No units to start with, so <Sym>a</Sym> gets decided —
            and everything after that is forced.
          </p>
          <p>
            On <Sym>a = T</Sym>: <Sym>(¬a ∨ d)</Sym> becomes the unit <Sym>(d)</Sym>, then{' '}
            <Sym>(¬a ∨ ¬b ∨ ¬d)</Sym> becomes <Sym>(¬b)</Sym>, and the remaining two clauses demand
            <Sym> c</Sym> and <Sym>¬c</Sym> at once. On <Sym>a = F</Sym>: <Sym>(a ∨ d)</Sym> and{' '}
            <Sym>(a ∨ ¬d)</Sym> demand <Sym>d</Sym> and <Sym>¬d</Sym>. Both fail.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="The tree from the notes">
        <Tree source={NOTES} caption="Example 2.43 / Figure 2.4" />
        <Prose>
          <p>
            Two decisions here, and <Sym>c</Sym> is propagated on every branch rather than decided —
            which is why the tree has three leaves and not four. Every leaf is a conflict, so the
            formula is unsatisfiable.
          </p>
          <p>
            Each conflict leaf is annotated with a clause that went false there. That annotation is
            what turns the tree into a resolution refutation, which is the next exercise.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>One number, tapped from a row of buttons.</li>
              <li>
                Every question has at least one propagation somewhere, so the answer is never just
                2ⁿ for n decisions.
              </li>
              <li>
                <strong>Every question is unsatisfiable</strong>, so every leaf is a{' '}
                <Sym>⊥</Sym>. That is not a simplification: Algorithm 2.42 returns the moment a
                branch succeeds, so on a satisfiable formula a real run stops early and “how many
                leaves” has no single answer.
              </li>
              <li>After you answer, the whole tree is drawn — circles decide, boxes propagate.</li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Step({ n, does, then }: { n: string; does: string; then: ReactNode }) {
  return (
    <tr className="border-t-2 border-dashed border-card-shade align-top">
      <td className="py-2 pr-2">
        <span className="space flex h-7 w-7 items-center justify-center bg-coin text-sm font-bold">
          {n}
        </span>
      </td>
      <td className="py-2 pr-3 font-bold">{does}</td>
      <td className="py-2">{then}</td>
    </tr>
  )
}

function Tree({ source, caption }: { source: string; caption: string }) {
  const set = S(source)
  const tree = dpll(set)
  const conflicts = leaves(tree).filter((leaf) => leaf.kind === 'conflict').length

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <p className="mt-1">
        <ClauseSetText set={set} className="text-[0.95rem] font-bold" />
      </p>
      <div className="mt-3 rounded-xl bg-card-shade p-2">
        <DecisionTree node={tree} />
      </div>
      <p className="mt-2 text-base font-bold">
        {countLeaves(tree)} leaves · {conflicts} conflict{conflicts === 1 ? '' : 's'} ·{' '}
        {conflicts === countLeaves(tree) ? 'unsatisfiable' : 'satisfiable'}
      </p>
    </Card>
  )
}
