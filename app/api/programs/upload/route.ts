import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

/**
 * POST /api/programs/upload — upload file for program content. Coach only.
 * Body: FormData with file, moduleId, workspaceId (for path programs/{workspaceId}/{moduleId}/{filename})
 * Returns: { data: { fileUrl: string } }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const moduleId = formData.get('moduleId') as string | null
    const workspaceId = formData.get('workspaceId') as string | null
    if (!file || !moduleId || !workspaceId || workspaceId !== coach.workspace_id) {
      return NextResponse.json(
        { error: 'Missing file, moduleId, or workspaceId' },
        { status: 400 }
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File must be 50MB or smaller' },
        { status: 400 }
      )
    }
    const type = file.type?.toLowerCase()
    if (type && !ALLOWED_TYPES.some((t) => type.startsWith(t.split('/')[0]) || type === t)) {
      const allowed = 'image/*, .pdf, .doc, .docx'
      if (!ALLOWED_TYPES.some((t) => type === t || (t.startsWith('image/') && type.startsWith('image/')))) {
        return NextResponse.json(
          { error: `File type not allowed. Use: ${allowed}` },
          { status: 400 }
        )
      }
    }

    const ext = file.name.split('.').pop() || 'bin'
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const path = `programs/${workspaceId}/${moduleId}/${safeName}`

    const arrayBuffer = await file.arrayBuffer()
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('programs')
      .upload(path, arrayBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || 'Upload failed' },
        { status: 500 }
      )
    }
    const { data: urlData } = supabase.storage.from('programs').getPublicUrl(uploadData.path)
    return NextResponse.json({ data: { fileUrl: urlData.publicUrl } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}
