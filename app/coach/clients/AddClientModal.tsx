'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { addClientSchema, type AddClientInput } from '@/lib/validations'

interface AddClientModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const defaultValues: AddClientInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  goals: '',
}

export function AddClientModal({ isOpen, onClose, onSuccess }: AddClientModalProps) {
  const [form, setForm] = useState<AddClientInput>(defaultValues)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AddClientInput, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (key: keyof AddClientInput, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
    setSubmitError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    const parsed = addClientSchema.safeParse(form)
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors as Record<keyof AddClientInput, string[] | undefined>
      const errors: Partial<Record<keyof AddClientInput, string>> = {}
      for (const k of Object.keys(flat) as (keyof AddClientInput)[]) {
        if (flat[k]?.[0]) errors[k] = flat[k][0]
      }
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setSubmitting(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Could not add client')
        return
      }
      setForm(defaultValues)
      setFieldErrors({})
      onSuccess()
    } catch {
      setSubmitError('Something went wrong — check your connection and try again')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!submitting) {
      setForm(defaultValues)
      setFieldErrors({})
      setSubmitError(null)
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add client">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="add-client-first-name" className="mb-1 block text-[13px] font-medium text-[var(--color-text-primary)]">
            First name *
          </label>
          <Input
            id="add-client-first-name"
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
            placeholder="First name"
            error={!!fieldErrors.firstName}
            errorMessage={fieldErrors.firstName}
            disabled={submitting}
            autoComplete="given-name"
            required
          />
        </div>
        <div>
          <label htmlFor="add-client-last-name" className="mb-1 block text-[13px] font-medium text-[var(--color-text-primary)]">
            Last name *
          </label>
          <Input
            id="add-client-last-name"
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value)}
            placeholder="Last name"
            error={!!fieldErrors.lastName}
            errorMessage={fieldErrors.lastName}
            disabled={submitting}
            autoComplete="family-name"
            required
          />
        </div>
        <div>
          <label htmlFor="add-client-email" className="mb-1 block text-[13px] font-medium text-[var(--color-text-primary)]">
            Email *
          </label>
          <Input
            id="add-client-email"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="email@example.com"
            error={!!fieldErrors.email}
            errorMessage={fieldErrors.email}
            disabled={submitting}
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label htmlFor="add-client-phone" className="mb-1 block text-[13px] font-medium text-[var(--color-text-primary)]">
            Phone
          </label>
          <Input
            id="add-client-phone"
            type="tel"
            value={form.phone ?? ''}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="Optional"
            error={!!fieldErrors.phone}
            errorMessage={fieldErrors.phone}
            disabled={submitting}
            autoComplete="tel"
          />
        </div>
        <div>
          <label htmlFor="add-client-goals" className="mb-1 block text-[13px] font-medium text-[var(--color-text-primary)]">
            Goals
          </label>
          <Textarea
            id="add-client-goals"
            value={form.goals ?? ''}
            onChange={(e) => update('goals', e.target.value)}
            placeholder="Optional goals or notes"
            error={!!fieldErrors.goals}
            errorMessage={fieldErrors.goals}
            disabled={submitting}
            rows={3}
          />
        </div>
        {submitError && (
          <p className="text-[13px] text-[var(--color-error)]">{submitError}</p>
        )}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="min-w-[120px]">
            {submitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
                <span className="sr-only">Saving…</span>
              </span>
            ) : (
              'Add client'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
