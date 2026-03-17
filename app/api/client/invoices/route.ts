import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * GET /api/client/invoices — list invoices for the current client (by email). Client only.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, workspace_id')
      .eq('email', user.email)
      .maybeSingle()

    if (clientError || !client) {
      return NextResponse.json(
        { error: "We couldn't find your client record" },
        { status: 404 }
      )
    }

    const { data: invoices, error } = await supabase
      .from('session_invoices')
      .select(`
        id, amount_cents, currency, status, due_date, paid_at, created_at,
        session_packages(id, title, description)
      `)
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not load invoices' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: invoices ?? [] })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
