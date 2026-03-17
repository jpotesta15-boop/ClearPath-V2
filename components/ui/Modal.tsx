'use client'

import { useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Called when the modal should close (e.g. backdrop click or close button) */
  onClose: () => void
  /** Title shown at the top of the modal */
  title: string
  /** Modal content */
  children: React.ReactNode
  /** Optional class for the card container */
  className?: string
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  const getFocusableElements = useCallback(() => {
    if (!cardRef.current) return []
    return Array.from(
      cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => !el.hasAttribute('disabled'))
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusable = getFocusableElements()
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (first) first.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const current = document.activeElement as HTMLElement
      if (e.shiftKey) {
        if (current === first && last) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (current === last && first) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [isOpen, onClose, getFocusableElements])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Overlay backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-[var(--color-ink)]/40"
        onClick={onClose}
        aria-label="Close modal"
        tabIndex={-1}
      />
      {/* Centered white card */}
      <div
        ref={cardRef}
        className={cn(
          'relative w-full max-w-md rounded-xl border border-[var(--color-border)] bg-white p-5',
          className
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id="modal-title"
            className="text-[var(--color-ink)] font-medium leading-tight"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 5L5 15M5 5l10 10" />
            </svg>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
