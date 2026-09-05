/**
 * How to decide a first-order sentence in a finite structure.
 *
 * Exercise 7's twelve sentences are decided by `evaluateFormula` — the function
 * the game marks with — over the structure the exercise itself states.
 */

import { elementLabel, evaluateFormula, parseFormula, type Structure } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'
import { STRUCTURES, prefixOf, type StructureSpec } from './foEvaluate'

/**
 * Read at render time, not at module load.
 *
 * The game imports this guide and this guide imports the game's structures, so
 * reading them while the modules are still initialising leaves one of the two
 * undefined. Every other guide gets away with a top-level constant because it
 * only imports from the logic core.
 */
export function FoEvaluateGuide() {
  const MOD4 = STRUCTURES.mod4 as { structure: Structure; spec: StructureSpec }
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What a structure gives you">
        <Card>
          <Prose>
            <p>
              A nonempty universe, a function <Sym>Uⁿ → U</Sym> for every function symbol, and a
              predicate from tuples to truth values for every predicate symbol. Nothing else,
              and nothing is left to interpretation once those are fixed.
            </p>
            <p>
              Evaluation then follows Definition 4.3 mechanically: work the terms out to elements,
              read the predicate off its table, and combine with the propositional rules.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="A quantifier is a loop">
          <p>
            <Sym>∀x:ψ</Sym> is true when ψ is true for <em>every</em> element with x set to it.{' '}
            <Sym>∃x:ψ</Sym> is true when it is true for <em>at least one</em>. Over four elements
            that is four checks, which is a procedure rather than an intuition.
          </p>
        </Callout>

        <Callout tone="warn" title="The order of two quantifiers is not cosmetic">
          <p>
            <Sym>∃x∀y:r(x,y)</Sym> asks for a single x that works for every y.{' '}
            <Sym>∀y∃x:r(x,y)</Sym> lets x depend on y. The first is much stronger, and telling them
            apart is the whole reason Skolemization needs function symbols later.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The structure, and the twelve sentences">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Exercise 7, question 2
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm font-semibold text-ink-soft">
            {MOD4.spec.describe.map((line) => (
              <li key={line} className="formula">
                {line}
              </li>
            ))}
          </ul>
          <Table
            sentences={[
              'p(f(a()))∨¬q(g(b()))',
              'r(a(),g(a()))',
              '∀x:(p(x)∨q(x))',
              '∀x:(p(x)→p(g(g(x))))',
              '∃x:∀y:r(x,y)',
              'p(f(a()))∧¬p(f(a()))',
              'r(a(),b())',
              '∀x:(q(f(x))∨q(g(x)))',
              'p(b())',
              '∃x:(p(x)∨∃y:r(x,y))',
              '∃x:(q(x)∧¬q(g(g(x))))',
              '∃x:∀y:(r(x,y)∨r(g(x),y)∨r(x,g(y)))',
            ]}
          />
        </Card>
      </GuideSection>

      <GuideSection title="How to answer quickly">
        <Callout tone="tip" title="Attack ∃ and ∀ from opposite ends">
          <p>
            To show <Sym>∃x:ψ</Sym> holds you need one element; to show it fails you need all of
            them. For <Sym>∀x:ψ</Sym> it is the other way round. So always try to <em>break</em> a ∀
            and to <em>satisfy</em> an ∃ — one lucky element ends the question either way.
          </p>
        </Callout>

        <Callout tone="warn" title="Watch what a function does to your candidate">
          <p>
            In this structure <Sym>g</Sym> adds 2 mod 4, so <Sym>g(g(x))</Sym> is x again — which is
            why <Sym>∀x:(p(x)→p(g(g(x))))</Sym> holds and{' '}
            <Sym>∃x:(q(x)∧¬q(g(g(x))))</Sym> cannot. Composing the functions first often settles the
            sentence before you touch the predicates.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                One layer per quantifier, outermost first, and each layer shows the formula that
                remains. For ∃ you pick the witness; for ∀ the counterexample.
              </li>
              <li>
                “None works” and “none breaks it” settle a layer the other way, and they are checked
                — claiming there is no witness when there is one is marked wrong with the element
                that works.
              </li>
              <li>
                The verdict follows from your choices. There is no separate true/false button to
                guess at.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** Every sentence decided by running it. */
function Table({ sentences }: { sentences: string[] }) {
  const { structure, spec } = STRUCTURES.mod4 as { structure: Structure; spec: StructureSpec }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-3 border-ink">
            <th className="py-2 pr-3 whitespace-nowrap">Sentence</th>
            <th className="py-2 pr-3 whitespace-nowrap">Holds?</th>
            <th className="py-2">Decided by</th>
          </tr>
        </thead>
        <tbody>
          {sentences.map((source) => {
            const formula = parseFormula(source, spec.signature)
            const holds = evaluateFormula(structure, {}, formula)
            const layers = prefixOf(formula)
            const outer = layers[0]
            let witness = '—'
            if (outer !== undefined) {
              for (let element = 0; element < structure.size; element++) {
                const inner = evaluateFormula(
                  structure,
                  { [outer.variable]: element },
                  formula.kind === 'quantified' ? formula.body : formula,
                )
                if (outer.quantifier === 'exists' && inner) {
                  witness = `${outer.variable} = ${elementLabel(structure, element)} works`
                  break
                }
                if (outer.quantifier === 'forall' && !inner) {
                  witness = `${outer.variable} = ${elementLabel(structure, element)} breaks it`
                  break
                }
              }
              if (witness === '—') {
                witness = outer.quantifier === 'exists' ? 'no element works' : 'no element breaks it'
              }
            }
            return (
              <tr key={source} className="border-t-2 border-dashed border-card-shade align-top">
                <td className="py-2 pr-3">
                  <FoText text={source} className="font-bold" />
                </td>
                <td className={`py-2 pr-3 font-bold ${holds ? 'text-grass-deep' : 'text-space-red'}`}>
                  {holds ? 'yes' : 'no'}
                </td>
                <td className="py-2 text-ink-soft">{witness}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
