'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { AssignProgramModal } from '@/components/coach/AssignProgramModal'
import { VideoSelectModal, type VideoOption } from '@/components/coach/VideoSelectModal'
import { cn } from '@/lib/utils'

type ProgramModule = {
  id: string
  program_id: string
  title: string
  description: string | null
  position: number
  created_at: string
  updated_at: string
  content?: ProgramContent[]
}

type ProgramContent = {
  id: string
  module_id: string
  content_type: 'text' | 'url' | 'video' | 'file'
  title: string | null
  body: string | null
  url: string | null
  video_id: string | null
  file_url: string | null
  position: number
  created_at: string
  updated_at: string
}

type ProgramData = {
  id: string
  workspace_id: string
  coach_id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  status: string
  total_modules: number
  created_at: string
  updated_at: string
  modules: ProgramModule[]
}

function ModuleRow({
  module,
  isSelected,
  onSelect,
  onDelete,
  isDragDisabled,
}: {
  module: ProgramModule
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  isDragDisabled?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: module.id,
    disabled: isDragDisabled,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const contentCount = module.content?.length ?? 0
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 group',
        isSelected
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
          : 'border-[var(--color-border)] bg-white hover:border-[var(--color-muted)]/50',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <button
        type="button"
        className="touch-none cursor-grab text-[var(--color-muted)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed"
        aria-label="Drag to reorder"
        {...(isDragDisabled ? {} : { ...attributes, ...listeners })}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M8 6h0M8 12h0M8 18h0M16 6h0M16 12h0M16 18h0" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 text-left text-sm font-medium text-[var(--color-ink)] min-h-[44px] flex items-center"
      >
        {module.title || 'Untitled module'}
      </button>
      <span className="text-xs text-[var(--color-muted)]">
        {contentCount} item{contentCount !== 1 ? 's' : ''}
      </span>
      <button
        type="button"
        onClick={onDelete}
        className="rounded p-1 text-[var(--color-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Delete module"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>
    </div>
  )
}

export function ProgramEditorContent({ programId }: { programId: string }) {
  const [program, setProgram] = useState<ProgramData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [savingTitle, setSavingTitle] = useState(false)
  const [savingDesc, setSavingDesc] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [addModuleOpen, setAddModuleOpen] = useState(false)
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [newModuleDesc, setNewModuleDesc] = useState('')
  const [addingModule, setAddingModule] = useState(false)
  const [editingContentId, setEditingContentId] = useState<string | null>(null)
  const [addContentOpen, setAddContentOpen] = useState(false)

  const fetchProgram = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/programs/${programId}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load program')
        setProgram(null)
        return
      }
      const data = json.data as ProgramData
      setProgram(data)
      setTitle(data.title)
      setDescription(data.description ?? '')
      setStatus(data.status === 'published' ? 'published' : 'draft')
      if (data.modules?.length && !selectedModuleId) {
        setSelectedModuleId(data.modules[0].id)
      }
    } catch {
      setError('Something went wrong — check your connection and try again')
      setProgram(null)
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    fetchProgram()
  }, [fetchProgram])

  const selectedModule = program?.modules?.find((m) => m.id === selectedModuleId)

  const saveTitle = async () => {
    if (!program || title.trim() === program.title) return
    setSavingTitle(true)
    try {
      const res = await fetch(`/api/programs/${programId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      })
      if (res.ok) {
        setProgram((p) => (p ? { ...p, title: title.trim() } : null))
      }
    } finally {
      setSavingTitle(false)
    }
  }

  const saveDescription = async () => {
    if (!program || description === (program.description ?? '')) return
    setSavingDesc(true)
    try {
      const res = await fetch(`/api/programs/${programId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() || null }),
      })
      if (res.ok) {
        setProgram((p) => (p ? { ...p, description: description.trim() || null } : null))
      }
    } finally {
      setSavingDesc(false)
    }
  }

  const toggleStatus = async () => {
    if (!program) return
    const next = status === 'draft' ? 'published' : 'draft'
    setSavingStatus(true)
    try {
      const res = await fetch(`/api/programs/${programId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (res.ok) {
        setStatus(next)
        setProgram((p) => (p ? { ...p, status: next } : null))
      }
    } finally {
      setSavingStatus(false)
    }
  }

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newModuleTitle.trim()) return
    setAddingModule(true)
    try {
      const res = await fetch(`/api/programs/${programId}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newModuleTitle.trim(),
          description: newModuleDesc.trim() || null,
        }),
      })
      const json = await res.json()
      if (res.ok && json.data) {
        setAddModuleOpen(false)
        setNewModuleTitle('')
        setNewModuleDesc('')
        setProgram((p) => {
          if (!p) return null
          const mods = [...(p.modules || []), { ...json.data, content: [] }]
          mods.sort((a, b) => a.position - b.position)
          return { ...p, modules: mods, total_modules: mods.length }
        })
        setSelectedModuleId(json.data.id)
      }
    } finally {
      setAddingModule(false)
    }
  }

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Delete this module and all its content?')) return
    try {
      const res = await fetch(`/api/programs/${programId}/modules/${moduleId}`, { method: 'DELETE' })
      if (res.ok) {
        setProgram((p) => {
          if (!p) return null
          const mods = (p.modules || []).filter((m) => m.id !== moduleId)
          if (selectedModuleId === moduleId) setSelectedModuleId(mods[0]?.id ?? null)
          return { ...p, modules: mods, total_modules: mods.length }
        })
      }
    } catch {
      // ignore
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !program?.modules) return
    const oldIndex = program.modules.findIndex((m) => m.id === active.id)
    const newIndex = program.modules.findIndex((m) => m.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(program.modules, oldIndex, newIndex)
    setProgram((p) => (p ? { ...p, modules: reordered } : null))
    const moduleId = reordered[newIndex].id
    try {
      await fetch(`/api/programs/${programId}/modules/${moduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: newIndex }),
      })
    } catch {
      fetchProgram()
    }
  }

  if (loading) {
    return (
      <div className="flex gap-6">
        <div className="w-1/3 animate-pulse rounded-lg bg-[var(--color-border)] h-64" />
        <div className="flex-1 animate-pulse rounded-lg bg-[var(--color-border)] h-96" />
      </div>
    )
  }
  if (error || !program) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
        <p className="text-[var(--color-muted)]">{error ?? 'Program not found'}</p>
        <Link href="/coach/programs">
          <Button variant="secondary" className="mt-4">
            Back to programs
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left panel */}
      <div className="w-full lg:w-1/3 flex-shrink-0 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
        <div>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            disabled={savingTitle}
            className="text-base font-medium"
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            disabled={savingDesc}
            placeholder="Description (optional)"
            rows={2}
            className="mt-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleStatus}
            disabled={savingStatus}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium',
              status === 'published'
                ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                : 'bg-[var(--color-muted)]/20 text-[var(--color-muted)]'
            )}
          >
            {status === 'draft' ? 'Draft' : 'Published'}
          </button>
        </div>
        <Button variant="secondary" className="w-full min-h-[44px]" onClick={() => setAssignOpen(true)}>
          Assign to client
        </Button>
        <hr className="border-[var(--color-border)]" />
        <div className="flex flex-col gap-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={(program.modules || []).map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {(program.modules || []).map((mod) => (
                <ModuleRow
                  key={mod.id}
                  module={mod}
                  isSelected={selectedModuleId === mod.id}
                  onSelect={() => setSelectedModuleId(mod.id)}
                  onDelete={() => handleDeleteModule(mod.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
          <Button
            variant="ghost"
            className="w-full min-h-[44px] border border-dashed border-[var(--color-border)]"
            onClick={() => setAddModuleOpen(true)}
          >
            Add module
          </Button>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {!selectedModule ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
            <p className="font-medium text-[var(--color-ink)]">
              Select a module on the left to edit its content, or add a new module.
            </p>
          </div>
        ) : (
          <ProgramModuleEditor
            programId={programId}
            workspaceId={program.workspace_id}
            module={selectedModule}
            onUpdate={(updated) => {
              setProgram((p) =>
                p
                  ? {
                      ...p,
                      modules: p.modules?.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)) ?? [],
                    }
                  : null
              )
            }}
            onRefresh={fetchProgram}
            editingContentId={editingContentId}
            setEditingContentId={setEditingContentId}
            addContentOpen={addContentOpen}
            setAddContentOpen={setAddContentOpen}
          />
        )}
      </div>

      <Modal
        isOpen={addModuleOpen}
        onClose={() => setAddModuleOpen(false)}
        title="Add module"
        className="max-w-md"
      >
        <form onSubmit={handleAddModule} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Title *</label>
            <Input
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              placeholder="e.g. Week 1"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Description</label>
            <Textarea
              value={newModuleDesc}
              onChange={(e) => setNewModuleDesc(e.target.value)}
              placeholder="Optional"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAddModuleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addingModule}>
              {addingModule ? 'Adding…' : 'Add module'}
            </Button>
          </div>
        </form>
      </Modal>

      <AssignProgramModal
        programId={programId}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onAssigned={() => {
          setAssignOpen(false)
          fetchProgram()
        }}
      />
    </div>
  )
}

function ProgramModuleEditor({
  programId,
  workspaceId,
  module,
  onUpdate,
  onRefresh,
  editingContentId,
  setEditingContentId,
  addContentOpen,
  setAddContentOpen,
}: {
  programId: string
  workspaceId: string
  module: ProgramModule
  onUpdate: (m: Partial<ProgramModule>) => void
  onRefresh: () => void
  editingContentId: string | null
  setEditingContentId: (id: string | null) => void
  addContentOpen: boolean
  setAddContentOpen: (v: boolean) => void
}) {
  const [moduleTitle, setModuleTitle] = useState(module.title)
  const [moduleDesc, setModuleDesc] = useState(module.description ?? '')
  const [savingMod, setSavingMod] = useState(false)

  useEffect(() => {
    setModuleTitle(module.title)
    setModuleDesc(module.description ?? '')
  }, [module.id, module.title, module.description])

  const saveModuleTitle = async () => {
    if (moduleTitle.trim() === module.title) return
    setSavingMod(true)
    try {
      const res = await fetch(`/api/programs/${programId}/modules/${module.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: moduleTitle.trim() }),
      })
      if (res.ok) onUpdate({ title: moduleTitle.trim() })
    } finally {
      setSavingMod(false)
    }
  }

  const saveModuleDesc = async () => {
    if ((moduleDesc || '') === (module.description ?? '')) return
    setSavingMod(true)
    try {
      const res = await fetch(`/api/programs/${programId}/modules/${module.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: moduleDesc.trim() || null }),
      })
      if (res.ok) onUpdate({ description: moduleDesc.trim() || null })
    } finally {
      setSavingMod(false)
    }
  }

  const addContent = async (contentType: 'text' | 'url' | 'video' | 'file') => {
    try {
      const res = await fetch(
        `/api/programs/${programId}/modules/${module.id}/content`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentType }),
        }
      )
      const json = await res.json()
      if (res.ok && json.data) {
        onRefresh()
        setEditingContentId(json.data.id)
      }
    } catch {
      // ignore
    }
    setAddContentOpen(false)
  }

  const deleteContent = async (contentId: string) => {
    if (!confirm('Delete this content block?')) return
    try {
      const res = await fetch(`/api/content/${contentId}`, { method: 'DELETE' })
      if (res.ok) onRefresh()
    } catch {
      // ignore
    }
    setEditingContentId(null)
  }

  const contentBlocks = (module.content ?? []).sort((a, b) => a.position - b.position)

  return (
    <Card variant="raised" padding="lg">
      <Input
        value={moduleTitle}
        onChange={(e) => setModuleTitle(e.target.value)}
        onBlur={saveModuleTitle}
        disabled={savingMod}
        className="text-base font-medium mb-2"
      />
      <Textarea
        value={moduleDesc}
        onChange={(e) => setModuleDesc(e.target.value)}
        onBlur={saveModuleDesc}
        disabled={savingMod}
        placeholder="Description (optional)"
        rows={2}
        className="mb-4"
      />
      <hr className="border-[var(--color-border)] my-4" />
      <div className="space-y-3">
        {contentBlocks.map((block) => (
          <ContentBlockRow
            key={block.id}
            block={block}
            isEditing={editingContentId === block.id}
            onEdit={() => setEditingContentId(block.id)}
            onDelete={() => deleteContent(block.id)}
            onCloseEditor={() => setEditingContentId(null)}
            onSaved={() => {
              onRefresh()
              setEditingContentId(null)
            }}
            programId={programId}
            workspaceId={workspaceId}
          />
        ))}
      </div>
      <div className="mt-4 relative">
        <Button
          variant="secondary"
          className="min-h-[44px]"
          onClick={() => setAddContentOpen(!addContentOpen)}
        >
          Add content
        </Button>
        {addContentOpen && (
          <div className="absolute top-full left-0 mt-1 z-10 rounded-lg border border-[var(--color-border)] bg-white p-2 shadow-lg min-w-[200px]">
            <button
              type="button"
              className="block w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-surface)] text-sm"
              onClick={() => addContent('text')}
            >
              + Add text / notes
            </button>
            <button
              type="button"
              className="block w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-surface)] text-sm"
              onClick={() => addContent('url')}
            >
              + Add URL
            </button>
            <button
              type="button"
              className="block w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-surface)] text-sm text-[var(--color-muted)]"
              onClick={() => addContent('video')}
            >
              + Add video (coming soon)
            </button>
            <button
              type="button"
              className="block w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-surface)] text-sm"
              onClick={() => addContent('file')}
            >
              + Add file
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}

function ContentBlockRow({
  block,
  isEditing,
  onEdit,
  onDelete,
  onCloseEditor,
  onSaved,
  programId,
  workspaceId,
}: {
  block: ProgramContent
  isEditing: boolean
  onEdit: () => void
  onDelete: () => void
  onCloseEditor: () => void
  onSaved: () => void
  programId: string
  workspaceId: string
}) {
  const icon =
    block.content_type === 'text' ? 'T' : block.content_type === 'url' ? '🔗' : block.content_type === 'video' ? '▶' : '📎'
  const label = block.title || (block.body ? block.body.slice(0, 60) + (block.body.length > 60 ? '…' : '') : 'Untitled')
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded bg-[var(--color-border)] text-xs font-medium text-[var(--color-muted)]">
          {icon}
        </span>
        <span className="flex-1 truncate text-sm text-[var(--color-ink)]">{label}</span>
        <Button variant="ghost" className="min-h-[36px] text-sm" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="ghost" className="min-h-[36px] text-sm text-[var(--color-error)]" onClick={onDelete}>
          Delete
        </Button>
      </div>
      {isEditing && (
        <ContentBlockEditor
          block={block}
          onClose={onCloseEditor}
          onSaved={onSaved}
          programId={programId}
          workspaceId={workspaceId}
        />
      )}
    </div>
  )
}

function VideoBlockEditor({
  block,
  onClose,
  onSaved,
}: {
  block: ProgramContent
  onClose: () => void
  onSaved: () => void
}) {
  const [videoSelectOpen, setVideoSelectOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSelectVideo = async (video: VideoOption) => {
    if (!video.playback_url) return
    setSaving(true)
    try {
      const res = await fetch(`/api/content/${block.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          url: video.playback_url,
          title: video.title,
        }),
      })
      if (res.ok) onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/10 p-4">
      <p className="text-sm text-[var(--color-muted)] mb-2">Select from video library</p>
      {block.video_id && block.url && (
        <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-white p-3 flex items-center gap-3">
          <div className="h-14 w-24 shrink-0 rounded bg-[var(--color-border)] flex items-center justify-center overflow-hidden">
            <svg className="w-8 h-8 text-[var(--color-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 8l6 4-6 4V8z" />
              <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--color-ink)] truncate">{block.title || 'Video'}</p>
            <p className="text-xs text-[var(--color-muted)]">Video selected</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => setVideoSelectOpen(true)}
          disabled={saving}
        >
          {block.video_id ? 'Change video' : 'Select video'}
        </Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
      <VideoSelectModal
        open={videoSelectOpen}
        onClose={() => setVideoSelectOpen(false)}
        onSelect={handleSelectVideo}
      />
    </div>
  )
}

function ContentBlockEditor({
  block,
  onClose,
  onSaved,
  programId,
  workspaceId,
}: {
  block: ProgramContent
  onClose: () => void
  onSaved: () => void
  programId: string
  workspaceId: string
}) {
  const [title, setTitle] = useState(block.title ?? '')
  const [body, setBody] = useState(block.body ?? '')
  const [url, setUrl] = useState(block.url ?? '')
  const [fileUrl, setFileUrl] = useState(block.file_url ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/content/${block.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          block.content_type === 'text'
            ? { title: title || null, body: body || null }
            : block.content_type === 'url'
              ? { title: title || null, url: url || null }
              : block.content_type === 'file'
                ? { title: title || null, fileUrl: fileUrl || null }
                : {}
        ),
      })
      if (res.ok) onSaved()
    } finally {
      setSaving(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('moduleId', block.module_id)
      form.set('workspaceId', workspaceId)
      const res = await fetch('/api/programs/upload', { method: 'POST', body: form })
      const json = await res.json()
      if (res.ok && json.data?.fileUrl) setFileUrl(json.data.fileUrl)
    } finally {
      setUploading(false)
    }
  }

  if (block.content_type === 'video') {
    return (
      <VideoBlockEditor
        block={block}
        onClose={onClose}
        onSaved={onSaved}
      />
    )
  }

  return (
    <div className="mt-3 space-y-3 border-t border-[var(--color-border)] pt-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional" />
      </div>
      {block.content_type === 'text' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Body</label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Content" />
        </div>
      )}
      {block.content_type === 'url' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">URL</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            type="url"
          />
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block rounded-lg border border-[var(--color-border)] p-3 text-sm text-[var(--color-accent)] hover:underline"
            >
              {url}
            </a>
          )}
        </div>
      )}
      {block.content_type === 'file' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">File</label>
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm"
          />
          {fileUrl && <p className="mt-2 text-sm text-[var(--color-muted)]">Uploaded: {fileUrl.slice(0, 50)}…</p>}
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </div>
  )
}

