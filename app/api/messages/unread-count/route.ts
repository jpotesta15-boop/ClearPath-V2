import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * GET /api/messages/unread-count
 * Returns total count of messages where recipient_id = auth.uid() AND read_at IS NULL.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null)

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not load unread count' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: { count: count ?? 0 } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
