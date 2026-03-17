import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { markMessagesReadSchema } from '@/lib/validations'

/**
 * PATCH /api/messages/read
 * Body: { clientId }
 * Marks all messages WHERE recipient_id = auth.uid() AND client_id = clientId AND read_at IS NULL
 * with read_at = now().
 * Returns { data: 'marked read' }.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = markMessagesReadSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { clientId } = parsed.data

    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', user.id)
      .eq('client_id', clientId)
      .is('read_at', null)

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not mark messages as read' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: 'marked read' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
