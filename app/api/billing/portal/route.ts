import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { stripe } from '@/lib/stripe'

/**
 * POST /api/billing/portal — create Stripe Customer Portal session (coach only).
 * Returns URL to redirect coach to manage billing, payment method, invoices.
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

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('stripe_customer_id')
      .eq('id', coach.workspace_id)
      .maybeSingle()

    const stripeCustomerId = workspace?.stripe_customer_id
    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account found' },
        { status: 400 }
      )
    }
    if (!stripe) {
      return NextResponse.json(
        { error: 'Billing is not configured — please try again later' },
        { status: 500 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.headers.get('origin') ?? 'https://app.clearpath.com'
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/billing`,
    })
    const url = session.url
    if (!url) {
      return NextResponse.json(
        { error: 'Could not open billing portal — please try again' },
        { status: 502 }
      )
    }
    return NextResponse.json({ data: { url } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
