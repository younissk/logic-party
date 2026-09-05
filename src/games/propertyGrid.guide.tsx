/** Quantifier elimination, decidability, and the gap between them. */

import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'
import { COLUMN_LABELS, COLUMNS, THEORY_ROWS } from './propertyGrid'

export function PropertyGridGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Definition 5.4, and what follows from it">
        <Card>
          <Prose>
            <p>
              A theory <strong>admits quantifier elimination</strong> when every formula has an
              equivalent quantifier-free one in that theory. It is a property of the theory
              together with its <em>signature</em>: the same theory can admit QE in a richer
              language and not in a poorer one, which is exactly what happens to Presburger
              arithmetic.
            </p>
            <p>
              QE plus a decidable quantifier-free fragment gives decidability. Every theory in this
              chapter has such a fragment — polynomial comparisons over ℝ, order atoms in a dense
              order, ground atoms over a finite universe — so in practice{' '}
              <strong>QE ⟹ decidable</strong> here. Nothing runs the other way.
            </p>
          </Prose>
        </Card>

        <Callout tone="warn" title="Presburger arithmetic is the row that matters">
          <p>
            <Sym>T(N,=,+)</Sym> is decidable, by the automaton construction, and does not admit QE
            in the signature <Sym>{'{=,+}'}</Sym>. Any claim of the form "decidable, therefore
            eliminable" dies here.
          </p>
        </Callout>

        <Callout tone="tip" title="An inconsistent theory admits QE">
          <p>
            It contains every formula, so <Sym>⊤</Sym> is an equivalent of anything at all.
            exam26a asks this and the answer is yes — a technicality that follows straight from the
            definition rather than from anything about elimination.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The whole grid">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-2 py-1">theory</th>
                  {COLUMNS.map((column) => (
                    <th key={column} className="px-2 py-1">
                      {COLUMN_LABELS[column]}
                    </th>
                  ))}
                  <th className="px-2 py-1">why</th>
                </tr>
              </thead>
              <tbody>
                {THEORY_ROWS.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-2 py-1 font-logic font-bold">{row.name}</td>
                    <td className="px-2 py-1 font-bold">{row.qe ? 'yes' : 'no'}</td>
                    <td className="px-2 py-1 font-bold">{row.decidable ? 'yes' : 'no'}</td>
                    <td className="px-2 py-1 text-ink-soft">{row.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Callout tone="warn" title="Neither column is about completeness">
          <p>
            <Sym>T(N,=,+,*)</Sym> is complete and neither decidable nor eliminable. The theory of
            any single structure is complete. Completeness is a third question, and mixing it in is
            how the exam's true/false lines catch people out.
          </p>
        </Callout>
      </GuideSection>
    </div>
  )
}
