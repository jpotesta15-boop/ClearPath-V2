# 09 — API Routes Reference

This document lists every API route in the project (under `app/api/`). There are no routes under `pages/api/`. For each route we document: path, HTTP method(s), request data, success/failure responses, authentication, and Supabase operations. A final section lists API routes to be created for V2 features to avoid duplicate work across sessions.

---

## 1. Existing API Routes

### 1.1 Health

| Property | Value |
|----------|--------|
| **Path** | `/api/health` |
| **File** | `app/api/health/route.ts` |
| **Method(s)** | GET |
| **Request** | None (no body, params, or required headers). |
| **Success** | `200` — `{ ok: true }` |
| **Failure** | `503` — `{ ok: false, reason: 'missing_env' \| 'db_unavailable' \| 'db_connect_failed', missing?: string[] }` |
| **Auth** | None. |
| **Supabase** | Service client: `from('profiles').select('id').limit(1).maybeSingle()` (readiness check). |

---

### 1.2 Create client account (coach)

| Property | Value |
|----------|--------|
| **Path** | `/api/create-client-account` |
| **File** | `app/api/create-client-account/route.ts` |
| **Method(s)** | POST |
| **Request** | **Body:** `{ email: string }` (valid email, trimmed lowercase). **Headers:** cookies for session. Rate limit: 20 req/min per client identifier. |
| **Success** | `200` — `{ ok: true, password: string }` (one-time password; also updates profile). |
| **Failure** | `401` — Unauthorized. `403` — Not coach. `400` — Invalid JSON, validation error, or "This email already has an account." `429` — Rate limit. `500` — User creation/update failed or generic. |
| **Auth** | Required. Coach only (profiles.role === 'coach'). Session via cookies. |
| **Supabase** | Server client: `auth.getUser()`, `profiles` select role. Service client: `auth.admin.createUser()`, `profiles` update `tenant_id`; on failure after create, `auth.admin.deleteUser()` rollback. |

---

### 1.3 Invite client (coach)

| Property | Value |
|----------|--------|
| **Path** | `/api/invite-client` |
| **File** | `app/api/invite-client/route.ts` |
| **Method(s)** | POST |
| **Request** | **Body:** `{ email: string }` (valid email, trimmed lowercase). **Headers:** cookies. Rate limit: 20 req/min per IP. |
| **Success** | `200` — `{ data: 'Invite sent' }`. |
| **Failure** | `401` — Unauthorized. `403` — Not coach (no coaches row or workspace_id). `400` — Invalid JSON, validation error, or "This email already has an account." `429` — Rate limit. `500` — Invite failed or generic. |
| **Auth** | Required. Coach only (coaches.workspace_id). Session via cookies. |
| **Supabase** | Server client: `auth.getUser()`, `coaches` select workspace_id. Service client: `auth.admin.inviteUserByEmail(email, { data: { role: 'client', workspace_id }, redirectTo: '<app>/auth/set-password' })`. Invite email redirects to /auth/set-password. |

---

### 1.4 Calendar feed (iCal)

| Property | Value |
|----------|--------|
| **Path** | `/api/calendar/feed` |
| **File** | `app/api/calendar/feed/route.ts` |
| **Method(s)** | GET |
| **Request** | None. Cookies for session. |
| **Success** | `200` — Body: iCal (`text/calendar`), `Content-Disposition: attachment; filename="schedule.ics"`. Contains VEVENTs for sessions (next year) and availability_slots. |
| **Failure** | `401` — Unauthorized. `403` — Not coach. |
| **Auth** | Required. Coach only. |
| **Supabase** | Server client: `auth.getUser()`, `profiles` select role. Then: `sessions` select (id, scheduled_time, status, clients, availability_slots) for coach, next year; `availability_slots` select for coach, next year. |

---

### 1.5 Sessions upcoming (n8n)

| Property | Value |
|----------|--------|
| **Path** | `/api/sessions/upcoming` |
| **File** | `app/api/sessions/upcoming/route.ts` |
| **Method(s)** | GET |
| **Request** | **Headers:** `Authorization: Bearer <secret>` or `x-n8n-secret: <secret>`. Secret = `N8N_SESSION_REMINDER_SECRET` or `N8N_VIDEO_WEBHOOK_SECRET`. |
| **Success** | `200` — `{ sessions: Array<{ session_id, scheduled_time, coach_id, client_id, coach_name, coach_email, coach_phone, client_name, client_email, client_phone }> }`. Sessions are confirmed and in the next 24 hours. |
| **Failure** | `401` — Missing or invalid secret. `500` — DB error. |
| **Auth** | Bearer/header secret (no user session). |
| **Supabase** | Service client: `sessions` select (confirmed, in 24h); `profiles` and `clients` by ids for coach/client names and phones. |

---

### 1.6 Send session reminder (coach)

| Property | Value |
|----------|--------|
| **Path** | `/api/sessions/[id]/send-reminder` |
| **File** | `app/api/sessions/[id]/send-reminder/route.ts` |
| **Method(s)** | POST |
| **Request** | **Params:** `id` — session UUID. **Headers:** cookies. Rate limit: 30 req/min per user. |
| **Success** | `200` — `{ ok: true, forwarded: boolean }` (forwarded = true if n8n URL called successfully). |
| **Failure** | `401` / `403` — Unauthorized or not coach or session not owned by coach. `404` — Session not found. `400` — Session not confirmed or already in the past. `429` — Rate limit. `502` — n8n request failed. |
| **Auth** | Required. Coach only. Session must be coach's, status confirmed, scheduled_time in the future. |
| **Supabase** | Server client: `auth.getUser()`, `profiles` role; `sessions` get by id; `clients` and `profiles` for coach/client contact info. No writes. Outbound: POST to `N8N_SESSION_REMINDER_ON_DEMAND_URL`. |

---

### 1.7 Coach sessions

| Property | Value |
|----------|--------|
| **Path** | `/api/coach/sessions` |
| **File** | `app/api/coach/sessions/route.ts` |
| **Method(s)** | GET, POST |
| **Request** | **GET:** None. **POST:** Body: `createSessionSchema` — `client_id` (UUID), `scheduled_time` (ISO), `duration_minutes` (optional, default 60), `notes`, `availability_slot_id`, `session_product_id`, `status` (optional, default 'confirmed'). |
| **Success** | **GET** — `200` — `{ data: session[] }` (next 5 upcoming sessions with clients). **POST** — `200` — `{ data: { id } }`. `409` — Overlapping session (conflict). |
| **Failure** | `401` / `403` — Unauthorized or not coach. `400` — Invalid JSON or validation. `404` — Client not in workspace (POST). `500` — Insert failed. |
| **Auth** | Required. Coach only. |
| **Supabase** | GET: `sessions` select by coach_id, scheduled_time >= now, limit 5, with clients. POST: insert `sessions` (coach_id, client_id, workspace_id, scheduled_time, end_time, duration_minutes, status, notes). |

---

### 1.8 Availability (recurring — Session 9)

| Property | Value |
|----------|--------|
| **Path** | `/api/availability` |
| **File** | `app/api/availability/route.ts` |
| **Method(s)** | GET, POST |
| **Request** | **GET:** None. **POST:** Body: `{ dayOfWeek, startTime, endTime, label?, sessionProductId? }`. Rate limit: 60/min per IP. |
| **Success** | **GET** — `200` — `{ data: recurring_availability[] }`. **POST** — `200` — `{ data: created row }`. |
| **Failure** | `401` / `403` — Unauthorized or not coach. `400` — Validation. `429` — Rate limit. |
| **Auth** | Required. Coach only. |
| **Supabase** | Server client: `auth.getUser()`, `coaches` workspace_id. GET: select from `recurring_availability` by workspace_id and coach_id. POST: insert into `recurring_availability`. |

---

### 1.9 Availability by id (PATCH / DELETE)

| Property | Value |
|----------|--------|
| **Path** | `/api/availability/[id]` |
| **File** | `app/api/availability/[id]/route.ts` |
| **Method(s)** | PATCH, DELETE |
| **Request** | **PATCH:** Body: optional `dayOfWeek`, `startTime`, `endTime`, `label`, `sessionProductId`, `is_active`. **DELETE:** Soft delete (sets `is_active = false`). |
| **Success** | `200` — `{ data }` or `{ data: 'ok' }`. |
| **Failure** | `401` / `403` / `404`. |
| **Auth** | Required. Coach only. |
| **Supabase** | PATCH: update `recurring_availability`. DELETE: update `is_active = false`. |

---

### 1.10 Availability materialize

| Property | Value |
|----------|--------|
| **Path** | `/api/availability/materialize` |
| **File** | `app/api/availability/materialize/route.ts` |
| **Method(s)** | POST |
| **Request** | None. Rate limit: 5/min per IP. |
| **Success** | `200` — `{ data: { created: number } }`. |
| **Failure** | `401` / `403`. `429` — Rate limit. |
| **Auth** | Required. Coach only. |
| **Supabase** | Reads `recurring_availability` (active), `profiles.timezone`; generates `availability_slots` for next 6 weeks (coach TZ); skips existing slots and booked sessions. |

---

### 1.11 Client calendar feed (iCal)

| Property | Value |
|----------|--------|
| **Path** | `/api/calendar/feed/client` |
| **File** | `app/api/calendar/feed/client/route.ts` |
| **Method(s)** | GET |
| **Request** | None. Cookies for session. |
| **Success** | `200` — Body: iCal (`text/calendar`), `Content-Disposition: attachment; filename="my-sessions.ics"`. VEVENTs for the client's sessions (pending/confirmed) in the next year. |
| **Failure** | `401` — Unauthorized. `403` — Not a client (e.g. coach). `404` — Client record not found (no clients row with user email). |
| **Auth** | Required. Client only (profile.role !== 'coach'). Client identified by `clients.email = user.email`. |
| **Supabase** | Server client: `auth.getUser()`, `profiles` role; `clients` by email; `sessions` for that client_id, next year, status in (pending, confirmed). |

---

### 1.12 Client sessions list

| Property | Value |
|----------|--------|
| **Path** | `/api/client/sessions` |
| **File** | `app/api/client/sessions/route.ts` |
| **Method(s)** | GET |
| **Request** | None. Cookies for session. |
| **Success** | `200` — `{ data: { upcoming: session[], past: session[] } }`. Client identified by `clients.email = user.email`. |
| **Failure** | `401` — Unauthorized. `403` — Not a client. |
| **Auth** | Required. Client only. |
| **Supabase** | Server client: `auth.getUser()`, `profiles` role; `clients` by email; `sessions` for that client_id, split by scheduled_time vs now and status. |

---

### 1.13 Coach test n8n

| Property | Value |
|----------|--------|
| **Path** | `/api/coach/test-n8n` |
| **File** | `app/api/coach/test-n8n/route.ts` |
| **Method(s)** | GET |
| **Request** | Cookies for session. |
| **Success** | `200` — `{ ok: true, message: 'n8n connection OK', status, hint }` or (if env not set) `{ ok: false, error, hint }` still with status 200. |
| **Failure** | `200` with `ok: false` for n8n error or missing URL; body includes `error`, `detail`, `hint`. `401` / `403` — Unauthorized or not coach. |
| **Auth** | Required. Coach only. |
| **Supabase** | Server client: `auth.getUser()`, `profiles` select role. No DB writes. Outbound: POST to `N8N_SESSION_BOOKED_WEBHOOK_URL` with test payload. |

---

### 1.14 Stripe Connect account link

| Property | Value |
|----------|--------|
| **Path** | `/api/stripe/connect/account-link` |
| **File** | `app/api/stripe/connect/account-link/route.ts` |
| **Method(s)** | POST |
| **Request** | No body. Cookies for session. |
| **Success** | `200` — `{ url: string }` (Stripe onboarding URL). |
| **Failure** | `401` / `403` — Unauthorized or not coach. `404` — Profile not found. `500` — Stripe not configured or failed to save account id. `502` — Stripe API error or missing link URL. |
| **Auth** | Required. Coach only. |
| **Supabase** | Server client: `auth.getUser()`, `profiles` (id, role, stripe_connect_account_id). Service client: if no account, create Stripe Express account then update `profiles.stripe_connect_account_id`, `profiles.updated_at`. |

---

### 1.13 Stripe create checkout session

| Property | Value |
|----------|--------|
| **Path** | `/api/stripe/create-checkout-session` |
| **File** | `app/api/stripe/create-checkout-session/route.ts` |
| **Method(s)** | POST |
| **Request** | **Body:** `{ session_request_id: string }` (UUID). Cookies for session. |
| **Success** | `200` — `{ url: string }` (Stripe Checkout URL). Also updates `session_requests.status` to `payment_pending`. |
| **Failure** | `400` — Invalid/missing session_request_id, request not available for payment, slot taken, or coach not connected. `401` / `403` — Unauthorized or client email doesn't match session request. `404` — Session request not found. `429` — Stripe rate limit. `500` — Stripe not configured. `502` — Stripe create session failed. |
| **Auth** | Required. Client: user email must match `session_requests.client_id` → `clients.email`. |
| **Supabase** | Service client: `session_requests` select (with session_products); check `sessions` and other `session_requests` for slot conflicts; `profiles` (coach stripe_connect_account_id); `clients` (id, email). Update `session_requests` to `payment_pending`. Stripe: create Checkout Session on Connect account. |

---

### 1.14 Stripe request payment (coach → client balance)

| Property | Value |
|----------|--------|
| **Path** | `/api/stripe/request-payment` |
| **File** | `app/api/stripe/request-payment/route.ts` |
| **Method(s)** | POST |
| **Request** | **Body:** `{ client_id: string }` (UUID). Cookies. Rate limit: 20 req/min per user. |
| **Success** | `200` — `{ url: string }` (Stripe Checkout URL for balance). |
| **Failure** | `400` — client_id invalid, client not found, no balance owed, or coach not connected. `401` / `403` — Unauthorized or client not coach's. `404` — Client not found. `429` — Rate limit. `500` — Stripe not configured. `502` — Could not create payment link. |
| **Auth** | Required. Coach only; client must be coach's. |
| **Supabase** | Service client: `clients` by client_id and coach_id; `session_requests` unpaid (offered/accepted/payment_pending); `profiles` coach stripe_connect_account_id. No direct Supabase writes; Stripe creates session with metadata (type=balance, session_request_ids, etc.). |

---

### 1.12 Webhook: Stripe

| Property | Value |
|----------|--------|
| **Path** | `/api/webhooks/stripe` |
| **File** | `app/api/webhooks/stripe/route.ts` |
| **Method(s)** | POST |
| **Request** | **Body:** Raw text (Stripe event payload) — do not parse before signature verification. **Headers:** `stripe-signature` (required). |
| **Success** | `200` — `{ received: true }`. |
| **Failure** | `400` — Missing signature or verification failed. Always returns 200 after processing (so Stripe does not retry). |
| **Auth** | Stripe signature verification (`STRIPE_WEBHOOK_SECRET`). No user session. |
| **Supabase** | Service client. Idempotency: insert `stripe_webhook_events` (event_id). **Subscription events:** `checkout.session.completed` (mode subscription) → create/update `subscriptions`, set `workspaces.stripe_customer_id`; `customer.subscription.updated` → update `subscriptions` (status, plan, current_period_end, cancel_at_period_end); `customer.subscription.deleted` → set `subscriptions.status = cancelled`; `invoice.payment_failed` → set `subscriptions.status = past_due`. Existing logic for session-request checkout/payments unchanged. |

---

### 1.13 Webhook: n8n video

| Property | Value |
|----------|--------|
| **Path** | `/api/webhooks/n8n-video` |
| **File** | `app/api/webhooks/n8n-video/route.ts` |
| **Method(s)** | POST |
| **Request** | **Body:** `n8nVideoSchema`: `title`, `url`, optional `description`, `category`, `coach_id`. **Headers:** `Authorization: Bearer <secret>` or `x-n8n-secret`. Secret = `N8N_VIDEO_WEBHOOK_SECRET`. |
| **Success** | `200` — `{ ok: true, id: string }` (new video id). |
| **Failure** | `401` — Invalid/missing secret. `400` — Invalid JSON or validation; or coach_id missing (and no N8N_DEFAULT_COACH_ID). `500` — Insert failed or generic. |
| **Auth** | Bearer/header secret. No user session. |
| **Supabase** | Service client: insert `videos` (coach_id, client_id/tenant_id, title, url, description, category). |

---

### 1.14 Webhook: Session created (Supabase DB webhook)

| Property | Value |
|----------|--------|
| **Path** | `/api/webhooks/session-created` |
| **File** | `app/api/webhooks/session-created/route.ts` |
| **Method(s)** | GET, POST |
| **Request** | **GET:** Query `?secret=SUPABASE_SESSION_WEBHOOK_SECRET` (for testing). **POST:** Body = Supabase webhook payload (`type`, `table`, `record` or `new`). **Headers (POST):** `Authorization: Bearer <secret>` or `x-session-webhook-secret` or query `secret`. |
| **Success** | GET: `200` — `{ ok: true, message }`. POST: `200` — `{ ok: true, forwarded: true }` when session INSERT and status confirmed; else `{ ok: true, skipped: string }`. |
| **Failure** | `401` — Invalid/missing secret. `400` — Invalid JSON. |
| **Auth** | Secret (header or query). No user session. |
| **Supabase** | None (consumes Supabase webhook payload). Calls `notifySessionBooked()` with record id, coach_id, client_id, scheduled_time. |

---

### 1.15 Webhook: n8n session booked (app-triggered)

| Property | Value |
|----------|--------|
| **Path** | `/api/webhooks/n8n-session-booked` |
| **File** | `app/api/webhooks/n8n-session-booked/route.ts` |
| **Method(s)** | POST |
| **Request** | **Body:** `n8nSessionBookedSchema`: `session_id`, `coach_id`, `client_id`, `scheduled_time`. Cookies for session. |
| **Success** | `200` — `{ ok: true, forwarded: boolean }`. |
| **Failure** | `401` — Unauthorized. `403` — coach_id !== user.id. `400` — Invalid JSON or validation. |
| **Auth** | Required. Coach only; body coach_id must match user. |
| **Supabase** | Server client: `auth.getUser()`. No DB writes. Calls `notifySessionBooked()` to forward to n8n. |

---

### 1.16 Clients list (coach)

| Property | Value |
|----------|--------|
| **Path** | `/api/clients` |
| **File** | `app/api/clients/route.ts` |
| **Method(s)** | GET |
| **Request** | **Query:** `?search=` (name or email), `?status=` (active \| paused \| completed). Cookies for session. |
| **Success** | `200` — `{ data: Client[] }`. |
| **Failure** | `401` — Unauthorized. `403` — Not coach. `500` — DB error. |
| **Auth** | Required. Coach only. |
| **Supabase** | Server client: `auth.getUser()`, `profiles` role; `clients` select for workspace (RLS), optional search and status filter. |

---

### 1.17 Create client (coach)

| Property | Value |
|----------|--------|
| **Path** | `/api/clients` |
| **File** | `app/api/clients/route.ts` |
| **Method(s)** | POST |
| **Request** | **Body:** `addClientSchema` (firstName, lastName, email, phone?, goals?). Cookies for session. |
| **Success** | `200` — `{ data: Client }`. |
| **Failure** | `400` — Validation error or duplicate email. `401` / `403` — Unauthorized or not coach. `500` — Insert failed. |
| **Auth** | Required. Coach only; workspace from `coaches` table. |
| **Supabase** | Server client: `auth.getUser()`, `coaches` workspace_id; insert `clients`. |

---

### 1.18 Get client (coach)

| Property | Value |
|----------|--------|
| **Path** | `/api/clients/[id]` |
| **File** | `app/api/clients/[id]/route.ts` |
| **Method(s)** | GET |
| **Request** | **Params:** `id` — client UUID. Cookies for session. |
| **Success** | `200` — `{ data: Client }`. |
| **Failure** | `401` / `403` — Unauthorized or not coach. `404` — Client not found. `500` — DB error. |
| **Auth** | Required. Coach only. |
| **Supabase** | Server client: `clients` select by id (RLS enforces workspace). |

---

### 1.19 Update client (coach)

| Property | Value |
|----------|--------|
| **Path** | `/api/clients/[id]` |
| **File** | `app/api/clients/[id]/route.ts` |
| **Method(s)** | PATCH |
| **Request** | **Params:** `id` — client UUID. **Body:** `updateClientSchema` (optional first_name, last_name, email, phone, goals, status, notes, profile_photo_url). Cookies for session. |
| **Success** | `200` — `{ data: Client }`. |
| **Failure** | `400` — Validation error. `401` / `403` — Unauthorized or not coach. `404` — Client not found. `500` — Update failed. |
| **Auth** | Required. Coach only. |
| **Supabase** | Server client: `clients` update by id (RLS enforces workspace). |

---

### 1.20 Billing checkout (coach)

| Property | Value |
|----------|--------|
| **Path** | `/api/billing/checkout` |
| **File** | `app/api/billing/checkout/route.ts` |
| **Method(s)** | POST |
| **Request** | **Body:** `{ plan: 'starter' | 'pro' | 'scale' }`. Cookies for session. Rate limit: 10 per hour per user. |
| **Success** | `200` — `{ data: { url: string } }` (Stripe Checkout URL; redirect coach to it). |
| **Failure** | `400` — Invalid plan. `401` / `403` — Unauthorized or not coach. `429` — Rate limit. `500` — Stripe not configured or workspace update failed. `502` — No URL from Stripe. |
| **Auth** | Required. Coach only. |
| **Supabase** | Server client: `auth.getUser()`, `coaches` workspace_id, `workspaces` stripe_customer_id. If no stripe_customer_id: create Stripe customer, update `workspaces.stripe_customer_id`. Stripe: create Checkout session (subscription, metadata.workspace_id). |

---

### 1.21 Billing portal (coach)

| Property | Value |
|----------|--------|
| **Path** | `/api/billing/portal` |
| **File** | `app/api/billing/portal/route.ts` |
| **Method(s)** | POST |
| **Request** | No body. Cookies for session. |
| **Success** | `200` — `{ data: { url: string } }` (Stripe Customer Portal URL). |
| **Failure** | `400` — No billing account found (no stripe_customer_id). `401` / `403` — Unauthorized or not coach. `500` — Stripe not configured. `502` — No URL from Stripe. |
| **Auth** | Required. Coach only. |
| **Supabase** | Server client: `coaches` workspace_id, `workspaces` stripe_customer_id. Stripe: create billing portal session. |

---

### 1.22 Complete onboarding (coach)

| Property | Value |
|----------|--------|
| **Path** | `/api/workspaces/complete-onboarding` |
| **File** | `app/api/workspaces/complete-onboarding/route.ts` |
| **Method(s)** | PATCH |
| **Request** | No body. Cookies for session. |
| **Success** | `200` — `{ data: 'Onboarding complete' }`. |
| **Failure** | `401` — Unauthorized. `403` — Not coach. `500` — Update failed. |
| **Auth** | Required. Coach only. |
| **Supabase** | Server client: `auth.getUser()`, `coaches` workspace_id; update `workspaces` set `completed_onboarding = true`. Called only from onboarding step 4. |

---

## 2. V2 API Routes To Create

The following routes are **not** yet implemented. Add them here when created so duplicate routes are not added in other sessions.

---

### 2.1 Client management (see `04-client-management.md`)

**Implemented (Session 5):** `GET /api/clients`, `POST /api/clients`, `GET /api/clients/[id]`, `PATCH /api/clients/[id]` — see §1.16–1.19.

| Route | Method | Purpose | Notes |
|-------|--------|---------|--------|
| (Optional) Invite flow | POST | Create pending invite / client_invites; send magic link | May extend `invite-client` or new endpoint. |
| (Optional) Client profile photo upload | POST | Upload to Storage; return or set `profile_photo_url` | e.g. `POST /api/clients/[id]/photo` or `/api/upload/profile-photo`. |
| (Optional) Bulk set status | POST | Set client status (active/paused/completed) for selected ids | If not done via server action only. |

---

### 2.2 Messaging (see `05-messaging.md`)

**Implemented (Session 8):**

| Property | Value |
|----------|--------|
| **Path** | `/api/messages` |
| **File** | `app/api/messages/route.ts` |
| **GET** | Query: `?clientId=[uuid]`. Returns all messages in the thread for that client, ordered by `created_at` ASC. Verifies requesting user is coach of that workspace OR the client themselves. Rate limit: 100/min per user. Success: `200` — `{ data: Message[] }`. |
| **POST** | Body: `sendMessageSchema` (`clientId`, `content`). Sets `sender_id` = current user, `recipient_id` = the other party. Rate limit: 60/min per user. Success: `200` — `{ data: message }`. |

| Property | Value |
|----------|--------|
| **Path** | `/api/messages/read` |
| **File** | `app/api/messages/read/route.ts` |
| **Method** | PATCH |
| **Request** | Body: `{ clientId }`. Marks all messages where `recipient_id = auth.uid()` AND `client_id = clientId` AND `read_at IS NULL` with `read_at = now()`. |
| **Success** | `200` — `{ data: 'marked read' }`. |

| Route | Method | Purpose | Notes |
|-------|--------|---------|--------|
| (Optional) Message attachments upload | POST | Upload file to Storage; return URL for message attachment | e.g. `POST /api/messages/attachments`. |

---

### 2.3 Calendar & scheduling (see `06-calendar-scheduling.md`)

| Route | Method | Purpose | Notes |
|-------|--------|---------|--------|
| **Availability slots** | GET | List slots for coach (and optionally for client booking) | May be client-side Supabase; document if API added. |
| **Availability slots** | POST | Create manual or recurring-derived slot | e.g. `POST /api/coach/availability/slots`. |
| **Availability slots** | PATCH/DELETE | Update or delete slot | e.g. `PATCH/DELETE /api/coach/availability/slots/[id]`. |
| **Recurring availability** | GET/POST/PATCH/DELETE | CRUD for recurring_availability (templates) | If materialized by cron, coach edits templates via API. |
| **Sessions** | PATCH/DELETE | Update session (time, status, notes) or cancel/delete | e.g. `PATCH /api/sessions/[id]`, `DELETE /api/sessions/[id]`. May exist as server actions; add API if needed for webhooks or external clients. |
| **Client iCal feed** | GET | iCal of client’s sessions only | e.g. `GET /api/calendar/feed/client` (auth = client). |
| **Scheduled reminders (cron)** | GET or internal | Job that finds sessions in 24h and calls n8n or inserts notifications | Could be Vercel Cron hitting e.g. `GET /api/cron/session-reminders` with cron secret. |

---

### 2.4 Video pipeline (see `07-video-pipeline.md`) — Session 13

**Implemented (folder-based import; no in-app OAuth):**

| Path | Method | Auth | Purpose |
|------|--------|------|---------|
| `/api/videos/resolve-folder` | GET | Header `X-Clearpath-Secret` | Query `?folderId=...`. Resolve Drive folder ID to workspace + coach. Service role; returns `{ workspaceId, coachId }` or 404. Used by n8n. |
| `/api/videos/from-n8n` | POST | Header `X-Clearpath-Secret` | Body: `workspaceId`, `coachId`, `title`, `playbackUrl`; optional `thumbnailUrl`, `durationSeconds`, `fileSizeBytes`. Service role; insert video (processing_status = ready). Returns 201 `{ data: { id } }`. |
| `/api/videos/processing-complete` | POST | Header `X-Clearpath-Secret` | (Legacy.) Called by n8n. Body: `videoId`, `status` (ready \| failed), `playbackUrl`, etc. Service role; update existing video. Return 200. |
| `/api/workspaces/import-folder` | GET | Coach | Returns current workspace `google_drive_import_folder_id` (e.g. `{ folderId: string \| null }`). |
| `/api/workspaces/import-folder` | PATCH | Coach | Body: `{ folderId: string \| null }`. Set workspace `google_drive_import_folder_id`. |
| `/api/videos` | GET | Coach | List workspace videos; `?status=ready\|processing\|failed\|queued`; exclude deleted_at. |
| `/api/videos/[id]` | GET | User | Single video (for client program view). |
| `/api/videos/[id]` | DELETE | Coach | Soft delete: set `deleted_at`. |

**Deprecated / removed (no longer in codebase):** `/api/google/connect`, `/api/google/callback`, `/api/google/status`, `/api/google/disconnect`, `/api/google/drive/files`, `/api/videos/import`. Video import is now folder-based: coach sets import folder ID on Videos page; n8n watches that folder and creates videos via `POST /api/videos/from-n8n`.

| Route | Method | Purpose | Notes |
|-------|--------|---------|--------|
| (Optional) **Video playback URL** | GET | Return signed URL for a video | e.g. `GET /api/videos/[id]/playback-url` if using signed URLs. |

---

### 2.5 Programs (see `08-program-builder.md`) — Session 12

**Implemented:**

| Path | Method | Auth | Purpose |
|------|--------|------|---------|
| `/api/programs` | GET | Coach | All programs for workspace; query `?status=draft\|published\|archived`. |
| `/api/programs` | POST | Coach | Create program (body: title, description); draft status. |
| `/api/programs/[id]` | GET | Coach | Full program with modules and content blocks, ordered by position. |
| `/api/programs/[id]` | PATCH | Coach | Update title, description, status. |
| `/api/programs/[id]` | DELETE | Coach | Soft delete: set status = archived. |
| `/api/programs/[id]/modules` | POST | Coach | Add module (body: title, description?, position?). |
| `/api/programs/[id]/modules/[moduleId]` | PATCH | Coach | Update module title, description, position. |
| `/api/programs/[id]/modules/[moduleId]` | DELETE | Coach | Delete module and all its content blocks. |
| `/api/programs/[id]/modules/[moduleId]/content` | POST | Coach | Add content block; position = max+1. Body: contentType, title?, body?, url?, videoId?. |
| `/api/content/[contentId]` | PATCH | Coach | Update content block fields. |
| `/api/content/[contentId]` | DELETE | Coach | Hard delete content block. |
| `/api/programs/[id]/assign` | POST | Coach | Assign client (body: clientId); verify client in workspace; error if already assigned. |
| `/api/programs/[id]/progress` | GET | Coach | Progress for all clients assigned to this program. |
| `/api/progress/[moduleId]/complete` | POST | Client | Mark module complete (creates program_progress). |
| `/api/client/programs` | GET | Client | All programs assigned to client with progress counts. |
| `/api/client/programs/[id]` | GET | Client | Full program with modules, content, and client progress. |

---

## 3. Quick reference — existing routes only

| Path | Method | Auth | Summary |
|------|--------|------|---------|
| `/api/health` | GET | None | Readiness check |
| `/api/create-client-account` | POST | Coach | Create auth user + return one-time password |
| `/api/invite-client` | POST | Coach | Invite by email (magic link) |
| `/api/clients` | GET | Coach | List clients (search, status filter) |
| `/api/clients` | POST | Coach | Create client |
| `/api/clients/[id]` | GET | Coach | Get one client |
| `/api/clients/[id]` | PATCH | Coach | Update client |
| `/api/calendar/feed` | GET | Coach | iCal sessions + availability |
| `/api/sessions/upcoming` | GET | Bearer secret | Next 24h sessions for n8n |
| `/api/sessions/[id]/send-reminder` | POST | Coach | Manual reminder → n8n |
| `/api/coach/sessions` | POST | Coach | Create session + n8n booked |
| `/api/coach/test-n8n` | GET | Coach | Test n8n webhook URL |
| `/api/stripe/connect/account-link` | POST | Coach | Stripe Connect onboarding URL |
| `/api/stripe/create-checkout-session` | POST | Client | Checkout URL for session_request |
| `/api/stripe/request-payment` | POST | Coach | Checkout URL for client balance |
| `/api/webhooks/stripe` | POST | Stripe sig | Checkout completed → payments + sessions |
| `/api/videos/resolve-folder` | GET | X-Clearpath-Secret | Resolve Drive folder ID → workspaceId, coachId (n8n) |
| `/api/videos/from-n8n` | POST | X-Clearpath-Secret | Create video from n8n (folder-based import) |
| `/api/workspaces/import-folder` | GET, PATCH | Coach | Get/set Google Drive import folder ID for workspace |
| `/api/webhooks/session-created` | GET, POST | Secret | Supabase session INSERT → n8n |
| `/api/webhooks/n8n-session-booked` | POST | Coach | Forward session booked to n8n |
| `/api/billing/checkout` | POST | Coach | Create Stripe Checkout session for plan (rate limit 10/hour) |
| `/api/billing/portal` | POST | Coach | Create Stripe Customer Portal session |
| `/api/webhooks/stripe` | POST | Stripe sig | Subscription + checkout events → subscriptions, payments, sessions |
| `/api/workspaces/complete-onboarding` | PATCH | Coach | Set completed_onboarding = true (onboarding step 4) |
| `/api/onboarding/workspace` | POST | Coach | Save onboarding step 1 (workspace name, logo_url, avatar_url) |
| `/api/onboarding/coaching` | POST | Coach | Save onboarding step 2 (coaching_types, current_client_count) |
| `/api/messages` | GET | Coach or Client | List messages for thread (query: clientId); rate limit 100/min |
| `/api/messages` | POST | Coach or Client | Send message (body: clientId, content); rate limit 60/min |
| `/api/messages/read` | PATCH | Coach or Client | Mark thread as read (body: clientId) |

---

*When you add a new API route for V2, add it to Section 2 under the right subsection and optionally to Section 3 if it becomes a long-term route.*
