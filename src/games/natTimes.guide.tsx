/** Undecidability, incompleteness, and which is which. */

import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { CEILING_CLAIMS } from './natTimes.claims'

const THEORIES: readonly { name: string; decidable: string; complete: string; note: string }[] = [
  {
    name: 'T(ℕ,=,+)',
    decidable: 'yes — automata',
    complete: 'yes',
    note: 'Not finitely axiomatizable. No QE in this signature.',
  },
  {
    name: 'T(ℕ,=,+,*)',
    decidable: 'no',
    complete: 'yes',
    note: 'The theory of one structure, so complete; no computable axiomatisation.',
  },
  {
    name: 'T(ℤ,=,+,*)',
    decidable: 'no',
    complete: 'yes',
    note: 'ℕ is definable inside ℤ, so undecidability transfers.',
  },
  {
    name: 'T(ℝ,=,+,*)',
    decidable: 'yes — QE',
    complete: 'yes',
    note: "Tarski. Doubly exponential, but a procedure.",
  },
  {
    name: 'unbounded dense linear orders',
    decidable: 'yes — QE',
    complete: 'yes',
    note: 'Theorem 5.6, the elimination worked through in this chapter.',
  },
]

export function NatTimesGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Complete and undecidable at once">
        <Card>
          <Prose>
            <p>
              <Sym>T(N,=,+,*)</Sym> is the set of closed formulas true in ℕ. Being the theory of a
              single structure, it is <strong>complete</strong>: every closed formula is true or
              false there, so the theory contains it or its negation. It is{' '}
              <strong>consistent</strong>, since ℕ models it. And it is{' '}
              <strong>undecidable</strong>: nothing computes which of the two.
            </p>
            <p>
              Those three together are not a contradiction. What they rule out is a{' '}
              <strong>computable set of axioms</strong> — because a complete theory with computable
              axioms would be decidable, by enumerating proofs of φ and of ¬φ until one appears.
              That is Gödel's first incompleteness theorem in the form this chapter uses it.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="Incomplete theory, or incomplete axiom system?">
          <p>
            The theory of ℕ is complete. What is incomplete is any computable{' '}
            <em>axiom system</em> for it — Peano arithmetic, say. Saying "arithmetic is incomplete"
            is shorthand for the second, and the exam's true/false lines depend on which is meant.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The chapter's theories side by side">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-2 py-1">theory</th>
                  <th className="px-2 py-1">decidable</th>
                  <th className="px-2 py-1">complete</th>
                  <th className="px-2 py-1">note</th>
                </tr>
              </thead>
              <tbody>
                {THEORIES.map((theory) => (
                  <tr key={theory.name} className="align-top">
                    <td className="px-2 py-1 font-logic font-bold">{theory.name}</td>
                    <td className="px-2 py-1 font-semibold">{theory.decidable}</td>
                    <td className="px-2 py-1 font-semibold">{theory.complete}</td>
                    <td className="px-2 py-1 text-ink-soft">{theory.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Callout tone="tip" title="Multiplication is not the culprit — the integers are">
          <p>
            <Sym>T(R,=,+,*)</Sym> has multiplication and is decidable. What makes arithmetic
            undecidable is being able to <em>define the integers</em>, and over ℝ you cannot. Over ℤ
            you can define ℕ, which is why Exercise 11's transfer argument works.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The claims">
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
                {CEILING_CLAIMS.map((claim) => (
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
      </GuideSection>
    </div>
  )
}
