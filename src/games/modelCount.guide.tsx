/**
 * How to count models without writing out the truth table.
 *
 * Every count on this page is computed by `countModelsOver` — the same
 * function that marks the game — and every propagation step by the same
 * `unitPropagate`. The worked exam answers below are therefore checked, not
 * transcribed.
 */

import type { ReactNode } from 'react'

import {
  clauseSetToFormula,
  clauses,
  countModelsOver,
  parse,
  showClause,
  sortedVariables,
  unitPropagate,
} from '@/logic'
import { AssignmentPlayground, Callout, F, GuideSection, MiniTruthTable, Prose } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FormulaText, VariableName } from '@/ui/FormulaText'

export function ModelCountGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What you are being asked">
        <Card>
          <Prose>
            <p>
              A <strong>model</strong> is an assignment that makes the formula true (Definition
              2.6.1). Counting them means asking: of all the ways to set the variables, how many
              satisfy every clause?
            </p>
            <p>
              With <strong>n</strong> variables there are <strong>2ⁿ</strong> assignments to check —
              16 for four variables, 32 for five. You do not have time to write that table out, and
              you do not need to.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="The count depends on which variables you were asked about">
          <p>
            This is the mark people lose. A variable the formula never mentions is <strong>free</strong>
            : nothing constrains it, so every model comes in a pair — one with it true, one with it
            false. It <strong>doubles</strong> the count.
          </p>
          <div className="mt-3 flex flex-col gap-1.5 text-[0.95rem] font-medium">
            <p>
              <F>a ∨ b</F> over <VariableName name="a" />, <VariableName name="b" /> —{' '}
              <strong>{countModelsOver(parse('a ∨ b'), ['a', 'b'])} models</strong>
            </p>
            <p>
              <F>a ∨ b</F> over <VariableName name="a" />, <VariableName name="b" />,{' '}
              <VariableName name="c" /> — <strong>{countModelsOver(parse('a ∨ b'), ['a', 'b', 'c'])} models</strong>
            </p>
            <p>
              <F>a ∨ b</F> over <VariableName name="a" />, <VariableName name="b" />,{' '}
              <VariableName name="c" />, <VariableName name="d" /> —{' '}
              <strong>{countModelsOver(parse('a ∨ b'), ['a', 'b', 'c', 'd'])} models</strong>
            </p>
          </div>
          <p className="mt-3">
            Same formula, three different right answers. Always read which variables the question
            names. In the game they are listed under the formula, and a free one is highlighted in
            gold.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The method">
        <Card>
          <Prose>
            <p>
              Three steps, in this order. The first two shrink the problem for free; the third is
              the one everyone forgets.
            </p>
          </Prose>

          <div className="mt-4 flex flex-col gap-5">
            <Step n={1} title="Propagate the units">
              <p>
                A clause with one literal has no choice in it. <F>a</F> on its own means{' '}
                <VariableName name="a" /> = T in <em>every</em> model — zero freedom, and no
                branching to account for.
              </p>
              <p className="mt-2">
                Once you set it, delete every clause it satisfies and strike it out of the rest.
                That often creates a new unit clause, so keep going until nothing is forced. This is
                BCP, and it is an exam question in its own right.
              </p>
            </Step>

            <Step n={2} title="Enumerate what is left">
              <p>
                After propagation you usually have two or three variables and a couple of clauses.{' '}
                <strong>Now</strong> a table is cheap — four rows, not sixteen. Check each row
                against the surviving clauses and count the ones that pass.
              </p>
            </Step>

            <Step n={3} title="Multiply by the free variables">
              <p>
                Any variable that propagation did not force <em>and</em> that does not appear in
                what is left is free. Each one doubles the count: multiply by{' '}
                <strong>2ᵏ</strong> for k free variables.
              </p>
            </Step>
          </div>
        </Card>
      </GuideSection>

      <GuideSection title="The exam question, worked">
        <WorkedExample
          source="a ∧ b ∧ (c ∨ d) ∧ (¬c ∨ d)"
          variables={['a', 'b', 'c', 'd']}
          caption="exam25a, Question 1.1a"
          table="(c ∨ d) ∧ (¬c ∨ d)"
        />
        <Prose>
          <p>
            Note how little work that was: two units gone in a glance, then a four-row table over
            what remained. The full table would have been sixteen rows.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="A harder one">
        <WorkedExample
          source="(¬a ∨ ¬b ∨ ¬c) ∧ (a ∨ c) ∧ (b ∨ d) ∧ (¬d ∨ ¬a) ∧ (c ∨ ¬b)"
          variables={['a', 'b', 'c', 'd']}
          caption="Exercise 1"
        />
        <Prose>
          <p>
            No unit clauses at all, so step 1 does nothing and you have to enumerate. That still
            beats a blind table: go clause by clause and reject early — the moment one clause fails,
            the row is dead and you stop reading.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Play with it">
        <Prose>
          <p>
            Toggle the variables below and watch the clauses go green. A model is a setting where
            every single line is green.
          </p>
        </Prose>
        <AssignmentPlayground source="a ∧ b ∧ (c ∨ d) ∧ (¬c ∨ d)" />
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Type the count on the keypad. Answers are small — never more than{' '}
                <strong>2ⁿ</strong> for the variables listed.
              </li>
              <li>
                A gold variable chip means that variable appears <em>nowhere</em> in the formula.
                That is the ×2 waiting to catch you.
              </li>
              <li>
                After you answer, the three steps are shown worked out for that exact question.
                Read them even when you were right — the goal is the method, not the number.
              </li>
              <li>
                <strong>Zero</strong> is a legitimate answer: an unsatisfiable clause set has no
                models. It comes up occasionally, not often.
              </li>
              <li>
                Sanity check: if your count is odd, no variable was free. If it is not a multiple of
                2ᵏ for the k free variables, you have made a mistake.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="space flex h-9 w-9 shrink-0 items-center justify-center bg-coin text-base font-bold">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold">{title}</p>
        <div className="mt-1 text-[0.95rem] leading-relaxed font-medium">{children}</div>
      </div>
    </div>
  )
}

/**
 * A worked count, computed live.
 *
 * The propagation, the surviving clauses and the total all come from the same
 * functions the game uses, so this cannot claim an answer the game would mark
 * wrong.
 */
function WorkedExample({
  source,
  variables,
  caption,
  table,
}: {
  source: string
  variables: string[]
  caption: string
  table?: string
}) {
  const formula = parse(source)
  const propagation = unitPropagate(clauses(formula))
  const remainingVariables = sortedVariables(clauseSetToFormula(propagation.remaining))
  const constrained = new Set([...propagation.forced.map((f) => f.name), ...remainingVariables])
  const free = variables.filter((name) => !constrained.has(name))
  const total = countModelsOver(formula, variables)
  const remainingCount = free.length === 0 ? total : total / 2 ** free.length

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <p className="mt-1 text-lg font-semibold">
        <FormulaText formula={formula} />
      </p>
      <p className="mt-1 text-sm font-medium text-ink-soft">
        over {variables.join(', ')} — {2 ** variables.length} assignments in total
      </p>

      <ol className="mt-3 flex flex-col gap-2 text-[0.95rem] font-medium">
        <li>
          <strong>1 · Units force </strong>
          {propagation.forced.length === 0 ? (
            <span className="text-ink-soft">nothing — there are no unit clauses</span>
          ) : (
            propagation.forced.map((f) => (
              <span key={f.name} className="mr-2 whitespace-nowrap">
                <VariableName name={f.name} /> = {f.value ? 'T' : 'F'}
              </span>
            ))
          )}
        </li>
        <li>
          <strong>2 · What is left </strong>
          {propagation.remaining.length === 0 ? (
            <span className="text-ink-soft">nothing — everything is satisfied</span>
          ) : (
            <>
              <span className="formula">{propagation.remaining.map(showClause).join(' ∧ ')}</span>{' '}
              <span className="text-ink-soft">
                → {remainingCount} of {2 ** remainingVariables.length}
              </span>
            </>
          )}
        </li>
        <li>
          <strong>3 · Free </strong>
          {free.length === 0 ? (
            <span className="text-ink-soft">none — every variable is constrained</span>
          ) : (
            <>
              {free.join(', ')} <span className="text-ink-soft">→ × {2 ** free.length}</span>
            </>
          )}
        </li>
      </ol>

      {table !== undefined && (
        <div className="mt-3">
          <MiniTruthTable source={table} />
        </div>
      )}

      <p className="mt-3 border-t-3 border-ink pt-2 text-lg font-bold">
        {remainingCount} × {2 ** free.length} = {total} model{total === 1 ? '' : 's'}
      </p>
    </Card>
  )
}
