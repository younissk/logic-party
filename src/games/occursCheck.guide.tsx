/**
 * Why the occurs check exists.
 *
 * The runaway is unfolded by `unfold` — the same function the game animates —
 * so the growing terms on this page are the ones the naive algorithm really
 * produces, not an illustration of them.
 */

import { occurs, parseTerm, showTerm, unify, type Signature } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { TermText } from '@/ui/TermText'
import { unfold } from './occursCheck'

const SIG: Signature = { f: 1, g: 2, h: 1 }

export function OccursCheckGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The rule">
        <Card>
          <Prose>
            <p>
              At a mismatch between a variable <Sym>x</Sym> and a term <Sym>s</Sym>, unification
              binds <Sym>x ↦ s</Sym> — unless <Sym>s</Sym> contains <Sym>x</Sym>, in which case
              there is no unifier and the algorithm stops.
            </p>
            <p>
              That is one line of Algorithm 3.13 and it is the line people leave out. It is also the
              only place the algorithm can fail without two function symbols disagreeing.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="Why not just apply it anyway?">
          <p>
            Because it does not repair the mismatch, it relocates it. Every application makes both
            terms bigger and leaves the same variable against the same shape one level deeper. The
            table below is that, unrolled.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The notes' example, unrolled">
        <Runaway left="f(x)" right="f(f(x))" caption="Example 3.15.3 — the mismatch runs away" />
      </GuideSection>

      <GuideSection title="And one that does resolve">
        <Runaway left="f(x)" right="f(g(y,z))" caption="x is not inside the term — one step and done" />
      </GuideSection>

      <GuideSection title="Telling them apart without applying anything">
        <Card>
          <Prose>
            <p>
              Look at the term the variable would become and ask whether that variable appears
              anywhere inside it — at any depth, in any argument. That is the whole test.
            </p>
          </Prose>
          <Table
            rows={[
              ['x', 'f(x)'],
              ['x', 'f(y)'],
              ['x', 'g(y,f(x))'],
              ['x', 'g(y,f(z))'],
            ]}
          />
          <p className="mt-3 text-sm font-medium text-ink-soft">
            Depth does not matter and neither does which argument it hides in. One occurrence
            anywhere is enough.
          </p>
        </Card>

        <Callout tone="warn" title="It only bites when a variable is shared">
          <p>
            A variable that appears on one side only can never trigger the check. So when two terms
            have been renamed apart — as the rules in a critical pair always are — the occurs check
            is much rarer than it looks. When they have not, it is the first thing to suspect.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                “Apply it” does the naive thing on purpose — no occurs check. Press it a few times
                and the answer becomes obvious, which is the point.
              </li>
              <li>
                You do not have to press it at all. Reading the term and spotting the variable is
                faster, and the clock notices.
              </li>
              <li>
                Half the questions do resolve, so “it never resolves” is not a free answer.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** The chain the naive algorithm produces, computed by `unfold`. */
function Runaway({ left, right, caption }: { left: string; right: string; caption: string }) {
  const one = parseTerm(left, SIG)
  const two = parseTerm(right, SIG)
  const chain = unfold(one, two, 4)
  const result = unify(one, two)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-1.5 pr-3 whitespace-nowrap">After</th>
              <th className="py-1.5 pr-3">t₁</th>
              <th className="py-1.5">t₂</th>
            </tr>
          </thead>
          <tbody>
            {chain.map((pair, index) => (
              <tr key={index} className="border-t-2 border-dashed border-card-shade">
                <td className="py-1.5 pr-3 tabular-nums text-ink-soft">
                  {index === 0 ? 'start' : `${index}`}
                </td>
                <td className="py-1.5 pr-3">
                  <TermText term={pair.left} className="font-bold" />
                </td>
                <td className="py-1.5">
                  <TermText term={pair.right} className="font-bold" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p
        className={`mt-2 text-sm font-bold ${result.unified ? 'text-grass-deep' : 'text-space-red'}`}
      >
        {result.unified
          ? 'They meet, and the algorithm carries on.'
          : 'They never meet — Algorithm 3.13 stops here rather than looping.'}
      </p>
    </Card>
  )
}

/** The test itself, applied to a few shapes. */
function Table({ rows }: { rows: [string, string][] }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-3 border-ink">
            <th className="py-2 pr-3 whitespace-nowrap">Binding</th>
            <th className="py-2 pr-3 whitespace-nowrap">Occurs?</th>
            <th className="py-2">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, source]) => {
            const term = parseTerm(source, SIG)
            const inside = occurs(name, term)
            return (
              <tr key={`${name}|${source}`} className="border-t-2 border-dashed border-card-shade">
                <td className="formula py-2 pr-3 font-bold whitespace-nowrap">
                  {name} ↦ {showTerm(term)}
                </td>
                <td
                  className={`py-2 pr-3 font-bold ${inside ? 'text-space-red' : 'text-grass-deep'}`}
                >
                  {inside ? 'yes' : 'no'}
                </td>
                <td className="py-2 text-ink-soft">
                  {inside ? 'no unifier — the check fires' : 'bind it and carry on'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
