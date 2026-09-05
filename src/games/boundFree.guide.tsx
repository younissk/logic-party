/**
 * Bound, free, closed, clean.
 *
 * Every marking on this page is produced by `occurrences`, `isClosed` and
 * `isClean` — the functions the game marks with.
 */

import { isClean, isClosed, parseFormula, showFormula, type FoSignature } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'
import { occurrences } from './boundFree'

const SIG: FoSignature = {
  predicates: { p: 1, q: 1, r: 2, s: 1, t: 2 },
  functions: { a: 0, f: 1 },
}

export function BoundFreeGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Occurrences, not variables">
        <Card>
          <Prose>
            <p>
              A variable occurrence is <strong>bound</strong> if, on the path from it up to the root
              of the formula tree, there is a quantifier for <em>that same name</em>. Otherwise it is{' '}
              <strong>free</strong>.
            </p>
            <p>
              The notes are careful to say "a particular occurrence", because one letter can be both
              in one formula. In <Sym>p(x)∨∃x:q(x)</Sym> the first x is free and the second is bound.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="What does not bind an occurrence">
          <p>
            A quantifier for a <em>different</em> name binds nothing here. Neither does a quantifier
            somewhere else in the formula that this occurrence is not underneath — scope is about the
            path to the root, not about the page.
          </p>
        </Callout>

        <Callout tone="warn" title="The letter beside a quantifier is the binder">
          <p>
            In <Sym>∀x:p(x)</Sym> there is one occurrence to judge, not two. The x written next to ∀
            is the binder itself, and the game does not ask about it.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Closed and clean are different questions">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong>Closed</strong>: no occurrence is free. A closed formula's truth depends only
                on the interpretation, never on an assignment — which is why every later definition
                assumes it.
              </li>
              <li>
                <strong>Clean</strong>: every variable is free, or bound by exactly one quantifier.
                Two quantifiers over the same name break it, and so does a name that is free
                somewhere and bound elsewhere.
              </li>
            </ul>
          </Prose>
        </Card>

        <Callout tone="warn" title="Closed does not imply clean">
          <p>
            <Sym>(∀x:p(x))∨(∃x:q(x))</Sym> has no free occurrence at all — it is closed — and two
            quantifiers bind x, so it is not clean. This is the formula the notes show getting stuck
            in the prenex transformation, and bounded renaming is the repair.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="Worked, occurrence by occurrence">
        <Worked source="∃x:(¬s(x)∧∀y:t(y,x))∧s(a())" caption="Exercise 7, question 1" />
        <Worked source="p(x)∨∃x:q(x)" caption="One letter, both answers" />
        <Worked source="(∀x:p(x))∨(∃x:q(x))" caption="Closed, and not clean" />
        <Worked source="∀x:r(x,y)" caption="Bound and free side by side" />
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tap each variable in the formula to cycle it: bound, then free, then unmarked. Every
                one has to be marked before you can submit.
              </li>
              <li>
                Then the two judgements. They are marked separately, so getting the occurrences right
                and the judgements wrong is most of the marks rather than none.
              </li>
              <li>
                Both come up as yes and as no across a round, and they do not move together.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** One formula with every occurrence tallied by the game's own function. */
function Worked({ source, caption }: { source: string; caption: string }) {
  const formula = parseFormula(source, SIG)
  const spots = occurrences(formula)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <p className="mt-1">
        <FoText formula={formula} className="text-lg font-bold" />
      </p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-1.5 pr-3 whitespace-nowrap">Occurrence</th>
              <th className="py-1.5 pr-3 whitespace-nowrap">At letter</th>
              <th className="py-1.5">Bound or free</th>
            </tr>
          </thead>
          <tbody>
            {spots.map((spot, index) => (
              <tr key={index} className="border-t-2 border-dashed border-card-shade">
                <td className="formula py-1.5 pr-3 font-bold">{spot.name}</td>
                <td className="py-1.5 pr-3 tabular-nums text-ink-soft">{spot.at + 1}</td>
                <td
                  className={`py-1.5 font-bold ${spot.bound ? 'text-space-blue' : 'text-space-red'}`}
                >
                  {spot.bound ? 'bound' : 'free'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-sm font-bold">
        {isClosed(formula) ? 'Closed' : 'Not closed'} ·{' '}
        {isClean(formula) ? 'Clean' : 'Not clean'}
      </p>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        Printed as {showFormula(formula)}; positions count from 1.
      </p>
    </Card>
  )
}
