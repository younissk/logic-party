/**
 * Blocked clauses, one named literal at a time.
 *
 * Every verdict below is computed by `isBlockedOn` — the same function the
 * game marks with.
 */

import { clauses, isBlockedOn, isTautologicalClause, parse, pureLiterals, resolveOn, type Clause } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'

const S = (source: string): Clause[] => clauses(parse(source))
const C = (source: string): Clause => clauses(parse(source))[0] as Clause

export function BlockedLiteralGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The definition, literally">
        <Card>
          <Prose>
            <p>
              A literal <Sym>l ∈ C</Sym> is <strong>blocked</strong> when, for{' '}
              <strong>every</strong> clause <Sym>D</Sym> of the formula containing <Sym>¬l</Sym>,
              the resolvent <Sym>Res_l(C, D)</Sym> is a tautology (Definition 2.33).
            </p>
            <p>
              Two words carry the whole thing. <strong>Every</strong>: one non-tautology anywhere
              and it is not blocked. And <strong>containing ¬l</strong>: clauses without the
              complement are not part of the question at all.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="A pure literal is blocked for free">
          <p>
            If <Sym>¬l</Sym> appears nowhere, then "every clause containing <Sym>¬l</Sym>" is a
            statement about an empty set, and every statement about an empty set is true. Nothing to
            check.
          </p>
          <p className="mt-2">
            That is the whole content of the bonus proof: <Sym>l</Sym> pure means no clause has{' '}
            <Sym>¬l</Sym>; the blocked condition quantifies over those clauses; the set is empty; the
            condition holds vacuously. ∎
          </p>
        </Callout>

        <Callout tone="warn" title="When a literal is named, check only that one">
          <p>
            "Is <Sym>C</Sym> blocked?" and "is <Sym>C</Sym> blocked <em>on l</em>?" are different
            questions. A clause can be blocked on one of its literals and not another, and the
            second question is only about the literal named.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The non-vacuous case">
        <Worked
          source="(a ∨ b) ∧ (¬a ∨ ¬b) ∧ (b ∨ c)"
          clause="a ∨ b"
          literal={{ name: 'a', negated: false }}
          caption="Blocked, but not vacuously"
        />
        <Prose>
          <p>
            <Sym>a</Sym> is not pure — <Sym>¬a</Sym> is right there in the second clause. But that
            one clause resolves to <Sym>(b ∨ ¬b)</Sym>, a tautology, and it is the only one to
            check. So the condition holds and the clause is blocked.
          </p>
        </Prose>

        <Worked
          source="(a ∨ b) ∧ (¬a ∨ c)"
          clause="a ∨ b"
          literal={{ name: 'a', negated: false }}
          caption="Not blocked"
        />
        <Prose>
          <p>
            Same clause, different formula. Here the resolvent is <Sym>(b ∨ c)</Sym>, which is not a
            tautology, and one failure is all it takes.
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tap a literal <em>inside</em> the clause to put it under the microscope. Every clause
                containing its complement deals itself out, with its resolvent and a verdict.
              </li>
              <li>
                No cards at all means the complement appears nowhere — vacuously blocked, and you
                can submit immediately.
              </li>
              <li>
                One red card is enough to rule a literal out. Try the next one.
              </li>
              <li>
                <strong>No literal blocks it</strong> is a real answer, and checking every literal
                is the only way to be sure of it.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Worked({
  source,
  clause,
  literal,
  caption,
}: {
  source: string
  clause: string
  literal: { name: string; negated: boolean }
  caption: string
}) {
  const set = S(source)
  const target = C(clause)
  const opposite = { name: literal.name, negated: !literal.negated }
  const others = set.filter(
    (other) =>
      other !== target &&
      other.some((entry) => entry.name === opposite.name && entry.negated === opposite.negated),
  )
  const blocked = isBlockedOn(set, target, literal)
  const pure = pureLiterals(set).some(
    (entry) => entry.name === literal.name && entry.negated === literal.negated,
  )

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {set.map((entry, index) => (
          <ClauseText key={index} clause={entry} className="text-sm font-bold" />
        ))}
      </p>
      <p className="mt-2 text-sm font-medium">
        Is <ClauseText clause={target} className="font-bold" /> blocked on{' '}
        <span className="formula font-bold">
          {literal.negated ? '¬' : ''}
          {literal.name}
        </span>
        ?
      </p>

      {others.length === 0 ? (
        <p className="mt-2 rounded-xl bg-grass px-3 py-2 text-sm font-bold text-white">
          Nothing contains the complement — vacuously blocked.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-3 border-ink">
                <th className="py-2 pr-3">Clause with the complement</th>
                <th className="py-2 pr-3">Resolvent</th>
                <th className="py-2">Tautology?</th>
              </tr>
            </thead>
            <tbody>
              {others.map((other, index) => {
                const resolvent = resolveOn(target, other, literal.name)
                const tautology = resolvent !== null && isTautologicalClause(resolvent)
                return (
                  <tr key={index} className="border-t-2 border-dashed border-card-shade">
                    <td className="py-2 pr-3">
                      <ClauseText clause={other} className="font-bold" />
                    </td>
                    <td className="py-2 pr-3">
                      {resolvent !== null && <ClauseText clause={resolvent} className="font-bold" />}
                    </td>
                    <td className={`py-2 font-bold ${tautology ? 'text-grass-deep' : 'text-space-red'}`}>
                      {tautology ? 'yes ✓' : 'no ✗'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className={`mt-2 text-base font-bold ${blocked ? 'text-grass-deep' : 'text-space-red'}`}>
        {blocked ? 'Blocked' : 'Not blocked'}
        {blocked && pure && ' — vacuously'}
      </p>
    </Card>
  )
}
