import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { addClientSchema } from '@/lib/validations'
import { checkClientLimit } from '@/lib/plan-limits'

/**
 * GET /api/clients — fetch all clients for the coach's workspace.
 * Query: ?search= (name or email), ?status= (active|paused|completed).
 */
export async function GET(request: Request) {
  try {
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

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status')?.trim() || ''

    let query = supabase
      .from('clients')
      .select('id, workspace_id, first_name, last_name, email, phone, goals, status, notes, profile_photo_url, created_at, updated_at')
      .order('updated_at', { ascending: false })

    if (status && ['active', 'paused', 'completed'].includes(status)) {
      query = query.eq('status', status)
    }
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not load clients' },
        { status: 500 }
      )
    }
    return NextResponse.json({ data: data ?? [] })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/clients — create a new client.
 * Body: addClientSchema (firstName, lastName, email, phone?, goals?).
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

    const limit = await checkClientLimit(coach.workspace_id)
    if (!limit.allowed) {
      const msg = limit.max === null
        ? "You've reached your plan limit for clients. Contact support to add more."
        : `You've reached your plan limit of ${limit.max} clients. Upgrade your plan to add more.`
      return NextResponse.json({ error: msg }, { status: 403 })
    }

    const body = await request.json()
    const parsed = addClientSchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors
      const message = Object.values(first).flat().join(' ') || 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { firstName, lastName, email, phone, goals } = parsed.data
    const { data, error } = await supabase
      .from('clients')
      .insert({
        workspace_id: coach.workspace_id,
        first_name: firstName,
        last_name: lastName,
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        goals: goals?.trim() || null,
        status: 'active',
      })
      .select('id, first_name, last_name, email, status, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A client with this email already exists' }, { status: 400 })
      }
      return NextResponse.json(
        { error: error.message || 'Could not create client' },
        { status: 500 }
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
