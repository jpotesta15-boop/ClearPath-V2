'use client'

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const inputBase =
  'w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-[15px] font-normal text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0 focus:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60'

const inputError =
  'border-2 border-[var(--color-error)] bg-[var(--color-error-light)] focus:ring-[var(--color-error)]'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  errorMessage?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, errorMessage, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            inputBase,
            'h-10',
            error && inputError,
            className
          )}
          {...props}
        />
        {error && errorMessage && (
          <p className="mt-1 text-[13px] text-[var(--color-error)]">
            {errorMessage}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
  errorMessage?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, errorMessage, ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          className={cn(
            inputBase,
            'min-h-[80px] resize-y',
            error && inputError,
            className
          )}
          {...props}
        />
        {error && errorMessage && (
          <p className="mt-1 text-[13px] text-[var(--color-error)]">
            {errorMessage}
          </p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export { Input, Textarea }
