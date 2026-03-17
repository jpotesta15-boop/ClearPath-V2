import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'

/**
 * POST /api/auth/signup-complete — create workspace, profile, coach for the current session user.
 * Called after client-side signUp(). Uses session only (anon key); RLS allows insert when owner_id/user_id = auth.uid().
 * Rate limit: 5 attempts per 15 minutes per IP.
 */
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const { success, retryAfter } = await checkRateLimitAsync(`signup:${ip}`, {
      windowMs: 15 * 60 * 1000,
      max: 5,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many signup attempts. Please try again in 15 minutes.' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json(
        { error: 'Please confirm your email first, then sign in to continue.' },
        { status: 401 }
      )
    }

    const { data: existingCoach } = await supabase
      .from('coaches')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (existingCoach) {
      return NextResponse.json({ data: 'ok' })
    }

    const firstName =
      (user.user_metadata?.full_name as string)?.trim() || 'Coach'
    const workspaceName = `${firstName}'s Workspace`
    const emailTrimmed = (user.email ?? '').trim().toLowerCase()

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({ name: workspaceName, owner_id: user.id })
      .select('id')
      .single()

    if (workspaceError || !workspace?.id) {
      return NextResponse.json(
        {
          error:
            workspaceError?.message ??
            'Could not create your workspace — please try again.',
        },
        { status: 500 }
      )
    }

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        email: user.email ?? emailTrimmed,
        full_name: firstName,
        role: 'coach',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    if (profileError) {
      return NextResponse.json(
        {
          error:
            profileError.message ??
            'Could not create your profile — please try again.',
        },
        { status: 500 }
      )
    }

    const { error: coachError } = await supabase.from('coaches').insert({
      user_id: user.id,
      workspace_id: workspace.id,
      role: 'owner',
    })
    if (coachError) {
      return NextResponse.json(
        {
          error:
            coachError.message ??
            'Could not link your account — please try again.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: 'ok' })
  } catch (err) {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again.' },
      { status: 500 }
    )
  }
}
