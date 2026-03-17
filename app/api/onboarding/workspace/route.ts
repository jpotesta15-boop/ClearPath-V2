import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * POST /api/onboarding/workspace — save Step 1: workspace name, logo_url, avatar (profile) URL.
 * Coach only; updates workspaces and coach_profiles.
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

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 2) {
      return NextResponse.json(
        { error: 'Workspace name must be at least 2 characters' },
        { status: 400 }
      )
    }
    const logoUrl = typeof body.logo_url === 'string' ? body.logo_url.trim() || null : null
    const avatarUrl = typeof body.avatar_url === 'string' ? body.avatar_url.trim() || null : null

    const { error: workspaceError } = await supabase
      .from('workspaces')
      .update({ name, logo_url: logoUrl })
      .eq('id', coach.workspace_id)

    if (workspaceError) {
      return NextResponse.json(
        { error: workspaceError.message || 'Could not update workspace' },
        { status: 500 }
      )
    }

    if (avatarUrl !== null) {
      const { data: existing } = await supabase
        .from('coach_profiles')
        .select('coach_id')
        .eq('coach_id', user.id)
        .maybeSingle()
      if (existing) {
        await supabase
          .from('coach_profiles')
          .update({ profile_image_url: avatarUrl, updated_at: new Date().toISOString() })
          .eq('coach_id', user.id)
      } else {
        await supabase.from('coach_profiles').insert({
          coach_id: user.id,
          workspace_id: coach.workspace_id,
          profile_image_url: avatarUrl,
        })
      }
    }

    return NextResponse.json({ data: 'Saved' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
