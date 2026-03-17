import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { assignProgramSchema } from '@/lib/validations'
import { checkRateLimitAsync } from '@/lib/rate-limit'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/programs/[id]/assign — assign program to client. Coach only.
 * Verify client is in same workspace; error if already assigned.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: programId } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`api-programs:${user.id}`, {
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

    const { data: program } = await supabase
      .from('programs')
      .select('id')
      .eq('id', programId)
      .eq('workspace_id', coach.workspace_id)
      .single()
    if (!program) {
      return NextResponse.json(
        { error: "We couldn't find that program — it may have been deleted" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const parsed = assignProgramSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id, first_name, last_name')
      .eq('id', parsed.data.clientId)
      .eq('workspace_id', coach.workspace_id)
      .single()
    if (!client) {
      return NextResponse.json(
        { error: "We couldn't find that client — they may not be in your workspace" },
        { status: 404 }
      )
    }

    const { data: existing } = await supabase
      .from('client_programs')
      .select('id')
      .eq('program_id', programId)
      .eq('client_id', parsed.data.clientId)
      .maybeSingle()
    if (existing) {
      const name = [client.first_name, client.last_name].filter(Boolean).join(' ') || 'This client'
      return NextResponse.json(
        { error: `${name} already has this program` },
        { status: 400 }
      )
    }

    const { data: row, error } = await supabase
      .from('client_programs')
      .insert({
        workspace_id: coach.workspace_id,
        program_id: programId,
        client_id: parsed.data.clientId,
        assigned_by: user.id,
        status: 'active',
      })
      .select('id, program_id, client_id, status, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        const name = [client.first_name, client.last_name].filter(Boolean).join(' ') || 'This client'
        return NextResponse.json(
          { error: `${name} already has this program` },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: error.message || 'Could not assign program' },
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
