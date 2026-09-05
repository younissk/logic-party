/**
 * Quantifier elimination for unbounded dense linear orders — ln.pdf §5.2,
 * Theorem 5.6, exam25a Q4.2, exam26bA Q4.2, Exercise 10 question 4.
 *
 * This drills the step the whole procedure rests on. Once ∀ has been turned
 * into ¬∃¬, the negations removed by linearity and the body put in DNF, what
 * is left is
 *
 *   ∃x: y₁<x ∧ … ∧ yₙ<x ∧ x<z₁ ∧ … ∧ x<zₘ  (∧ whatever does not mention x)
 *
 * and three axioms settle it. Unboundedness: if either side is empty there is
 * always room for x, so it is ⊤. Density: otherwise an x fits exactly when
 * every lower bound is below every upper bound — the cross product yᵢ<zⱼ.
 * Irreflexivity: if a variable is on both sides, nothing fits, so ⊥.
 *
 * Every question here is marked by `eliminateConjunction`, which the module's
 * own tests check against truth in ℚ. The exercise is choosing the atoms; the
 * bank offers both directions of every pair, so the cross product has to be
 * built rather than recognised.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  eliminateConjunction,
  parseDlo,
  showDlo,
  type FoFormula,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { MovingItem, MovingList, Pop } from '@/ui/motion'
import { QeDenseGuide } from './qeDense.guide'

export interface QeDenseQuestion {
  /** The bound variable being eliminated. */
  variable: string
  /** The conjuncts, printed in the notes' infix style: `y<x`, `x=z`. */
  conjuncts: string[]
  /** Every atom over the other variables, both directions, shuffled. */
  bank: string[]
}

export interface QeDenseAnswer {
  /** 'atoms' means the conjunction of `atoms`. */
  verdict: 'atoms' | 'true' | 'false'
  atoms: string[]
}

/** `y<x` as the parser wants it. The game never shows this form. */
const toSource = (text: string): string => {
  const relation = text.includes('<') ? '<' : '='
  const [left, right] = text.split(relation) as [string, string]
  return `${relation}(${left},${right})`
}

export const parseConjunct = (text: string): FoFormula => parseDlo(toSource(text))

/** Split a conjunction into its atoms, printed. */
export function conjunctsOf(formula: FoFormula): string[] {
  if (formula.kind === 'binary' && formula.connective === 'and') {
    return [...conjunctsOf(formula.left), ...conjunctsOf(formula.right)]
  }
  return [showDlo(formula)]
}

/** What the elimination gives, as an answer. */
export function reference(question: QeDenseQuestion): QeDenseAnswer {
  const result = eliminateConjunction(question.variable, question.conjuncts.map(parseConjunct))
  if (result.kind === 'true') return { verdict: 'true', atoms: [] }
  if (result.kind === 'false') return { verdict: 'false', atoms: [] }
  return { verdict: 'atoms', atoms: conjunctsOf(result) }
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const NAMES = ['u', 'v', 'w', 'y', 'z'] as const

interface Profile {
  /** How many variables besides the one being eliminated. */
  others: [number, number]
  lower: [number, number]
  upper: [number, number]
  /** Chance of a conjunct that does not mention the bound variable. */
  free: number
  /** Chance of an equation involving the bound variable. */
  equation: number
  /** Chance of forcing a contradiction — the same variable on both sides. */
  clash: number
}

const PROFILES: Record<Difficulty, Profile> = {
  // Easy leans on the two axioms one at a time: one bound each side (density),
  // or an empty side (unboundedness).
  easy: { others: [2, 2], lower: [0, 1], upper: [0, 2], free: 0, equation: 0, clash: 0.15 },
  medium: { others: [3, 3], lower: [1, 2], upper: [1, 2], free: 0.35, equation: 0.15, clash: 0.15 },
  hard: { others: [3, 4], lower: [1, 3], upper: [1, 2], free: 0.5, equation: 0.3, clash: 0.2 },
}

function generate({ rng, difficulty }: GenerateContext): QeDenseQuestion {
  const profile = PROFILES[difficulty]
  const variable = 'x'

  for (let attempt = 0; attempt < 60; attempt++) {
    const others = rng.sample([...NAMES], rng.range(...profile.others))
    if (others.length < 2) continue

    const conjuncts: string[] = []

    if (rng.bool(profile.equation)) {
      // An equation pins x down, and everything else about x follows from it.
      const [pinned, other] = rng.sample(others, 2) as [string, string]
      conjuncts.push(rng.bool() ? `${variable}=${pinned}` : `${pinned}=${variable}`)
      conjuncts.push(rng.bool() ? `${variable}<${other}` : `${other}<${variable}`)
    } else {
      const clash = rng.bool(profile.clash)
      const lower = rng.sample(others, rng.range(...profile.lower))
      const rest = clash ? others : others.filter((name) => !lower.includes(name))
      const upper = rng.sample(rest, rng.range(...profile.upper))
      if (lower.length === 0 && upper.length === 0) continue
      for (const name of lower) conjuncts.push(`${name}<${variable}`)
      for (const name of upper) conjuncts.push(`${variable}<${name}`)
    }

    if (rng.bool(profile.free)) {
      const [left, right] = rng.sample(others, 2) as [string, string]
      conjuncts.push(`${left}<${right}`)
    }

    // Every atom over the other variables — both directions, so the cross
    // product has to be got right rather than recognised.
    const bank: string[] = []
    for (const left of others) {
      for (const right of others) {
        if (left !== right) bank.push(`${left}<${right}`)
      }
    }

    const question: QeDenseQuestion = {
      variable,
      conjuncts: rng.shuffle(conjuncts),
      bank: rng.shuffle(bank),
    }
    const answer = reference(question)
    // Every atom of the answer has to be pickable, or the question is unfair.
    if (answer.atoms.some((atom) => !bank.includes(atom))) continue
    // A bank of more than a dozen is a search, not a question.
    if (bank.length > 12) continue
    return question
  }

  // Last resort: the textbook shape, which always generates and always has an
  // answer — one bound on each side, so density decides it.
  const bank = ['y<z', 'z<y']
  return { variable: 'x', conjuncts: ['y<x', 'x<z'], bank }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: QeDenseQuestion): QeDenseAnswer => reference(question)

function check(question: QeDenseQuestion, answer: QeDenseAnswer): Verdict {
  const wanted = reference(question)

  if (answer.verdict !== wanted.verdict) {
    return {
      correct: false,
      // Naming the right verdict would answer the question outright.
      message: 'That is not what the three axioms give',
      score: 0,
      detail:
        'Either side empty means ⊤, by unboundedness. A variable on both sides means ⊥, by irreflexivity. Otherwise it is the cross product, by density.',
    }
  }

  if (wanted.verdict !== 'atoms') {
    return {
      correct: true,
      message: wanted.verdict === 'true' ? '⊤ — nothing constrains x' : '⊥ — no x can fit',
      detail:
        wanted.verdict === 'true'
          ? 'With no bound on one side, unboundedness always supplies an x, so the conjunction is satisfiable whatever the other variables are.'
          : 'A variable is both below and above x, and irreflexivity forbids that, so no assignment works.',
    }
  }

  const wantedSet = new Set(wanted.atoms)
  const gotSet = new Set(answer.atoms)
  const missing = [...wantedSet].filter((atom) => !gotSet.has(atom)).length
  const extra = [...gotSet].filter((atom) => !wantedSet.has(atom)).length

  if (missing === 0 && extra === 0) {
    return {
      correct: true,
      message: `${wanted.atoms.length} atom${wanted.atoms.length === 1 ? '' : 's'}, and x is gone`,
      detail: `Density: an x strictly between them exists exactly when every lower bound is below every upper bound — one atom per pair. Conjuncts not mentioning ${question.variable} come out untouched.`,
    }
  }

  return {
    correct: false,
    // Counts only: the sprint shows this before the retry.
    message:
      missing > 0
        ? `${missing} atom${missing === 1 ? '' : 's'} short`
        : `${extra} atom${extra === 1 ? ' does' : 's do'} not belong`,
    score: Math.max(0, (wantedSet.size - missing - extra) / Math.max(1, wantedSet.size)),
    detail: `Pair every lower bound of ${question.variable} with every upper bound, in that direction. Nothing that mentions ${question.variable} survives.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
  solution,
}: MinigameScreenProps<QeDenseQuestion, QeDenseAnswer>) {
  const [picked, setPicked] = useState<string[]>([])
  const wanted = useMemo(() => (solution === null ? null : solution), [solution])

  useEffect(() => setPicked([]), [question])

  const toggle = (atom: string) => {
    if (locked) return
    setPicked((previous) =>
      previous.includes(atom) ? previous.filter((each) => each !== atom) : [...previous, atom],
    )
  }

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Eliminate the quantifier
      </p>

      <div className="mt-2 overflow-x-auto rounded-2xl bg-card-shade px-3 py-2 text-center">
        <span className="font-logic text-lg font-bold">
          ∃{question.variable}: {question.conjuncts.join(' ∧ ')}
        </span>
      </div>
      <p className="mt-1 text-center text-xs font-medium text-ink-soft">
        in the theory of unbounded dense linear orders
      </p>

      {!locked && (
        <>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
            Build the equivalent conjunction
          </p>
          <MovingList className="mt-1 flex flex-wrap gap-1.5">
            {question.bank.map((atom) => (
              <MovingItem
                key={atom}
                id={atom}
                onClick={() => toggle(atom)}
                className={`tile px-2.5 py-1 font-logic text-sm font-bold ${
                  picked.includes(atom) ? 'bg-grass text-white' : 'bg-card'
                }`}
              >
                {atom}
              </MovingItem>
            ))}
          </MovingList>

          <div className="mt-2 rounded-2xl bg-card-shade px-3 py-2 text-center">
            <span className="font-logic text-base font-bold">
              {picked.length === 0 ? '— nothing picked —' : picked.join(' ∧ ')}
            </span>
          </div>

          <Button
            variant="coin"
            className="mt-2 w-full"
            disabled={picked.length === 0}
            onClick={() => submit({ verdict: 'atoms', atoms: picked })}
          >
            Submit this conjunction
          </Button>

          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
            Or an axiom settles it outright
          </p>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => submit({ verdict: 'true', atoms: [] })}>
              ⊤ — unbounded
            </Button>
            <Button variant="secondary" onClick={() => submit({ verdict: 'false', atoms: [] })}>
              ⊥ — no room
            </Button>
          </div>
        </>
      )}

      {locked && wanted !== null && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium text-ink-soft">
          The elimination gives{' '}
          <span className="font-logic font-bold text-ink">
            {wanted.verdict === 'true'
              ? '⊤'
              : wanted.verdict === 'false'
                ? '⊥'
                : wanted.atoms.join(' ∧ ')}
          </span>
          .
        </Pop>
      )}
    </Card>
  )
}

export const qeDenseGame = defineMinigame<QeDenseQuestion, QeDenseAnswer>({
  id: 'qe-dense',
  title: 'Squeeze It Out',
  tagline: 'Density, unboundedness and irreflexivity — pick the atoms that survive the ∃.',
  topics: ['quantifier-elimination'],
  icon: '🪟',
  roundSeconds: 150,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  questionKey: (question) => [...question.conjuncts].sort().join('∧'),
  explain: (question) => {
    const answer = reference(question)
    const shown =
      answer.verdict === 'true' ? '⊤' : answer.verdict === 'false' ? '⊥' : answer.atoms.join(' ∧ ')
    return `∃${question.variable}: ${question.conjuncts.join(' ∧ ')} is equivalent to ${shown}.`
  },
  Screen,
  Guide: QeDenseGuide,
})
