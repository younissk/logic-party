/**
 * The bonus proof: a pure literal makes its clauses blocked.
 *
 * The worked example is checked here by `isBlockedOn`, which runs the general
 * definition — every resolvent computed — rather than the shortcut the proof
 * establishes. So the table demonstrates the theorem instead of assuming it.
 */

import {
  isBlockedOn,
  normaliseClause,
  pureLiterals,
  resolveOn,
  isTautologicalClause,
  showClause,
  type Clause,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'

const clause = (entries: [string, boolean][]): Clause =>
  normaliseClause(entries.map(([name, negated]) => ({ name, negated })))

/** A formula with one pure literal and one clause that is blocked the hard way. */
const PHI: Clause[] = [
  clause([
    ['a', false],
    ['b', false],
    ['e', false],
  ]),
  clause([
    ['a', true],
    ['c', false],
  ]),
  clause([
    ['b', true],
    ['c', false],
  ]),
  clause([
    ['a', false],
    ['c', true],
  ]),
]

function BlockedTable() {
  const pure = pureLiterals(PHI)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-ink-soft">
          <tr>
            <th className="px-2 py-1">clause</th>
            <th className="px-2 py-1">blocked on</th>
            <th className="px-2 py-1">clauses to resolve against</th>
            <th className="px-2 py-1">by the shortcut?</th>
          </tr>
        </thead>
        <tbody>
          {PHI.map((entry) => {
            const on = entry.filter((literal) => isBlockedOn(PHI, entry, literal))
            const first = on[0]
            const against =
              first === undefined
                ? []
                : PHI.filter(
                    (other) =>
                      other !== entry &&
                      other.some(
                        (item) => item.name === first.name && item.negated !== first.negated,
                      ),
                  )
            const isPure =
              first !== undefined &&
              pure.some((literal) => literal.name === first.name && literal.negated === first.negated)
            return (
              <tr key={showClause(entry)}>
                <td className="px-2 py-1 formula font-bold">{showClause(entry)}</td>
                <td className="px-2 py-1 formula font-bold">
                  {first === undefined
                    ? 'not blocked'
                    : `${first.negated ? '¬' : ''}${first.name}`}
                </td>
                <td className="px-2 py-1 formula">
                  {first === undefined
                    ? '—'
                    : against.length === 0
                      ? 'none'
                      : against.map(showClause).join(', ')}
                </td>
                <td className="px-2 py-1 font-bold">
                  {first === undefined ? '—' : isPure ? 'yes, pure' : 'no — resolvents checked'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function PureMeansBlockedGuide() {
  const pure = pureLiterals(PHI)
  const witness = pure[0]

  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The question">
        <Card>
          <Prose>
            <p>
              exam26bA's bonus: a literal <Sym>l</Sym> is <strong>pure</strong> in φ when φ contains{' '}
              <Sym>l</Sym> and does not contain <Sym>¬l</Sym>. Show that every clause of φ
              containing a pure literal is a blocked clause.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="The proof, in two sentences">
          <p>
            By Definition 2.33, <Sym>C</Sym> is blocked on <Sym>l ∈ C</Sym> if for every clause{' '}
            <Sym>D</Sym> of φ containing <Sym>¬l</Sym>, the resolvent of <Sym>C</Sym> and{' '}
            <Sym>D</Sym> on <Sym>l</Sym> is a tautology. Since <Sym>l</Sym> is pure, no such{' '}
            <Sym>D</Sym> exists, so the condition is over an empty set and holds vacuously. ∎
          </p>
          <p className="mt-2">
            No resolvent is ever computed. That is what makes it a two-line proof — and the reason a
            vacuous truth is doing the work is worth saying out loud, because it is the step that
            looks like it must be missing something.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Seen on a formula">
        <Card>
          <Prose>
            <p>
              φ = {PHI.map(showClause).join(' ∧ ')}.{' '}
              {witness === undefined ? (
                'Every literal here meets its complement.'
              ) : (
                <>
                  <Sym>{`${witness.negated ? '¬' : ''}${witness.name}`}</Sym> is pure — its
                  complement occurs in no clause — so every clause containing it is blocked with no
                  work at all. The table below runs the general definition anyway, so the shortcut
                  is confirmed rather than assumed.
                </>
              )}
            </p>
          </Prose>
          <div className="mt-3">
            <BlockedTable />
          </div>
        </Card>

        <Callout tone="warn" title="Blocked is relative to the formula">
          <p>
            "Blocked in φ" means blocked with respect to <Sym>{'φ \\ {C}'}</Sym> — a clause never
            has to resolve against itself. And removing one blocked clause can block another, which
            is why blocked clause elimination cascades.
          </p>
        </Callout>

        <Callout tone="tip" title="Why anyone cares">
          <p>
            Removing a blocked clause preserves satisfiability, so eliminating clauses until nothing
            is left is a satisfiability proof — exam25a asks for exactly that. Pure literals are the
            cheapest place to start, because they cost no checking:{' '}
            {(() => {
              const resolvent =
                witness === undefined ? null : resolveOn(PHI[0] as Clause, PHI[1] as Clause, 'a')
              return resolvent === null
                ? 'and where they run out, the resolvents have to be computed one at a time.'
                : `and where they run out, you compute resolvents like ${showClause(resolvent)}, which is ${
                    isTautologicalClause(resolvent) ? 'a tautology' : 'not a tautology'
                  }.`
            })()}
          </p>
        </Callout>
      </GuideSection>
    </div>
  )
}
