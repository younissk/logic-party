/**
 * How to turn any formula into CNF by hand.
 *
 * The worked runs on this page are produced by `cnfPipeline` — the same
 * function the game marks with — so the steps shown here are the steps the
 * game expects, and the notes' own example is reproduced rather than retyped.
 */

import { useState } from 'react'

import {
  CNF_STEPS,
  CNF_STEP_LABELS,
  CNF_STEP_RULES,
  clauses,
  cnfPipeline,
  nextCnfStep,
  parse,
  showClause,
  size,
  type CnfStep,
} from '@/logic'
import { Callout, F, GuideSection, Prose, Sym } from '@/ui/guide'
import { Button, Card } from '@/ui/primitives'
import { FormulaText } from '@/ui/FormulaText'

export function CnfPipelineGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What you are being asked">
        <Card>
          <Prose>
            <p>
              A formula is in <strong>conjunctive normal form</strong> when it is a conjunction of
              clauses, and a clause is a disjunction of literals — a variable or a negated variable,
              nothing more (Definition 2.14). <F>(¬a ∨ b) ∧ (¬c ∨ a)</F> is CNF;{' '}
              <F>¬(a ∧ b) ∨ c</F> is not, because a negation sits on a conjunction.
            </p>
            <p>
              Every formula has an equivalent CNF, and you get there by applying the laws of Example
              2.12 in a fixed order. The game shows you a formula partway through and asks the only
              question the algorithm ever asks: <strong>which move is next?</strong>
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The ladder">
        <Card>
          <Prose>
            <p>
              Scan top to bottom. The first rung that applies is the move — there is never a choice,
              and never a reason to improvise.
            </p>
          </Prose>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-3 border-ink text-sm">
                  <th className="py-2 pr-2 w-9">#</th>
                  <th className="py-2 pr-3">Move</th>
                  <th className="py-2">Rewrite</th>
                </tr>
              </thead>
              <tbody>
                {CNF_STEPS.map((step, index) => (
                  <tr key={step} className="border-t-2 border-dashed border-card-shade align-top">
                    <td className="py-2 pr-2">
                      <span className="space flex h-7 w-7 items-center justify-center bg-coin text-sm font-bold">
                        {step === 'done' ? '✓' : index + 1}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-[0.95rem] font-bold">{CNF_STEP_LABELS[step]}</td>
                    <td className="formula py-2 text-sm font-medium text-ink-soft">
                      {CNF_STEP_RULES[step]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Prose>
            <p className="mt-4">
              After rung 3 you are in <strong>negation normal form</strong>: every <Sym>¬</Sym> sits
              directly on a variable. Rung 4 is the only one that can make the formula bigger.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="Why the order is not negotiable">
          <p>
            <strong>↔ before →.</strong> Eliminating <Sym>↔</Sym> <em>creates</em> two implications,
            so a run that starts with <Sym>→</Sym> has to come back and do it again.
          </p>
          <p className="mt-2">
            <strong>¬ before distributing.</strong> This is the one that actually costs marks. In{' '}
            <F>¬(a ∧ b) ∨ (c ∧ d)</F> there is plainly a <Sym>∧</Sym> under a <Sym>∨</Sym>, so
            distribution <em>looks</em> available. Distribute now and you get{' '}
            <F>(¬(a ∧ b) ∨ c) ∧ (¬(a ∧ b) ∨ d)</F> — which is not CNF, because{' '}
            <F>¬(a ∧ b)</F> is not a literal. Push the negation in first.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Watch it run">
        <Prose>
          <p>
            The worked example from the notes, one move at a time. Tap through it — the interesting
            moment is step 4.
          </p>
        </Prose>
        <PipelineRun source="¬((a ↔ b) → c) ∨ (a ∧ c)" />
      </GuideSection>

      <GuideSection title="Step 4 explodes">
        <Card>
          <Prose>
            <p>
              Distribution copies everything it has already built and adds one literal to each copy.
              Example 2.18 is the standard demonstration: three conjunctions,{' '}
              <strong>2³ = 8</strong> clauses.
            </p>
          </Prose>
          <div className="mt-3">
            <Blowup source="(a ∧ b) ∨ (c ∧ d)" pairs={2} />
            <Blowup source="(a ∧ b) ∨ (c ∧ d) ∨ (e ∧ f)" pairs={3} />
          </div>
          <Prose>
            <p className="mt-3">
              Ten pairs would be 1024 clauses. Twenty would be a million. The formula you started
              with is still tiny — that gap is the entire reason the <strong>Tseitin</strong>{' '}
              transformation exists, and the exam contrasts the two.
            </p>
            <p>
              The difference to hold on to: this pipeline produces an <strong>equivalent</strong>{' '}
              formula — identical models. Tseitin produces one that is only{' '}
              <strong>satisfiability equivalent</strong>, because it invents new variables.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The cleanup">
        <Card>
          <Prose>
            <p>
              Distribution leaves debris. Two kinds, both safe to remove and both expected in a
              final answer:
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                A clause containing both <F>a</F> and <F>¬a</F> is true under every assignment.{' '}
                <strong>Delete the whole clause.</strong>
              </li>
              <li>
                A clause repeating a literal — <F>a ∨ b ∨ a</F> — collapses by idempotence to{' '}
                <F>a ∨ b</F>.
              </li>
            </ul>
            <p>
              The notes' example finishes with six clauses and cleans down to four. If the original
              was a tautology, <em>every</em> clause drops and you are left with the empty CNF.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="One formula, many CNFs">
          <p>
            A CNF is not unique and is not required to be minimal (Example 2.17):{' '}
            <F keep>(a ∧ b) ∨ (a ∧ c)</F> has both <F>a ∧ (b ∨ c)</F> and{' '}
            <F>a ∧ (a ∨ c) ∧ (b ∨ c)</F> as correct answers. If your clauses differ from the model
            solution, check equivalence before assuming you are wrong.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                One tap per question. The buttons carry the rules, so you are never asked to recall
                a rewrite — only to see which one fires.
              </li>
              <li>
                Formulas are caught at a random point of a real run, including at the very start and
                at the very end. “Done” is a real answer roughly as often as any other.
              </li>
              <li>
                After you answer, the result of the correct move is shown — with the clause count
                and the growth, so step 4 is felt rather than described.
              </li>
              <li>
                <strong>Sprint</strong> charges <strong>10 seconds</strong> per wrong attempt rather
                than the usual 5: with six options and no advance until you are right, a cheaper
                penalty would make guessing quicker than reading the formula.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** The notes' example, driven by the same pipeline the game marks with. */
function PipelineRun({ source }: { source: string }) {
  const start = parse(source)
  const trace = cnfPipeline(start)
  const [shown, setShown] = useState(0)

  const formulas = [start, ...trace.map((entry) => entry.result)]
  const current = formulas[shown] as typeof start
  const nextStep: CnfStep = nextCnfStep(current)
  const done = shown >= trace.length

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
          {shown === 0 ? 'Start' : `After step ${shown}`}
        </p>
        <p className="text-xs font-semibold text-ink-soft">
          {size(current)} nodes
          {shown > 0 && trace[shown - 1]?.step === 'distribute'
            ? ` · ${clauses(current).length} clauses`
            : ''}
        </p>
      </div>

      <p className="formula mt-1 text-lg leading-snug font-semibold text-balance">
        <FormulaText formula={current} />
      </p>

      <div className="mt-3 rounded-xl bg-card-shade px-3 py-2">
        {done ? (
          <>
            <p className="text-sm font-bold">Done — this is CNF</p>
            <p className="formula mt-1 text-sm font-medium">
              {clauses(current).map(showClause).join(' ∧ ')}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold">Next: {CNF_STEP_LABELS[nextStep]}</p>
            <p className="formula mt-0.5 text-xs font-medium text-ink-soft">
              {CNF_STEP_RULES[nextStep]}
            </p>
          </>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          variant="coin"
          className="flex-1"
          disabled={done}
          onClick={() => setShown((previous) => Math.min(previous + 1, trace.length))}
        >
          {done ? 'Finished' : `Apply ${CNF_STEP_LABELS[nextStep].toLowerCase()}`}
        </Button>
        <Button variant="secondary" onClick={() => setShown(0)} disabled={shown === 0}>
          Restart
        </Button>
      </div>
    </Card>
  )
}

/** How many clauses distribution actually produces, counted rather than claimed. */
function Blowup({ source, pairs }: { source: string; pairs: number }) {
  const formula = parse(source)
  const count = clauses(formula).length
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-t-2 border-dashed border-card-shade py-2">
      <span className="text-[0.95rem] font-medium">
        <FormulaText text={source} />
      </span>
      <span className="whitespace-nowrap text-sm font-bold">
        2<sup>{pairs}</sup> = {count} clauses
      </span>
    </div>
  )
}
