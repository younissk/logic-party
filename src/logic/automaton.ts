/**
 * Finite automata — ln.pdf §5.2.
 *
 * The chapter uses them twice. As the running example of what a recogniser is
 * (the integer-literal automaton), and as the reason T(ℕ,=,+) is decidable:
 * equality and addition of binary-encoded naturals are both recognisable, and
 * Presburger's theorem builds an automaton for any formula out of those.
 *
 * Nondeterministic by default — a state may have several edges on one letter,
 * or none — because the exercises draw automata that way and the acceptance
 * question is the same either way: is there *a* walk ending in an accepting
 * state?
 */

export interface Transition {
  from: string
  to: string
  /** Letters this edge accepts. Several per edge, as the notes draw them. */
  letters: string[]
}

export interface Automaton {
  states: string[]
  alphabet: string[]
  initial: string
  accepting: string[]
  transitions: Transition[]
}

/** Where the automaton can be after reading the word, from the initial state. */
export function reachableStates(automaton: Automaton, word: readonly string[]): string[] {
  let current = [automaton.initial]
  for (const letter of word) {
    const next = new Set<string>()
    for (const state of current) {
      for (const edge of automaton.transitions) {
        if (edge.from !== state) continue
        if (!edge.letters.includes(letter)) continue
        next.add(edge.to)
      }
    }
    current = [...next]
    if (current.length === 0) break
  }
  return current
}

/** Every prefix's reachable set, so a run can be shown letter by letter. */
export function trace(
  automaton: Automaton,
  word: readonly string[],
): { letter: string | null; states: string[] }[] {
  const steps: { letter: string | null; states: string[] }[] = [
    { letter: null, states: [automaton.initial] },
  ]
  for (let index = 0; index < word.length; index++) {
    steps.push({
      letter: word[index] as string,
      states: reachableStates(automaton, word.slice(0, index + 1)),
    })
  }
  return steps
}

export const accepts = (automaton: Automaton, word: readonly string[]): boolean =>
  reachableStates(automaton, word).some((state) => automaton.accepting.includes(state))

/** A word written as a string of single-letter symbols. */
export const acceptsString = (automaton: Automaton, word: string): boolean =>
  accepts(automaton, [...word])

/**
 * Split a word into letters of a fixed width.
 *
 * The automata over tuples of bits have three-character letters, so "reading
 * the next letter" is not "reading the next character" for them.
 */
export const chunk = (word: string, size: number): string[] => {
  const letters: string[] = []
  for (let index = 0; index < word.length; index += size) {
    letters.push(word.slice(index, index + size))
  }
  return letters
}

/** Is there exactly one edge per state and letter? */
export const isDeterministic = (automaton: Automaton): boolean =>
  automaton.states.every((state) =>
    automaton.alphabet.every(
      (letter) =>
        automaton.transitions.filter(
          (edge) => edge.from === state && edge.letters.includes(letter),
        ).length <= 1,
    ),
  )

/** Every word over the alphabet up to a length, shortest first. */
export function* words(alphabet: readonly string[], maxLength: number): Generator<string> {
  const queue: string[] = ['']
  while (queue.length > 0) {
    const word = queue.shift() as string
    yield word
    if (word.length >= maxLength) continue
    for (const letter of alphabet) queue.push(word + letter)
  }
}

/** The shortest accepted words, for describing what an automaton recognises. */
export function acceptedWords(automaton: Automaton, maxLength: number, limit = 8): string[] {
  const found: string[] = []
  for (const word of words(automaton.alphabet, maxLength)) {
    if (found.length >= limit) break
    if (acceptsString(automaton, word)) found.push(word)
  }
  return found
}

// ---------------------------------------------------------------------------
// The automata the chapter draws
// ---------------------------------------------------------------------------

/**
 * The integer-literal automaton of §5.2.
 *
 * Accepts an optional sign, then either a single 0 or a non-zero digit followed
 * by any digits. Accepts -5014, 107, +13; rejects 7+3, 1/3 and 007.
 */
export const INTEGER_LITERAL: Automaton = {
  states: ['a', 'b', 'c', 'd'],
  alphabet: ['+', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  initial: 'a',
  accepting: ['c', 'd'],
  transitions: [
    { from: 'a', to: 'b', letters: ['+', '-'] },
    { from: 'a', to: 'd', letters: ['0'] },
    { from: 'a', to: 'c', letters: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
    { from: 'b', to: 'd', letters: ['0'] },
    { from: 'b', to: 'c', letters: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
    {
      from: 'c',
      to: 'c',
      letters: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    },
  ],
}

/**
 * Binary, least significant bit first — the encoding §5.2 uses.
 *
 * `011001` is 38, and `1`, `10` and `100000000` all denote 1, because trailing
 * zeros are leading zeros once the word is read backwards.
 */
export const fromReversedBinary = (word: string): number =>
  [...word].reduce((total, bit, index) => total + (bit === '1' ? 2 ** index : 0), 0)

export const toReversedBinary = (value: number, length: number): string => {
  let bits = ''
  let rest = value
  for (let index = 0; index < length; index++) {
    bits += String(rest % 2)
    rest = Math.floor(rest / 2)
  }
  return bits
}

/**
 * The equality automaton: one state, accepting, looping on the two agreeing
 * letter pairs. It accepts exactly the words encoding a pair of equal numbers.
 */
export const EQUALITY_AUTOMATON: Automaton = {
  states: ['a'],
  alphabet: ['00', '11'],
  initial: 'a',
  accepting: ['a'],
  transitions: [{ from: 'a', to: 'a', letters: ['00', '11'] }],
}

/**
 * The addition automaton of §5.2, over triples of bits.
 *
 * State `a` is "no carry", state `b` is "carry". A letter is the three bits of
 * the two summands and the sum, least significant first.
 */
export const ADDITION_AUTOMATON: Automaton = {
  states: ['a', 'b'],
  alphabet: ['000', '011', '101', '110', '001', '010', '100', '111'],
  initial: 'a',
  accepting: ['a'],
  transitions: [
    { from: 'a', to: 'a', letters: ['000', '011', '101'] },
    { from: 'a', to: 'b', letters: ['110'] },
    { from: 'b', to: 'b', letters: ['010', '100', '111'] },
    { from: 'b', to: 'a', letters: ['001'] },
  ],
}

/**
 * Read a triple-of-bits word back as the three numbers it encodes.
 *
 * The word is a run of three-character letters, so it has to be chunked before
 * a "column" can be picked out — reading it character by character mixes the
 * three numbers together.
 */
export function tripleOf(word: string): [number, number, number] {
  const letters = chunk(word, 3)
  const column = (index: number) =>
    fromReversedBinary(letters.map((letter) => letter[index] as string).join(''))
  return [column(0), column(1), column(2)]
}

/** Write three numbers as a word of bit triples, least significant first. */
export function tripleWord(a: number, b: number, c: number, length: number): string {
  const one = toReversedBinary(a, length)
  const two = toReversedBinary(b, length)
  const three = toReversedBinary(c, length)
  return Array.from({ length }, (_, index) => `${one[index]}${two[index]}${three[index]}`).join('')
}
