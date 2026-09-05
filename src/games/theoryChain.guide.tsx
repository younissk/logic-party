/**
 * How to prove E ⊢ t=t′.
 *
 * The chains shown are found by `derive` — the function the game marks with —
 * so each one really is a shortest proof, and Example 3.17's own equations are
 * decided rather than copied.
 */

import {
  derive,
  parseEquation,
  showTerm,
  type Equation,
  type Signature,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { EquationText, TermText } from '@/ui/TermText'

const SIG: Signature = { f: 1, g: 2 }
const IDEM = ['f(x)=f(f(x))']

export function TheoryChainGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What ⊢ means">
        <Card>
          <Prose>
            <p>
              Definition 3.16 builds the equational theory of <Sym>E</Sym> as the smallest set
              containing E and closed under four rules: instantiate an equation, rewrite a subterm
              with one, and the three properties of equality — reflexivity, symmetry, transitivity.
            </p>
            <p>
              As a procedure those four collapse into a single move, repeated.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="The one move">
          <p>
            Find a subterm of the current term that <strong>matches one side</strong> of an axiom,
            and replace it with the other side under the same substitution. That is it.
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            <li>The matching is rule 2 — instantiation.</li>
            <li>“A subterm” is rule 3 — rewriting inside a term.</li>
            <li>“Either side” is symmetry; axioms are equations, not one-way rules.</li>
            <li>Repeating it is transitivity, and the chain is the proof.</li>
          </ul>
        </Callout>

        <Callout tone="warn" title="Both directions, always">
          <p>
            An axiom <Sym>l = r</Sym> lets you replace an instance of <Sym>l</Sym> by{' '}
            <Sym>r</Sym> <em>and</em> an instance of <Sym>r</Sym> by <Sym>l</Sym>. Chains that only
            ever shrink terms miss half the theory — sometimes you have to grow a term before you
            can shrink it somewhere else.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Example 3.17, decided">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            E = {'{'}f(x)=f(f(x)){'}'}
          </p>
          <Table
            axioms={IDEM}
            goals={[
              'g(x,f(f(x)))=g(x,f(x))',
              'f(f(x))=f(x)',
              'f(f(f(x)))=f(f(f(f(x))))',
              'g(f(f(x)),f(x))=g(f(x),f(f(x)))',
              'f(x)=f(y)',
              'g(x,y)=g(x,f(y))',
            ]}
          />
          <p className="mt-3 text-sm font-medium text-ink-soft">
            The two that fail do so for the same reason: no chain can change which variables a term
            contains, because every step replaces an instance of one side by the matching instance
            of the other, and both sides of this axiom have the same variables.
          </p>
        </Card>
      </GuideSection>

      <GuideSection title="A chain, in full">
        <Chain
          axioms={IDEM}
          goal="f(f(f(x)))=f(f(f(f(x))))"
          caption="Grow it once, and you are there"
        />
      </GuideSection>

      <GuideSection title="Why this is not just search">
        <Callout tone="warn" title="The graph is infinite">
          <p>
            From any term there are usually several moves, and from each of those several more, with
            no bound on how large terms may get. That is the difficulty §3.3 opens with, and it is
            why the rest of the chapter builds normal forms instead.
          </p>
          <p className="mt-2">
            The game caps how large terms may grow, which keeps the board finite. Real derivations
            have no such cap.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Every legal next term is listed, with the axiom that produces it. Pick one and it
                joins the chain.
              </li>
              <li>
                Undo freely — a wrong turning costs nothing but the clock, and the shortest chain is
                stated up front so you know when you have wandered.
              </li>
              <li>
                Every question is derivable. If nothing applies, you have walked into a corner: undo
                and take a different route.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

const read = (sources: readonly string[]): Equation[] =>
  sources.map((source) => parseEquation(source, SIG))

/** Which of these follow, decided by `derive`. */
function Table({ axioms, goals }: { axioms: string[]; goals: string[] }) {
  const set = read(axioms)
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-3 border-ink">
            <th className="py-2 pr-3 whitespace-nowrap">Equation</th>
            <th className="py-2 pr-3 whitespace-nowrap">E ⊢ it?</th>
            <th className="py-2">Steps</th>
          </tr>
        </thead>
        <tbody>
          {goals.map((source) => {
            const goal = parseEquation(source, SIG)
            const found = derive(set, goal, { maxSize: 12, maxTerms: 4000 })
            return (
              <tr key={source} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="py-2 pr-3 whitespace-nowrap">
                  <EquationText left={goal.left} right={goal.right} className="font-bold" />
                </td>
                <td
                  className={`py-2 pr-3 font-bold ${found.derivable ? 'text-grass-deep' : 'text-space-red'}`}
                >
                  {found.derivable ? 'yes' : 'no'}
                </td>
                <td className="py-2 tabular-nums text-ink-soft">
                  {found.derivable ? found.chain.length - 1 : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** One derivation, printed link by link. */
function Chain({
  axioms,
  goal,
  caption,
}: {
  axioms: string[]
  goal: string
  caption: string
}) {
  const set = read(axioms)
  const target = parseEquation(goal, SIG)
  const found = derive(set, target, { maxSize: 12, maxTerms: 4000 })

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <p className="mt-2">
        <EquationText left={target.left} right={target.right} className="text-lg font-bold" />
      </p>
      <ol className="mt-3 flex flex-col gap-1">
        {found.chain.map((term, index) => (
          <li key={index} className="flex items-baseline gap-2 rounded-xl bg-card-shade px-3 py-1.5">
            <span className="w-4 shrink-0 text-xs font-bold text-ink-soft">{index}</span>
            <TermText term={term} className="text-base font-bold" />
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs font-medium text-ink-soft">
        {found.chain.length - 1} steps, found by the same search the game marks with. Ends at{' '}
        {showTerm(found.chain[found.chain.length - 1] as never)}.
      </p>
    </Card>
  )
}
