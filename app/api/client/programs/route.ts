import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * GET /api/client/programs — all programs assigned to the client, with progress counts. Client only.
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
      return NextResponse.json({ data: [] })
    }

    const { data: assignments } = await supabase
      .from('client_programs')
      .select('id, program_id, status, started_at, completed_at, created_at')
      .eq('client_id', client.id)
      .in('status', ['active', 'completed'])
      .order('created_at', { ascending: false })

    if (!assignments?.length) {
      return NextResponse.json({ data: [] })
    }

    const programIds = [...new Set(assignments.map((a) => a.program_id))]
    const { data: programs } = await supabase
      .from('programs')
      .select('id, title, description, thumbnail_url, status, total_modules')
      .in('id', programIds)

    const programMap = new Map((programs ?? []).map((p) => [p.id, p]))
    const clientProgramIds = assignments.map((a) => a.id)
    const { data: progressRows } = await supabase
      .from('program_progress')
      .select('client_program_id, completed_at')
      .in('client_program_id', clientProgramIds)

    const completedByClientProgram: Record<string, number> = {}
    for (const p of progressRows ?? []) {
      if (p.completed_at) {
        completedByClientProgram[p.client_program_id] = (completedByClientProgram[p.client_program_id] ?? 0) + 1
      }
    }

    const data = assignments.map((a) => {
      const prog = programMap.get(a.program_id)
      const totalModules = prog?.total_modules ?? 0
      const modulesCompleted = completedByClientProgram[a.id] ?? 0
      return {
        clientProgramId: a.id,
        programId: a.program_id,
        title: prog?.title ?? 'Untitled',
        description: prog?.description ?? null,
        thumbnailUrl: prog?.thumbnail_url ?? null,
        status: a.status,
        totalModules,
        modulesCompleted,
        assignedAt: a.created_at,
        completedAt: a.completed_at,
      }
    })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
