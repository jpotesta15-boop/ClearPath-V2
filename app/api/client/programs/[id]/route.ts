import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/client/programs/[id] — full program with modules, content blocks, and client's progress. Client only.
 * [id] = program_id (client must have an active/completed assignment for this program).
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id: programId } = await context.params
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
      return NextResponse.json(
        { error: "We couldn't find your client record" },
        { status: 403 }
      )
    }

    const { data: clientProgram } = await supabase
      .from('client_programs')
      .select('id')
      .eq('program_id', programId)
      .eq('client_id', client.id)
      .in('status', ['active', 'completed'])
      .maybeSingle()
    if (!clientProgram) {
      return NextResponse.json(
        { error: "We couldn't find that program — it may not be assigned to you" },
        { status: 404 }
      )
    }

    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('id, title, description, thumbnail_url, status, total_modules')
      .eq('id', programId)
      .single()

    if (programError || !program) {
      return NextResponse.json(
        { error: "We couldn't find that program — it may have been deleted" },
        { status: 404 }
      )
    }

    const { data: modules } = await supabase
      .from('program_modules')
      .select('id, program_id, title, description, position, created_at, updated_at')
      .eq('program_id', programId)
      .order('position', { ascending: true })

    const moduleIds = (modules ?? []).map((m) => m.id)
    let content: { id: string; module_id: string; content_type: string; title: string | null; body: string | null; url: string | null; video_id: string | null; file_url: string | null; position: number }[] = []
    if (moduleIds.length > 0) {
      const { data: contentRows } = await supabase
        .from('program_content')
        .select('id, module_id, content_type, title, body, url, video_id, file_url, position')
        .in('module_id', moduleIds)
        .order('position', { ascending: true })
      content = (contentRows ?? []) as typeof content
    }

    const { data: progressRows } = await supabase
      .from('program_progress')
      .select('module_id, completed_at')
      .eq('client_program_id', clientProgram.id)

    const completedModuleIds = new Set(
      (progressRows ?? []).filter((p) => p.completed_at).map((p) => p.module_id)
    )

    const modulesWithContent = (modules ?? []).map((m) => ({
      ...m,
      content: content.filter((c) => c.module_id === m.id),
      completed: completedModuleIds.has(m.id),
    }))

    const totalModules = program.total_modules ?? modulesWithContent.length
    const modulesCompleted = completedModuleIds.size

    return NextResponse.json({
      data: {
        ...program,
        clientProgramId: clientProgram.id,
        modules: modulesWithContent,
        progress: {
          modulesCompleted,
          totalModules,
        },
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
