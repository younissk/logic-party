/**
 * Reflexivity resolution.
 *
 * Every derivation shown is produced by `reflexivitySteps` — the function the
 * game marks with.
 */

import {
  findFoRefutation,
  parseFoClauseSet,
  reflexivitySteps,
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
  predicates: { p: 1, q: 2, '=': 2 },
  functions: { a: 0, b: 0, f: 1, g: 2 },
}

export function ReflexivityGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What the rule is for">
        <Card>
          <Prose>
            <p>
              Ordinary resolution knows nothing about equality — <Sym>=</Sym> is just another
              predicate to it. So <Sym>∀x:x ≠ x</Sym>, which is plainly contradictory, cannot be
              refuted: there is only one clause and nothing to resolve it against.
            </p>
            <p>
              <strong>Definition 4.40.</strong> If a clause is{' '}
              <Sym>(s ≠ t) ∨ l₁ ∨ … ∨ lₙ</Sym> and σ is an mgu of s and t, then{' '}
              <Sym>σ(l₁) ∨ … ∨ σ(lₙ)</Sym> follows.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="Why it is sound">
          <p>
            Under σ the two sides become the same term, so <Sym>σ(s) ≠ σ(t)</Sym> is false. A clause
            with a false literal in it is only true if something else in it is, and that is what the
            rule concludes.
          </p>
        </Callout>

        <Callout tone="warn" title="Only a negated equality, and only if it unifies">
          <p>
            A positive <Sym>s = t</Sym> is not cancellable — that is paramodulation's job. And{' '}
            <Sym>a ≠ b</Sym> for two different constants stays put: nothing unifies them, so nothing
            makes the literal false.
          </p>
        </Callout>

        <Callout tone="warn" title="The unifier reaches the rest of the clause">
          <p>
            This is the step people write down wrongly. Cancelling{' '}
            <Sym>f(x) ≠ f(a())</Sym> needs <Sym>x ↦ a()</Sym>, and that substitution applies to every
            other literal too — so <Sym>p(x)</Sym> becomes <Sym>p(a())</Sym>, not <Sym>p(x)</Sym>.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Worked">
        <Worked source="¬=(x,x)" caption="Example 4.38 — the whole point" />
        <Worked source="¬=(f(x),f(a())) ∨ p(x)" caption="Example 4.41" />
        <Worked source="¬=(a(),b()) ∨ p(a())" caption="Nothing to cancel — a and b do not unify" />
        <Worked source="¬=(x,f(x)) ∨ p(x)" caption="Nothing to cancel — the occurs check" />
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Disequalities are drawn in gold; everything else is greyed. Tapping one that does not
                unify shakes and does nothing.
              </li>
              <li>
                A clause can have more than one cancellable disequality, and each gives a different
                result. Find them all.
              </li>
              <li>
                Afterwards each step is shown with its unifier, which is the part worth checking
                against what you expected.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** One clause, with every reflexivity step it allows. */
function Worked({ source, caption }: { source: string; caption: string }) {
  const clause = parseFoClauseSet([source], SIG)[0] as FoClause
  const steps = reflexivitySteps(clause)
  const refuted = findFoRefutation([clause], 50).refuted

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <p className="mt-1">
        <FoClauseText clause={clause} className="text-base font-bold" />
      </p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-1.5 pr-3 whitespace-nowrap">Cancelled</th>
              <th className="py-1.5 pr-3 whitespace-nowrap">mgu</th>
              <th className="py-1.5">Result</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step, index) => (
              <tr key={index} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="formula py-1.5 pr-3 font-bold whitespace-nowrap">
                  {showFoLiteral(step.literal)}
                </td>
                <td className="formula py-1.5 pr-3 whitespace-nowrap">
                  {showSubstitution(step.sigma)}
                </td>
                <td className="formula py-1.5 font-bold">{showFoClause(step.clause)}</td>
              </tr>
            ))}
            {steps.length === 0 && (
              <tr>
                <td className="py-1.5 text-ink-soft" colSpan={3}>
                  No disequality here has two sides that unify.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-sm font-medium text-ink-soft">
        Ordinary resolution alone {refuted ? 'does' : 'does not'} refute this clause on its own.
      </p>
    </Card>
  )
}
