/**
 * Herbrand interpretations, and why finding one settles satisfiability.
 *
 * Every verdict is computed by `isHerbrandModel` and the game's own exhaustive
 * search, so the "no model" claims are facts rather than failures to find one.
 */

import { herbrandBase, isHerbrandModel, parseFoClauseSet, showFoLiteral, type FoSignature } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoClauseText } from '@/ui/FoText'

const SIG: FoSignature = { predicates: { p: 1, q: 1 }, functions: { a: 0, b: 0 } }

export function HerbrandModelGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What is left to choose">
        <Card>
          <Prose>
            <p>
              In a Herbrand interpretation the universe is fixed — the ground terms — and every
              function symbol is fixed too: it builds the term that names it, so{' '}
              <Sym>f(a())</Sym> denotes <Sym>f(a())</Sym>.
            </p>
            <p>
              The predicate symbols are the only freedom. So an interpretation is nothing more than{' '}
              <strong>the set of ground atoms it makes true</strong>, and with n ground atoms there
              are exactly 2ⁿ of them.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="How to satisfy a clause set">
          <p>
            A clause is satisfied when at least one of its literals is true. A{' '}
            <strong>positive</strong> literal is true when its atom is switched on; a{' '}
            <strong>negative</strong> one when its atom is switched <em>off</em>. Unit clauses force
            their atom, so start there and propagate.
          </p>
        </Callout>

        <Callout tone="warn" title="Theorem 4.20 makes failing useful">
          <p>
            A clause set is unsatisfiable <em>if and only if</em> it has no Herbrand model. So there
            is no need to consider any other universe: if nothing here works, nothing anywhere works.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Example 4.19, all three parts">
        <Worked
          clauses={['¬p(a())', 'p(a())']}
          caption="Part 1 — two interpretations, and neither works"
        />
        <Worked
          clauses={['p(a()) ∨ q(a())', '¬p(a())']}
          caption="Switching q on is enough"
        />
        <Worked
          clauses={['p(a()) ∨ p(b())', '¬p(a())', '¬p(b())']}
          caption="Both units force both atoms off, and the first clause dies"
        />
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tap ground atoms to switch them on. Clauses turn green as they become satisfied, so
                you can see what each switch bought.
              </li>
              <li>
                The other button claims no model exists. That is checked by trying every
                interpretation, so it is right or wrong on the facts.
              </li>
              <li>
                Both answers come up about equally, so neither is a safe default.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** Every interpretation of a small clause set, tabulated. */
function Worked({ clauses, caption }: { clauses: string[]; caption: string }) {
  const parsed = parseFoClauseSet(clauses, SIG)
  const base = herbrandBase(parsed, 0)
  const total = 2 ** base.length

  const rows: { atoms: string; ok: boolean }[] = []
  for (let mask = 0; mask < total; mask++) {
    const trueAtoms = base.filter((_, index) => (mask & (1 << index)) !== 0)
    rows.push({
      atoms: trueAtoms.length === 0 ? '∅' : trueAtoms.map(showFoLiteral).join(', '),
      ok: isHerbrandModel(parsed, trueAtoms, 0),
    })
  }

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <div className="mt-1 flex flex-col gap-1">
        {parsed.map((clause, index) => (
          <div key={index} className="rounded-xl bg-card-shade px-3 py-1.5">
            <FoClauseText clause={clause} className="font-bold" />
          </div>
        ))}
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-1.5 pr-3 whitespace-nowrap">Atoms switched on</th>
              <th className="py-1.5">A model?</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.atoms} className="border-t-2 border-dashed border-card-shade">
                <td className="formula py-1.5 pr-3 font-bold">{row.atoms}</td>
                <td className={`py-1.5 font-bold ${row.ok ? 'text-grass-deep' : 'text-space-red'}`}>
                  {row.ok ? 'yes' : 'no'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-sm font-bold">
        {rows.some((row) => row.ok)
          ? `${rows.filter((row) => row.ok).length} of ${total} interpretations work — satisfiable.`
          : `None of the ${total} interpretations works, so the set is unsatisfiable.`}
      </p>
    </Card>
  )
}
