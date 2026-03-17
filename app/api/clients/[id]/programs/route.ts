import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/clients/[id]/programs — programs assigned to this client with progress. Coach only.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id: clientId } = await context.params
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

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('workspace_id', coach.workspace_id)
      .single()
    if (!client) {
      return NextResponse.json(
        { error: "We couldn't find that client" },
        { status: 404 }
      )
    }

    const { data: assignments } = await supabase
      .from('client_programs')
      .select('id, program_id, status, started_at, completed_at, created_at')
      .eq('client_id', clientId)
      .eq('workspace_id', coach.workspace_id)
      .order('created_at', { ascending: false })

    if (!assignments?.length) {
      return NextResponse.json({ data: [] })
    }

    const programIds = [...new Set(assignments.map((a) => a.program_id))]
    const { data: programs } = await supabase
      .from('programs')
      .select('id, title, status')
      .in('id', programIds)

    const programMap = new Map((programs ?? []).map((p) => [p.id, p]))
    const clientProgramIds = assignments.map((a) => a.id)
    const { data: progressRows } = await supabase
      .from('program_progress')
      .select('client_program_id, module_id, completed_at')
      .in('client_program_id', clientProgramIds)

    const completedByClientProgram: Record<string, number> = {}
    for (const p of progressRows ?? []) {
      if (p.completed_at) {
        completedByClientProgram[p.client_program_id] =
          (completedByClientProgram[p.client_program_id] ?? 0) + 1
      }
    }

    const { data: programModules } = await supabase
      .from('program_modules')
      .select('program_id')
      .in('program_id', programIds)
    const totalModulesByProgram: Record<string, number> = {}
    for (const m of programModules ?? []) {
      totalModulesByProgram[m.program_id] = (totalModulesByProgram[m.program_id] ?? 0) + 1
    }

    const data = assignments.map((a) => {
      const prog = programMap.get(a.program_id)
      const totalModules = totalModulesByProgram[a.program_id] ?? 0
      const modulesCompleted = completedByClientProgram[a.id] ?? 0
      return {
        clientProgramId: a.id,
        programId: a.program_id,
        title: prog?.title ?? 'Untitled',
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
