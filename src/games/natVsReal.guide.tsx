/**
 * ℕ against ℝ.
 *
 * Where a bounded search can decide a formula honestly, this page evaluates it
 * in both universes and shows the result next to the cited verdict — so the
 * table proves what it can and cites the rest.
 */

import { CANDIDATES, NATURALS, evaluateReal, showReal } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { UNIVERSE_CLAIMS } from './natVsReal.claims'

const LABELS: Record<string, string> = {
  both: 'both',
  nat: 'ℕ only',
  real: 'ℝ only',
  neither: 'neither',
}

export function NatVsRealGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Same language, different structures">
        <Card>
          <Prose>
            <p>
              <Sym>T(N,=,+,*)</Sym> and <Sym>T(R,=,+,*)</Sym> are written in the same signature. A
              formula belongs to one or the other according to whether that structure makes it true,
              so separating them is a matter of knowing what each has.
            </p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              <li>
                <strong>ℕ has</strong> a least element, an immediate successor for every element,
                and nothing negative.
              </li>
              <li>
                <strong>ℝ has</strong> halves and all other divisions, density, square roots of
                non-negative numbers, and no least element.
              </li>
            </ul>
            <p className="mt-2">
              Almost every separator on an exam paper is one of those six facts, dressed up.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="Neither is a box too">
          <p>
            exam25a asks for a formula belonging to neither theory. <Sym>∃x: x+1 = x</Sym> does the
            job — it is not a trick question, and a contradiction is a perfectly good answer.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The formulas, and what a search can confirm">
        <Card>
          <Prose>
            <p>
              The last two columns are a bounded search: the formula evaluated over{' '}
              {NATURALS.length} naturals and over {CANDIDATES.length} sample reals. Where that
              search is trustworthy it matches the verdict. Where the verdict turns on density,
              unboundedness or an irrational witness a finite search cannot see it, and those rows
              say so rather than showing a number that would be wrong.
            </p>
          </Prose>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-2 py-1">formula</th>
                  <th className="px-2 py-1">holds in</th>
                  <th className="px-2 py-1">searched ℕ</th>
                  <th className="px-2 py-1">searched ℝ</th>
                  <th className="px-2 py-1">why</th>
                </tr>
              </thead>
              <tbody>
                {UNIVERSE_CLAIMS.map((claim) => (
                  <tr key={claim.id} className="align-top">
                    <td className="px-2 py-1 font-logic text-xs font-bold">
                      {claim.formula === undefined ? claim.text : showReal(claim.formula)}
                    </td>
                    <td className="px-2 py-1 font-semibold">{LABELS[claim.bin]}</td>
                    <td className="px-2 py-1">
                      {claim.checkable && claim.formula !== undefined
                        ? String(evaluateReal(claim.formula, {}, NATURALS))
                        : 'not decidable by search'}
                    </td>
                    <td className="px-2 py-1">
                      {claim.checkable && claim.formula !== undefined
                        ? String(evaluateReal(claim.formula, {}, CANDIDATES))
                        : '—'}
                    </td>
                    <td className="px-2 py-1 text-ink-soft">{claim.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Callout tone="tip" title="Squaring reverses order over ℝ and not over ℕ">
          <p>
            <Sym>{'∀x∀y: (x≤y → x²≤y²)'}</Sym> is true in ℕ, where nothing is negative, and false in
            ℝ at <Sym>x=−2, y=1</Sym>. Any argument that squares both sides of an inequality is
            leaning on non-negativity, and over ℝ it has to say so.
          </p>
        </Callout>

        <Callout tone="warn" title="Why a search is not a proof here">
          <p>
            Density and unboundedness are statements about infinitely many points, and a finite
            sample cannot confirm or refute either. <Sym>∃x: x*x = 1+1</Sym> is true over ℝ and has
            no rational witness at all — so a search over fractions returns false and is wrong. This
            is the same limitation Tarski's procedure exists to get past.
          </p>
        </Callout>
      </GuideSection>
    </div>
  )
}
