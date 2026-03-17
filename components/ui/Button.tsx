'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ghost-link' | 'destructive' | 'destructive-secondary'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-accent)] text-white shadow-sm hover:bg-[var(--color-accent-hover)] focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 active:bg-[var(--color-accent-hover)] disabled:pointer-events-none disabled:opacity-50',
  secondary:
    'border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] hover:border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 active:bg-[var(--color-surface)] disabled:pointer-events-none disabled:opacity-50',
  ghost:
    'text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/50 focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 active:bg-[var(--color-border)]/70 disabled:pointer-events-none disabled:opacity-50',
  'ghost-link':
    'text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  destructive:
    'bg-[var(--color-error)] text-white shadow-sm hover:bg-[#A04844] focus:ring-2 focus:ring-[var(--color-error)] focus:ring-offset-2 active:bg-[#A04844] disabled:pointer-events-none disabled:opacity-50',
  'destructive-secondary':
    'border border-[var(--color-error)] bg-transparent text-[var(--color-error)] hover:bg-[var(--color-error-light)] focus:ring-2 focus:ring-[var(--color-error)] focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  fullWidth?: boolean
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      fullWidth,
      asChild,
      type = 'button',
      children,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center h-10 min-h-10 rounded-lg px-4 text-sm font-medium transition-colors focus:outline-none'
    const gap = 'gap-2'

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          base,
          gap,
          variantClasses[variant],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
