/**
 * How to answer "is clause X derivable?".
 *
 * Both exam variants below are decided by `isDerivable` and `unitPropagate` —
 * the same functions the game marks with — so the answers are computed rather
 * than transcribed, and the two variants genuinely do invert.
 */

import {
  clauseSetToFormula,
  clauses,
  components,
  isDerivable,
  isSatisfiable,
  parse,
  showClause,
  unitPropagate,
  type Clause,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'

const S = (source: string): Clause[] => clauses(parse(source))
const C = (source: string): Clause => clauses(parse(source))[0] as Clause

const XYZ = '(z) ∧ (¬x ∨ ¬y) ∧ (x ∨ ¬y ∨ ¬z) ∧ (x ∨ y ∨ ¬z) ∧ (x ∨ y ∨ z) ∧ (¬x ∨ ¬z)'
const XYZ_FLIPPED = '(¬z) ∧ (¬x ∨ ¬y) ∧ (x ∨ ¬y ∨ ¬z) ∧ (x ∨ y ∨ ¬z) ∧ (x ∨ y ∨ z) ∧ (¬x ∨ ¬z)'
const ABCD = '(a ∨ b ∨ c ∨ d) ∧ (¬a ∨ ¬b)'

export function DerivableGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What you are being asked">
        <Card>
          <Prose>
            <p>
              A clause set, and a handful of candidate clauses. For each: can resolution actually{' '}
              <em>reach</em> it, in any number of steps?
            </p>
            <p>
              Grinding out every resolvent is not the method. Two observations settle most of the
              options before you resolve anything at all.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The two-step routine">
        <Card>
          <Prose>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>
                <strong>Run BCP.</strong> If the set turns out unsatisfiable, <Sym>□</Sym> is
                derivable — resolution is refutation complete, so you know it without doing a single
                step. If it is satisfiable, <Sym>□</Sym> is out of reach, full stop.
              </li>
              <li>
                <strong>For every other candidate, ask whether it is even implied.</strong> If it is
                not, you are done — resolution is sound, so it cannot derive something false. If it
                is, try to build it, watching for component splits and tautology traps.
              </li>
            </ol>
          </Prose>
        </Card>

        <Callout tone="tip" title="The insight that kills whole options for free">
          <p>
            Resolution needs a <strong>shared variable</strong>. Two components of a clause set that
            share none can never be mixed — no sequence of steps can bridge them.
          </p>
          <p className="mt-2">
            So any candidate drawing letters from both halves is dead on sight, with no work at all.
            In the game the components are drawn separately for exactly this reason.
          </p>
        </Callout>

        <Callout tone="warn" title="Implied is not the same as derivable">
          <p>
            Resolution derives a clause at most as wide as one it entails, so an entailed clause can
            still be unreachable. That is what happens to <Sym>(c ∨ d)</Sym> below: every route to
            it has to strip <Sym>a</Sym> and <Sym>b</Sym>, and doing so resolves against{' '}
            <Sym>(¬a ∨ ¬b)</Sym>, which produces a tautology every single time. Dead end.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The exam question">
        <Worked
          caption="exam26a, Question 1.1"
          source={`${XYZ} ∧ ${ABCD}`}
          candidates={['⊥', 'x', 'c ∨ d', 'a ∨ b ∨ c ∨ x']}
          notes={[
            'the set is unsatisfiable, and resolution is refutation complete',
            'Res_z on the two ¬z clauses gives (x ∨ ¬y) and (x ∨ y); resolve those on y',
            'every route strips a and b against (¬a ∨ ¬b), which is always a tautology',
            'mixes both components — impossible with no shared variable',
          ]}
        />
      </GuideSection>

      <GuideSection title="The variant, where everything inverts">
        <Prose>
          <p>
            exam26bA flips the unit clause <Sym>(z)</Sym> to <Sym>(¬z)</Sym>. Now{' '}
            <Sym>z = F</Sym> satisfies four clauses outright, leaving only{' '}
            <Sym>(x ∨ y) ∧ (¬x ∨ ¬y)</Sym> — which is satisfiable. Every answer changes.
          </p>
        </Prose>
        <Worked
          caption="exam26bA, Question 1.1"
          source={`${XYZ_FLIPPED} ∧ ${ABCD}`}
          candidates={['⊥', 'x', 'c ∨ d', 'x ∨ y']}
          notes={[
            'the set is now satisfiable, so there is nothing to refute',
            'not even implied — x = F, y = T is a model',
            'same tautology trap as before',
            'Res_z of (¬z) with (x ∨ y ∨ z)',
          ]}
        />
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tick every candidate resolution can reach. <Sym>□</Sym> is always on the list, so
                start by deciding whether the set is satisfiable.
              </li>
              <li>
                When the clause set splits, the components are shown separately and labelled. Use
                it: a candidate spanning both is free to reject.
              </li>
              <li>
                Never all and never none — every question has at least one of each, so “tick
                everything” always loses.
              </li>
              <li>
                After you answer, each candidate gets its reason: refutation completeness, a
                component split, or a tautology dead end.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** The whole question, decided live. */
function Worked({
  caption,
  source,
  candidates,
  notes,
}: {
  caption: string
  source: string
  candidates: string[]
  notes: string[]
}) {
  const set = S(source)
  const groups = components(set)
  const satisfiable = isSatisfiable(clauseSetToFormula(set))
  const propagation = unitPropagate(set)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>

      <div className="mt-2 flex flex-col gap-2">
        {groups.map((group, index) => (
          <div key={index} className="rounded-xl bg-card-shade px-3 py-2">
            <p className="text-xs font-bold text-ink-soft">Component {index + 1}</p>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {group.map((clause, clauseIndex) => (
                <ClauseText key={clauseIndex} clause={clause} className="text-[0.95rem] font-bold" />
              ))}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-sm font-medium">
        <strong>BCP forces</strong>{' '}
        {propagation.forced.length === 0
          ? 'nothing'
          : propagation.forced.map((entry) => `${entry.name} = ${entry.value ? 'T' : 'F'}`).join(', ')}
        {propagation.conflict ? ' — conflict, so the set is unsatisfiable.' : '.'} The set is{' '}
        <strong>{satisfiable ? 'satisfiable' : 'unsatisfiable'}</strong>.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-2 pr-3 whitespace-nowrap">Candidate</th>
              <th className="py-2 pr-3 whitespace-nowrap">Derivable?</th>
              <th className="py-2">Why</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate, index) => {
              const clause = candidate === '⊥' ? ([] as Clause) : C(candidate)
              const yes = isDerivable(set, clause)
              return (
                <tr key={candidate} className="border-t-2 border-dashed border-card-shade align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <ClauseText clause={clause} className="font-bold" />
                  </td>
                  <td className={`py-2 pr-3 font-bold ${yes ? 'text-grass-deep' : 'text-space-red'}`}>
                    {yes ? 'yes' : 'no'}
                  </td>
                  <td className="py-2 text-ink-soft">{notes[index]}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs font-medium text-ink-soft">
        Clause set: {set.map(showClause).join(' ')}
      </p>
    </Card>
  )
}
