import Link from 'next/link'
import { type ReactNode } from 'react'
import { OnboardingProgress } from './OnboardingProgress'

/**
 * Onboarding layout: clean centered layout, no sidebar, no bottom nav.
 * Progress indicator: 4 steps as pills. Max width 560px, white background.
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="border-b border-[var(--color-border)] bg-white px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-[560px] items-center justify-between">
          <Link
            href="/onboarding"
            className="text-lg font-medium tracking-[var(--tracking-heading)] text-[var(--color-text-primary)]"
          >
            ClearPath
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[560px] px-4 py-8 md:px-6">
        <OnboardingProgress />
        <div className="mt-8">{children}</div>
      </main>
    </div>
  )
}
