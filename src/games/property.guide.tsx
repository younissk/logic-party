/**
 * How to decide whether a formula is valid, satisfiable or unsatisfiable.
 *
 * Covers Definition 2.6, Theorem 2.8 and Figure 2.3 of the course notes. Every
 * table is computed by the same evaluator the game marks with, and the
 * classification of every example formula below is looked up with `classify` —
 * the same function that decides whether your answer was right — so the guide
 * cannot claim a formula is valid that the game would mark as contingent.
 */

import type { ReactNode } from 'react'

import { classify, findCounterexample, findModel, parse, showAssignment } from '@/logic'
import {
  AssignmentPlayground,
  Callout,
  F,
  GuideSection,
  MiniTruthTable,
  Prose,
  Sym,
} from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FormulaText } from '@/ui/FormulaText'
import { PROPERTY_LABELS } from './property'

export function PropertyGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What you are being asked">
        <Card>
          <Prose>
            <p>
              You are shown one formula and asked which of three boxes it falls into. The boxes are
              defined by one question only: <strong>as the assignment varies over all 2ⁿ
              possibilities, what values does the formula take?</strong>
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong>Always true</strong> — the formula is <strong>valid</strong>, also called a{' '}
                <em>tautology</em>.
              </li>
              <li>
                <strong>Sometimes true, sometimes false</strong> — <strong>satisfiable but not
                valid</strong>. The usual case.
              </li>
              <li>
                <strong>Always false</strong> — <strong>unsatisfiable</strong>, also called a{' '}
                <em>contradiction</em>.
              </li>
            </ul>
            <p>
              Every formula lands in exactly one of the three. That is the whole game, and the rest
              of this page is about getting there without writing out all 2ⁿ rows.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The four words (Definition 2.6)">
        <Card>
          <Prose>
            <p>
              The course names four properties, not three. They come in two pairs — one pair about
              being true, one about being false — and each pair has an <em>“at least once”</em>{' '}
              member and an <em>“every time”</em> member.
            </p>
          </Prose>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-3 border-ink">
                  <th className="py-2 pr-3" />
                  <th className="py-2 pr-3">Some assignment…</th>
                  <th className="py-2">Every assignment…</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t-2 border-dashed border-card-shade">
                  <th className="py-2 pr-3 align-top font-bold">makes it true</th>
                  <td className="py-2 pr-3">
                    <strong>satisfiable</strong>
                    <br />
                    the assignment is a <em>model</em>
                  </td>
                  <td className="py-2">
                    <strong>valid</strong> (tautology)
                  </td>
                </tr>
                <tr className="border-t-2 border-dashed border-card-shade">
                  <th className="py-2 pr-3 align-top font-bold">makes it false</th>
                  <td className="py-2 pr-3">
                    <strong>refutable</strong>
                    <br />
                    the assignment is a <em>counter-model</em>
                  </td>
                  <td className="py-2">
                    <strong>unsatisfiable</strong> (contradiction)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <Prose>
            <p className="mt-4">
              A formula can hold several of these at once, and that is the point of the next
              section. <F>p ∧ q</F> is both satisfiable and refutable. <F>p ∨ ¬p</F> is satisfiable{' '}
              <em>and</em> valid.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="Satisfiable is not the opposite of valid">
          <p>
            This is the mistake the exercise is built to catch. A valid formula is true under every
            assignment, so in particular it is true under <em>some</em> assignment — a tautology is
            satisfiable (Theorem 2.8.1). “Satisfiable” rules out only unsatisfiability.
          </p>
          <p className="mt-2">
            That is why the middle button in the game says <strong>“satisfiable, not valid”</strong>{' '}
            rather than just “satisfiable”. If it said the latter it would be a correct answer for
            two of the three boxes.
          </p>
          <p className="mt-2">
            The real opposite of <em>valid</em> is <em>refutable</em>, and the real opposite of{' '}
            <em>satisfiable</em> is <em>unsatisfiable</em>.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The three regions (Figure 2.3)">
        <Card>
          <Prose>
            <p>
              Reading the four words as two independent yes/no questions gives four combinations,
              but one of them is impossible: a formula cannot be true nowhere <em>and</em> false
              nowhere, because every formula has a value in every row. Three survive, and they are
              exactly the three buttons.
            </p>
          </Prose>

          <div className="mt-4 flex flex-col gap-3">
            <Region
              label={PROPERTY_LABELS.contradiction}
              source="p ∧ ¬p"
              flags={['unsatisfiable ✓', 'refutable ✓', 'satisfiable ✗', 'valid ✗']}
            />
            <Region
              label={PROPERTY_LABELS.contingent}
              source="p → q"
              flags={['unsatisfiable ✗', 'refutable ✓', 'satisfiable ✓', 'valid ✗']}
            />
            <Region
              label={PROPERTY_LABELS.tautology}
              source="p ∨ ¬p"
              flags={['unsatisfiable ✗', 'refutable ✗', 'satisfiable ✓', 'valid ✓']}
            />
          </div>

          <Prose>
            <p className="mt-4">
              Negation swaps the outer two and leaves the middle alone: <F>¬(p ∧ ¬p)</F> is valid,{' '}
              <F>¬(p ∨ ¬p)</F> is unsatisfiable, and the negation of anything in the middle stays in
              the middle. This is Theorem 2.8.5, and it is worth having as a reflex — it turns any
              validity question into an unsatisfiability question, which is what a SAT solver
              actually answers.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="How to answer without a full table">
        <Card>
          <Prose>
            <p>
              The table always works and is never wrong, but eight rows under a stopwatch is slow.
              These three moves settle most questions faster.
            </p>
          </Prose>

          <div className="mt-4 flex flex-col gap-5">
            <Move
              n={1}
              title="Hunt for one counter-model"
              body={
                <>
                  <p>
                    To prove a formula is <strong>not valid</strong> you need one row where it comes
                    out false. Do not search blindly — work backwards. For{' '}
                    <F>(p → q) → (q → p)</F>, ask what makes the whole thing false: the outer{' '}
                    <Sym>→</Sym> is false only when its left side is true and its right is false. So
                    make <F>q → p</F> false, which forces{' '}
                    <F>q</F> true and <F>p</F> false, then check that <F>p → q</F> came out true. It
                    did. One row, done.
                  </p>
                  <div className="mt-3">
                    <MiniTruthTable source="(p → q) → (q → p)" columns={['p → q', 'q → p']} />
                  </div>
                </>
              }
            />
            <Move
              n={2}
              title="Hunt for one model"
              body={
                <p>
                  To prove a formula is <strong>satisfiable</strong> you need one row where it comes
                  out true, and the same backwards reasoning applies. For a conjunction this is
                  quick: every conjunct has to be true, so each one constrains you. If following
                  those constraints forces a variable to be both true and false, you have shown the
                  formula is <strong>unsatisfiable</strong> — that failure <em>is</em> the proof.
                </p>
              }
            />
            <Move
              n={3}
              title="Recognise the shape"
              body={
                <p>
                  Many valid formulas are a law with something substituted in. If you spot{' '}
                  <F>(A ∧ B) → A</F>, <F>¬(A ∧ B) ↔ (¬A ∨ ¬B)</F> or{' '}
                  <F>(A → B) ↔ (¬B → ¬A)</F> — with <F>A</F> and <F>B</F> standing for whole
                  subformulas, however big — it is valid whatever you substituted, because those
                  hold for every <F>A</F> and <F>B</F>. The game builds many of its valid questions
                  exactly this way.
                </p>
              }
            />
          </div>
        </Card>

        <AssignmentPlayground source="((p → q) ∧ p) → q" />
      </GuideSection>

      <GuideSection title="Laws worth recognising on sight">
        <Card>
          <Prose>
            <p>
              All of these are valid for every substitution. Substituting a large formula for{' '}
              <F>p</F> or <F>q</F> does not change that, which is what makes them worth memorising
              rather than re-deriving.
            </p>
          </Prose>
          <ul className="mt-3 flex flex-col gap-2">
            <Law source="p ∨ ¬p" name="Excluded middle" />
            <Law source="¬(p ∧ ¬p)" name="Non-contradiction" />
            <Law source="(p ∧ q) → p" name="Weakening" />
            <Law source="p → (p ∨ q)" name="Strengthening" />
            <Law source="((p → q) ∧ p) → q" name="Modus ponens" />
            <Law source="((p → q) ∧ ¬q) → ¬p" name="Modus tollens" />
            <Law source="(p → q) ↔ (¬p ∨ q)" name="Implication as disjunction" />
            <Law source="(p → q) ↔ (¬q → ¬p)" name="Contraposition" />
            <Law source="¬(p ∧ q) ↔ (¬p ∨ ¬q)" name="De Morgan" />
            <Law source="(p → q) ∨ (q → p)" name="Implication is total — surprising, still valid" />
          </ul>
        </Card>

        <Callout tone="warn" title="The near-misses">
          <p>
            Each of these looks like a law above and is not. Every one is satisfiable but not valid,
            and the counter-model is given — check it.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <NearMiss source="(p → q) → (q → p)" note="the converse is not the same claim" />
            <NearMiss source="(p → q) ↔ (¬p → ¬q)" note="that is the inverse, not the contrapositive" />
            <NearMiss source="¬(p ∧ q) ↔ (¬p ∧ ¬q)" note="De Morgan flips the connective too" />
            <NearMiss source="p → (p ∧ q)" note="strengthening works for ∨, not ∧" />
          </div>
        </Callout>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Flip variables and watch the value. Bank a row that makes it{' '}
                <strong>true</strong> and a row that makes it <strong>false</strong> — or claim
                there is none, which is what makes a formula valid or unsatisfiable.
              </li>
              <li>
                You never name the property. Two rows means contingent, no false row means valid,
                no true row means unsatisfiable — the classification falls out.
              </li>
              <li>
                Banking is refused unless the current row actually does what you are claiming, so a
                wrong witness cannot be banked by accident. Claiming "none exists" is not checked
                until you submit.
              </li>
              <li>
                Half credit for getting one slot right. Answers spread evenly across the three
                properties, so no habit pays off.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Region({
  label,
  source,
  flags,
}: {
  label: string
  source: string
  flags: string[]
}) {
  return (
    <div className="tile bg-card-shade p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-base font-bold">{label}</p>
        <p className="text-lg">
          <F>{source}</F>
        </p>
      </div>
      <p className="mt-1 text-sm font-medium text-ink-soft">{flags.join(' · ')}</p>
    </div>
  )
}

function Move({ n, title, body }: { n: number; title: string; body: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="space flex h-9 w-9 shrink-0 items-center justify-center bg-coin text-base font-bold">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold">{title}</p>
        <div className="mt-1 text-[0.95rem] leading-relaxed font-medium">{body}</div>
      </div>
    </div>
  )
}

function Law({ source, name }: { source: string; name: string }) {
  const formula = parse(source)
  // Asserted, not assumed: if a "law" listed here were not actually valid the
  // guide would say so out loud rather than teaching it.
  const valid = classify(formula) === 'tautology'
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl bg-card-shade px-3 py-2">
      <span className="text-base">
        <FormulaText formula={formula} />
      </span>
      <span className="text-sm font-semibold text-ink-soft">
        {name}
        {valid ? '' : ' — NOT VALID, please report this'}
      </span>
    </li>
  )
}

function NearMiss({ source, note }: { source: string; note: string }) {
  const formula = parse(source)
  const counter = findCounterexample(formula)
  const model = findModel(formula)
  return (
    <div className="rounded-xl bg-white/40 px-3 py-2">
      <p className="text-base">
        <FormulaText formula={formula} />
      </p>
      <p className="mt-0.5 text-sm font-medium">
        {note}. False at {counter === null ? '—' : showAssignment(counter)}
        {model === null ? '' : `, true at ${showAssignment(model)}`}.
      </p>
    </div>
  )
}
