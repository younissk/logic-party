/**
 * Membership in the theory of a structure.
 *
 * Both worked tables are filled in by `evaluateFormula` and `holdsIn` — the
 * functions the game marks with — over the two interpretations the course
 * actually asks about.
 */

import {
  evaluateFormula,
  holdsIn,
  makeStructure,
  parseFormula,
  type FoFormula,
  type Structure,
} from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'

/**
 * Rebuilt here rather than imported from the game.
 *
 * The game imports this guide, and a guide reading a game's exports at module
 * top gets `undefined` from the cycle. Same tables either way.
 */
const LABELS = ['a', 'b']
const SWAP: Structure = makeStructure({
  size: 2,
  labels: LABELS,
  functions: { f: { arity: 1, value: ([x]) => 1 - (x as number) } },
  predicates: { p: { arity: 1, value: ([x]) => x === 0 } },
})

const parse = (source: string): FoFormula =>
  parseFormula(source, { predicates: { p: 1 }, functions: { f: 1, a: 0, b: 0 } })

const EXAMPLES: readonly string[] = [
  '∀x:p(x)',
  '∃x:p(x)',
  '∀x:p(f(x))',
  '∃x:∀y:(p(x)→p(f(y)))',
  '∀x:(p(x)↔¬p(f(x)))',
]

function RowTable({ source }: { source: string }) {
  const formula = parse(source)
  if (formula.kind !== 'quantified') return null
  const rows = LABELS.map((label, element) => ({
    label,
    value: evaluateFormula(SWAP, { [formula.variable]: element }, formula.body),
  }))
  return (
    <tr>
      <td className="px-2 py-1">
        <FoText text={source} className="font-bold" />
      </td>
      {rows.map((row) => (
        <td key={row.label} className="px-2 py-1 font-bold">
          {String(row.value)}
        </td>
      ))}
      <td className="px-2 py-1 font-bold">
        {formula.quantifier === 'forall' ? 'all' : 'some'}
      </td>
      <td className="px-2 py-1 font-bold">{holdsIn(SWAP, formula) ? 'in T' : '—'}</td>
    </tr>
  )
}

export function DoesItBelongGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="The theory of a structure">
        <Card>
          <Prose>
            <p>
              Fix one interpretation and collect every closed formula true in it. That set is a
              theory — anything it entails is true there too — and it is always{' '}
              <strong>complete</strong>, because the structure decides every closed formula one way
              or the other. It is also always consistent, since it has a model by construction.
            </p>
            <p>
              Membership is therefore not a proof search. It is evaluation, Definition 4.3: a
              quantifier is a loop over the universe, and the universe here is two or three
              elements.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="Only closed formulas are in a theory">
          <p>
            Exercise 10 slips <Sym>∃x:p(f(y),x)</Sym> into its list with a free <Sym>y</Sym>. A
            theory is a set of <em>closed</em> formulas, so a formula with a free variable is not a
            candidate at all — whatever it evaluates to.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="exam26a's interpretation, worked">
        <Card>
          <Prose>
            <p>
              U = {'{a,b}'}, with <Sym>f(a)=b</Sym>, <Sym>f(b)=a</Sym>, <Sym>p(a)</Sym> true and{' '}
              <Sym>p(b)</Sym> false. Each row evaluates the body at both values of the outer
              variable; the quantifier then reads off the column.
            </p>
          </Prose>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-2 py-1">formula</th>
                  <th className="px-2 py-1">at a</th>
                  <th className="px-2 py-1">at b</th>
                  <th className="px-2 py-1">needs</th>
                  <th className="px-2 py-1">verdict</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLES.map((source) => (
                  <RowTable key={source} source={source} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Callout tone="tip" title="Justify with the element">
          <p>
            The exam asks you to justify the answer. For an <Sym>∃</Sym> that holds, name the
            element that works. For a <Sym>∀</Sym> that fails, name the element that breaks it. One
            element is a complete justification either way — and it is exactly the row the game
            makes you fill in.
          </p>
        </Callout>

        <Callout tone="warn" title="∃x∀y is not ∀y∃x">
          <p>
            <Sym>∃x∀y:(p(x)→p(f(y)))</Sym> asks for one x that works for every y. Swapping the
            quantifiers asks for a y-dependent x, which is a weaker demand. Evaluate the inner
            quantifier for each outer value and the difference stops being subtle.
          </p>
        </Callout>
      </GuideSection>
    </div>
  )
}
