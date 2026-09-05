/**
 * Writing properties in the language of T(ℕ,=,+,*).
 *
 * Every row of the table is checked here the way the tests check it: the
 * formula is evaluated over a range of n and shown next to the numbers it
 * actually picks out, so the pairing is demonstrated rather than asserted.
 */

import { holdsUpTo, showArithFormula } from '@/logic/arithmetic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { LIMIT, PROPERTIES, RANGE_START } from './sayItInTheLanguage'

function PropertyTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-ink-soft">
          <tr>
            <th className="px-2 py-1">says</th>
            <th className="px-2 py-1">formula</th>
            <th className="px-2 py-1">holds for</th>
          </tr>
        </thead>
        <tbody>
          {PROPERTIES.map((property) => {
            const hits = Array.from({ length: LIMIT }, (_, index) => index + RANGE_START)
              .filter((n) => holdsUpTo(property.formula, { n }, LIMIT))
              .slice(0, 8)
            return (
              <tr key={property.id} className="align-top">
                <td className="px-2 py-1 font-semibold">{property.description}</td>
                <td className="px-2 py-1 font-logic text-xs">
                  {showArithFormula(property.formula)}
                </td>
                <td className="px-2 py-1 tabular-nums">{hits.join(', ')}…</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function SayItInTheLanguageGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The language is smaller than it looks">
        <Card>
          <Prose>
            <p>
              <Sym>T(N,=,+,*)</Sym> has one predicate and two function symbols. No {'<'}, no |, no
              "prime". Anything else you write is an abbreviation that has to unfold into those
              three, and the lecture gives the two that matter:
            </p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              <li>
                <Sym>x|y</Sym> is <Sym>∃k: k*x = y</Sym>.
              </li>
              <li>
                <Sym>prime(p)</Sym> is <Sym>{'p>1 ∧ ∀a∀b: (a*b=p → a=1 ∨ b=1)'}</Sym>.
              </li>
              <li>
                <Sym>{'x≤y'}</Sym> is <Sym>∃k: x+k = y</Sym> — which works in ℕ and is exactly why
                it does not carry over to ℤ unchanged.
              </li>
            </ul>
          </Prose>
        </Card>

        <Callout tone="tip" title="Say it with primes, not with sizes">
          <p>
            Most of these properties are statements about which primes divide n and how often. Once
            it is phrased that way — "every prime dividing n divides it twice", "at most one prime
            divides n" — the formula writes itself.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The exercise's list, and what each one really picks out">
        <Card>
          <PropertyTable />
        </Card>

        <Callout tone="warn" title="Squarefree and squareful are not opposites">
          <p>
            Squarefree says <em>no</em> prime divides n twice. Squareful says <em>every</em> prime
            dividing n divides it twice. 1 is both. 12 = 2²·3 is neither. The negation of one is not
            the other, and reading the table above makes that immediate.
          </p>
        </Callout>

        <Callout tone="warn" title="Power of a prime is a ∀, not an ∃">
          <p>
            The natural phrasing is <Sym>∃p∃k: p^k = n</Sym> — but exponentiation with a variable
            exponent is not in the language. The way round it is to say the same thing negatively:
            any two primes dividing n are equal. That is exam26a's "power of 2" too, with the
            further condition that the prime is 2.
          </p>
        </Callout>

        <Callout tone="tip" title="Two different primes">
          <p>
            exam26bA asks for "divisible by two different prime numbers", and the word doing the
            work is <em>different</em>: <Sym>∃p∃q</Sym> with <Sym>¬(p=q)</Sym> as well as both
            dividing n. Without it, p and q may be the same prime and every prime power qualifies.
          </p>
        </Callout>
      </GuideSection>
    </div>
  )
}
