import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * GET /api/client/invoices/pending-count — count of pending invoices for current client. Client only.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ data: { count: 0 } })
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('email', user.email)
      .maybeSingle()

    if (!client) {
      return NextResponse.json({ data: { count: 0 } })
    }

    const { count, error } = await supabase
      .from('session_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id)
      .eq('status', 'pending')

    if (error) {
      return NextResponse.json({ data: { count: 0 } })
    }

    return NextResponse.json({ data: { count: count ?? 0 } })
  } catch {
    return NextResponse.json({ data: { count: 0 } })
  }
}
