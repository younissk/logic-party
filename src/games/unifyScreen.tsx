/**
 * The shared board for the two algorithm-driving games.
 *
 * Both terms are shown with the first mismatch marked, and the only buttons
 * offered are the moves the rules allow at that point. A move the rules refuse
 * is not on the board at all — which turns "why can't I bind here?" from a
 * mark lost into a button that is not there.
 */

import type { ReactNode } from 'react'
import { showTerm, type Substitution, type Term } from '@/logic'
import { Button, Card } from '@/ui/primitives'
import { SubstitutionText, TermText } from '@/ui/TermText'
import { Pop } from '@/ui/motion'
import {
  describeMove,
  firstMismatch,
  legalMoves,
  type DriverMode,
  type DriverState,
  type Move,
} from './unifyDriver'

/** The letters of the term, with the mismatch position picked out. */
function MarkedTerm({ term, mark }: { term: Term; mark: Term | null }) {
  const source = showTerm(term)
  if (mark === null) return <TermText text={source} className="text-base font-bold" />

  const needle = showTerm(mark)
  const at = source.indexOf(needle)
  if (at === -1) return <TermText text={source} className="text-base font-bold" />

  return (
    <span className="formula text-base font-bold">
      <TermText text={source.slice(0, at)} />
      <span className="rounded-md bg-space-red px-0.5 text-white">
        <TermText text={needle} />
      </span>
      <TermText text={source.slice(at + needle.length)} />
    </span>
  )
}

export interface UnifyBoardProps {
  mode: DriverMode
  state: DriverState
  onMove: (move: Move) => void
  locked: boolean
  /** The heading, which differs between the two games. */
  title: string
  /** Extra buttons under the moves — a "submit" or a "give up". */
  footer?: ReactNode
  /** Shown after the round, in the caller's own words. */
  reveal?: ReactNode
}

export function UnifyBoard({
  mode,
  state,
  onMove,
  locked,
  title,
  footer,
  reveal,
}: UnifyBoardProps) {
  const at = firstMismatch(state.left, state.right)
  const moves = locked ? [] : legalMoves(mode, state)

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">{title}</p>

      <div className="tile mt-2 flex flex-col gap-1.5 bg-card-shade px-3 py-2">
        <Row label={mode === 'match' ? 'pattern' : 't₁'}>
          <MarkedTerm term={state.left} mark={at === null ? null : at.left} />
        </Row>
        <Row label={mode === 'match' ? 'target' : 't₂'}>
          <MarkedTerm term={state.right} mark={at === null ? null : at.right} />
        </Row>
      </div>

      <p className="mt-1 text-xs font-medium text-ink-soft">
        {state.outcome !== 'running'
          ? OUTCOME_BLURB[state.outcome]
          : at === null
            ? 'They already agree.'
            : 'First mismatch marked. Only the legal moves are offered.'}
      </p>

      {Object.keys(state.sigma).length > 0 && (
        <p className="mt-2 flex flex-wrap items-baseline gap-2 text-sm font-bold">
          <span className="text-xs uppercase tracking-wider text-ink-soft">so far</span>
          <SubstitutionText sigma={state.sigma} />
        </p>
      )}

      {moves.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {moves.map((move, index) => (
            <Button
              key={index}
              variant={move.kind === 'bind' ? 'primary' : 'danger'}
              className="w-full"
              onClick={() => onMove(move)}
            >
              <span className="formula">{describeMove(mode, state, move)}</span>
            </Button>
          ))}
        </div>
      )}

      {footer}

      {locked && reveal !== undefined && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3">{reveal}</Pop>
      )}
    </Card>
  )
}

const OUTCOME_BLURB: Record<Exclude<DriverState['outcome'], 'running'>, string> = {
  unified: 'The two terms are now the same. That is the end of the algorithm.',
  clash: 'Stopped at a clash of function symbols.',
  occurs: 'Stopped at the occurs check.',
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="flex flex-wrap items-baseline gap-2">
      <span className="w-12 shrink-0 text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
        {label}
      </span>
      {children}
    </p>
  )
}

/** The substitution, or the reason there is none — used by both games' reveals. */
export function OutcomeLine({
  outcome,
  sigma,
}: {
  outcome: DriverState['outcome']
  sigma: Substitution
}) {
  if (outcome === 'unified') return <SubstitutionText sigma={sigma} className="text-base font-bold" />
  if (outcome === 'clash') {
    return <p className="text-base font-bold">No solution — two function symbols clash.</p>
  }
  if (outcome === 'occurs') {
    return <p className="text-base font-bold">No unifier — the occurs check fires.</p>
  }
  return <p className="text-base font-bold">The algorithm has not finished.</p>
}
