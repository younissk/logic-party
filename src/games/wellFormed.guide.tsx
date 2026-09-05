/**
 * What is and is not a formula.
 *
 * Every verdict in the table comes from the parsers the game marks with, so a
 * string that this page calls malformed is one the game refuses too.
 */

import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { FoText } from '@/ui/FoText'
import { wellnessOf, type WellFormedQuestion } from './wellFormed'

const WEEKDAYS: WellFormedQuestion = {
  predicates: { weekend: 1, before: 2 },
  functions: { monday: 0, next: 1 },
  variables: ['x', 'y'],
  candidates: [],
}

const SHAPES: WellFormedQuestion = {
  predicates: { triangle: 1, circle: 1, contained: 2 },
  functions: { rotate: 1 },
  variables: ['x', 'y', 'z'],
  candidates: [],
}

export function WellFormedGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="What a signature fixes">
        <Card>
          <Prose>
            <p>
              A first-order signature is five things: predicate symbols with their arities, function
              symbols with theirs, and the variables. Definition 4.1 requires the three sets to be{' '}
              <strong>disjoint</strong> — a symbol is a predicate or a function or a variable, never
              two of them.
            </p>
            <p>Formulas are then built by exactly three rules, and nothing else counts.</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>
                A predicate symbol of arity n applied to n <em>terms</em> is a formula — an{' '}
                <strong>atom</strong>.
              </li>
              <li>Formulas combined with ¬, ∧, ∨, →, ↔ are formulas.</li>
              <li>
                <Sym>∀x:φ</Sym> and <Sym>∃x:φ</Sym> are formulas.
              </li>
            </ul>
          </Prose>
        </Card>

        <Callout tone="tip" title="The head symbol decides">
          <p>
            Look at the outermost symbol. A <strong>predicate</strong> there makes a formula; a{' '}
            <strong>function symbol</strong> makes a term. Terms are not formulas: there is nothing
            in <Sym>next(monday())</Sym> that can be true or false, so it cannot be asserted.
          </p>
        </Callout>

        <Callout tone="warn" title="A predicate may not appear inside a term">
          <p>
            <Sym>triangle(triangle(x))</Sym> is malformed. The outer triangle wants a term, and the
            inner one is a formula. The notes give this exact string as a non-example.
          </p>
        </Callout>

        <Callout tone="warn" title="Arity is part of the symbol">
          <p>
            <Sym>triangle(x,y)</Sym> is malformed too, for a duller reason: triangle takes one
            argument. Every symbol must appear at exactly its declared arity, everywhere.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The notes' own examples, decided">
        <Table
          question={WEEKDAYS}
          caption="Example 4.2 part 1 — weekend/1, before/2, monday/0, next/1"
          candidates={[
            '¬∀x:weekend(x)',
            '∀x:(weekend(x)→∃y:before(y,x))',
            '∀x:before(monday(),x)',
            'next(monday())',
            'weekend(weekend(x))',
            'before(x)',
          ]}
        />
        <Table
          question={SHAPES}
          caption="Example 4.2 part 2 — triangle/1, circle/1, contained/2, rotate/1"
          candidates={[
            '∀x:(triangle(x)→triangle(rotate(x)))',
            '∃x:∀y:contained(x,y)',
            'triangle(x)∨∃x:triangle(x)',
            'triangle(triangle(x))',
            'triangle(x,y)',
            'rotate(x)',
          ]}
        />
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Three bins, and every question fills all three, so no bin is safe to leave empty.
              </li>
              <li>
                The middle bin is where the marks are. A well-formed term is not a mistake — it is
                simply not a formula.
              </li>
              <li>
                The signature is printed above the board and changes with the question. Read it: the
                same string can be a formula under one signature and malformed under another.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

/** Each candidate decided by `wellnessOf`. */
function Table({
  question,
  caption,
  candidates,
}: {
  question: WellFormedQuestion
  caption: string
  candidates: string[]
}) {
  const LABEL = { formula: 'a formula', term: 'a term', neither: 'malformed' } as const
  const TONE = {
    formula: 'text-grass-deep',
    term: 'text-space-blue',
    neither: 'text-space-red',
  } as const

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-3 border-ink">
              <th className="py-2 pr-3 whitespace-nowrap">String</th>
              <th className="py-2">What it is</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((source) => {
              const verdict = wellnessOf(question, source)
              return (
                <tr key={source} className="border-t-2 border-dashed border-card-shade align-top">
                  <td className="py-2 pr-3">
                    <FoText text={source} className="font-bold" />
                  </td>
                  <td className={`py-2 font-bold ${TONE[verdict]}`}>{LABEL[verdict]}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
