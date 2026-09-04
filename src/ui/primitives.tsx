/** Shared UI atoms. Deliberately few — minigames should look like each other. */

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { Formula } from '@/logic'
import { format } from '@/logic'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-500 text-white hover:bg-indigo-400 active:bg-indigo-600',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-slate-900',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800/60',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold
        transition-colors disabled:cursor-not-allowed disabled:opacity-40
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400
        ${BUTTON_STYLES[variant]} ${className}`}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-4 ${className}`}>
      {children}
    </div>
  )
}

/** A formula, rendered in the serif face used everywhere in the app. */
export function FormulaText({
  formula,
  className = '',
}: {
  formula: Formula
  className?: string
}) {
  return <span className={`formula ${className}`}>{format(formula)}</span>
}

export function TruthPill({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${
        value ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
      }`}
    >
      {value ? 'T' : 'F'}
    </span>
  )
}
