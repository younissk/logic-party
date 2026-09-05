/**
 * How to Skolemize.
 *
 * Every Skolem normal form on this page is produced by `toSkolemNormalForm` —
 * the function the game marks with — so the arities are computed rather than
 * transcribed.
 */

import {
  parseFormula,
  showFormula,
  skolemize,
  splitPrenex,
  toPrenex,
  toSkolemNormalForm,
  type FoSignature,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'

const SIG: FoSignature = {
  predicates: { p: 2, q: 3, r: 1 },
  functions: { f: 1 },
}

export function SkolemGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The idea">
        <Card>
          <Prose>
            <p>
              <Sym>∃x:p(x)</Sym> says some object has the property. Give it a name — invent a
              constant <Sym>c</Sym> — and write <Sym>p(c)</Sym>. The two are not equivalent, but
              they are satisfiability-equivalent, and that is all a refutation needs.
            </p>
            <p>
              When the ∃ sits behind some ∀s, the object may be a different one for each of them, so
              the name has to be a <em>function</em> of exactly those variables.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="The rule, in one line">
          <p>
            Walk the prefix left to right. When you meet <Sym>∃y</Sym>, replace y by a fresh symbol
            applied to <strong>every ∀ variable you have passed so far</strong>. None of them gives a
            constant.
          </p>
        </Callout>

        <Callout tone="warn" title="Only the ∀s, and only the ones to the left">
          <p>
            An ∃ you have already passed is not an argument — it has been replaced by a term of its
            own. And nothing to the <em>right</em> counts, whatever it is: the witness is chosen
            before those variables exist.
          </p>
        </Callout>

        <Callout tone="warn" title="Skolemization does not preserve equivalence">
          <p>
            <Sym>∃x:p(x)</Sym> and <Sym>p(c)</Sym> have different models — take a two-element
            universe where p holds at one of them and c names the other. Theorem 4.16 says only that
            the Skolem form entails the original and that the two are satisfiability-equivalent.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Prefix shapes, worked">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-3 border-ink">
                  <th className="py-2 pr-3 whitespace-nowrap">Prefix</th>
                  <th className="py-2 pr-3 whitespace-nowrap">Becomes</th>
                  <th className="py-2">Why</th>
                </tr>
              </thead>
              <tbody>
                <Shape
                  source="∃x:∀y:q(x,y,y)"
                  says="the ∃ is first, so its witness depends on nothing"
                />
                <Shape
                  source="∀x:∃y:q(x,y,y)"
                  says="one ∀ to the left, so the witness is a function of it"
                />
                <Shape
                  source="∀x:∀y:∃z:q(x,y,z)"
                  says="two ∀s to the left, so a binary function"
                />
                <Shape
                  source="∃x:∀y:∃z:q(x,y,z)"
                  says="the second ∃ sees one ∀, not the earlier ∃"
                />
              </tbody>
            </table>
          </div>
        </Card>
      </GuideSection>

      <GuideSection title="The exercise">
        <Worked
          source="∃x:∀y:∃z:(p(x,y)∨∀u:∃v:q(z,u,v))"
          caption="Exercise 8, question 1"
        />
        <Prose>
          <p>
            Three existentials of arity 0, 1 and 2 — the exercise's own{' '}
            <Sym>c</Sym>, <Sym>f(y)</Sym> and <Sym>g(y,u)</Sym>. Note that the third one takes{' '}
            <Sym>u</Sym>, which only became universal after the prenex step pulled it out.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="A trap the exam sets">
        <Worked
          source="∀x:∃y:(p(x,y)∧¬p(y,y))"
          caption="A constant here would be wrong"
        />
        <Prose>
          <p>
            Exercise 8 offers <Sym>∀x:(p(x)∧¬p(c))</Sym> as an answer to the analogous question and
            it is marked wrong: the witness depends on x, so it must be <Sym>f(x)</Sym>. A constant
            claims one object works for every x, which is a strictly stronger statement.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                The formula arrives in prenex form, so the prefix is already laid out left to right.
                Read along it.
              </li>
              <li>
                One row per ∃, with the ∀ variables offered as chips. The order you tap them does not
                matter; the term is printed in prefix order.
              </li>
              <li>
                Each row is marked separately, so one wrong argument list is one mark, not the
                question.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** A prefix shape with its Skolem form computed. */
function Shape({ source, says }: { source: string; says: string }) {
  const formula = toPrenex(parseFormula(source, SIG)).result
  const { result, steps } = skolemize(formula)
  const { prefix } = splitPrenex(formula)

  return (
    <tr className="border-t-2 border-dashed border-card-shade align-top">
      <td className="formula py-2 pr-3 font-bold whitespace-nowrap">
        {prefix
          .map((entry) => `${entry.quantifier === 'forall' ? '∀' : '∃'}${entry.variable}`)
          .join('')}
      </td>
      <td className="py-2 pr-3 whitespace-nowrap">
        <FoText formula={result} className="font-bold" />
      </td>
      <td className="py-2 text-ink-soft">
        {says}
        {steps.length > 0 && (
          <span className="formula block text-xs">
            {steps
              .map(
                (step) =>
                  `${step.variable} ↦ arity ${step.dependsOn.length}${
                    step.dependsOn.length === 0 ? ' (a constant)' : ` on ${step.dependsOn.join(', ')}`
                  }`,
              )
              .join(' · ')}
          </span>
        )}
      </td>
    </tr>
  )
}

/** The whole pipeline on one formula. */
function Worked({ source, caption }: { source: string; caption: string }) {
  const formula = parseFormula(source, SIG)
  const { prenex, skolemised, result, steps } = toSkolemNormalForm(formula)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <div className="mt-2 flex flex-col gap-1">
        <Line label="start" text={showFormula(formula)} />
        <Line label="prenex" text={showFormula(prenex)} />
        <Line label="skolem" text={showFormula(skolemised)} />
        <Line label="CNF matrix" text={showFormula(result)} />
      </div>
      <ul className="mt-2 flex flex-col gap-0.5 text-sm font-medium text-ink-soft">
        {steps.map((step) => (
          <li key={step.variable} className="formula">
            {step.variable}: arity {step.dependsOn.length}
            {step.dependsOn.length === 0 ? ' — a constant' : ` on ${step.dependsOn.join(', ')}`}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Line({ label, text }: { label: string; text: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-2 rounded-xl bg-card-shade px-3 py-1.5">
      <span className="w-20 shrink-0 text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
        {label}
      </span>
      <FoText text={text} className="text-sm font-bold" />
    </p>
  )
}
