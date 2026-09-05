/**
 * Driving Algorithms 3.8 and 3.13 by hand.
 *
 * Both algorithms are the same walk: compare the two terms left to right, and
 * at the first mismatch do the one thing the rules allow. Matching may only
 * move the left term's variables; unification may move either side's, and has
 * two ways to give up rather than one.
 *
 * So the mechanics live here once and the two games differ by a mode flag.
 * What the player supplies is the sequence of decisions — the bindings are
 * forced once you have found the mismatch, which is exactly the point: the
 * algorithm has no choices in it, only steps you can get wrong by taking them
 * in the wrong place.
 */

import {
  applySubstitution,
  compose,
  isVar,
  occurs,
  showTerm,
  termsEqual,
  termVariables,
  type Position,
  type Substitution,
  type Term,
} from '@/logic'

export type DriverMode = 'match' | 'unify'

/** The first place the two terms disagree, in the order the letters are read. */
export function firstMismatch(
  left: Term,
  right: Term,
  path: number[] = [],
): { position: Position; left: Term; right: Term } | null {
  if (termsEqual(left, right)) return null
  if (isVar(left) || isVar(right)) return { position: path, left, right }
  if (left.name !== right.name || left.args.length !== right.args.length) {
    return { position: path, left, right }
  }
  for (let index = 0; index < left.args.length; index++) {
    const found = firstMismatch(left.args[index] as Term, right.args[index] as Term, [
      ...path,
      index,
    ])
    if (found !== null) return found
  }
  return null
}

/** One decision. Only the side is stored — what it binds is forced by the state. */
export type Move =
  | { kind: 'bind'; side: 'left' | 'right' }
  | { kind: 'clash' }
  | { kind: 'occurs' }

export interface DriverState {
  left: Term
  right: Term
  sigma: Substitution
  /** Set once the run has ended. */
  outcome: 'running' | 'unified' | 'clash' | 'occurs'
  /** Set when a move was refused, naming which. */
  illegal: Move | null
  /**
   * Variables matching is allowed to instantiate — the pattern's own.
   *
   * Algorithm 3.8 assumes the two terms share no variables, and Example 3.9.3
   * shows what goes wrong otherwise: after binding x to u, the pattern
   * *contains* u, and binding u next would silently change what x stands for.
   * Fixing the movable set at the start is that assumption, enforced.
   */
  movable: readonly string[]
}

export const startState = (left: Term, right: Term): DriverState => ({
  left,
  right,
  sigma: {},
  outcome: termsEqual(left, right) ? 'unified' : 'running',
  illegal: null,
  movable: termVariables(left),
})

/** What the rules allow right now, in the order the buttons should appear. */
export function legalMoves(mode: DriverMode, state: DriverState): Move[] {
  if (state.outcome !== 'running') return []
  const at = firstMismatch(state.left, state.right)
  if (at === null) return []

  const moves: Move[] = []
  const leftIsVar = isVar(at.left)
  const rightIsVar = isVar(at.right)

  if (!leftIsVar && !rightIsVar) return [{ kind: 'clash' }]

  // Matching only ever instantiates the pattern, so a variable on the right is
  // no help at all — that asymmetry is the whole difference between the two
  // algorithms, and Example 3.9.2 is where it bites.
  const leftMovable = leftIsVar && (mode === 'unify' || state.movable.includes(at.left.name))
  if (leftMovable) {
    moves.push(
      occurs((at.left as { name: string }).name, at.right)
        ? { kind: 'occurs' }
        : { kind: 'bind', side: 'left' },
    )
  }
  if (mode === 'unify' && rightIsVar && !leftIsVar) {
    moves.push(occurs((at.right as { name: string }).name, at.left) ? { kind: 'occurs' } : { kind: 'bind', side: 'right' })
  }
  // In matching, a mismatch the pattern cannot move is the end — whether that
  // is a function symbol or a variable the target put there.
  if (mode === 'match' && !leftMovable) moves.push({ kind: 'clash' })
  return moves
}

const sameMove = (a: Move, b: Move): boolean =>
  a.kind === b.kind && (a.kind !== 'bind' || b.kind !== 'bind' || a.side === b.side)

/** Take one step, or refuse it. A refused move ends the run. */
export function step(mode: DriverMode, state: DriverState, move: Move): DriverState {
  if (state.outcome !== 'running') return state
  const allowed = legalMoves(mode, state)
  if (!allowed.some((candidate) => sameMove(candidate, move))) {
    return { ...state, illegal: move }
  }

  if (move.kind === 'clash') return { ...state, outcome: 'clash' }
  if (move.kind === 'occurs') return { ...state, outcome: 'occurs' }

  const at = firstMismatch(state.left, state.right)
  if (at === null) return state
  const source = move.side === 'left' ? at.left : at.right
  const target = move.side === 'left' ? at.right : at.left
  if (!isVar(source)) return { ...state, illegal: move }

  const binding: Substitution = { [source.name]: target }
  const left = applySubstitution(binding, state.left)
  // Matching instantiates only the pattern; unification moves both.
  const right = mode === 'unify' ? applySubstitution(binding, state.right) : state.right
  return {
    left,
    right,
    sigma: compose(binding, state.sigma),
    outcome: termsEqual(left, right) ? 'unified' : 'running',
    illegal: null,
    movable: state.movable,
  }
}

/** Replay a whole sequence from the start. */
export function replay(
  mode: DriverMode,
  left: Term,
  right: Term,
  moves: readonly Move[],
): DriverState {
  let state = startState(left, right)
  for (const move of moves) {
    state = step(mode, state, move)
    if (state.illegal !== null) break
  }
  return state
}

export const describeMove = (mode: DriverMode, state: DriverState, move: Move): string => {
  if (move.kind === 'clash') {
    const at = firstMismatch(state.left, state.right)
    if (at === null) return 'No unifier — the symbols clash'
    if (mode === 'match') {
      return isVar(at.left)
        ? `Stop — ${at.left.name} belongs to the target, not the pattern`
        : `Stop — ${at.left.name} is a function symbol, nothing can move it`
    }
    return `Stop — ${at.left.name} and ${at.right.name} clash`
  }
  if (move.kind === 'occurs') return 'Stop — occurs check'

  const at = firstMismatch(state.left, state.right)
  if (at === null) return 'Bind'
  const source = move.side === 'left' ? at.left : at.right
  const target = move.side === 'left' ? at.right : at.left
  return `${isVar(source) ? source.name : '?'} ↦ ${showTerm(target)}`
}
