/**
 * How conflict-driven clause learning works.
 *
 * The sequence below is produced by `cdcl` — the same function the game marks
 * with — so Example 2.45's learned clauses are computed, not transcribed.
 */

import { cdcl, clauses, parse, type Clause } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { ClauseSetText } from '@/ui/ClauseSet'
import { ClauseText } from '@/ui/ClauseText'

const S = (source: string): Clause[] => clauses(parse(source))
const NOTES = '(a ∨ b ∨ c) ∧ (a ∨ ¬b ∨ c) ∧ (a ∨ b ∨ ¬c) ∧ (a ∨ ¬b ∨ ¬c) ∧ (¬a ∨ c) ∧ (¬a ∨ ¬c)'

export function LearnedClauseGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="DPLL's upgrade">
        <Card>
          <Prose>
            <p>
              Plain DPLL forgets. Hit a conflict, undo the last decision, try the other value — and
              then walk into the same wall somewhere else, because nothing recorded why it failed.
            </p>
            <p>
              CDCL <strong>analyses the conflict and records a clause that forbids the whole
              region</strong>, then jumps back further than one step. It is the core of every modern
              solver.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="What gets learned">
        <Card>
          <Prose>
            <p>
              The decisions in force when the conflict happened were <em>jointly impossible</em>. So
              their negation is forced, and that negation is a clause.
            </p>
            <p>
              Decide <Sym>a = F</Sym> and <Sym>b = F</Sym>, hit a conflict, and{' '}
              <Sym>(a ∨ b)</Sym> is the learned clause: at least one of them has to go the other
              way.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="Decisions only">
          <p>
            Anything BCP derived is <em>already a consequence</em> of the decisions, so putting it
            into the clause adds nothing and makes the clause longer. A longer clause is a weaker
            one: it needs more literals falsified before it propagates, so it fires later and helps
            less.
          </p>
          <p className="mt-2">
            The other slip is forgetting to negate at all. You record the combination that is{' '}
            <strong>forbidden</strong>, not the one you tried.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The example from the notes">
        <Run source={NOTES} caption="Example 2.45" />
        <Prose>
          <p>
            Notice how little search that took. Two variables assigned by decision, everything else
            derived by BCP from clauses the solver taught itself — on a formula that cost plain DPLL
            a full tree.
          </p>
          <p>
            The last conflict arrives with <strong>no decision in force</strong>, which is what lets
            you conclude unsatisfiable rather than merely backtrack.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Two facts you need">
        <Card>
          <Prose>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>
                <strong>Learned clauses are always derivable by resolution.</strong> That is what
                makes adding one sound — you are not inventing a constraint, you are writing down
                one that was already entailed.
              </li>
              <li>
                <strong>That sequence is exactly a RUP certificate.</strong> The clauses a solver
                learns, in order, are the proof it hands you — which is the next topic.
              </li>
            </ol>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Decisions are shown as gold circles, propagations as white boxes — the same notation
                as the decision trees.
              </li>
              <li>
                Every question has at least one decision <em>and</em> at least one propagation, so
                telling them apart is always what is being asked.
              </li>
              <li>
                The wrong answers are the four specific slips: un-negated, propagations included,
                only the last decision, everything assigned.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Run({ source, caption }: { source: string; caption: string }) {
  const set = S(source)
  const run = cdcl(set)

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
              <th className="py-2 pr-2 w-8">#</th>
              <th className="py-2 pr-3">Decisions</th>
              <th className="py-2 pr-3">BCP forced</th>
              <th className="py-2">Learned</th>
            </tr>
          </thead>
          <tbody>
            {run.steps.map((step, index) => (
              <tr key={index} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="py-2 pr-2 font-bold">{index + 1}</td>
                <td className="formula py-2 pr-3 text-xs font-bold">
                  {step.decisions
                    .map((literal) => `${literal.name} = ${literal.negated ? 'F' : 'T'}`)
                    .join(', ')}
                </td>
                <td className="formula py-2 pr-3 text-xs">
                  {step.propagated.length === 0
                    ? '—'
                    : step.propagated
                        .map((literal) => `${literal.name} = ${literal.negated ? 'F' : 'T'}`)
                        .join(', ')}
                </td>
                <td className="py-2">
                  <ClauseText clause={step.learned} className="font-bold" />
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-dashed border-card-shade">
              <td className="py-2 pr-2 font-bold">{run.steps.length + 1}</td>
              <td className="py-2 pr-3 text-xs font-bold text-ink-soft">none</td>
              <td className="py-2 pr-3 text-xs text-ink-soft">conflict at once</td>
              <td className="formula py-2 font-bold">⊥</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-sm font-bold">
        {run.steps.map((step) => `(${step.learned.map((l) => `${l.negated ? '¬' : ''}${l.name}`).join(' ∨ ')})`).join(', ')}, then ⊥ —{' '}
        {run.unsatisfiable ? 'unsatisfiable' : 'satisfiable'}
      </p>
    </Card>
  )
}
