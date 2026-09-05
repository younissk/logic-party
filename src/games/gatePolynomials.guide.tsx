/**
 * Gate polynomials.
 *
 * Figure 5.3's three polynomials are printed here by calling `gatePolynomial`,
 * and every truth table is filled in by `evaluatePolynomial` — the same two
 * functions the game marks with. Nothing in this page is typed out by hand, so
 * the guide cannot disagree with the game.
 */

import {
  GATE_LABELS,
  evaluatePolynomial,
  gatePolynomial,
  gateValue,
  showPolynomial,
  type GateKind,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'

const KINDS: readonly GateKind[] = ['and', 'or', 'xor']

const ROWS: readonly [number, number][] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
]

/** Every row of the gate, with the polynomial evaluated on it. */
function GateTable({ kind }: { kind: GateKind }) {
  const polynomial = gatePolynomial(kind, 'x', 'y', 'z')
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center text-sm font-bold tabular-nums">
        <caption className="pb-1 text-left font-logic text-base">
          {GATE_LABELS[kind]}: {showPolynomial(polynomial)}
        </caption>
        <thead className="text-xs uppercase tracking-wider text-ink-soft">
          <tr>
            <th className="px-2 py-1 font-logic normal-case">x</th>
            <th className="px-2 py-1 font-logic normal-case">y</th>
            <th className="px-2 py-1">gate output</th>
            <th className="px-2 py-1">at the right z</th>
            <th className="px-2 py-1">at the wrong z</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([x, y]) => {
            const right = gateValue(kind, x, y)
            const wrong = 1 - right
            return (
              <tr key={`${x}${y}`}>
                <td className="px-2 py-1">{x}</td>
                <td className="px-2 py-1">{y}</td>
                <td className="px-2 py-1">{right}</td>
                <td className="px-2 py-1 text-grass-deep">
                  {evaluatePolynomial(polynomial, { x, y, z: right })}
                </td>
                <td className="px-2 py-1 text-space-red">
                  {evaluatePolynomial(polynomial, { x, y, z: wrong })}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function GatePolynomialsGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What a gate polynomial is for">
        <Card>
          <Prose>
            <p>
              Checking a circuit by trying every input costs 2<sup>n</sup> runs. §5.3 replaces that
              with algebra: give every wire a variable, and write down polynomials that are zero
              exactly on the wirings the circuit can actually produce. Then correctness becomes a
              question about polynomials, which lives inside <Sym>T(R,=,+,*)</Sym> — a theory
              Tarski showed is decidable.
            </p>
            <p>
              Two kinds of polynomial do it. Each variable <Sym>x</Sym> gets{' '}
              <Sym>x²-x</Sym>, which is zero exactly when <Sym>x</Sym> is 0 or 1. And each gate gets
              a <strong>gate polynomial</strong>, zero exactly when its output variable holds what
              the gate really computes.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="Always output minus function">
          <p>
            Every gate polynomial has the shape <Sym>z - q</Sym>, where <Sym>z</Sym> is the output
            wire and <Sym>q</Sym> says how the gate combines its inputs. That is why the coefficient
            of <Sym>z</Sym> is always <strong>+1</strong> — and why the reduction rule you get from
            it, <Sym>z → q</Sym>, has all the other signs flipped.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Figure 5.3, checked row by row">
        <Card>
          <Prose>
            <p>
              The middle column is the polynomial at the output the gate would give; it is zero on
              every row, which is the whole claim. The right column feeds it the <em>other</em>{' '}
              output — nonzero every time, which is what makes the polynomial a faithful encoding
              rather than merely a true one.
            </p>
          </Prose>
          <div className="mt-3 flex flex-col gap-5">
            {KINDS.map((kind) => (
              <GateTable key={kind} kind={kind} />
            ))}
          </div>
        </Card>

        <Callout tone="tip" title="Deriving one instead of recalling it">
          <p>
            Write <Sym>z + a*x + b*y + c*xy + d</Sym> and force it to zero on the four rows. The row
            with both inputs 0 gives <Sym>d</Sym>; the two single-input rows give <Sym>a</Sym> and{' '}
            <Sym>b</Sym>; the last row gives <Sym>c</Sym>. Four rows, four unknowns, one answer —
            which is exactly what the game's dials are.
          </p>
        </Callout>

        <Callout tone="warn" title="OR and XOR differ by one coefficient">
          <p>
            <Sym>{showPolynomial(gatePolynomial('or', 'x', 'y', 'z'))}</Sym> against{' '}
            <Sym>{showPolynomial(gatePolynomial('xor', 'x', 'y', 'z'))}</Sym>. The extra{' '}
            <Sym>xy</Sym> is what cancels the row where both inputs are 1 — OR still outputs 1
            there, XOR outputs 0.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Where it goes next">
        <Card>
          <Prose>
            <p>
              Once every gate has its polynomial, turn each one into a rule <Sym>z → q</Sym> and
              each <Sym>x²-x</Sym> into <Sym>x² → x</Sym>. Reduce the specification polynomial — the
              relation the circuit is supposed to satisfy — by that system. If it reduces to 0, the
              circuit is correct. That is the next exercise.
            </p>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}
