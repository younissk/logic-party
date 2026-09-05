/**
 * How the DP procedure works.
 *
 * The worked run is produced by `dp` and `eliminateVariable` — the same
 * functions the game marks with.
 */

import { clauses, dp, eliminateVariable, parse, type Clause } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { ClauseSetText } from '@/ui/ClauseSet'
import { ClauseText } from '@/ui/ClauseText'

const S = (source: string): Clause[] => clauses(parse(source))

const EXAM = '(¬x ∨ y ∨ z) ∧ (x ∨ ¬y) ∧ (x ∨ ¬y ∨ ¬z) ∧ (x ∨ y ∨ ¬z) ∧ (x ∨ y ∨ z) ∧ (¬x ∨ ¬z)'

export function DpEliminateGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="DP is not DPLL">
        <Card>
          <Prose>
            <p>
              They share three letters and almost nothing else. <strong>DP has no tree and no
              backtracking.</strong> It deletes variables one at a time by resolution until nothing
              is left.
            </p>
            <p>
              DPLL <em>guesses</em> variables and undoes the guess. DP <em>eliminates</em> them and
              never looks back. Confusing the two is the standard way to lose this question.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="One elimination">
        <Card>
          <Prose>
            <p>To eliminate <Sym>v</Sym>, in this order:</p>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>
                Resolve <strong>every</strong> clause containing <Sym>v</Sym> against{' '}
                <strong>every</strong> clause containing <Sym>¬v</Sym>. With 4 positives and 2
                negatives that is 8 products.
              </li>
              <li>
                <strong>Throw away the tautologies.</strong> There are usually more of them than you
                expect.
              </li>
              <li>
                <strong>Delete all the originals</strong> mentioning <Sym>v</Sym> — positive and
                negative alike — and add the survivors.
              </li>
            </ol>
            <p>
              Clauses that never mentioned <Sym>v</Sym> carry straight over untouched.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="The endpoint rule">
          <p>
            The only thing you must not confuse:
          </p>
          <p className="mt-2">
            Ends with the <strong>empty formula</strong> — every clause gone — →{' '}
            <strong>satisfiable</strong>.
          </p>
          <p className="mt-1">
            Produces the <strong>empty clause</strong> → <strong>unsatisfiable</strong>.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The exam question, worked">
        <Worked source={EXAM} caption="exam26a, Question 1.2" />
        <Prose>
          <p>
            Ends with the empty formula, so the formula is satisfiable. You can check it directly:{' '}
            <Sym>x = T, y = T, z = F</Sym> satisfies every original clause.
          </p>
          <p>
            Note the last step: nothing contains <Sym>z</Sym> positively, so there are no resolvents
            at all and the clause simply disappears. That is not a mistake — a variable of one
            polarity only is always removable.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>One variable per question. Pick the clause set that eliminating it leaves.</li>
              <li>
                Every question drops at least one tautological resolvent, because that is the step
                people skip.
              </li>
              <li>
                The wrong answers are the three specific slips: tautologies kept, originals not
                deleted, resolvents never added.
              </li>
              <li>After you answer, the counts are shown — deleted, resolved, dropped, kept.</li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Worked({ source, caption }: { source: string; caption: string }) {
  const set = S(source)
  const run = dp(set)
  let current = set

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <p className="mt-1">
        <ClauseSetText set={set} className="text-[0.95rem] font-bold" />
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-2 pr-3">Eliminate</th>
              <th className="py-2 pr-3 whitespace-nowrap">Gone / resolvents / dropped</th>
              <th className="py-2">Leaves</th>
            </tr>
          </thead>
          <tbody>
            {run.steps.map((step, index) => {
              const detail = eliminateVariable(current, step.variable)
              current = detail.result
              return (
                <tr key={index} className="border-t-2 border-dashed border-card-shade align-top">
                  <td className="formula py-2 pr-3 font-bold">{step.variable}</td>
                  <td className="py-2 pr-3 text-xs">
                    {detail.removed.length} / {detail.added.length + detail.discarded.length} /{' '}
                    {detail.discarded.length} tautological
                    <span className="mt-0.5 flex flex-wrap gap-x-2">
                      {detail.added.map((clause, i) => (
                        <ClauseText key={i} clause={clause} className="text-xs font-bold" />
                      ))}
                    </span>
                  </td>
                  <td className="py-2">
                    <ClauseSetText set={detail.result} className="text-xs" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 border-t-3 border-ink pt-2 text-base font-bold">
        {run.result.length === 0 ? 'Empty formula — satisfiable' : 'Empty clause — unsatisfiable'}
      </p>
    </Card>
  )
}
