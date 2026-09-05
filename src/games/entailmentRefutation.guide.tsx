/**
 * Proving an entailment by refutation.
 *
 * The worked refutation is produced by `shortestRefutation` — the same
 * function that sets the game's par.
 */

import { clauses, entails, parse, shortestRefutation, showClause, type Clause } from '@/logic'
import { Callout, F, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'

const S = (source: string): Clause[] => clauses(parse(source))

export function EntailmentRefutationGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Do not prove it — refute its negation">
        <Card>
          <Prose>
            <p>
              To show <Sym>Γ ⊨ C</Sym>, the tempting move is to derive <Sym>C</Sym> from{' '}
              <Sym>Γ</Sym>. Resolution is bad at that: it is <em>refutation</em> complete, not
              derivation complete, so it may never reach <Sym>C</Sym> even when the entailment
              holds.
            </p>
            <p>
              So turn the question round. <Sym>Γ ⊨ C</Sym> says no assignment satisfies{' '}
              <Sym>Γ</Sym> and falsifies <Sym>C</Sym> — which says{' '}
              <strong>Γ ∧ ¬C is unsatisfiable</strong>. And proving something unsatisfiable is
              exactly what resolution does well.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="Negating the conclusion is where the marks go">
          <p>
            <Sym>¬C</Sym> for a clause <Sym>C</Sym> of n literals is{' '}
            <strong>n separate unit clauses</strong>, not one clause.{' '}
            <Sym>¬(p ∨ ¬q)</Sym> is <Sym>(¬p) ∧ (q)</Sym>.
          </p>
          <p className="mt-2">
            And if the conclusion is not already a clause, clausify it first —{' '}
            <F>p → q</F> as a conclusion negates to <Sym>(p) ∧ (¬q)</Sym>, two units, not to one
            clause with an arrow in it.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The recipe">
        <Card>
          <Prose>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>Turn every premise into clauses.</li>
              <li>
                Negate the conclusion and turn <em>that</em> into clauses — usually units.
              </li>
              <li>Throw them all in one pot and refute.</li>
              <li>
                Reach <Sym>□</Sym> and the entailment is proved. Get stuck and it does not hold.
              </li>
            </ol>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="Worked">
        <Worked premises={['p → q', '¬q']} conclusion="¬p" />
        <Prose>
          <p>
            The negated conclusion is the unit <Sym>(p)</Sym> — one literal, so one unit. Together
            with the premises it is unsatisfiable, and that is the proof.
          </p>
        </Prose>
        <Worked premises={['p → q', 'q → r']} conclusion="p → r" />
        <Prose>
          <p>
            Here the conclusion is not a clause. <Sym>¬(p → r)</Sym> is <Sym>p ∧ ¬r</Sym>, giving{' '}
            <strong>two</strong> units. Missing the second is the most common way to get stuck on
            this shape.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                First assemble the starting set. The un-negated conclusion is on the list of
                options, and picking it is the mistake this phase exists to catch.
              </li>
              <li>
                Then the resolution board opens with exactly the clauses you chose.
              </li>
              <li>
                Every question is a genuine entailment, so <Sym>□</Sym> is always reachable — being
                stuck means the wrong route, not an impossible one.
              </li>
              <li>Par is the shortest refutation; wandering costs score, not correctness.</li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Worked({ premises, conclusion }: { premises: string[]; conclusion: string }) {
  const premiseFormulas = premises.map((source) => parse(source))
  const conclusionFormula = parse(conclusion)
  const holds = entails(premiseFormulas, conclusionFormula)

  const premiseClauses = premiseFormulas.flatMap((formula) => clauses(formula))
  const negated = S(`¬(${conclusion})`).flatMap((clause) =>
    clause.length === 1 ? [clause] : clause.map((literal) => [literal] as Clause),
  )
  const refutation = shortestRefutation([...premiseClauses, ...negated]) ?? []

  return (
    <Card>
      <p className="formula text-base font-bold">
        {premises.join(', ')} {holds ? '⊨' : '⊭'} {conclusion}
      </p>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-card-shade px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Premises</p>
          <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
            {premiseClauses.map((clause, index) => (
              <ClauseText key={index} clause={clause} className="text-sm font-bold" />
            ))}
          </p>
        </div>
        <div className="rounded-xl bg-coin px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wider">
            ¬conclusion — {negated.length} unit{negated.length === 1 ? '' : 's'}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
            {negated.map((clause, index) => (
              <ClauseText key={index} clause={clause} className="text-sm font-bold" />
            ))}
          </p>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
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
            {refutation.map((step, index) => (
              <tr key={index} className="border-t-2 border-dashed border-card-shade">
                <td className="py-2 pr-2 font-bold">{index + 1}</td>
                <td className="formula py-2 pr-3 text-xs">
                  {showClause(step.left)} {showClause(step.right)}
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
        {refutation.length} steps to □ — the entailment holds.
      </p>
    </Card>
  )
}
