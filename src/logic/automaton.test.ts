import { describe, expect, it } from 'vitest'
import {
  ADDITION_AUTOMATON,
  EQUALITY_AUTOMATON,
  INTEGER_LITERAL,
  accepts,
  acceptedWords,
  acceptsString,
  chunk,
  fromReversedBinary,
  isDeterministic,
  toReversedBinary,
  trace,
  tripleOf,
  tripleWord,
  type Automaton,
} from './automaton'

describe('the integer-literal automaton', () => {
  it('accepts the words the notes say it accepts', () => {
    for (const word of ['-5014', '107', '+13', '0', '-0']) {
      expect([word, acceptsString(INTEGER_LITERAL, word)]).toEqual([word, true])
    }
  })

  it('rejects the words the notes say it rejects', () => {
    for (const word of ['7+3', '1/3', '007', '', '+']) {
      expect([word, acceptsString(INTEGER_LITERAL, word)]).toEqual([word, false])
    }
  })

  it('is deterministic', () => {
    expect(isDeterministic(INTEGER_LITERAL)).toBe(true)
  })

  it('traces a run state by state', () => {
    const steps = trace(INTEGER_LITERAL, [...'-50'])
    expect(steps.map((step) => step.states)).toEqual([['a'], ['b'], ['c'], ['c']])
  })

  it('dies on a letter with no edge, and stays dead', () => {
    expect(accepts(INTEGER_LITERAL, [...'1/3'])).toBe(false)
    expect(trace(INTEGER_LITERAL, [...'1/3']).at(-1)?.states).toEqual([])
  })
})

describe('binary, least significant bit first', () => {
  it('reads the notes’ own examples', () => {
    expect(fromReversedBinary('011001')).toBe(38)
    expect(fromReversedBinary('001')).toBe(4)
    for (const word of ['1', '10', '100000000']) {
      expect([word, fromReversedBinary(word)]).toEqual([word, 1])
    }
  })

  it('round-trips', () => {
    for (let value = 0; value < 40; value++) {
      expect(fromReversedBinary(toReversedBinary(value, 8))).toBe(value)
    }
  })
})

describe('the equality automaton', () => {
  it('accepts exactly the pairs of equal numbers', () => {
    for (const [left, right] of [
      [5, 5],
      [0, 0],
      [12, 12],
      [3, 4],
      [1, 0],
    ] as [number, number][]) {
      const word = Array.from({ length: 5 }, (_, index) => {
        const one = toReversedBinary(left, 5)[index] as string
        const two = toReversedBinary(right, 5)[index] as string
        return `${one}${two}`
      })
      expect([left, right, accepts(EQUALITY_AUTOMATON, word)]).toEqual([
        left,
        right,
        left === right,
      ])
    }
  })
})

describe('the addition automaton', () => {
  it('accepts a triple exactly when the third is the sum of the first two', () => {
    for (let a = 0; a < 8; a++) {
      for (let b = 0; b < 8; b++) {
        for (const c of [a + b, a + b + 1]) {
          if (c > 15) continue
          const word = chunk(tripleWord(a, b, c, 5), 3)
          expect([a, b, c, accepts(ADDITION_AUTOMATON, word)]).toEqual([a, b, c, a + b === c])
        }
      }
    }
  })

  it('carries, and clears the carry', () => {
    // 1 + 1 = 2: the first letter is 110 (carry), the second 001 (clears it).
    const word = chunk(tripleWord(1, 1, 2, 3), 3)
    expect(word[0]).toBe('110')
    expect(word[1]).toBe('001')
    expect(accepts(ADDITION_AUTOMATON, word)).toBe(true)
  })

  it('reads a word back as the three numbers it encodes', () => {
    expect(tripleOf(tripleWord(6, 9, 15, 5))).toEqual([6, 9, 15])
  })

  it('does not accept while a carry is still outstanding', () => {
    // 1 + 1 = 0 over one bit: ends in the carry state, which is not accepting.
    expect(accepts(ADDITION_AUTOMATON, ['110'])).toBe(false)
  })
})

describe('acceptedWords', () => {
  it('lists the shortest words an automaton takes', () => {
    // Exercise 11's shape: an automaton over {a, b, c}.
    const machine: Automaton = {
      states: ['s0', 's1', 's2'],
      alphabet: ['a', 'b', 'c'],
      initial: 's0',
      accepting: ['s2'],
      transitions: [
        { from: 's0', to: 's1', letters: ['a'] },
        { from: 's1', to: 's1', letters: ['c'] },
        { from: 's1', to: 's2', letters: ['a'] },
      ],
    }
    expect(acceptsString(machine, 'aa')).toBe(true)
    expect(acceptsString(machine, 'aca')).toBe(true)
    expect(acceptsString(machine, 'acca')).toBe(true)
    expect(acceptsString(machine, 'abc')).toBe(false)
    expect(acceptsString(machine, 'bca')).toBe(false)
    expect(acceptedWords(machine, 3)).toContain('aa')
  })

  it('handles a nondeterministic machine', () => {
    const machine: Automaton = {
      states: ['s0', 's1', 's2'],
      alphabet: ['a', 'b'],
      initial: 's0',
      accepting: ['s2'],
      transitions: [
        { from: 's0', to: 's1', letters: ['a'] },
        { from: 's0', to: 's2', letters: ['a'] },
        { from: 's1', to: 's2', letters: ['b'] },
      ],
    }
    expect(isDeterministic(machine)).toBe(false)
    expect(acceptsString(machine, 'a')).toBe(true)
    expect(acceptsString(machine, 'ab')).toBe(true)
    expect(acceptsString(machine, 'b')).toBe(false)
  })
})
