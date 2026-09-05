/**
 * How to build a resolution refutation.
 *
 * The worked refutation is produced by `findRefutation` — the same function
 * that sets the par the game scores you against — so every step below is one
 * the game would accept.
 */

import { clauses, findRefutation, parse, showClause, type Clause } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'

const S = (source: string): Clause[] => clauses(parse(source))

export function RefutationGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What you are being asked">
        <Card>
          <Prose>
            <p>
              You are given a clause set that is unsatisfiable, and you have to prove it by reaching
              the <strong>empty clause</strong> <Sym>□</Sym>. That is what a refutation is: a
              derivation of <Sym>□</Sym>, and by refutation completeness one always exists when the
              set is unsatisfiable.
            </p>
            <p>
              <Sym>□</Sym> is false under every assignment, so deriving it from the set says the set
              itself cannot be satisfied.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The heuristic that works under pressure">
        <Card>
          <Prose>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>
                <strong>Hunt units first.</strong> A one-literal clause shaves its complement off
                every clause it touches, for free.
              </li>
              <li>
                <strong>Propagate them.</strong> Each shave often produces another unit; keep going.
              </li>
              <li>
                <strong>Aim for a complementary pair of units</strong> — <Sym>y</Sym> and{' '}
                <Sym>¬y</Sym>. Resolving those two is <Sym>□</Sym>.
              </li>
            </ol>
            <p>
              The signal that you are on track: <strong>your clauses shrink every step</strong>. If
              they are growing, you are wandering — back up and start from a unit instead.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="You cannot resolve on □">
          <p>
            The empty clause has no literals, so there is nothing to pick as a pivot. Once you reach
            it you are finished, by definition — there is no next step. In the game <Sym>□</Sym>{' '}
            simply stops being tappable.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="A refutation, worked">
        <Worked
          caption="the xyz half of exam26a"
          source="(z) ∧ (¬x ∨ ¬y) ∧ (x ∨ ¬y ∨ ¬z) ∧ (x ∨ y ∨ ¬z) ∧ (x ∨ y ∨ z) ∧ (¬x ∨ ¬z)"
        />
        <Prose>
          <p>
            Every step uses the unit <Sym>(z)</Sym> or something derived from it, and every result
            is shorter than what went in. That is the shape a refutation should have.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tap two clauses to resolve them. Pairs that cannot combine — no shared variable, or
                no clash — are dimmed while you have one selected, so an illegal step is not
                possible.
              </li>
              <li>
                When two clauses clash on more than one variable you are asked which pivot. One
                pivot per step, always.
              </li>
              <li>
                Every question has a <strong>par</strong>: the length of the shortest refutation.
                Reaching <Sym>□</Sym> at all counts as correct; the score is par divided by the
                steps you actually used, so wandering costs points without failing you.
              </li>
              <li>
                Every set has a unit clause somewhere. Start there.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Worked({ caption, source }: { caption: string; source: string }) {
  const set = S(source)
  const refutation = findRefutation(set) ?? []

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {set.map((clause, index) => (
          <ClauseText key={index} clause={clause} className="text-[0.95rem] font-bold" />
        ))}
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-2 pr-2 w-8">#</th>
              <th className="py-2 pr-3">Resolve</th>
              <th className="py-2 pr-3 whitespace-nowrap">On</th>
              <th className="py-2">Gives</th>
            </tr>
          </thead>
          <tbody>
            {refutation.map((step, index) => (
              <tr key={index} className="border-t-2 border-dashed border-card-shade">
                <td className="py-2 pr-2 font-bold">{index + 1}</td>
                <td className="py-2 pr-3">
                  <span className="formula text-[0.95rem]">
                    {showClause(step.left)} {showClause(step.right)}
                  </span>
                </td>
                <td className="formula py-2 pr-3 font-bold">{step.pivot}</td>
                <td className="py-2">
                  <ClauseText clause={step.resolvent} className="font-bold" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-sm font-bold">
        {refutation.length} steps to □ — that is the par for this set.
      </p>
    </Card>
  )
}
