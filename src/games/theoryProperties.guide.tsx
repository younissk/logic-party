/**
 * Consistent, complete, decidable, finitely axiomatizable.
 *
 * The table is computed by running `modelsOf`, `isConsistent` and
 * `completenessWitness` over the same four structures the game uses, so what
 * it says about each theory is decided rather than asserted.
 */

import { completenessWitness, isConsistent, modelsOf, showFormula } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'
import { CATALOGUE_FORMULAS, WORLD, parse } from './theoryWorld'

const EXAMPLES: readonly string[][] = [
  ['∀x:p(x)'],
  ['∃x:p(x)'],
  ['∃x:p(x)', '∃x:¬p(x)'],
  ['∀x:p(x)', '∃x:¬p(x)'],
  ['∀x:(p(x)∨¬p(x))'],
]

function PropertyTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-ink-soft">
          <tr>
            <th className="px-2 py-1">axioms</th>
            <th className="px-2 py-1">models</th>
            <th className="px-2 py-1">consistent</th>
            <th className="px-2 py-1">complete</th>
            <th className="px-2 py-1">undecided formula</th>
          </tr>
        </thead>
        <tbody>
          {EXAMPLES.map((axioms) => {
            const models = modelsOf(WORLD, axioms.map(parse))
            const witness = completenessWitness(WORLD, models, CATALOGUE_FORMULAS)
            const consistent = isConsistent(models)
            return (
              <tr key={axioms.join()} className="align-top">
                <td className="px-2 py-1">
                  <FoText text={axioms.join(', ')} className="font-bold" />
                </td>
                <td className="px-2 py-1 font-logic text-xs">
                  {models.map((index) => WORLD.labels[index]).join(' ') || '—'}
                </td>
                <td className="px-2 py-1 font-bold">{consistent ? 'yes' : 'no'}</td>
                <td className="px-2 py-1 font-bold">
                  {consistent && witness === null ? 'yes' : 'no'}
                </td>
                <td className="px-2 py-1 font-logic text-xs">
                  {consistent && witness !== null ? showFormula(witness) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function TheoryPropertiesGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Four properties, Definition 5.3">
        <Card>
          <Prose>
            <ul className="mt-1 flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong>Consistent</strong> — it has a model. An inconsistent theory contains every
                formula at once, so "T is inconsistent" and "⊥ ∈ T" say the same thing.
              </li>
              <li>
                <strong>Complete</strong> — for every closed φ, either φ ∈ T or ¬φ ∈ T. The theory
                of a single structure is always complete; a theory with two models that disagree
                about something never is.
              </li>
              <li>
                <strong>Decidable</strong> — there is an algorithm deciding membership. Nothing to
                do with completeness in general, though a complete theory with a computable axiom
                set is decidable: enumerate proofs of φ and of ¬φ, and one of them turns up.
              </li>
              <li>
                <strong>Finitely axiomatizable</strong> — some finite set generates it. That is
                about the axioms, never about the theory's size: a finitely axiomatizable
                consistent theory still has infinitely many formulas in it.
              </li>
            </ul>
          </Prose>
        </Card>

        <Callout tone="warn" title="Inconsistent is a strong claim, not a weak one">
          <p>
            <Sym>{'{∀x:p(x), ∃x:¬p(x)}'}</Sym> is the exam's example, and it is inconsistent: no
            structure satisfies both. The reflex is to think a theory with a contradiction in it is
            somehow smaller. It is the largest one there is — every formula belongs.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Decided over four structures">
        <Card>
          <Prose>
            <p>
              With two elements and one unary predicate there are four structures, and every
              property above becomes a question about which of them survive the axioms. Fewer
              models means a bigger theory; one model means complete; none means inconsistent.
            </p>
          </Prose>
          <div className="mt-3">
            <PropertyTable />
          </div>
        </Card>

        <Callout tone="tip" title="The witness is the answer">
          <p>
            To show a theory incomplete, name a formula two of its models disagree about. That is
            constructive, checkable, and much more convincing than "it has several models" — which
            is the same fact without the evidence.
          </p>
        </Callout>

        <Callout tone="warn" title="Two claims that look alike and are not">
          <p>
            <em>Every decidable theory is finitely axiomatizable</em> — false. <Sym>T(N,=,+)</Sym>{' '}
            is decidable and not finitely axiomatizable. And <em>if T₁ ⊆ T₂ and T₂ is finitely
            axiomatizable, so is T₁</em> — also false; a subset of a theory is under no obligation
            to inherit anything, and need not even be a theory.
          </p>
        </Callout>
      </GuideSection>
    </div>
  )
}
