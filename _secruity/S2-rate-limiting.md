# S2 — Rate limiting audit and V2 plan

## 1. Current state: API routes and server actions

### 1.1 API routes inventory

| Route | Method | Auth | Rate limited? | Notes |
|-------|--------|------|---------------|--------|
| `/api/health` | GET | None | **No** | Readiness check; consider IP-based limit for public abuse. |
| `/api/create-client-account` | POST | Coach (session) | Yes | 20/min per IP via `checkRateLimit` (sync). |
| `/api/invite-client` | POST | Coach (session) | Yes | 20/min per IP via `checkRateLimit` (sync). |
| `/api/auth/callback` | GET | None (OAuth code) | Yes | 15/min per IP via `checkRateLimit` (sync; **per-instance** when no Redis). |
| `/api/stripe/create-checkout-session` | POST | Client (session) | **No** | Imports `checkRateLimitAsync` but **never calls it** (see S1). |
| `/api/stripe/request-payment` | POST | Coach (session) | Yes | 20/min per user via `checkRateLimitAsync`. |
| `/api/stripe/connect/account-link` | POST | Coach (session) | **No** | Creates Stripe Connect links; no limit. |
| `/api/coach/sessions` | POST | Coach (session) | **No** | Creates session + triggers n8n; no limit. |
| `/api/coach/test-n8n` | GET | Coach (session) | **No** | Test webhook; low risk but can be spammed. |
| `/api/calendar/feed` | GET | Coach (session) | **No** | iCal feed; could be polled heavily. |
| `/api/sessions/upcoming` | GET | Bearer (n8n secret) | **No** | Internal/n8n; optional IP or key-based limit. |
| `/api/sessions/[id]/send-reminder` | POST | Coach (session) | Yes | 30/min per user via `checkRateLimitAsync`. |
| `/api/webhooks/stripe` | POST | Stripe signature | **No** | Verified by Stripe; rate limit at Stripe’s side. |
| `/api/webhooks/n8n-session-booked` | POST | Session | **No** | Coach-only; no limit. |
| `/api/webhooks/n8n-video` | POST | Bearer secret | **No** | Server-to-server; optional by source IP. |
| `/api/webhooks/session-created` | GET, POST | Query/header secret | **No** | Supabase webhook; optional by source. |

**Auth-related (no dedicated API):** Login and sign-up use **Supabase client-side** (no `/api/auth/login` or `/api/auth/signup`). Rate limiting applies to:

- **Page loads:** `/login`, `/forgot-password` — limited in **middleware** to 30 requests/min per IP via `checkRateLimitAsync`.
- **OAuth callback:** `GET /auth/callback` — limited in route handler (15/min per IP; sync `checkRateLimit`).

Password reset is handled by Supabase (e.g. magic link); any custom “forgot password” API would fall under auth endpoints below.

### 1.2 Endpoints with **no** rate limiting (summary)

- `GET /api/health`
- `POST /api/stripe/create-checkout-session` (imports limiter but does not use it)
- `POST /api/stripe/connect/account-link`
- `POST /api/coach/sessions`
- `GET /api/coach/test-n8n`
- `GET /api/calendar/feed`
- `GET /api/sessions/upcoming`
- `POST /api/webhooks/stripe` (signature-verified; typically not rate-limited by app)
- `POST /api/webhooks/n8n-session-booked`
- `POST /api/webhooks/n8n-video`
- `GET` / `POST /api/webhooks/session-created`

### 1.3 Server actions

- No `"use server"` modules were found. All identified server-side behavior is in API route handlers and middleware. If server actions are added later, they should be grouped into the same categories below and rate-limited in the action or via a shared helper.

### 1.4 Implementation quirk

- **`lib/rate-limit.ts`:** When Upstash Redis is configured, `checkRateLimitAsync` uses a **single** `Ratelimit` instance with fixed `slidingWindow(30, '1 m')`. The `options` argument (`windowMs`, `max`) is **ignored** for Redis; only the in-memory fallback respects it. So routes that pass custom limits (e.g. 20/min) effectively get 30/min when Redis is used. V2 should use per-category limiters or a factory so that `windowMs`/`max` are applied with Redis as well.

---

## 2. V2 rate limiting strategy

### 2.1 Category 1 — Auth endpoints (strictest)

**Scope:** Login page, forgot-password page, OAuth callback, any future auth API (e.g. `/api/auth/login`, `/api/auth/signup`, password reset).

**Suggested limit:** **5 attempts per 15 minutes per IP.**

**Rationale:** Reduces brute-force and credential stuffing; 15-minute window avoids permanent lockout.

**Implementation:**

- **Approach:** **Upstash Redis + `@upstash/ratelimit`** with a dedicated limiter (e.g. `Ratelimit.slidingWindow(5, '15 m')`).
- **Where:** Auth callback in **route handler** (so response can be 429 + `Retry-After`). For **page requests** (`/login`, `/forgot-password`), apply the same limit in **Next.js middleware** so all auth-related hits are counted in one place; middleware can return 429 with `Retry-After`.
- **Key:** `auth:{ip}` (or `auth:login:{ip}`, `auth:callback:{ip}` if you want separate counters; a single `auth:{ip}` is simpler and recommended).

**Why not only middleware?** Middleware is good for page loads; a dedicated login **API** (if added) should enforce the same limit in the route so the key is shared and the body of the request is after the limit check. **Why not Vercel edge only?** Vercel’s built-in edge rate limiting is request-based and not tailored to “5 per 15 min per IP” for auth; Upstash gives precise control and shared state across regions.

---

### 2.2 Category 2 — Messaging endpoints

**Scope:** Any API that sends messages (e.g. daily message, reminders, or future chat). Currently: **`POST /api/sessions/[id]/send-reminder`** (and any future messaging APIs).

**Suggested limit:** **60 messages per minute per user** (or 30/min if you want stricter; current send-reminder is 30/min per user).

**Implementation:**

- **Approach:** **Upstash Redis** in the **route handler** with a per-user key, e.g. `msg:{userId}` and `slidingWindow(60, '1 m')`.
- **Where:** First line after auth in each messaging route; return 429 with `Retry-After` when over limit.

**Why route handler:** User identity is available only after session resolution; middleware could rate-limit by IP for unauthenticated requests but messaging is authenticated.

---

### 2.3 Category 3 — File / video upload endpoints

**Scope:** Any route that accepts file or video uploads (e.g. future `/api/upload`, `/api/videos/upload`). Currently there are **no** app routes that accept uploads; n8n-video webhook receives metadata/URL from n8n.

**Suggested limit:** **10 uploads per hour per user.**

**Implementation:**

- **Approach:** **Upstash Redis** in the **route handler**, key `upload:{userId}`, e.g. `slidingWindow(10, '1 h')`.
- **Where:** In the upload route handler after auth; return 429 + `Retry-After` when over limit.

---

### 2.4 Category 4 — General API routes (authenticated)

**Scope:** All other authenticated API routes (e.g. coach/sessions, calendar/feed, stripe/connect/account-link, create-client-account, invite-client, request-payment, create-checkout-session, etc.).

**Suggested limit:** **100 requests per minute per user** (or per IP if you prefer; per user is consistent with “general API” and avoids one IP affecting others behind NAT).

**Implementation:**

- **Approach:** **Option A — Next.js middleware:** For paths under `/api/` (excluding webhooks and health), resolve session (e.g. via Supabase `getUser`), then call Upstash in middleware with key `api:{userId}` and return 429 for over limit. **Option B — Route-level:** Add a shared wrapper or first-line check in each route using Upstash with `api:{userId}` and 100/min. Middleware keeps a single place but must be careful with session read; route-level is explicit and easier to exclude per route.
- **Recommendation:** **Upstash Redis in middleware** for `/api/*` (with exclusions for webhooks and health), key by `userId` when available else `ip` for unauthenticated API access. Use a single `Ratelimit.slidingWindow(100, '1 m')` for this tier.

---

### 2.5 Category 5 — Public routes (no auth)

**Scope:** Routes that do not require authentication, e.g. `GET /api/health`, or any future public read-only API.

**Suggested limit:** **20 requests per minute per IP.**

**Implementation:**

- **Approach:** **Next.js middleware** or **Vercel Edge** (if you adopt Vercel’s edge rate limiting). Key: `public:{ip}`. Middleware is straightforward: for matched pathnames (e.g. `/api/health`), call Upstash with `slidingWindow(20, '1 m')` and return 429 with `Retry-After` when over limit.
- **Alternative:** **Vercel’s built-in edge rate limiting** if you only need a simple “N requests per window” per IP and don’t need to share state with Redis or reuse the same Upstash config.

---

## 3. Implementation approach summary

| Category | Suggested approach | Where |
|----------|--------------------|--------|
| Auth | Upstash Redis + `@upstash/ratelimit` | Middleware (pages) + route handler (auth callback / future login API) |
| Messaging | Upstash Redis | Route handler (per user) |
| File/video upload | Upstash Redis | Route handler (per user) |
| General API | Upstash Redis | Middleware (per user or IP) or shared route wrapper |
| Public | Upstash Redis or Vercel Edge | Middleware or edge config |

**Recommendation:** Standardize on **Upstash Redis** for all categories so limits are consistent, keys are flexible (IP vs user), and `Retry-After` can be computed from the same limiter response. Use **Next.js middleware** for auth pages, public routes, and (optionally) general API; use **route handlers** for auth callback, messaging, uploads, and any endpoint where you need to run the check after reading the body or doing heavy work.

---

## 4. When a limit is hit: 429 and Retry-After

- **Status code:** **429 Too Many Requests.**
- **Header:** **`Retry-After`** (integer, seconds until the client can retry). Upstash `Ratelimit` can return reset time; compute `retryAfter = Math.ceil((reset - now) / 1000)` and set `Retry-After: ${retryAfter}`.
- **Body:** Optional JSON, e.g. `{ "error": "Too many requests. Try again later." }` or a message that references `Retry-After` for when to retry.
- **Auth callback:** Currently redirects to `/login?error=rate_limit` with status 429; in V2, add `Retry-After` to the redirect response so clients that respect the header can back off.

---

## 5. Example: rate limiting the login endpoint

This example shows how to apply **strict auth rate limiting** (5 per 15 minutes per IP) and return **429 with Retry-After**. It can be used in:

1. A dedicated **login API** route (e.g. `app/api/auth/login/route.ts`), or  
2. The existing **middleware** for `/login` and `/forgot-password` (replace the current `checkRateLimitAsync` call with this logic).

Assume you have a shared auth limiter (see below). In a **route handler** (e.g. login API):

```ts
// lib/rate-limit.ts — add a dedicated auth limiter (when using Redis)

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// … existing in-memory and getClientIdentifier …

// Dedicated auth limiter: 5 requests per 15 minutes per key (e.g. IP)
let authLimiter: Ratelimit | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
  authLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: false,
  })
}

export async function checkAuthRateLimit(identifier: string): Promise<{
  allowed: boolean
  remaining: number
  retryAfterSeconds?: number
}> {
  if (!authLimiter) {
    const sync = checkRateLimit(identifier, { windowMs: 15 * 60 * 1000, max: 5 })
    return { ...sync, retryAfterSeconds: 900 } // 15 min when blocked
  }
  const res = await authLimiter.limit(identifier)
  const retryAfterSeconds = res.reset ? Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)) : undefined
  return {
    allowed: res.success,
    remaining: res.remaining,
    retryAfterSeconds: res.success ? undefined : retryAfterSeconds,
  }
}
```

**In the login route (or middleware):**

```ts
// app/api/auth/login/route.ts (example; or inside middleware for /login and /forgot-password)

import { NextResponse } from 'next/server'
import { getClientIdentifier } from '@/lib/rate-limit'
import { checkAuthRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const ip = getClientIdentifier(request)
  const { allowed, retryAfterSeconds } = await checkAuthRateLimit(`auth:login:${ip}`)

  if (!allowed) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    if (retryAfterSeconds != null) {
      headers['Retry-After'] = String(retryAfterSeconds)
    }
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      { status: 429, headers }
    )
  }

  // … actual login logic (e.g. call Supabase signInWithPassword) …
}
```

**In middleware** (for page requests to `/login` and `/forgot-password`), use the same `checkAuthRateLimit` and return 429 with `Retry-After`:

```ts
// middleware.ts (snippet for /login and /forgot-password)

if (pathname === '/login' || pathname === '/forgot-password') {
  const ip = getClientIdentifier(request)
  const { allowed, retryAfterSeconds } = await checkAuthRateLimit(`auth:${pathname}:${ip}`)
  if (!allowed) {
    const res = new NextResponse('Too Many Requests', { status: 429 })
    if (retryAfterSeconds != null) {
      res.headers.set('Retry-After', String(retryAfterSeconds))
    }
    return res
  }
  return response
}
```

This gives you a single, strict limit for auth (5 per 15 minutes per IP), with a consistent 429 and `Retry-After` for both a login API and auth page loads.

---

## 6. V2 checklist

- [ ] Add dedicated auth limiter in `lib/rate-limit.ts` (5 per 15 min, Redis) and `checkAuthRateLimit` with `retryAfterSeconds`.
- [ ] Tighten middleware for `/login` and `/forgot-password` to use auth limiter and return 429 + `Retry-After`.
- [ ] In `GET /auth/callback`, switch to `checkAuthRateLimit` (or shared auth limiter) and return 429 with `Retry-After` (e.g. redirect with header or 429 response).
- [ ] Fix `checkRateLimitAsync` so Redis respects per-call `windowMs`/`max` (e.g. multiple limiters or factory).
- [ ] Add rate limit to `POST /api/stripe/create-checkout-session` (e.g. 20/min per user after auth).
- [ ] Add rate limit to `POST /api/stripe/connect/account-link`, `POST /api/coach/sessions`, `GET /api/calendar/feed`, `GET /api/coach/test-n8n` (general API tier, e.g. 100/min per user).
- [ ] Add public-tier limit for `GET /api/health` (e.g. 20/min per IP in middleware).
- [ ] Ensure all 429 responses set `Retry-After` where the limiter provides a reset time.
- [ ] (Future) When adding messaging or upload endpoints, apply messaging and upload limits per user as above.
