import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const patchBodySchema = z.object({
  folderId: z
    .union([z.string(), z.null()])
    .transform((v) => {
      if (v == null) return null
      const s = String(v).trim()
      return s === '' ? null : s
    }),
})

/**
 * GET /api/workspaces/import-folder — get current coach's Google Drive import folder ID.
 * Coach only.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = createServiceClient()
    const { data: coach } = await service
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) {
      return NextResponse.json(
        { error: 'No coach workspace found — finish onboarding first' },
        { status: 403 }
      )
    }
    const { data: workspace, error } = await service
      .from('workspaces')
      .select('google_drive_import_folder_id')
      .eq('id', coach.workspace_id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message ?? 'Could not load workspace' }, { status: 500 })
    }
    return NextResponse.json({
      folderId: workspace?.google_drive_import_folder_id ?? null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY') || msg.includes('service_role')) {
      return NextResponse.json(
        { error: 'Server missing SUPABASE_SERVICE_ROLE_KEY — add it to .env.local and restart dev' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/workspaces/import-folder — set current coach's Google Drive import folder ID.
 * Body: { folderId: string | null }. Coach only.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = createServiceClient()
    const { data: coach } = await service
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) {
      return NextResponse.json(
        { error: 'No coach workspace found — finish onboarding first' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = patchBodySchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { data: updated, error } = await service
      .from('workspaces')
      .update({
        google_drive_import_folder_id: parsed.data.folderId,
      })
      .eq('id', coach.workspace_id)
      .select('id')
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: error.message ?? 'Could not update import folder' },
        { status: 500 }
      )
    }
    if (!updated) {
      return NextResponse.json(
        { error: 'Workspace not found — contact support' },
        { status: 404 }
      )
    }
    return NextResponse.json({ data: 'ok' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY') || msg.includes('service_role')) {
      return NextResponse.json(
        { error: 'Server missing SUPABASE_SERVICE_ROLE_KEY — add it to .env.local and restart dev' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
