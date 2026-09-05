/**
 * Factoring, and the example that proves it is needed.
 *
 * Every factor and every resolvent on this page is computed by the functions
 * the game marks with.
 */

import {
  findFoRefutation,
  foBinaryResolvents,
  foFactors,
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
  predicates: { p: 1, q: 1, shaves: 2 },
  functions: { a: 0, b: 0, f: 1, barber: 0 },
}

export function FactoringGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The rule">
        <Card>
          <Prose>
            <p>
              <strong>Definition 4.26.</strong> If a clause <Sym>C</Sym> contains two literals that
              unify with mgu <Sym>σ</Sym>, then <Sym>σ(C)</Sym> is a <strong>factor</strong> of C.
              Since a clause is a set, the two now-identical literals appear once.
            </p>
            <p>
              Definition 4.28 folds this into resolution: a first-order resolvent is a binary
              resolvent of the two clauses, or of a factor of one, or of factors of both.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="Same sign, not opposite">
          <p>
            Factoring merges two literals that are <em>both</em> positive or <em>both</em> negative.
            Opposite signs in one clause make a tautology, which is a different and much less useful
            thing.
          </p>
        </Callout>

        <Callout tone="warn" title="You may not just drop a literal">
          <p>
            Every wrong answer in Exercise 9's list is this: a clause with one literal deleted, or a
            variable instantiated to something no pair demanded. A factor is what a specific mgu
            does to the <em>whole</em> clause.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Why it is needed at all">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            The barber — Example 4.25
          </p>
          <Prose>
            <p>
              <Sym>∀x:(shaves(barber,x) ↔ ¬shaves(x,x))</Sym> is contradictory, and binary
              resolution alone cannot show it: every resolvent of its two clauses is a tautology.
            </p>
          </Prose>
          <Barber />
        </Card>
      </GuideSection>

      <GuideSection title="Exercise 9's clause">
        <Worked
          source="p(a()) ∨ p(b()) ∨ p(x) ∨ q(x) ∨ q(y) ∨ p(f(x)) ∨ ¬p(x)"
          caption="Which clauses can be derived by factorization?"
        />
        <Prose>
          <p>
            Note what unifying <Sym>p(x)</Sym> with <Sym>p(a())</Sym> does to <Sym>q(x)</Sym>: it
            becomes <Sym>q(a())</Sym>. The substitution reaches every literal, not just the two
            being merged, and that is what the exercise's distractors leave out.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tap two literals. If they unify, the factor lands in your tray; if they do not, the
                board shakes and nothing happens.
              </li>
              <li>
                Two different pairs can give the same factor — the second one is refused as a
                duplicate.
              </li>
              <li>
                Every question has at least one factor, so there is always something to find.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** The barber's clauses, their resolvents, and what factoring adds. */
function Barber() {
  const clauses = parseFoClauseSet(
    ['¬shaves(barber(),x) ∨ ¬shaves(x,x)', 'shaves(barber(),y) ∨ shaves(y,y)'],
    SIG,
  ) as [FoClause, FoClause]
  const binary = foBinaryResolvents(clauses[0], clauses[1])
  const factorsOne = foFactors(clauses[0])
  const factorsTwo = foFactors(clauses[1])
  const refuted = findFoRefutation(clauses, 200).refuted

  return (
    <>
      <div className="mt-2 flex flex-col gap-1">
        {clauses.map((clause, index) => (
          <div key={index} className="rounded-xl bg-card-shade px-3 py-1.5">
            <FoClauseText clause={clause} className="font-bold" />
          </div>
        ))}
      </div>

      <p className="mt-3 text-sm font-bold">Binary resolvents — all tautologies</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {binary.map((step, index) => (
          <li key={index} className="formula rounded-xl bg-card-shade px-3 py-1 text-sm font-bold">
            {showFoClause(step.clause)}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm font-bold">The factors</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {[...factorsOne, ...factorsTwo].map((factor, index) => (
          <li key={index} className="formula rounded-xl bg-coin px-3 py-1 text-sm font-bold">
            {showFoClause(factor.clause)}
          </li>
        ))}
      </ul>

      <p className={`mt-2 text-sm font-bold ${refuted ? 'text-space-red' : 'text-ink-soft'}`}>
        {refuted
          ? 'Resolving those two factors gives ⊥ immediately — which binary resolution alone never reaches.'
          : 'No refutation found.'}
      </p>
    </>
  )
}

/** One clause with every factor and the pair that produced it. */
function Worked({ source, caption }: { source: string; caption: string }) {
  const clause = parseFoClauseSet([source], SIG)[0] as FoClause
  const found = foFactors(clause)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <p className="mt-1">
        <FoClauseText clause={clause} className="text-sm font-bold" />
      </p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-1.5 pr-3 whitespace-nowrap">Pair</th>
              <th className="py-1.5 pr-3 whitespace-nowrap">mgu</th>
              <th className="py-1.5">Factor</th>
            </tr>
          </thead>
          <tbody>
            {found.map((factor, index) => (
              <tr key={index} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="formula py-1.5 pr-3 font-bold whitespace-nowrap">
                  {showFoLiteral(factor.left)} · {showFoLiteral(factor.right)}
                </td>
                <td className="formula py-1.5 pr-3 whitespace-nowrap">
                  {showSubstitution(factor.sigma)}
                </td>
                <td className="formula py-1.5 font-bold">{showFoClause(factor.clause)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm font-medium text-ink-soft">
        {found.length} factor{found.length === 1 ? '' : 's'}, up to the order the literals are
        written in.
      </p>
    </Card>
  )
}
