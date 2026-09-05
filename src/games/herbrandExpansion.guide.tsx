/**
 * The Herbrand expansion, and what Herbrand's theorem says about it.
 *
 * Every expansion shown is produced by the game's own `expansionOf`, and the
 * refutations by `findFoRefutation`.
 */

import {
  findFoRefutation,
  herbrandUniverse,
  parseFoClauseSet,
  showTerm,
  type FoSignature,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'
import { TermText } from '@/ui/TermText'
import { expansionOf, type HerbrandExpansionQuestion } from './herbrandExpansion'

const SIG: FoSignature = { predicates: { p: 1, q: 2 }, functions: { a: 0, b: 0, f: 1 } }

export function HerbrandExpansionGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What the expansion is">
        <Card>
          <Prose>
            <p>
              Take every clause, and replace its variables by ground terms from the Herbrand universe
              — in every combination. The result is the <strong>Herbrand expansion</strong>: a set of
              ground clauses, which is to say a propositional problem.
            </p>
            <p>
              That is the whole reason it exists. Ground clauses have no variables and no
              quantifiers, so the propositional machinery of chapter 2 applies unchanged.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="One instance per tuple, not per variable">
          <p>
            A clause with two variables over a three-element universe has nine instances, not six.
            The variables are ground independently, so it is a product.
          </p>
        </Callout>

        <Callout tone="warn" title="The same variable, the same term throughout">
          <p>
            <Sym>¬p(x)∨q(x,x)</Sym> instantiated at <Sym>a</Sym> gives{' '}
            <Sym>¬p(a())∨q(a(),a())</Sym>. Both occurrences move together — they are the same
            variable, and a substitution is applied to the whole clause at once.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Herbrand's theorem">
        <Card>
          <Prose>
            <p>
              <strong>Theorem 4.21.</strong> A set of first-order clauses is unsatisfiable if and
              only if some <em>finite</em> set of ground instances of it is unsatisfiable.
            </p>
            <p>
              So an infinite search has a finite witness inside it. What the theorem does not do is
              say which instances — and that gap is exactly what first-order resolution fills, by
              instantiating only as much as each step needs.
            </p>
          </Prose>
        </Card>

        <Worked
          clauses={['¬p(x)', 'p(f(y))']}
          caption="Example 4.19.2 — unsatisfiable, and two instances suffice"
        />
      </GuideSection>

      <GuideSection title="A bigger one">
        <Worked
          clauses={['p(a())', '¬p(x) ∨ q(x,b())']}
          caption="Two clauses, one variable each"
        />
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Pick a clause, then a ground term for each of its variables. The instance is shown
                before you bank it, so you can see what the choice did.
              </li>
              <li>
                A clause with no variables is its own only instance — bank it and move on.
              </li>
              <li>
                Duplicates are refused. Two different assignments can give the same instance, and the
                expansion is a set.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** One clause set with its universe, expansion and verdict, all computed. */
function Worked({ clauses, caption }: { clauses: string[]; caption: string }) {
  const parsed = parseFoClauseSet(clauses, SIG)
  const universe = herbrandUniverse(parsed, 1)
  const question: HerbrandExpansionQuestion = {
    predicates: SIG.predicates as Record<string, number>,
    functions: SIG.functions,
    clauses,
    depth: 1,
    instances: [],
  }
  const instances = expansionOf(question)
  const refuted = findFoRefutation(parsed, 200).refuted

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <div className="mt-1 flex flex-col gap-1">
        {parsed.map((clause, index) => (
          <div key={index} className="rounded-xl bg-card-shade px-3 py-1.5">
            <FoClauseText clause={clause} className="font-bold" />
          </div>
        ))}
      </div>

      <p className="mt-2 flex flex-wrap items-baseline gap-2 text-sm font-medium">
        <span className="font-bold">Universe</span>
        {universe.map((term) => (
          <span key={showTerm(term)} className="rounded-md bg-coin px-2 py-0.5 font-bold">
            <TermText term={term} />
          </span>
        ))}
      </p>

      <p className="mt-2 text-sm font-bold">
        Expansion — {instances.length} instance{instances.length === 1 ? '' : 's'} at this depth
      </p>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-1.5 pr-3 whitespace-nowrap">#</th>
              <th className="py-1.5">Ground instance</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((entry, index) => (
              <tr key={entry} className="border-t-2 border-dashed border-card-shade">
                <td className="py-1.5 pr-3 tabular-nums text-ink-soft">{index + 1}</td>
                <td className="formula py-1.5 font-bold">{entry}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p
        className={`mt-2 text-sm font-bold ${refuted ? 'text-space-red' : 'text-grass-deep'}`}
      >
        {refuted
          ? 'The clause set is unsatisfiable, so by Theorem 4.21 a finite part of this expansion is too.'
          : 'No refutation was found, so nothing here has to be contradictory.'}
      </p>
    </Card>
  )
}
