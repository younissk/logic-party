/**
 * How to fill in a truth table.
 *
 * Every table and value below is computed by the same evaluator that marks the
 * game, so the guide cannot be wrong about an answer the game marks wrong.
 */

import {
  AssignmentPlayground,
  Callout,
  F,
  GuideSection,
  MiniTruthTable,
  Prose,
  Sym,
} from '@/ui/guide'
import { Card } from '@/ui/primitives'

export function TruthTableGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What you are being asked">
        <Card>
          <Prose>
            <p>
              A formula like <F>p → q</F> is not true or false on its own. It is true or false{' '}
              <em>once you fix a value for every variable in it</em>. A truth table is just the
              exhaustive answer: one row per way of assigning T and F to the variables, and the
              value of the formula in each.
            </p>
            <p>
              With <strong>n</strong> variables there are <strong>2ⁿ</strong> rows — 2 variables give
              4 rows, 3 give 8. The game fills in the last column; the variable columns are already
              there.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The five connectives">
        <Card>
          <Prose>
            <p>
              Everything else is built from these. Four are worth knowing cold; the fifth is the one
              people lose marks on.
            </p>
          </Prose>

          <div className="mt-4 flex flex-col gap-5">
            <Connective
              source="¬p"
              name="Negation"
              rule="Flips the value. Binds tighter than everything else, so ¬p ∧ q means (¬p) ∧ q."
            />
            <Connective
              source="p ∧ q"
              name="Conjunction"
              rule="True only when both sides are true. One F anywhere makes it F."
            />
            <Connective
              source="p ∨ q"
              name="Disjunction"
              rule="True when at least one side is true. Inclusive: T ∨ T is T, not F."
            />
            <Connective
              source="p → q"
              name="Implication"
              rule="False in exactly one case: T → F. Everything else is true."
            />
            <Connective
              source="p ↔ q"
              name="Biconditional"
              rule="True when both sides have the same value, whichever value that is."
            />
          </div>
        </Card>

        <Callout tone="warn" title="The one that costs marks">
          <p>
            <F>p → q</F> is true whenever <F>p</F> is false. <em>Anything</em> follows from a false
            assumption, so two of the four rows are true for reasons that feel like cheating. Read
            it as “<F>p</F> does not happen without <F>q</F>”, never as “<F>p</F> causes{' '}
            <F>q</F>”.
          </p>
          <p className="mt-2">
            And <F>p → q</F> is <strong>not</strong> the same as <F>q → p</F>. Compare the last two
            columns — they differ on two rows:
          </p>
          <div className="mt-3">
            <MiniTruthTable source="q → p" columns={['p → q']} />
          </div>
        </Callout>
      </GuideSection>

      <GuideSection title="Working one out">
        <Card>
          <Prose>
            <p>
              Never evaluate a big formula in one go. Break it into subformulas, do the small ones
              first, and build up — exactly what the extra columns below show for{' '}
              <F>¬(p ∧ q) → r</F>.
            </p>
          </Prose>
          <div className="mt-4">
            <MiniTruthTable source="¬(p ∧ q) → r" columns={['p ∧ q', '¬(p ∧ q)']} />
          </div>
          <Prose>
            <p className="mt-4">
              Read a row left to right: get <F>p ∧ q</F>, negate it, then apply <Sym>→</Sym> using that
              and <F>r</F>. The final column only ever depends on the column immediately before it
              and one variable.
            </p>
          </Prose>
        </Card>

        <AssignmentPlayground source="¬(p ∧ q) → r" />
      </GuideSection>

      <GuideSection title="Row order">
        <Card>
          <Prose>
            <p>
              The game counts up in binary with the alphabetically first variable changing slowest —
              so <F>p</F> is F for the whole top half of the table, and the last variable alternates
              every row. Ticking down the column in that rhythm is faster and much harder to
              misalign than working row by row.
            </p>
          </Prose>
          <div className="mt-4">
            <MiniTruthTable source="p ∨ q ∨ r" />
          </div>
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tap a space to cycle it: <strong>? → T → F → ?</strong>. No keyboard needed.
              </li>
              <li>
                <strong>Time attack</strong> gives partial credit — seven of eight rows still scores
                — but a wrong table costs 50 points, so check the rows you rushed.
              </li>
              <li>
                <strong>Sprint</strong> will not let you move on until the table is right, and does
                not tell you <em>which</em> rows are wrong. Only how many. Recompute the ones you
                were least sure of.
              </li>
              <li>
                Every question is contingent — never all T or all F. If your column comes out
                constant, you have made a mistake somewhere.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Connective({ source, name, rule }: { source: string; name: string; rule: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-5">
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold">
          {name} — <F>{source}</F>
        </p>
        <p className="mt-1 text-sm font-medium text-ink-soft">{rule}</p>
      </div>
      <div className="shrink-0">
        <MiniTruthTable source={source} />
      </div>
    </div>
  )
}
