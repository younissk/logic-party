/** Tarski, Presburger, and what quantifier elimination buys. */

import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { ROUTE_CLAIMS } from './tarski.claims'

const LABELS: Record<string, string> = {
  qe: 'quantifier elimination',
  other: 'decidable another way',
  undecidable: 'undecidable',
}

export function TarskiGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What elimination buys">
        <Card>
          <Prose>
            <p>
              A theory that admits quantifier elimination turns every formula into a quantifier-free
              one. If the quantifier-free fragment can be evaluated — and over ℝ, over a dense
              order, over a finite universe, it can — then the theory is decidable. So{' '}
              <strong>QE gives decidability</strong>, in every case this chapter meets.
            </p>
            <p>
              The converse fails. <Sym>T(N,=,+)</Sym> is decidable and does not admit QE in its own
              signature; it needs divisibility-by-a-constant added first. Its decision procedure is
              an automaton construction instead. Keeping those two properties apart is what the
              exam's true/false lines are checking.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="Tarski's theorem">
          <p>
            <Sym>T(R,=,+,*)</Sym> admits quantifier elimination, so it is decidable. Every formula
            reduces to a boolean combination of polynomial comparisons — which is why the solution
            sets in this chapter are regions bounded by curves and nothing stranger. The cost is
            doubly exponential in the number of quantifiers, so "decidable" here does not mean
            "practical".
          </p>
        </Callout>

        <Callout tone="warn" title="Every inconsistent theory admits QE">
          <p>
            It contains every formula, so <Sym>⊤</Sym> is a quantifier-free equivalent of anything.
            exam26a asks this directly, and the answer is true for a reason that feels like a
            technicality and is not: the definition asks for an equivalent formula in the theory,
            and an inconsistent theory has all of them.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Every theory in the chapter">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-2 py-1">theory</th>
                  <th className="px-2 py-1">route</th>
                  <th className="px-2 py-1">why</th>
                </tr>
              </thead>
              <tbody>
                {ROUTE_CLAIMS.map((claim) => (
                  <tr key={claim.id} className="align-top">
                    <td className="px-2 py-1 font-logic font-bold">{claim.text}</td>
                    <td className="px-2 py-1 font-semibold">{LABELS[claim.bin]}</td>
                    <td className="px-2 py-1 text-ink-soft">{claim.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Callout tone="warn" title="Decidable is not the same as easy, or as axiomatizable">
          <p>
            The reals are decidable and doubly exponential. Presburger arithmetic is decidable and
            not finitely axiomatizable. And a theory can be complete without being decidable —{' '}
            <Sym>T(N,=,+,*)</Sym> is. Four properties, four independent questions.
          </p>
        </Callout>
      </GuideSection>
    </div>
  )
}
