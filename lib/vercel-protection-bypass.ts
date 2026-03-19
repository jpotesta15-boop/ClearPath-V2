/**
 * Vercel Deployment Protection — "Protection Bypass for Automation".
 * @see https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
 *
 * Set the same secret in Vercel env as you generated in the dashboard (either name works):
 * - VERCEL_AUTOMATION_BYPASS_SECRET (matches Vercel docs naming)
 * - VERCEL_PROTECTION_BYPASS_SECRET (alias)
 */
export function getVercelAutomationBypassSecret(): string | undefined {
  const a = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()
  const b = process.env.VERCEL_PROTECTION_BYPASS_SECRET?.trim()
  return a || b || undefined
}

/** Append ?x-vercel-protection-bypass=... for webhooks that cannot send custom headers (e.g. CloudConvert). */
export function withVercelProtectionBypassQuery(url: string): string {
  const bypass = getVercelAutomationBypassSecret()
  if (!bypass) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}x-vercel-protection-bypass=${encodeURIComponent(bypass)}`
}
