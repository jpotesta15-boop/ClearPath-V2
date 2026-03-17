# A5 — V1 Honest Summary

This document is a blunt assessment of the ClearPath V1 codebase. Scores are out of 10. No softening.

---

## 1. Code quality — **5/10**

**What’s consistent:** Next.js App Router is used correctly. Supabase usage is centralized (`createClient`, `createServiceClient`). There is a shared `lib/api-error.ts` for safe messages and server-side logging, and Zod is used for request validation in API routes. Layouts enforce role (coach vs client) in one place.

**What’s not:** Style and patterns are inconsistent. Some API routes use `createServerClient` inline with full cookie handling; others use `createClient()` from server. Server actions rarely check `profile.role === 'coach'`; they rely on resource ownership (e.g. `coach_id === user.id`), which works only because only coaches can reach those pages. Validation and DB are out of sync: `updateClientProfileSchema` and `updateClientProfileAction` use `height`, `weight_kg`, `date_of_birth`, but **those columns do not exist on `clients`** — the update will throw or silently fail when users save profile data that includes those fields. There is no shared pattern for “load then mutate” in client components; some pages use initialData + client fetch, others fetch entirely on the client. Typing is loose in places (`any` for client/session/lesson data in schedule and program detail). Dead or underused code exists (e.g. `db-helpers.withClientId` is not used consistently). Overall the codebase is readable enough to work in, but it is not consistently maintainable: a new developer would have to guess where to add auth checks, which client to use, and whether a given field exists in the DB.

---

## 2. Security — **5/10**

**What’s in place:** Middleware requires a session for `/coach/*` and `/client/*` and redirects unauthenticated users to login. Layouts enforce role (coach vs client) and redirect the wrong role. Most API routes that should be coach-only do check `profile.role === 'coach'` (e.g. create-client-account, invite-client, calendar feed, send-reminder, stripe connect). Stripe webhook verifies signature. Webhooks that take a secret use Bearer or header checks. RLS is enabled on all main tables with tenant scoping via `get_current_client_id()`. Passwords and internal errors are not echoed to the client; `api-error` sanitizes messages.

**Gaps:**  
- **API route:** `POST /api/stripe/request-payment` does **not** check `profile.role === 'coach'`. It only verifies `client.coach_id === user.id`. In the current data model only coaches own clients, but the security doc correctly calls out that this should be an explicit role check so a client account could never call it even if data were wrong.  
- **RLS:** There is **no** RLS policy allowing **coaches** to INSERT/UPDATE/DELETE on `program_assignments`. The coach UI in `ProgramDetailClient.tsx` does `supabase.from('program_assignments').upsert(...)` and `.delete()` using the **anon** client. With current migrations, coaches have only the “Clients can view assigned programs in their tenant” SELECT policy. So **coach-driven program assign/remove is denied by RLS** unless something else (e.g. a later migration or different env) grants it. If production uses the same migrations, this feature is broken at the DB layer.  
- **RLS:** `messages` has no UPDATE policy; marking `read_at` is done in app code. If that update uses the anon key, RLS will block it. Either an UPDATE policy for the recipient is missing or the app uses service role for that write (which would be inconsistent).  
- **RLS:** `payments` has no client SELECT policy; if the client UI ever shows “your payment history”, it would fail without a policy or service role.  
- **RLS:** `coach_client_experience` has no client SELECT policy; client layout and portal customization may depend on that data — doc says client read may be missing.  
- **Auth callback:** Uses sync `checkRateLimit`; in serverless this is per-instance and not shared, so rate limiting on auth callback is weak without Redis.  
- **Create-client-account:** Returns the generated password in the JSON response. One-time and intended, but any proxy or log could capture it.

So: auth and role are enforced in the right places for most flows, and RLS is broadly in place, but at least one critical path (program assignments) is blocked by RLS, and several policies (messages UPDATE, payments client read, coach_client_experience client read) are missing or unclear. Security is half-done, not solid.

---

## 3. Database design — **5/10**

**Strengths:** Tables are normalized with clear FKs. Tenant isolation is consistent (`client_id` TEXT or `tenant_id` on key tables). Indexes exist on `coach_id`, `client_id`, `tenant_id`, and common filters. RLS is applied per table with tenant-aware policies. Idempotency for Stripe webhooks is implemented (`stripe_webhook_events`).

**Weaknesses:**  
- **Naming:** `client_id` is overloaded: it means tenant identifier (TEXT) on some tables and FK to `clients(id)` (UUID) on others. This is documented but remains a source of confusion and bugs.  
- **Schema vs app:** Validations and UI reference `height`, `weight_kg`, `date_of_birth` on clients; **these columns do not exist**. Either the schema is incomplete or the app is wrong.  
- **program_assignments:** No coach write policy (see Security).  
- **program_lessons:** `UNIQUE(program_id, video_id)` with nullable `video_id` is DB-dependent and may not match intended semantics for non-video lessons.  
- **No recurring availability:** Slots are one-off; “every Tuesday 5–7pm” would require many rows or a separate model.  
- **Video:** No table or bucket for uploaded video; everything is external URL. No encoding/status fields if you add uploads later.  
- **activity_log:** No INSERT policy; if the app starts writing activity, it will need one or service role.

The schema is usable and scalable for moderate load, but inconsistencies (missing columns, missing RLS, naming) will bite as you add features or onboard developers.

---

## 4. Error handling — **4/10**

**What exists:** `lib/api-error.ts` provides `getSafeMessage`, `logServerError`, and `sanitizeActionError`. Many API routes use try/catch and return 4xx/5xx with safe messages. Stripe webhook does idempotency and returns 200 only after accepting the event; internal failures are logged. Root `error.tsx` and `global-error.tsx` show a generic “Something went wrong” and a “Try again” button.

**What’s wrong:**  
- **Webhook:** In the Stripe webhook, when creating a session after payment (slot path), several failures only log and then `return NextResponse.json({ received: true })`. Stripe is told “success” even when the session was not created or session_request was not updated. That is silent failure from the business perspective: payment is recorded but the client may never get a session.  
- **Server actions:** Many actions return `{ error: string }` but callers do not always surface it. Some buttons or forms don’t show the returned error to the user, so failures can look like “nothing happened.”  
- **Client components:** Load errors (e.g. Supabase errors in `loadData`) are often not shown in the UI; state is updated and the user may see empty lists or stale data with no explanation.  
- **createClient (server):** The tenant_id sync in `lib/supabase/server.ts` catches errors and only logs (“Silently fail - this is not critical”). If tenant_id is wrong, RLS can scope incorrectly; the user gets no feedback.  
- **Health:** `/api/health` returns 503 with a `missing` array of env var names; that’s useful for ops but could be considered an information leak in strict environments.

So: API and actions have structure for errors, but the Stripe webhook can report success while failing to create sessions, and many user-facing paths do not show actionable errors. Failures often happen “silently” from the user’s point of view.

---

## 5. Feature completeness — **~50–70% per area**

Rough end-to-end assessment (does the full path work in production as intended?):

| Feature | Completeness | Notes |
|--------|--------------|--------|
| **Auth (login, role redirect, set password)** | ~90% | Works. / and /auth/set-password not in middleware matcher (no rate limit there). |
| **Coach: add client (invite / create account)** | ~85% | Create and invite work. Password returned in API response. |
| **Coach: client list and detail** | ~70% | List and detail load. Profile update tries to write non-existent columns (height, weight_kg, date_of_birth) → will error or no-op. |
| **Coach: programs and lessons** | ~60% | Create program, add lessons (video/link/note), reorder work. **Assign/remove clients to program uses program_assignments without a coach RLS policy** → likely fails in production. |
| **Coach: videos** | ~75% | List, add (URL), assign to clients. No upload; n8n webhook can insert. |
| **Coach: schedule (book session)** | ~80% | Book session, API creates session and can trigger n8n. Calendar feed (iCal) works. |
| **Coach: session packages** | ~70% | CRUD exists. Tied into session_request and Stripe; flow is complex but present. |
| **Coach: payments (Stripe Connect, request payment)** | ~75% | Connect and request-payment work. No explicit coach role check on request-payment. |
| **Coach: messages** | ~65% | Thread and send work. Marking read may be blocked by RLS (no UPDATE policy). |
| **Coach: daily message** | ~70% | UI and table exist. |
| **Client: dashboard** | ~75% | Loads sessions, programs, daily message. Depends on coach_client_experience and other reads that may lack RLS. |
| **Client: schedule** | ~70% | Sessions, requests, time requests, pay link. Flow works if Stripe and webhook are correct. |
| **Client: programs** | ~70% | Assignments and lessons view; progress from video_completions. |
| **Client: videos** | ~70% | Assigned videos and completion tracking. |
| **Client: messages** | ~65% | Same RLS/read_at issue as coach. |
| **Stripe checkout → session creation** | ~60% | Webhook records payment and can create session, but **on failure it still returns 200**, so session may be missing while Stripe thinks it succeeded. |

**Overall:** Core flows (auth, client CRUD, programs/lessons, schedule, payments) are partly there but several critical paths are broken or fragile: program assignments (RLS), client profile update (missing columns), Stripe webhook (silent failure), and message read_at (RLS). A reasonable estimate is **~50–70% of each feature actually works end-to-end** without hitting one of these gaps.

---

## 6. Performance — **4/10**

**Positive:** No obvious N+1 in the audited code. Dashboard and schedule use `Promise.all` for parallel fetches. Sessions/upcoming API batches by ID. Rate limiting exists (in-memory or Upstash).

**Problems:**  
- **Coach dashboard** does **16** Supabase calls before first render (A3 performance scan). That will not scale to 50 concurrent users without higher latency and DB load.  
- **No pagination:** Sessions, availability_slots, payments, videos, clients, and message lists are often unbounded. With 50 users and real usage, list pages and dashboard will pull too much data.  
- **select('*')** is used in many places; payloads are larger than necessary.  
- **Rate limiting:** In-memory fallback is per-instance; under multiple serverless instances it does not enforce a global limit. For 50 simultaneous users you need Redis (Upstash) or similar.  
- **No caching:** No cache headers or data caching strategy for calendar feed, dashboard, or list pages.

So: it will likely “hold up” for 50 users in a demo or light use, but dashboard and unbounded lists will get slow and brittle without batching, limits, and proper rate limiting.

---

## 7. Deployment readiness — **4/10**

**Could this go live today without embarrassing issues?** No.

**Reasons:**  
1. **Program assign/remove** will fail for coaches if RLS is as in the migrations (no coach policy on program_assignments).  
2. **Client profile update** will error or no-op when saving height/weight/DOB (columns missing).  
3. **Stripe webhook** can return 200 after failing to create a session, so paid clients may not get a session — support nightmare and trust issue.  
4. **Health** exposes list of missing env vars in 503 body; minor but not ideal.  
5. **Service role** is required for health check and several APIs; if `SUPABASE_SERVICE_ROLE_KEY` is missing, first request to those routes throws (docs note this).  
6. **No E2E or smoke tests** evident; deployment could break critical paths without notice.  
7. **Multiple RLS and schema gaps** (messages read_at, payments client read, coach_client_experience, activity_log INSERT) will surface as “feature doesn’t work” or “client can’t see X”.

The app can be deployed and used for a controlled demo or internal use, but going “live” in a way that looks professional and reliable would be embarrassing when coaches can’t assign programs, profile save breaks, or payments succeed but sessions don’t get created.

---

## The 5 things that must be fixed before V2 is built on top of this

Ordered by importance (impact and risk).

---

### 1. Fix RLS and schema so core flows don’t fail silently or at all

- **program_assignments:** Add an RLS policy so **coaches** can INSERT, UPDATE, and DELETE rows in their tenant (e.g. where the program’s `coach_id = auth.uid()` and tenant matches). Until this is in place, coach-driven assign/remove is broken.
- **messages:** Add an RLS policy so the **recipient** can UPDATE `read_at` on rows where `recipient_id = auth.uid()`, or consistently use service role for mark-read and document it.
- **clients:** Either add columns `height`, `weight_kg`, `date_of_birth` to `clients` in a migration, or remove them from `updateClientProfileSchema` and from the client profile UI. Right now the update is broken or misleading.
- **payments:** If clients should see their own payment history, add a client SELECT policy. Otherwise remove or hide that UI.
- **coach_client_experience:** If the client portal needs this for nav/terminology/welcome, add a client SELECT policy for the row that corresponds to their coach/tenant.

Without these, V2 will inherit broken or inconsistent behavior and more “why doesn’t X work?” bugs.

---

### 2. Stripe webhook: never return 200 when the business operation failed

- In `app/api/webhooks/stripe/route.ts`, after recording payment, when you create a session and/or update session_request, do not `return NextResponse.json({ received: true })` if the insert/update failed.
- Either: (a) retry and then return 500 so Stripe retries, or (b) return 200 only after all critical DB writes succeed, and log + alert on failure so someone can fix data. Today the webhook tells Stripe “success” even when the session was not created; that must stop.

---

### 3. Enforce coach role explicitly on every coach-only API and action

- In `POST /api/stripe/request-payment`, after `auth.getUser()`, load profile and require `profile.role === 'coach'`; return 403 if not. Same idea for any other route that is “coach-only” but only checks ownership.
- In server actions that are only ever called from coach UI (e.g. delete client, update client, reorder lessons), consider adding a role check so that if the UI or routing ever changes, the backend still enforces role. This reduces risk when building V2 on top.

---

### 4. Make errors visible and actionable

- In the Stripe webhook, stop swallowing failures with `received: true`.
- In server actions, ensure every `{ error }` return is shown in the UI (toast, inline message, or banner). Audit callers and add feedback where it’s missing.
- In client-side load (e.g. schedule, program detail), on Supabase or fetch error set an error state and show a short message and retry option instead of leaving the user with empty or stale data.

---

### 5. Reduce dashboard and list load and add guardrails for scale

- **Coach dashboard:** Replace the 16-call pattern with one or two batched queries or a single RPC that returns the dashboard payload. Defer non-critical data (e.g. recent messages) to client-side or a secondary request so first paint is fast.
- **Lists:** Add `.limit(N)` (and optionally pagination) to sessions, availability_slots, payments, videos, clients, and message lists so that with 50+ users the app doesn’t pull unbounded data.
- **Rate limiting:** Use Upstash (or another shared store) in production so rate limits are global across instances. Document that in-memory fallback is for dev only.

These five fixes address the highest-impact bugs and reliability issues. Doing them before layering V2 on top will prevent V2 from inheriting silent failures, broken features, and scalability traps.

---

*Document generated from a full read of the codebase and existing docs (02-database-schema, 11-auth-permissions, 09-api-routes, A2, A3, 12-user-flows).*
