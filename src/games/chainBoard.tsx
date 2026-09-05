/**
 * Building a chain of equalities.
 *
 * Definition 3.16 gives four closure rules, but as a *procedure* they collapse
 * into one move: find a subterm matching either side of an axiom, and swap it
 * for the other side. Instantiation is the matching; symmetry is the "either
 * side"; the subterm rule is the "find a subterm"; and transitivity is the
 * chain itself.
 *
 * So the board offers exactly that move, and the search is real: the notes'
 * point in §3.3 is that the graph of reachable terms is infinite, and the
 * moves on offer here are what a slice of it looks like.
 */

import { showTerm, type Equation, type Term } from '@/logic'
import { oneStep, type TheoryStep } from '@/logic'
import { Button } from '@/ui/primitives'
import { EquationText, TermText } from '@/ui/TermText'
import { MovingItem, MovingList } from '@/ui/motion'

/** One taken step, stored as an index into the moves offered at the time. */
export type ChainMove = number

export interface ChainState {
  chain: Term[]
  /** Set when a stored move index no longer names a legal move. */
  broken: boolean
}

/**
 * Replay a list of chosen moves.
 *
 * Moves are stored as indices into the offered list, which is deterministic
 * given the term and the axioms — so a replay reconstructs the same chain, and
 * an index that no longer exists is a broken answer rather than a crash.
 */
export function replayChain(
  axioms: readonly Equation[],
  start: Term,
  moves: readonly ChainMove[],
  maxSize: number,
): ChainState {
  const chain: Term[] = [start]
  for (const move of moves) {
    const current = chain[chain.length - 1] as Term
    const options = oneStep(axioms, current, maxSize)
    const next = options[move]
    if (next === undefined) return { chain, broken: true }
    chain.push(next.to)
  }
  return { chain, broken: false }
}

export interface ChainBoardProps {
  axioms: readonly Equation[]
  goal: Equation
  state: ChainState
  maxSize: number
  onMove: (move: ChainMove) => void
  onUndo: () => void
  locked: boolean
}

export function ChainBoard({
  axioms,
  goal,
  state,
  maxSize,
  onMove,
  onUndo,
  locked,
}: ChainBoardProps) {
  const current = state.chain[state.chain.length - 1] as Term
  const options = locked ? [] : oneStep(axioms, current, maxSize)
  const arrived = showTerm(current) === showTerm(goal.right)

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Axioms — E</p>
      <div className="mt-1 flex flex-col gap-1">
        {axioms.map((axiom, index) => (
          <div key={index} className="tile bg-card-shade px-3 py-1.5">
            <EquationText left={axiom.left} right={axiom.right} className="text-base font-bold" />
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
        Your chain — {state.chain.length - 1} step{state.chain.length === 2 ? '' : 's'}
      </p>
      <MovingList className="mt-1 flex flex-col gap-1">
        {state.chain.map((term, index) => (
          <MovingItem
            key={`${index}:${showTerm(term)}`}
            id={`${index}`}
            disabled
            className={`tile flex w-full items-center gap-2 px-3 py-1.5 text-left
              ${index === state.chain.length - 1 ? (arrived ? 'bg-grass text-white' : 'bg-coin') : 'bg-card'}`}
          >
            <span className="w-4 shrink-0 text-[0.6rem] font-bold opacity-60">{index}</span>
            <TermText term={term} className="text-base font-bold" />
          </MovingItem>
        ))}
      </MovingList>

      <div className="tile mt-2 flex flex-wrap items-baseline gap-2 bg-card-shade px-3 py-1.5">
        <span className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
          target
        </span>
        <TermText term={goal.right} className="text-base font-bold" />
      </div>

      {state.broken && (
        <p className="mt-2 rounded-xl bg-space-red px-3 py-1.5 text-xs font-bold text-white">
          That step is no longer available.
        </p>
      )}

      {!locked && !arrived && (
        <>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
            One step from here — {options.length} option{options.length === 1 ? '' : 's'}
          </p>
          <div className="mt-1 flex max-h-72 flex-col gap-1 overflow-y-auto">
            {options.map((option, index) => (
              <button
                key={`${index}:${showTerm(option.to)}`}
                type="button"
                onClick={() => onMove(index)}
                className="tile flex w-full items-center gap-2 bg-card px-3 py-1.5 text-left hover:bg-card-shade
                  focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin"
              >
                <TermText term={option.to} className="text-sm font-bold" />
                <span className="ml-auto shrink-0 text-[0.6rem] font-bold uppercase tracking-wider text-ink-soft">
                  {describe(option)}
                </span>
              </button>
            ))}
            {options.length === 0 && (
              <p className="rounded-xl bg-card-shade px-3 py-2 text-sm font-semibold text-ink-soft">
                Nothing applies here, and nothing bigger is allowed. Undo and try another route.
              </p>
            )}
          </div>
        </>
      )}

      {!locked && state.chain.length > 1 && (
        <Button variant="ghost" className="mt-2 w-full" onClick={onUndo}>
          ← Undo
        </Button>
      )}
    </div>
  )
}

/** Which axiom, and which way round it was used. */
const describe = (step: TheoryStep): string =>
  `${showTerm(step.reversed ? step.axiom.right : step.axiom.left)} → ${showTerm(
    step.reversed ? step.axiom.left : step.axiom.right,
  )}`
