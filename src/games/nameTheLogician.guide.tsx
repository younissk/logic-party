/** The names on the theorems, and where each one is used in this course. */

import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { ENTRIES } from './nameTheLogician'

export function NameTheLogicianGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The bonus question">
        <Card>
          <Prose>
            <p>
              exam26a prints a portrait and asks who it is and why it matters here. The notes
              picture one person: <strong>Kurt Gödel</strong>. What makes him matter to this course
              is §5.2 — no computable, consistent set of axioms proves every truth about ℕ with
              addition and multiplication, which is why <Sym>T(N,=,+,*)</Sym> is complete and
              undecidable at the same time.
            </p>
            <p>
              He is also the other Gödel theorem: first-order logic <em>is</em> complete, so every
              valid formula has a proof. Two theorems, opposite directions, one name — and being
              able to say which is which is the whole content of the bonus.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="Everyone the course leans on">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-2 py-1">name</th>
                  <th className="px-2 py-1">result</th>
                  <th className="px-2 py-1">used here for</th>
                </tr>
              </thead>
              <tbody>
                {ENTRIES.map((entry) => (
                  <tr key={entry.id} className="align-top">
                    <td className="px-2 py-1 font-bold">{entry.name}</td>
                    <td className="px-2 py-1 font-semibold">{entry.result}</td>
                    <td className="px-2 py-1 text-ink-soft">{entry.where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Callout tone="tip" title="The shape of the term, in one table">
          <p>
            Robinson gives the calculus, Herbrand says why it suffices, Skolem makes the input fit
            it, and Knuth and Bendix do the equational analogue. Then chapter 5 asks where the
            calculus can and cannot reach: Presburger yes, Tarski yes, Gödel no.
          </p>
        </Callout>

        <Callout tone="warn" title="Completeness and incompleteness are not opposites">
          <p>
            The completeness theorem is about a <em>calculus</em> and validity. The incompleteness
            theorem is about an <em>axiom system</em> and truth in ℕ. Nothing about the first is
            contradicted by the second, and confusing them is the most common way to lose the point.
          </p>
        </Callout>
      </GuideSection>
    </div>
  )
}
