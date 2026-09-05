/**
 * First-order resolution.
 *
 * Every resolvent shown is produced by `foBinaryResolvents` and every
 * refutation by `findFoRefutation` — the functions the game marks with.
 */

import {
  findFoRefutation,
  foBinaryResolvents,
  parseFoClauseSet,
  showFoClause,
  showFoLiteral,
  showSubstitution,
  type FoClause,
  type FoSignature,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'

const SIG: FoSignature = {
  predicates: { p: 2, q: 1, shaves: 2 },
  functions: { a: 0, b: 0, f: 2, barber: 0 },
}

export function FoResolutionGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The rule">
        <Card>
          <Prose>
            <p>
              <strong>Definition 4.23.</strong> Take clauses <Sym>C₁</Sym> and <Sym>C₂</Sym> with no
              variables in common, a literal <Sym>l₁ ∈ C₁</Sym> and a literal <Sym>l₂ ∈ C₂</Sym>{' '}
              whose <em>negation</em> unifies with it under mgu <Sym>σ</Sym>. The resolvent is
              everything else, with σ applied:{' '}
              <Sym>{'(σ(C₁) ∖ {σ(l₁)}) ∪ (σ(C₂) ∖ {σ(l₂)})'}</Sym>.
            </p>
            <p>
              The propositional rule is the special case where the atoms are already identical and σ
              is empty.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="Why the unifier must be most general">
          <p>
            Any unifier would give a sound step. The <em>most general</em> one instantiates as little
            as possible, so the resolvent stays as widely applicable as it can — which is exactly the
            saving over grounding everything first.
          </p>
        </Callout>

        <Callout tone="warn" title="Rename apart, always">
          <p>
            Two clauses that both use <Sym>x</Sym> are not talking about the same x — every variable
            in a clause is universally quantified on its own. Renaming is always allowed and never
            changes satisfiability, and skipping it invents occurs-check failures that are not there.
          </p>
        </Callout>

        <Callout tone="warn" title="One literal is removed, by position">
          <p>
            Only the resolved literal goes. If σ makes another literal of the same clause identical
            to it, that one <em>stays</em> — collapsing it is factoring, which is a different rule
            with a page of its own.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="One step, in detail">
        <Step
          first="p(x,x) ∨ ¬q(x)"
          second="¬p(a(),y)"
          caption="Example 4.24 — the first step of the notes' refutation"
        />
      </GuideSection>

      <GuideSection title="A refutation">
        <Refutation
          clauses={['p(x,x) ∨ ¬q(x)', '¬p(a(),y)', 'p(z,b()) ∨ q(f(z,z))']}
          caption="Example 4.22, worked directly rather than through the expansion"
        />
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tap two clauses. When they have one complementary pair the resolvent appears; when
                they have several you choose, and each choice gives a different clause.
              </li>
              <li>
                The mgu is shown next to every option, so you can see how much this step
                instantiated.
              </li>
              <li>
                A clause you already have — in any renaming — is refused. Deriving the same thing
                twice is not progress.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** One resolution step, with every complementary pair listed. */
function Step({
  first,
  second,
  caption,
}: {
  first: string
  second: string
  caption: string
}) {
  const [one, two] = parseFoClauseSet([first, second], SIG) as [FoClause, FoClause]
  const steps = foBinaryResolvents(one, two)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <div className="mt-1 flex flex-col gap-1">
        {[one, two].map((clause, index) => (
          <div key={index} className="rounded-xl bg-card-shade px-3 py-1.5">
            <FoClauseText clause={clause} className="font-bold" />
          </div>
        ))}
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-1.5 pr-3 whitespace-nowrap">Pair</th>
              <th className="py-1.5 pr-3 whitespace-nowrap">mgu</th>
              <th className="py-1.5">Resolvent</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step, index) => (
              <tr key={index} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="formula py-1.5 pr-3 font-bold whitespace-nowrap">
                  {showFoLiteral(step.left)} / {showFoLiteral(step.right)}
                </td>
                <td className="formula py-1.5 pr-3 whitespace-nowrap">
                  {showSubstitution(step.sigma)}
                </td>
                <td className="py-1.5">
                  <FoClauseText clause={step.clause} className="font-bold" />
                </td>
              </tr>
            ))}
            {steps.length === 0 && (
              <tr>
                <td className="py-1.5 text-ink-soft" colSpan={3}>
                  No complementary pair unifies — these two cannot be resolved.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/** A whole refutation, produced by the search. */
function Refutation({ clauses, caption }: { clauses: string[]; caption: string }) {
  const parsed = parseFoClauseSet(clauses, SIG)
  const run = findFoRefutation(parsed, 300)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-1.5 pr-3 whitespace-nowrap">#</th>
              <th className="py-1.5 pr-3">Clause</th>
              <th className="py-1.5">From</th>
            </tr>
          </thead>
          <tbody>
            {run.derived.slice(0, 14).map((entry, index) => (
              <tr key={index} className="border-t-2 border-dashed border-card-shade">
                <td className="py-1.5 pr-3 tabular-nums text-ink-soft">{index + 1}</td>
                <td className="py-1.5 pr-3">
                  <FoClauseText clause={entry.clause} className="font-bold" />
                </td>
                <td className="py-1.5 text-ink-soft">
                  {entry.from === null ? 'given' : `${entry.from[0] + 1} and ${entry.from[1] + 1}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={`mt-2 text-sm font-bold ${run.refuted ? 'text-space-red' : 'text-ink-soft'}`}>
        {run.refuted
          ? `⊥ derived — the set is unsatisfiable. ${
              run.derived.filter((entry) => entry.from !== null).length
            } clauses were generated on the way, of which most were not needed.`
          : 'No refutation found within the budget.'}
      </p>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Shown as {showFoClause([])} for the empty clause.
      </p>
    </Card>
  )
}
