/**
 * Plan limits per workspace (Session 10 — T2 billing).
 * Used to enforce client count and (future) video storage before writes.
 */

import { createServiceClient } from '@/lib/supabase/service'

export const PLAN_LIMITS = {
  free: { maxClients: 3, maxVideoStorageGb: 1 },
  starter: { maxClients: 10, maxVideoStorageGb: 5 },
  pro: { maxClients: 30, maxVideoStorageGb: 25 },
  scale: { maxClients: null as number | null, maxVideoStorageGb: 100 },
} as const

export type PlanSlug = keyof typeof PLAN_LIMITS

export interface ClientLimitResult {
  allowed: boolean
  current: number
  max: number | null
}

/**
 * Check if the workspace can add one more client.
 * Uses subscription plan; if no subscription row, treats as free.
 */
export async function checkClientLimit(workspaceId: string): Promise<ClientLimitResult> {
  const supabase = createServiceClient()
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  const plan = (sub?.plan ?? 'free') as PlanSlug
  const max = PLAN_LIMITS[plan].maxClients

  const { count, error } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  if (error) {
    return { allowed: false, current: 0, max }
  }
  const current = count ?? 0
  const allowed = max === null ? true : current < max
  return { allowed, current, max }
}
