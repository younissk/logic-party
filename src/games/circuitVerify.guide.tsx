/**
 * Verifying a circuit by reducing a polynomial.
 *
 * Every step shown here is produced by `reducePolynomial` over the same
 * designs the game draws from, so the worked reduction on this page is the
 * reduction the game marks — it cannot be a step out of date.
 */

import {
  GATE_LABELS,
  gatePolynomial,
  gateRule,
  isZero,
  reducePolynomial,
  showPolynomial,
  showPolyRule,
  type GateKind,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import {
  normalForm,
  rulesOf,
  specPolynomial,
  type CircuitQuestion,
} from './circuitVerify'

const HALF_ADDER: CircuitQuestion = {
  name: 'half adder',
  claim: 'adds its two input bits',
  inputs: ['a', 'b'],
  gates: [
    { kind: 'and', x: 'a', y: 'b', z: 's1' },
    { kind: 'xor', x: 'a', y: 'b', z: 's0' },
  ],
  spec: [
    [1, 'a'],
    [1, 'b'],
    [-2, 's1'],
    [-1, 's0'],
  ],
}

/** exam26bA question 4.4 — the same circuit, a different claim. */
const SUBTRACTOR: CircuitQuestion = {
  ...HALF_ADDER,
  name: 'subtractor',
  claim: 'subtracts its second input bit from its first',
  spec: [
    [1, 'a'],
    [-1, 'b'],
    [-2, 's1'],
    [1, 's0'],
  ],
}

function Reduction({ question }: { question: CircuitQuestion }) {
  const { chain, used } = reducePolynomial(specPolynomial(question), rulesOf(question))
  const ends = normalForm(question)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="pb-1 text-left font-semibold">
          {question.name} — the claim is that it {question.claim}
        </caption>
        <thead className="text-xs uppercase tracking-wider text-ink-soft">
          <tr>
            <th className="px-2 py-1">rule used</th>
            <th className="px-2 py-1">polynomial</th>
          </tr>
        </thead>
        <tbody>
          {chain.map((polynomial, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-card-shade/50' : ''}>
              <td className="px-2 py-1 font-logic text-xs text-ink-soft">
                {index === 0 ? 'start' : showPolyRule(used[index - 1]!)}
              </td>
              <td className="px-2 py-1 font-logic font-bold">{showPolynomial(polynomial)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-sm font-semibold">
        {isZero(ends)
          ? 'Ends at 0, so the relation holds for every input.'
          : `Ends at ${showPolynomial(ends)}, so the relation does not hold.`}
      </p>
    </div>
  )
}

const KINDS: readonly GateKind[] = ['and', 'or', 'xor']

export function CircuitVerifyGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The idea">
        <Card>
          <Prose>
            <p>
              Checking a circuit input by input costs 2<sup>n</sup> runs. §5.3 turns it into algebra
              instead. Give every wire a variable. Constrain each to a bit with{' '}
              <Sym>x²-x=0</Sym>. Encode each gate with its gate polynomial. Then the question
              "does this circuit satisfy relation <Sym>R</Sym>?" becomes "does <Sym>R</Sym> follow
              from those equations?", and that is answered by reduction.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="Equations become rules, and the signs flip">
          <p>
            A gate polynomial <Sym>z - q</Sym> set to zero says <Sym>z = q</Sym>, so the rule is{' '}
            <Sym>z → q</Sym> — every sign on the right changes. The notes call this out explicitly,
            because it is the step people get wrong.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-2 py-1">gate</th>
                  <th className="px-2 py-1">polynomial</th>
                  <th className="px-2 py-1">rule</th>
                </tr>
              </thead>
              <tbody>
                {KINDS.map((kind) => (
                  <tr key={kind}>
                    <td className="px-2 py-1 font-bold">{GATE_LABELS[kind]}</td>
                    <td className="px-2 py-1 font-logic">
                      {showPolynomial(gatePolynomial(kind, 'x', 'y', 'z'))}
                    </td>
                    <td className="px-2 py-1 font-logic font-bold">
                      {showPolyRule(gateRule(kind, 'x', 'y', 'z'))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Callout>

        <Callout tone="warn" title="Apply a rule at every position at once">
          <p>
            §5.3 inherits this from Algorithm 3.21: one step replaces <em>all</em> occurrences of
            the left-hand side. And <Sym>x² → x</Sym> fires on any power of two or more, which is
            what stops the degrees growing without bound.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="A reduction that ends at zero">
        <Card>
          <Reduction question={HALF_ADDER} />
        </Card>
      </GuideSection>

      <GuideSection title="And one that does not">
        <Card>
          <Prose>
            <p>
              exam26bA asks about exactly this: the same two gates, but with the relation{' '}
              <Sym>a-b-(2*s1-s0)=0</Sym>. It is a different claim, and the reduction settles it the
              same way — by finishing somewhere other than zero.
            </p>
          </Prose>
          <div className="mt-3">
            <Reduction question={SUBTRACTOR} />
          </div>
        </Card>

        <Callout tone="warn" title="Stuck is an answer">
          <p>
            A normal form other than 0 is not a failure to finish — it is the proof that the
            relation does not follow. Any bits making that leftover polynomial nonzero are a
            counterexample you can hand back.
          </p>
        </Callout>
      </GuideSection>
    </div>
  )
}
