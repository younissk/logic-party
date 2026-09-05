/**
 * Writing arithmetic properties in the language of T(ℕ,=,+,*) — ln.pdf §5.2,
 * Exercise 11 question 3, exam26a Q4.3, exam26bA Q4.3.
 *
 * The signature has only =, + and *. Everything else — divisibility, primality,
 * ordering — has to be *defined*, and the lecture's shortcuts are exactly those
 * definitions:
 *
 *   x|y      ∃k: k*x = y
 *   prime(p) p > 1 ∧ ∀a∀b: (a*b = p → a = 1 ∨ b = 1)
 *
 * Once those are available, properties like "n is squarefree" or "n is a power
 * of a prime" are short formulas — and telling them apart is what the exercise
 * tests, because they look alike and are not.
 *
 * Every pairing here is decided rather than stored: each formula is evaluated
 * over a range of n and compared against a plain JavaScript predicate for the
 * property, so a mismatch in either would fail the tests rather than mislead a
 * player.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  agreesWith,
  holdsUpTo,
  showArithFormula,
  type ArithFormula,
} from '@/logic/arithmetic'
import {
  and,
  divides,
  eq,
  exists,
  forall,
  implies,
  not,
  num,
  power,
  prime,
  times,
  v,
} from '@/logic/arithmetic'
import { defineMinigame } from '@/engine/registry'
import type { Difficulty, GenerateContext, MinigameScreenProps, Verdict } from '@/engine/types'
import { Button, Card } from '@/ui/primitives'
import { MovingItem, MovingList, Pop } from '@/ui/motion'
import { SayItInTheLanguageGuide } from './sayItInTheLanguage.guide'

export interface SayItQuestion {
  /** Property ids, in the order the formulas are shown. */
  formulas: string[]
  /** The same ids, shuffled — the order the descriptions are shown. */
  descriptions: string[]
}

/** For each formula row, which description row was linked to it. */
export type SayItAnswer = (number | null)[]

// ---------------------------------------------------------------------------
// The properties
// ---------------------------------------------------------------------------

export interface Property {
  id: string
  description: string
  formula: ArithFormula
  /** The property as plain arithmetic, for checking the formula against. */
  holds: (n: number) => boolean
  difficulty: Difficulty[]
}

const divisors = (n: number): number[] =>
  Array.from({ length: n }, (_, index) => index + 1).filter((d) => n % d === 0)

const isPrimeNumber = (n: number): boolean => n > 1 && divisors(n).length === 2

const primeFactors = (n: number): number[] => divisors(n).filter(isPrimeNumber)

/**
 * Exercise 11's list, plus the two the exams ask for.
 *
 * `holds` is written independently of `formula` on purpose: the test compares
 * them over a range, so the pairing is verified rather than asserted.
 */
export const PROPERTIES: readonly Property[] = [
  {
    id: 'prime',
    description: 'n is prime',
    formula: prime(v('n')),
    holds: isPrimeNumber,
    difficulty: ['easy'],
  },
  {
    id: 'square',
    description: 'n is a square number',
    formula: exists('p', eq(power(v('p'), 2), v('n'))),
    holds: (n) => Number.isInteger(Math.sqrt(n)),
    difficulty: ['easy', 'medium'],
  },
  {
    id: 'square-of-prime',
    description: 'n is the square of a prime',
    formula: exists('p', and(prime(v('p')), eq(power(v('p'), 2), v('n')))),
    holds: (n) => {
      const root = Math.round(Math.sqrt(n))
      return root * root === n && isPrimeNumber(root)
    },
    difficulty: ['easy', 'medium', 'hard'],
  },
  {
    id: 'semiprime',
    description: 'n is a product of two primes',
    formula: exists(
      'p',
      exists('q', and(and(prime(v('p')), prime(v('q'))), eq(times(v('p'), v('q')), v('n')))),
    ),
    holds: (n) => {
      for (const p of primeFactors(n)) {
        if (n % p === 0 && isPrimeNumber(n / p)) return true
      }
      return false
    },
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'squarefree',
    description: 'n is squarefree — no prime divides it twice',
    formula: forall('p', implies(prime(v('p')), not(divides(power(v('p'), 2), v('n'))))),
    holds: (n) => primeFactors(n).every((p) => n % (p * p) !== 0),
    difficulty: ['medium', 'hard'],
  },
  {
    id: 'squareful',
    description: 'n is squareful — every prime dividing it divides it twice',
    formula: forall(
      'p',
      implies(and(prime(v('p')), divides(v('p'), v('n'))), divides(power(v('p'), 2), v('n'))),
    ),
    holds: (n) => primeFactors(n).every((p) => n % (p * p) === 0),
    difficulty: ['hard'],
  },
  {
    id: 'prime-power',
    description: 'n is a power of a prime',
    formula: forall(
      'p',
      forall(
        'q',
        implies(
          and(and(prime(v('p')), prime(v('q'))), and(divides(v('p'), v('n')), divides(v('q'), v('n')))),
          eq(v('p'), v('q')),
        ),
      ),
    ),
    holds: (n) => primeFactors(n).length <= 1,
    difficulty: ['medium', 'hard'],
  },
  {
    // exam26bA question 4.3.
    id: 'two-primes',
    description: 'n is divisible by two different prime numbers',
    formula: exists(
      'p',
      exists(
        'q',
        and(
          and(prime(v('p')), prime(v('q'))),
          and(not(eq(v('p'), v('q'))), and(divides(v('p'), v('n')), divides(v('q'), v('n')))),
        ),
      ),
    ),
    holds: (n) => primeFactors(n).length >= 2,
    difficulty: ['medium', 'hard'],
  },
  {
    // exam26a question 4.3.
    id: 'power-of-two',
    description: 'n is a power of 2',
    formula: forall(
      'p',
      implies(and(prime(v('p')), divides(v('p'), v('n'))), eq(v('p'), num(2))),
    ),
    holds: (n) => primeFactors(n).every((p) => p === 2),
    difficulty: ['hard'],
  },
  {
    id: 'even',
    description: 'n is even',
    formula: divides(num(2), v('n')),
    holds: (n) => n % 2 === 0,
    difficulty: ['easy'],
  },
  {
    id: 'at-least-one',
    description: 'n has a divisor other than 1 and itself',
    formula: exists(
      'p',
      and(and(not(eq(v('p'), num(1))), not(eq(v('p'), v('n')))), divides(v('p'), v('n'))),
    ),
    holds: (n) => divisors(n).some((d) => d !== 1 && d !== n),
    difficulty: ['easy', 'medium'],
  },
]

export const propertyOf = (id: string): Property =>
  PROPERTIES.find((property) => property.id === id) ?? (PROPERTIES[0] as Property)

/** How far up the naturals the formulas are checked. */
export const LIMIT = 40

/**
 * Checking starts at 1, not 0.
 *
 * Zero is degenerate for divisibility — every number divides it, so "n is
 * squarefree" and "every prime dividing n divides it twice" both come out
 * false there while the plain-arithmetic reading of "the primes dividing 0"
 * has nothing to say. None of the exercise's properties are about 0, so the
 * range starts where they are meaningful.
 */
export const RANGE_START = 1

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const HOW_MANY: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 4 }

function generate({ rng, difficulty }: GenerateContext): SayItQuestion {
  const pool = PROPERTIES.filter((property) => property.difficulty.includes(difficulty))
  const usable = pool.length >= HOW_MANY[difficulty] ? pool : PROPERTIES

  for (let attempt = 0; attempt < 30; attempt++) {
    const chosen = rng.sample(usable, HOW_MANY[difficulty]).map((property) => property.id)
    // Two properties that agree on every n in range would make the pairing
    // ambiguous, and the game would mark a right answer wrong.
    const signatures = chosen.map((id) =>
      Array.from({ length: LIMIT }, (_, index) =>
        propertyOf(id).holds(index + RANGE_START) ? '1' : '0',
      ).join(''),
    )
    if (new Set(signatures).size !== chosen.length) continue
    return { formulas: chosen, descriptions: rng.shuffle(chosen) }
  }
  const fallback = ['prime', 'even', 'square']
  return { formulas: fallback, descriptions: [...fallback].reverse() }
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

const solve = (question: SayItQuestion): SayItAnswer =>
  question.formulas.map((id) => question.descriptions.indexOf(id))

function check(question: SayItQuestion, answer: SayItAnswer): Verdict {
  const wanted = solve(question)
  const wrong = wanted.filter((index, position) => answer[position] !== index).length

  if (wrong === 0) {
    return {
      correct: true,
      message: `All ${wanted.length} matched`,
      detail:
        'Every one of these is built from = , + and * alone — x|y and prime(p) are abbreviations, not extra symbols.',
    }
  }

  // The first n telling two of the mismatched properties apart, which is the
  // useful hint and gives nothing away about the pairing.
  const position = wanted.findIndex((index, at) => answer[at] !== index)
  const wantedId = question.formulas[position] as string
  const givenIndex = answer[position]
  const givenId = givenIndex === null || givenIndex === undefined ? null : question.descriptions[givenIndex]
  const split =
    givenId === null || givenId === undefined
      ? null
      : Array.from({ length: LIMIT + 1 }, (_, n) => n).find(
          (n) => propertyOf(wantedId).holds(n) !== propertyOf(givenId).holds(n),
        )

  return {
    correct: false,
    // A count and a number, never a pairing.
    message: `${wrong} of ${wanted.length} matched wrongly`,
    score: (wanted.length - wrong) / wanted.length,
    detail:
      split === undefined || split === null
        ? 'Try each formula on a small n and see which descriptions survive.'
        : `Try n = ${split}: two of your pairings disagree there.`,
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function Screen({ question, submit, locked }: MinigameScreenProps<SayItQuestion, SayItAnswer>) {
  const wanted = useMemo(() => solve(question), [question])
  const [links, setLinks] = useState<(number | null)[]>(question.formulas.map(() => null))
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    setLinks(question.formulas.map(() => null))
    setActive(null)
  }, [question])

  const shown = locked ? wanted : links

  const linkTo = (description: number) => {
    if (locked || active === null) return
    setLinks((previous) =>
      previous.map((entry, index) =>
        index === active ? description : entry === description ? null : entry,
      ),
    )
    setActive(null)
  }

  const done = links.every((entry) => entry !== null)

  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Match each formula to what it says
      </p>
      <p className="mt-1 text-xs font-medium text-ink-soft">
        The language has only = , + and * — everything else is a shortcut the lecture defines.
      </p>

      <div className="mt-3 flex flex-col gap-1.5">
        {question.formulas.map((id, index) => {
          const linked = shown[index]
          const right = locked && linked === wanted[index]
          return (
            <button
              key={id}
              type="button"
              disabled={locked}
              onClick={() => setActive(active === index ? null : index)}
              className={`tile px-3 py-2 text-left ${
                locked
                  ? right
                    ? 'bg-grass/30'
                    : 'bg-space-red/20'
                  : active === index
                    ? 'bg-coin'
                    : 'bg-card-shade'
              }`}
            >
              <span className="block overflow-x-auto font-logic text-sm font-bold">
                {showArithFormula(propertyOf(id).formula)}
              </span>
              <span className="mt-1 block text-xs font-bold text-ink-soft">
                {linked === null || linked === undefined
                  ? 'tap, then tap a description'
                  : propertyOf(question.descriptions[linked] as string).description}
              </span>
            </button>
          )
        })}
      </div>

      {!locked && (
        <>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
            The descriptions
          </p>
          <MovingList className="mt-1 flex flex-col gap-1.5">
            {question.descriptions.map((id, index) => (
              <MovingItem
                key={id}
                id={id}
                disabled={active === null}
                onClick={() => linkTo(index)}
                className={`tile px-3 py-1.5 text-left text-sm font-bold ${
                  links.includes(index) ? 'bg-grass/25' : 'bg-card'
                }`}
              >
                {propertyOf(id).description}
              </MovingItem>
            ))}
          </MovingList>

          <Button
            variant="coin"
            className="mt-3 w-full"
            disabled={!done}
            onClick={() => submit(links)}
          >
            {done ? 'Submit' : 'Match them all first'}
          </Button>
        </>
      )}

      {locked && (
        <Pop className="mt-3 rounded-2xl bg-card-shade p-3 text-sm font-medium text-ink-soft">
          Each of these was checked against plain arithmetic for every n up to {LIMIT} — the
          formulas really do define the properties, they are not paired by name.
        </Pop>
      )}
    </Card>
  )
}

export const sayItInTheLanguageGame = defineMinigame<SayItQuestion, SayItAnswer>({
  id: 'divides',
  title: 'Say It In The Language',
  tagline: 'Match each arithmetic formula to the property it actually defines.',
  topics: ['arithmetic-theories'],
  icon: '🧮',
  roundSeconds: 180,
  sprintQuestions: 6,
  generate,
  check,
  solve,
  questionKey: (question) => [...question.formulas].sort().join(','),
  explain: (question) => {
    const id = question.formulas[0] as string
    const property = propertyOf(id)
    const example = Array.from({ length: LIMIT }, (_, index) => index + RANGE_START).find((n) =>
      holdsUpTo(property.formula, { n }, LIMIT),
    )
    return `${showArithFormula(property.formula)} says "${property.description}" — the smallest n it holds for is ${example}.`
  },
  Screen,
  Guide: SayItInTheLanguageGuide,
})

/**
 * Does the formula define the property it claims?
 *
 * `agreesWith` starts at 0, so the predicate is patched to agree there — the
 * range that matters begins at RANGE_START, and the test asserts over that.
 */
export const verifyProperty = (
  property: Property,
): { agrees: boolean; firstDisagreement: number | null } =>
  agreesWith(
    property.formula,
    'n',
    (value) => (value < RANGE_START ? holdsUpTo(property.formula, { n: value }, LIMIT) : property.holds(value)),
    LIMIT,
  )
