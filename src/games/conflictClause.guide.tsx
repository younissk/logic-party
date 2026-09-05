/**
 * How a decision tree becomes a resolution refutation.
 *
 * The tree and the refutation below are both produced from the same run —
 * `dpll` then `treeToRefutation` — so the mirror is demonstrated rather than
 * asserted.
 */

import { clauses, dpll, leaves, parse, treeToRefutation, type Clause } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { ClauseSetText } from '@/ui/ClauseSet'
import { ClauseText } from '@/ui/ClauseText'
import { DecisionTree } from '@/ui/DecisionTree'

const S = (source: string): Clause[] => clauses(parse(source))
const NOTES = '(a ∨ b ∨ c) ∧ (a ∨ ¬b ∨ c) ∧ (a ∨ b ∨ ¬c) ∧ (a ∨ ¬b ∨ ¬c) ∧ (¬a ∨ c) ∧ (¬a ∨ ¬c)'

export function ConflictClauseGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The idea">
        <Card>
          <Prose>
            <p className="text-lg font-bold">Search and proof are the same object.</p>
            <p>
              A DPLL tree that fails everywhere is not merely evidence that the formula is
              unsatisfiable — turned upside down, it <em>is</em> a resolution refutation. The
              leaves become the input clauses, and every branch point becomes a resolution step.
            </p>
            <p>
              That is the deepest idea in the chapter, and it is why a solver can hand you a proof
              instead of asking you to trust it.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="Reading a leaf">
        <Card>
          <Prose>
            <p>
              Everything rests on one sub-skill: <strong>find the clause that went false</strong>.
            </p>
            <p>
              Take the assignment along the path to that leaf — decisions and propagations both —
              and look for the input clause <em>every</em> literal of which is false under it. At{' '}
              <Sym>x = F, y = F, z = F</Sym>, the only fully false clause is <Sym>(x ∨ y ∨ z)</Sym>.
            </p>
            <p>
              One true literal anywhere and the clause is satisfied, so it is not the conflict.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="Every literal, not most of them">
          <p>
            A clause with three literals where two are false is not a conflict — it is a unit clause,
            and BCP would have propagated it rather than failing. The conflict clause is the one
            with nothing left.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Walking up">
        <Card>
          <Prose>
            <p>
              Once each leaf has its clause, go up. Two things get resolved away, and both are on the
              path:
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                A <strong>propagated</strong> literal, against the clause that forced it. Figure 2.4
                draws these in boxes, and they resolve like anything else.
              </li>
              <li>
                A <strong>decision</strong> variable, by resolving the two sibling branches together
                — the whole reason the branch existed.
              </li>
            </ul>
            <p>
              The root of the tree becomes <Sym>⊥</Sym>.
            </p>
          </Prose>
        </Card>

        <Mirror source={NOTES} caption="Example 2.43 → Example 2.44" />

        <Callout tone="tip" title="The shape to notice">
          <p>
            The variables cancel in <strong>exactly the reverse of the order they were
            assigned</strong>. Last assigned, first cancelled. That is the mirror, and it is the
            whole point of the exercise.
          </p>
          <p className="mt-2">
            Reverse of the <em>assignment</em> order, note — not just the decision order. A variable
            BCP forced cancels at its own level too.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                One leaf is highlighted and its assignment is spelled out. Pick the input clause
                that is false there.
              </li>
              <li>
                Only leaves with exactly one falsified clause are ever asked about, so there is
                always a single right answer.
              </li>
              <li>
                Every question is an unsatisfiable set whose tree really does mirror into a
                refutation — the feedback tells you how many steps it takes.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Mirror({ source, caption }: { source: string; caption: string }) {
  const set = S(source)
  const tree = dpll(set)
  const mirror = treeToRefutation(tree)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <p className="mt-1">
        <ClauseSetText set={set} className="text-[0.95rem] font-bold" />
      </p>

      <div className="mt-3 rounded-xl bg-card-shade p-2">
        <DecisionTree node={tree} />
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
        The same tree, upside down
      </p>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-2 pr-2 w-8">#</th>
              <th className="py-2 pr-3">Resolve</th>
              <th className="py-2 pr-3">On</th>
              <th className="py-2">Gives</th>
            </tr>
          </thead>
          <tbody>
            {(mirror?.steps ?? []).map((step, index) => (
              <tr key={index} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="py-2 pr-2 font-bold">{index + 1}</td>
                <td className="py-2 pr-3">
                  <ClauseText clause={step.left} className="text-xs font-bold" />{' '}
                  <ClauseText clause={step.right} className="text-xs font-bold" />
                </td>
                <td className="formula py-2 pr-3 font-bold">{step.pivot}</td>
                <td className="py-2">
                  <ClauseText clause={step.resolvent} className="text-xs font-bold" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-sm font-bold">
        {leaves(tree).length} leaves became a {mirror?.steps.length ?? 0}-step refutation, cancelling{' '}
        {[...new Set((mirror?.steps ?? []).map((step) => step.pivot))].join(', ')}.
      </p>
    </Card>
  )
}
