/**
 * Seeded RNG.
 *
 * Every question in the app is generated from a seed, so a round is
 * reproducible: same seed -> same questions. That makes bugs reportable
 * ("seed abc123 round 4 marked me wrong") and lets a party match deal the
 * same minigame to every player.
 */

export interface Rng {
  readonly seed: string
  /** Uniform in [0, 1). */
  next(): number
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number
  /** Uniform integer in [min, max], both inclusive. */
  range(min: number, max: number): number
  bool(probabilityTrue?: number): boolean
  pick<T>(items: readonly T[]): T
  /** Returns a new shuffled array; does not mutate the input. */
  shuffle<T>(items: readonly T[]): T[]
  /** `count` distinct items, or all of them if count exceeds the pool. */
  sample<T>(items: readonly T[], count: number): T[]
}

function hashSeed(seed: string): number {
  // FNV-1a, then a scramble so short seeds ("1", "2") do not start correlated.
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  return h >>> 0
}

export function makeRng(seed: string): Rng {
  let state = hashSeed(seed)

  // mulberry32
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (maxExclusive: number): number => {
    if (maxExclusive <= 0) throw new RangeError(`int() needs a positive bound, got ${maxExclusive}`)
    return Math.floor(next() * maxExclusive)
  }

  const pick = <T,>(items: readonly T[]): T => {
    if (items.length === 0) throw new RangeError('pick() from an empty array')
    return items[int(items.length)] as T
  }

  const shuffle = <T,>(items: readonly T[]): T[] => {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1)
      const a = out[i] as T
      const b = out[j] as T
      out[i] = b
      out[j] = a
    }
    return out
  }

  return {
    seed,
    next,
    int,
    range: (min, max) => min + int(max - min + 1),
    bool: (p = 0.5) => next() < p,
    pick,
    shuffle,
    sample: (items, count) => shuffle(items).slice(0, Math.max(0, count)),
  }
}

const SEED_ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789'

/** Short, human-readable, no look-alike characters. */
export function randomSeed(length = 8): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)]
  }
  return out
}

/** Derive a stable child seed, so round 3 of seed "abc" is always the same. */
export function deriveSeed(seed: string, ...parts: (string | number)[]): string {
  return [seed, ...parts].join(':')
}
