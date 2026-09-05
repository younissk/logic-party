/**
 * A DPLL decision tree, drawn the way Figure 2.4 draws it.
 *
 * Circles are decisions, boxes are propagations, dashed edges set the variable
 * false and solid ones set it true. Laid out vertically rather than as a wide
 * graph, because a phone is tall and the branch structure survives indentation
 * perfectly well.
 */

import type { ReactNode } from 'react'

import type { Clause, DpllNode } from '@/logic'
import { ClauseText } from './ClauseText'
import { VariableName } from './FormulaText'

export function DecisionTree({
  node,
  highlight,
  showClauses = true,
}: {
  node: DpllNode
  /** Index of a leaf to pick out, in left-to-right order. */
  highlight?: number
  showClauses?: boolean
}) {
  let leafIndex = 0
  const next = () => leafIndex++

  const render = (current: DpllNode, edge: string | null, depth: number): ReactNode => {
    const propagated = current.propagated.map((entry) => entry.literal)

    const body = (
      <>
        {edge !== null && (
          <p className="text-xs font-bold text-ink-soft">
            {edge}
          </p>
        )}

        {propagated.length > 0 && (
          <p className="mt-0.5 flex flex-wrap items-center gap-1">
            {propagated.map((literal) => (
              <span
                key={literal.name}
                className="formula rounded-md border-2 border-ink bg-white px-1.5 text-xs font-bold"
                title="forced by BCP"
              >
                {literal.name} = {literal.negated ? 'F' : 'T'}
              </span>
            ))}
          </p>
        )}

        {current.kind === 'branch' ? (
          <p className="mt-1 flex items-center gap-1.5">
            <span className="space inline-flex h-7 w-7 items-center justify-center bg-coin text-sm font-bold">
              <VariableName name={current.variable} />
            </span>
            <span className="text-xs font-semibold text-ink-soft">decision</span>
          </p>
        ) : (
          <Leaf node={current} index={next()} highlight={highlight} showClauses={showClauses} />
        )}
      </>
    )

    return (
      <div
        className={depth === 0 ? '' : 'ml-3 border-l-3 border-dashed border-ink-soft/50 pl-3'}
        key={`${depth}-${edge ?? 'root'}`}
      >
        {body}
        {current.kind === 'branch' && (
          <div className="mt-1 flex flex-col gap-1">
            {render(current.whenFalse, `${current.variable} = F`, depth + 1)}
            {render(current.whenTrue, `${current.variable} = T`, depth + 1)}
          </div>
        )}
      </div>
    )
  }

  return <div className="text-sm">{render(node, null, 0)}</div>
}

function Leaf({
  node,
  index,
  highlight,
  showClauses,
}: {
  node: DpllNode & { kind: 'conflict' | 'model' }
  index: number
  highlight?: number
  showClauses: boolean
}) {
  const picked = highlight === index
  const conflict = node.kind === 'conflict' ? (node.conflict as Clause | null) : null

  return (
    <div
      className={`mt-1 inline-flex flex-wrap items-center gap-2 rounded-xl px-2 py-1
        ${picked ? 'bg-coin ring-3 ring-ink' : node.kind === 'conflict' ? 'bg-space-red/15' : 'bg-grass/20'}`}
    >
      <span className="formula text-base font-bold">{node.kind === 'conflict' ? '⊥' : '✓'}</span>
      {picked && <span className="text-xs font-bold uppercase tracking-wider">this leaf</span>}
      {showClauses && conflict !== null && !picked && (
        <ClauseText clause={conflict} className="text-xs font-bold" />
      )}
    </div>
  )
}
