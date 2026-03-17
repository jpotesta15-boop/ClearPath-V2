import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { stripe, STRIPE_PRICES } from '@/lib/stripe'

const planValues = ['starter', 'pro', 'scale'] as const

/**
 * POST /api/billing/checkout — create Stripe Checkout session for subscription (coach only).
 * Body: { plan: 'starter' | 'pro' | 'scale' }.
 * Rate limit: 10 per hour per user.
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

    const { success, retryAfter } = await checkRateLimitAsync(`billing-checkout:${user.id}`, {
      windowMs: 60 * 60 * 1000,
      max: 10,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait an hour and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const plan = body?.plan as string | undefined
    if (!plan || !planValues.includes(plan as typeof planValues[number])) {
      return NextResponse.json(
        { error: 'Invalid plan — must be starter, pro, or scale' },
        { status: 400 }
      )
    }
    const key = plan as typeof planValues[number]
    const priceId = STRIPE_PRICES[key]
    if (!priceId || !stripe) {
      return NextResponse.json(
        { error: 'Billing is not configured — please try again later' },
        { status: 500 }
      )
    }

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('stripe_customer_id')
      .eq('id', coach.workspace_id)
      .maybeSingle()

    let stripeCustomerId = workspace?.stripe_customer_id ?? null
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { workspace_id: coach.workspace_id },
      })
      stripeCustomerId = customer.id
      const { error: updateErr } = await supabase
        .from('workspaces')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', coach.workspace_id)
      if (updateErr) {
        return NextResponse.json(
          { error: 'Could not save billing account — please try again' },
          { status: 500 }
        )
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.headers.get('origin') ?? 'https://app.clearpath.com'
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/billing?success=true`,
      cancel_url: `${baseUrl}/billing?cancelled=true`,
      metadata: { workspace_id: coach.workspace_id },
    })

    const url = session.url
    if (!url) {
      return NextResponse.json(
        { error: 'Could not create checkout session — please try again' },
        { status: 502 }
      )
    }
    return NextResponse.json({ data: { url } })
  } catch (e) {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
