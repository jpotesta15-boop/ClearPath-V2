'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

type Program = {
  id: string
  title: string
  status: string
  total_modules: number
}

export interface AssignProgramToClientModalProps {
  clientId: string
  clientName: string
  open: boolean
  onClose: () => void
  onAssigned: () => void
}

export function AssignProgramToClientModal({
  clientId,
  clientName,
  open,
  onClose,
  onAssigned,
}: AssignProgramToClientModalProps) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [assignedProgramIds, setAssignedProgramIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !clientId) return
    setError(null)
    setSuccess(null)
    const load = async () => {
      setLoading(true)
      try {
        const [programsRes, clientProgramsRes] = await Promise.all([
          fetch('/api/programs'),
          fetch(`/api/clients/${clientId}/programs`),
        ])
        const programsJson = await programsRes.json()
        const clientProgramsJson = await clientProgramsRes.json()
        const allPrograms = programsRes.ok ? (programsJson.data ?? []) : []
        const assigned = clientProgramsRes.ok ? (clientProgramsJson.data ?? []) : []
        setPrograms(allPrograms)
        setAssignedProgramIds(new Set(assigned.map((a: { programId: string }) => a.programId)))
      } catch {
        setError('Could not load programs')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, clientId])

  const availablePrograms = programs.filter((p) => !assignedProgramIds.has(p.id))

  const handleAssign = async (programId: string) => {
    setAssigning(true)
    setError(null)
    try {
      const res = await fetch(`/api/programs/${programId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not assign program')
        return
      }
      setAssignedProgramIds((prev) => new Set([...prev, programId]))
      const program = programs.find((p) => p.id === programId)
      setSuccess(`Assigned "${program?.title ?? 'Program'}" to ${clientName}`)
      onAssigned()
      const t = setTimeout(onClose, 1500)
      return () => clearTimeout(t)
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={`Assign program to ${clientName}`} className="max-w-md">
      {loading ? (
        <p className="text-[var(--color-muted)] text-sm">Loading…</p>
      ) : (
        <div className="space-y-4">
          {availablePrograms.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              All your programs are already assigned to this client.
            </p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {availablePrograms.map((prog) => (
                <li key={prog.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] p-3">
                  <span className="font-medium text-[var(--color-ink)]">{prog.title}</span>
                  <Button
                    variant="secondary"
                    className="min-h-[36px] shrink-0"
                    onClick={() => handleAssign(prog.id)}
                    disabled={assigning}
                  >
                    Assign
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
          {success && <p className="text-sm text-[var(--color-success)]">{success}</p>}
          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
