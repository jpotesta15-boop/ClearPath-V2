import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/programs/[id]/progress — progress for all clients assigned to this program. Coach only.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id: programId } = await context.params
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

    const { data: program } = await supabase
      .from('programs')
      .select('id, total_modules')
      .eq('id', programId)
      .eq('workspace_id', coach.workspace_id)
      .single()
    if (!program) {
      return NextResponse.json(
        { error: "We couldn't find that program — it may have been deleted" },
        { status: 404 }
      )
    }

    const { data: assignments } = await supabase
      .from('client_programs')
      .select('id, client_id, status, started_at, completed_at, created_at')
      .eq('program_id', programId)
      .eq('workspace_id', coach.workspace_id)

    if (!assignments?.length) {
      return NextResponse.json({ data: [] })
    }

    const clientIds = [...new Set(assignments.map((a) => a.client_id))]
    const { data: clients } = await supabase
      .from('clients')
      .select('id, first_name, last_name, email')
      .in('id', clientIds)

    const clientMap = new Map((clients ?? []).map((c) => [c.id, c]))
    const clientProgramIds = assignments.map((a) => a.id)
    const { data: progressRows } = await supabase
      .from('program_progress')
      .select('client_program_id, completed_at')
      .in('client_program_id', clientProgramIds)

    const totalModules = program.total_modules ?? 0
    const progressByClientProgram: Record<string, number> = {}
    for (const p of progressRows ?? []) {
      const key = p.client_program_id
      if (!progressByClientProgram[key]) progressByClientProgram[key] = 0
      if (p.completed_at) progressByClientProgram[key] += 1
    }

    const data = assignments.map((a) => {
      const c = clientMap.get(a.client_id)
      return {
        clientProgramId: a.id,
        clientId: a.client_id,
        clientName: c ? [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown' : 'Unknown',
        clientEmail: c?.email ?? null,
        status: a.status,
        startedAt: a.started_at,
        completedAt: a.completed_at,
        assignedAt: a.created_at,
        modulesCompleted: progressByClientProgram[a.id] ?? 0,
        totalModules,
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
