import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { sendMessageSchema } from '@/lib/validations'

/**
 * GET /api/messages?clientId=[id]
 * Returns all messages in the thread for that client, ordered by created_at ASC.
 * Verifies the requesting user is either the coach of that workspace OR the client themselves.
 * Rate limit: 100 per minute per user.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success, retryAfter } = await checkRateLimitAsync(`messages-get:${user.id}`, {
      windowMs: 60_000,
      max: 100,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')?.trim()
    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      )
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, workspace_id, email')
      .eq('id', clientId)
      .maybeSingle()

    if (clientError || !client) {
      return NextResponse.json(
        { error: "We couldn't find that client — it may have been deleted" },
        { status: 404 }
      )
    }

    const { data: coach } = await supabase
      .from('coaches')
      .select('user_id')
      .eq('workspace_id', client.workspace_id)
      .maybeSingle()

    const isCoach = coach?.user_id === user.id
    const isClient = !!user.email && client.email === user.email
    if (!isCoach && !isClient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, workspace_id, sender_id, recipient_id, client_id, content, read_at, created_at, message_type')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not load messages' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: messages ?? [] })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/messages
 * Body: { clientId, content }
 * Sets sender_id = current user, recipient_id = the other party.
 * Rate limit: 60 per minute per user.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success, retryAfter } = await checkRateLimitAsync(`messages-send:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = sendMessageSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { clientId, content } = parsed.data

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, workspace_id, email')
      .eq('id', clientId)
      .maybeSingle()

    if (clientError || !client) {
      return NextResponse.json(
        { error: "We couldn't find that client — it may have been deleted" },
        { status: 404 }
      )
    }

    const { data: coach } = await supabase
      .from('coaches')
      .select('user_id')
      .eq('workspace_id', client.workspace_id)
      .maybeSingle()

    if (!coach) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    const isCoach = coach.user_id === user.id
    let recipient_id: string
    if (isCoach) {
      if (!client.email) {
        return NextResponse.json(
          { error: "This client doesn't have an account yet — they need to accept an invite first" },
          { status: 400 }
        )
      }
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', client.email)
        .maybeSingle()
      if (!clientProfile) {
        return NextResponse.json(
          { error: "This client doesn't have an account yet — they need to accept an invite first" },
          { status: 400 }
        )
      }
      recipient_id = clientProfile.id
    } else {
      if (user.email !== client.email) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      recipient_id = coach.user_id
    }

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        workspace_id: client.workspace_id,
        sender_id: user.id,
        recipient_id,
        client_id: clientId,
        content,
      })
      .select('id, workspace_id, sender_id, recipient_id, client_id, content, read_at, created_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not send message' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: message })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
