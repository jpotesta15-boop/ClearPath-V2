# Calendar & Scheduling — Current State & V2 Specification

This document summarizes existing scheduling and calendar code in the project and defines the full V2 scheduling system: coach availability, booking flows, session data model, coach and client calendar views, reminders, Google Calendar integration, Supabase schema/RLS, and build-vs-buy recommendation.

---

## Part 1: Current State (What Exists)

### 1.1 Coach schedule

**Locations:** `app/coach/schedule/page.tsx`, `app/api/coach/sessions/route.ts`, `app/api/calendar/feed/route.ts`

**Behavior:**

- **Availability slots:** Coach schedule loads `availability_slots` for the coach and displays them in the month grid (as context). Slots can be **updated** (when editing a session that has `availability_slot_id`) and **deleted** (when deleting that session). **There is no in-app UI to create new availability slots** — only seed data inserts slots. So coaches currently cannot add their own availability through the app; V2 must add this.
- **Sessions:** Loaded with `clients` and `availability_slots` joined. Coach can:
  - **Book a session:** Pick a client from “Available fighters,” choose date, start/end time, optional session product, optional “Require card payment before confirming” (creates `session_request` offered) or submit directly (creates session via `POST /api/coach/sessions` with `status: 'confirmed'` and triggers n8n “booked”).
  - **From “Ready to schedule”:** For `session_requests` with status `availability_submitted`, coach opens “Offer time & confirm,” picks date/time/notes, then `POST /api/coach/sessions` creates session (no slot) and sets request to `scheduled`.
  - **From “Client time requests”:** Coach can “Offer session” (creates `session_request` offered, links `client_time_requests` to it) or “Decline.”
- **Calendar:** Month grid (date-fns: `startOfMonth`, `endOfMonth`, `eachDayOfInterval`); each day shows sessions as colored blocks (client name + time). Clicking a day opens a **day view** (timeline 6:00–22:00 with sessions positioned by time). “Sessions (this month)” list below. No week view.
- **Session actions:** Edit (date, time, notes), approve (pending → confirmed), mark as paid, mark completed/cancelled, delete session, “Remind client” (manual).
- **Export:** “Export calendar” links to `GET /api/calendar/feed` (iCal for coach sessions + availability slots, next 12 months).

**Data:** Slots and sessions are fetched client-side (Supabase). Session create goes through `POST /api/coach/sessions` (validates with `createSessionSchema`, inserts session, optionally updates `session_request` to `scheduled`, calls `notifySessionBooked(..., 'booked')`).

### 1.2 Client schedule

**Locations:** `app/client/schedule/page.tsx`, `app/client/schedule/ClientScheduleContent.tsx`

**Behavior:**

- **Request a session (free-form):** Client submits “when I’m free” text → `client_time_requests` (status `pending`). Coach sees this on coach schedule and can offer a session or decline.
- **Session offers:** Client sees `session_requests` (offered, payment_pending, paid, availability_submitted). Accept & pay → Stripe Checkout; after payment client can “Submit availability”; coach then picks time and creates session.
- **Available slots to book:** Client sees coach’s `availability_slots` (future only). Per slot:
  - If slot has `session_product_id`: **“Book & pay”** → create `session_request` with `availability_slot_id`, status `accepted` → redirect to Stripe; on success Stripe webhook creates session and sets request to `scheduled`.
  - Else: **“Request session”** → insert into `sessions` with that `availability_slot_id`, `status: 'pending'` (no payment).
- **My Sessions:** List of client’s sessions (date, time, status, “Request cancel” for upcoming confirmed). No day/week/month calendar view.

**Data:** Client resolved by `clients.email = user.email`; slots, sessions, session_requests, client_time_requests loaded in page (server) and ClientScheduleContent (client).

### 1.3 Session reminders

**Locations:** `app/api/sessions/[id]/send-reminder/route.ts`, `lib/notify-session-booked.ts`

**Behavior:**

- **Manual reminder:** Coach clicks “Remind client” on a confirmed future session → `POST /api/sessions/[id]/send-reminder` → forwards payload (session_id, coach/client ids, scheduled_time, type: `reminder`, contact info) to `N8N_SESSION_REMINDER_ON_DEMAND_URL`. No in-app or email sent by the app; n8n is responsible for email/SMS.
- **On book / payment:** When a session is created (coach books or Stripe webhook after client “Book & pay”), `notifySessionBooked(..., 'booked' | 'payment_confirmed')` is called with `N8N_SESSION_BOOKED_WEBHOOK_URL`. Again, delivery (email, SMS, push) is delegated to n8n.
- **Automated scheduled reminders** (e.g. 24h before) are not implemented; would require a cron or queue job that finds upcoming sessions and calls n8n or an in-app notification.

### 1.4 Google Calendar / iCal

**Location:** `app/api/calendar/feed/route.ts`

**Behavior:** Coach-only. Returns `text/calendar` (iCal) with:

- One `VEVENT` per session (next year): SUMMARY “Session: {client name}”, DTSTART/DTEND from `scheduled_time` and slot end or +1h.
- One `VEVENT` per availability slot (next year): SUMMARY “Availability”, STATUS TENTATIVE.

Subscription is one-way: user adds the feed URL to Google Calendar (or any iCal client). No two-way sync (no import from Google, no push of external events into ClearPath).

### 1.5 Database (scheduling-related)

- **availability_slots:** `id`, `coach_id`, `start_time`, `end_time`, `is_group_session`, `max_participants`, `session_product_id`, `label`, `client_id` (tenant), `created_at`. No recurring rule; each row is one concrete time range.
- **sessions:** `id`, `coach_id`, `client_id`, `availability_slot_id`, `scheduled_time`, `status` (pending | confirmed | cancelled | completed), `notes`, `session_request_id`, `session_product_id`, `amount_cents`, `tenant_id`, `paid_at`, `created_at`, `updated_at`. No explicit `duration_minutes` or `type`; duration can be derived from linked slot or session_product.
- **session_requests:** Offer → accept → payment → availability_submitted → coach schedules → scheduled (or cancelled).
- **client_time_requests:** Client free-text availability; coach offers session or declines.

See `02-database-schema.md` for full column list and RLS.

---

## Part 2: V2 Scheduling System Specification

### 2.1 How a coach sets their availability

**Recommendation: Support both recurring weekly schedule and manual one-off slots.**

- **Recurring weekly schedule**
  - Coach defines one or more weekly patterns, e.g. “Mon 9:00–12:00, Wed 14:00–17:00” in their timezone.
  - Stored as a separate model (e.g. `recurring_availability` or `availability_templates`) with: `coach_id`, `day_of_week` (0–6), `start_time`, `end_time` (time-of-day in coach TZ), optional `session_product_id`, optional `label`, `tenant_id`. No end date required for “every week until I change it.”
  - At read time, either:
    - **Expand on the fly:** When loading “available slots” for a date range, generate concrete slots from recurring rules (e.g. next 4–8 weeks), optionally merging with manual slots; or
    - **Background job:** A cron/edge function periodically “materializes” recurring rules into `availability_slots` rows for the next N weeks so existing slot-based logic stays unchanged.
  - **V2 preference:** Materialized slots (cron) keep coach and client UIs simple and avoid timezone/expansion bugs in the client; recurring rules are an editor-friendly way for the coach to create many slots at once.

- **Manual slots**
  - Coach can add one-off slots: pick date + start + end (and optional product/label). Insert directly into `availability_slots` with `start_time` / `end_time` (TIMESTAMPTZ). This is what you’d use for “special availability” or overrides.
  - Coach can delete or edit future slots (and optionally “delete all slots on this date” or “delete this recurring series”).

**Implementation notes:**

- **Current gap:** The app does not create `availability_slots` from the UI; only seed and (on session delete) removal exist. V2 must add:
  - Settings or Schedule tab: “Recurring availability” (day of week + time range, optional product), “Add manual slot” (date + time range).
  - If using materialized recurring: a serverless/cron job that runs (e.g. daily), reads `recurring_availability`, and inserts/updates `availability_slots` for the next 6–8 weeks, respecting coach timezone from `profiles.timezone`.
- **Conflict handling:** When a session is booked, the slot is “consumed” (session has `availability_slot_id`). Recurring materialization should not overwrite slots that already have a session; either skip or only create slots that don’t yet exist for that window.

---

### 2.2 How a session gets booked (coach vs client self-book)

**Recommendation: Keep both coach-driven and client self-book; make the rules explicit.**

- **Coach books**
  - Coach selects client and either: (a) picks a specific date/time (and optionally links to a session product / “require payment”). If “require payment,” create `session_request` (offered) and client pays then submits availability; coach then confirms time. If no payment required, create session directly (e.g. `POST /api/coach/sessions`) with status `confirmed`.
  - Or (b) coach responds to “Ready to schedule” (client already paid and submitted availability): coach picks date/time, creates session and sets `session_request` to `scheduled`.
  - Or (c) coach responds to “Client time requests”: send offer (session_request) or decline.

- **Client self-book**
  - **Option A — Book from coach’s open slots:** Client sees coach’s **manual or materialized** availability slots. For a slot with a session product: “Book & pay” → create `session_request` with `availability_slot_id` → Stripe Checkout → webhook creates session and sets request to `scheduled`. For a slot without product: “Request session” → create session with `status: 'pending'`; coach can then confirm or cancel.
  - **Option B — Request time, then coach offers:** Client submits free-text availability (`client_time_requests`); coach sends a session offer; client pays (if required) and submits availability; coach confirms time. (Current flow.)
  - **Option C (optional V2):** Client picks a time from a list of “available windows” generated from recurring + manual slots (no payment or with payment), and the app creates session or session_request in one step; coach may optionally require “approval” so session stays `pending` until coach confirms.

**Policy recommendation:** Allow coaches to configure (e.g. in `coach_client_experience` or settings) whether clients can self-book into slots without approval (current “Request session” and “Book & pay” behavior) or whether all sessions need coach approval. V2 can add a flag like `require_booking_approval` (default false for backward compatibility).

---

### 2.3 Session data model

**Recommended canonical fields (align with existing schema and add only what’s needed):**

| Field | Type | Nullable | Notes |
|-------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `coach_id` | UUID | NOT NULL | FK → profiles(id) |
| `client_id` | UUID | NOT NULL | FK → clients(id) |
| `availability_slot_id` | UUID | nullable | FK → availability_slots(id) |
| `scheduled_time` | TIMESTAMPTZ | NOT NULL | Start of session |
| `end_time` | TIMESTAMPTZ | nullable | **V2 add:** Explicit end; if null, derive from slot or session_product.duration_minutes |
| `duration_minutes` | INTEGER | nullable | **V2 optional:** Denormalized for display; else derive from session_product or slot |
| `status` | TEXT | NOT NULL | pending \| confirmed \| cancelled \| completed |
| `type` | TEXT | nullable | **V2 optional:** e.g. 'private' \| 'group' \| 'assessment'; else infer from session_product or slot |
| `notes` | TEXT | nullable | Coach notes / plan |
| `session_request_id` | UUID | nullable | FK → session_requests(id) |
| `session_product_id` | UUID | nullable | FK → session_products(id) |
| `amount_cents` | INTEGER | nullable | |
| `tenant_id` | TEXT | nullable | Tenant for RLS |
| `paid_at` | TIMESTAMPTZ | nullable | When marked paid (or Stripe paid) |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

**Summary:** Client, coach, date, time, duration (explicit or derived), type (explicit or derived), status, notes are all represented. Existing schema already has most of this; V2 can add `end_time` and optionally `duration_minutes` and `type` for clarity and to avoid joins in list views.

---

### 2.4 Calendar view for coaches (day / week / month)

**Recommendation: Day, week, and month views showing all client sessions (and optionally availability).**

- **Month view (existing):** Keep month grid; each cell shows sessions that day (client name + time). Click day → day view.
- **Week view (V2 add):** One row per day (e.g. Mon–Sun) or one column per day; time on the other axis. Show sessions (and optionally availability slots) in the correct time blocks. Enables “see my whole week” at a glance.
- **Day view (existing):** Timeline (e.g. 6:00–22:00) with sessions as blocks; click to edit/manage. Keep and optionally show unfilled availability slots as lighter blocks so coach sees “free” vs “booked.”
- **Data:** Same as now: sessions for coach in date range, with `clients` and `availability_slots` (and optional `session_products`) joined. For week/day, filter by `scheduled_time` in range; respect coach timezone for display.
- **List fallback:** “Sessions this month” or “Sessions this week” list below or beside the calendar is useful for quick actions (remind, mark paid, complete).

---

### 2.5 Calendar view for clients (upcoming sessions)

**Recommendation: Upcoming sessions list + optional simple calendar.**

- **Primary:** “My Sessions” list (existing): upcoming first, with date, time, timezone, status, and actions (e.g. request cancel, add to calendar). Optional: “Past sessions” collapsible for history.
- **Optional V2:** A simple calendar (e.g. month or week) that shows only the client’s sessions (no availability slots, no other clients). Helps clients see “when is my next session” in calendar form. Can be implemented with the same components as coach (e.g. shared calendar grid) with data filtered to `client_id = me`.
- **Timezone:** Display in coach’s timezone (or client’s preference if you add it); show timezone label so there’s no ambiguity.

---

### 2.6 Session reminders (email and in-app)

**Recommendation: Keep n8n for email/SMS; add in-app notifications for reminders.**

- **Email / SMS (existing):**
  - Manual: “Remind client” → `POST /api/sessions/[id]/send-reminder` → n8n (`N8N_SESSION_REMINDER_ON_DEMAND_URL`).
  - On book / payment: `notifySessionBooked(..., 'booked' | 'payment_confirmed')` → n8n (`N8N_SESSION_BOOKED_WEBHOOK_URL`).
  - **Automated reminders (V2):** Add a cron or scheduled job (e.g. Vercel Cron, Supabase Edge Function on a schedule) that: selects sessions where `status = 'confirmed'` and `scheduled_time` is in e.g. 24 hours (±15 min), then calls the same n8n reminder URL (or a dedicated “scheduled reminder” webhook) with type `reminder`. Optionally make the lead time configurable per coach (e.g. 24h, 2h).

- **In-app notifications (V2):**
  - Add a `notifications` table (or reuse a generic “activity” table): e.g. `user_id`, `type: 'session_reminder'`, `session_id`, `scheduled_at`, `read_at`, `created_at`. When the scheduled reminder job runs, insert a row for the client (and optionally coach) so that “next time they open the app” they see a reminder (e.g. in a bell icon or dashboard). Alternatively, use existing `messages` with a system message (“Reminder: session tomorrow at 3pm”) so it appears in the coach–client thread.
  - Optional: Push notifications (FCM/OneSignal) for “Session in 1 hour” if you add push later.

---

### 2.7 Google Calendar integration

**Recommendation: Keep iCal feed; add optional two-way sync later if needed.**

- **Current (keep):** `GET /api/calendar/feed` returns iCal with sessions + availability. Coaches (and optionally clients, if you add a client feed) can subscribe in Google Calendar via “Add by URL.” One-way: ClearPath → Google.
- **Optional V2 — two-way:**
  - Coach connects Google Calendar (OAuth): store `profiles.google_calendar_refresh_token` (or a dedicated `coach_integrations` table). On session create/update/delete, push event to Google (create/update/delete VEVENT) so the coach’s Google Calendar stays in sync.
  - Optionally: “Import from Google” to create availability from existing Google events (e.g. block out “Busy” as non-bookable). More complex (recurring, all-day, timezone); treat as a later phase.
- **Client:** A client-facing iCal feed (e.g. `GET /api/calendar/feed/client`) that returns only that client’s sessions lets them “Add to Google Calendar” for their own calendar. Same one-way model.

---

### 2.8 Supabase tables and RLS (V2)

**Existing tables (keep; optional additions):**

- **availability_slots:** No schema change required for “manual slots.” If you materialize recurring, slots are still rows here. Optional: add `source` TEXT ('manual' | 'recurring') and `recurring_availability_id` UUID nullable for traceability.
- **sessions:** Optionally add `end_time` TIMESTAMPTZ, `duration_minutes` INTEGER, `type` TEXT as in 2.3. RLS: unchanged (coaches manage in tenant; clients SELECT own).
- **session_requests:** No change required for V2 booking flows.
- **client_time_requests:** No change.

**New table (if recurring availability):**

- **recurring_availability** (or **availability_templates**)
  - `id` UUID PK, `coach_id` UUID NOT NULL FK → profiles(id), `tenant_id` TEXT, `day_of_week` SMALLINT (0–6), `start_time` TIME (or TEXT 'HH:mm'), `end_time` TIME (or TEXT), `session_product_id` UUID nullable, `label` TEXT nullable, `created_at`, `updated_at`.
  - RLS: coach can INSERT/UPDATE/DELETE/SELECT own rows in tenant.

**Notifications (optional, for in-app reminders):**

- **notifications:** `id` UUID, `user_id` UUID FK → profiles(id), `type` TEXT ('session_reminder', etc.), `session_id` UUID nullable, `title` TEXT, `body` TEXT nullable, `read_at` TIMESTAMPTZ nullable, `created_at` TIMESTAMPTZ. RLS: user can SELECT/UPDATE (mark read) own rows; backend or service role INSERT.

**RLS summary (no change to existing policies for scheduling):**

- Coaches: full CRUD on `availability_slots`, `sessions`, `session_requests`, `client_time_requests` in their tenant; SELECT on clients.
- Clients: SELECT own sessions and session_requests; SELECT coach’s availability_slots (tenant-scoped); INSERT/UPDATE own session_requests and client_time_requests as per current policies. If you add client iCal feed, use a route that authenticates the client and returns only their sessions.

---

## Part 3: Build vs library (react-big-calendar, Cal.com, etc.)

**Recommendation: Custom calendar UI with optional react-big-calendar for views; do not embed Cal.com.**

- **Custom (current):** The app already uses a custom month grid and day timeline (date-fns, no external calendar lib). This gives full control over look-and-feel, tenant branding, and integration with your session/booking logic. Keeping custom for the core “schedule” experience is consistent with the rest of the app.

- **react-big-calendar:** If you want week view and a more polished day/week/month without building from scratch, **react-big-calendar** is a good fit: it provides month, week, day, and agenda views; events are just objects with `start`/`end`/`title`; you feed it sessions (and optionally slots) and handle click/navigation in your code. You still own the data model and API; the library is only the view layer. Use it for coach (and optionally client) calendar views to save time and get consistent behavior (drag-and-drop can be disabled if you don’t want in-place reschedule).

- **Cal.com (or Calendly-style):** **Do not embed Cal.com** as the primary scheduler. Cal.com is a full product (its own auth, events, availability engine). Integrating it would duplicate your sessions, availability, and payments and complicate tenant isolation and branding. If you ever need “public booking page” behavior (anonymous user picks a time and gets a link), you can replicate that inside ClearPath: public page that shows materialized slots and creates session_request + Stripe Checkout, without adopting Cal.com’s stack.

**Summary:** Prefer **custom + date-fns** for the current scope; add **react-big-calendar** only if you want faster, richer day/week/month views. Keep session and availability data in Supabase and booking logic in your API; use n8n for reminders and optional Google push later.

---

## Summary table (V2)

| Area | Current | V2 |
|------|--------|-----|
| Coach availability | No UI to create slots; only seed | Recurring weekly + manual slots; materialize recurring into `availability_slots` (cron) |
| Booking | Coach books; client can request time, accept offer, or book/pay from slots | Same; optional “require approval” for client self-book |
| Session model | session + session_product/slot; no explicit end_time/type | Add optional `end_time`, `duration_minutes`, `type` |
| Coach calendar | Month + day timeline; list | Add week view; optional react-big-calendar |
| Client calendar | List “My Sessions” | Keep list; optional simple month/week view |
| Reminders | Manual + on book (n8n) | Add cron-based 24h (or configurable) reminder; optional in-app notification table |
| Google | iCal feed (one-way) | Keep; optional two-way push for coach; optional client iCal feed |
| Tables/RLS | availability_slots, sessions, session_requests, client_time_requests | Optional: recurring_availability, notifications; optional session columns |
| Build vs lib | Custom (date-fns) | Custom or react-big-calendar for views; no Cal.com |

This document is the single source of truth for V2 calendar and scheduling scope and design.
