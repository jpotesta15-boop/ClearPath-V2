'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const COACHING_TYPES = [
  'Fitness',
  'Life',
  'Business',
  'Nutrition',
  'Mindset',
  'Performance',
  'Career',
  'Relationships',
  'Other',
] as const

export default function OnboardingStep2Page() {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [clientCount, setClientCount] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const toggle = (type: string) => {
    setSelected((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const countStr = clientCount.trim()
      const current_client_count =
        countStr === '' ? null : parseInt(countStr, 10)
      const res = await fetch('/api/onboarding/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coaching_types: selected,
          current_client_count:
            current_client_count !== null && !Number.isNaN(current_client_count) && current_client_count >= 0
              ? current_client_count
              : null,
        }),
      })
      if (!res.ok) {
        setSubmitting(false)
        return
      }
      router.push('/onboarding/step-3')
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-[var(--text-h3)] font-medium tracking-[var(--tracking-heading)] text-[var(--color-text-primary)]">
        What kind of coaching do you do?
      </h1>

      <div className="flex flex-wrap gap-2">
        {COACHING_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => toggle(type)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              selected.includes(type)
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                : 'border-[var(--color-border)] bg-white text-[var(--color-text-primary)] hover:border-[var(--color-accent)]'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="client-count" className="mb-1 block text-[15px] font-medium text-[var(--color-text-primary)]">
          How many clients do you currently have?
        </label>
        <Input
          id="client-count"
          type="number"
          min={0}
          placeholder="0"
          value={clientCount}
          onChange={(e) => setClientCount(e.target.value)}
          className="w-32"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Continue'}
        </Button>
        <Link
          href="/onboarding"
          className="text-[15px] font-medium text-[var(--color-accent)] hover:underline"
        >
          Back
        </Link>
      </div>
    </form>
  )
}
