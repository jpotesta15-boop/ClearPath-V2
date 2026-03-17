import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const COACHING_TYPES = [
  'Fitness',
  'Life',
  'Business',
  'Nutrition',
  'Mindset',
  'Performance',
  'Career',
  'Relationships',
  'Other',
] as const

/**
 * POST /api/onboarding/coaching — save Step 2: coaching_types, current_client_count.
 * Coach only.
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
    const rawTypes = Array.isArray(body.coaching_types) ? body.coaching_types : []
    const coachingTypes = rawTypes
      .filter((t: unknown) => typeof t === 'string' && COACHING_TYPES.includes(t as (typeof COACHING_TYPES)[number]))
      .map((t: string) => t)
    const rawCount = body.current_client_count
    const validCount =
      typeof rawCount === 'number' && Number.isInteger(rawCount) && rawCount >= 0
        ? rawCount
        : typeof rawCount === 'string' && rawCount.trim() !== ''
          ? (() => {
              const n = parseInt(rawCount.trim(), 10)
              return !Number.isNaN(n) && n >= 0 ? n : null
            })()
          : null

    const { error } = await supabase
      .from('workspaces')
      .update({
        coaching_types: coachingTypes.length > 0 ? coachingTypes : null,
        current_client_count: validCount,
      })
      .eq('id', coach.workspace_id)

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not update workspace' },
        { status: 500 }
      )
    }
    return NextResponse.json({ data: 'Saved' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
