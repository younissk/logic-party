/**
 * Quantifier elimination for unbounded dense linear orders.
 *
 * Both exam questions are worked here by calling `eliminateQuantifiers`, and
 * the step tables come from the steps it records — so the guide shows the
 * elimination the game marks with, not a transcription of it.
 */

import {
  DLO_AXIOMS,
  eliminateConjunction,
  eliminateQuantifiers,
  parseDlo,
  showDlo,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { parseConjunct } from './qeDense'

const STEPS: readonly { conjuncts: string[]; why: string }[] = [
  { conjuncts: ['y<x'], why: 'nothing above x — unboundedness' },
  { conjuncts: ['x<z'], why: 'nothing below x — unboundedness' },
  { conjuncts: ['y<x', 'x<z'], why: 'one bound each side — density' },
  { conjuncts: ['u<x', 'v<x', 'x<y', 'x<z'], why: 'two each side — every pair' },
  { conjuncts: ['y<x', 'x<y'], why: 'y on both sides — irreflexivity' },
  { conjuncts: ['y<x', 'x<z', 'u<v'], why: 'u<v never mentioned x, so it survives' },
  { conjuncts: ['x=y', 'x<z'], why: 'an equation pins x down, then substitute' },
]

const EXAMS: readonly { label: string; source: string }[] = [
  { label: 'exam25a Q4.2', source: '∀y:∃x:((<(z,x)∧<(x,y))∨(<(y,w)∧<(y,x)))' },
  { label: 'exam26bA Q4.2', source: '∀x:∃y:((<(w,y)∧<(y,x))∨(<(x,z)∧<(y,x)))' },
  { label: 'Exercise 10 Q4', source: '∃z:∃u:((<(x,u)∧<(z,y))∧<(u,z))' },
]

function StepTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-ink-soft">
          <tr>
            <th className="px-2 py-1">∃x over</th>
            <th className="px-2 py-1">becomes</th>
            <th className="px-2 py-1">because</th>
          </tr>
        </thead>
        <tbody>
          {STEPS.map(({ conjuncts, why }) => (
            <tr key={conjuncts.join('∧')}>
              <td className="px-2 py-1 font-logic font-bold">{conjuncts.join(' ∧ ')}</td>
              <td className="px-2 py-1 font-logic font-bold">
                {showDlo(eliminateConjunction('x', conjuncts.map(parseConjunct)))}
              </td>
              <td className="px-2 py-1 text-ink-soft">{why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Worked({ label, source }: { label: string; source: string }) {
  const formula = parseDlo(source)
  const { steps, result } = eliminateQuantifiers(formula)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="pb-1 text-left font-semibold">
          {label}: <span className="font-logic">{showDlo(formula)}</span>
        </caption>
        <thead className="text-xs uppercase tracking-wider text-ink-soft">
          <tr>
            <th className="px-2 py-1">step</th>
            <th className="px-2 py-1">result</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step, index) => (
            <tr key={index}>
              <td className="px-2 py-1 text-ink-soft">{step.rule}</td>
              <td className="px-2 py-1 font-logic font-bold">{showDlo(step.result)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-sm font-semibold">
        Quantifier-free: <span className="font-logic">{showDlo(result)}</span>
      </p>
    </div>
  )
}

export function QeDenseGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The theory">
        <Card>
          <Prose>
            <p>
              Five axioms, over a single binary predicate <Sym>{'<'}</Sym>: irreflexivity,
              transitivity, linearity, density and unboundedness. ℚ is a model, and Theorem 5.6 says
              this theory admits quantifier elimination — so it is decidable.
            </p>
          </Prose>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-2 py-1">axiom</th>
                  <th className="px-2 py-1">says</th>
                </tr>
              </thead>
              <tbody>
                {DLO_AXIOMS.map((axiom) => (
                  <tr key={axiom.name}>
                    <td className="px-2 py-1 font-semibold">{axiom.name}</td>
                    <td className="px-2 py-1 font-logic">{showDlo(parseDlo(axiom.formula))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </GuideSection>

      <GuideSection title="The procedure, in four moves">
        <Card>
          <Prose>
            <ol className="mt-1 flex list-decimal flex-col gap-1 pl-5">
              <li>
                <strong>Only ∃ needs eliminating.</strong> <Sym>∀x:Φ</Sym> is{' '}
                <Sym>¬∃x:¬Φ</Sym>. Work innermost first, so the body is always quantifier-free.
              </li>
              <li>
                <strong>Remove the negations.</strong> Linearity makes <Sym>{'¬(y<z)'}</Sym>
                into <Sym>{'z<y ∨ z=y'}</Sym>, and <Sym>{'¬(y=z)'}</Sym> into <Sym>{'y<z ∨ z<y'}</Sym>.
                After this nothing is negated at all.
              </li>
              <li>
                <strong>Put the body in DNF</strong> and push the ∃ inside the ∨ — an existential
                distributes over disjunction.
              </li>
              <li>
                <strong>Eliminate over each conjunction.</strong> That is the table below.
              </li>
            </ol>
          </Prose>
        </Card>

        <Card>
          <StepTable />
        </Card>

        <Callout tone="tip" title="Why the cross product">
          <p>
            An x with <Sym>{'y₁<x'}</Sym>, <Sym>{'y₂<x'}</Sym>, <Sym>{'x<z'}</Sym> exists exactly
            when z is above both y's — that is, <Sym>{'y₁<z'}</Sym> and <Sym>{'y₂<z'}</Sym>.
            Density gives the "if"; the ordering gives the "only if". So the result is one atom for
            every (lower, upper) pair, and nothing else.
          </p>
        </Callout>

        <Callout tone="warn" title="An empty side is ⊤, not ⊥">
          <p>
            The reflex is that fewer constraints means a harder question. It is the other way round:
            with nothing above x, unboundedness hands you an x above every lower bound, so the
            existential is satisfied outright.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Both exam questions, worked">
        <Card>
          <div className="flex flex-col gap-5">
            {EXAMS.map((exam) => (
              <Worked key={exam.label} label={exam.label} source={exam.source} />
            ))}
          </div>
        </Card>
      </GuideSection>
    </div>
  )
}
