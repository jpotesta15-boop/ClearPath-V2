# 12 — User Flows (V2)

This document describes step-by-step user flows for every major journey in ClearPath V2. Each flow is written as numbered steps with the page or screen the user is on and what data is being saved or loaded. No diagrams—text only.

---

## 1. Coach onboarding — from signup to having their first client added

**Goal:** A new coach signs up, completes initial setup, and adds their first client so they can start using the platform.

| Step | Page / screen | Action | Data saved / loaded |
|------|----------------|--------|----------------------|
| 1 | **/** (home) | Coach visits the app. Not logged in. | — |
| 2 | **/login** | Redirected to login. Coach enters email and password (or clicks “Sign in with Google”). | — |
| 3 | **/login** | Submits credentials. Auth request to Supabase. | **Loaded:** Session established. **Saved:** `auth.users` row (if signup); `handle_new_user` trigger creates **profiles** row with `role: 'coach'`, `tenant_id` from metadata or default. |
| 4 | **GET /auth/callback** (if OAuth) | After OAuth, Google redirects with `code`. App exchanges code for session. | **Loaded:** Session. **Saved:** Same as step 3 for new user; existing user gets session only. |
| 5 | **/coach/dashboard** | App redirects coach to dashboard by role. | **Loaded:** `profiles` (display_name, timezone), `clients` count, `messages` count, `availability_slots` count, `session_products` count; recent messages; revenue/KPIs. |
| 6 | **/coach/settings** (optional) | Coach clicks Settings in nav. Can set display name, timezone, logo, tagline. | **Loaded:** `profiles` (current coach). **Saved:** `profiles` (display_name, timezone, logo_url, tagline) on save. |
| 7 | **/coach/settings** (optional) | Coach clicks “Connect Stripe” to receive payments. | **Loaded:** `GET /api/stripe/connect/account-link` returns Stripe onboarding URL. **Saved:** After Stripe callback, `profiles.stripe_connect_account_id`, `stripe_connect_onboarded_at`. |
| 8 | **/coach/clients** | Coach goes to Clients. Sees empty list. | **Loaded:** `clients` where `coach_id = user.id` (empty). |
| 9 | **/coach/clients/new** | Coach clicks “Add client”. Opens add-client form. | — |
| 10 | **/coach/clients/new** | Coach enters full name (required), email, phone, notes. Optionally checks “Send invite” or leaves unchecked for “Create login now”. Submits. | **Saved:** Insert into **clients** (coach_id, full_name, email, phone, notes, client_id/tenant). If “Send invite”: **POST /api/invite-client** → Supabase Auth `inviteUserByEmail`; redirect URL `/auth/set-password`; new user gets `user_metadata: { tenant_id, role: 'client' }`; trigger creates **profiles** row. If “Create login”: **POST /api/create-client-account** → auth user created, returns password once; UI shows “Copy invite link”, “Copy password”. |
| 11 | **/coach/clients/new** (success state) | Success card: “Client added”, optional password, “Go to client profile”. | **Loaded:** New client row (id) for link. |
| 12 | **/coach/clients/[id]** | Coach clicks “Go to client profile”. First client detail page. | **Loaded:** `clients.*`, sessions (last 10), program_assignments, session_requests, counts (completed sessions, upcoming, video completions), balance owed. |

**Summary:** Coach signs up (login or OAuth) → dashboard → optionally settings/Stripe → Clients → Add client (form + invite or create-login) → client detail. Data: **profiles**, **clients**, and optionally **auth.users** + **profiles** for the new client.

---

## 2. Adding a new client and sending them their login

**Goal:** Coach adds a client record and gives the client a way to log in (invite email or generated password + link).

| Step | Page / screen | Action | Data saved / loaded |
|------|----------------|--------|----------------------|
| 1 | **/coach/clients** | Coach is on client list. Clicks “Add client”. | **Loaded:** `clients` for coach (for list). |
| 2 | **/coach/clients/new** | Add client page. Coach fills: full name (required), email, phone, notes. | — |
| 3 | **/coach/clients/new** | Coach checks “Send invite email” so client gets a magic link to set password. Submits form. | **Saved:** Insert **clients** (coach_id, full_name, email, phone, notes, tenant). Then **POST /api/invite-client** with `{ email }`. **Saved:** Supabase Auth `inviteUserByEmail`; email sent with link to `/auth/set-password`; on accept, **auth.users** + **profiles** (role client, tenant_id). |
| 4 | **/coach/clients/new** | Success: “Client added”, “Invite sent to {email}”. Coach can “Go to client profile”. | **Loaded:** New client id. |
| **Alternative path (Create login now)** | | | |
| 3b | **/coach/clients/new** | Coach does *not* check “Send invite”. Submits. | **Saved:** Insert **clients** as above. **POST /api/create-client-account** with `{ email }`. Server creates auth user with generated password, `email_confirm: true`, same metadata. **Saved:** **auth.users**, **profiles** (client). Returns `{ ok: true, password }`. |
| 4b | **/coach/clients/new** | Success card shows one-time password and “Copy invite link” (login URL with `?email=...`). Coach copies link and/or password and sends to client out-of-band. | **Loaded:** Login URL built from `NEXT_PUBLIC_APP_URL` + email param. |

**Summary:** Coach on **/coach/clients/new** → fills form → either invite (saves **clients**, calls invite API, client gets email) or create-login (saves **clients**, creates auth user, shows password + link). Data: **clients**, **auth.users**, **profiles** (for client).

---

## 3. Coach creates and assigns a program to a client

**Goal:** Coach creates a new program, adds content (e.g. lessons/modules), and assigns it to a client.

| Step | Page / screen | Action | Data saved / loaded |
|------|----------------|--------|----------------------|
| 1 | **/coach/programs** | Coach goes to Programs. Sees list of programs. Clicks “Create Program”. | **Loaded:** `programs` where `coach_id = user.id`. |
| 2 | **/coach/programs** (or modal) | Coach enters program name and optional description. Submits. | **Saved:** Insert **programs** (coach_id, name, description, client_id/tenant). |
| 3 | **/coach/programs/[id]** | App redirects to program detail/builder. Coach sees empty program. | **Loaded:** `programs` (id, name, description), `program_lessons` (empty), `program_assignments` (empty), clients list for “Who has access”. |
| 4 | **/coach/programs/[id]** | Coach adds structure: in V2, adds modules (e.g. “Week 1”, “Week 2”) with title and optional description. | **Saved:** Insert **program_modules** (program_id, title, description, sort_order). (V1: no modules; coach adds lessons directly to program.) |
| 5 | **/coach/programs/[id]** | Coach selects a module. Adds content blocks: e.g. “Add video” (from library), “Add link”, “Add note/text”, “Add image”, or “Add task”. | **Loaded:** Coach’s **videos** for video picker. **Saved:** Insert **program_content_blocks** (or **program_lessons** in V1) with module_id, block_type, title, content/url/video_id, sort_order. For task block: content as JSON checklist. |
| 6 | **/coach/programs/[id]** | Coach reorders modules or blocks via drag-and-drop. Saves order. | **Saved:** UPDATE **program_modules** and **program_content_blocks** (or **program_lessons**) sort_order. |
| 7 | **/coach/programs/[id]** | In “Who has access” (assignments panel), coach selects a client and clicks “Add access” or “Assign”. | **Saved:** Insert **program_assignments** (program_id, client_id). Optionally: upsert **video_assignments** for lessons that have video_id so client sees those videos in their library. |
| 8 | **/coach/programs/[id]** | Coach sees client listed under assigned. Assignment complete. | **Loaded:** `program_assignments` with client names; list refreshes. |

**Summary:** **/coach/programs** → Create program (saves **programs**) → **/coach/programs/[id]** → add modules (V2) and content blocks/lessons → reorder → assign client (saves **program_assignments**). Data: **programs**, **program_modules** (V2), **program_content_blocks** / **program_lessons**, **program_assignments**, optionally **video_assignments**.

---

## 4. Coach imports a video from Google Drive and adds it to a program

**Goal:** Coach connects Google Drive (if not already), imports a video file into the video library, then adds that video to a program.

| Step | Page / screen | Action | Data saved / loaded |
|------|----------------|--------|----------------------|
| 1 | **/coach/videos** | Coach goes to Video Library. | **Loaded:** `videos` where `coach_id = user.id`; optional usage in programs. |
| 2 | **/coach/settings** or **/coach/videos** | Coach clicks “Connect Google Drive” (if not connected). Redirected to Google OAuth. | **Loaded:** `GET /api/integrations/google-drive/connect` returns auth URL. |
| 3 | **Google consent** | Coach signs in and grants Drive read scope. Redirected back to app. | — |
| 4 | **GET /api/integrations/google-drive/callback** | Callback exchanges code for tokens. | **Saved:** Insert/update **coach_integrations** (or coach_google_drive_tokens): coach_id, provider `'google_drive'`, refresh_token, access_token, expires_at. Redirect to /coach/videos or settings. |
| 5 | **/coach/videos** | Coach clicks “Import from Google Drive”. Modal or side panel opens. | **Loaded:** Optionally “Choose folder” (Drive Picker) or coach pastes folder ID. |
| 6 | **/coach/videos** (import modal) | Coach enters folder ID or picks folder. Clicks “Load”. | **Loaded:** **GET /api/integrations/google-drive/files?folderId=...** (backend uses stored tokens, calls Drive API files.list). Returns list of files (id, name, mimeType, size, modifiedTime). |
| 7 | **/coach/videos** (import modal) | Coach selects one or more video files. Clicks “Import”. | **Saved:** **POST /api/videos/import-from-drive** with `{ driveFileIds: [...] }`. Backend inserts **video_import_jobs** (coach_id, source_type `'google_drive'`, source_file_id, status `'queued'`). Worker enqueued. |
| 8 | **/coach/videos** | Coach sees “Recent imports” with status “Queued” then “Processing”. When worker finishes: status “Ready” and video appears in library. | **Loaded:** `video_import_jobs` for coach (status); when status = ready, **videos** row exists (id, title from Drive name, storage_path, processing_status `'ready'`, source_type `'imported'`). Worker: download via Drive API → convert (e.g. FFmpeg/Transloadit) → upload to Supabase Storage → insert/update **videos**, update job status. |
| 9 | **/coach/programs/[id]** | Coach opens a program. In content panel, “Add content” → “Video” → “From library”. Selects the imported video. Saves. | **Loaded:** `videos` for coach. **Saved:** Insert **program_content_blocks** (or **program_lessons**) with block_type `'video_library'`, video_id = imported video id, sort_order. |
| 10 | **/coach/programs/[id]** | Video appears as a lesson in the program. If program is assigned to clients, those clients get the video in their library (if app auto-assigns videos from program lessons). | **Loaded:** Program lessons/blocks. **Saved:** Optionally **video_assignments** for assigned clients (if that behavior is enabled). |

**Summary:** **/coach/videos** → Connect Drive (OAuth → **coach_integrations**) → Import from Drive (**video_import_jobs** → worker → **videos**) → **/coach/programs/[id]** → add video from library to program (**program_lessons** / **program_content_blocks**). Data: **coach_integrations**, **video_import_jobs**, **videos**, **program_lessons** / **program_content_blocks**, optionally **video_assignments**.

---

## 5. Client logs in and views their program and completes a task

**Goal:** Client signs in, opens an assigned program, and marks a task (checklist item) complete.

| Step | Page / screen | Action | Data saved / loaded |
|------|----------------|--------|----------------------|
| 1 | **/login** | Client visits app or invite link. Enters email and password (or uses set-password link from invite). Submits. | **Loaded:** Session. **Saved:** If set-password flow: **profiles** (password set via Supabase Auth). |
| 2 | **/client/dashboard** | App redirects client to dashboard by role. | **Loaded:** Client row (`clients` where email = user.email); `sessions` (upcoming); `session_requests` (offered/pending); `program_assignments` with program name/description; balance owed; `coach_daily_messages`; coach_client_experience (welcome block). |
| 3 | **/client/programs** | Client clicks “Programs” in nav. Sees list of assigned programs with progress (e.g. “2/5 modules”, “3/8 tasks”). | **Loaded:** `program_assignments` joined to `programs`; progress derived from `video_completions`, **client_task_completions** (V2). |
| 4 | **/client/programs** or **/client/programs/[id]** | Client clicks a program. Opens program view (modules and content blocks). | **Loaded:** `programs`, `program_modules`, `program_content_blocks` (or `program_lessons`) for that program; `video_completions` for client; **client_task_completions** for client + program. |
| 5 | **/client/programs/[id]** | Client scrolls to a task/checklist block. Sees list of items with checkboxes. Client checks one item (e.g. “Complete the worksheet”). | **Saved:** Insert **client_task_completions** (client_id, content_block_id, task_item_id, completed_at). (V1: no task blocks; if only video/link/note/image, “complete” might be video_completions only.) |
| 6 | **/client/programs/[id]** | Checkbox shows complete; progress summary updates (e.g. “4/8 tasks complete”). | **Loaded:** **client_task_completions** for this client and program; UI recalculates progress. |

**Summary:** **/login** → **/client/dashboard** → **/client/programs** → open program → complete task (save **client_task_completions**). Data: **profiles**, **clients**, **program_assignments**, **programs**, **program_modules**, **program_content_blocks** / **program_lessons**, **client_task_completions**, **video_completions**.

---

## 6. Coach and client have a message conversation

**Goal:** Coach and client exchange messages in the in-app thread; both see messages in real time and unread state.

| Step | Page / screen | Action | Data saved / loaded |
|------|----------------|--------|----------------------|
| 1 | **/coach/messages** | Coach goes to Messages. Sees inbox: list of clients with last message preview and unread count per client. | **Loaded:** `clients` where coach_id = user.id; for each client, latest message in thread (sender, content, created_at) and count of messages where recipient_id = coach and read_at IS NULL. |
| 2 | **/coach/messages** | Coach clicks a client. Thread opens (all messages between coach and that client’s profile). | **Loaded:** `messages` where (sender_id, recipient_id) = (coach_id, client_profile_id) or (client_profile_id, coach_id), ordered by created_at. Client’s profile id resolved via clients.email → profiles.id. |
| 3 | **/coach/messages** | Coach views thread. App marks messages where recipient_id = coach as read. | **Saved:** UPDATE **messages** SET read_at = now() WHERE recipient_id = coach AND read_at IS NULL (in that thread). |
| 4 | **/coach/messages** | Coach types a reply and sends. | **Saved:** Insert **messages** (sender_id = coach, recipient_id = client’s profile id, content, client_id/tenant). Realtime: INSERT broadcast to subscribers. |
| 5 | **/client/messages** | Client is on Messages (or opens later). Sees single thread with coach. New message appears (Realtime or on load). | **Loaded:** `messages` for (client_profile_id, coach_id) pair. Subscription: postgres_changes on **messages** for INSERT/UPDATE. |
| 6 | **/client/messages** | Client opens thread. App marks coach’s messages as read. | **Saved:** UPDATE **messages** SET read_at = now() WHERE recipient_id = client_profile_id AND read_at IS NULL. |
| 7 | **/client/messages** | Client types reply and sends. | **Saved:** Insert **messages** (sender_id = client, recipient_id = coach, content, tenant). Realtime broadcast. |
| 8 | **/coach/messages** | Coach sees new message in thread (Realtime or refetch). Unread badge updates. | **Loaded:** New row in **messages**; unread count recalculated (recipient_id = coach, read_at IS NULL). Event `clearpath:unread-messages-updated` may fire for nav badge. |

**Summary:** Coach **/coach/messages** → select client → load thread (**messages**) → mark read (UPDATE **messages**.read_at) → send (INSERT **messages**). Client **/client/messages** → load thread → mark read → send. Data: **messages** (SELECT, INSERT, UPDATE read_at); Realtime on **messages**.

---

## 7. Coach books a session with a client on the calendar

**Goal:** Coach creates a session for a client at a specific date/time (with or without an availability slot).

| Step | Page / screen | Action | Data saved / loaded |
|------|----------------|--------|----------------------|
| 1 | **/coach/schedule** | Coach goes to Schedule. Sees month grid and list of sessions; may see “Book session” card/section. | **Loaded:** `availability_slots` (coach_id), `sessions` with clients and availability_slots (coach_id), ordered by scheduled_time. |
| 2 | **/coach/schedule** | Coach clicks “Book session” (or equivalent). Form or modal: select client, date, start time, end time (or pick existing slot), optional session product, optional “Require payment before confirming”, notes. | **Loaded:** `clients` for coach (for dropdown); optional `session_products`; optional `availability_slots` for date. |
| 3 | **/coach/schedule** | Coach selects client, picks date and time (and optionally an availability_slot_id if booking into a slot). Submits. | **Saved:** **POST /api/coach/sessions** with client_id, scheduled_time, optional availability_slot_id, session_product_id, notes, status. Backend inserts **sessions** (coach_id, client_id, availability_slot_id, scheduled_time, status `'confirmed'` or `'pending'`, tenant_id). Optionally: if “require payment”, create **session_request** (offered) and link; session created after client pays. |
| 4 | **/coach/schedule** | Backend calls `notifySessionBooked(...)` if N8N_SESSION_BOOKED_WEBHOOK_URL is set. Session appears on calendar and in “Sessions this month” list. | **Loaded:** New session in list; calendar refetches or revalidates. |
| 5 | **/coach/schedule** | Coach may click a day to open day view (timeline). Clicks the new session block to edit (time, notes) or “Remind client”, “Mark completed”, “Cancel”. | **Loaded:** Sessions for that day. **Saved:** Optional UPDATE **sessions** (notes, status); or **POST /api/sessions/[id]/send-reminder** (forwards to n8n). |

**Summary:** **/coach/schedule** → Book session form → submit → **POST /api/coach/sessions** → insert **sessions**. Data: **availability_slots**, **sessions** (INSERT; optional link to **session_requests** if payment required first).

---

## 8. Client views their upcoming sessions

**Goal:** Client opens the app and sees their upcoming sessions (list and optionally calendar).

| Step | Page / screen | Action | Data saved / loaded |
|------|----------------|--------|----------------------|
| 1 | **/client/dashboard** | Client logs in and lands on dashboard. “Upcoming sessions” section shows next sessions (e.g. next 5 confirmed, future). | **Loaded:** `sessions` where client_id = client row id (matched by clients.email = user.email), status in ('pending','confirmed'), scheduled_time > now(), ordered by scheduled_time ascending; joined with coach or slot for display (time, date, duration). |
| 2 | **/client/schedule** | Client clicks “Schedule” in nav. Sees “My Sessions” list: upcoming first, with date, time, timezone, status. Optional: past sessions collapsible. | **Loaded:** Same **sessions** for client (upcoming and optionally past); `session_requests` (offered, payment_pending, etc.); `availability_slots` if client can self-book; coach timezone from **profiles**. |
| 3 | **/client/schedule** | Client sees each session with date, time (in coach timezone or client preference), status (Pending / Confirmed). Actions: “Request cancel” for upcoming, or “Add to calendar” (iCal link if client feed exists). | **Loaded:** Session list. **Saved:** Optional: client_time_requests or session status update if cancel requested (per product rules). |
| 4 | **/client/schedule** (optional V2) | If client calendar view exists: simple month or week view showing only this client’s sessions. | **Loaded:** Same **sessions** filtered by client_id, displayed in calendar grid. |

**Summary:** **/client/dashboard** and **/client/schedule** load **sessions** for the client (client_id match via clients.email = user.email), filtered by status and future scheduled_time. Data: **sessions**, **clients**, **profiles** (coach timezone), optionally **availability_slots** for self-booking.

---

## Reference: key pages and tables

| Flow | Main pages | Main tables |
|------|------------|-------------|
| 1. Coach onboarding | /, /login, /auth/callback, /coach/dashboard, /coach/settings, /coach/clients, /coach/clients/new, /coach/clients/[id] | profiles, clients, auth.users |
| 2. Add client + login | /coach/clients, /coach/clients/new | clients, auth.users, profiles |
| 3. Program + assign | /coach/programs, /coach/programs/[id] | programs, program_modules, program_content_blocks / program_lessons, program_assignments, video_assignments |
| 4. Import video + add to program | /coach/videos, /coach/settings, /coach/programs/[id], API: google-drive connect/callback, import-from-drive | coach_integrations, video_import_jobs, videos, program_lessons / program_content_blocks |
| 5. Client program + task | /login, /client/dashboard, /client/programs, /client/programs/[id] | profiles, clients, program_assignments, programs, program_modules, program_content_blocks, client_task_completions, video_completions |
| 6. Messaging | /coach/messages, /client/messages | messages |
| 7. Coach books session | /coach/schedule, POST /api/coach/sessions | availability_slots, sessions, session_requests (optional) |
| 8. Client upcoming sessions | /client/dashboard, /client/schedule | sessions, clients, profiles |

This document is the single reference for V2 user flows. Update it when adding or changing major journeys.
