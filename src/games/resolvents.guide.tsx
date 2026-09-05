/**
 * How to compute all resolvents of a set of clauses.
 *
 * The worked exam question is computed by `allResolvents` — the same function
 * the game marks with — so the three resolvents below are found, not typed.
 */

import { allResolvents, clauses, isTautologicalClause, parse, sharedVariables, type Clause } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'

const C = (source: string): Clause => clauses(parse(source))[0] as Clause

export function ResolventsGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Why resolution matters">
        <Card>
          <Prose>
            <p>
              One inference rule sits behind SAT solvers, Prolog and first-order provers. Its magic
              property is <strong>refutation completeness</strong>: if a formula is unsatisfiable,
              resolution will find the empty clause. That is what lets a tool say “provably
              impossible” instead of “I tried and gave up”.
            </p>
            <p>
              This game drills the rule itself — one step at a time, on one pair at a time.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The rule">
        <Card>
          <Prose>
            <p>
              Two clauses, one variable appearing positively in one and negatively in the other.
              Delete <em>that pair</em> and glue the rest together.
            </p>
          </Prose>
          <div className="mt-3">
            <Example left="a ∨ b" right="¬a ∨ c" pivot="a" note="the ordinary case" />
          </div>
        </Card>

        <Callout tone="warn" title="Three rules that decide most of the marks">
          <p>
            <strong>One pivot per step.</strong> If two clauses clash on two variables you get{' '}
            <em>two separate resolvents</em>. You never cancel both at once.
          </p>
          <p className="mt-2">
            <strong>Cancelling one pivot while another clash remains gives a tautology.</strong> The
            surviving pair sits right there in the result.
          </p>
          <p className="mt-2">
            <strong>Clauses are sets.</strong> Duplicates collapse: <Sym>a ∨ b ∨ a</Sym> is{' '}
            <Sym>a ∨ b</Sym>.
          </p>
        </Callout>

        <Card>
          <Prose>
            <p>
              The two-clash case, worked both ways. Note that neither result is <Sym>□</Sym> —
              cancelling both pairs at once is not a resolution step, and it is the single most
              common wrong answer.
            </p>
          </Prose>
          <div className="mt-3">
            <Example left="a ∨ ¬c" right="¬a ∨ c" pivot="a" note="c and ¬c survive" />
            <Example left="a ∨ ¬c" right="¬a ∨ c" pivot="c" note="a and ¬a survive" />
          </div>
        </Card>
      </GuideSection>

      <GuideSection title="The method">
        <Card>
          <Prose>
            <p>
              Check <strong>every unordered pair</strong>, and inside each pair,{' '}
              <strong>every clashing variable separately</strong>. Nothing cleverer, and nothing
              less.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The exam question, worked">
        <WorkedPairs
          sources={['a ∨ b ∨ ¬c', '¬a ∨ d ∨ ¬e ∨ c', '¬d ∨ f']}
          caption="exam25a, Question 1.1b"
        />
        <Prose>
          <p>
            Three resolvents, two of them tautological. That is precisely why the question says
            “also include tautological resolvents” — it is testing whether you cancel one pivot at a
            time.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tick every candidate reachable in <strong>one</strong> resolution step. Tautological
                ones count.
              </li>
              <li>
                Every question has at least one tautological resolvent, so if you have ticked none
                you have missed something.
              </li>
              <li>
                The wrong answers on offer are the mistakes people actually make: both pivots
                cancelled at once, the two clauses merged with nothing cancelled, a literal dropped,
                a sign flipped.
              </li>
              <li>
                Partial credit applies, but a wrong tick costs as much as a miss — guessing broadly
                is worse than answering carefully.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Example({
  left,
  right,
  pivot,
  note,
}: {
  left: string
  right: string
  pivot: string
  note: string
}) {
  const a = C(left)
  const b = C(right)
  const step = allResolvents([a, b]).find((entry) => entry.pivot === pivot)
  if (step === undefined) return null

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t-2 border-dashed border-card-shade py-2 text-[0.95rem]">
      <ClauseText clause={a} className="font-bold" />
      <span className="text-ink-soft">+</span>
      <ClauseText clause={b} className="font-bold" />
      <span className="formula text-xs font-bold text-ink-soft">on {pivot}</span>
      <span className="text-ink-soft">=</span>
      <ClauseText clause={step.resolvent} className="font-bold" />
      <span className="ml-auto whitespace-nowrap text-xs font-semibold text-ink-soft">
        {isTautologicalClause(step.resolvent) ? 'tautology — ' : ''}
        {note}
      </span>
    </div>
  )
}

/** Every pair and every pivot, computed rather than listed. */
function WorkedPairs({ sources, caption }: { sources: string[]; caption: string }) {
  const set = sources.map(C)
  const pairs: { i: number; j: number }[] = []
  for (let i = 0; i < set.length; i++) {
    for (let j = i + 1; j < set.length; j++) pairs.push({ i, j })
  }

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <div className="mt-2 flex flex-col gap-1">
        {set.map((clause, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink-soft">C{index + 1}</span>
            <ClauseText clause={clause} className="text-base font-bold" />
          </div>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-2 pr-3 whitespace-nowrap">Pair</th>
              <th className="py-2 pr-3 whitespace-nowrap">Clashes on</th>
              <th className="py-2">Resolvent</th>
            </tr>
          </thead>
          <tbody>
            {pairs.flatMap(({ i, j }) => {
              const left = set[i] as Clause
              const right = set[j] as Clause
              const steps = allResolvents([left, right])

              if (steps.length === 0) {
                return [
                  <tr key={`${i}-${j}`} className="border-t-2 border-dashed border-card-shade">
                    <td className="py-2 pr-3 whitespace-nowrap font-bold">
                      C{i + 1}, C{j + 1}
                    </td>
                    <td className="py-2 pr-3 text-ink-soft">
                      {sharedVariables(left, right).length === 0 ? 'no shared variable' : 'no clash'}
                    </td>
                    <td className="py-2 text-ink-soft">none</td>
                  </tr>,
                ]
              }

              return steps.map((step) => (
                <tr key={`${i}-${j}-${step.pivot}`} className="border-t-2 border-dashed border-card-shade">
                  <td className="py-2 pr-3 whitespace-nowrap font-bold">
                    C{i + 1}, C{j + 1}
                  </td>
                  <td className="formula py-2 pr-3 font-bold">{step.pivot}</td>
                  <td className="py-2">
                    <ClauseText clause={step.resolvent} className="font-bold" />
                    {isTautologicalClause(step.resolvent) && (
                      <span className="ml-2 text-xs font-bold text-ink-soft">tautology</span>
                    )}
                  </td>
                </tr>
              ))
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
