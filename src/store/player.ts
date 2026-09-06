/**
 * The player: a face, a level, and a pile of experience.
 *
 * None of this changes what a question asks or how it is marked — it is the
 * layer that makes a study app feel like something you come back to. XP is
 * earned by answering, not by being right, so a bad round still moves the bar;
 * being right just moves it much further.
 *
 * The avatar comes from DiceBear's public HTTP API, which needs no key and no
 * account. What is stored here is only a style name and a seed string, so the
 * whole player fits in a few dozen bytes and the picture is reproducible from
 * it — the same seed always draws the same character.
 *
 * Storage is localStorage, wrapped the same way progress is: a private window
 * or blocked site data degrades to in-memory rather than crashing.
 */

import { useSyncExternalStore } from 'react'
import type { Difficulty } from '@/engine/types'

const STORAGE_KEY = 'comp-logics-game/player/v1'

// ---------------------------------------------------------------------------
// The avatar
// ---------------------------------------------------------------------------

/**
 * DiceBear styles that read as *a character* at 64px.
 *
 * Deliberately not the whole catalogue: the geometric and initials styles look
 * like placeholders next to these, and rolling one would feel like a dud.
 */
export const AVATAR_STYLES = [
  'adventurer',
  'avataaars',
  'big-smile',
  'bottts',
  'fun-emoji',
  'lorelei',
  'micah',
  'miniavs',
  'notionists',
  'open-peeps',
  'personas',
  'pixel-art',
] as const

export type AvatarStyle = (typeof AVATAR_STYLES)[number]

/**
 * The styles everyone starts with.
 *
 * The rest are bought with coins earned in a party run. Four is enough that
 * rerolling is worth doing on day one, and few enough that there is something
 * to spend on.
 */
export const FREE_STYLES: readonly AvatarStyle[] = AVATAR_STYLES.slice(0, 4)

/**
 * What a locked style costs.
 *
 * A ladder rather than a flat price, so the first purchase lands inside the
 * first good run and the last one is something to work towards.
 */
export function priceOf(style: AvatarStyle): number {
  const index = AVATAR_STYLES.indexOf(style)
  if (index < FREE_STYLES.length) return 0
  return 100 + 25 * (index - FREE_STYLES.length)
}

const isAvatarStyle = (value: unknown): value is AvatarStyle =>
  typeof value === 'string' && (AVATAR_STYLES as readonly string[]).includes(value)

/** Board colours, so a rolled avatar still belongs on this board. */
const AVATAR_BACKGROUNDS = ['fccf00', '009bd9', '44af35', 'e62310', '7b4bc9']

/**
 * The picture for a character, as a URL.
 *
 * Built rather than fetched: DiceBear renders from the query string, so there
 * is no request to make until the browser loads the `<img>`, and no state to
 * keep in sync with the one saved seed.
 */
export function avatarUrl(style: AvatarStyle, seed: string, size = 128): string {
  const query = new URLSearchParams({
    seed,
    size: String(size),
    radius: '50',
    backgroundColor: AVATAR_BACKGROUNDS.join(','),
    backgroundType: 'gradientLinear,solid',
  })
  return `https://api.dicebear.com/9.x/${style}/svg?${query.toString()}`
}

/** A fresh random character. Called once, the first time anyone plays. */
export function rollAvatar(
  from: readonly AvatarStyle[] = AVATAR_STYLES,
): { style: AvatarStyle; seed: string } {
  // An empty pool would roll `undefined`; that can only happen through a
  // corrupted save, and a free style is a better answer than a crash.
  const pool = from.length > 0 ? from : FREE_STYLES
  const style = pool[Math.floor(Math.random() * pool.length)] as AvatarStyle
  const seed = Math.random().toString(36).slice(2, 10)
  return { style, seed }
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

/**
 * XP to get from level L to L+1: 100, 150, 200, 250, …
 *
 * Linear steps rather than exponential ones. An exponential curve would mean
 * the twentieth level takes a term's worth of revision to reach, and a level
 * nobody sees is a level that does nothing.
 */
export const xpToNextLevel = (level: number): number => 100 + 50 * (level - 1)

/** Total XP needed to *be* this level: 25(L−1)(L+2), the sum of the steps. */
export const xpForLevel = (level: number): number => 25 * (level - 1) * (level + 2)

/** The inverse of `xpForLevel`, in closed form rather than by counting up. */
export function levelFromXp(xp: number): number {
  if (xp <= 0) return 1
  return Math.floor((-1 + Math.sqrt(9 + (4 * xp) / 25)) / 2)
}

/**
 * Rank titles, one per five levels.
 *
 * They mean nothing, which is the point — they are there so a level-up says
 * something other than a bigger number.
 */
export const TITLES = [
  'Truth Table Tourist',
  'Junior Satisfier',
  'Clause Wrangler',
  'Resolution Cadet',
  'Unit Propagator',
  'Refutation Artist',
  'DPLL Veteran',
  'Conflict Analyst',
  'Certificate Auditor',
  'Grand Saturator',
] as const

export const titleForLevel = (level: number): string =>
  TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 5))] as string

export interface LevelStanding {
  level: number
  title: string
  /** XP earned since reaching this level. */
  into: number
  /** XP this level costs in total. */
  needed: number
  /** `into / needed`, in [0, 1]. */
  fraction: number
}

export function levelStanding(xp: number): LevelStanding {
  const level = levelFromXp(xp)
  const needed = xpToNextLevel(level)
  const into = Math.max(0, xp - xpForLevel(level))
  return { level, title: titleForLevel(level), into, needed, fraction: needed === 0 ? 0 : into / needed }
}

// ---------------------------------------------------------------------------
// Earning it
// ---------------------------------------------------------------------------

/** Harder questions are worth more, because they take longer to answer. */
const DIFFICULTY_XP: Record<Difficulty, number> = { easy: 10, medium: 15, hard: 22 }

/** Answering at all is worth something. Guessing is worth only this. */
export const XP_FOR_TRYING = 2

/** Each combo step past the first adds this, up to `MAX_COMBO_XP`. */
const COMBO_XP = 2
const MAX_COMBO_XP = 20

export interface XpContext {
  difficulty: Difficulty
  /** Partial credit in [0, 1] — the same number progress records. */
  score: number
  /** Consecutive correct answers *including* this one. */
  combo: number
}

/**
 * What one answer is worth.
 *
 * Scaled by partial credit rather than gated on `correct`, so a half-right
 * answer to a hard question beats a lucky easy one — which is the ordering the
 * rest of the app already uses.
 */
export function xpForAnswer({ difficulty, score, combo }: XpContext): number {
  const base = Math.round(DIFFICULTY_XP[difficulty] * Math.max(0, Math.min(1, score)))
  const bonus = score >= 1 ? Math.min(MAX_COMBO_XP, Math.max(0, combo - 1) * COMBO_XP) : 0
  return Math.max(XP_FOR_TRYING, base + bonus)
}

// ---------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------

export interface PlayerState {
  version: 2
  xp: number
  /** Spendable balance, earned in party runs. */
  coins: number
  /** Avatar styles unlocked, free ones included. */
  owned: AvatarStyle[]
  style: AvatarStyle
  seed: string
  name: string
}

export const emptyPlayer = (): PlayerState => ({
  version: 2,
  xp: 0,
  coins: 0,
  owned: [...FREE_STYLES],
  ...rollAvatar([...FREE_STYLES]),
  name: '',
})

function readStorage(): PlayerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyPlayer()
    const parsed = JSON.parse(raw) as Partial<PlayerState>
    if (typeof parsed !== 'object' || parsed === null) return emptyPlayer()
    const rolled = rollAvatar([...FREE_STYLES])
    const style = isAvatarStyle(parsed.style) ? parsed.style : rolled.style
    // Version 1 had every style free. Whatever someone is already wearing
    // stays theirs — an update must never confiscate a character.
    const owned = new Set<AvatarStyle>([...FREE_STYLES, style])
    if (Array.isArray(parsed.owned)) {
      for (const entry of parsed.owned) if (isAvatarStyle(entry)) owned.add(entry)
    }
    return {
      version: 2,
      xp: typeof parsed.xp === 'number' && Number.isFinite(parsed.xp) ? Math.max(0, parsed.xp) : 0,
      coins:
        typeof parsed.coins === 'number' && Number.isFinite(parsed.coins)
          ? Math.max(0, Math.round(parsed.coins))
          : 0,
      owned: [...owned],
      style,
      seed: typeof parsed.seed === 'string' && parsed.seed !== '' ? parsed.seed : rolled.seed,
      name: typeof parsed.name === 'string' ? parsed.name.slice(0, 24) : '',
    }
  } catch {
    return emptyPlayer()
  }
}

let state: PlayerState = readStorage()
const listeners = new Set<() => void>()

/**
 * Write the first roll straight back.
 *
 * Without this the character is re-rolled on every load until the first answer
 * happens to save one, so the face you were shown on the home screen is not the
 * face you get — which reads as a bug even though nothing is lost.
 */
function persistFirstRoll(): void {
  try {
    if (localStorage.getItem(STORAGE_KEY) === null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }
  } catch {
    // Storage blocked: the character lasts as long as the tab, and that is all
    // this environment can offer.
  }
}

persistFirstRoll()

function commit(next: PlayerState): void {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked or full — carry on in memory.
  }
  for (const listener of listeners) listener()
}

export const getPlayer = (): PlayerState => state

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export interface XpAward {
  gained: number
  xp: number
  level: number
  /** True when this award crossed a level boundary — worth a noise. */
  leveledUp: boolean
}

export function awardXp(gained: number): XpAward {
  const before = levelFromXp(state.xp)
  const xp = state.xp + Math.max(0, Math.round(gained))
  const level = levelFromXp(xp)
  commit({ ...state, xp })
  return { gained, xp, level, leveledUp: level > before }
}

/** A different character, same level. Rolls only styles you own. */
export function reroll(): void {
  commit({ ...state, ...rollAvatar(state.owned) })
}

/** Keep the face, change the art style — or the other way round. */
export function setStyle(style: AvatarStyle): void {
  if (!state.owned.includes(style)) return
  commit({ ...state, style })
}

// ---------------------------------------------------------------------------
// Coins
// ---------------------------------------------------------------------------

/** Bank what a party run paid out. */
export function earnCoins(amount: number): number {
  const coins = state.coins + Math.max(0, Math.round(amount))
  commit({ ...state, coins })
  return coins
}

export const owns = (style: AvatarStyle): boolean => state.owned.includes(style)

/**
 * Buy a style, if it is affordable and not already owned.
 *
 * Returns whether anything changed, so the caller can shake the button rather
 * than silently doing nothing.
 */
export function buyStyle(style: AvatarStyle): boolean {
  if (state.owned.includes(style)) return false
  const price = priceOf(style)
  if (state.coins < price) return false
  commit({
    ...state,
    coins: state.coins - price,
    owned: [...state.owned, style],
    style,
  })
  return true
}

export function setName(name: string): void {
  commit({ ...state, name: name.slice(0, 24) })
}

export function resetPlayer(): void {
  commit(emptyPlayer())
}

/** Overwrite everything — for restoring a backup. */
export function replacePlayer(next: PlayerState): void {
  const style = isAvatarStyle(next.style) ? next.style : state.style
  const owned = new Set<AvatarStyle>([...FREE_STYLES, style])
  for (const entry of next.owned ?? []) if (isAvatarStyle(entry)) owned.add(entry)
  commit({
    version: 2,
    xp: Math.max(0, Math.round(next.xp)),
    coins: Math.max(0, Math.round(next.coins ?? 0)),
    owned: [...owned],
    style,
    seed: next.seed === '' ? state.seed : next.seed,
    name: next.name.slice(0, 24),
  })
}

export function usePlayer(): PlayerState {
  return useSyncExternalStore(subscribe, getPlayer, getPlayer)
}
