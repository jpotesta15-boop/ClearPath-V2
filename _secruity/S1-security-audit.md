# S1 – Security Audit

This document records the results of a thorough security audit of the ClearPath codebase. Findings are grouped by category, with severity (Critical / High / Medium / Low) and exact fix for each.

---

## 1. Authentication gaps

**Scope:** Pages, API routes, and Supabase usage that might be reachable without a valid session.

### 1.1 Middleware does not require auth for `/api/*`

- **Finding:** In `middleware.ts`, requests to `/api/*` are only subject to CORS and OPTIONS handling. No session check is applied. Every API route must enforce auth itself.
- **Status:** By design. All sensitive API routes were verified to call `getUser()` and return 401 when unauthenticated.
- **Severity:** N/A (design confirmed).

### 1.2 Health endpoint is unauthenticated

- **Finding:** `GET /api/health` has no authentication. It uses the service role to ping the database and returns `{ ok: true }` or 503 with `reason` and optional `missing` env list.
- **Risk:** Information disclosure (env var names in 503 response); health endpoint is commonly public for load balancers.
- **Severity:** **Low**
- **Fix:** (1) Do not include the list of missing env var names in the 503 response in production; return a generic `reason: 'not_ready'`. (2) Optionally restrict the health route to internal IPs or a dedicated health secret header in production.

### 1.3 Auth callback is unauthenticated (expected)

- **Finding:** `GET /auth/callback` is unauthenticated; it exchanges `code` for a session. Rate limited (15/min per IP). No session required by design.
- **Severity:** N/A.

### 1.4 Webhooks (Stripe, n8n, session-created)

- **Finding:** Stripe webhook validates `stripe-signature`; n8n-video and sessions/upcoming use Bearer/header secret; session-created supports Bearer or `x-session-webhook-secret` and also **query param `?secret=`**.
- **Severity:** See “Exposed secrets” for session-created `?secret=`.

**Summary (authentication):** No critical or high authentication gaps. Health endpoint info leak is Low; optional hardening for health and session-created below.

---

## 2. Authorization gaps

**Scope:** Can a coach access another coach’s clients? Can a client access another client’s data?

### 2.1 Coach-scoped data

- **Coach client detail:** `app/coach/clients/[id]/page.tsx` loads client with `.eq('id', id).eq('coach_id', user!.id)`. If no row, `notFound()`. No cross-coach access.
- **Coach sessions, calendar, payments, request-payment, send-reminder:** All verified to filter by `user.id` (coach_id) or to validate resource ownership (e.g. `session.coach_id === user.id`, `client.coach_id === user.id`).
- **Create session:** `app/api/coach/sessions/route.ts` sets `coach_id: user.id` on insert; body `client_id` is validated by RLS (tenant + coach).

**Verdict:** Coach cannot access another coach’s clients or sessions via app or API.

### 2.2 Client-scoped data

- **Client dashboard, programs, videos, schedule, messages:** Client identity is derived from `user?.email` and (where used) tenant; data is loaded by `client.id` or thread (user.id, coach.id). No URL/client ID used without server-side binding to the authenticated user.
- **Stripe checkout:** `app/api/stripe/create-checkout-session/route.ts` loads `session_request` then client; returns 403 if `client.email !== user.email`. Only the client who owns the request can start checkout.

**Verdict:** Client cannot access another client’s data.

### 2.3 Client settings action – tenant in query (defence in depth)

- **Finding:** `app/client/settings/actions.ts` `updateClientPhoneAction` finds client by `user.email` only. RLS (and `get_current_client_id()`) already restrict to the current tenant.
- **Severity:** **Low**
- **Fix:** Optionally scope the client lookup by tenant, e.g. add `.eq('client_id', getClientId())` (or equivalent tenant column) where the schema supports it, for defence in depth.

**Summary (authorization):** No critical or high authorization gaps. Optional tenant filter in client settings action is Low.

---

## 3. Supabase RLS – every table

**Scope:** Is every table protected by RLS? Is RLS enabled and are policies correct?

| Table | RLS enabled | Policies / notes |
|-------|-------------|------------------|
| `profiles` | Yes | View in tenant or own id; update own. |
| `clients` | Yes | Coach manage in tenant; client view self in tenant. |
| `programs` | Yes | Coach manage in tenant; client view via program_assignments. |
| `program_assignments` | Yes | Client view in tenant (program + client match). |
| `program_lessons` | Yes | Coach manage (via program); client view assigned. |
| `videos` | Yes | Coach manage in tenant; client view via video_assignments. |
| `video_assignments` | Yes | Client view in tenant. |
| `video_completions` | Yes | Client manage own; coach view in tenant. |
| `availability_slots` | Yes | Coach manage in tenant; client view in tenant. |
| `sessions` | Yes | Coach manage in tenant; client select/insert in tenant. |
| `session_products` | Yes | Coach manage in tenant. |
| `session_requests` | Yes | Coach manage in tenant; client view/update own. |
| `payments` | Yes | Coach manage in tenant. |
| `messages` | Yes | View/send in tenant (sender/recipient). |
| `activity_log` | Yes | View own in tenant. |
| `client_time_requests` | Yes | Coach manage in tenant; client insert/view own. |
| `coach_daily_messages` | Yes | Coach manage in tenant; client view in tenant. |
| `coach_brand_settings` | Yes | Coach manage in tenant. |
| `coach_domains` | Yes | Coach manage in tenant. |
| `coach_dashboard_layouts` | Yes | Coach manage in tenant. |
| `coach_client_experience` | Yes | Coach manage in tenant. |
| `coach_message_templates` | Yes | Coach manage in tenant. |
| `coach_broadcasts` / `coach_broadcast_recipients` | Yes | Coach-scoped in tenant. |
| `coach_profiles` / `coach_social_links` | Yes | Coach manage in tenant. |
| `coach_email_settings` | Yes | Coach-scoped. |
| **`stripe_webhook_events`** | **No** | Only written by service role in webhook; never read by app with user context. |

### 3.1 Gap: `stripe_webhook_events` has no RLS

- **Finding:** In `supabase/migrations/20240115000000_stripe_webhook_idempotency.sql`, the table is created but RLS is not enabled. With the anon key, any client could in theory attempt to read or insert rows if they knew the table name.
- **Severity:** **Medium**
- **Fix:** Enable RLS and allow no direct user access (service role bypasses RLS):

```sql
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- No permissive policies for authenticated or anon; only service role can access.
CREATE POLICY "Service role only"
  ON public.stripe_webhook_events
  FOR ALL
  USING (false)
  WITH CHECK (false);
```

Alternatively, do not create any permissive policy; with RLS enabled and no policies, only the service role (bypass RLS) can access the table.

**Summary (RLS):** All tables except `stripe_webhook_events` have RLS enabled and tenant/role-appropriate policies. One Medium fix: enable RLS on `stripe_webhook_events`.

---

## 4. Input validation and sanitisation

**Scope:** Is user input validated and sanitised before storage or use in queries?

### 4.1 API routes

- **create-client-account:** Zod `createClientAccountSchema` (email).
- **invite-client:** Zod `inviteClientSchema` (email).
- **coach/sessions:** Zod `createSessionSchema` (client_id, scheduled_time, tenant_id, optional notes max 2000, etc.).
- **create-checkout-session:** Zod UUID for `session_request_id`.
- **request-payment:** Zod UUID for `client_id`.
- **n8n-video:** Zod `n8nVideoSchema` (title, url, description, category, coach_id).
- **n8n-session-booked:** Zod `n8nSessionBookedSchema`; body `coach_id` checked against `user.id`.
- **session-created webhook:** Payload shape and `table`/`type` checked; no user-supplied SQL or raw concatenation.
- **Stripe webhook:** Signature verification; metadata (e.g. session_request_id, client_id) used after verification; IDs validated by DB lookups.

### 4.2 Server actions

- **Coach client actions:** `clientIdSchema`, `updateClientProfileSchema`, `bulkClientIdsSchema`, `bulkUpdateNamesSchema` used where applicable.
- **Program reorder:** `reorderLessonsSchema` (programId, lessonIdsInOrder).
- **Client settings:** `updateClientPhoneAction` trims phone but does not use Zod or length/format limits.

### 4.3 Gap: Client phone update – no schema validation

- **Finding:** `updateClientPhoneAction` in `app/client/settings/actions.ts` accepts `phone: string | null` and only does `phone?.trim() || null`. No max length or format validation.
- **Severity:** **Low**
- **Fix:** Add a small Zod schema (e.g. `z.string().max(50).trim().nullable()` or E.164) and parse in the action; return validation error on failure.

**Summary (input validation):** Critical paths use Zod. One Low gap: validate/sanitise client phone in the settings action.

---

## 5. Exposed secrets

**Scope:** API keys, tokens, or credentials in client-side code, git history, or hardcoded.

### 5.1 Client-side and env usage

- **Finding:** No secret keys in client-side code. Only `NEXT_PUBLIC_*` are used in browser (Supabase URL, anon key, app URL, client name, brand colours, demo mode). Anon key is intended to be public; RLS and API auth protect data.
- **Severity:** N/A.

### 5.2 Create-client-account returns password in API response

- **Finding:** `app/api/create-client-account/route.ts` returns `NextResponse.json({ ok: true, password })` with the generated password. The UI (e.g. `ClientPortalAccess`, new client page) displays this so the coach can share it once. The password travels in the HTTP response and may be logged (proxies, logging middleware) or retained in browser memory/history.
- **Severity:** **High**
- **Fix:** (1) Prefer invite-only flow (e.g. invite-client) so the client sets their own password via email link. (2) If “create login and show password” is required: do not return the password in the JSON response. For example: create the user, then store the temporary password in a short-lived server-side store (e.g. keyed by a one-time token) and return a one-time URL or token that the coach opens in the same session to display the password once; or show it only in a server-rendered success page (e.g. server component that reads from secure, short-lived server state). Ensure the password is never logged or sent in API response body.

### 5.3 Session-created webhook secret in query string

- **Finding:** `app/api/webhooks/session-created/route.ts` allows authentication via `?secret=SUPABASE_SESSION_WEBHOOK_SECRET`. Query parameters are often logged (server logs, referrer, proxy logs).
- **Severity:** **Medium**
- **Fix:** Remove support for `?secret=`. Use only header-based auth (`Authorization: Bearer <secret>` or `x-session-webhook-secret`). Document that Supabase webhooks must be configured to send the secret in a header (or use a Supabase integration that supports headers).

### 5.4 Health endpoint reveals missing env var names

- **Finding:** On 503, health returns `missing: ['NEXT_PUBLIC_SUPABASE_URL', ...]`, exposing which env vars are unset.
- **Severity:** **Low**
- **Fix:** In production, return a generic payload (e.g. `{ ok: false, reason: 'not_ready' }`) without the `missing` array.

**Summary (secrets):** One High fix (do not return created password in API response); one Medium (no webhook secret in query); one Low (health response).

---

## 6. CORS configuration

- **Finding:** In `middleware.ts`, for `/api/*` the allowed origin is derived from `NEXT_PUBLIC_APP_URL` (split by comma, trimmed) or, if that list is empty, only the same origin (`request.nextUrl.origin`). Credentials are allowed. Methods and headers are restricted.
- **Verdict:** API does not accept requests from “any” origin; it’s restricted to configured app URL(s) or same origin.
- **Severity:** N/A.

---

## 7. File upload security

**Scope:** Type and size validation for uploads.

### 7.1 Avatars bucket (storage)

- **Finding:** `supabase/migrations/20240114000000_storage_avatars.sql` defines bucket `avatars` with `file_size_limit = 2097152` (2 MiB) and `allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']`. RLS limits INSERT/UPDATE/DELETE to the current user’s folder (`(storage.foldername(name))[1] = auth.uid()::text`).
- **Severity:** N/A (server-side enforced).

### 7.2 Client-side checks before upload

- **Finding:** In `app/coach/settings/page.tsx`, `app/coach/settings/client-experience/page.tsx`, and `app/coach/settings/branding/page.tsx`, upload handlers check `file.type.startsWith('image/')` and file size (2 MB or 3 MB). Extension is derived from `file.name` for the path; bucket MIME restriction still applies on upload.
- **Verdict:** Type and size are validated on client and enforced by bucket config; RLS restricts path to own folder.
- **Severity:** N/A.

**Summary (file upload):** No gaps; type and size are validated and enforced.

---

## 8. SQL injection

**Scope:** Queries built by concatenating user input.

- **Finding:** All database access uses the Supabase client (`.from()`, `.select()`, `.eq()`, `.insert()`, etc.) with parameters. No raw SQL strings built from user input. No `sql` template or string concatenation for query execution found.
- **Verdict:** No SQL injection risk identified.
- **Severity:** N/A.

---

## 9. XSS (cross-site scripting)

**Scope:** User-supplied HTML or script rendered without sanitisation.

### 9.1 React text rendering

- **Finding:** Message and note content are rendered as React text (e.g. `{message.content}`), not as HTML, so they are escaped by default.
- **Severity:** N/A.

### 9.2 dangerouslySetInnerHTML

- **Finding:** Only one use: `app/layout.tsx` injects a fixed, non–user-controlled script for theme (localStorage + data-theme). No user input is included.
- **Severity:** N/A (acceptable use).

### 9.3 Verification token on branding page

- **Finding:** `app/coach/settings/branding/page.tsx` displays `verification_token` from the database (coach’s own domain verification token). It’s not user-supplied free-form content; it’s a controlled value from the app. Risk is minimal; if desired, ensure it’s always rendered as text (no raw HTML).
- **Severity:** N/A.

**Summary (XSS):** No XSS gaps; user content is not rendered as HTML.

---

## 10. Additional findings

### 10.1 Rate limiting – create-checkout-session

- **Finding:** `app/api/stripe/create-checkout-session/route.ts` imports `checkRateLimitAsync` but never calls it. Authenticated users could create many checkout sessions in a short time.
- **Severity:** **Medium**
- **Fix:** After authentication and before heavy work, call e.g. `checkRateLimitAsync(\`checkout:${user.id}\`, { windowMs: 60_000, max: 20 })` and return 429 if not allowed.

### 10.2 Stripe Connect account-link – no rate limit

- **Finding:** `app/api/stripe/connect/account-link/route.ts` does not apply rate limiting. Could be used to generate many Stripe account links.
- **Severity:** **Low**
- **Fix:** Add rate limiting by user id (e.g. 10/minute) for this route.

---

## 11. Summary table

| # | Category        | Finding                                      | Severity | Fix |
|---|-----------------|----------------------------------------------|----------|-----|
| 1 | Auth            | Health returns missing env names on 503      | Low      | Return generic reason in production; optionally restrict health to internal/secret. |
| 2 | Authorization   | Client settings action not scoped by tenant  | Low      | Optionally add tenant filter to client lookup. |
| 3 | RLS             | `stripe_webhook_events` has no RLS           | Medium   | Enable RLS; add no permissive policies (or USING (false)). |
| 4 | Input           | Client phone update has no Zod/format        | Low      | Validate phone with Zod (length/format) in action. |
| 5 | Secrets         | Create-client-account returns password in JSON| High     | Do not return password; use invite or one-time server-side display. |
| 6 | Secrets         | Session-created webhook allows ?secret=      | Medium   | Remove query param auth; use headers only. |
| 7 | Secrets         | Health exposes missing env list              | Low      | Omit `missing` in production. |
| 8 | Rate limit      | Create-checkout-session not rate limited     | Medium   | Add checkRateLimitAsync by user after auth. |
| 9 | Rate limit      | Stripe connect account-link not rate limited | Low      | Add rate limit by user. |

---

## 12. References

- **Auth and authorization:** `docs/AUTHORIZATION_AUDIT.md`, `docs/SECURITY.md`
- **Database schema and RLS:** `02-database-schema.md`, `supabase/migrations/`
- **Validations:** `lib/validations/index.ts`
- **Middleware (CORS, CSP, rate limit):** `middleware.ts`, `lib/rate-limit.ts`
