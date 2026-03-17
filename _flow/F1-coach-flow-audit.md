# F1 Coach Flow Audit

This document traces each coach user journey through the actual codebase: pages visited, API calls, data saved, and flags broken steps, missing screens, and poor experience. Friction score: 1–10 (10 = completely smooth).

---

## Journey 1: Coach signs up → verifies email → lands on dashboard

### Code trace

| Step | Location | What happens |
|------|----------|--------------|
| Entry | `app/page.tsx` | Authenticated users redirect by role; unauthenticated → `/login`. |
| Sign-in | `app/login/page.tsx` | **No dedicated sign-up page.** Same page for login. Options: (1) **Email/password** → `signInWithPassword()`; (2) **Google** → `signInWithOAuth({ provider: 'google' })` with `redirectTo: .../auth/callback`. No `signUp()` or “Create account” link. |
| After email login | `app/login/page.tsx` L91–102 | On success, client fetches `profiles.role` and `router.push(profile?.role === 'coach' ? '/coach/dashboard' : '/client/dashboard')`. |
| After Google | `app/auth/callback/route.ts` | `exchangeCodeForSession(code)`; then `profiles.role`; redirect to `/coach/dashboard` or `/client/dashboard` or `next`. On error → `/login?error=auth`. |
| Profile creation | `supabase/migrations/20240107000000_handle_new_user.sql` | Trigger `on_auth_user_created`: INSERT into `profiles` (id, email, full_name, role). **First user gets `role = 'coach'`**, all others `'client'`. No explicit email verification step in app; Supabase may send confirmation depending on project settings. |
| Dashboard | `app/coach/dashboard/page.tsx` | Server component: 15+ parallel Supabase queries (clients, sessions, messages, revenue, availability, session_products, coach_daily_messages, etc.). Passes props to `<DashboardContent>`. |
| Empty dashboard | `app/coach/dashboard/DashboardContent.tsx` | **Onboarding:** If `!onboardingDismissed` (from `profiles.preferences.onboarding_checklist_dismissed`), shows “Get started” card with three steps: (1) Add your first client → `/coach/clients/new`, (2) Schedule your first session → `/coach/schedule`, (3) Create a session package → `/coach/session-packages`. Each step shows a checkmark when done (`hasClients`, `hasAvailability`, `hasSessionPackage`). Dismissible via server action `dismissOnboardingChecklist` (persists in `profiles.preferences`). Empty states: “Nothing scheduled next”, “No availability requests”, “No recent messages”, each with CTAs. Revenue chart and Stripe card always shown (can be $0). |

### Broken steps / gaps

- **No coach sign-up flow:** New coaches cannot self-register with email/password; only “Sign in” exists. First user (Google or email, if signUp is used elsewhere) becomes coach; otherwise an admin must set `profiles.role = 'coach'` in SQL.
- **Email verification:** Not surfaced in-app; depends entirely on Supabase Auth config. No “Verify your email” screen or resend link.
- **Root `/` when logged in:** `middleware.ts` does not redirect `/` to dashboard; `app/page.tsx` does (server redirect by role). So landing on `/` while logged in correctly sends coach to `/coach/dashboard`.

### Friction score: **5/10**

### Improvements

1. Add a “Create account” path: either a sign-up form using `signUp()` with redirect to set-password or email confirmation, or a clear “New coach? Sign up with Google” that explains first user = coach.
2. After sign-up (email), show a “Check your email to verify” screen with resend option if Supabase email confirmation is enabled.
3. Optional: post-signup coach onboarding route (e.g. “Complete your profile” or “Connect Stripe”) before dropping into full dashboard.
4. Document in admin/ops how to promote a user to coach (SQL or future admin UI).

---

## Journey 2: Coach adds a new client

### Code trace

| Step | Location | What happens |
|------|----------|--------------|
| Navigate | `app/coach/clients/page.tsx` | List of clients; “Add client” → `/coach/clients/new`. |
| Form | `app/coach/clients/new/page.tsx` | **Form fields:** `full_name` (required), `email`, `phone`, `notes`. Optional section “2. Portal access”: checkbox “Send invite email (client gets a link to set password and log in)”. If unchecked but email present, app “creates login now” and returns a one-time password. |
| Submit | Same file L27–98 | (1) `supabase.from('clients').insert({ coach_id, full_name, email, phone, notes, ...client_id })` → `.select('id').single()`. (2) If `sendInvite && email`: `POST /api/invite-client` with `{ email }`. (3) Else if email: `POST /api/create-client-account` with `{ email }` → returns `password` in JSON. (4) On success, sets `createdCredentials` (id, email, password?) and does **not** redirect; shows “Client added” card. |
| Invite API | `app/api/invite-client/route.ts` | Validates coach role; `inviteClientSchema` (email); `admin.auth.admin.inviteUserByEmail(email, { redirectTo: origin + '/auth/set-password', data: { tenant_id, role: 'client' } })`. Client receives Supabase invite email. |
| Create-account API | `app/api/create-client-account/route.ts` | `admin.auth.admin.createUser({ email, password: generatePassword(), email_confirm: true, ... })`; updates `profiles.tenant_id`; returns `{ ok: true, password }`. |
| After add | `app/coach/clients/new/page.tsx` L207–272 | “Client added” card with email, optional temporary password, “Copy invite link”, “Copy password”, **“Go to client profile”** → `router.push(\`/coach/clients/${createdCredentials.id}\`)`. Coach stays on page until they click that or “Back to Clients”. |

### Broken steps / gaps

- **Client without email:** Insert succeeds with `email: null`. No invite and no create-account call. “Client added” card still shows; “Go to client profile” works. Copy invite link uses login URL with pre-filled email (which is empty) — suboptimal.
- **Invite failure after insert:** If client row is inserted but `/api/invite-client` fails, coach sees “Failed to send invite. Please try again.” Client record already exists; no rollback. Coach could retry invite from client profile (e.g. ClientPortalAccess) if that flow exists.
- **Coach can see client immediately:** Yes — via “Go to client profile” on the success card. Client list at `/coach/clients` would show the new client on next visit (no auto-redirect to list).

### Friction score: **7/10**

### Improvements

1. If invite fails after insert, show clear message: “Client was added. Invite could not be sent. You can send an invite from their profile.” and link to client profile.
2. Optional: after success, offer “Add another client” and “View client list” in addition to “Go to client profile”.
3. When email is missing, hide “Copy invite link” or show a message that client must be sent the link after adding email.
4. Consider making email required if “Send invite” or “Create login” is desired (or disable those options when email is empty).

---

## Journey 3: Coach creates a program → adds modules → adds a video → assigns to a client

### Code trace

| Step | Location | What happens |
|------|----------|--------------|
| Programs list | `app/coach/programs/page.tsx` | Client component; “Create Program” toggles form. **Create form:** name (required), description. On submit: `supabase.from('programs').insert({ coach_id, client_id: tenantId, ...newProgram })` → `router.push(\`/coach/programs/${created.id}\`)`. |
| Program detail | `app/coach/programs/[id]/page.tsx` → `ProgramDetailDynamic` → `ProgramDetailClient.tsx` | Loads program, `program_lessons`, library videos, `program_assignments`, all clients, completion counts. **No “modules” in V1:** content is a flat list of lessons (video, link, note, image). |
| Add video to program | `ProgramDetailClient.tsx` | “Add video” → choose from existing library videos (checkboxes) → “Add selected” → `program_lessons.insert({ program_id, lesson_type: 'video', video_id, sort_order })`. Videos must exist in library first (added from Videos page via URL paste). |
| Add link/note/image | Same file | “Add link” (title + URL), “Add note” (content), “Add image” (title + URL) → insert into `program_lessons` with appropriate `lesson_type`. |
| Assign to client | Same file L364–403 | “Who has access”: dropdown “Add access” with unassigned clients; “Add access” calls `handleAssignClients([assignClientId])`: (1) `program_assignments.upsert` (program_id, client_id); (2) for each lesson with `video_id`, `video_assignments.upsert` so client can see those videos. **RLS gap (A2-data-model-gaps, A5-v1-honest-summary):** No coach policy for INSERT/UPDATE/DELETE on `program_assignments` in migrations; coach UI uses anon client — may fail in production RLS. |
| Client sees program | `app/client/programs/page.tsx` | Server load: `program_assignments` + `programs` for client; `program_lessons` + `videos` for those program IDs. Renders list of assigned programs and lessons. **No real-time:** Client sees assignment on next page load. |

### Broken steps / gaps

- **No “modules” in product:** Specs (08-program-builder) describe modules/weeks for V2; current schema is flat `program_lessons`. Journey is “add lessons (video/link/note/image)” not “add modules”.
- **program_assignments RLS:** Coach assign/remove may be denied if RLS only allows client SELECT. Add coach policy for INSERT/UPDATE/DELETE where program’s coach belongs to tenant.
- **Video must exist first:** Coach must go to Videos, add video (paste URL or n8n), then return to program to add it. No “add new video from here” in program detail.
- **Client “immediately” sees it:** Yes, on next load of `/client/programs` (server-rendered from `program_assignments` + `program_lessons`). No push/real-time.

### Friction score: **6/10**

### Improvements

1. Add RLS policy so coaches can INSERT/UPDATE/DELETE `program_assignments` for their programs in their tenant.
2. In program detail, add “Add video from library” plus optional “Add new video (paste URL)” that creates video then adds as lesson (or opens Videos in new tab with return context).
3. After assigning a client, show a short confirmation: “X has access. They’ll see this program on their Programs page.”
4. If desired for journey wording, rename “Contents” to “Lessons” or “Modules” and document that V2 will add module grouping.

---

## Journey 4: Coach imports a video from Google Drive

### Code trace

| Step | Location | What happens |
|------|----------|--------------|
| In-app “add video” | `app/coach/videos/page.tsx` | “Add Video” form: **title**, **description**, **Video URL** (placeholder “YouTube, Vimeo, or a shareable link (e.g. Google Drive)”), **category**. Submit → `supabase.from('videos').insert({ coach_id, client_id, ...newVideo })`. **No in-app “Import from Google Drive”** — only paste URL. |
| Google Drive via n8n | `docs/n8n-google-drive-video.md`, `n8n/` | Optional: n8n workflow watches a Drive folder; on new file can download, optionally convert (e.g. CloudConvert MOV→MP4), then `POST /api/webhooks/n8n-video` with `title`, `url`, `description`, `category`, optional `coach_id`. |
| Webhook | `app/api/webhooks/n8n-video/route.ts` | Auth: Bearer or `x-n8n-secret` must match `N8N_VIDEO_WEBHOOK_SECRET`. Body parsed with `n8nVideoSchema`. Insert into `videos` (service client). Returns `{ ok: true, id }` or error. **No processing status table:** video appears in library only when webhook succeeds. |
| Coach experience | — | **During “processing” (n8n running):** Coach has no in-app status. No “Import from Drive” button, no queue, no “Processing…”. **If n8n fails:** Coach never sees failure in app; video simply doesn’t appear. No retry or error list. |

### Broken steps / gaps

- **No in-app Drive import:** “Import from Google Drive” exists only as an external n8n flow. Coach either pastes a Drive share URL in the existing form or relies on n8n (and knows to check n8n for errors).
- **No processing status:** No `video_import_jobs` or similar; no “Queued / Processing / Ready / Failed” in UI (07-video-pipeline describes this for V2).
- **No status feedback:** Coach cannot see that an import is in progress or that one failed.
- **Failure handling:** If webhook returns 4xx/5xx, n8n may show it in executions; app does not surface this to the coach.

### Friction score: **3/10**

### Improvements

1. Add an “Import from Google Drive” entry point in the Videos page (even if V1 only opens docs or a “Paste Drive link below” CTA) so the path is discoverable.
2. Document clearly: “To add from Drive automatically, set up the n8n workflow; otherwise paste a shareable Drive link in Add Video.”
3. For V2: implement Drive OAuth, import jobs table, and UI showing “Recent imports” with status (queued/processing/ready/failed) and retry for failed (07-video-pipeline).
4. If keeping n8n-only: add a simple “Recent imports” list fed by webhook logs or a small `video_import_log` table so coach can see last N attempts and success/failure.

---

## Journey 5: Coach views all sessions for the week → books a new session → sends the client a reminder

### Code trace

| Step | Location | What happens |
|------|----------|--------------|
| Schedule page | `app/coach/schedule/page.tsx` | Client component; `loadData()` fetches: profiles (timezone), `availability_slots`, `sessions` (with clients, slots), `clients`, `session_products`, `session_requests` (availability_submitted), `client_time_requests`. **View:** Month calendar (`month`, `eachDayOfInterval`, `isSameMonth`); no dedicated “this week” filter. Sessions shown in calendar and in lists; coach can change month (prev/next). |
| Sessions for week | Same file | Sessions are filtered by calendar month. “All sessions for the week” is not a dedicated view; coach sees the month and can infer the week. No week-only tab or filter. |
| Book session | Same file | Multiple paths: (1) “Book session” (ad hoc): pick client, date, start/end time, optional product, “Require payment” → create session (and optionally availability_slot). (2) From “Ready to schedule”: pick a session request (client who submitted availability) and assign time → create session. (3) From availability slot: assign client to slot → create session. Sessions created via `supabase.from('sessions').insert(...)`. |
| Send reminder | Same file L301–319 | `handleSendReminder(sessionId)` → `POST /api/sessions/${sessionId}/send-reminder` (credentials: include). **UI:** “Remind client” appears inside the **edit-session modal** (only when session is `confirmed` and `scheduled_time` > now). Coach must open a session (e.g. click session) → modal → “Remind client”. |
| Send-reminder API | `app/api/sessions/[id]/send-reminder/route.ts` | Coach only; session must be coach’s, `status === 'confirmed'`, future. Builds payload (session_id, coach/client names, emails, phones, scheduled_time, type: 'reminder'). If `N8N_SESSION_REMINDER_ON_DEMAND_URL` set, POSTs to n8n; else returns `{ ok: true, forwarded: false }`. Rate limit 30/min per user. On n8n failure returns 502. |

### Broken steps / gaps

- **Week view:** No “View this week” or week-scoped list; only month calendar. Coach must mentally isolate the week.
- **Remind discoverability:** “Remind client” is only in the edit-session modal. If coach doesn’t open the session, they may not find it. No bulk “Send reminders for tomorrow” or list-level “Remind” button.
- **Reminder when n8n not configured:** API returns 200 with `forwarded: false`; coach sees no error. Client receives nothing; coach is not told that no reminder was sent.
- **Success feedback:** After “Remind client”, modal stays open; no toast or inline “Reminder sent.” (only `reminderError` on failure).

### Friction score: **6/10**

### Improvements

1. Add a “This week” filter or tab on Schedule that shows only sessions in the current week (e.g. Monday–Sunday or next 7 days).
2. Show “Remind” on the session row/card (for confirmed future sessions) so coach doesn’t have to open the modal to send a reminder.
3. When `N8N_SESSION_REMINDER_ON_DEMAND_URL` is unset, return a distinct response (e.g. `forwarded: false` with message) and show in UI: “Reminder not sent (notifications not configured).”
4. On successful reminder, show brief confirmation: “Reminder sent to client” and optionally clear or keep modal open.
5. Optional: “Send reminders for all confirmed sessions tomorrow” bulk action.

---

## Summary table

| Journey | Friction (1–10) | Main issues |
|---------|-----------------|------------|
| 1. Sign up → verify → dashboard | 5 | No coach sign-up page; email verification not in-app; onboarding checklist present and good. |
| 2. Add client | 7 | Invite failure leaves client created but coach sees error; no rollback; otherwise clear and coach can see client immediately. |
| 3. Program → modules → video → assign | 6 | No modules (flat lessons); program_assignments RLS gap; video must exist before adding to program; client sees on next load. |
| 4. Import video from Google Drive | 3 | No in-app Drive import; no processing status or failure feedback; only paste URL or n8n. |
| 5. Sessions week → book → remind | 6 | No week-only view; Remind only in edit modal; no feedback when n8n not configured; no success toast. |

---

## Document info

- **Audit date:** 2025-03-15  
- **Scope:** Coach user journeys only; code traced in `app/coach/`, `app/login/`, `app/auth/`, `app/api/`, and related layouts/middleware.  
- **References:** `12-user-flows.md`, `04-client-management.md`, `07-video-pipeline.md`, `08-program-builder.md`, `06-calendar-scheduling.md`, `A5-v1-honest-summary.md`, `02-database-schema.md`, `11-auth-permissions.md`.
