/**
 * The instantiation method, and why resolution replaced it.
 *
 * The smallest witnesses shown are found by the game's own search, so the
 * counts are computed rather than claimed.
 */

import { findFoRefutation, parseFoClauseSet, type FoSignature } from '@/logic'
import { Callout, GuideSection, Prose } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'
import { availableInstances, smallestRefutation, type GilmoreQuestion } from './gilmore'

const SIG: FoSignature = { predicates: { p: 1, q: 1 }, functions: { a: 0, b: 0, f: 1 } }

export function GilmoreGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The method">
        <Card>
          <Prose>
            <p>
              Herbrand's theorem says an unsatisfiable clause set has a finite unsatisfiable set of
              ground instances. Gilmore's method takes that literally: enumerate the expansion, and
              after each new instance ask a propositional solver whether what you have so far is
              already contradictory.
            </p>
            <p>
              It is complete for unsatisfiable input — the witness is in there and enumeration will
              reach it. It simply never stops on satisfiable input, and first-order logic is
              undecidable, so no method can.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="What makes two instances contradict">
          <p>
            Ground atoms are propositional variables, so nothing is contradictory unless the{' '}
            <em>same</em> ground atom appears positively in one clause and negatively in another.
            Instances whose terms do not line up are dead weight.
          </p>
          <p className="mt-2">
            So do not enumerate blindly: look at which term would have to be shared, and instantiate
            towards it.
          </p>
        </Callout>

        <Callout tone="warn" title="This is the observation that becomes resolution">
          <p>
            The notes make it explicit after Figure 4.3: the contradiction can be reached without
            grounding everything, and there is no need to guess the right instance up front — you
            can wait until the two literals meet and let unification work out the instance then.
          </p>
          <p className="mt-2">
            That is first-order resolution. This game is the thing it improves on.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Worked">
        <Worked clauses={['¬p(x)', 'p(f(y))']} caption="Two clauses, two instances" />
        <Worked
          clauses={['¬p(x) ∨ q(f(x))', 'p(a())', '¬q(f(a()))']}
          caption="Three clauses that only meet at one term"
        />
        <Worked
          clauses={['p(x) ∨ q(x)', '¬p(a())', '¬q(a())']}
          caption="One instance of the first clause does it"
        />
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Pick a clause, pick a term for each variable, add the instance. The board says after
                every addition whether the set is contradictory yet.
              </li>
              <li>
                Every question is unsatisfiable, so it can always be won. The number that is enough is
                printed, so a long run is visible as a long run.
              </li>
              <li>
                Adding useless instances costs nothing but the clock — which is exactly the
                complaint that motivates unification.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** One clause set with its expansion size and smallest witness, computed. */
function Worked({ clauses, caption }: { clauses: string[]; caption: string }) {
  const parsed = parseFoClauseSet(clauses, SIG)
  const question: GilmoreQuestion = {
    predicates: SIG.predicates as Record<string, number>,
    functions: SIG.functions,
    clauses,
    depth: 1,
    par: 0,
  }
  const available = availableInstances(question)
  const smallest = smallestRefutation(question)
  const refuted = findFoRefutation(parsed, 300).refuted

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
              <th className="py-1.5 pr-3 whitespace-nowrap">Instances available</th>
              <th className="py-1.5 pr-3 whitespace-nowrap">Enough</th>
              <th className="py-1.5">Which ones</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t-2 border-dashed border-card-shade align-top">
              <td className="py-1.5 pr-3 tabular-nums">{available.length}</td>
              <td className="py-1.5 pr-3 tabular-nums font-bold">{smallest?.length ?? '—'}</td>
              <td className="formula py-1.5 font-bold">
                {smallest === null ? 'none found at this depth' : smallest.join(' · ')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className={`mt-2 text-sm font-bold ${refuted ? 'text-space-red' : 'text-grass-deep'}`}>
        {refuted
          ? `Unsatisfiable — and ${smallest?.length ?? 0} of the ${available.length} instances is all it takes.`
          : 'No refutation found, so enumeration would run forever.'}
      </p>
    </Card>
  )
}
