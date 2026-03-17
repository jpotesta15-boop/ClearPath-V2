import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/invoices/[id]/cancel — set status = cancelled. Coach only.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: invoiceId } = await context.params
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

    const { data: invoice, error: fetchErr } = await supabase
      .from('session_invoices')
      .select('id, message_id')
      .eq('id', invoiceId)
      .eq('workspace_id', coach.workspace_id)
      .single()

    if (fetchErr || !invoice) {
      return NextResponse.json(
        { error: "We couldn't find that invoice" },
        { status: 404 }
      )
    }

    const { error: upErr } = await supabase
      .from('session_invoices')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('workspace_id', coach.workspace_id)

    if (upErr) {
      return NextResponse.json(
        { error: upErr.message || 'Could not cancel invoice' },
        { status: 500 }
      )
    }

    if (invoice.message_id) {
      const { data: msg } = await supabase
        .from('messages')
        .select('content')
        .eq('id', invoice.message_id)
        .single()
      if (msg?.content) {
        try {
          const payload = JSON.parse(msg.content) as Record<string, unknown>
          await supabase
            .from('messages')
            .update({
              content: JSON.stringify({ ...payload, status: 'cancelled' }),
            })
            .eq('id', invoice.message_id)
        } catch {
          // non-fatal
        }
      }
    }

    return NextResponse.json({ data: 'ok' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
