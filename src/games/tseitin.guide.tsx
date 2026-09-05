/**
 * How the Tseitin transformation works, and why it exists.
 *
 * Every clause table row on this page is produced by `definitionClauses` — the
 * same function the game marks with — and the worked run by `tseitin`. The
 * clause counts in the blowup comparison are counted, not asserted.
 */

import type { ReactNode } from 'react'

import {
  clauseSetToFormula,
  clauses,
  definitionClauses,
  isEquivalent,
  isSatisfiable,
  parse,
  showClause,
  tseitin,
  type Formula,
} from '@/logic'
import { Callout, F, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FormulaText } from '@/ui/FormulaText'

const EXERCISE = 'x ∨ ¬(y ∨ ¬(z ∨ x))'

export function TseitinGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Why this exists">
        <Card>
          <Prose>
            <p>
              The naive CNF pipeline distributes, and distribution doubles.{' '}
              <F keep>(a ∧ b) ∨ (c ∧ d) ∨ (e ∧ f)</F> becomes 8 clauses; ten such pairs become 1024;
              twenty become a million. A real circuit has ten million gates, so naive CNF is not
              slow — it is impossible.
            </p>
            <p>
              Tseitin makes it <strong>linear</strong>. Every gate costs a fixed handful of clauses,
              no matter how big the formula around it is. That single fact is why hardware
              verification, bounded model checking and every circuit-to-SAT encoder exist.
            </p>
          </Prose>
          <div className="mt-3">
            <Comparison source="(a ∧ b) ∨ (c ∧ d)" />
            <Comparison source="(a ∧ b) ∨ (c ∧ d) ∨ (e ∧ f)" />
            <Comparison source="(a ∧ b) ∨ (c ∧ d) ∨ (e ∧ f) ∨ (g ∧ h)" />
          </div>
          <Prose>
            <p className="mt-2 text-sm text-ink-soft">
              Naive doubles each time. Tseitin adds a constant. Extend the table far enough and the
              left column stops fitting on the page.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The trick, in one line">
        <Card>
          <Prose>
            <p className="text-lg font-bold">Give every subformula a name, then define the name.</p>
            <p>
              Instead of distributing <Sym>∨</Sym> over <Sym>∧</Sym>, introduce a fresh variable{' '}
              <Sym>t</Sym> for a subformula <Sym>χ</Sym>, write down what <Sym>t</Sym> means as clauses, and
              replace <Sym>χ</Sym> by <Sym>t</Sym>. Work inside-out until what is left is already a clause.
            </p>
            <p>
              Think of it as a circuit: <Sym>χ</Sym> is a gate, <Sym>t</Sym> is a labelled wire coming out
              of it, and the clauses are the wire's spec — what makes it high, and what it forces
              when it is high.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The definition table">
        <Card>
          <Prose>
            <p>
              These are the CNFs of <Sym>t ↔ χ</Sym>. Learn the <Sym>∨</Sym> and <Sym>∧</Sym> rows —
              they are ninety per cent of what is asked.
            </p>
          </Prose>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-3 border-ink">
                  <th className="py-2 pr-3 whitespace-nowrap">χ</th>
                  <th className="py-2 pr-3">clauses for t ↔ χ</th>
                  <th className="py-2 text-right whitespace-nowrap">#</th>
                </tr>
              </thead>
              <tbody>
                <TableRow body={parse('a ∨ b')} note="one wide clause out, one small clause per part in" />
                <TableRow body={parse('a ∧ b')} note="the mirror image of ∨" />
                <TableRow body={parse('¬a')} note="two clauses, and usually not needed at all" />
                <TableRow body={parse('a → b')} note="the ∨ row with a's sign flipped" />
                <TableRow body={parse('a ↔ b')} note="four clauses — the expensive one" />
              </tbody>
            </table>
          </div>
        </Card>

        <Callout tone="tip" title="The memory hook for t ↔ (a ∨ b)">
          <p>
            One <strong>big</strong> clause going <em>out</em> of <Sym>t</Sym>:{' '}
            <span className="formula font-bold">(¬t ∨ a ∨ b)</span> — if the wire is high, something
            fed it.
          </p>
          <p className="mt-2">
            One <strong>small</strong> clause per part going <em>in</em>:{' '}
            <span className="formula font-bold">(¬a ∨ t)</span>,{' '}
            <span className="formula font-bold">(¬b ∨ t)</span> — if any part is high, the wire is
            high.
          </p>
          <p className="mt-2">
            Conjunction is the same picture with the arrows reversed. And the shape survives
            substitution: replace <F>a</F> by <F>¬z</F> and every occurrence flips sign with it.
          </p>
        </Callout>

        <Callout tone="warn" title="Polarity — the mark people lose">
          <p>
            <span className="formula font-bold">(a ∨ ¬z)</span> is right and{' '}
            <span className="formula font-bold">(¬a ∨ z)</span> is wrong, and they look identical
            when you are tired. Do not recall the signs — <strong>derive</strong> them from{' '}
            <Sym>t ↔ χ</Sym>.
          </p>
          <p className="mt-2">
            <Sym>t ↔ χ</Sym> is two implications. <Sym>t → χ</Sym> gives the clauses that fire when the wire
            is high; <Sym>χ → t</Sym> gives the ones that fire when the gate is. Write both directions
            out and the signs come out on their own.
          </p>
          <p className="mt-2">
            The game marks semantically, so it does not care what order you build the clauses in or
            which correct encoding you pick — but a single flipped sign fails, and it tells you the
            exact assignment where your wiring and the definition disagree.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The exercise, worked">
        <WorkedRun source={EXERCISE} />
        <Prose>
          <p>
            Seven clauses — exactly what the exercise says. Two things to notice.
          </p>
          <p>
            <strong>Negation got no definition of its own.</strong> A negated variable is already a
            literal, so it rides along inside the clause. That is the convention the exercises use,
            and it is why this is 7 clauses and not 9.
          </p>
          <p>
            <strong>The top level was left alone.</strong> Once the parts were named, what remained
            was already a clause, so it was kept as one rather than given yet another name.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Equivalent? No — and that is the third trap">
        <Card>
          <Prose>
            <p>
              The naive pipeline gives an <strong>equivalent</strong> formula: identical models.
              Tseitin does not, and cannot — it invented variables the original never had, so the
              two formulas are not even about the same assignments.
            </p>
            <p>
              What holds is <strong>satisfiability equivalence</strong> (Definition 2.21): both are
              satisfiable, or neither is. Weaker, and enough.
            </p>
          </Prose>

          <div className="mt-3">
            <EquivalenceCheck source="(a ∧ b) ∨ (c ∧ d)" />
          </div>

          <Prose>
            <p className="mt-3">
              And the guarantee that makes it usable: <strong>any model of the CNF is a model of
              the original</strong> once you drop the fresh variables. So you hand the CNF to a
              solver, get an assignment back, delete the <Sym>t</Sym>s, and you have your answer. The
              exam contrasts this with the naive pipeline — know which one gives you which.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                One gate per question, taken from a real run on the formula shown above it. The
                purple box is the definition you are wiring.
              </li>
              <li>
                Tap a literal to drop it into the highlighted clause; tap it again inside the clause
                to take it back out. Tap a clause to make it the active one.
              </li>
              <li>
                Both polarities of every variable are on offer, always. Which sign to use is the
                exercise, so the palette will not narrow it down for you.
              </li>
              <li>
                The clause count is given — 3 for <Sym>∨</Sym>, <Sym>∧</Sym> and <Sym>→</Sym>, 4 for{' '}
                <Sym>↔</Sym>, 2 for <Sym>¬</Sym>. The exam gives you the table too; it is the signs
                that are worth marks.
              </li>
              <li>
                Marking is semantic. Order does not matter, and a different correct encoding still
                passes.
              </li>
              <li>
                <strong>Easy</strong> is <Sym>∧</Sym> and <Sym>∨</Sym> only, <strong>medium</strong>{' '}
                adds <Sym>→</Sym>, <strong>hard</strong> adds the four-clause <Sym>↔</Sym>.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function TableRow({ body, note }: { body: Formula; note: string }) {
  const encoded = definitionClauses('t', body)
  return (
    <tr className="border-t-2 border-dashed border-card-shade align-top">
      <td className="formula py-2 pr-3 text-base font-bold whitespace-nowrap">
        <FormulaText formula={body} />
      </td>
      <td className="py-2 pr-3">
        <span className="formula text-[0.95rem] font-bold">
          {encoded
            .map((clause) => `(${clause.map((l) => `${l.negated ? '¬' : ''}${l.name}`).join(' ∨ ')})`)
            .join(' ∧ ')}
        </span>
        <span className="mt-0.5 block text-xs font-medium text-ink-soft">{note}</span>
      </td>
      <td className="py-2 text-right text-sm font-bold whitespace-nowrap">{encoded.length}</td>
    </tr>
  )
}

/** The exercise, run by the same transformer the game uses. */
function WorkedRun({ source }: { source: string }) {
  const formula = parse(source)
  const run = tseitin(formula, { prefix: 'a' })

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Exercise 2</p>
      <p className="mt-1 text-lg font-semibold">
        <FormulaText formula={formula} />
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {run.definitions.map((definition, index) => (
          <Gate key={definition.name} n={index + 1}>
            <p className="formula text-base font-bold">
              {definition.name} ↔ (<FormulaText formula={definition.formula} />)
            </p>
            <p className="formula mt-1 text-[0.95rem]">
              {definition.clauses.map(showClause).join('  ')}
            </p>
          </Gate>
        ))}

        <Gate n="top">
          <p className="text-base font-bold">What is left is already a clause</p>
          <p className="formula mt-1 text-[0.95rem]">{run.rootClauses.map(showClause).join('  ')}</p>
        </Gate>
      </div>

      <p className="mt-3 border-t-3 border-ink pt-2 text-lg font-bold">
        {run.clauses.length} clauses from {run.definitions.length} gates
      </p>
    </Card>
  )
}

function Gate({ n, children }: { n: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl bg-card-shade px-3 py-2">
      <span className="space flex h-7 w-7 shrink-0 items-center justify-center bg-plum text-xs font-bold text-white">
        {n}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** Clause counts, counted rather than claimed. */
function Comparison({ source }: { source: string }) {
  const formula = parse(source)
  const naive = clauses(formula).length
  const linear = tseitin(formula).clauses.length
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-t-2 border-dashed border-card-shade py-1.5 text-sm">
      <span className="font-medium">
        <FormulaText text={source} />
      </span>
      <span className="whitespace-nowrap font-bold">
        <span className="text-space-red">{naive} naive</span> ·{' '}
        <span className="text-grass">{linear} Tseitin</span>
      </span>
    </div>
  )
}

/** Both claims of Definition 2.21, checked live. */
function EquivalenceCheck({ source }: { source: string }) {
  const original = parse(source)
  const cnf = clauseSetToFormula(tseitin(original).clauses)
  const equivalent = isEquivalent(original, cnf)
  const satEquivalent = isSatisfiable(original) === isSatisfiable(cnf)

  return (
    <div className="rounded-xl bg-card-shade px-3 py-2 text-sm font-medium">
      <p className="formula font-bold">
        <FormulaText formula={original} />
      </p>
      <p className="mt-2">
        Equivalent to its Tseitin CNF? <strong>{equivalent ? 'yes' : 'no'}</strong>
      </p>
      <p>
        Satisfiability equivalent? <strong>{satEquivalent ? 'yes' : 'no'}</strong>
      </p>
    </div>
  )
}
