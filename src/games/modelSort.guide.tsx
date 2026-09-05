/**
 * Entailment and equivalence as statements about model sets.
 *
 * Every relationship claimed below is computed by the same `entails` and
 * `isEquivalent` the game marks with.
 */

import { entails, isEquivalent, parse } from '@/logic'
import { Callout, F, GuideSection, MiniTruthTable, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'

export function ModelSortGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Both words are about sets">
        <Card>
          <Prose>
            <p>
              <strong>Entailment</strong> (Definition 2.9): <Sym>φ ⊨ ψ</Sym> when every model of{' '}
              <Sym>φ</Sym> is also a model of <Sym>ψ</Sym>. The models of <Sym>φ</Sym> are a{' '}
              <em>subset</em> of the models of <Sym>ψ</Sym>.
            </p>
            <p>
              <strong>Equivalence</strong> (Definition 2.11): <Sym>φ ≡ ψ</Sym> when the two model
              sets are <em>equal</em>.
            </p>
            <p>
              So both are answered by sorting assignments into regions and looking at which regions
              came out empty. That is the whole game.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="Reading the board">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-3 border-ink">
                  <th className="py-2 pr-3">Empty region</th>
                  <th className="py-2">Means</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t-2 border-dashed border-card-shade">
                  <td className="py-2 pr-3 font-bold">only φ</td>
                  <td className="py-2">
                    <Sym>φ ⊨ ψ</Sym> — nothing satisfies φ without satisfying ψ
                  </td>
                </tr>
                <tr className="border-t-2 border-dashed border-card-shade">
                  <td className="py-2 pr-3 font-bold">only ψ</td>
                  <td className="py-2">
                    <Sym>ψ ⊨ φ</Sym>
                  </td>
                </tr>
                <tr className="border-t-2 border-dashed border-card-shade">
                  <td className="py-2 pr-3 font-bold">both outer regions</td>
                  <td className="py-2">
                    <Sym>φ ≡ ψ</Sym> — the sets are equal
                  </td>
                </tr>
                <tr className="border-t-2 border-dashed border-card-shade">
                  <td className="py-2 pr-3 font-bold">neither</td>
                  <td className="py-2">no entailment either way</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Prose>
            <p className="mt-3">
              Note what does <em>not</em> matter: the "neither" region. Assignments satisfying
              nothing say nothing about entailment — they are in neither set, so they cannot break
              a subset claim.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="⊨ is not →">
          <p>
            They are related and they are not the same thing. <Sym>φ → ψ</Sym> is a{' '}
            <em>formula</em>, which has a truth value in each row.{' '}
            <Sym>φ ⊨ ψ</Sym> is a <em>claim about all rows at once</em>.
          </p>
          <p className="mt-2">
            The bridge is Theorem 2.13: <Sym>φ ⊨ ψ</Sym> exactly when <F>p → q</F>-shaped formula{' '}
            <Sym>φ → ψ</Sym> is <strong>valid</strong>. So one is the other, quantified.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The example from the notes">
        <Card>
          <Prose>
            <p>
              <Relationship left="x" right="x ∨ y" />. Every row with <F>x</F> true also has{' '}
              <F>x ∨ y</F> true, so the "only φ" region is empty.
            </p>
            <p>
              <Relationship left="x ∨ y" right="x" />. The row <Sym>x = F, y = T</Sym> satisfies the
              disjunction and not <F>x</F>, so it lands in "only φ" and the claim fails.
            </p>
          </Prose>
          <div className="mt-3">
            <MiniTruthTable source="x ∨ y" columns={['x']} />
          </div>
        </Card>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Drag each assignment token into the region it belongs to. Tap a placed token to send
                it back.
              </li>
              <li>
                Work one formula at a time: decide whether the row satisfies <Sym>φ</Sym>, then{' '}
                <Sym>ψ</Sym>, and the region follows.
              </li>
              <li>
                Every board uses at least two of the four regions, so "put everything in one" never
                works.
              </li>
              <li>
                The relationship is announced once the board is right — read it off the empty
                regions before you look.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** The relationship between two formulas, computed rather than asserted. */
function Relationship({ left, right }: { left: string; right: string }) {
  const a = parse(left)
  const b = parse(right)
  const holds = entails([a], b)
  const same = isEquivalent(a, b)
  return (
    <span className="formula font-bold">
      {left} {holds ? '⊨' : '⊭'} {right}
      {same && ' (and ≡)'}
    </span>
  )
}
