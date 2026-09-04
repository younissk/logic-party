/** Shared UI atoms, in the party-board style. See index.css for the vocabulary. */

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'coin' | 'secondary' | 'ghost' | 'danger'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'chunky bg-space-blue text-white hover:brightness-110',
  coin: 'chunky bg-coin text-ink hover:brightness-105',
  secondary: 'chunky bg-card text-ink hover:bg-card-shade',
  danger: 'chunky bg-space-red text-white hover:brightness-110',
  // The one control without an outline — for actions that should not compete.
  ghost: 'rounded-full bg-white/25 text-ink hover:bg-white/45',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 items-center justify-center gap-2 px-6 text-base font-semibold
        disabled:cursor-not-allowed
        focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-coin
        ${BUTTON_STYLES[variant]} ${className}`}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  // `.tile` carries no background, so supply the default cream unless the
  // caller asked for a colour of its own.
  const hasOwnBackground = /(^|\s)bg-/.test(className)
  return (
    <div className={`tile p-4 ${hasOwnBackground ? '' : 'bg-card'} ${className}`}>{children}</div>
  )
}

/**
 * A truth value as a board space: blue for true, red for false — the two
 * space colours every board in the genre is built from.
 */
export function SpaceToken({ value, className = '' }: { value: boolean; className?: string }) {
  return (
    <span
      className={`space inline-flex h-8 w-8 items-center justify-center text-sm font-bold text-white ${
        value ? 'bg-space-blue' : 'bg-space-red'
      } ${className}`}
    >
      {value ? 'T' : 'F'}
    </span>
  )
}

/** Round progress marker. Earned stars fill in gold. */
export function Star({ earned, className = '' }: { earned: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`h-6 w-6 ${className}`}
      fill={earned ? 'var(--color-coin)' : 'rgba(255,255,255,0.5)'}
      stroke="var(--color-ink)"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45L2.6 9.45l6.5-.95z" />
    </svg>
  )
}

/** The banner that shouts the result of a question. */
export function Banner({
  tone,
  children,
  className = '',
}: {
  tone: 'good' | 'bad'
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`tile pop-in p-4 ${tone === 'good' ? 'bg-grass' : 'bg-space-red'} ${className}`}
    >
      {children}
    </div>
  )
}
