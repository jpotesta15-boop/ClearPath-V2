'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

type Client = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  status?: string
}

type ProgressItem = {
  clientProgramId: string
  clientId: string
  clientName: string
  clientEmail: string | null
  status: string
  modulesCompleted: number
  totalModules: number
}

export interface AssignProgramModalProps {
  programId: string
  open: boolean
  onClose: () => void
  onAssigned: () => void
}

export function AssignProgramModal({ programId, open, onClose, onAssigned }: AssignProgramModalProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [assigned, setAssigned] = useState<ProgressItem[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !programId) return
    setError(null)
    setSuccess(null)
    setSelectedClientId('')
    const load = async () => {
      setLoading(true)
      try {
        const [clientsRes, progressRes] = await Promise.all([
          fetch('/api/clients?status=active'),
          fetch(`/api/programs/${programId}/progress`),
        ])
        const clientsJson = await clientsRes.json()
        const progressJson = await progressRes.json()
        const clientList = clientsRes.ok ? (clientsJson.data ?? []) : []
        const progressList = progressRes.ok ? (progressJson.data ?? []) : []
        setClients(clientList)
        setAssigned(progressList)
      } catch {
        setError('Could not load clients or assignments')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, programId])

  const assignedClientIds = new Set(assigned.map((a) => a.clientId))
  const availableClients = clients.filter((c) => !assignedClientIds.has(c.id))
  const assignedNames = assigned.map((a) => a.clientName).filter(Boolean)

  const handleAssign = async () => {
    if (!selectedClientId) return
    setAssigning(true)
    setError(null)
    try {
      const res = await fetch(`/api/programs/${programId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not assign program')
        return
      }
      const client = clients.find((c) => c.id === selectedClientId)
      const name = client ? [client.first_name, client.last_name].filter(Boolean).join(' ') : 'Client'
      setSuccess(`Program assigned to ${name}`)
      setSelectedClientId('')
      onAssigned()
      const t = setTimeout(() => {
        onClose()
      }, 1500)
      return () => clearTimeout(t)
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Assign program" className="max-w-md">
      {loading ? (
        <p className="text-[var(--color-muted)] text-sm">Loading…</p>
      ) : (
        <div className="space-y-4">
          {assignedNames.length > 0 && (
            <p className="text-sm text-[var(--color-muted)]">
              Currently assigned to: {assignedNames.join(', ')}
            </p>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">
              Select client
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              <option value="">Choose a client…</option>
              {availableClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || c.id}
                </option>
              ))}
            </select>
            {availableClients.length === 0 && (
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                All active clients are already assigned to this program.
              </p>
            )}
          </div>
          {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
          {success && <p className="text-sm text-[var(--color-success)]">{success}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedClientId || assigning}
            >
              {assigning ? 'Assigning…' : 'Assign'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
