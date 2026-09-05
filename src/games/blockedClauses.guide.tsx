/**
 * How blocked clause elimination works.
 *
 * Both runs on this page are produced by `bce` — the same function the game
 * marks with — so the exam's six removals and the notes' five are computed.
 */

import {
  bce,
  blockingLiteral,
  clauses,
  isBlockedOn,
  parse,
  pureLiterals,
  resolveOn,
  showClause,
  type Clause,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { ClauseSetText } from '@/ui/ClauseSet'
import { ClauseText } from '@/ui/ClauseText'

const S = (source: string): Clause[] => clauses(parse(source))
const C = (source: string): Clause => clauses(parse(source))[0] as Clause

const EXAM = '(a ∨ b ∨ c ∨ d) ∧ (¬a ∨ b ∨ ¬c) ∧ (a ∨ e) ∧ (¬a ∨ e) ∧ (c ∨ f) ∧ (¬c ∨ g)'
const NOTES = '(a ∨ b ∨ ¬d) ∧ (¬b ∨ ¬d ∨ ¬e) ∧ (b ∨ d ∨ e) ∧ (¬b ∨ d) ∧ (d)'

export function BlockedClausesGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The definition">
        <Card>
          <Prose>
            <p>
              A literal <Sym>l ∈ C</Sym> is <strong>blocked</strong> in <Sym>φ</Sym> when, for{' '}
              <em>every</em> clause <Sym>D</Sym> containing <Sym>¬l</Sym>, the resolvent{' '}
              <Sym>Res_l(C, D)</Sym> is a tautology (Definition 2.33). <Sym>C</Sym> is a blocked
              clause when it has a blocked literal.
            </p>
            <p>
              Removing one <strong>preserves satisfiability, not equivalence</strong> (Theorem
              2.34). So delete everything and you have proved the formula satisfiable — though you
              do not get a model out of it.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="The shortcut that solves 90% of these">
          <p>
            A <strong>pure</strong> literal is automatically blocked. If nothing in the formula
            contains <Sym>¬l</Sym>, then the “for every <Sym>D</Sym>” condition quantifies over an
            empty set and holds <strong>vacuously</strong> — there is nothing to check.
          </p>
          <p className="mt-2">Hunt those first. The exam question is six of them in a row.</p>
        </Callout>
      </GuideSection>

      <GuideSection title="The exam question, worked">
        <Run source={EXAM} caption="exam25a, Question 1.3" />
        <Prose>
          <p>
            Empty formula, therefore satisfiable. Every single step was a pure literal, which is why
            the question's hint is simply “find a blocked clause, remove it, find the next”.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="A non-vacuous case">
        <Card>
          <Prose>
            <p>
              Worth recognising, because it is what the definition is actually for. In{' '}
              <Sym>(a ∨ b) ∧ (¬a ∨ ¬b) ∧ (b ∨ c)</Sym>, is <Sym>(a ∨ b)</Sym> blocked on{' '}
              <Sym>a</Sym>?
            </p>
          </Prose>
          <div className="mt-2">
            <NonVacuous
              source="(a ∨ b) ∧ (¬a ∨ ¬b) ∧ (b ∨ c)"
              clause="a ∨ b"
              literal={{ name: 'a', negated: false }}
            />
          </div>
          <Prose>
            <p className="mt-2">
              <Sym>a</Sym> is not pure here — <Sym>¬a</Sym> does appear. But the one clause
              containing it resolves to a tautology, so the condition holds anyway. Blocked.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="Removing one can unblock another">
        <Run source={NOTES} caption="Example 2.35" />
        <Prose>
          <p>
            This is why elimination cascades. <Sym>(¬b ∨ ¬d ∨ ¬e)</Sym> is not blocked on{' '}
            <Sym>¬b</Sym> in the original formula, and becomes blocked on it once{' '}
            <Sym>(a ∨ b ∨ ¬d)</Sym> is gone. If a clause refuses to come out, remove a different
            one and come back to it.
          </p>
          <p>
            Elimination is <strong>not complete</strong>: plenty of satisfiable formulas cannot be
            emptied this way. Reaching the empty formula proves satisfiability; failing to reach it
            proves nothing.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="The bonus question">
        <Card>
          <Prose>
            <p>
              <em>If <Sym>l</Sym> is pure in <Sym>φ</Sym>, show every clause <Sym>C</Sym> with{' '}
              <Sym>l ∈ C</Sym> is blocked.</em>
            </p>
            <p>
              <Sym>l</Sym> pure means no clause of <Sym>φ</Sym> contains <Sym>¬l</Sym>. The blocked
              condition quantifies over all clauses containing <Sym>¬l</Sym>. That set is empty, so
              the condition holds vacuously. Hence <Sym>l</Sym> is a blocked literal in{' '}
              <Sym>C</Sym>, so <Sym>C</Sym> is a blocked clause. ∎
            </p>
            <p>Three lines, and it is the same observation the shortcut above rests on.</p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tap a clause to remove it. Only blocked ones go — tapping one that is not blocked
                tells you which resolvent fails to be a tautology.
              </li>
              <li>
                Every question can be emptied completely, and every question has at least one step
                where the blocking literal is <em>not</em> pure, so the shortcut alone is never
                enough.
              </li>
              <li>
                A refusal is not a dead end. Remove something else and try again — that clause may
                be blocked once its blocker is gone.
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
  const run = bce(set)

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
              <th className="py-2 pr-3">Remove</th>
              <th className="py-2 pr-3 whitespace-nowrap">Blocked on</th>
              <th className="py-2">Leaves</th>
            </tr>
          </thead>
          <tbody>
            {run.steps.map((step, index) => (
              <tr key={index} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="py-2 pr-3">
                  <ClauseText clause={step.clause} className="font-bold" />
                </td>
                <td className="formula py-2 pr-3 whitespace-nowrap font-bold">
                  {step.literal.negated ? '¬' : ''}
                  {step.literal.name}
                  {step.pure && <span className="ml-1 text-xs font-semibold text-ink-soft">pure</span>}
                </td>
                <td className="py-2">
                  <ClauseSetText set={step.result} className="text-xs" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-base font-bold">
        {run.complete
          ? `Empty formula after ${run.steps.length} removals — satisfiable`
          : `${run.result.length} clauses left — this proves nothing either way`}
      </p>
    </Card>
  )
}

function NonVacuous({
  source,
  clause,
  literal,
}: {
  source: string
  clause: string
  literal: { name: string; negated: boolean }
}) {
  const set = S(source)
  const target = C(clause)
  const opposite = { name: literal.name, negated: !literal.negated }
  const others = set.filter(
    (other) =>
      showClause(other) !== showClause(target) &&
      other.some((entry) => entry.name === opposite.name && entry.negated === opposite.negated),
  )
  const pure = pureLiterals(set).some(
    (entry) => entry.name === literal.name && entry.negated === literal.negated,
  )

  return (
    <div className="rounded-xl bg-card-shade px-3 py-2 text-sm">
      <p className="font-bold">
        Clauses containing {opposite.negated ? '¬' : ''}
        {opposite.name}: {others.length === 0 ? 'none' : ''}
      </p>
      <ul className="mt-1 flex flex-col gap-1">
        {others.map((other, index) => {
          const resolvent = resolveOn(target, other, literal.name)
          return (
            <li key={index} className="flex flex-wrap items-center gap-1.5">
              <ClauseText clause={other} className="font-bold" />
              <span className="text-ink-soft">→ Res gives</span>
              {resolvent === null ? (
                <span className="text-ink-soft">nothing</span>
              ) : (
                <ClauseText clause={resolvent} className="font-bold" />
              )}
              <span className="text-xs font-bold">
                {resolvent !== null && resolvent.some((a) => resolvent.some((b) => a.name === b.name && a.negated !== b.negated))
                  ? '— tautology ✓'
                  : '— not a tautology ✗'}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 font-bold">
        Blocked on {literal.negated ? '¬' : ''}
        {literal.name}?{' '}
        {isBlockedOn(set, target, literal) ? 'yes' : 'no'}
        {pure ? ' (and vacuously, since it is pure)' : ''}
        {blockingLiteral(set, target) === null ? '' : ''}
      </p>
    </div>
  )
}
