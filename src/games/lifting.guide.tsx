/**
 * The Lifting Lemma.
 *
 * Every general and ground step shown is produced by `foBinaryResolvents`, and
 * the instance relation by the game's own `isInstanceOf`.
 */

import {
  applyToClause,
  foBinaryResolvents,
  parseFoClauseSet,
  parseTerm,
  showFoClause,
  type FoClause,
  type FoSignature,
  type Signature,
  type Substitution,
} from '@/logic'
import { Callout, GuideSection, Prose } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'
import { isInstanceOf } from './lifting'

const FUNCS: Signature = { a: 0, b: 0, f: 2 }
const SIG: FoSignature = { predicates: { p: 2, q: 1 }, functions: FUNCS }

export function LiftingGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What the lemma says">
        <Card>
          <Prose>
            <p>
              Take two clauses, instantiate them, and resolve the instances. The lemma says the
              result is an <strong>instance of a resolvent of the originals</strong> — the
              first-order step always exists, and it is at least as general.
            </p>
            <p>
              Together with Herbrand's theorem and the completeness of propositional resolution, that
              gives Theorem 4.30: first-order resolution is refutationally complete. A refutation
              exists on the ground level, and this lemma lifts it, step for step, to the general one.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="Why it is the right theorem to want">
          <p>
            Grounding is where the search explodes. The lemma says nothing is lost by refusing to
            ground: whatever the ground proof could do, the general one can do too, at the same
            length.
          </p>
        </Callout>

        <Callout tone="warn" title="More general, not equal">
          <p>
            The general resolvent usually has variables where the ground one has terms, and it may
            be strictly more general than any instance you needed. That is the saving — one general
            clause stands for infinitely many ground ones.
          </p>
        </Callout>

        <Callout tone="warn" title="One substitution for the whole clause">
          <p>
            Being an instance means <em>one</em> σ turns the general clause into the ground one. A
            variable appearing in two literals must become the same term in both, which is exactly
            what a per-literal check would miss.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The notes' own example">
        <Worked
          first="p(x,x) ∨ ¬q(x)"
          second="¬p(a(),y)"
          sigmaFirst={{ x: 'a()' }}
          sigmaSecond={{ y: 'a()' }}
          caption="From Figures 4.3 and 4.4 — the ground step and the step above it"
        />
      </GuideSection>

      <GuideSection title="And one with a function symbol">
        <Worked
          first="¬p(x,y) ∨ q(x)"
          second="p(a(),f(b(),b()))"
          sigmaFirst={{ x: 'a()', y: 'f(b(),b())' }}
          sigmaSecond={{}}
          caption="The ground instance needs a term the general step never mentions"
        />
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                The ground step is shown at the top. Resolve two of the general clauses below it and
                pick the resolvent the ground one instantiates.
              </li>
              <li>
                The board tells you, before you submit, whether the ground clause really is an
                instance of what you picked.
              </li>
              <li>
                Picking something more general than the ground clause but not actually a resolvent
                is marked as its own mistake — the lemma is about steps the rule produces.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** A general step and its ground shadow, both computed. */
function Worked({
  first,
  second,
  sigmaFirst,
  sigmaSecond,
  caption,
}: {
  first: string
  second: string
  sigmaFirst: Record<string, string>
  sigmaSecond: Record<string, string>
  caption: string
}) {
  const [one, two] = parseFoClauseSet([first, second], SIG) as [FoClause, FoClause]
  const read = (mapping: Record<string, string>): Substitution =>
    Object.fromEntries(
      Object.entries(mapping).map(([name, source]) => [name, parseTerm(source, FUNCS)]),
    )

  const groundOne = applyToClause(read(sigmaFirst), one)
  const groundTwo = applyToClause(read(sigmaSecond), two)

  const generalSteps = foBinaryResolvents(one, two)
  const groundSteps = foBinaryResolvents(groundOne, groundTwo)
  const groundResolvent = groundSteps[0]?.clause

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-1.5 pr-3 whitespace-nowrap">Level</th>
              <th className="py-1.5 pr-3">Parents</th>
              <th className="py-1.5">Resolvent</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t-2 border-dashed border-card-shade align-top">
              <td className="py-1.5 pr-3 font-bold whitespace-nowrap">first-order</td>
              <td className="py-1.5 pr-3">
                <FoClauseText clause={one} className="block font-bold" />
                <FoClauseText clause={two} className="block font-bold" />
              </td>
              <td className="py-1.5">
                {generalSteps.map((step, index) => (
                  <FoClauseText key={index} clause={step.clause} className="block font-bold" />
                ))}
              </td>
            </tr>
            <tr className="border-t-2 border-dashed border-card-shade align-top">
              <td className="py-1.5 pr-3 font-bold whitespace-nowrap">ground</td>
              <td className="py-1.5 pr-3">
                <FoClauseText clause={groundOne} className="block font-bold" />
                <FoClauseText clause={groundTwo} className="block font-bold" />
              </td>
              <td className="py-1.5">
                {groundResolvent === undefined ? (
                  <span className="text-ink-soft">no resolvent</span>
                ) : (
                  <FoClauseText clause={groundResolvent} className="font-bold" />
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-sm font-bold">
        {groundResolvent !== undefined &&
        generalSteps.some((step) => isInstanceOf(step.clause, groundResolvent))
          ? `${showFoClause(groundResolvent)} is an instance of the first-order resolvent — the step lifts.`
          : 'No lifting relation here.'}
      </p>
    </Card>
  )
}
