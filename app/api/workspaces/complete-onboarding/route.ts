import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * PATCH /api/workspaces/complete-onboarding — set completed_onboarding = true.
 * Coach only. Called only from onboarding step 4 (success screen).
 */
export async function PATCH() {
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

    const { error } = await supabase
      .from('workspaces')
      .update({ completed_onboarding: true })
      .eq('id', coach.workspace_id)

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not complete onboarding' },
        { status: 500 }
      )
    }
    return NextResponse.json({ data: 'Onboarding complete' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
