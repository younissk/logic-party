/**
 * Quantifier elimination over a finite universe.
 *
 * Every expansion on this page is produced by the game's own `leavesOf`, which
 * instantiates the matrix with `substituteFormula` — so the tables here are
 * the same expansions the game marks.
 */

import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'
import { leavesOf, prefixOf, formulaOf, type QeFiniteQuestion } from './qeFinite'

const question = (source: string, universe: string[], predicates: Record<string, number>): QeFiniteQuestion => ({
  source,
  predicates,
  functions: Object.fromEntries(universe.map((name) => [name, 0])),
  universe,
  bank: [],
})

const EXAMPLES: readonly QeFiniteQuestion[] = [
  question('∀x:p(x)', ['a', 'b', 'c'], { p: 1 }),
  question('∃x:p(x)', ['a', 'b', 'c'], { p: 1 }),
  question('∀x:∃y:p(x,y)', ['a', 'b'], { p: 2 }),
  question('∃x:∀y:p(x,y)', ['a', 'b'], { p: 2 }),
]

const JOIN = { forall: '∧', exists: '∨' } as const

/** The expansion, grouped the way the quantifier prefix groups it. */
function expansion(item: QeFiniteQuestion): string {
  const { quantifiers } = prefixOf(formulaOf(item))
  const leaves = leavesOf(item)
  const size = item.universe.length

  let level = quantifiers.length - 1
  let parts = leaves
  while (level >= 0) {
    const symbol = JOIN[quantifiers[level]!.quantifier]
    const grouped: string[] = []
    for (let start = 0; start < parts.length; start += size) {
      const slice = parts.slice(start, start + size)
      grouped.push(slice.length === 1 ? slice[0]! : `(${slice.join(` ${symbol} `)})`)
    }
    parts = grouped
    level -= 1
  }
  return parts[0] ?? ''
}

export function QeFiniteGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What quantifier elimination is">
        <Card>
          <Prose>
            <p>
              A theory <strong>admits quantifier elimination</strong> (Definition 5.4) when every
              formula has an equivalent one with no quantifiers in it. That is a strong property:
              a quantifier-free formula over a decidable atom relation is easy to evaluate, which
              is why QE is the usual route to showing a theory decidable.
            </p>
            <p>
              It does not follow the other way round. A theory can be decidable without admitting
              QE — <Sym>T(N,=,+)</Sym> is the course's example, decided by automata rather than by
              elimination.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="The finite case is free">
          <p>
            If the universe is finite and every element has a constant naming it, a quantifier is
            just an abbreviation: <Sym>∀x</Sym> is a conjunction over the elements, <Sym>∃x</Sym> a
            disjunction. Expand them all and there is nothing left. So every theory over a finite
            universe admits quantifier elimination.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Worked expansions">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-2 py-1">formula</th>
                  <th className="px-2 py-1">universe</th>
                  <th className="px-2 py-1">expansion</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLES.map((item) => (
                  <tr key={item.source} className="align-top">
                    <td className="px-2 py-1">
                      <FoText text={item.source} className="font-bold" />
                    </td>
                    <td className="px-2 py-1 font-logic">
                      {'{'}
                      {item.universe.join(',')}
                      {'}'}
                    </td>
                    <td className="px-2 py-1">
                      <FoText text={expansion(item)} className="font-bold" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Callout tone="warn" title="The order of the arguments is the trap">
          <p>
            Compare the third and fourth rows. Both expand to four atoms over the same universe,
            both use the same four atoms — and they are grouped differently, because the outer
            quantifier is the outer connective. Substitute outermost first: fix{' '}
            <Sym>x</Sym> to the first element, expand everything under it, then move on.
          </p>
        </Callout>

        <Callout tone="warn" title="It grows fast">
          <p>
            The expansion has |U|<sup>k</sup> leaves for k quantifiers. Two quantifiers over three
            elements is nine; three is twenty-seven. Finite does not mean small, and this is why the
            interesting theories in this chapter are the infinite ones, where elimination has to be
            cleverer than expansion.
          </p>
        </Callout>
      </GuideSection>
    </div>
  )
}
