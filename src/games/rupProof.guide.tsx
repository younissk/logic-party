/**
 * How RUP proofs work.
 *
 * Every RUP check on this page is run by `hasRupProperty` and `bcp` — the same
 * functions the game marks with — so the exam's two-line proof is verified
 * here rather than asserted.
 */

import { bcp, checkRupProof, clauses, hasRupProperty, negateClause, parse, showClauseSet, type Clause } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { ClauseSetText } from '@/ui/ClauseSet'
import { ClauseText } from '@/ui/ClauseText'

const S = (source: string): Clause[] => clauses(parse(source))
const C = (source: string): Clause => clauses(parse(source))[0] as Clause

const EXAM = '(¬a ∨ b) ∧ (¬a ∨ ¬b) ∧ (a ∨ ¬c) ∧ (a ∨ c)'

export function RupProofGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Why certificates exist">
        <Card>
          <Prose>
            <p>
              A solver saying <strong>SAT</strong> is easy to trust: it hands you a model and you
              check it in a second. A solver saying <strong>UNSAT</strong> is a bare claim — and a
              solver is half a million lines of heavily optimised C that does have bugs.
            </p>
            <p>
              So since 2013 every SAT competition has required an emitted, machine-checkable proof
              of unsatisfiability. The format is <strong>DRAT</strong>, and it is built on RUP. This
              is how “provably impossible” becomes something you check rather than believe.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The property">
        <Card>
          <Prose>
            <p className="text-lg font-bold">Assume the clause is false, propagate, and crash.</p>
            <p>
              A clause <Sym>C</Sym> has the RUP property with respect to <Sym>φ</Sym> when{' '}
              <Sym>BCP(φ ∧ ¬C)</Sym> contains the empty clause (Definition 2.47). If assuming{' '}
              <Sym>C</Sym> false forces a contradiction, then <Sym>C</Sym> was already implied, and
              adding it cannot turn a satisfiable formula unsatisfiable.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="Negating a clause gives you units">
          <p>
            This is the only piece of notation to get right. A clause of{' '}
            <strong>n</strong> literals negates into <strong>n separate unit clauses</strong>, not
            one clause.
          </p>
          <div className="mt-2 flex flex-col gap-1">
            <Negation source="a ∨ ¬b" />
            <Negation source="a" />
            <Negation source="a ∨ b ∨ ¬c" />
          </div>
        </Callout>
      </GuideSection>

      <GuideSection title="The special case worth memorising">
        <Card>
          <Prose>
            <p>
              Negating <Sym>⊥</Sym> adds <em>nothing</em> — it has no literals. So{' '}
              <Sym>⊥</Sym> has the RUP property exactly when <Sym>BCP(φ) = ⊥</Sym> on its own.
            </p>
            <p>
              Which means the last line of every RUP proof is asking one question:{' '}
              <strong>did the earlier lines make plain propagation enough?</strong>
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The exam question, worked">
        <Proof source={EXAM} proof={['¬a', '⊥']} caption="exam26a, Question 1.3" />
        <Prose>
          <p>
            Two lines. The <Sym>exam26bA</Sym> variant works identically — <Sym>(¬a)</Sym> then{' '}
            <Sym>⊥</Sym>.
          </p>
          <p>
            Note how the second line only works <em>because of</em> the first: with{' '}
            <Sym>(¬a)</Sym> in the formula, <Sym>a</Sym> propagates to false, and the last two
            clauses demand <Sym>c</Sym> and <Sym>¬c</Sym> at once. Each line you add makes the next
            one easier.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="The learned clauses are the proof">
        <Proof
          source="(a ∨ b ∨ c) ∧ (a ∨ ¬b ∨ c) ∧ (a ∨ b ∨ ¬c) ∧ (a ∨ ¬b ∨ ¬c) ∧ (¬a ∨ c) ∧ (¬a ∨ ¬c)"
          proof={['a ∨ b', 'a', '⊥']}
          caption="Example 2.51 — the clauses CDCL learned in Example 2.45"
        />
        <Prose>
          <p>
            That is the same sequence conflict-driven clause learning produced, unchanged. Learned
            clauses are derivable by resolution, and anything derivable by resolution has the RUP
            property — so a CDCL solver's learning trace <em>is</em> its certificate. It gets the
            proof for free.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Why this beats resolution">
        <Card>
          <Prose>
            <p>
              A resolution refutation makes you <strong>find</strong> the steps and name the
              parents. A RUP proof only makes you <strong>verify</strong>, and verification is
              nothing but propagation.
            </p>
            <p>
              So the method is: guess a small clause, check it propagates to <Sym>⊥</Sym>, move on.
              Units first — they constrain the most.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tick every candidate that can be added at this step. More than one usually can —
                the proof is not unique.
              </li>
              <li>
                Never all and never none, so ticking everything always loses.
              </li>
              <li>
                Sometimes a line is already in the proof. Judge the candidates against the formula{' '}
                <em>plus</em> that line.
              </li>
              <li>
                After you answer, each candidate shows what propagation actually left — either{' '}
                <Sym>⊥</Sym>, or the clauses that survived.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Negation({ source }: { source: string }) {
  const clause = C(source)
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <span className="formula font-bold">¬(</span>
      <ClauseText clause={clause} className="font-bold" />
      <span className="formula font-bold">)</span>
      <span className="text-ink-soft">=</span>
      <span className="formula font-bold">{showClauseSet(negateClause(clause))}</span>
      <span className="text-xs text-ink-soft">
        {negateClause(clause).length} unit{negateClause(clause).length === 1 ? '' : 's'}
      </span>
    </p>
  )
}

/** A whole proof, every line checked live. */
function Proof({ source, proof, caption }: { source: string; proof: string[]; caption: string }) {
  const set = S(source)
  const lines: Clause[] = proof.map((entry) => (entry === '⊥' ? ([] as Clause) : C(entry)))
  const verdict = checkRupProof(set, lines)

  let context = [...set]

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <p className="mt-1">
        <ClauseSetText set={set} className="text-[0.95rem] font-bold" />
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-2 pr-2 w-8">#</th>
              <th className="py-2 pr-3">Claim</th>
              <th className="py-2 pr-3 whitespace-nowrap">Add</th>
              <th className="py-2">Propagates to</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const added = negateClause(line)
              const run = bcp([...context, ...added])
              const ok = hasRupProperty(context, line)
              context = [...context, line]
              return (
                <tr key={index} className="border-t-2 border-dashed border-card-shade align-top">
                  <td className="py-2 pr-2 font-bold">{index + 1}</td>
                  <td className="py-2 pr-3">
                    <ClauseText clause={line} className="font-bold" />
                  </td>
                  <td className="formula py-2 pr-3 text-xs">
                    {added.length === 0 ? 'nothing' : showClauseSet(added)}
                  </td>
                  <td className="formula py-2 text-xs font-bold">
                    {run.outcome === 'unsatisfiable' ? '⊥ ✓' : `${showClauseSet(run.result)} ✗`}
                    {!ok && ' — fails'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-base font-bold">
        {verdict.ok ? `Checks out — ${lines.length} lines` : 'This proof does not check'}
      </p>
    </Card>
  )
}
