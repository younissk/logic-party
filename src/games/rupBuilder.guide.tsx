/**
 * Writing a RUP proof rather than checking one.
 *
 * Every line below is verified by `hasRupProperty` and `bcp` — the same
 * functions the game marks with.
 */

import { bcp, checkRupProof, clauses, negateClause, parse, showClauseSet, type Clause } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'

const S = (source: string): Clause[] => clauses(parse(source))
const C = (source: string): Clause => clauses(parse(source))[0] as Clause

export function RupBuilderGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Finding beats checking">
        <Card>
          <Prose>
            <p>
              A resolution refutation makes you name the parents of every step. A RUP proof makes
              you name <em>nothing</em>: each line is checked by propagation alone, so a line either
              works or it does not, and you find out immediately.
            </p>
            <p>
              That turns proof-writing into guessing well: <strong>propose a small clause, watch
              propagation, keep it if it crashes.</strong>
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The loop">
        <Card>
          <Prose>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>
                <strong>Guess a unit.</strong> Units constrain the most and are the shortest thing
                to try. There are only 2n of them.
              </li>
              <li>
                <strong>Negate it and propagate.</strong> A unit <Sym>(l)</Sym> negates to the
                single unit <Sym>(¬l)</Sym>. Add it and run BCP.
              </li>
              <li>
                <strong>Crashed? Keep the line.</strong> It is implied, so adding it is safe, and
                the formula is now stronger for the next line.
              </li>
              <li>
                <strong>Try ⊥ each time.</strong> It has the property exactly when plain propagation
                already reaches a conflict — which is what the last line always is.
              </li>
            </ol>
          </Prose>
        </Card>

        <Callout tone="warn" title="Negation gives units, plural">
          <p>
            A clause of n literals negates into <strong>n separate unit clauses</strong>, not one
            clause. <Sym>¬(a ∨ ¬b)</Sym> is <Sym>(¬a) ∧ (b)</Sym>. Getting this wrong is where the
            marks go, and it is why longer lines propagate harder than you expect — every literal
            you add is another forced assignment.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The exam question, line by line">
        <Proof
          source="(¬a ∨ b) ∧ (¬a ∨ ¬b) ∧ (a ∨ ¬c) ∧ (a ∨ c)"
          proof={['¬a', '⊥']}
          caption="exam26a Q1.3"
        />
        <Prose>
          <p>
            Two lines. And note the second only works <em>because of</em> the first: on its own,
            plain propagation on the original four clauses finds no unit at all and stops
            immediately.
          </p>
          <p>
            That is the shape of every RUP proof — each line makes the next one cheaper, until
            propagation alone is enough.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tap literal chips to build a line. The panel shows the units your negation adds and
                what propagation left — you never have to guess whether a line works.
              </li>
              <li>
                <strong>Add this line</strong> is refused unless propagation actually crashes, so an
                unsound proof cannot be built.
              </li>
              <li>
                <strong>Finish with ⊥</strong> only works once plain propagation reaches a conflict.
                Until then it tells you it is not yet.
              </li>
              <li>
                Each question has a par. Extra lines still prove it — they just cost score, the same
                way a wandering refutation does.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Proof({ source, proof, caption }: { source: string; proof: string[]; caption: string }) {
  const set = S(source)
  const lines: Clause[] = proof.map((entry) => (entry === '⊥' ? ([] as Clause) : C(entry)))
  const verdict = checkRupProof(set, lines)
  let context = [...set]

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {set.map((clause, index) => (
          <ClauseText key={index} clause={clause} className="text-sm font-bold" />
        ))}
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-2 pr-2 w-8">#</th>
              <th className="py-2 pr-3">Line</th>
              <th className="py-2 pr-3 whitespace-nowrap">Negates to</th>
              <th className="py-2">Propagates to</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const added = negateClause(line)
              const run = bcp([...context, ...added])
              context = [...context, line]
              return (
                <tr key={index} className="border-t-2 border-dashed border-card-shade align-top">
                  <td className="py-2 pr-2 font-bold">{index + 1}</td>
                  <td className="py-2 pr-3">
                    <ClauseText clause={line} className="font-bold" />
                  </td>
                  <td className="formula py-2 pr-3 text-xs">
                    {added.length === 0 ? 'nothing' : showClauseSet(added)}
                  </td>
                  <td className="formula py-2 text-xs font-bold">
                    {run.outcome === 'unsatisfiable' ? '⊥ ✓' : `${showClauseSet(run.result)} ✗`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-base font-bold">
        {verdict.ok ? `Checks out in ${lines.length} lines` : 'Does not check'}
      </p>
    </Card>
  )
}
