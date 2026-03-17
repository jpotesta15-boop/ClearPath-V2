'use client'

import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type CardVariant = 'flat' | 'raised'

const variantClasses: Record<CardVariant, string> = {
  flat:
    'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]',
  raised:
    'rounded-lg border border-[var(--color-border)] bg-white shadow-[0_1px_3px_rgba(26,26,26,0.06)]',
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: 'default' | 'lg'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'flat', padding = 'default', ...props }, ref) => {
    const paddingClass = padding === 'lg' ? 'p-5' : 'p-4'
    return (
      <div
        ref={ref}
        className={cn(
          variantClasses[variant],
          paddingClass,
          'text-[var(--color-text-primary)]',
          className
        )}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

function CardTitle({ className, ...props }: CardTitleProps) {
  return (
    <h3
      className={cn(
        'text-[var(--text-h4)] font-medium leading-[var(--leading-heading)] tracking-[var(--tracking-heading)] text-[var(--color-text-primary)]',
        className
      )}
      {...props}
    />
  )
}

export { Card, CardTitle }
