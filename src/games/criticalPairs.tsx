/**
 * Computing critical pairs — ln.pdf §3.4, Algorithm 3.25, exam25a Q2.3,
 * exam26bA Q2.4, Exercise 6.
 *
 * A reduction path can only fork where two rules apply to *overlapping*
 * subterms. Algorithm 3.25 finds those overlaps by unifying a non-variable
 * subterm of one rule's left side with the whole of another's — renamed apart
 * first, or two rules that happen to reuse a variable name would look like they
 * overlap when they do not.
 *
 * You do the overlapping. Pick the outer rule, pick which of its subterms to
 * unify into, pick the inner rule, and if there is an mgu the pair deals itself
 * into your tray. Two things fall out of that which a checkbox never shows: a
 * rule overlaps *itself* at every proper subterm, and the root overlap of a
 * rule with its own copy is not a fork at all.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  applySubstitution,
  criticalPairs,
  isVar,
  mgu,
  parseTerm,
  positions,
  renameApart,
  replaceAt,
  rule,
  showPosition,
  showTerm,
  subtermAt,
  termVariables,
  termsEqual,
  samePair,
  type Position,
  type Rule,
  type Signature,
  type Term,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { EquationText, TermText } from '@/ui/TermText'
import { MovingItem, MovingList, Pop, ProgressBar, Shakeable, useShake } from '@/ui/motion'
import { CriticalPairsGuide } from './criticalPairs.guide'

export interface CriticalPairsQuestion {
  signature: Signature
  rules: string[]
  /** Every non-trivial critical pair, as `left|right` sources. */
  pairs: [string, string][]
}

/** The pairs produced, in the same shape. */
export type CriticalPairsAnswer = [string, string][]

export const readRules = (question: CriticalPairsQuestion): Rule[] =>
  question.rules.map((source) => {
    const [left, right] = source.split('->')
    return rule(
      parseTerm(left as string, question.signature),
      parseTerm(right as string, question.signature),
    )
  })

const readPair = (question: CriticalPairsQuestion, pair: [string, string]) => ({
  left: parseTerm(pair[0], question.signature),
  right: parseTerm(pair[1], question.signature),
})

// ---------------------------------------------------------------------------
// The one move
// ---------------------------------------------------------------------------

/**
 * Overlap the inner rule into the outer rule's left side at one position.
 *
 * Returns null when they do not unify there — which is most of the time, and
 * is why the exercise is finding the few that do.
 */
export function overlap(
  rules: readonly Rule[],
  outerIndex: number,
  position: Position,
  innerIndex: number,
): { left: Term; right: Term } | null {
  const outer = rules[outerIndex]
  const inner = rules[innerIndex]
  if (outer === undefined || inner === undefined) return null

  const sub = subtermAt(outer.left, position)
  if (sub === undefined || isVar(sub)) return null
  // A rule against its own copy at the root is not an overlap: the mgu is a
  // renaming and the two sides are the same term twice.
  if (outerIndex === innerIndex && position.length === 0) return null

  const avoid = [...termVariables(outer.left), ...termVariables(outer.right)]
  const innerLeft = renameApart(inner.left, avoid)
  const innerRight = renameApart(inner.right, avoid)

  const sigma = mgu(sub, innerLeft)
  if (sigma === null) return null

  const left = applySubstitution(sigma, outer.right)
  const right = replaceAt(
    applySubstitution(sigma, outer.left),
    position,
    applySubstitution(sigma, innerRight),
  )
  if (termsEqual(left, right)) return null
  return { left, right }
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const SYSTEMS: Record<Difficulty, { signature: Signature; rules: string[] }[]> = {
  easy: [
    { signature: { f: 1, g: 1 }, rules: ['f(f(x))->g(x)'] },
    { signature: { f: 1, h: 1 }, rules: ['f(h(x))->x', 'f(f(x))->h(x)'] },
    { signature: { f: 1, h: 1 }, rules: ['f(h(x))->f(x)', 'h(f(x))->h(x)'] },
    { signature: { f: 1, g: 1, h: 1 }, rules: ['h(f(x))->h(g(x))', 'f(g(x))->g(f(x))'] },
  ],
  medium: [
    { signature: { f: 1, g: 2, h: 1 }, rules: ['g(x,f(y))->f(x)', 'g(f(x),y)->h(x)'] },
    { signature: { f: 1, g: 1, h: 1 }, rules: ['f(g(x))->f(x)', 'g(f(y))->f(y)', 'h(g(z))->f(z)'] },
    { signature: { f: 1, h: 1 }, rules: ['f(h(x))->x', 'f(f(x))->h(x)', 'h(h(x))->x'] },
    { signature: { f: 2, g: 1 }, rules: ['f(g(x),y)->g(f(x,y))', 'g(g(x))->x'] },
  ],
  hard: [
    {
      signature: { f: 2, g: 2, h: 1 },
      rules: ['f(g(X,Y),Z)->h(Y)', 'g(X,h(Y))->f(X,Y)', 'g(h(X),Y)->f(X,h(Y))'],
    },
    {
      signature: { f: 1, g: 2, h: 2 },
      rules: ['g(x,f(y))->f(x)', 'g(f(x),y)->h(x,y)', 'h(f(x),y)->f(y)'],
    },
    {
      signature: { f: 1, g: 1, h: 1 },
      rules: ['f(f(x))->g(x)', 'g(g(x))->h(x)', 'h(h(x))->f(x)'],
    },
  ],
}

function generate({ rng, difficulty }: GenerateContext): CriticalPairsQuestion {
  for (const system of rng.shuffle(SYSTEMS[difficulty])) {
    const rules = system.rules.map((source) => {
      const [left, right] = source.split('->')
      return rule(
        parseTerm(left as string, system.signature),
        parseTerm(right as string, system.signature),
      )
    })
    const pairs = criticalPairs(rules)
    // Something to find, and few enough to find inside a round.
    if (pairs.length < 1 || pairs.length > 6) continue
    return {
      signature: system.signature,
      rules: system.rules,
      pairs: pairs.map((pair) => [showTerm(pair.left), showTerm(pair.right)] as [string, string]),
    }
  }

  // Last resort, so a round can never stall: Example 3.24.1.
  const signature: Signature = { f: 1, g: 2, h: 1 }
  const sources = ['g(x,f(y))->f(x)', 'g(f(x),y)->h(x)']
  const rules = sources.map((source) => {
    const [left, right] = source.split('->')
    return rule(parseTerm(left as string, signature), parseTerm(right as string, signature))
  })
  return {
    signature,
    rules: sources,
    pairs: criticalPairs(rules).map(
      (pair) => [showTerm(pair.left), showTerm(pair.right)] as [string, string],
    ),
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: CriticalPairsQuestion): CriticalPairsAnswer => [...question.pairs]

function check(question: CriticalPairsQuestion, answer: CriticalPairsAnswer): Verdict {
  const wanted = question.pairs.map((pair) => readPair(question, pair))
  const found = answer.map((pair) => readPair(question, pair))

  const missed = wanted.filter(
    (target) => !found.some((candidate) => samePair(candidate, target)),
  ).length
  // Everything in the tray was produced by the board, so an extra can only be a
  // duplicate under renaming.
  const extra = found.filter(
    (candidate) => !wanted.some((target) => samePair(candidate, target)),
  ).length

  if (missed === 0 && extra === 0) {
    return {
      correct: true,
      message: `All ${wanted.length} found`,
      detail:
        'Each one comes from unifying a non-variable subterm of one rule’s left side with another rule’s left side — including a rule with a renamed copy of itself.',
    }
  }

  return {
    correct: false,
    // A count, never which: sprint shows this before the retry.
    message: missed > 0 ? `${missed} still to find` : `${extra} of those repeat`,
    score:
      wanted.length === 0 ? 0 : Math.max(0, (wanted.length - missed - extra) / wanted.length),
    detail:
      'Try every rule against every rule, and inside each pairing every non-variable subterm of the outer left side. Do not forget a rule against itself below the root.',
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<CriticalPairsQuestion, CriticalPairsAnswer>) {
  const rules = useMemo(() => readRules(question), [question])
  const [outer, setOuter] = useState<number | null>(null)
  const [spot, setSpot] = useState<Position | null>(null)
  const [found, setFound] = useState<[string, string][]>([])
  const [shaking, shake] = useShake()

  useEffect(() => {
    setOuter(null)
    setSpot(null)
    setFound([])
  }, [question])

  const outerRule = outer === null ? null : (rules[outer] as Rule)
  const spots =
    outerRule === null
      ? []
      : positions(outerRule.left).filter((position) => {
          const sub = subtermAt(outerRule.left, position)
          return sub !== undefined && !isVar(sub)
        })

  const tryInner = (innerIndex: number) => {
    if (locked || outer === null || spot === null) return
    const pair = overlap(rules, outer, spot, innerIndex)
    if (pair === null) {
      shake()
      return
    }
    const printed: [string, string] = [showTerm(pair.left), showTerm(pair.right)]
    const parsed = { left: pair.left, right: pair.right }
    const already = found.some((existing) =>
      samePair(
        { left: parseTerm(existing[0], question.signature), right: parseTerm(existing[1], question.signature) },
        parsed,
      ),
    )
    if (already) {
      shake()
      return
    }
    setFound((previous) => [...previous, printed])
    setSpot(null)
    setOuter(null)
  }

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
          Find every critical pair
        </p>
        <p className="text-xs font-bold text-ink-soft">
          {found.length} of {question.pairs.length}
        </p>
      </div>

      <p className="mt-1 text-xs font-medium text-ink-soft">
        Pick a rule, then a subterm of its left side, then the rule to unify into it.
      </p>

      <Shakeable shaking={shaking}>
        <div className="mt-2 flex flex-col gap-1.5">
          {rules.map((entry, index) => (
            <button
              key={index}
              type="button"
              disabled={locked}
              onClick={() => {
                if (outer === null || spot === null) {
                  setOuter(index === outer ? null : index)
                  setSpot(null)
                  return
                }
                tryInner(index)
              }}
              className={`tile flex w-full items-center gap-2 px-3 py-2 text-left
                ${outer === index ? 'bg-space-blue text-white' : 'bg-card'}`}
            >
              <span className="w-5 shrink-0 text-xs font-bold opacity-60">R{index + 1}</span>
              <EquationText
                left={entry.left}
                right={entry.right}
                arrow="→"
                className={`text-base font-bold ${outer === index ? 'text-white' : ''}`}
              />
            </button>
          ))}
        </div>
      </Shakeable>

      {outerRule !== null && (
        <Pop className="tile mt-2 bg-coin p-3">
          <p className="text-sm font-bold">
            {spot === null
              ? 'Which subterm of its left side?'
              : 'Now the rule to unify into that spot.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {spots.map((position) => {
              const sub = subtermAt(outerRule.left, position) as Term
              const on = spot !== null && showPosition(spot) === showPosition(position)
              return (
                <button
                  key={showPosition(position)}
                  type="button"
                  onClick={() => setSpot(on ? null : position)}
                  className={`chunky min-h-10 px-3 text-sm font-bold
                    focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
                    ${on ? 'bg-space-blue text-white' : 'bg-card text-ink hover:bg-card-shade'}`}
                >
                  <TermText term={sub} className={on ? 'text-white' : ''} />
                  <span className="ml-1 text-[0.6rem] opacity-60">
                    {showPosition(position)}
                  </span>
                </button>
              )
            })}
          </div>
        </Pop>
      )}

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">Your tray</p>
      <div className="mt-1">
        <ProgressBar value={found.length} total={question.pairs.length} />
      </div>
      <MovingList className="mt-1 flex flex-col gap-1">
        {(locked ? question.pairs : found).map((pair) => (
          <MovingItem
            key={`${pair[0]}|${pair[1]}`}
            id={`${pair[0]}|${pair[1]}`}
            disabled
            className="tile flex w-full items-center gap-2 bg-grass px-3 py-1.5 text-left text-white"
          >
            <span className="formula text-base font-bold">(</span>
            <TermText text={pair[0]} className="text-base font-bold" />
            <span className="formula font-bold opacity-70">,</span>
            <TermText text={pair[1]} className="text-base font-bold" />
            <span className="formula text-base font-bold">)</span>
          </MovingItem>
        ))}
        {found.length === 0 && !locked && (
          <p className="rounded-xl bg-card-shade px-3 py-2 text-sm font-semibold text-ink-soft">
            Nothing yet.
          </p>
        )}
      </MovingList>

      {!locked && (
        <Button variant="coin" className="mt-3 w-full" onClick={() => submit(found)}>
          {found.length === question.pairs.length
            ? 'Submit'
            : `Submit — ${question.pairs.length - found.length} still out there`}
        </Button>
      )}
    </Card>
  )
}

export const criticalPairsGame = defineMinigame<CriticalPairsQuestion, CriticalPairsAnswer>({
  id: 'critical-pairs',
  title: 'Find The Forks',
  tagline: 'Every rule against every rule, at every subterm that is not a variable.',
  topics: ['rewriting'],
  icon: '🍴',
  roundSeconds: 240,
  sprintQuestions: 5,
  generate,
  check,
  solve,
  Screen,
  Guide: CriticalPairsGuide,
  questionKey: (question) => question.rules.join(';'),
})
