/**
 * Derivable in one step.
 *
 * The worked pairs are computed by `allResolvents` — the same function the
 * game uses — so what is reachable here is what is reachable there.
 */

import { allResolvents, clauses, isTautologicalClause, parse, sharedVariables, type Clause } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { ClauseText } from '@/ui/ClauseText'

const C = (source: string): Clause => clauses(parse(source))[0] as Clause

export function OneStepGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="A different question">
        <Card>
          <Prose>
            <p>
              "Is X derivable?" asks what resolution can reach <em>eventually</em>, over any number
              of steps. This asks what it can reach <strong>now</strong>, in one, and the answer is
              much more often no.
            </p>
            <p>
              The search is small and finite: every unordered pair, and inside each pair every
              clashing variable. If none of those gives the target, no single step does.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="What to check, in order">
        <Card>
          <Prose>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>
                <strong>Does the target contain a variable neither parent has?</strong> Resolution
                only ever deletes literals, so it can never invent one. That rules out pairs
                instantly.
              </li>
              <li>
                <strong>Count literals.</strong> One step from clauses of size m and n gives at most
                m + n − 2. A target wider than that is out of reach from that pair.
              </li>
              <li>
                <strong>Then look for the pivot.</strong> The variable missing from the target that
                appears in both parents, in opposite signs.
              </li>
            </ol>
          </Prose>
        </Card>

        <Callout tone="tip" title="The target is a subtraction, not an addition">
          <p>
            A resolvent is the union of both parents <em>minus</em> the pivot pair. So read the
            target backwards: whatever is in it must have come from one parent or the other, and
            whatever is in a parent but not the target must be the pivot.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Worked">
        <Card>
          <Prose>
            <p>
              From <Sym>(a ∨ b)</Sym>, <Sym>(¬a ∨ c)</Sym> and <Sym>(¬b ∨ ¬c)</Sym>, here is
              everything one step reaches:
            </p>
          </Prose>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-3 border-ink">
                  <th className="py-2 pr-3">Pair</th>
                  <th className="py-2 pr-3">Pivot</th>
                  <th className="py-2">Gives</th>
                </tr>
              </thead>
              <tbody>
                <Reachable sources={['a ∨ b', '¬a ∨ c', '¬b ∨ ¬c']} />
              </tbody>
            </table>
          </div>
          <Prose>
            <p className="mt-3">
              So <Sym>(b ∨ c)</Sym> is one step away and <Sym>(a ∨ ¬c)</Sym> is not — even though
              both are derivable eventually. Being reachable and being reachable{' '}
              <em>now</em> are different questions, and this one is the second.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tap two clauses. If they clash on more than one variable you are asked which pivot —
                one per step, always.
              </li>
              <li>
                A wrong pair shows you what it actually gives, so a miss still tells you something.
              </li>
              <li>
                About a third of the targets are <strong>not</strong> one step away. Knowing when to
                stop looking is the other half of the skill.
              </li>
              <li>
                "No single step reaches it" does not mean "not derivable" — only that you would need
                more than one.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Reachable({ sources }: { sources: string[] }) {
  const set = sources.map(C)
  const rows: { pair: string; pivot: string; resolvent: Clause; tautology: boolean }[] = []

  for (let i = 0; i < set.length; i++) {
    for (let j = i + 1; j < set.length; j++) {
      const left = set[i] as Clause
      const right = set[j] as Clause
      const steps = allResolvents([left, right])
      if (steps.length === 0) {
        rows.push({
          pair: `${i + 1}, ${j + 1}`,
          pivot: sharedVariables(left, right).length === 0 ? 'no shared variable' : 'no clash',
          resolvent: [],
          tautology: false,
        })
        continue
      }
      for (const step of steps) {
        rows.push({
          pair: `${i + 1}, ${j + 1}`,
          pivot: step.pivot,
          resolvent: step.resolvent,
          tautology: isTautologicalClause(step.resolvent),
        })
      }
    }
  }

  return (
    <>
      {rows.map((row, index) => (
        <tr key={index} className="border-t-2 border-dashed border-card-shade">
          <td className="py-2 pr-3 font-bold whitespace-nowrap">{row.pair}</td>
          <td className="formula py-2 pr-3 font-bold whitespace-nowrap">{row.pivot}</td>
          <td className="py-2">
            {row.resolvent.length === 0 && row.pivot.includes(' ') ? (
              <span className="text-ink-soft">none</span>
            ) : (
              <>
                <ClauseText clause={row.resolvent} className="font-bold" />
                {row.tautology && (
                  <span className="ml-2 text-xs font-bold text-ink-soft">tautology</span>
                )}
              </>
            )}
          </td>
        </tr>
      ))}
    </>
  )
}
