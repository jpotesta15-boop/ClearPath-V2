'use client'

import Link from 'next/link'

export interface NavProps {
  /** Optional class for the nav container */
  className?: string
  /** Client portal: show this name and avatar (initials) in the header */
  userDisplayName?: string | null
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2)
  }
  return name.slice(0, 2).toUpperCase()
}

export function Nav({ className, userDisplayName }: NavProps) {
  return (
    <header
      className={className}
      role="banner"
    >
      <nav className="flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-white px-4">
        <Link
          href="/"
          className="text-[var(--color-ink)] font-medium focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:outline-none rounded-lg"
        >
          ClearPath
        </Link>
        <div className="flex items-center gap-2">
          {userDisplayName ? (
            <span className="flex items-center gap-2 text-[15px] text-[var(--color-text-primary)]">
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] flex min-h-[36px] min-w-[36px] items-center justify-center text-sm font-medium text-[var(--color-ink)]">
                {initials(userDisplayName)}
              </span>
              <span className="hidden sm:inline truncate max-w-[120px]">{userDisplayName}</span>
            </span>
          ) : (
            <>
              <button
                type="button"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:outline-none"
                aria-label="Notifications"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </button>
              <button
                type="button"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:outline-none"
                aria-label="User menu"
              >
                <span className="text-sm font-medium" aria-hidden>U</span>
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
