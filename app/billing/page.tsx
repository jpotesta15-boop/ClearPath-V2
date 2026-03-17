import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { BillingPageContent } from './BillingPageContent'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: coach } = await supabase
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!coach?.workspace_id) redirect('/coach/dashboard')

  const [subResult, workspaceResult] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('plan, status, current_period_end, trial_ends_at')
      .eq('workspace_id', coach.workspace_id)
      .maybeSingle(),
    supabase
      .from('workspaces')
      .select('stripe_customer_id')
      .eq('id', coach.workspace_id)
      .maybeSingle(),
  ])

  const subscription = subResult.data
    ? {
        plan: subResult.data.plan as 'free' | 'starter' | 'pro' | 'scale',
        status: subResult.data.status as 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused',
        current_period_end: subResult.data.current_period_end,
        trial_ends_at: subResult.data.trial_ends_at,
      }
    : null
  const hasStripeCustomer = Boolean(workspaceResult.data?.stripe_customer_id)

  return (
    <Suspense fallback={null}>
      <BillingPageContent
        subscription={subscription}
        hasStripeCustomer={hasStripeCustomer}
      />
    </Suspense>
  )
}
