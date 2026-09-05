/**
 * How to encode graph colouring into CNF.
 *
 * Every clause count on this page comes from `colouringClauses` — the same
 * encoder the game marks with — so the numbers are counted, not claimed.
 */

import { colouringClauses, findOddCycle, isColourable, showClause, type Graph } from '@/logic'
import { Callout, GuideSection, Prose, Sym } from '@/ui/guide'
import { Card } from '@/ui/primitives'

const EXERCISE: Graph = {
  vertices: ['a', 'b', 'c', 'd'],
  edges: [
    ['a', 'b'],
    ['b', 'c'],
    ['c', 'd'],
    ['d', 'a'],
    ['a', 'c'],
  ],
}

export function ColouringGuide() {
  return (
    <div className="flex flex-col gap-7">
      <GuideSection title="Why this exercise exists">
        <Card>
          <Prose>
            <p>
              This is the first time propositional logic stops being about{' '}
              <Sym>p</Sym> and <Sym>q</Sym> and becomes a way of saying something. Graph colouring
              is a real problem, the encoding is three lines, and once it is CNF a solver answers it
              for you.
            </p>
            <p>
              Every SAT application works this way: the hard part is never the solving, it is
              deciding what the variables mean.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The variables">
        <Card>
          <Prose>
            <p>
              One variable per <strong>vertex and colour</strong>. Write{' '}
              <Sym>a1</Sym> for "vertex a has colour 1". With 4 vertices and 3 colours that is 12
              variables.
            </p>
            <p>
              This is the choice that makes the rest easy. A variable per vertex would not have room
              to say <em>which</em> colour; a variable per edge could not say anything about
              vertices at all.
            </p>
          </Prose>
        </Card>
      </GuideSection>

      <GuideSection title="The three families of clause">
        <Card>
          <Prose>
            <p>Every constraint is one of these, and there are no others.</p>
          </Prose>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-3 border-ink">
                  <th className="py-2 pr-3">Says</th>
                  <th className="py-2 pr-3">Shape</th>
                  <th className="py-2">How many</th>
                </tr>
              </thead>
              <tbody>
                <Family
                  says="Each vertex gets a colour"
                  shape="(a1 ∨ a2 ∨ a3)"
                  count="one per vertex"
                />
                <Family
                  says="…and only one"
                  shape="(¬a1 ∨ ¬a2)"
                  count="one per vertex per pair of colours"
                />
                <Family
                  says="Adjacent vertices differ"
                  shape="(¬a1 ∨ ¬b1)"
                  count="one per edge per colour"
                />
              </tbody>
            </table>
          </div>
          <Prose>
            <p className="mt-3">
              The third family is the interesting one. It never says which colour anything gets —
              only that the two ends of an edge cannot share one, once per colour.
            </p>
          </Prose>
        </Card>

        <Callout tone="tip" title="You can usually drop the middle family">
          <p>
            "At most one colour" is not needed to decide <em>whether</em> a colouring exists: if a
            model gives a vertex two colours, picking either one still works. It is needed when you
            want to read a clean colouring straight out of the model, which is usually what you
            want.
          </p>
        </Callout>
      </GuideSection>

      <GuideSection title="The exam question">
        <Counted graph={EXERCISE} colours={2} caption="Exercise 1 Q4, with two colours" />
        <Counted graph={EXERCISE} colours={3} caption="The same graph, with three" />
        <Prose>
          <p>
            Two colours: <strong>unsatisfiable</strong>, so the graph cannot be 2-coloured. Three:
            satisfiable.
          </p>
          <p>
            The reason is <Sym>a–b–c–a</Sym>, a cycle of length three. Go round an odd cycle
            alternating two colours and you arrive back where you started needing the colour you
            just used. <strong>A graph is 2-colourable exactly when it has no odd cycle.</strong>
          </p>
        </Prose>
      </GuideSection>

      <GuideSection title="Playing it">
        <Card>
          <Prose>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Tap a vertex to cycle its colour, and again past the last one to clear it.
              </li>
              <li>
                An edge whose ends match turns red and pulses — that edge's clause is currently
                false.
              </li>
              <li>
                The bar counts how many of the encoding's clauses hold. It is full exactly when the
                colouring is proper.
              </li>
              <li>
                Some graphs cannot be coloured, and <strong>Impossible</strong> is the right answer
                there — that is the case where the CNF is unsatisfiable. Look for an odd cycle
                before you give up, and look for one before you keep trying.
              </li>
            </ul>
          </Prose>
        </Card>
      </GuideSection>
    </div>
  )
}

function Family({ says, shape, count }: { says: string; shape: string; count: string }) {
  return (
    <tr className="border-t-2 border-dashed border-card-shade align-top">
      <td className="py-2 pr-3 font-bold">{says}</td>
      <td className="formula py-2 pr-3 font-bold">{shape}</td>
      <td className="py-2 text-ink-soft">{count}</td>
    </tr>
  )
}

/** The encoding for one graph, counted live. */
function Counted({ graph, colours, caption }: { graph: Graph; colours: number; caption: string }) {
  const encoding = colouringClauses(graph, colours)
  const colourable = isColourable(graph, colours)
  const cycle = findOddCycle(graph)

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{caption}</p>
      <p className="mt-1 text-sm font-medium">
        {graph.vertices.length} vertices, {graph.edges.length} edges,{' '}
        {graph.vertices.length * colours} variables
      </p>
      <p className="mt-1 text-sm font-medium">
        <strong>{encoding.atLeastOne.length}</strong> + <strong>{encoding.atMostOne.length}</strong>{' '}
        + <strong>{encoding.edgeClauses.length}</strong> ={' '}
        <strong>{encoding.all.length} clauses</strong>
      </p>
      <p className="formula mt-2 text-xs text-ink-soft">
        e.g. {encoding.atLeastOne.slice(0, 1).map(showClause).join('')}{' '}
        {encoding.edgeClauses.slice(0, 2).map(showClause).join(' ')}
      </p>
      <p className={`mt-2 text-base font-bold ${colourable ? 'text-grass-deep' : 'text-space-red'}`}>
        {colourable ? 'Satisfiable — a colouring exists' : 'Unsatisfiable — no colouring exists'}
        {!colourable && cycle !== null && ` (odd cycle ${cycle.join('–')})`}
      </p>
    </Card>
  )
}
