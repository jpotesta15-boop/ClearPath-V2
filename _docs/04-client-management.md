# Client Management — Current State & V2 Specification

This document describes existing client/user-related behavior in the app and defines the V2 requirements for client management: how coaches add clients, client profile fields, list/detail views, client portal experience, status options, and required Supabase schema changes.

---

## Part 1: Current State (What Exists)

### 1.1 How a coach adds a new client

**Location:** `app/coach/clients/new/page.tsx`, `app/api/invite-client/route.ts`, `app/api/create-client-account/route.ts`

**Current flow:**

1. **Single “Add client” path:** Coach goes to **Clients → Add client** and fills one form.
2. **Form fields:** Full name (required), email, phone, notes.
3. **Portal access (only if email is provided):**
   - **Option A — Send invite:** Checkbox “Send invite email (client gets a link to set password and log in)”. On submit, after inserting the client row, the app calls `POST /api/invite-client` with `{ email }`. Supabase Auth `inviteUserByEmail` sends a magic link; redirect URL is `/auth/set-password`. New user gets `user_metadata: { tenant_id, role: 'client' }`; `handle_new_user` creates a `profiles` row with that role and tenant.
   - **Option B — Create login now:** No checkbox. After inserting the client row, the app calls `POST /api/create-client-account` with `{ email }`. Server generates a one-time password, creates the auth user with `email_confirm: true` and same metadata, and returns `{ ok: true, password }`. UI shows the password once and “Copy invite link” (login URL with `?email=...`).
4. **No separate “invite-only” flow:** There is no flow where the coach sends an invite *before* a client record exists. The client row is always created first (with at least `full_name` and optionally email/phone/notes), then optionally invite or create-login is called for that email.
5. **Linking client to auth:** There is no FK from `clients` to `auth.users`. The app matches “logged-in client” to “client record” by **email**: `clients.email = profiles.email` (from auth). Client dashboard and layout load the client row with `.eq('email', user?.email).single()`.

**UI states on Add Client page:**

- Initial: form with name, email, phone, notes; optional “Send invite” checkbox when email present.
- Submitting: “Saving…” on primary button; other buttons disabled.
- Error: inline message (e.g. “Failed to send invite”, “This email already has an account”).
- Success: “Client added” card with email, optional temporary password, “Copy invite link”, “Copy password”, “Go to client profile”.

**Gaps:**

- No “invite by email only” (create client record only after they accept / set password).
- No bulk import.
- No explicit “manual add only, no portal” path (you can leave email blank and skip portal; behavior is correct but not labeled as such).

---

### 1.2 Client profile — current fields

**Database (`public.clients`):**

| Field         | Type         | Nullable | In UI | Notes |
|---------------|--------------|----------|-------|--------|
| `id`          | UUID         | NOT NULL | —     | PK. |
| `coach_id`    | UUID         | NOT NULL | —     | FK → profiles(id). |
| `full_name`   | TEXT         | NOT NULL | ✓     | Name; required on add, editable on detail. |
| `email`       | TEXT         | nullable | ✓     | Used for portal login match; editable only indirectly (no dedicated email editor on detail). |
| `phone`       | TEXT         | nullable | ✓     | Contact; editable on add and on detail (ClientPhoneEditor). |
| `notes`       | TEXT         | nullable | ✓     | Coach-only notes; editable on add and on detail (ClientNotesEditor). |
| `created_at`  | TIMESTAMPTZ  | NOT NULL | —     | Set on insert. |
| `updated_at`  | TIMESTAMPTZ  | NOT NULL | —     | Updated on update. |
| `client_id`   | TEXT         | nullable | —     | Tenant identifier (e.g. `demo`). |

**Used in validation but not in DB:** `lib/validations/index.ts` `updateClientProfileSchema` and `app/coach/clients/[id]/actions.ts` and `ClientProfileDetails.tsx` use **height**, **weight_kg**, **date_of_birth**. These columns do **not** exist on `clients` (noted in `02-database-schema.md`). The UI shows and saves them; the update in `updateClientProfileAction` writes to these keys, so either the DB update silently no-ops those fields or a migration added them elsewhere—current schema doc says they are not present; treat as missing and add in V2.

**Current client profile UI (coach detail):**

- **Name:** ClientNameEditor — inline edit, save/cancel.
- **Contact:** Email (read-only display), ClientPhoneEditor (inline edit).
- **Profile details card:** ClientProfileDetails — height, weight (kg), date of birth (and derived age). Edit mode with Save/Cancel. Data source is props from server; server selects `*` from `clients` and casts for height/weight_kg/date_of_birth.
- **Notes:** ClientNotesEditor — textarea, “Save notes”.
- **Portal access:** ClientPortalAccess — “Copy invite link”, “Send invite”, “Create login / Generate password” when email present; message to add email when missing.

**Missing today:**

- Goals, start date, status, profile photo.
- Dedicated email editor on detail (email is set on add; changing it would require updating both `clients` and possibly auth).

---

### 1.3 Client list view (coach)

**Location:** `app/coach/clients/page.tsx`, `app/coach/clients/ClientListWithActions.tsx`

**Data:** Server fetches `id, full_name, email, phone, notes` from `clients` where `coach_id = user.id`, ordered by `created_at` descending. **No tenant filter** in the list query (tenant is used in detail update and RLS).

**UI:**

- Page header: title “Clients”, subtitle “Manage your roster”, primary action “Add client” → `/coach/clients/new`.
- Empty state: “No clients yet” with CTA “Add your first client” when list is empty.
- List: grid of cards (1/2/3 columns). Each card shows:
  - Avatar: initials from `full_name` (or “CP” if empty); no photo.
  - Title: `full_name` or “Unnamed client”.
  - Subtitle: email if present (truncated).
  - Body: phone if present; notes if present (line-clamp 3).
- Click: card links to `/coach/clients/[id]` (when not in select mode).
- **Select mode:** “Select” button toggles multi-select. Toolbar: “X selected”, “Set name”, “Delete”, “Select all unnamed”, “Cancel”. “Set name” opens modal to set one display name for all selected; “Delete” opens confirm modal. Bulk actions use `bulkUpdateClientNamesAction` and `bulkDeleteClientsAction`.

**Filtering/sorting:** None. No search in the current code (no search box, no filter by status/date).

---

### 1.4 Client detail view (coach)

**Location:** `app/coach/clients/[id]/page.tsx` and components in `app/coach/clients/[id]/`.

**Data loaded (server):**

- Client: `clients.*` for `id` and `coach_id = user.id`.
- Sessions: last 10 for this client, ordered by `scheduled_time` desc.
- Program assignments with program names/descriptions.
- Session requests (offered/accepted/payment_pending/paid/availability_submitted/scheduled/cancelled) with product name, amount, status.
- Counts: completed sessions, upcoming sessions, video completions.
- Last session date (for “Last active”).
- Balance owed: sum of `amount_cents` for session_requests in offered/accepted/payment_pending.

**Layout and sections (top to bottom):**

1. **Back:** “← Back to Clients” → `/coach/clients`.
2. **Header row:** ClientNameEditor (h1 + “Edit name”), “Message” button → `/coach/messages?client=[id]`.
3. **Stats card:** KPIs — Sessions completed, Upcoming, Videos completed, Last active.
4. **Notes:** ClientNotesEditor (full-width card).
5. **Two-column grid:**
   - **Contact information:** Email (read-only), ClientPhoneEditor.
   - **Profile details:** ClientProfileDetails (height, weight, DOB/age).
   - **Client portal access:** ClientPortalAccess.
6. **Assigned programs:** List of program names/descriptions; empty state “Assign from Programs.”
7. **Balance owed (conditional):** Shown only if balance &gt; 0; amount and RequestPaymentButton.
8. **Session offers:** List of session requests with status labels and “Pick time” for availability_submitted.
9. **Session history:** SessionHistoryWithPay — list of sessions with status, date, mark-as-paid / record manual payment.
10. **Danger zone:** DeleteClientButton with confirm.

**UI states:**

- **Loading:** Standard page load (no dedicated skeleton on this page in the snippets seen).
- **Not found:** `notFound()` if no client for id + coach_id.
- **Save states:** Each editor (name, phone, notes, profile details) has saving/success/error inline.

---

### 1.5 What the client sees when they log in

**Auth and resolution:** Client logs in with email/password (or invite link → set password). Layout loads profile; client layout resolves client row by `clients.email = user.email`. If no client row, dashboard shows “No client record for this account” and suggests the coach add them and create login.

**Routes and nav:** Client layout builds nav from `ALL_CLIENT_NAV` filtered by `portal_nav_enabled` (from `coach_client_experience.portal_nav_enabled`). Default enabled sections: schedule, messages, programs, videos (and home/settings always). So the client sees:

- **Home** → `/client/dashboard`
- **Programs** → `/client/programs` (if enabled)
- **Schedule** → `/client/schedule` (if enabled)
- **Videos** → `/client/videos` (if enabled)
- **Messages** → `/client/messages` (if enabled)
- **Settings** → `/client/settings`

**Dashboard (`/client/dashboard`):**

- PageHeader: “Home”, “Welcome back, {client.full_name}”.
- Optional welcome block (from coach_client_experience: title, body, hero image, intro video).
- If balance owed &gt; 0: card “You owe $X.XX”, “Pay for your session offers on the Schedule page”, “Pay now” → `/client/schedule`.
- If no upcoming sessions / programs / daily message: short CTA to go to Schedule or Messages.
- Daily message from coach (if any).
- **Upcoming sessions:** next 5 confirmed, future; date/time and status.
- **My programs:** assigned programs with name/description.

**Programs page:** Lists assigned programs; can expand to show lessons (video/link/note/image) with completion/links.

**Schedule page:** Upcoming sessions, session offers (pay / decline), submit availability for paid offers, time requests, coach timezone.

**Videos page:** Assigned videos; mark complete.

**Messages page:** Thread with coach; mark read.

**Settings page:** Contact (phone only — saved to `clients.phone`), theme mode (dark/light), accent color. Client can update own phone via `updateClientPhoneAction` (RLS allows client UPDATE on own row by email match).

**What the client does not see:** Goals, start date, status, profile photo, coach-only notes, or any other coach-only profile fields. They see only what’s exposed by the above pages (name on dashboard, phone in settings, sessions, programs, videos, messages).

---

### 1.6 Client status (current)

**There is no client status in the app or schema.** The `clients` table has no `status` column. All clients are treated as “active” for list/detail and portal access. There is no “paused” or “completed” state.

---

### 1.7 Supabase tables involved (current)

- **`public.clients`** — See 1.2. No status, no goals, no start_date, no profile_photo; height/weight_kg/date_of_birth are in validation/UI but not in documented schema (add or remove in V2).
- **`public.profiles`** — Auth extension; `role = 'client'` and `tenant_id` set on invite/create; used for login and client layout.
- **`auth.users`** — Created by invite or create-client-account; link to client is by email match, not FK.
- **RLS:** Coaches can manage clients in their tenant; clients can SELECT self (tenant + email) and UPDATE own phone.

No other tables are created solely for “client management”; sessions, program_assignments, session_requests, messages, etc. reference `clients.id` or `clients.email` as already documented in `02-database-schema.md`.

---

## Part 2: V2 Requirements

### 2.1 How a coach adds a new client (V2)

**Two clearly supported paths:**

**(1) Invite flow (email-first)**  
- Coach enters **email** (and optionally name).  
- Coach clicks “Send invite”.  
- System sends invite (e.g. magic link to set password) and creates a **pending** client record (or a dedicated `client_invites` row) keyed by email and coach_id.  
- When the user sets password and signs in, the app either:  
  - Links the new auth user to the pending client (e.g. set `clients.user_id` or match by email) and marks “active”, or  
  - Creates the `clients` row at first login with `email`, `coach_id`, and any pre-filled name.  
- **UI states:** “Invite sent”; “Pending – waiting for client to accept”; optional “Resend invite”, “Cancel invite”.

**(2) Manual add (record-first)**  
- Coach enters **full name** (required), **email** (optional), **phone**, **notes**, and any other V2 profile fields (e.g. goals, start date, status).  
- On save, one row in `clients` is created.  
- **Portal access (only if email provided):**  
  - “Send invite” → same as (1) but for an existing client row (ensure client row exists and is linked when they sign in).  
  - “Create login” → generate password, create auth user, return password once; client can log in immediately; link by email.  
- **Manual add without email:** Client exists for the coach (sessions, notes, programs) but has no portal access until email is added and invite/create-login is used.

**Specifics:**

- Every add path must set **tenant** (`client_id` / tenant_id) and **coach_id**.  
- Invite and create-login APIs must remain rate-limited and coach-only; error messages for “already has account” and “invite failed” must stay user-friendly.  
- After add (either path), coach can go to client detail; after invite, coach sees “Pending” until client completes sign-up (if V2 has pending state).

---

### 2.2 Client profile (V2) — every field

Single source of truth for the **client record** (coach-facing profile). All fields below should exist in the schema and be editable where noted.

| Field | Type | Nullable | Who edits | Notes |
|-------|------|----------|-----------|--------|
| **id** | UUID | NOT NULL | — | PK. |
| **coach_id** | UUID | NOT NULL | — | FK → profiles(id). |
| **full_name** | TEXT | NOT NULL | Coach | Display name; required. |
| **email** | TEXT | nullable | Coach | For login match and communications; required for portal. |
| **phone** | TEXT | nullable | Coach + Client (own) | Contact; client can update in Settings. |
| **profile_photo_url** | TEXT | nullable | Coach (and optionally Client) | URL to uploaded image (e.g. Supabase Storage). |
| **goals** | TEXT | nullable | Coach | Free-text or structured “client goals”. |
| **start_date** | DATE or TIMESTAMPTZ | nullable | Coach | When client started with coach. |
| **status** | TEXT | NOT NULL | Coach | One of: `active`, `paused`, `completed`. Default `active`. See 2.6. |
| **notes** | TEXT | nullable | Coach | Coach-only notes (not visible to client). |
| **height** | TEXT | nullable | Coach | If kept (current UI); or remove if not needed. |
| **weight_kg** | NUMERIC | nullable | Coach | Optional. |
| **date_of_birth** | DATE | nullable | Coach | Optional; can derive age in UI. |
| **created_at** | TIMESTAMPTZ | NOT NULL | — | Set on insert. |
| **updated_at** | TIMESTAMPTZ | NOT NULL | — | Set on update. |
| **tenant_id** | TEXT | nullable | — | Tenant/brand (e.g. `demo`). Keep naming consistent with existing `client_id` if that column is the tenant id. |

**Profile photo:** Storage in Supabase Storage; `profile_photo_url` stores the public or signed URL. Coach (and optionally client) can upload/change/remove. UI: avatar on list and detail; fallback to initials when no photo.

**Goals:** One field is enough for V2 (e.g. textarea). Later: structured tags or multiple goal lines.

**Start date:** Date picker in coach profile/detail; show “Member since …” in list/detail and optionally in client-facing dashboard.

**Status:** Drives list filters and portal access (see 2.6). Must be one of `active` | `paused` | `completed`.

---

### 2.3 Client list view (V2) — how coaches see and filter

**Data:** Load all clients for the coach (with `coach_id` and tenant filter if used elsewhere). Include at least: `id`, `full_name`, `email`, `phone`, `status`, `start_date`, `profile_photo_url`, `notes` (for preview/truncate). Order by a sensible default (e.g. `updated_at` or `full_name`).

**Display:**

- **Card or row:** Avatar (profile_photo_url or initials), full_name (or “Unnamed client”), email (truncated), optional phone, **status badge** (active / paused / completed), optional “Member since {start_date}”, short notes preview.
- **Click:** Navigate to client detail `/coach/clients/[id]`.
- **Empty state:** Same idea as now; CTA to add client (invite or manual).

**Filtering (V2 must have):**

- **By status:** Filter by one or more of `active`, `paused`, `completed` (e.g. tabs or dropdown). Default: “Active” or “All”.
- **Search:** By name and/or email (client-side or server-side); clear behavior when no results.

**Sorting (optional but recommended):** Sort by name (A–Z / Z–A), start date (newest/oldest), last active, or status. One primary sort with optional toggle.

**Bulk actions (keep/improve):** Keep “Select” mode; “Set name” and “Delete” for selected; optionally “Set status” (e.g. mark as paused or completed) for selected.

**UI states:**

- Loading: Skeleton list or spinner.
- Loaded: List with optional “No clients match” when filters return empty.
- Error: Inline or small banner “Could not load clients.”

---

### 2.4 Client detail view (V2) — everything a coach sees

**URL:** `/coach/clients/[id]`. Same as now; 404 if not found or not coach’s client.

**Sections (recommended order):**

1. **Back** to client list.
2. **Header:** Avatar (profile_photo_url or initials), client name (editable), **status** (editable: dropdown or button group active/paused/completed), primary action “Message” (and optionally “Request payment” if balance &gt; 0).
3. **Stats strip:** Sessions completed, Upcoming, Videos completed, Last active, optional “Member since {start_date}”.
4. **Profile block:**  
   - Contact: email (editable if V2 supports it), phone (editable).  
   - Goals (editable textarea or list).  
   - Start date (editable).  
   - Height, weight, DOB (optional; keep only if in schema).  
   - Profile photo upload/remove.
5. **Notes:** Coach-only notes (textarea), Save.
6. **Portal access:** Same idea as now: copy invite link, send invite, create login; show “Portal access: Yes/No” and last login if available.
7. **Assigned programs:** List with links to program detail; empty state.
8. **Balance owed:** If &gt; 0, amount and “Request payment”.
9. **Session offers:** List with status and actions (e.g. Pick time).
10. **Session history:** Table/list with mark paid / record manual.
11. **Danger zone:** Delete client (with confirm and explanation).

**UI states:**

- Loading: Skeleton or spinner for full page or per section.
- Not found: 404.
- Saving: Per-section (e.g. “Saving…” on name, status, notes, goals, photo).
- Success/error: Inline per field or section (e.g. “Saved” / “Could not save”).

**Data:** All client fields from 2.2 plus sessions, program_assignments, session_requests, counts, and balance as today; add status and start_date (and goals, profile_photo_url) in selects and pass to components.

---

### 2.5 What the client sees when they log in (V2)

**Resolution:** Unchanged: client row by `email = user.email` (and tenant). If no row or status is not allowed to access portal (see 2.6), show a clear message and optional logout.

**Nav:** Still driven by `portal_nav_enabled`. Same routes: Home, Programs, Schedule, Videos, Messages, Settings. No “client profile” page is required for V2 unless we add a read-only “My profile” (name, photo, goals, start date — only what coach allows to be visible). For V2, “what the client sees” can stay as today plus:

- **Dashboard:** “Welcome back, {full_name}”; optional “Member since {start_date}”; welcome block, balance owed, daily message, upcoming sessions, programs (as now). If profile_photo_url is stored, client could see their photo in header/settings later.
- **Settings:** Phone (editable), theme, accent. Optionally allow client to upload/change profile photo if product wants it.
- **Programs / Schedule / Videos / Messages:** Unchanged in scope; only ensure they respect status (e.g. paused/completed may hide or limit features per 2.6).

**Client-visible profile fields (recommended for V2):**  
Name (read-only), phone (editable), optional profile photo (editable if we allow). Goals and start date can be shown on dashboard or a “My profile” section if desired; coach-only notes never visible to client.

---

### 2.6 Client status options (V2)

**Values:** `active` | `paused` | `completed`.

**Semantics:**

- **active:** Normal: can use portal (if they have login), appear in “active” filters, get messages/sessions/offers as today.
- **paused:** Temporarily not training: portal access can be disabled or limited (e.g. view-only); they do not get new session offers or reminders; coach can still see them in list/detail and change back to active.
- **completed:** Relationship ended: same as paused for portal (no new bookings/offers); coach keeps the record for history; exclude from “active” counts and default list filter.

**Behavior:**

- **List:** Default filter “Active” (status = active); optional “All” / “Paused” / “Completed”.
- **Detail:** Coach can change status (dropdown or buttons); confirm for “completed” optional.
- **Portal:** If status is not `active`, either block login with a message (“Your access is paused” / “Your program is completed”) or allow read-only. Recommendation: block or read-only for paused/completed.
- **Sessions/offers:** Do not create new session_requests or availability for paused/completed; hide or disable “Request payment” for them in coach UI if desired. Existing sessions can remain visible for history.

**DB:** `clients.status` TEXT NOT NULL DEFAULT `'active'` with CHECK (`status` IN (`'active'`,`'paused'`,`'completed'`)).

---

### 2.7 Supabase tables — create or modify (V2)

**`public.clients` (modify):**

- **Add columns:**  
  - `status` TEXT NOT NULL DEFAULT `'active'`  
    - CHECK (`status` IN (`'active'`,`'paused'`,`'completed'`)).  
  - `start_date` DATE NULL (or TIMESTAMPTZ if you prefer).  
  - `goals` TEXT NULL.  
  - `profile_photo_url` TEXT NULL.  
- **Align with validation/UI:** Add `height` TEXT NULL, `weight_kg` NUMERIC NULL, `date_of_birth` DATE NULL if you keep them (and keep ClientProfileDetails); otherwise remove from validation and UI.  
- **Naming:** If the tenant column is currently `client_id`, consider adding a comment or a view so it’s clear it’s “tenant_id”; renaming can be a separate migration to avoid breaking RLS.

**Indexes:**

- Add index on `(coach_id, status)` for filtered list queries (e.g. “active only”).  
- Optional: index on `start_date` for “sort by start date”.

**RLS:** No change required for coach/client rules if you only add columns; ensure UPDATE allows coach to set `status`, `goals`, `start_date`, `profile_photo_url`. Client UPDATE remains limited to own row and typically only `phone` (and optionally profile_photo if client can edit).

**Storage (if profile photo):** Create a Supabase Storage bucket (e.g. `client-photos`) with policy: coach can upload/update/delete for their clients; client can read/update own if we allow client photo edit. Store the resulting public or signed URL in `clients.profile_photo_url`.

**Optional — `client_invites` (only if you want a separate invite-first flow):**

- Columns: `id` UUID PK, `coach_id` UUID FK profiles, `email` TEXT NOT NULL, `invited_at` TIMESTAMPTZ, `token` or `status` (e.g. pending/accepted/expired), `tenant_id` TEXT.  
- When user accepts invite, create or update `clients` and mark invite accepted. This is optional; you can instead create a “pending” client row with a flag and no auth link until they sign in.

**No new tables required** for core V2 beyond modifying `clients` and optionally adding Storage + invite table.

---

## Summary

- **Current:** One “Add client” form (name, email, phone, notes) with optional “Send invite” or “Create login”; client list with cards and bulk name/delete; detail with name, contact, notes, profile details (height/weight/DOB in UI but columns missing in DB), portal access, programs, session offers, session history, delete. Client portal: dashboard, programs, schedule, videos, messages, settings (phone + theme). No client status; no goals, start date, or profile photo.
- **V2:** (1) Two paths: invite flow (email-first, pending until sign-in) and manual add (record-first, optional invite/create-login). (2) Full profile: name, email, phone, goals, start date, status, profile photo, notes (plus optional height/weight/DOB). (3) List with status badge, search, and filter by status (and optional sort). (4) Detail with all profile fields, status control, and same sections as today, improved. (5) Client sees same portal; optional “Member since” and profile photo; behavior respects status. (6) Status = active | paused | completed with defined behavior and portal rules. (7) Schema: add `status`, `start_date`, `goals`, `profile_photo_url` (and optional height/weight_kg/date_of_birth) to `clients`; add index on (coach_id, status); add Storage for photos; optionally add `client_invites` for invite-first flow.

This document is the single reference for client management current state and V2 behavior and schema.
