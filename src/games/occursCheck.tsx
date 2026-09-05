/**
 * The occurs check — ln.pdf §3.2, Example 3.15.3.
 *
 * Algorithm 3.13 refuses to bind a variable to a term containing it, and the
 * notes answer "why don't we just apply it?" by applying it: f(x) against
 * f(f(x)) becomes f(f(x)) against f(f(f(x))). The mismatch has not been
 * repaired, only moved one symbol along, and it will move again forever.
 *
 * So this game lets you apply it. Press the button and watch the two terms
 * either meet or run away from each other, then say which it was. The rule
 * stops being something to memorise and becomes something you have seen.
 */

import { useEffect, useState } from 'react'
import {
  applySubstitution,
  isVar,
  occurs,
  parseTerm,
  showTerm,
  termSize,
  termsEqual,
  variable,
  type Rng,
  type Signature,
  type Term,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { TermText } from '@/ui/TermText'
import { MovingItem, MovingList, Pop } from '@/ui/motion'
import { firstMismatch } from './unifyDriver'
import { OccursCheckGuide } from './occursCheck.guide'

export interface OccursQuestion {
  signature: Signature
  left: string
  right: string
  /** True when applying the binding really does resolve the mismatch. */
  resolves: boolean
}

/** What was claimed, and how many times it was applied before claiming it. */
export interface OccursAnswer {
  resolves: boolean
  applied: number
}

/** Terms above this many symbols are not worth drawing — the point is made. */
const RUNAWAY = 40

/**
 * One naive application, with no occurs check at all.
 *
 * Deliberately the wrong algorithm: it is what the notes ask you to imagine,
 * and seeing it not work is the lesson.
 */
export function naiveStep(left: Term, right: Term): { left: Term; right: Term } | null {
  const at = firstMismatch(left, right)
  if (at === null) return null
  const source = isVar(at.left) ? at.left : isVar(at.right) ? at.right : null
  if (source === null) return null
  const target = isVar(at.left) ? at.right : at.left
  const binding = { [source.name]: target }
  return { left: applySubstitution(binding, left), right: applySubstitution(binding, right) }
}

/** The chain of pairs, until they meet or the terms run away. */
export function unfold(left: Term, right: Term, limit = 6): { left: Term; right: Term }[] {
  const chain = [{ left, right }]
  for (let step = 0; step < limit; step++) {
    const last = chain[chain.length - 1] as { left: Term; right: Term }
    if (termsEqual(last.left, last.right)) break
    if (termSize(last.left) > RUNAWAY) break
    const next = naiveStep(last.left, last.right)
    if (next === null) break
    chain.push(next)
  }
  return chain
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  symbols: [name: string, arity: number][]
  variables: string[]
  wrapper: [min: number, max: number]
  inner: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    symbols: [
      ['f', 1],
      ['g', 2],
    ],
    variables: ['x', 'y'],
    wrapper: [0, 1],
    inner: [2, 3],
  },
  medium: {
    symbols: [
      ['f', 1],
      ['g', 2],
      ['h', 1],
    ],
    variables: ['x', 'y', 'z'],
    wrapper: [1, 2],
    inner: [2, 4],
  },
  hard: {
    symbols: [
      ['f', 1],
      ['g', 2],
      ['h', 2],
    ],
    variables: ['x', 'y', 'z'],
    wrapper: [1, 3],
    inner: [3, 6],
  },
}

function randomTerm(rng: Rng, profile: Profile, budget: number): Term {
  const usable = profile.symbols.filter(([, arity]) => arity + 1 <= budget)
  if (budget <= 1 || usable.length === 0) return variable(rng.pick(profile.variables))
  const [name, arity] = rng.pick(usable)
  const args: Term[] = []
  let left = budget - 1
  for (let index = 0; index < arity; index++) {
    const share = Math.max(1, Math.floor(left / (arity - index)))
    const arg = randomTerm(rng, profile, rng.range(1, share))
    args.push(arg)
    left -= termSize(arg)
  }
  return { kind: 'fn', name, args }
}

/** Wrap a term in a few layers, so the mismatch is not at the very top. */
function wrap(rng: Rng, profile: Profile, inner: Term, layers: number): Term {
  let term = inner
  for (let layer = 0; layer < layers; layer++) {
    const [name, arity] = rng.pick(profile.symbols.filter(([, count]) => count > 0))
    const at = rng.int(arity)
    term = {
      kind: 'fn',
      name,
      args: Array.from({ length: arity }, (_, index) =>
        index === at ? term : variable(rng.pick(profile.variables)),
      ),
    }
  }
  return term
}

function generate({ rng, difficulty }: GenerateContext): OccursQuestion {
  const profile = PROFILES[difficulty]
  const signature: Signature = Object.fromEntries(profile.symbols)
  const wanted = rng.bool()

  for (let attempt = 0; attempt < 400; attempt++) {
    const name = rng.pick(profile.variables)
    const inner = randomTerm(rng, profile, rng.range(...profile.inner))
    if (inner.kind === 'var') continue
    if (occurs(name, inner) !== !wanted) continue

    const layers = rng.range(...profile.wrapper)
    // The same wrapper both sides, so the first mismatch is exactly the
    // variable against the term.
    const shape = wrap(rng, profile, variable('◇'), layers)
    const put = (term: Term): Term => {
      const walk = (node: Term): Term =>
        node.kind === 'var'
          ? node.name === '◇'
            ? term
            : node
          : { kind: 'fn', name: node.name, args: node.args.map(walk) }
      return walk(shape)
    }

    const left = put(variable(name))
    const right = put(inner)
    if (termsEqual(left, right)) continue
    const at = firstMismatch(left, right)
    if (at === null || !isVar(at.left) || at.left.name !== name) continue

    return { signature, left: showTerm(left), right: showTerm(right), resolves: wanted }
  }

  // Last resort, so a round can never stall: the notes' own pair.
  return { signature: { f: 1 }, left: 'f(x)', right: 'f(f(x))', resolves: false }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: OccursQuestion): OccursAnswer => ({
  resolves: question.resolves,
  applied: 0,
})

function check(question: OccursQuestion, answer: OccursAnswer): Verdict {
  if (answer.resolves === question.resolves) {
    return {
      correct: true,
      message: question.resolves ? 'It resolves' : 'It never resolves',
      detail: question.resolves
        ? 'The variable does not occur in the term, so binding it makes both sides the same and the algorithm moves on.'
        : 'The variable occurs in the term it would be bound to. Each application pushes the mismatch one symbol deeper — that is the occurs check.',
    }
  }

  return {
    correct: false,
    // Says only that the claim was wrong, never which way.
    message: 'Not what happens',
    detail:
      'The test is whether the variable occurs anywhere inside the term it would be bound to. If it does, applying the binding cannot remove it — the term only gets bigger.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked }: MinigameScreenProps<OccursQuestion, OccursAnswer>) {
  const left = parseTerm(question.left, question.signature)
  const right = parseTerm(question.right, question.signature)
  const [applied, setApplied] = useState(0)

  useEffect(() => {
    setApplied(0)
  }, [question])

  const chain = unfold(left, right, applied)
  const last = chain[chain.length - 1] as { left: Term; right: Term }
  const met = termsEqual(last.left, last.right)
  const at = firstMismatch(last.left, last.right)
  const huge = termSize(last.left) > RUNAWAY

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Will binding it ever work?
      </p>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        The mismatch is a variable against a term. Apply the binding and watch — no occurs check is
        being done for you.
      </p>

      <MovingList className="mt-2 flex flex-col gap-1.5">
        {chain.map((pair, index) => (
          <MovingItem
            key={`${showTerm(pair.left)}|${showTerm(pair.right)}`}
            id={`${index}`}
            disabled
            className={`tile flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left
              ${index === chain.length - 1 ? (met ? 'bg-grass text-white' : 'bg-card') : 'bg-card-shade'}`}
          >
            <span className="flex flex-wrap items-baseline gap-2">
              <span className="w-6 shrink-0 text-[0.6rem] font-bold uppercase tracking-wider opacity-60">
                t₁
              </span>
              <TermText text={showTerm(pair.left)} className="text-sm font-bold" />
            </span>
            <span className="flex flex-wrap items-baseline gap-2">
              <span className="w-6 shrink-0 text-[0.6rem] font-bold uppercase tracking-wider opacity-60">
                t₂
              </span>
              <TermText text={showTerm(pair.right)} className="text-sm font-bold" />
            </span>
          </MovingItem>
        ))}
      </MovingList>

      {!locked && (
        <div className="mt-3 flex flex-col gap-2">
          <Button
            variant="secondary"
            disabled={met || huge || at === null}
            onClick={() => setApplied((previous) => previous + 1)}
          >
            {met
              ? 'They are the same now'
              : huge
                ? 'It is only getting bigger'
                : at === null
                  ? 'Nothing left to apply'
                  : `Apply it${applied > 0 ? ` (${applied} so far)` : ''}`}
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="coin" onClick={() => submit({ resolves: true, applied })}>
              It resolves
            </Button>
            <Button variant="danger" onClick={() => submit({ resolves: false, applied })}>
              Never resolves
            </Button>
          </div>
        </div>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            {question.resolves ? 'No occurs check needed' : 'Occurs check'}
          </p>
          <p className="mt-1 font-bold">
            {question.resolves
              ? 'The variable is not inside the term, so one binding settles it.'
              : 'The variable is inside the term it would become. Applying it forever only makes both sides larger.'}
          </p>
        </Pop>
      )}
    </Card>
  )
}

export const occursCheckGame = defineMinigame<OccursQuestion, OccursAnswer>({
  id: 'occurs-check',
  title: 'Push It Along',
  tagline: 'Apply the binding and watch. Some mismatches only move.',
  topics: ['unification'],
  icon: '♾️',
  roundSeconds: 120,
  sprintQuestions: 8,
  generate,
  check,
  solve,
  Screen,
  Guide: OccursCheckGuide,
  questionKey: (question) => `${question.left}|${question.right}`,
})
