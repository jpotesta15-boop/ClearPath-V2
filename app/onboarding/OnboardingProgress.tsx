'use client'

import { usePathname } from 'next/navigation'

/**
 * Progress indicator: 4 steps as pills. Active = filled, others = outlined.
 */
export function OnboardingProgress() {
  const pathname = usePathname()
  const step =
    pathname === '/onboarding'
      ? 1
      : pathname === '/onboarding/step-2'
        ? 2
        : pathname === '/onboarding/step-3'
          ? 3
          : pathname === '/onboarding/step-4'
            ? 4
            : 1

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Onboarding progress">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-2 w-10 rounded-full ${
            i === step
              ? 'bg-[var(--color-accent)]'
              : 'border border-[var(--color-border)] bg-white'
          }`}
          aria-current={i === step ? 'step' : undefined}
        />
      ))}
    </nav>
  )
}
