/** Soundness, completeness, and the two theorems called Gödel's. */

import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { PROVABILITY_CLAIMS } from './provability.claims'

export function ProvabilityGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Two arrows, not one">
        <Card>
          <Prose>
            <p>
              <strong>Soundness</strong> is <Sym>⊢ φ ⟹ ⊨ φ</Sym>: anything the calculus proves is
              actually true. Without it a proof means nothing, so every calculus in this course is
              proved sound first.
            </p>
            <p>
              <strong>Completeness</strong> is the converse, <Sym>⊨ φ ⟹ ⊢ φ</Sym>. It is a real
              theorem and not a definition, and it is the one Gödel proved for first-order logic in
              1929 — every valid formula has a proof.
            </p>
            <p>
              <strong>Incompleteness</strong> is the 1931 theorem, and it is about arithmetic rather
              than about logic: no computable consistent set of axioms proves every truth of{' '}
              <Sym>T(N,=,+,*)</Sym>. The two carry the same name and point in opposite directions,
              which is why exam papers ask about both in one list.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="Valid is not the same as true">
          <p>
            "True" needs a structure. <Sym>∀x:x+0=x</Sym> is true in ℕ and not valid, because some
            structure interprets + differently. Completeness is about <em>valid</em> formulas —
            true in every structure — and the incompleteness theorem is about truths of one
            particular structure, ℕ.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The claims, sorted">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-2 py-1">claim</th>
                  <th className="px-2 py-1">verdict</th>
                  <th className="px-2 py-1">why</th>
                </tr>
              </thead>
              <tbody>
                {PROVABILITY_CLAIMS.map((claim) => (
                  <tr key={claim.id} className="align-top">
                    <td className="px-2 py-1 font-semibold">{claim.text}</td>
                    <td className="px-2 py-1 font-bold">{claim.bin}</td>
                    <td className="px-2 py-1 text-ink-soft">{claim.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Callout tone="tip" title="Decidable, axiomatizable, complete">
          <p>
            These three come apart, and most of the wrong answers above confuse two of them.
            Decidable is about an algorithm for membership. Axiomatizable is about a computable set
            of axioms. Complete is about the theory deciding every formula. A complete and
            axiomatizable theory is decidable — enumerate proofs of φ and of ¬φ and one turns up —
            and that single implication is the only one you get for free.
          </p>
        </Callout>
      </GuideSection>
    </div>
  )
}
