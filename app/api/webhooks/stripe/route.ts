import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe, STRIPE_WEBHOOK_SECRET, STRIPE_PRICES } from '@/lib/stripe'
import type Stripe from 'stripe'

/**
 * POST /api/webhooks/stripe — Stripe webhook (subscriptions + existing checkout logic).
 * No Supabase session; verify Stripe signature. Use raw body for verification.
 * Always return 200 so Stripe does not retry (log errors internally).
 */

function priceIdToPlan(priceId: string): 'starter' | 'pro' | 'scale' | null {
  for (const [plan, id] of Object.entries(STRIPE_PRICES)) {
    if (id === priceId) return plan as 'starter' | 'pro' | 'scale'
  }
  return null
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature || !STRIPE_WEBHOOK_SECRET || !stripe) {
    return NextResponse.json({ error: 'Missing signature or config' }, { status: 400 })
  }
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    const { data: existing } = await supabase
      .from('stripe_webhook_events')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ received: true })
    }
    await supabase.from('stripe_webhook_events').insert({ event_id: event.id })
  } catch {
    return NextResponse.json({ received: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription' || !session.subscription) {
          return NextResponse.json({ received: true })
        }
        const workspaceId = session.metadata?.workspace_id as string | undefined
        if (!workspaceId) return NextResponse.json({ received: true })

        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = sub.items.data[0]?.price?.id
        const plan = priceId ? priceIdToPlan(priceId) ?? 'starter' : 'starter'
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null
        const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null

        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('workspace_id', workspaceId)
          .maybeSingle()

        const row = {
          workspace_id: workspaceId,
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          plan,
          status: (sub.status === 'trialing' ? 'trialing' : sub.status === 'active' ? 'active' : 'past_due') as 'trialing' | 'active' | 'past_due',
          current_period_end: periodEnd,
          trial_ends_at: trialEnd,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
          updated_at: new Date().toISOString(),
        }
        if (existingSub) {
          await supabase.from('subscriptions').update(row).eq('workspace_id', workspaceId)
        } else {
          await supabase.from('subscriptions').insert(row)
        }
        if (customerId) {
          await supabase.from('workspaces').update({ stripe_customer_id: customerId }).eq('id', workspaceId)
        }
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const priceId = sub.items.data[0]?.price?.id
        const plan = priceId ? priceIdToPlan(priceId) ?? 'starter' : 'starter'
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null
        const status = (sub.status === 'trialing' ? 'trialing' : sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : sub.status === 'canceled' || sub.status === 'unpaid' ? 'cancelled' : 'paused') as 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused'

        const { data: row } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle()
        if (row) {
          await supabase
            .from('subscriptions')
            .update({
              status,
              plan,
              current_period_end: periodEnd,
              cancel_at_period_end: sub.cancel_at_period_end ?? false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id)
        }
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const { data: row } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle()
        if (row) {
          await supabase
            .from('subscriptions')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', row.id)
        }
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (!customerId) break
        const { data: row } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        if (row) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('id', row.id)
        }
        break
      }
      default:
        break
    }
  } catch {
    // Log internally; still return 200
  }
  return NextResponse.json({ received: true })
}
