/**
 * Equivalent vs. satisfiability equivalent.
 *
 * Every relationship claimed on this page is computed by `classifyPair` — the
 * same function that marks the game — so the table cannot say "equivalent"
 * about a pair the game would call something else.
 */

import { isEquivalent, isSatisfiable, parse, tseitin, clauseSetToFormula } from '@/logic'
import { Callout, F, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FormulaText } from '@/ui/FormulaText'
import { RELATIONSHIP_LABELS, classifyPair } from './equivalence'

export function EquivalenceGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Why this matters">
        <Card>
          <Prose>
            <p>
              Every preprocessing step inside a real solver — Tseitin, blocked-clause elimination,
              variable elimination — destroys equivalence and keeps satisfiability. This definition
              is the licence that makes all of it legal.
            </p>
            <p>
              It is also why a solver can answer <strong>SAT</strong> and hand back a model
              containing variables you never wrote, and why its <strong>UNSAT</strong> is still
              trustworthy.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="Two different questions">
        <Card>
          <Prose>
            <p>
              <strong>Equivalent</strong> (<Sym>φ ≡ ψ</Sym>) — the same set of models. Strong.
            </p>
            <p>
              <strong>Satisfiability equivalent</strong> (<Sym>φ ≡SAT ψ</Sym>) — both satisfiable,
              or both unsatisfiable. Weak: it compares one bit and nothing else.
            </p>
            <p>
              Equivalence always implies satisfiability equivalence. <strong>Never the reverse.</strong>
            </p>
          </Prose>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-3 border-ink">
                  <th className="py-2 pr-3">φ</th>
                  <th className="py-2 pr-3">ψ</th>
                  <th className="py-2">Relationship</th>
                </tr>
              </thead>
              <tbody>
                <Row left="a" right="a ∧ (b ∨ ¬b)" />
                <Row left="a" right="a ∧ b" />
                <Row left="a" right="b ∧ ¬b" />
                <Row left="a ∧ ¬a" right="(p ∨ q) ∧ ¬p ∧ ¬q" />
              </tbody>
            </table>
          </div>
        </Card>

        <Callout tone="warn" title="The last row is the one that catches people">
          <p>
            Two unsatisfiable formulas are obviously satisfiability equivalent — they agree on the
            one bit. But look again at what equivalence asks: <em>the same set of models</em>.
            Neither has any models. The empty set equals the empty set.
          </p>
          <p className="mt-2">
            So <strong>any two unsatisfiable formulas are equivalent</strong>, however unrelated they
            look. “Satisfiability equivalent only” is the wrong answer there, because the “only” is
            false.
          </p>
          <p className="mt-2">
            The same trap does not spring for two satisfiable formulas: those have models, and the
            models can differ.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The test that answers every one of these">
        <Card>
          <Prose>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>
                <strong>Is exactly one of them satisfiable?</strong> → <em>neither</em>. Stop.
              </li>
              <li>
                <strong>Do they have literally the same models?</strong> → <em>equivalent</em>. Two
                unsatisfiable formulas pass this, because both model sets are empty.
              </li>
              <li>
                Otherwise both are satisfiable with different models →{' '}
                <em>satisfiability equivalent only</em>.
              </li>
            </ol>
            <p>
              Order matters. Checking satisfiability first is cheap and settles the third case
              outright; comparing models is the expensive step and only step 2 needs it.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="Where it bites in this course">
        <Card>
          <Prose>
            <p>
              <strong>Tseitin.</strong> <Sym>φ</Sym> and its Tseitin CNF are satisfiability
              equivalent and not equivalent — the fresh variables mean the model sets are not even
              about the same assignments. Checked live:
            </p>
          </Prose>
          <div className="mt-2">
            <TseitinCheck source="(a ∧ b) ∨ (c ∧ d)" />
          </div>
          <Prose>
            <p className="mt-3">
              <strong>BCP.</strong> <Sym>φ</Sym> and <Sym>BCP(φ, l)</Sym> are satisfiability
              equivalent (Theorem 2.40) and not equivalent, because propagation deletes variables
              from the formula altogether.
            </p>
            <p>
              Both facts turn up as true/false items. The pattern is always the same: a step that
              invents or removes variables cannot preserve the model set, only the one bit.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                One board, both formulas, one assignment. Answer three questions with rows: does φ
                have a model, does ψ, and is there a row where they disagree.
              </li>
              <li>
                You never name the relationship. No separator means the model sets are identical,
                which is equivalence; a separator plus two models means satisfiability equivalent
                only; a separator plus one model means neither.
              </li>
              <li>
                A good number of the equivalent pairs are two unsatisfiable formulas that look
                nothing alike — both "has none" and no separator, which is exactly equivalence.
              </li>
              <li>Credit is per claim, so getting two of the three right still scores.</li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Row({ left, right }: { left: string; right: string }) {
  const a = parse(left)
  const b = parse(right)
  const relationship = classifyPair(a, b)
  return (
    <tr className="border-t-2 border-dashed border-card-shade align-top">
      <td className="py-2 pr-3">
        <FormulaText formula={a} />
      </td>
      <td className="py-2 pr-3">
        <FormulaText text={right} />
      </td>
      <td className="py-2 text-sm font-bold">{RELATIONSHIP_LABELS[relationship]}</td>
    </tr>
  )
}

function TseitinCheck({ source }: { source: string }) {
  const original = parse(source)
  const cnf = clauseSetToFormula(tseitin(original).clauses)
  return (
    <div className="rounded-xl bg-card-shade px-3 py-2 text-sm font-medium">
      <p className="font-bold">
        <F keep>{source}</F> vs. its Tseitin CNF
      </p>
      <p className="mt-1">
        Equivalent? <strong>{isEquivalent(original, cnf) ? 'yes' : 'no'}</strong> · Satisfiability
        equivalent?{' '}
        <strong>{isSatisfiable(original) === isSatisfiable(cnf) ? 'yes' : 'no'}</strong>
      </p>
    </div>
  )
}
