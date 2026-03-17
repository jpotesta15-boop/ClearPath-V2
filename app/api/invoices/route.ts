import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createInvoiceSchema } from '@/lib/validations'
import { checkRateLimitAsync } from '@/lib/rate-limit'

/**
 * GET /api/invoices — list invoices for the workspace. Coach only.
 * Query: ?clientId=uuid, ?status=pending|paid|cancelled|refunded
 */
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')?.trim()
    const status = searchParams.get('status')?.trim()

    let query = supabase
      .from('session_invoices')
      .select(`
        id, workspace_id, package_id, coach_id, client_id, amount_cents, currency, status,
        payment_method, payment_method_note, payment_reference, message_id, session_id,
        due_date, paid_at, created_at, updated_at,
        session_packages(id, title, description),
        clients(id, first_name, last_name, email)
      `)
      .eq('workspace_id', coach.workspace_id)
      .order('created_at', { ascending: false })

    if (clientId) {
      query = query.eq('client_id', clientId)
    }
    if (status && ['pending', 'paid', 'cancelled', 'refunded'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not load invoices' },
        { status: 500 }
      )
    }
    return NextResponse.json({ data: data ?? [] })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/invoices — create invoice (status: pending) and a message in the thread as invoice card. Coach only.
 * Body: { packageId, clientId, dueDate? }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`api-invoices:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
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
    const parsed = createInvoiceSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { packageId, clientId, dueDate } = parsed.data

    const { data: pkg, error: pkgError } = await supabase
      .from('session_packages')
      .select('id, title, description, price_cents, currency')
      .eq('id', packageId)
      .eq('workspace_id', coach.workspace_id)
      .eq('is_active', true)
      .maybeSingle()

    if (pkgError || !pkg) {
      return NextResponse.json(
        { error: "We couldn't find that package — it may have been deleted or deactivated" },
        { status: 404 }
      )
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, workspace_id, email')
      .eq('id', clientId)
      .eq('workspace_id', coach.workspace_id)
      .maybeSingle()

    if (clientError || !client) {
      return NextResponse.json(
        { error: "We couldn't find that client" },
        { status: 404 }
      )
    }

    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', client.email)
      .maybeSingle()

    const recipientId = clientProfile?.id ?? user.id

    const dueDateValue = dueDate ? new Date(dueDate).toISOString() : null

    const { data: invoice, error: invError } = await supabase
      .from('session_invoices')
      .insert({
        workspace_id: coach.workspace_id,
        package_id: pkg.id,
        coach_id: user.id,
        client_id: client.id,
        amount_cents: pkg.price_cents,
        currency: pkg.currency,
        status: 'pending',
        due_date: dueDateValue,
      })
      .select('id, amount_cents, currency, status, due_date, created_at')
      .single()

    if (invError) {
      return NextResponse.json(
        { error: invError.message || 'Could not create invoice' },
        { status: 500 }
      )
    }

    const invoiceCardContent = JSON.stringify({
      type: 'invoice',
      invoiceId: invoice.id,
      packageTitle: pkg.title,
      packageDescription: pkg.description ?? null,
      amountCents: invoice.amount_cents,
      currency: invoice.currency,
      status: invoice.status,
      dueDate: dueDateValue,
    })

    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        workspace_id: coach.workspace_id,
        sender_id: user.id,
        recipient_id: recipientId,
        client_id: client.id,
        content: invoiceCardContent,
        message_type: 'invoice',
      })
      .select('id')
      .single()

    if (msgError) {
      await supabase.from('session_invoices').delete().eq('id', invoice.id)
      return NextResponse.json(
        { error: 'Could not add invoice to message thread — try again' },
        { status: 500 }
      )
    }

    await supabase
      .from('session_invoices')
      .update({ message_id: message.id })
      .eq('id', invoice.id)

    const { data: fullInvoice } = await supabase
      .from('session_invoices')
      .select('id, package_id, client_id, amount_cents, currency, status, due_date, message_id, created_at')
      .eq('id', invoice.id)
      .single()

    return NextResponse.json({ data: fullInvoice })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
