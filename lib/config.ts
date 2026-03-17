/**
 * Tenant / client ID for this deployment. Used for RLS and tenant isolation.
 */
export function getClientId(): string {
  return process.env.NEXT_PUBLIC_CLIENT_ID ?? 'default'
}
