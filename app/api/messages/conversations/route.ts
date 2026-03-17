import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * GET /api/messages/conversations
 * Coach only. Returns list of clients who have a message thread, with last message preview and unread count.
 */
export async function GET() {
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

    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, client_id, sender_id, recipient_id, content, read_at, created_at')
      .eq('workspace_id', coach.workspace_id)
      .order('created_at', { ascending: false })

    if (msgError) {
      return NextResponse.json(
        { error: msgError.message || 'Could not load conversations' },
        { status: 500 }
      )
    }

    const lastByClient = new Map<string, { content: string; createdAt: string }>()
    const unreadByClient = new Map<string, number>()
    for (const m of messages ?? []) {
      if (!m.client_id) continue
      if (!lastByClient.has(m.client_id)) {
        lastByClient.set(m.client_id, {
          content: m.content ?? '',
          createdAt: m.created_at ?? '',
        })
      }
      if (m.recipient_id === user.id && !m.read_at) {
        unreadByClient.set(m.client_id, (unreadByClient.get(m.client_id) ?? 0) + 1)
      }
    }

    const clientIds = [...lastByClient.keys()]
    if (clientIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, first_name, last_name, status')
      .in('id', clientIds)

    if (clientError || !clients) {
      return NextResponse.json(
        { error: 'Could not load clients' },
        { status: 500 }
      )
    }

    const conversations = clients.map((c) => {
      const last = lastByClient.get(c.id)!
      const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown'
      const preview =
        last.content.length > 50 ? last.content.slice(0, 50).trim() + '…' : last.content
      return {
        clientId: c.id,
        fullName,
        status: c.status ?? 'active',
        lastMessagePreview: preview,
        lastMessageAt: last.createdAt,
        unreadCount: unreadByClient.get(c.id) ?? 0,
      }
    })

    conversations.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    )

    return NextResponse.json({ data: conversations })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
