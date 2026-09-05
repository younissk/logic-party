/** What Presburger arithmetic can and cannot express. */

import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { PLUS_CLAIMS } from './natPlus.claims'

export function NatPlusGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Presburger arithmetic">
        <Card>
          <Prose>
            <p>
              <Sym>T(N,=,+)</Sym> — the true statements about the naturals with addition and
              equality, and no multiplication. Three facts about it, all examinable:
            </p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              <li>
                It is <strong>decidable</strong>. §5.2 shows it with automata: numbers written in
                binary least significant bit first, tuples read as words, and every construction on
                formulas mirrored by one on automata.
              </li>
              <li>
                It does <strong>not</strong> admit quantifier elimination in this signature —
                divisibility by fixed constants has to be added first. Decidable and QE are separate
                properties, and this is the course's example that they come apart.
              </li>
              <li>
                It is <strong>not finitely axiomatizable</strong>, which is why "every decidable
                theory is finitely axiomatizable" is false.
              </li>
            </ul>
          </Prose>
        </Card>

        <Callout tone="tip" title="Fixed multiples are still addition">
          <p>
            "x is even" is <Sym>∃k: k+k = x</Sym>. "x is a multiple of 3" is{' '}
            <Sym>∃k: k+k+k = x</Sym>. The number of copies is fixed in advance, so the formula is
            finite. What cannot be written is a product where <em>both</em> factors vary.
          </p>
        </Callout>

        <Callout tone="tip" title="Order is free in ℕ">
          <p>
            <Sym>{'x≤y'}</Sym> is <Sym>∃k: x+k = y</Sym>. It works because every natural is a
            difference of naturals in the right direction — and it is exactly the step that does not
            survive the move to ℤ, where <Sym>k</Sym> could be negative.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Which side each property falls on">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-2 py-1">property</th>
                  <th className="px-2 py-1">needs</th>
                  <th className="px-2 py-1">why</th>
                </tr>
              </thead>
              <tbody>
                {PLUS_CLAIMS.map((claim) => (
                  <tr key={claim.id} className="align-top">
                    <td className="px-2 py-1 font-logic font-bold">{claim.text}</td>
                    <td className="px-2 py-1 font-bold">
                      {claim.bin === 'plus' ? '+ alone' : 'also *'}
                    </td>
                    <td className="px-2 py-1 text-ink-soft">{claim.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Callout tone="warn" title="Divisibility by a constant is fine; by a variable is not">
          <p>
            "3 divides x" is a Presburger formula. "y divides x" is not, because the quotient and
            the divisor are both unknown. That single distinction accounts for most of the table
            above — and for why primality, squareness and powers all end up needing <Sym>*</Sym>.
          </p>
        </Callout>
      </GuideSection>
    </div>
  )
}
