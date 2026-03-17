/**
 * Rate limiting for middleware and API routes.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set;
 * otherwise no limit (allow all) for local dev.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

export type RateLimitOptions = {
  windowMs: number
  max: number
}

export type RateLimitResult = {
  success: boolean
  retryAfter?: number
}

async function checkWithUpstash(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  try {
    const { Ratelimit } = await import('@upstash/ratelimit')
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({
      url: REDIS_URL!,
      token: REDIS_TOKEN!,
    })
    const windowSeconds = Math.ceil(options.windowMs / 1000)
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(options.max, `${windowSeconds} s`),
    })
    const { success, pending, reset } = await ratelimit.limit(key)
    if (success) return { success: true }
    const retryAfter = Math.ceil((reset - Date.now()) / 1000)
    return { success: false, retryAfter: Math.max(1, retryAfter) }
  } catch {
    return { success: true }
  }
}

/**
 * Async rate limit check for use in middleware and API routes.
 * 11-auth: /login, /forgot-password — 30 requests/min per IP.
 */
export async function checkRateLimitAsync(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    return { success: true }
  }
  return checkWithUpstash(key, options)
}
