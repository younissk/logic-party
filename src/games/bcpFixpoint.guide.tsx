/**
 * How to run BCP to fixpoint.
 *
 * Every run on this page is produced by `bcp` — the same function the game
 * marks with — so the exam answer below is computed, not transcribed.
 */

import { bcp, clauses, parse, showClauseSet, type Clause } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { ClauseSetText } from '@/ui/ClauseSet'
import { OUTCOME_LABELS } from './bcpFixpoint'

const S = (source: string): Clause[] => clauses(parse(source))

export function BcpFixpointGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Why this matters">
        <Card>
          <Prose>
            <p>
              Boolean constraint propagation is roughly <strong>80% of a modern SAT solver's
              runtime</strong>. It is also free: a unit clause has one literal, so there is no
              choice about it, and setting it shrinks the problem without any search at all.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The two moves">
        <Card>
          <Prose>
            <p>
              When a unit clause <Sym>(l)</Sym> is found, do exactly two things and nothing else
              (Definition 2.39):
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong>Delete</strong> every clause containing <Sym>l</Sym> — it is already
                satisfied.
              </li>
              <li>
                <strong>Erase</strong> <Sym>¬l</Sym> from every clause it appears in — that literal
                is dead, but the rest of the clause still has to be satisfied.
              </li>
            </ul>
            <p>
              A clause mentioning neither is untouched. Repeat until no unit clause remains.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="Delete versus erase">
          <p>
            These are not the same move and swapping them is the mistake the game's wrong answers
            are built from. <strong>Whole clauses</strong> go for the literal itself;{' '}
            <strong>single literals</strong> go for its complement.
          </p>
          <p className="mt-2">
            Erasing the last literal of a clause leaves the <strong>empty clause</strong> — that is
            a conflict, not a deletion.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The three outcomes">
        <Card>
          <Prose>
            <p>
              Naming which one you hit is half the question, and they are not symmetric.
            </p>
          </Prose>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-3 border-ink">
                  <th className="py-2 pr-3">Result</th>
                  <th className="py-2 pr-3">Means</th>
                  <th className="py-2">Example</th>
                </tr>
              </thead>
              <tbody>
                <OutcomeRow source="(¬a ∨ b ∨ ¬c) ∧ (a ∨ b) ∧ (¬a ∨ ¬b) ∧ (a)" />
                <OutcomeRow source="(¬a ∨ b ∨ ¬c) ∧ (a ∨ b) ∧ (¬a) ∧ (¬b)" />
                <OutcomeRow source="(¬a ∨ b ∨ ¬c) ∧ (a ∨ b) ∧ (¬a ∨ ¬b)" />
              </tbody>
            </table>
          </div>
          <Prose>
            <p className="mt-3">
              Note the asymmetry: the empty <em>formula</em> means satisfiable, the empty{' '}
              <em>clause</em> means unsatisfiable. Reading those two the wrong way round inverts
              your answer.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The exam question, worked">
        <Run source="a ∧ (¬a ∨ c ∨ d) ∧ (¬a ∨ b ∨ ¬c) ∧ (¬a ∨ ¬c) ∧ (a ∨ b) ∧ (¬d ∨ e ∨ f)" caption="exam25a, Question 1.1c" />
        <Prose>
          <p>
            Each propagation creates the next: <Sym>a</Sym> makes <Sym>(¬c)</Sym> a unit, which
            makes <Sym>(d)</Sym> a unit. Stopping after the first is the other classic slip.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>Pick the clause set BCP leaves at fixpoint. One tap.</li>
              <li>
                All three outcomes come up about equally often, so the empty formula and the empty
                clause are both real answers.
              </li>
              <li>
                Every question needs at least two propagations, so the second one is never optional.
              </li>
              <li>
                After you answer, the whole run is shown one unit at a time.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function OutcomeRow({ source }: { source: string }) {
  const run = bcp(S(source))
  return (
    <tr className="border-t-2 border-dashed border-card-shade align-top">
      <td className="py-2 pr-3">
        <ClauseSetText set={run.result} className="text-sm font-bold" />
      </td>
      <td className="py-2 pr-3 text-sm font-bold">{OUTCOME_LABELS[run.outcome]}</td>
      <td className="formula py-2 text-xs text-ink-soft">{source}</td>
    </tr>
  )
}

function Run({ source, caption }: { source: string; caption: string }) {
  const set = S(source)
  const run = bcp(set)
  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <p className="mt-1">
        <ClauseSetText set={set} className="text-[0.95rem] font-bold" />
      </p>
      <ol className="mt-3 flex flex-col gap-1.5 text-sm font-medium">
        {run.steps.map((step, index) => (
          <li key={index} className="flex flex-wrap items-baseline gap-x-2">
            <span className="formula font-bold">
              unit ({step.literal.negated ? '¬' : ''}
              {step.literal.name})
            </span>
            <span className="text-ink-soft">→</span>
            <ClauseSetText set={step.result} />
          </li>
        ))}
      </ol>
      <p className="mt-3 border-t-3 border-ink pt-2 text-base font-bold">
        {showClauseSet(run.result)} — {OUTCOME_LABELS[run.outcome]}
      </p>
    </Card>
  )
}
