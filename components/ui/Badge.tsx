'use client'

import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type BadgeVariant = 'active' | 'inactive' | 'pending' | 'error'

const variantClasses: Record<BadgeVariant, string> = {
  active:
    'bg-[var(--color-success-light)] text-[var(--color-success)]',
  inactive:
    'bg-[var(--color-border)]/80 text-[var(--color-text-secondary)]',
  pending:
    'bg-[var(--color-warning-light)] text-[var(--color-warning)]',
  error:
    'bg-[var(--color-error-light)] text-[var(--color-error)]',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

function Badge({ className, variant = 'inactive', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-medium',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
