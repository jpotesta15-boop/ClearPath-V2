# 11 — Authentication and Authorization (Security Blueprint)

This document is the security blueprint for the ClearPath platform. It covers user roles, every page and API route protection, role-based restrictions, middleware and route guards, Supabase RLS policies, identified gaps, and permissions required for V2 features.

---

## 1. User Roles: Storage and Identification

### 1.1 Roles that exist

| Role    | Exists in DB | Where stored | How identified |
|---------|--------------|--------------|-----------------|
| **coach** | Yes         | `public.profiles.role` | `profiles.role = 'coach'` after `auth.getUser()` |
| **client** | Yes       | `public.profiles.role` | `profiles.role = 'client'` after `auth.getUser()` |
| **admin**  | No         | —            | Not implemented. Reserved for V2 (e.g. platform-wide admin). |

- **Database constraint:** `profiles.role` has CHECK `'coach' | 'client'` (no `'admin'` value in schema).
- **Setting role:** On user creation, `handle_new_user()` (trigger on `auth.users` INSERT) sets `profiles.role` from metadata or from a count-based rule; invite/create-client flows set `user_metadata.role = 'client'` and trigger creates the profile.

### 1.2 Tenant (client_id / tenant_id)

- **Tenant identifier:** Stored as `profiles.tenant_id` (TEXT, e.g. `'default'`) and optionally as `NEXT_PUBLIC_CLIENT_ID` at deploy time.
- **RLS:** Policies use `get_current_client_id()`, which returns `current_setting('app.client_id', true)` or, if unset, `profiles.tenant_id` for `auth.uid()`.
- **Server:** `lib/supabase/server.ts` syncs `profiles.tenant_id` with `getClientId()` when they differ so RLS sees the correct tenant.

### 1.3 Session and auth

- **Session:** HTTP-only cookies via Supabase SSR (`createServerClient` / `createBrowserClient`). No separate session store.
- **Identifying the user:** `supabase.auth.getUser()` (server) or session (middleware). Role is always resolved by a follow-up read from `profiles` (middleware does not read `profiles` to avoid an extra DB call).

---

## 2. Every Page and Route: Login Requirement

### 2.1 App Router pages

| Route | Requires login? | Notes |
|-------|------------------|--------|
| **/** | Yes | Redirects to `/login` if no user; then redirects by role (coach → `/coach/dashboard`, client → `/client/dashboard`). |
| **/login** | No | Public. Rate-limited 30/min per IP in middleware. |
| **/forgot-password** | No | Public. Rate-limited 30/min per IP in middleware. |
| **/auth/set-password** | Session or magic-link hash | Used after invite; can set password when session exists or from hash. Redirects to role dashboard after success. |
| **/coach/dashboard** | Yes | Coach-only (layout enforces). |
| **/coach/schedule** | Yes | Coach-only. |
| **/coach/clients** | Yes | Coach-only. |
| **/coach/clients/new** | Yes | Coach-only. |
| **/coach/clients/[id]** | Yes | Coach-only. |
| **/coach/messages** | Yes | Coach-only. |
| **/coach/programs** | Yes | Coach-only. |
| **/coach/programs/[id]** | Yes | Coach-only. |
| **/coach/videos** | Yes | Coach-only. |
| **/coach/session-packages** | Yes | Coach-only. |
| **/coach/payments** | Yes | Coach-only. |
| **/coach/analytics** | Yes | Coach-only. |
| **/coach/daily-message** | Yes | Coach-only. |
| **/coach/settings** | Yes | Coach-only. |
| **/coach/settings/branding** | Yes | Coach-only. |
| **/coach/settings/client-experience** | Yes | Coach-only. |
| **/client/dashboard** | Yes | Client-only (layout enforces). |
| **/client/programs** | Yes | Client-only. |
| **/client/schedule** | Yes | Client-only. |
| **/client/videos** | Yes | Client-only. |
| **/client/messages** | Yes | Client-only. |
| **/client/settings** | Yes | Client-only. |

### 2.2 Auth route handler (GET)

| Route | Requires login? | Notes |
|-------|------------------|--------|
| **GET /auth/callback** | No (uses `code`) | OAuth/code exchange; rate-limited 15/min per IP in route; sets session and redirects by role. |

---

## 3. Role-Restricted Pages (Coach-Only vs Client-Only)

### 3.1 Coach-only pages

All routes under **/coach/** are coach-only:

- `/coach/dashboard`, `/coach/schedule`, `/coach/clients`, `/coach/clients/new`, `/coach/clients/[id]`
- `/coach/messages`, `/coach/programs`, `/coach/programs/[id]`, `/coach/videos`
- `/coach/session-packages`, `/coach/payments`, `/coach/analytics`, `/coach/daily-message`
- `/coach/settings`, `/coach/settings/branding`, `/coach/settings/client-experience`

**Enforcement:** Middleware requires a session for any `/coach/*` path. Coach layout then requires `profile?.role === 'coach'` and redirects to `/client/dashboard` if not.

### 3.2 Client-only pages

All routes under **/client/** are client-only:

- `/client/dashboard`, `/client/programs`, `/client/schedule`, `/client/videos`, `/client/messages`, `/client/settings`

**Enforcement:** Middleware requires a session for any `/client/*` path. Client layout then requires `profile?.role !== 'coach'` (i.e. client) and redirects to `/coach/dashboard` if the user is a coach.

### 3.3 Public or special

- **/** — Requires login; redirect by role happens in `app/page.tsx`.
- **/login**, **/forgot-password** — Public.
- **/auth/set-password** — Accessible with session or magic-link context; no role restriction on the page itself (redirect after submit by role).
- **GET /auth/callback** — No session required; uses `code` query param; redirect after exchange by role.

---

## 4. Middleware and Route Guards

### 4.1 Middleware (`middleware.ts`)

- **Matcher:** Only these paths run through middleware:
  - `/api/:path*`
  - `/coach/:path*`
  - `/client/:path*`
  - `/login`
  - `/forgot-password`

Paths **not** in the matcher (e.g. `/`, `/auth/set-password`, `/auth/callback`) do **not** run middleware (no session check, no rate limit from middleware).

- **Session check:** For paths starting with `/coach` or `/client`, middleware calls `supabase.auth.getSession()`. If there is no session, it redirects to `/login?next=<pathname>`.
- **Rate limits (in middleware):**  
  - `/login`, `/forgot-password`: 30 requests/min per IP (`checkRateLimitAsync('login:' + ip, { windowMs: 60_000, max: 30 })`).
- **CSP:** In production, strict Content-Security-Policy is set.
- **API routes:** Middleware only adds CORS and handles OPTIONS; it does **not** validate auth for API routes. Each API route must enforce auth and role itself.

### 4.2 Layout-based role guards

- **Coach layout** (`app/coach/layout.tsx`):
  - Calls `createClient()` and `supabase.auth.getUser()`.
  - If no user → `redirect('/login')`.
  - Loads `profiles.role` for the user; if `role !== 'coach'` → `redirect('/client/dashboard')`.

- **Client layout** (`app/client/layout.tsx`):
  - Calls `createClient()` and `supabase.auth.getUser()`.
  - If no user → `redirect('/login')`.
  - Loads `profiles.role`; if `role === 'coach'` → `redirect('/coach/dashboard')`.

### 4.3 Root page

- **`app/page.tsx`:** If no user → `redirect('/login')`. If user exists, loads `profiles.role` and redirects to `/coach/dashboard` or `/client/dashboard`. No middleware runs for `/`.

---

## 5. API Routes: Auth and Role Enforcement

| Method + Path | Auth | Role / check | Notes |
|---------------|------|--------------|--------|
| **GET /api/health** | None | — | Service-role DB ping; no user. Intended for orchestrators. |
| **POST /api/invite-client** | Cookie (session) | Coach only | 401 if no user; 403 if `profile.role !== 'coach'`. Rate limit 20/min per IP. |
| **POST /api/create-client-account** | Cookie | Coach only | Same as above. Rate limit 20/min per IP. |
| **GET /api/calendar/feed** | Cookie | Coach only | 401 if no user; 403 if not coach. Returns iCal. |
| **GET /api/sessions/upcoming** | Bearer secret | None (machine) | Auth: `Authorization: Bearer N8N_SESSION_REMINDER_SECRET` or `N8N_VIDEO_WEBHOOK_SECRET`. Not user session. |
| **POST /api/sessions/[id]/send-reminder** | Cookie | Coach only | 401 if no user; 403 if not coach; 403 if session.coach_id !== user.id. Rate limit 30/min per user. |
| **POST /api/coach/sessions** | Cookie | Coach only | 401 if no user; 403 if `profile.role !== 'coach'`. Creates session and triggers n8n. |
| **GET /api/coach/test-n8n** | Cookie | Coach only | 401 if no user; 403 if not coach. Tests n8n webhook URL. |
| **POST /api/stripe/create-checkout-session** | Cookie | Any (client flow) | 401 if no user. Validates session_request and that client.email === user.email (so only the intended client can pay). |
| **POST /api/stripe/request-payment** | Cookie | Coach only (by ownership) | 401 if no user. No explicit role check; validates client.coach_id === user.id, so only the coach who owns the client can create the link. |
| **GET /api/stripe/connect/account-link** | Cookie | Coach only | 401 if no user; 403 if `profile.role !== 'coach'`. |
| **POST /api/webhooks/stripe** | Stripe signature | — | No user auth. Validates `stripe-signature` with `STRIPE_WEBHOOK_SECRET`. |
| **POST /api/webhooks/session-created** | Bearer/secret | — | No user. Validates `Authorization: Bearer SUPABASE_SESSION_WEBHOOK_SECRET` or query `?secret=...`. |
| **POST /api/webhooks/n8n-session-booked** | Cookie | Coach only | 401 if no user; validates body `coach_id === user.id`. Used when app confirms a session and forwards to n8n. |
| **POST /api/webhooks/n8n-video** | Bearer secret | — | No user. Validates `Authorization: Bearer N8N_VIDEO_WEBHOOK_SECRET` or `x-n8n-secret`. |

---

## 6. Supabase RLS Policies: What They Allow or Block

All policies below apply to the **anon** key when the user is authenticated; the **service role** bypasses RLS.

### 6.1 `public.profiles`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Users can view profiles in their tenant | SELECT | `tenant_id = get_current_client_id()` OR `id = auth.uid()` | Users see profiles in same tenant or own profile. |
| Users can update own profile | UPDATE | `auth.uid() = id` | Users can only update their own row. |

**Blocked:** INSERT/DELETE by anon (profile creation is via trigger + service role). Users cannot update other users’ profiles.

### 6.2 `public.clients`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Coaches can manage clients in their tenant | ALL | Tenant and coach match | Coaches can CRUD their clients in tenant. |
| Clients can view themselves in their tenant | SELECT | `client_id` (tenant) match and `email = (SELECT email FROM profiles WHERE id = auth.uid())` | Client sees only their own client row(s) in that tenant. |
| Clients can update own phone | UPDATE | Same tenant + email match | Client can update own phone only. |

**Blocked:** Clients cannot insert/delete clients or change other fields (e.g. notes).

### 6.3 `public.programs`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Coaches can manage programs in their tenant | ALL | `client_id = get_current_client_id()` and coach in tenant | Full CRUD for coaches in their tenant. |

**Blocked:** No client SELECT on `programs` directly; clients see programs via `program_assignments`.

### 6.4 `public.program_assignments`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Clients can view assigned programs in their tenant | SELECT | Tenant and program/client membership | Clients see only their assignments. |

**Gap (see §7):** No RLS policy for coaches to INSERT/UPDATE/DELETE `program_assignments`. Coach UI modifies assignments; this may rely on service role or a missing coach policy.

### 6.5 `public.program_lessons`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Coach can manage program lessons | ALL | Program’s `coach_id = auth.uid()` | Coaches can CRUD lessons of their programs. |
| Clients can view assigned program lessons | SELECT | Assignment exists for current user’s client and program | Clients see lessons only for assigned programs. |

### 6.6 `public.videos`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Coaches can manage videos in their tenant | ALL | Tenant and coach match | Full CRUD for coaches. |
| Clients can view assigned videos | SELECT | Via `video_assignments` (tenant + assignment) | Clients see only assigned videos. |

### 6.7 `public.video_assignments`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Clients can view assigned videos in their tenant | SELECT | Tenant + assignment check | Clients see their assignments. |
| Coaches can manage video assignments in their tenant | ALL | Video and client belong to coach and tenant | Coaches can CRUD assignments. |

### 6.8 `public.video_completions`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Clients can manage own video completions | ALL | Client row email matches auth user | Clients can insert/update/delete their own completions. |
| Coaches can view video completions in tenant | SELECT | Client belongs to coach and tenant (or legacy null) | Coaches read-only. |

### 6.9 `public.availability_slots`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Coaches can manage availability in their tenant | ALL | Tenant and coach | Full CRUD. |
| Clients can view coach availability in their tenant | SELECT | `client_id = get_current_client_id()` | Clients can only read. |

### 6.10 `public.sessions`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Coaches can manage sessions in their tenant | ALL | `tenant_id` and coach tenant match | Full CRUD. |
| Clients can view sessions in their tenant | SELECT | Tenant and client record match auth | Clients see their sessions. |
| Clients can create session requests in their tenant | INSERT | Same tenant/client checks | Clients can create session-related rows as defined by policy. |

### 6.11 `public.session_products`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Coaches can manage session_products in their tenant | ALL | Tenant and coach match | Full CRUD. |

**Blocked:** No client SELECT. Clients see session offer/request flow via `session_requests` and checkout uses service role where needed.

### 6.12 `public.session_requests`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Coaches can manage session_requests in their tenant | ALL | Tenant and coach | Full CRUD. |
| Clients can view own session_requests | SELECT | Own requests in tenant | Read-only for own. |
| Clients can update own session_requests | UPDATE | Own requests | e.g. accept, submit availability. |

### 6.13 `public.client_time_requests`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Coaches can manage client_time_requests in their tenant | ALL | Tenant and coach | Full CRUD. |
| Clients can insert own client_time_requests | INSERT | Own client + tenant | Clients can create. |
| Clients can view own client_time_requests | SELECT | Own in tenant | Read-only for own. |

### 6.14 `public.payments`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Coaches can manage payments in their tenant | ALL | Tenant and coach | Full CRUD. |

**Gap:** No RLS policy for clients to SELECT their own payments. If client payment history is required in UI, add a client SELECT policy.

### 6.15 `public.messages`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Users can view messages in their tenant | SELECT | `client_id = get_current_client_id()` and (sender or recipient = auth.uid()) | Users see only their conversations in tenant. |
| Users can send messages in their tenant | INSERT | `client_id` and sender = auth.uid() | Users can send. |

**Gap:** No UPDATE policy. Marking `read_at` is done in app; either add a policy allowing recipient to UPDATE own message rows (e.g. `read_at`) or use service role for that update.

### 6.16 `public.coach_daily_messages`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Coaches can manage daily messages in their tenant | ALL | Tenant and coach | Full CRUD. |
| Clients can view coach daily messages in their tenant | SELECT | `client_id = get_current_client_id()` | Clients read-only. |

### 6.17 `public.coach_message_templates`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Coaches can manage coach_message_templates in their tenant | ALL | Tenant and coach | Full CRUD. |

**Blocked:** Clients have no access.

### 6.18 `public.coach_broadcasts` / `public.coach_broadcast_recipients`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Coaches can manage coach_broadcasts in their tenant | ALL | Tenant and coach | Full CRUD on broadcasts. |
| Coaches can view coach_broadcast_recipients in their tenant | SELECT | Tenant and coach | Coaches read-only on recipients. |

**Note:** INSERT/UPDATE of `coach_broadcast_recipients` (e.g. delivery status) typically done with service role.

### 6.19 `public.activity_log`

| Policy | Operation | Condition | Effect |
|--------|-----------|-----------|--------|
| Users can view activity in their tenant | SELECT | `client_id = get_current_client_id()` and `user_id = auth.uid()` | Users see only their own activity in tenant. |

**Gap:** No INSERT policy; app does not write to this table yet. When logging is added, use service role or a dedicated INSERT policy.

### 6.20 `public.stripe_webhook_events`

RLS is **not** enabled. Table is used only by the Stripe webhook handler with service role.

### 6.21 Coach branding and settings tables

- **coach_brand_settings:** Coaches ALL in tenant; **Clients can read coach_brand_settings for their coach** (SELECT for white-label).
- **coach_email_settings:** Coaches manage in tenant; no client access.
- **coach_domains:** Coaches manage in tenant.
- **coach_dashboard_layouts:** Coaches manage in tenant.
- **coach_client_experience:** Coaches manage in tenant. **Gap:** No client SELECT policy; client layout uses `getPortalCustomization()` with the user’s Supabase client, so clients may be unable to read portal_nav_enabled/terminology unless a client read policy is added or data is fetched via another path.
- **coach_profiles:** Coaches manage in tenant.
- **coach_social_links:** Coaches manage in tenant.

### 6.22 Storage (`avatars` bucket)

- Users can INSERT/UPDATE/DELETE only objects under path `{auth.uid()}/...`. Public read via bucket policy.

---

## 7. Gaps: Pages or API Routes That Should Be Protected or Fixed

### 7.1 Routes not covered by middleware

- **/** — Not in matcher. Protection is in `app/page.tsx` (redirect if no user). Acceptable.
- **/auth/set-password** — Not in matcher. No rate limit in middleware; page allows session or hash. Consider adding to matcher for rate limiting if needed.
- **/auth/callback** — Not in matcher. Rate limit is applied inside the route (15/min per IP). Acceptable.

### 7.2 API routes

- **GET /api/health** — Intentionally public for health checks; no auth. Ensure it does not leak sensitive data (it only pings DB and checks env).
- **POST /api/stripe/request-payment** — Enforces “coach ownership” via `client.coach_id === user.id` but does not explicitly require `profile.role === 'coach'`. If a client were ever linked as a coach of another client (data bug), they could call this. Prefer adding an explicit coach role check.
- All other user-facing API routes that require a user correctly enforce 401/403 and, where applicable, role or resource ownership.

### 7.3 RLS and data access

- **program_assignments:** No coach INSERT/UPDATE/DELETE policy. Coach UI can modify assignments only if using service role or if an RLS policy is added. Add “Coaches can manage program_assignments in their tenant” or document service-role usage.
- **messages:** No UPDATE policy for recipient (e.g. `read_at`). Add recipient UPDATE policy or consistently use service role for mark-read.
- **payments:** No client SELECT. Add “Clients can view own payments in their tenant” if client payment history is required.
- **activity_log:** No INSERT policy. Add when app starts writing activity.
- **coach_client_experience:** No client SELECT. Client layout needs portal_nav_enabled, terminology, etc. Add “Clients can read coach_client_experience for their coach” (e.g. where coach_id = client’s coach and tenant match) or ensure data is provided via a path that RLS allows.

### 7.4 Summary table

| Item | Type | Recommendation |
|------|------|-----------------|
| /auth/set-password | Page | Consider adding to middleware matcher for rate limiting. |
| POST /api/stripe/request-payment | API | Add explicit `profile.role === 'coach'` check. |
| program_assignments | RLS | Add coach INSERT/UPDATE/DELETE policy or document service role. |
| messages | RLS | Add recipient UPDATE (e.g. read_at) or use service role. |
| payments | RLS | Add client SELECT for own payments if needed. |
| activity_log | RLS | Add INSERT when implementing logging. |
| coach_client_experience | RLS | Add client SELECT for their coach’s row. |

---

## 8. V2 Permissions: Permissions Needed for V2 Features

This section defines the permissions needed for planned or partial V2 features so they can be implemented consistently with this security blueprint.

### 8.1 Admin role (optional)

- **Role:** `admin` (not in current schema).
- **Storage:** Add `'admin'` to `profiles.role` CHECK or use a separate `platform_admins` table.
- **Scope:** Platform-wide (all tenants). Permissions: view/manage all coaches and tenants, support tooling, feature flags, abuse handling. No RLS policies for admin in current migrations; V2 would add admin bypass or dedicated admin-only routes/tooling.

### 8.2 Custom domains

- **Current:** Coach can manage `coach_domains` in their tenant (RLS). Verification/SSL not implemented in app.
- **V2:** Same coach-only access; add any new “domain verification” or “SSL status” endpoints with coach auth and ownership check (domain belongs to coach).

### 8.3 Dashboard layouts

- **Current:** Coach can manage `coach_dashboard_layouts` (RLS). No UI to edit.
- **V2:** Same; ensure any new API or actions that save layout JSON are coach-only and scoped to `coach_id` / tenant.

### 8.4 Message templates and broadcasts

- **Current:** Coaches can manage `coach_message_templates` and `coach_broadcasts`; coaches can only SELECT `coach_broadcast_recipients`. Sending/updating recipients uses service role.
- **V2:**  
  - **Templates:** Coach-only CRUD (already in place).  
  - **Broadcasts:** Coach-only create/schedule/cancel; sending and updating recipient delivery status can remain service role or get a dedicated “coach can update broadcast_recipients for their broadcasts” UPDATE policy.  
  - **Clients:** No need for clients to read templates or broadcasts; optional “clients can see in-app broadcast” could be a separate, minimal policy if in-app channel is added.

### 8.5 Coach public profile and social links

- **Current:** Coaches can manage `coach_profiles` and `coach_social_links`. No client-facing read policy; if a public landing page is added, clients/unauthenticated users need read access to one coach’s public profile (e.g. by slug or coach_id).
- **V2:**  
  - Add “Public can read coach_profiles where is_public = true” (and optionally “Public can read coach_social_links for that coach”) for unauthenticated or client access to public coach page.  
  - Keep coach-only write/update.

### 8.6 Activity log

- **Current:** Users can SELECT own activity in tenant. No INSERT policy; app does not write.
- **V2:**  
  - Add INSERT policy: e.g. “Users can insert activity_log where user_id = auth.uid() and client_id = get_current_client_id()”, or use service role for server-side logging.  
  - Preserve SELECT for “own activity in tenant” for audit/settings UIs.

### 8.7 Client payment history

- **Current:** No client SELECT on `payments`.
- **V2:** Add “Clients can SELECT payments where payer_client_id = (client row id for auth user) and tenant match” (or equivalent) if client-facing payment history is required.

### 8.8 Calendar feed and external calendar

- **Current:** GET /api/calendar/feed is coach-only, returns iCal.
- **V2:** If a client-specific calendar feed is added, add an API route (e.g. GET /api/calendar/feed/client or token-based link) with client auth and scope to that client’s sessions only.

### 8.9 Realtime and messaging

- **Current:** Messages table in realtime publication; RLS allows SELECT/INSERT; no UPDATE for read_at.
- **V2:** Add recipient UPDATE policy for `read_at` (or use service role) so mark-read works under RLS.

### 8.10 White-label and client experience

- **Current:** Clients can read `coach_brand_settings` for their coach. No client read on `coach_client_experience`.
- **V2:** Add client SELECT on `coach_client_experience` for the row where coach_id = client’s coach and tenant match, so portal nav, terminology, and welcome content load correctly without service role.

### 8.11 Summary: V2 permission checklist

| Feature | Permission / change |
|---------|---------------------|
| Admin | Define admin role and scope; add admin-only routes or RLS bypass. |
| Custom domains | Keep coach-only; protect any new verification/SSL endpoints. |
| Dashboard layouts | Keep coach-only CRUD; protect new layout APIs. |
| Message templates & broadcasts | Keep coach-only; optional UPDATE on broadcast_recipients for coaches. |
| Coach public profile | Add public read for is_public coach_profiles (and social links if needed). |
| Activity log | Add INSERT (user or service role); keep SELECT as today. |
| Client payment history | Add client SELECT on payments for own payments. |
| Client calendar feed | Add client-scoped calendar API with client auth. |
| Messages mark-read | Add recipient UPDATE on messages or use service role. |
| Client experience / portal | Add client SELECT on coach_client_experience for their coach. |

---

*This document is the security blueprint for the ClearPath platform. Update it whenever new routes, roles, or RLS policies are added or changed.*
