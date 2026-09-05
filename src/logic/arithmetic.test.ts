import { describe, expect, it } from 'vitest'
import {
  agreesWith,
  and,
  divides,
  eq,
  exists,
  forall,
  holdsUpTo,
  implies,
  isPrime,
  le,
  not,
  num,
  plus,
  power,
  prime,
  showArithFormula,
  times,
  v,
  witnesses,
} from './arithmetic'

/** The properties Exercise 11 asks you to match formulas to. */
const squareful = (n: number): boolean => {
  if (n < 1) return n === 0
  for (let p = 2; p <= n; p++) {
    if (!isPrime(p)) continue
    if (n % p === 0 && n % (p * p) !== 0) return false
  }
  return true
}
const squarefree = (n: number): boolean => {
  if (n < 1) return n === 0 ? false : true
  for (let p = 2; p * p <= n; p++) {
    if (isPrime(p) && n % (p * p) === 0) return false
  }
  return true
}
const primePower = (n: number): boolean => {
  // In ℕ every prime divides 0, so 0 is not a power of a single prime.
  if (n === 0) return false
  const primes: number[] = []
  for (let p = 2; p <= n; p++) if (isPrime(p) && n % p === 0) primes.push(p)
  return primes.length <= 1
}
const square = (n: number): boolean => Number.isInteger(Math.sqrt(n))

describe('evaluating', () => {
  it('reads a term', () => {
    expect(holdsUpTo(eq(plus(v('x'), num(2)), num(5)), { x: 3 }, 10)).toBe(true)
    expect(holdsUpTo(eq(times(v('x'), v('x')), num(9)), { x: 3 }, 10)).toBe(true)
    expect(holdsUpTo(eq(power(v('x'), 3), num(8)), { x: 2 }, 10)).toBe(true)
  })

  it('knows the divisibility conventions of ℕ', () => {
    expect(holdsUpTo(divides(num(3), num(12)), {}, 20)).toBe(true)
    expect(holdsUpTo(divides(num(5), num(12)), {}, 20)).toBe(false)
    // Every number divides 0; 0 divides only 0.
    expect(holdsUpTo(divides(num(7), num(0)), {}, 20)).toBe(true)
    expect(holdsUpTo(divides(num(0), num(7)), {}, 20)).toBe(false)
    expect(holdsUpTo(divides(num(0), num(0)), {}, 20)).toBe(true)
  })

  it('agrees with a sieve on primality', () => {
    expect(witnesses(prime(v('n')), 'n', 30)).toEqual([2, 3, 5, 7, 11, 13, 17, 19, 23, 29])
  })

  it('searches quantifiers over the bound', () => {
    // ∃y: n = y + y — the even numbers.
    const even = exists('y', eq(v('n'), plus(v('y'), v('y'))))
    expect(witnesses(even, 'n', 10)).toEqual([0, 2, 4, 6, 8, 10])
  })

  it('runs the notes’ own example: a multiple of 4 is even', () => {
    const formula = forall(
      'x',
      implies(
        exists('z', eq(v('x'), plus(plus(v('z'), v('z')), plus(v('z'), v('z'))))),
        exists('y', eq(v('x'), plus(v('y'), v('y')))),
      ),
    )
    expect(holdsUpTo(formula, {}, 40)).toBe(true)
  })
})

describe('Exercise 11’s matching question', () => {
  const bound = 60

  it('matches "squareful" to ∀p:(prime(p) ∧ p|n) → p²|n', () => {
    const formula = forall(
      'p',
      implies(and(prime(v('p')), divides(v('p'), v('n'))), divides(power(v('p'), 2), v('n'))),
    )
    expect(agreesWith(formula, 'n', squareful, bound).agrees).toBe(true)
  })

  it('matches "a power of a prime" to the two-primes-are-equal formula', () => {
    const formula = forall(
      'p',
      forall(
        'q',
        implies(
          and(
            and(prime(v('p')), prime(v('q'))),
            and(divides(v('p'), v('n')), divides(v('q'), v('n'))),
          ),
          eq(v('p'), v('q')),
        ),
      ),
    )
    expect(agreesWith(formula, 'n', primePower, bound).agrees).toBe(true)
  })

  it('matches "a square number" to ∃p: p² = n', () => {
    const formula = exists('p', eq(power(v('p'), 2), v('n')))
    expect(agreesWith(formula, 'n', square, bound).agrees).toBe(true)
  })

  it('matches "squarefree" to ∀p: prime(p) → ¬(p²|n)', () => {
    const formula = forall('p', implies(prime(v('p')), not(divides(power(v('p'), 2), v('n')))))
    // n = 0 is the one place the reading and the usual definition part: every
    // square divides 0, so the formula is false there and the predicate is
    // written to match.
    expect(agreesWith(formula, 'n', squarefree, bound).agrees).toBe(true)
  })

  it('reports where two readings first disagree', () => {
    const squarefreeFormula = forall(
      'p',
      implies(prime(v('p')), not(divides(power(v('p'), 2), v('n')))),
    )
    const found = agreesWith(squarefreeFormula, 'n', squareful, bound)
    expect(found.agrees).toBe(false)
    expect(found.firstDisagreement).not.toBeNull()
  })
})

describe('exam26a and exam26bA’s formula questions', () => {
  const bound = 40

  it('expresses "n is a power of 2" — exam26a Q4.3', () => {
    // Every prime dividing n is 2.
    const formula = forall('p', implies(and(prime(v('p')), divides(v('p'), v('n'))), eq(v('p'), num(2))))
    const powerOfTwo = (n: number): boolean => {
      if (n === 0) return false
      let rest = n
      while (rest % 2 === 0) rest /= 2
      return rest === 1
    }
    // The formula is also true of 1 and of 0 — 1 has no prime divisor, and in
    // ℕ every prime divides 0, so the guard has to say which is meant.
    const asWritten = (n: number): boolean => (n === 0 ? false : powerOfTwo(n) || n === 1)
    expect(agreesWith(and(formula, not(eq(v('n'), num(0)))), 'n', asWritten, bound).agrees).toBe(
      true,
    )
  })

  it('expresses "divisible by two different primes" — exam26bA Q4.3', () => {
    const formula = exists(
      'p',
      exists(
        'q',
        and(
          and(prime(v('p')), prime(v('q'))),
          and(not(eq(v('p'), v('q'))), and(divides(v('p'), v('n')), divides(v('q'), v('n')))),
        ),
      ),
    )
    const twoPrimes = (n: number): boolean => {
      if (n === 0) return true
      const primes = new Set<number>()
      let rest = n
      for (let p = 2; p <= rest; p++) {
        while (rest % p === 0) {
          primes.add(p)
          rest /= p
        }
      }
      return primes.size >= 2
    }
    expect(agreesWith(formula, 'n', twoPrimes, bound).agrees).toBe(true)
  })

  it('shows what the bound cannot do', () => {
    // "There are infinitely many primes" — true, and a bounded search cannot
    // confirm it: the ∃ is searched over the same range as the ∀, so the last
    // few x have no prime left above them and the whole formula reads false.
    // This is the limitation the guide states rather than a bug to fix.
    const formula = forall('x', exists('p', and(le(v('x'), v('p')), prime(v('p')))))
    expect(holdsUpTo(formula, {}, 40)).toBe(false)

    // Give the ∃ room and it comes out true, which is the shape every use of
    // this evaluator in the games has: a fixed n, quantifiers with slack.
    expect(holdsUpTo(exists('p', and(le(num(30), v('p')), prime(v('p')))), {}, 40)).toBe(true)
  })

  it('prints a formula the way the notes write it', () => {
    const formula = forall('p', implies(and(prime(v('p')), divides(v('p'), v('n'))), eq(v('p'), num(2))))
    expect(showArithFormula(formula)).toBe('∀p:((prime(p) ∧ p|n) → p=2)')
  })
})
