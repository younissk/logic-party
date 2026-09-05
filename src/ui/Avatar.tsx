/**
 * The player's character.
 *
 * Drawn by DiceBear's public API from a style and a seed, so the whole picture
 * travels as two short strings. The network can always fail — offline, blocked,
 * the service down — so a failed load falls back to a coin-coloured initial
 * rather than a broken-image icon.
 */

import { useEffect, useState } from 'react'
import { avatarUrl, type AvatarStyle } from '@/store/player'

export interface AvatarProps {
  style: AvatarStyle
  seed: string
  /** Rendered size in pixels. */
  size?: number
  /** A name, for the fallback initial and the alt text. */
  name?: string
  className?: string
}

export function Avatar({ style, seed, size = 64, name = '', className = '' }: AvatarProps) {
  const [failed, setFailed] = useState(false)

  // A new character is a new request, and a new chance to succeed.
  useEffect(() => {
    setFailed(false)
  }, [style, seed])

  const label = name === '' ? 'Your character' : name
  const box = `${size}px`

  if (failed) {
    return (
      <span
        role="img"
        aria-label={label}
        className={`space inline-flex shrink-0 items-center justify-center bg-coin text-ink ${className}`}
        style={{ width: box, height: box, fontSize: `${Math.round(size * 0.45)}px` }}
      >
        <span className="font-bold">{name === '' ? '★' : name.slice(0, 1).toUpperCase()}</span>
      </span>
    )
  }

  return (
    <img
      src={avatarUrl(style, seed, size * 2)}
      alt={label}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`space shrink-0 bg-card object-cover ${className}`}
      style={{ width: box, height: box }}
    />
  )
}

/** Avatar, level ring and title — the block that shows up on the home screen. */
export function LevelBar({
  level,
  title,
  into,
  needed,
  fraction,
  className = '',
}: {
  level: number
  title: string
  into: number
  needed: number
  fraction: number
  className?: string
}) {
  return (
    <div className={`min-w-0 flex-1 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-base font-bold">Level {level}</p>
        <p className="shrink-0 text-xs font-bold tabular-nums text-ink-soft">
          {into} / {needed} XP
        </p>
      </div>
      <div className="mt-1 h-3.5 overflow-hidden rounded-full border-3 border-ink bg-card">
        <div
          className="h-full bg-grass transition-[width] duration-500"
          style={{ width: `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%` }}
        />
      </div>
      <p className="mt-1 truncate text-xs font-bold uppercase tracking-wider text-ink-soft">
        {title}
      </p>
    </div>
  )
}
