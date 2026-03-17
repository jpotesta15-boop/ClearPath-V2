import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { updateClientSchema } from '@/lib/validations'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/clients/[id] — fetch one client by id.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('clients')
      .select('id, workspace_id, first_name, last_name, email, phone, goals, status, notes, profile_photo_url, created_at, updated_at')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not load client' },
        { status: 500 }
      )
    }
    if (!data) {
      return NextResponse.json(
        { error: "We couldn't find that client — it may have been deleted" },
        { status: 404 }
      )
    }
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/clients/[id] — update client fields.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateClientSchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors
      const message = Object.values(first).flat().join(' ') || 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (parsed.data.first_name !== undefined) updates.first_name = parsed.data.first_name
    if (parsed.data.last_name !== undefined) updates.last_name = parsed.data.last_name
    if (parsed.data.email !== undefined) updates.email = parsed.data.email
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone
    if (parsed.data.goals !== undefined) updates.goals = parsed.data.goals
    if (parsed.data.status !== undefined) updates.status = parsed.data.status
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes
    if (parsed.data.profile_photo_url !== undefined) {
      updates.profile_photo_url = parsed.data.profile_photo_url === '' || parsed.data.profile_photo_url === null ? null : parsed.data.profile_photo_url
    }

    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select('id, first_name, last_name, email, phone, goals, status, notes, profile_photo_url, updated_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not update client' },
        { status: 500 }
      )
    }
    if (!data) {
      return NextResponse.json(
        { error: "We couldn't find that client — it may have been deleted" },
        { status: 404 }
      )
    }
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
