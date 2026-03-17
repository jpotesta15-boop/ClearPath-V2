import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * GET /api/client/sessions — fetch sessions for the authenticated client.
 * Returns upcoming (scheduled_time >= now, status pending/confirmed) and past (scheduled_time < now or completed/cancelled).
 */
export async function GET() {
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
    if (profile?.role === 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('email', user.email ?? '')
      .limit(1)
      .maybeSingle()
    if (!client) {
      return NextResponse.json({ data: { upcoming: [], past: [] } })
    }

    const now = new Date().toISOString()
    const { data: all } = await supabase
      .from('sessions')
      .select('id, scheduled_time, end_time, duration_minutes, status, notes')
      .eq('client_id', client.id)
      .order('scheduled_time', { ascending: false })

    const upcoming: typeof all = []
    const past: typeof all = []
    for (const s of all ?? []) {
      if (s.scheduled_time >= now && ['pending', 'confirmed'].includes(s.status)) {
        upcoming.push(s)
      } else {
        past.push(s)
      }
    }
    upcoming.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))

    return NextResponse.json({ data: { upcoming, past } })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Something went wrong' },
      { status: 500 }
    )
  }
}
