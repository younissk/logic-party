/**
 * The equality axioms, and why paramodulation replaced them.
 *
 * Every axiom set and every refutation on this page is produced by the
 * functions the game marks with.
 */

import {
  equalityAxioms,
  findFoRefutation,
  parseFoClauseSet,
  paramodulants,
  reflexivitySteps,
  showFoClause,
  type FoClause,
  type FoSignature,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'

const SIG: FoSignature = {
  predicates: { p: 1, q: 1, '=': 2 },
  functions: { a: 0, b: 0, c: 0, f: 1 },
}

export function EqualityAxiomsGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Why anything is needed">
        <Card>
          <Prose>
            <p>
              To a resolution prover, <Sym>=</Sym> is a binary predicate like any other. It has no
              idea that <Sym>a = b</Sym> and <Sym>p(a)</Sym> should give <Sym>p(b)</Sym>, so a set
              like <Sym>{'{p(a), ¬p(b), a = b}'}</Sym> is one it cannot refute — even though no{' '}
              <em>normal</em> interpretation satisfies it.
            </p>
            <p>
              An interpretation is <strong>normal</strong> when it reads <Sym>=</Sym> as actual
              equality. Theorem 4.37: φ has a normal model exactly when φ ∧ E_φ has a model at all.
              So adding the axioms lets ordinary resolution do the work.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="The schema">
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
            <li>
              <strong>reflexivity</strong> — <Sym>x = x</Sym>
            </li>
            <li>
              <strong>symmetry</strong> — <Sym>x = y → y = x</Sym>
            </li>
            <li>
              <strong>transitivity</strong> — <Sym>x = y ∧ y = z → x = z</Sym>
            </li>
            <li>
              <strong>function congruence</strong>, one per function symbol — equal arguments give
              equal results
            </li>
            <li>
              <strong>predicate congruence</strong>, one per predicate symbol — equal arguments give
              the same truth value
            </li>
          </ul>
        </Callout>

        <Callout tone="warn" title="It is per symbol, and that is the problem">
          <p>
            The congruence axioms are a schema, not two axioms: every function and every predicate
            in the language needs its own. A realistic signature therefore adds far more clauses
            than the problem contains, and each of them resolves against everything.
          </p>
          <p className="mt-2">
            That cost is the whole argument for reflexivity resolution and paramodulation, which do
            the same job as inference rules instead.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Example 4.36, in full">
        <Worked
          clauses={['p(a())', '¬p(b())', '=(a(),b())']}
          caption="Only predicate congruence is actually used"
        />
      </GuideSection>

      <GuideSection title="Where transitivity earns its place">
        <Worked
          clauses={['p(a())', '¬p(c())', '=(a(),b())', '=(b(),c())']}
          caption="Two equations that have to be chained"
        />
      </GuideSection>

      <GuideSection title="The same job, without the axioms">
        <Card>
          <Prose>
            <p>
              Theorem 4.44 says binary resolution, factoring, reflexivity resolution and
              paramodulation together are sound and refutationally complete — no axioms needed.
            </p>
          </Prose>
          <WithoutAxioms clauses={['p(a())', '¬p(b())', '=(a(),b())']} />
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Every axiom of the schema is offered, labelled. Tap the ones you think the
                refutation needs; the board says after every tap whether ⊥ is reachable yet.
              </li>
              <li>
                Adding all of them always works. The number that was actually needed is printed, and
                it is usually one or two.
              </li>
              <li>
                Ask what the refutation has to <em>do</em> with the equation — move it onto another
                term, turn it round, chain two of them. Each of those is one axiom.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** One clause set with its axioms, and what happens with and without them. */
function Worked({ clauses, caption }: { clauses: string[]; caption: string }) {
  const parsed = parseFoClauseSet(clauses, SIG)
  const axioms = equalityAxioms(parsed)
  const alone = findFoRefutation(parsed, 200).refuted
  const withAll = findFoRefutation([...parsed, ...axioms], 400).refuted

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

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-1.5 pr-3 whitespace-nowrap">#</th>
              <th className="py-1.5">Axiom</th>
            </tr>
          </thead>
          <tbody>
            {axioms.map((axiom, index) => (
              <tr key={index} className="border-t-2 border-dashed border-card-shade">
                <td className="py-1.5 pr-3 tabular-nums text-ink-soft">{index + 1}</td>
                <td className="py-1.5">
                  <FoClauseText clause={axiom} className="font-bold" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-sm font-bold">
        Without them: {alone ? 'refutable' : 'not refutable'}. With them:{' '}
        {withAll ? 'refutable' : 'still not refutable'}.
      </p>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        {axioms.length} axioms for {parsed.length} clauses — the schema is larger than the problem.
      </p>
    </Card>
  )
}

/** The same refutation using the equality *rules* instead. */
function WithoutAxioms({ clauses }: { clauses: string[] }) {
  const parsed = parseFoClauseSet(clauses, SIG)
  const equation = parsed.find((clause) =>
    clause.some((literal) => literal.predicate === '=' && !literal.negated),
  )
  const target = parsed.find((clause) =>
    clause.some((literal) => literal.predicate !== '='),
  )

  const steps =
    equation === undefined || target === undefined ? [] : paramodulants(equation, target)

  return (
    <>
      <p className="mt-2 text-sm font-bold">Paramodulation gives, in one step:</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {steps.map((step, index) => (
          <li key={index} className="formula rounded-xl bg-coin px-3 py-1 text-sm font-bold">
            {showFoClause(step.clause)}
          </li>
        ))}
        {steps.length === 0 && (
          <li className="text-sm text-ink-soft">Nothing here to rewrite.</li>
        )}
      </ul>
      <p className="mt-2 text-sm font-medium text-ink-soft">
        Resolve that against the remaining clause and ⊥ follows — with no axioms added at all. And
        reflexivity resolution handles the case the axioms need <Sym>x = x</Sym> for:{' '}
        <span className="formula font-bold">
          {reflexivitySteps(parseFoClauseSet(['¬=(x,x)'], SIG)[0] as FoClause).length > 0
            ? '¬=(x,x) gives □ directly'
            : '—'}
        </span>
        .
      </p>
    </>
  )
}
