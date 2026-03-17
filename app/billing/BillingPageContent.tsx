'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { format } from 'date-fns'

type Plan = 'free' | 'starter' | 'pro' | 'scale'
type Status = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused'

export interface BillingPageContentProps {
  subscription: {
    plan: Plan
    status: Status
    current_period_end: string | null
    trial_ends_at: string | null
  } | null
  hasStripeCustomer: boolean
}

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  scale: 'Scale',
}

const STATUS_LABELS: Record<Status, string> = {
  trialing: 'Trial',
  active: 'Active',
  past_due: 'Past due',
  cancelled: 'Cancelled',
  paused: 'Paused',
}

const PRICING = [
  { plan: 'starter' as const, price: '$49', period: '/mo', clients: 'up to 10 clients', storage: '5GB video storage', features: 'All core features' },
  { plan: 'pro' as const, price: '$99', period: '/mo', clients: 'up to 30 clients', storage: '25GB video storage', features: 'Priority support' },
  { plan: 'scale' as const, price: '$199', period: '/mo', clients: 'Unlimited clients', storage: '100GB video storage', features: 'Dedicated support' },
]

export function BillingPageContent({ subscription, hasStripeCustomer }: BillingPageContentProps) {
  const searchParams = useSearchParams()
  const success = searchParams.get('success') === 'true'
  const cancelled = searchParams.get('cancelled') === 'true'
  const warningPastDue = searchParams.get('warning') === 'past_due'
  const warningCancelled = searchParams.get('warning') === 'cancelled'

  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const currentPlan = subscription?.plan ?? 'free'

  const handleCheckout = async (plan: 'starter' | 'pro' | 'scale') => {
    setLoadingPlan(plan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const json = await res.json()
      if (res.ok && json.data?.url) {
        window.location.href = json.data.url
        return
      }
      alert(json.error ?? 'Could not start checkout')
    } catch {
      alert('Something went wrong — try again')
    } finally {
      setLoadingPlan(null)
    }
  }

  const handlePortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const json = await res.json()
      if (res.ok && json.data?.url) {
        window.location.href = json.data.url
        return
      }
      alert(json.error ?? 'Could not open billing portal')
    } catch {
      alert('Something went wrong — try again')
    } finally {
      setPortalLoading(false)
    }
  }

  const planOrder: Plan[] = ['starter', 'pro', 'scale']
  const currentIndex = planOrder.indexOf(currentPlan)

  return (
    <main className="min-h-screen p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader title="Billing" />

      {success && (
        <div className="rounded-xl border border-[var(--color-success)] bg-[var(--color-success-light)] px-4 py-3 text-[15px] text-[var(--color-success)]">
          Your subscription is active.{' '}
          {subscription && subscription.plan !== 'free'
            ? `Welcome to ClearPath ${PLAN_LABELS[subscription.plan]}!`
            : 'Welcome to ClearPath!'}
        </div>
      )}
      {cancelled && (
        <div className="rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-4 py-3 text-[15px] text-[var(--color-warning)]">
          Checkout cancelled. Your plan was not changed.
        </div>
      )}
      {warningPastDue && (
        <div className="rounded-xl border border-[var(--color-error)] bg-[var(--color-error-light)] px-4 py-3 text-[15px] text-[var(--color-error)]">
          Payment failed — update your payment method to keep access.
        </div>
      )}
      {warningCancelled && (
        <div className="rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-4 py-3 text-[15px] text-[var(--color-warning)]">
          Your plan was cancelled. Renew to keep access.
        </div>
      )}

      {/* Current plan card */}
      <Card variant="raised" padding="lg" className={currentPlan !== 'free' ? 'border-2 border-[var(--color-accent)]' : ''}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="active" className="capitalize">{PLAN_LABELS[currentPlan]}</Badge>
          <Badge
            variant={
              subscription?.status === 'past_due' ? 'error' :
              subscription?.status === 'cancelled' ? 'pending' :
              subscription?.status === 'trialing' ? 'pending' : 'active'
            }
          >
            {subscription ? STATUS_LABELS[subscription.status] : 'Active'}
          </Badge>
        </div>
        {subscription?.status === 'trialing' && subscription.trial_ends_at && (
          <p className="mt-2 text-[15px] text-[var(--color-text-secondary)]">
            Your trial ends {format(new Date(subscription.trial_ends_at), 'MMMM d, yyyy')}.
          </p>
        )}
        {subscription?.status === 'active' && subscription.current_period_end && (
          <p className="mt-2 text-[15px] text-[var(--color-text-secondary)]">
            Next billing date {format(new Date(subscription.current_period_end), 'MMMM d, yyyy')}.
          </p>
        )}
        {subscription?.status === 'past_due' && (
          <p className="mt-2 text-[15px] text-[var(--color-error)]">
            Payment failed — update your payment method to keep access.
          </p>
        )}
        {subscription?.status === 'cancelled' && (
          <p className="mt-2 text-[15px] text-[var(--color-warning)]">
            Your plan was cancelled. Renew to keep access.
          </p>
        )}
      </Card>

      {/* Pricing cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {PRICING.map(({ plan, price, period, clients, storage, features }) => {
          const isCurrent = currentPlan === plan
          const planIndex = planOrder.indexOf(plan)
          const isUpgrade = planIndex > currentIndex
          const isDowngrade = planIndex < currentIndex && currentPlan !== 'free'
          const buttonLabel = isCurrent ? 'Current plan' : isUpgrade ? 'Upgrade' : isDowngrade ? 'Downgrade' : 'Upgrade'
          return (
            <Card
              key={plan}
              variant="raised"
              padding="lg"
              className={isCurrent ? 'border-2 border-[var(--color-accent)]' : ''}
            >
              <div className="font-medium text-[var(--color-text-primary)]">
                {PLAN_LABELS[plan]}
              </div>
              <div className="mt-1 text-2xl font-medium text-[var(--color-text-primary)]">
                {price}<span className="text-base font-normal text-[var(--color-text-secondary)]">{period}</span>
              </div>
              <ul className="mt-3 space-y-1 text-[15px] text-[var(--color-text-secondary)]">
                <li>{clients}</li>
                <li>{storage}</li>
                <li>{features}</li>
              </ul>
              <div className="mt-4">
                <Button
                  variant={isCurrent ? 'secondary' : 'primary'}
                  fullWidth
                  disabled={isCurrent || loadingPlan !== null}
                  onClick={() => !isCurrent && (plan === 'starter' || plan === 'pro' || plan === 'scale') && handleCheckout(plan)}
                >
                  {loadingPlan === plan ? 'Redirecting…' : buttonLabel}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {hasStripeCustomer && (
        <Card variant="flat" padding="default">
          <Button variant="secondary" onClick={handlePortal} disabled={portalLoading}>
            {portalLoading ? 'Opening…' : 'Manage billing'}
          </Button>
          <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
            Update payment method, view invoices, or change plan in Stripe.
          </p>
        </Card>
      )}
    </main>
  )
}
