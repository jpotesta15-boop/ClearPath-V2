import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'

type RouteContext = { params: Promise<{ moduleId: string }> }

/**
 * POST /api/progress/[moduleId]/complete — client marks a module complete. Creates program_progress. Client only.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { moduleId } = await context.params
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
    if (profile?.role === 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`api-progress:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id, workspace_id')
      .eq('email', user.email ?? '')
      .limit(1)
      .maybeSingle()
    if (!client) {
      return NextResponse.json(
        { error: "We couldn't find your client record" },
        { status: 403 }
      )
    }

    const { data: mod } = await supabase
      .from('program_modules')
      .select('id, program_id')
      .eq('id', moduleId)
      .single()
    if (!mod) {
      return NextResponse.json(
        { error: "We couldn't find that module" },
        { status: 404 }
      )
    }

    const { data: clientProgram } = await supabase
      .from('client_programs')
      .select('id')
      .eq('program_id', mod.program_id)
      .eq('client_id', client.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!clientProgram) {
      return NextResponse.json(
        { error: "You don't have access to this program" },
        { status: 403 }
      )
    }

    const { data: existing } = await supabase
      .from('program_progress')
      .select('id, completed_at')
      .eq('client_program_id', clientProgram.id)
      .eq('module_id', moduleId)
      .maybeSingle()

    if (existing) {
      if (existing.completed_at) {
        return NextResponse.json({ data: { alreadyCompleted: true } })
      }
      const { data: updated, error: updateErr } = await supabase
        .from('program_progress')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('id, completed_at')
        .single()
      if (updateErr) {
        return NextResponse.json(
          { error: updateErr.message || 'Could not update progress' },
          { status: 500 }
        )
      }
      return NextResponse.json({ data: updated })
    }

    const { data: row, error } = await supabase
      .from('program_progress')
      .insert({
        workspace_id: client.workspace_id,
        client_program_id: clientProgram.id,
        module_id: moduleId,
        client_id: client.id,
        completed_at: new Date().toISOString(),
      })
      .select('id, module_id, completed_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ data: { alreadyCompleted: true } })
      }
      return NextResponse.json(
        { error: error.message || 'Could not save progress' },
        { status: 500 }
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
