/**
 * From a Skolem normal form to a clause set.
 *
 * Every intermediate on this page is produced by the same functions the game
 * marks with, so the order shown is the order the game enforces.
 */

import {
  clausesOfMatrix,
  cnfOfMatrix,
  parseFormula,
  removeImplications,
  showFoClauseSet,
  showFormula,
  splitPrenex,
  toNegationNormalForm,
  toPrenex,
  type FoSignature,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'
import { STEP_BLURBS, STEP_LABELS, type ClausifyStep } from './clausify'

const SIG: FoSignature = {
  predicates: { p: 2, q: 1, shaves: 2 },
  functions: { a: 0, f: 1, barber: 0 },
}

export function ClausifyGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Where this sits">
        <Card>
          <Prose>
            <p>
              Prenex put the quantifiers in front; Skolemization removed the ∃s. What is left is{' '}
              <Sym>∀x₁…∀xₙ:M</Sym>, and this step turns M into CNF and reads it as clauses.
            </p>
            <p>
              The ∀ prefix is then simply dropped. Nothing is lost: every variable in a clause is
              universally quantified <em>by convention</em>, which is also what makes two clauses
              safe to rename apart before resolving them.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="Three steps, and the order is forced">
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            <li>
              <strong>{STEP_LABELS.implications}</strong> — {STEP_BLURBS.implications}
            </li>
            <li>
              <strong>{STEP_LABELS.negations}</strong> — {STEP_BLURBS.negations}
            </li>
            <li>
              <strong>{STEP_LABELS.distribute}</strong> — {STEP_BLURBS.distribute}
            </li>
          </ol>
          <p className="mt-2">
            Not a convention: a negation cannot be pushed through an implication that is still
            there, and distributing before the negations are down does nothing at all.
          </p>
        </Callout>

        <Callout tone="warn" title="↔ doubles the formula">
          <p>
            <Sym>φ↔ψ</Sym> becomes <Sym>(¬φ∨ψ)∧(¬ψ∨φ)</Sym>, so both sides appear twice. It is the
            step most likely to make a small formula produce four clauses.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="A run, step by step">
        <Run source="∀x:∀y:(p(x,y)→(q(x)∧q(y)))" caption="An implication over a conjunction" />
        <Run source="∀x:¬(p(x,x)→q(f(x)))" caption="A negation above an implication" />
      </GuideSection>

      <GuideSection title="The barber, all the way down">
        <Run
          source="∀x:(shaves(barber(),x)↔¬shaves(x,x))"
          caption="Example 4.25 — an ↔ giving two clauses"
        />
        <Prose>
          <p>
            These are the two clauses that resolution alone cannot refute, which is what Definition
            4.26 exists to fix.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Three buttons. Tapping the right one transforms the formula in front of you; tapping
                the wrong one changes nothing and costs a move.
              </li>
              <li>
                The clause set appears as soon as the matrix is in CNF, so you can see what you were
                aiming at.
              </li>
              <li>
                Reaching CNF with a wasted move is marked as a wasted move, not as a failure — but it
                is not a clean run either.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** The three steps applied in order, each printed. */
function Run({ source, caption }: { source: string; caption: string }) {
  const formula = parseFormula(source, SIG)
  const { matrix } = splitPrenex(toPrenex(formula).result)
  const afterImplications = removeImplications(matrix)
  const afterNegations = toNegationNormalForm(afterImplications)
  const cnf = cnfOfMatrix(afterNegations)
  const clauses = clausesOfMatrix(cnf)

  const rows: [ClausifyStep | 'start', string][] = [
    ['start', showFormula(matrix)],
    ['implications', showFormula(afterImplications)],
    ['negations', showFormula(afterNegations)],
    ['distribute', showFormula(cnf)],
  ]

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <p className="mt-1">
        <FoText formula={formula} className="text-sm font-bold" />
      </p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-1.5 pr-3 whitespace-nowrap">Step</th>
              <th className="py-1.5">Matrix</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([step, text], index) => {
              const changed = index === 0 || text !== (rows[index - 1] as [string, string])[1]
              return (
                <tr key={step} className="border-t-2 border-dashed border-card-shade align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap text-ink-soft">
                    {step === 'start' ? 'start' : STEP_LABELS[step]}
                    {!changed && <span className="block text-xs">nothing to do</span>}
                  </td>
                  <td className="py-1.5">
                    <FoText text={text} className="font-bold" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="formula mt-2 text-sm font-bold">
        {clauses.length} clause{clauses.length === 1 ? '' : 's'}: {showFoClauseSet(clauses)}
      </p>
    </Card>
  )
}
