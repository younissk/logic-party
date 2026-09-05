/**
 * Herbrand's theorem, and what the finite witness looks like.
 *
 * Every witness on this page is found by the game's own search, so the sizes
 * are computed.
 */

import type { FoSignature } from '@/logic'
import { Callout, GuideSection, Prose } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'
import { groundOf, isUnsatisfiable, smallestSubset, type HerbrandTheoremQuestion } from './herbrandTheorem'

const SIG: FoSignature = { predicates: { p: 1, q: 1 }, functions: { a: 0, b: 0, f: 1 } }

export function HerbrandTheoremGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What the theorem says">
        <Card>
          <Prose>
            <p>
              <strong>Theorem 4.21.</strong> A set of first-order clauses is unsatisfiable if and
              only if some <em>finite</em> set of its ground instances is unsatisfiable.
            </p>
            <p>
              With Theorem 4.20 — unsatisfiable exactly when there is no Herbrand model — this turns
              a question about all interpretations over all universes into a question about a finite
              pile of propositional clauses.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="What to look for">
          <p>
            Ground atoms are propositional variables. So a witness needs the{' '}
            <strong>same ground atom</strong> to appear positively somewhere and negatively somewhere
            else, with nothing left to make the rest of those clauses true.
          </p>
          <p className="mt-2">
            Unit clauses are the lever: each one forces its atom, and forcing enough atoms kills a
            longer clause outright.
          </p>
        </Callout>

        <Callout tone="warn" title="Small, not big">
          <p>
            Picking everything is usually not a witness and never an interesting one. The theorem
            claims a <em>finite</em> subset exists, and the interest is in how few clauses it takes —
            typically two or three out of a much larger expansion.
          </p>
        </Callout>

        <Callout tone="warn" title="Sometimes there is none">
          <p>
            If the ground clauses are satisfiable, no subset of them is unsatisfiable, and the
            correct answer is to say so. A theorem about unsatisfiable sets says nothing about the
            others.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Worked">
        <Worked
          ground={['p(a())', '¬p(a())', 'p(f(a()))']}
          caption="A unit and its negation — two clauses is the whole witness"
        />
        <Worked
          ground={['p(a()) ∨ q(a())', '¬p(a())', '¬q(a())', 'p(b())']}
          caption="Three clauses, and the fourth is irrelevant"
        />
        <Worked
          ground={['p(a()) ∨ q(a())', 'p(b())', '¬q(b())']}
          caption="Satisfiable — nothing to find"
        />
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tap clauses to include them. The board says after every tap whether what you have can
                all be true at once.
              </li>
              <li>
                Any unsatisfiable subset scores; the smallest one is called out separately. Picking
                extra clauses that change nothing is not wrong, only longer.
              </li>
              <li>
                The other button claims no subset works, and it is checked — about half the questions
                are satisfiable.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** One ground set, with its smallest witness computed. */
function Worked({ ground, caption }: { ground: string[]; caption: string }) {
  const question: HerbrandTheoremQuestion = {
    predicates: SIG.predicates as Record<string, number>,
    functions: SIG.functions,
    ground,
    par: 0,
  }
  const clauses = groundOf(question)
  const witness = smallestSubset(question)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-1.5 pr-3 whitespace-nowrap">#</th>
              <th className="py-1.5 pr-3">Ground clause</th>
              <th className="py-1.5">In the witness?</th>
            </tr>
          </thead>
          <tbody>
            {clauses.map((clause, index) => {
              const inside = witness?.includes(index) ?? false
              return (
                <tr key={index} className="border-t-2 border-dashed border-card-shade">
                  <td className="py-1.5 pr-3 tabular-nums text-ink-soft">{index + 1}</td>
                  <td className="py-1.5 pr-3">
                    <FoClauseText clause={clause} className="font-bold" />
                  </td>
                  <td
                    className={`py-1.5 font-bold ${inside ? 'text-space-red' : 'text-ink-soft'}`}
                  >
                    {inside ? 'yes' : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm font-bold">
        {witness === null
          ? `All ${clauses.length} can be true at once — no witness exists.`
          : `${witness.length} of ${clauses.length} clauses already contradict.`}
        {isUnsatisfiable(clauses) && witness !== null && witness.length < clauses.length && (
          <span className="font-medium text-ink-soft"> The rest are not needed.</span>
        )}
      </p>
    </Card>
  )
}
