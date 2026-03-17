# Environment Variables Reference

This document catalogs every environment variable used in the project, where it is referenced, whether it must be public (NEXT_PUBLIC_) or server-only, and where to obtain or generate the value. It also notes inconsistencies and lists variables needed for Google Drive integration and video processing.

---

## 1. Variable catalog

### 1.1 Supabase

| Variable | Purpose | Referenced in | Public or server-only | Where to get it |
|----------|---------|----------------|------------------------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL for client and server Supabase clients | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/service.ts`, `app/auth/callback/route.ts`, `app/api/create-client-account/route.ts`, `app/api/invite-client/route.ts`, `app/api/stripe/connect/account-link/route.ts`, `app/api/stripe/create-checkout-session/route.ts`, `app/api/stripe/request-payment/route.ts`, `middleware.ts`, `lib/env.ts`, `app/api/health/route.ts` | **NEXT_PUBLIC_** (exposed to browser; used by client Supabase SDK and by server code that shares the same URL) | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous (public) key; RLS applies. Used for client-side auth and server cookie-based auth | Same files as above | **NEXT_PUBLIC_** (required in browser for Supabase client) | Supabase Dashboard → Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key; bypasses RLS. Used for server-only operations (webhooks, admin inserts, health check) | `lib/supabase/service.ts`, `app/api/health/route.ts`, `lib/env.ts` (via `validateServiceRoleEnv`) | **Server-only** (never expose to browser) | Supabase Dashboard → Project Settings → API → service_role |
| `SUPABASE_SESSION_WEBHOOK_SECRET` | Shared secret for Supabase Database Webhook calling `/api/webhooks/session-created` (INSERT on `sessions`) | `app/api/webhooks/session-created/route.ts` | **Server-only** | Generate a long random string (e.g. `openssl rand -hex 32`). Configure the same value in Supabase Integrations → Webhooks and in your app env. |

---

### 1.2 Stripe

| Variable | Purpose | Referenced in | Public or server-only | Where to get it |
|----------|---------|----------------|------------------------|------------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key for creating checkout sessions, Connect account links, and request-payment | `app/api/stripe/connect/account-link/route.ts`, `app/api/stripe/create-checkout-session/route.ts`, `app/api/stripe/request-payment/route.ts`, `app/api/webhooks/stripe/route.ts`, `lib/env.ts` (via `validateStripeEnv`) | **Server-only** | Stripe Dashboard → Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for Stripe webhook at `/api/webhooks/stripe` (verify payloads) | `app/api/webhooks/stripe/route.ts`, `lib/env.ts` (via `validateStripeEnv`) | **Server-only** | Stripe Dashboard → Developers → Webhooks → Add endpoint → Signing secret |

---

### 1.3 App URL and CORS

| Variable | Purpose | Referenced in | Public or server-only | Where to get it |
|----------|---------|----------------|------------------------|------------------|
| `NEXT_PUBLIC_APP_URL` | Base URL for redirects, CORS allowed origins, and Stripe Connect return URL. Can be comma-separated for multiple origins | `middleware.ts`, `app/api/stripe/connect/account-link/route.ts` | **NEXT_PUBLIC_** (middleware runs on edge; origin check uses it) | Set to your app’s public URL (e.g. `https://your-app.vercel.app`). For multiple origins use comma-separated list. |

---

### 1.4 Tenant / branding (whitelabel)

| Variable | Purpose | Referenced in | Public or server-only | Where to get it |
|----------|---------|----------------|------------------------|------------------|
| `NEXT_PUBLIC_CLIENT_ID` | Tenant ID for this deployment; used for RLS, tenant isolation, and video `client_id`. Must match `profiles.tenant_id` and optionally `client-config.json.supabaseClientId` | `lib/config.ts` (`getClientId()`, `getClientConfig()`), `app/coach/clients/new/page.tsx`, `app/coach/schedule/page.tsx`, `app/coach/programs/page.tsx`, `app/coach/videos/page.tsx`, `app/api/webhooks/n8n-video/route.ts` (via `getClientId()`), `tailwind.config.ts` (indirectly via build-time env) | **NEXT_PUBLIC_** (used in client components via `getClientId()` and in coach pages) | Choose a slug per deployment (e.g. `demo`, `coach-jane`). Must match tenant data in DB. |
| `NEXT_PUBLIC_CLIENT_NAME` | Display name for whitelabel (e.g. login title “{name} Coach OS”) | `app/login/page.tsx`, `lib/config.ts` | **NEXT_PUBLIC_** | Any string (e.g. “ClearPath”, “Coach Jane Fitness”). |
| `NEXT_PUBLIC_BRAND_PRIMARY` | Primary brand color (hex) for Tailwind and UI | `lib/config.ts`, `tailwind.config.ts` | **NEXT_PUBLIC_** | Hex color (e.g. `#0284c7`). |
| `NEXT_PUBLIC_BRAND_SECONDARY` | Secondary brand color (hex) | `lib/config.ts`, `tailwind.config.ts` | **NEXT_PUBLIC_** | Hex color (e.g. `#0369a1`). |
| `NEXT_PUBLIC_DEMO_MODE` | When `'true'`, show demo credentials on login and demo-only UI | `app/login/page.tsx` | **NEXT_PUBLIC_** | Set to `true` or omit. |

---

### 1.5 n8n webhooks and automation

| Variable | Purpose | Referenced in | Public or server-only | Where to get it |
|----------|---------|----------------|------------------------|------------------|
| `N8N_VIDEO_WEBHOOK_SECRET` | Shared secret for `POST /api/webhooks/n8n-video` (add video to library). Also used as fallback auth for `GET /api/sessions/upcoming` | `app/api/webhooks/n8n-video/route.ts`, `app/api/sessions/upcoming/route.ts` | **Server-only** | Generate a long random string. Use the same value in n8n HTTP Request node (header `Authorization: Bearer <secret>` or `x-n8n-secret`). |
| `N8N_DEFAULT_COACH_ID` | Default coach UUID when `coach_id` is not sent in n8n-video webhook body | `app/api/webhooks/n8n-video/route.ts` | **Server-only** | Copy from `profiles.id` for the coach who should own videos when `coach_id` is omitted. |
| `N8N_SESSION_BOOKED_WEBHOOK_URL` | n8n webhook URL to call when a session is booked (from app or from Supabase webhook flow) | `lib/notify-session-booked.ts`, `app/api/coach/test-n8n/route.ts`, `app/api/webhooks/n8n-session-booked/route.ts` (doc only; uses `notifySessionBooked`) | **Server-only** | In n8n: create a Webhook node, copy the Production URL, paste into this env var. |
| `N8N_SESSION_REMINDER_ON_DEMAND_URL` | n8n webhook URL for “send reminder now” (on-demand session reminder) | `app/api/sessions/[id]/send-reminder/route.ts` | **Server-only** | In n8n: create a Webhook node for on-demand reminders, copy URL. |
| `N8N_SESSION_REMINDER_SECRET` | Optional secret for `GET /api/sessions/upcoming` (n8n fetches upcoming sessions for reminders). If not set, `N8N_VIDEO_WEBHOOK_SECRET` is used as fallback | `app/api/sessions/upcoming/route.ts` | **Server-only** | Generate a long random string. n8n uses it as `Authorization: Bearer <secret>` or `x-n8n-secret`. |

---

### 1.6 Rate limiting (Upstash Redis)

| Variable | Purpose | Referenced in | Public or server-only | Where to get it |
|----------|---------|----------------|------------------------|------------------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST API URL for rate limiter | `lib/rate-limit.ts` | **Server-only** | Upstash Console → your Redis database → REST API → URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST API token | `lib/rate-limit.ts` | **Server-only** | Upstash Console → your Redis database → REST API → Token |

Rate limiting is optional: if either variable is missing, the rate limiter degrades gracefully (no Redis).

---

### 1.7 Node / Next

| Variable | Purpose | Referenced in | Public or server-only | Where to get it |
|----------|---------|----------------|------------------------|------------------|
| `NODE_ENV` | `production` vs development; used for CORS and next.config behavior | `next.config.ts`, `middleware.ts` | Set by Next.js / Node (do not set in .env for deployment; Vercel sets it) | Automatically set (e.g. `production` in prod). |

---

## 2. Validation and health checks

- **`lib/env.ts`**  
  - `validateEnv()`: requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.  
  - `validateServiceRoleEnv()`: requires `SUPABASE_SERVICE_ROLE_KEY`.  
  - `validateStripeEnv()`: requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.  
  These are not called automatically on startup; they are intended for use in API routes or startup hooks.

- **`app/api/health/route.ts`**  
  Readiness check: requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Returns 503 if any are missing or if DB is unreachable. Does **not** validate Stripe or n8n variables.

---

## 3. Inconsistencies and gaps

### 3.1 Tenant ID fallback: `'default'` vs `'demo'`

- **`getClientId()`** in `lib/config.ts` returns `process.env.NEXT_PUBLIC_CLIENT_ID || 'default'`.
- **Coach pages** that read tenant ID directly use `process.env.NEXT_PUBLIC_CLIENT_ID ?? 'demo'`:  
  `app/coach/schedule/page.tsx`, `app/coach/programs/page.tsx`, `app/coach/videos/page.tsx`.

So the fallback is **inconsistent**: `'default'` in shared config vs `'demo'` in some coach pages. For a single “demo” tenant, ensure `NEXT_PUBLIC_CLIENT_ID=demo` is set so both paths agree. Consider standardizing on one fallback (e.g. always use `getClientId()` and remove direct `process.env.NEXT_PUBLIC_CLIENT_ID ?? 'demo'` in those three files).

### 3.2 Stripe not in health check

Health route only checks Supabase env vars. Stripe routes fail at runtime if `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` is missing. Optional: extend health (or a separate readiness check) to validate Stripe env when Stripe is required.

### 3.3 Optional variables not centralized

Optional vars (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CLIENT_NAME`, branding, n8n, Upstash) are not listed in `lib/env.ts`. Code either uses a fallback (e.g. `NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin`) or checks at use site. No single “optional env” list exists in code.

### 3.4 Missing `.env.example`

The repo has no `.env.example`. New contributors or deployments have to infer variable names from code and docs. Adding an `.env.example` with every variable listed (with empty or placeholder values and short comments) would improve clarity.

---

## 4. Google Drive integration and video processing

The app does **not** read Google Drive or CloudConvert credentials directly. Google Drive and video conversion are handled in **n8n**; the app only exposes the **n8n-video webhook** and uses existing env for tenant/coach.

### 4.1 Already used for Google Drive / video flow

- **`N8N_VIDEO_WEBHOOK_SECRET`** – Auth for `POST /api/webhooks/n8n-video`. n8n sends this when posting new videos (e.g. from Drive or after conversion).
- **`N8N_DEFAULT_COACH_ID`** – Default coach UUID when webhook body omits `coach_id`.
- **`NEXT_PUBLIC_CLIENT_ID`** – Tenant ID; videos are stored with this `client_id`.
- **`SUPABASE_SERVICE_ROLE_KEY`** – Used by the n8n-video route to insert into `videos`.

No additional **app** env vars are required for the current “n8n → webhook → app” Google Drive/video flow.

### 4.2 Variables in n8n (not in app env)

For the flows described in `docs/n8n-google-drive-video.md` and the CloudConvert workflow:

- **Google Drive (n8n)**  
  - Configured inside n8n: Google account / OAuth or service account credentials for the “Watch for new files” and “Upload” nodes. Not stored in this app’s env.

- **CloudConvert (n8n)**  
  - CloudConvert API key is stored in **n8n** credentials (e.g. Header Auth), not in the Next.js app. The app never calls CloudConvert.

- **Webhook URL and secret in n8n**  
  - In n8n you set the app URL (e.g. `https://your-app.vercel.app/api/webhooks/n8n-video`) and the same secret as `N8N_VIDEO_WEBHOOK_SECRET` in the HTTP Request node.

### 4.3 If you add in-app Google Drive or video processing later

If you later move Google Drive or video processing **into the Next.js app** (e.g. server-side uploads or transcoding), you would typically add:

| Variable | Purpose | Public/Server | Where |
|----------|---------|----------------|--------|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID for Drive API | Server-only | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client secret | Server-only | Same as above |
| `GOOGLE_DRIVE_FOLDER_ID` | (Optional) Default folder ID for uploads | Server-only | Drive folder URL or “Share” → “Get link” (ID in URL) |
| `CLOUDCONVERT_API_KEY` | (Optional) If app does conversion itself | Server-only | cloudconvert.com → API → Create API key |
| `GCP_SERVICE_ACCOUNT_KEY` or `GOOGLE_APPLICATION_CREDENTIALS` | (Optional) Service account JSON for server-to-server Drive access | Server-only | Google Cloud Console → IAM → Service accounts → Create key (JSON). Path or JSON string in env. |

Redirect URIs for OAuth (e.g. Supabase or your own callback) must be configured in the Google Cloud Console. None of these are required for the **current** n8n-based Google Drive + webhook flow.

---

## 5. Quick reference: public vs server-only

| Public (NEXT_PUBLIC_*) | Server-only |
|------------------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `SUPABASE_SERVICE_ROLE_KEY` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `SUPABASE_SESSION_WEBHOOK_SECRET` |
| `NEXT_PUBLIC_APP_URL` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `NEXT_PUBLIC_CLIENT_ID` | `N8N_VIDEO_WEBHOOK_SECRET`, `N8N_DEFAULT_COACH_ID` |
| `NEXT_PUBLIC_CLIENT_NAME` | `N8N_SESSION_BOOKED_WEBHOOK_URL` |
| `NEXT_PUBLIC_BRAND_PRIMARY` | `N8N_SESSION_REMINDER_ON_DEMAND_URL` |
| `NEXT_PUBLIC_BRAND_SECONDARY` | `N8N_SESSION_REMINDER_SECRET` |
| `NEXT_PUBLIC_DEMO_MODE` | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |

`NODE_ENV` is set by the runtime; do not expose secrets via any `NEXT_PUBLIC_` variable.
