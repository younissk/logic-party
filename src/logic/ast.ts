/**
 * Propositional formula AST.
 *
 * Deliberately tiny and immutable: every minigame in the app generates,
 * transforms and checks these, so the shape must stay boring and stable.
 */

export type BinaryKind = 'and' | 'or' | 'implies' | 'iff'

export type Formula =
  | { readonly kind: 'var'; readonly name: string }
  | { readonly kind: 'const'; readonly value: boolean }
  | { readonly kind: 'not'; readonly arg: Formula }
  | { readonly kind: BinaryKind; readonly left: Formula; readonly right: Formula }

export type BinaryFormula = Extract<Formula, { kind: BinaryKind }>

export const TRUE: Formula = { kind: 'const', value: true }
export const FALSE: Formula = { kind: 'const', value: false }

export const v = (name: string): Formula => ({ kind: 'var', name })
export const not = (arg: Formula): Formula => ({ kind: 'not', arg })
export const and = (left: Formula, right: Formula): Formula => ({ kind: 'and', left, right })
export const or = (left: Formula, right: Formula): Formula => ({ kind: 'or', left, right })
export const implies = (left: Formula, right: Formula): Formula => ({ kind: 'implies', left, right })
export const iff = (left: Formula, right: Formula): Formula => ({ kind: 'iff', left, right })

export function isBinary(f: Formula): f is BinaryFormula {
  return f.kind === 'and' || f.kind === 'or' || f.kind === 'implies' || f.kind === 'iff'
}

/** Left-associated fold; empty list yields the operator's identity. */
export function andAll(parts: readonly Formula[]): Formula {
  if (parts.length === 0) return TRUE
  return parts.reduce((acc, p) => and(acc, p))
}

export function orAll(parts: readonly Formula[]): Formula {
  if (parts.length === 0) return FALSE
  return parts.reduce((acc, p) => or(acc, p))
}

/** Variable names in first-appearance order, de-duplicated. */
export function variables(f: Formula): string[] {
  const seen: string[] = []
  const walk = (g: Formula): void => {
    switch (g.kind) {
      case 'var':
        if (!seen.includes(g.name)) seen.push(g.name)
        return
      case 'const':
        return
      case 'not':
        walk(g.arg)
        return
      default:
        walk(g.left)
        walk(g.right)
    }
  }
  walk(f)
  return seen
}

/** Variable names sorted alphabetically — the order truth tables are shown in. */
export function sortedVariables(f: Formula): string[] {
  return variables(f).sort((a, b) => a.localeCompare(b))
}

/** Number of nodes. Used as a difficulty proxy and a blow-up guard. */
export function size(f: Formula): number {
  switch (f.kind) {
    case 'var':
    case 'const':
      return 1
    case 'not':
      return 1 + size(f.arg)
    default:
      return 1 + size(f.left) + size(f.right)
  }
}

/** Longest root-to-leaf path. */
export function depth(f: Formula): number {
  switch (f.kind) {
    case 'var':
    case 'const':
      return 1
    case 'not':
      return 1 + depth(f.arg)
    default:
      return 1 + Math.max(depth(f.left), depth(f.right))
  }
}

/** Structural equality. Not logical equivalence — see semantics.isEquivalent. */
export function equals(a: Formula, b: Formula): boolean {
  if (a.kind !== b.kind) return false
  switch (a.kind) {
    case 'var':
      return a.name === (b as typeof a).name
    case 'const':
      return a.value === (b as typeof a).value
    case 'not':
      return equals(a.arg, (b as typeof a).arg)
    default: {
      const rhs = b as BinaryFormula
      return equals(a.left, rhs.left) && equals(a.right, rhs.right)
    }
  }
}

/** Every subformula, root first, de-duplicated structurally. */
export function subformulas(f: Formula): Formula[] {
  const out: Formula[] = []
  const push = (g: Formula) => {
    if (!out.some((h) => equals(g, h))) out.push(g)
  }
  const walk = (g: Formula): void => {
    push(g)
    switch (g.kind) {
      case 'var':
      case 'const':
        return
      case 'not':
        walk(g.arg)
        return
      default:
        walk(g.left)
        walk(g.right)
    }
  }
  walk(f)
  return out
}

/** Stable structural key — safe as a React key or Map key. */
export function key(f: Formula): string {
  switch (f.kind) {
    case 'var':
      return `v:${f.name}`
    case 'const':
      return f.value ? '#T' : '#F'
    case 'not':
      return `~(${key(f.arg)})`
    default:
      return `${f.kind}(${key(f.left)},${key(f.right)})`
  }
}
