/**
 * Composing substitutions — ln.pdf §3.2, exam26bA Q2.1.
 *
 * σ ∘ σ′ means apply σ′ first, then σ. Two things go wrong, and the exam asks
 * about both. Reversing the order gives a different substitution — the notes
 * work σ ∘ σ′ and σ′ ∘ σ side by side to show they differ. And a substitution
 * is applied *simultaneously and once*, so σ(x) is read off σ's own table, not
 * by chasing x through it twice: for σ = {x ↦ f(y), y ↦ z}, σ(x) is f(y), not
 * f(z).
 *
 * You build the answer rather than recognise it, one image per variable.
 */

import { useEffect, useState } from 'react'
import {
  applySubstitution,
  compose,
  parseTerm,
  showTerm,
  substitutionDomain,
  termsEqual,
  variable,
  type Rng,
  type Signature,
  type Substitution,
  type Term,
} from '@/logic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { SubstitutionText, TermText } from '@/ui/TermText'
import { Pop } from '@/ui/motion'
import { TermBuilder, hole, slotToTerm, termToSlot, type Slot } from '@/ui/TermBuilder'
import { CompositionGuide } from './composition.guide'

export interface CompositionQuestion {
  signature: Signature
  variables: string[]
  /** Printed sources, so the question stays plain data. */
  outer: Record<string, string>
  inner: Record<string, string>
  /** Variables the composition actually moves. */
  domain: string[]
}

/** One built term per variable in the domain. */
export type CompositionAnswer = Record<string, Slot>

const readSubstitution = (
  mapping: Record<string, string>,
  signature: Signature,
): Substitution =>
  Object.fromEntries(
    Object.entries(mapping).map(([name, source]) => [name, parseTerm(source, signature)]),
  )

export const composedOf = (question: CompositionQuestion): Substitution =>
  compose(
    readSubstitution(question.outer, question.signature),
    readSubstitution(question.inner, question.signature),
  )

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface Profile {
  symbols: [name: string, arity: number][]
  variables: string[]
  depth: number
  entries: [min: number, max: number]
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    symbols: [
      ['f', 1],
      ['g', 2],
    ],
    variables: ['x', 'y'],
    depth: 1,
    entries: [1, 2],
  },
  medium: {
    symbols: [
      ['f', 1],
      ['g', 2],
      ['h', 1],
    ],
    variables: ['x', 'y', 'z'],
    depth: 2,
    entries: [2, 2],
  },
  hard: {
    symbols: [
      ['f', 2],
      ['g', 2],
      ['h', 1],
    ],
    variables: ['x', 'y', 'z'],
    depth: 2,
    entries: [2, 3],
  },
}

function randomImage(rng: Rng, profile: Profile, depth: number): Term {
  if (depth <= 0 || rng.bool(0.35)) return variable(rng.pick(profile.variables))
  const [name, arity] = rng.pick(profile.symbols)
  return {
    kind: 'fn',
    name,
    args: Array.from({ length: arity }, () => randomImage(rng, profile, depth - 1)),
  }
}

function randomSubstitution(rng: Rng, profile: Profile): Record<string, string> {
  const count = rng.range(...profile.entries)
  const names = rng.sample(profile.variables, count)
  const mapping: Record<string, string> = {}
  for (const name of names) {
    const image = randomImage(rng, profile, profile.depth)
    if (termsEqual(image, variable(name))) continue
    mapping[name] = showTerm(image)
  }
  return mapping
}

function generate({ rng, difficulty }: GenerateContext): CompositionQuestion {
  const profile = PROFILES[difficulty]
  const signature: Signature = Object.fromEntries(profile.symbols)

  for (let attempt = 0; attempt < 300; attempt++) {
    const outer = randomSubstitution(rng, profile)
    const inner = randomSubstitution(rng, profile)
    if (Object.keys(outer).length === 0 || Object.keys(inner).length === 0) continue

    const question = { signature, variables: profile.variables, outer, inner, domain: [] as string[] }
    const composed = composedOf(question)
    const domain = substitutionDomain(composed)
    if (domain.length < 2 || domain.length > 3) continue

    // The point is that order matters, so a question where it does not is not
    // worth asking.
    const other = compose(readSubstitution(inner, signature), readSubstitution(outer, signature))
    if (substitutionDomain(other).every((name) =>
      termsEqual(other[name] as Term, (composed[name] ?? variable(name)) as Term),
    )) {
      continue
    }
    // And at least one image must actually be rebuilt rather than copied.
    if (domain.every((name) => (inner[name] ?? outer[name]) === showTerm(composed[name] as Term))) {
      continue
    }

    return { ...question, domain }
  }

  // Last resort, so a round can never stall: the exam's own question.
  return {
    signature: { f: 1 },
    variables: ['x', 'y'],
    outer: { x: 'y' },
    inner: { y: 'f(x)' },
    domain: ['x', 'y'],
  }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

function solve(question: CompositionQuestion): CompositionAnswer {
  const composed = composedOf(question)
  return Object.fromEntries(
    question.domain.map((name) => [name, termToSlot((composed[name] ?? variable(name)) as Term)]),
  )
}

function check(question: CompositionQuestion, answer: CompositionAnswer): Verdict {
  const composed = composedOf(question)
  const wrong: string[] = []
  const unfinished: string[] = []

  for (const name of question.domain) {
    const slot = answer[name]
    const built = slot === undefined ? null : slotToTerm(slot)
    if (built === null) {
      unfinished.push(name)
      continue
    }
    if (!termsEqual(built, (composed[name] ?? variable(name)) as Term)) wrong.push(name)
  }

  const right = question.domain.length - wrong.length - unfinished.length

  if (wrong.length === 0 && unfinished.length === 0) {
    return {
      correct: true,
      message: `σ ∘ σ′ = ${showSubstitutionSource(question, composed)}`,
      detail: 'Inner first, outer second, and each image read off in one pass.',
    }
  }

  return {
    correct: false,
    // Says how many, never which, and never what they should be.
    message:
      unfinished.length > 0 && wrong.length === 0
        ? `${unfinished.length} image${unfinished.length === 1 ? '' : 's'} still has a hole`
        : `${wrong.length + unfinished.length} of ${question.domain.length} images wrong`,
    score: question.domain.length === 0 ? 0 : right / question.domain.length,
    detail:
      'For each variable x, work out σ′(x) first, then apply σ to that whole term — once, to every variable in it at the same time.',
  }
}

const showSubstitutionSource = (
  question: CompositionQuestion,
  sigma: Substitution,
): string =>
  `{${question.domain
    .map((name) => `${name} ↦ ${showTerm((sigma[name] ?? variable(name)) as Term)}`)
    .join(', ')}}`

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({
  question,
  submit,
  locked,
}: MinigameScreenProps<CompositionQuestion, CompositionAnswer>) {
  const [slots, setSlots] = useState<CompositionAnswer>({})

  useEffect(() => {
    setSlots(Object.fromEntries(question.domain.map((name) => [name, hole()])))
  }, [question])

  const outer = readSubstitution(question.outer, question.signature)
  const inner = readSubstitution(question.inner, question.signature)
  const filled = question.domain.filter((name) => {
    const slot = slots[name]
    return slot !== undefined && slotToTerm(slot) !== null
  }).length

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Build σ ∘ σ′
      </p>

      <div className="tile mt-2 flex flex-col gap-1 bg-card-shade px-3 py-2 text-base font-bold">
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="w-6 shrink-0 opacity-70">σ</span>
          <SubstitutionText sigma={outer} />
        </p>
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="w-6 shrink-0 opacity-70">σ′</span>
          <SubstitutionText sigma={inner} />
        </p>
      </div>

      <p className="mt-1 text-xs font-medium text-ink-soft">
        σ′ is applied first. Every variable not listed maps to itself.
      </p>

      <div className="mt-3 flex flex-col gap-4">
        {question.domain.map((name) => {
          const innerImage = (inner[name] ?? variable(name)) as Term
          return (
            <div key={name}>
              <div className="flex flex-wrap items-baseline gap-2 text-sm font-bold">
                <span className="formula text-base">{name}</span>
                <span className="opacity-60">↦ σ(</span>
                <TermText term={innerImage} />
                <span className="opacity-60">) =</span>
              </div>
              <TermBuilder
                signature={question.signature}
                variables={question.variables}
                value={slots[name] ?? hole()}
                onChange={(next) => setSlots((previous) => ({ ...previous, [name]: next }))}
                disabled={locked}
              />
            </div>
          )
        })}
      </div>

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">σ ∘ σ′</p>
          <SubstitutionText sigma={composedOf(question)} className="mt-1 text-base font-bold" />
          <p className="mt-2 text-xs font-bold uppercase tracking-wider text-ink-soft">
            The other order, σ′ ∘ σ
          </p>
          <SubstitutionText
            sigma={compose(inner, outer)}
            className="mt-1 text-base font-bold"
          />
        </Pop>
      )}

      {!locked && (
        <Button
          variant={filled === question.domain.length ? 'coin' : 'secondary'}
          className="mt-3 w-full"
          onClick={() => submit(slots)}
        >
          {filled === question.domain.length
            ? 'Submit'
            : `Submit — ${question.domain.length - filled} still open`}
        </Button>
      )}
    </Card>
  )
}

/** Applying both in turn — used by the guide to show the two orders differ. */
export const applyBoth = (outer: Substitution, inner: Substitution, term: Term): Term =>
  applySubstitution(outer, applySubstitution(inner, term))

export const compositionGame = defineMinigame<CompositionQuestion, CompositionAnswer>({
  id: 'composition',
  title: 'Compose It',
  tagline: 'Inner first, outer second — and never twice over.',
  topics: ['unification'],
  icon: '🔗',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  Screen,
  Guide: CompositionGuide,
  questionKey: (question) =>
    `${JSON.stringify(question.outer)}|${JSON.stringify(question.inner)}`,
})
