'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const ACCEPT_IMAGE = 'image/jpeg,image/png,image/gif,image/webp'
const MAX_SIZE_MB = 2
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024

export default function OnboardingStep1Page() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [ensuringSignup, setEnsuringSignup] = useState(true)

  useEffect(() => {
    fetch('/api/auth/signup-complete', { method: 'POST', credentials: 'include' })
      .then((res) => {
        if (res.ok) router.refresh()
      })
      .finally(() => setEnsuringSignup(false))
  }, [router])
  const [nameError, setNameError] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setAvatarFile(null)
      setAvatarPreview(null)
      return
    }
    if (file.size > MAX_BYTES) {
      setAvatarFile(null)
      setAvatarPreview(null)
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setLogoFile(null)
      setLogoPreview(null)
      return
    }
    if (file.size > MAX_BYTES) {
      setLogoFile(null)
      setLogoPreview(null)
      return
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const uploadFile = async (
    supabase: ReturnType<typeof createClient>,
    userId: string,
    file: File,
    path: 'avatar' | 'logo'
  ): Promise<string | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const pathName = `${userId}/${path}.${ext}`
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(pathName, file, { upsert: true })
    if (error) return null
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.path)
    return urlData.publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setNameError('Workspace name must be at least 2 characters')
      return
    }
    setNameError('')
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      let avatarUrl: string | null = null
      let logoUrl: string | null = null
      if (avatarFile) {
        avatarUrl = await uploadFile(supabase, user.id, avatarFile, 'avatar')
      }
      if (logoFile) {
        logoUrl = await uploadFile(supabase, user.id, logoFile, 'logo')
      }
      const res = await fetch('/api/onboarding/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          logo_url: logoUrl,
          avatar_url: avatarUrl,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setNameError(json.error || 'Could not save')
        setSubmitting(false)
        return
      }
      router.push('/onboarding/step-2')
    } catch {
      setNameError('Something went wrong — try again')
      setSubmitting(false)
    }
  }

  if (ensuringSignup) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 rounded-lg bg-[var(--color-surface)]" />
        <div className="h-12 w-full rounded-lg bg-[var(--color-surface)]" />
        <div className="h-12 w-32 rounded-lg bg-[var(--color-surface)]" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-[var(--text-h3)] font-medium tracking-[var(--tracking-heading)] text-[var(--color-text-primary)]">
        Set up your workspace
      </h1>

      <div>
        <label htmlFor="workspace-name" className="mb-1 block text-[15px] font-medium text-[var(--color-text-primary)]">
          Workspace name <span className="text-[var(--color-error)]">*</span>
        </label>
        <Input
          id="workspace-name"
          type="text"
          placeholder="Your coaching business name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={!!nameError}
          errorMessage={nameError}
          minLength={2}
          required
          className="w-full"
        />
      </div>

      <div>
        <label className="mb-1 block text-[15px] font-medium text-[var(--color-text-primary)]">
          Profile photo (optional)
        </label>
        <input
          type="file"
          accept={ACCEPT_IMAGE}
          onChange={handleAvatarChange}
          className="block w-full text-sm text-[var(--color-text-secondary)] file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--color-surface)] file:px-3 file:py-2 file:font-medium"
        />
        {avatarPreview && (
          <div className="mt-2 h-24 w-24 overflow-hidden rounded-full border border-[var(--color-border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarPreview} alt="Profile preview" className="h-full w-full object-cover" />
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-[15px] font-medium text-[var(--color-text-primary)]">
          Logo (optional)
        </label>
        <input
          type="file"
          accept={ACCEPT_IMAGE}
          onChange={handleLogoChange}
          className="block w-full text-sm text-[var(--color-text-secondary)] file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--color-surface)] file:px-3 file:py-2 file:font-medium"
        />
        {logoPreview && (
          <div className="mt-2 h-16 w-32 overflow-hidden rounded-lg border border-[var(--color-border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain" />
          </div>
        )}
      </div>

      <Button type="submit" disabled={submitting} fullWidth>
        {submitting ? 'Saving…' : 'Continue'}
      </Button>
    </form>
  )
}
