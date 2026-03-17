import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { updatePackageSchema } from '@/lib/validations'
import { checkRateLimitAsync } from '@/lib/rate-limit'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/packages/[id] — update a session package. Coach only. Soft delete by setting is_active = false.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`api-packages:${user.id}`, {
      windowMs: 60_000,
      max: 100,
    })
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updatePackageSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.title !== undefined) updates.title = parsed.data.title
    if (parsed.data.description !== undefined) updates.description = parsed.data.description
    if (parsed.data.price_cents !== undefined) updates.price_cents = parsed.data.price_cents
    if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency
    if (parsed.data.duration_minutes !== undefined) updates.duration_minutes = parsed.data.duration_minutes
    if (parsed.data.session_type !== undefined) updates.session_type = parsed.data.session_type
    if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active

    const { data: row, error } = await supabase
      .from('session_packages')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', coach.workspace_id)
      .select('id, workspace_id, coach_id, title, description, price_cents, currency, duration_minutes, session_type, is_active, created_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not update package' },
        { status: 500 }
      )
    }
    if (!row) {
      return NextResponse.json(
        { error: "We couldn't find that package — it may have been deleted" },
        { status: 404 }
      )
    }
    return NextResponse.json({ data: row })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/packages/[id] — soft delete (set is_active = false). Coach only.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
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

    const { data: row, error } = await supabase
      .from('session_packages')
      .update({ is_active: false })
      .eq('id', id)
      .eq('workspace_id', coach.workspace_id)
      .select('id')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not delete package' },
        { status: 500 }
      )
    }
    if (!row) {
      return NextResponse.json(
        { error: "We couldn't find that package — it may have been deleted" },
        { status: 404 }
      )
    }
    return NextResponse.json({ data: 'ok' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
