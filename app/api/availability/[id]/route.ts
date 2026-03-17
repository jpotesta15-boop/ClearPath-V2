import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { recurringAvailabilityPatchSchema } from '@/lib/validations'

/**
 * PATCH /api/availability/[id] — update a recurring availability rule. Coach only.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: existing } = await supabase
      .from('recurring_availability')
      .select('id, workspace_id')
      .eq('id', id)
      .maybeSingle()
    if (!existing || existing.workspace_id !== coach.workspace_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = recurringAvailabilityPatchSchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors
      const message = Object.values(first).flat().join(' ') || 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.dayOfWeek !== undefined) updates.day_of_week = parsed.data.dayOfWeek
    if (parsed.data.startTime !== undefined) updates.start_time = parsed.data.startTime
    if (parsed.data.endTime !== undefined) updates.end_time = parsed.data.endTime
    if (parsed.data.label !== undefined) updates.label = parsed.data.label ?? null
    if (parsed.data.sessionProductId !== undefined) updates.session_product_id = parsed.data.sessionProductId ?? null
    if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ data: existing })
    }

    const { data, error } = await supabase
      .from('recurring_availability')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not update availability' },
        { status: 500 }
      )
    }
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/availability/[id] — soft delete (set is_active = false). Coach only.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: existing } = await supabase
      .from('recurring_availability')
      .select('id, workspace_id')
      .eq('id', id)
      .maybeSingle()
    if (!existing || existing.workspace_id !== coach.workspace_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('recurring_availability')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not delete availability' },
        { status: 500 }
      )
    }
    return NextResponse.json({ data: 'ok' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}
