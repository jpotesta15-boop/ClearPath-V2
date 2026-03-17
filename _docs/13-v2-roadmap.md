# 13 — V2 Roadmap

This document organizes the V2 build into three phases with specific tasks in build order, dependencies, and explicit out-of-scope items. It is derived from the feature specs (04–12), the current state audit (00), the database schema (02), and the architecture (01). Use it to plan sprints and avoid scope creep.

---

## Phase 1 — Foundation

Database schema fixes, auth and tenant consistency, and core infrastructure that every other feature depends on. Nothing in Phase 2 or 3 should assume schema or auth behaviour that isn’t established here.

### 1.1 Schema and data integrity

| # | Task | Dependencies | Notes |
|---|------|---------------|--------|
| 1.1.1 | **Add missing `clients` columns** — Add `height`, `weight_kg`, `date_of_birth` (or remove from validation/UI). | — | Align DB with existing validation and ClientProfileDetails; see 02-database-schema §12.1, 04-client-management. |
| 1.1.2 | **Add RLS for `program_assignments`** — Coach INSERT/UPDATE/DELETE in tenant (coach owns program and client). | — | Schema §12.5; coach program detail and videos page depend on this. |
| 1.1.3 | **Add RLS for `messages` UPDATE** — Allow recipient to UPDATE own rows (e.g. `read_at`) where `recipient_id = auth.uid()`. | — | Schema §12.2; messaging mark-read depends on it (or keep service role and document). |
| 1.1.4 | **Optional: add `payments` SELECT for clients** — If client payment history is required in UI; else document as out of scope. | — | Schema §6.1. |
| 1.1.5 | **Standardise tenant column naming (document only)** — Document that `client_id` (TEXT) = tenant in `session_products`/`payments`; `client_id` (UUID) = FK to `clients` elsewhere. No rename in V2 to avoid migration risk. | — | 00-current-state §6. |

### 1.2 Auth and tenant

| # | Task | Dependencies | Notes |
|---|------|---------------|--------|
| 1.2.1 | **Verify and document tenant sync** — Server client syncs `profiles.tenant_id` with `getClientId()`; confirm all Server Components and API routes that need tenant use the same pattern. | — | 01-architecture §2–3. |
| 1.2.2 | **Client resolution by email** — Document and optionally add a small helper: resolve client row from `clients.email = user.email` and tenant; use consistently in client layout and pages. | — | 04-client-management; avoid duplicate logic. |
| 1.2.3 | **Stripe client-side idempotency** — Add idempotency key (e.g. client-generated UUID) for create-checkout-session and request-payment to prevent duplicate links on double-click. | — | 00-current-state §6. |

### 1.3 Environment and infra

| # | Task | Dependencies | Notes |
|---|------|---------------|--------|
| 1.3.1 | **Env validation at startup** — Ensure `validateEnv()`, `validateServiceRoleEnv()`, `validateStripeEnv()` are used in API routes that need them; health check pings Supabase. | — | 01-architecture §6. |
| 1.3.2 | **Document `getClientId()` and client bundle** — Ensure `NEXT_PUBLIC_CLIENT_ID` is set where client components call `getClientId()`; document in 03-env-variables or README. | — | 00-current-state §6. |

### Phase 1 completion criteria

- All migrations for 1.1.x applied; RLS tests for new policies.
- No silent failures for tenant or Stripe idempotency; docs updated.
- Health check and env validation in place for critical paths.

---

## Phase 2 — Core Features

Client management, basic messaging, and calendar/scheduling at the minimum needed for the platform to be usable day-to-day. Assumes Phase 1 is done.

### 2.1 Client management

| # | Task | Dependencies | Notes |
|---|------|---------------|--------|
| 2.1.1 | **Client status** — Add `status` to `clients` (`active` \| `paused` \| `completed`), default `active`. Migration + RLS unchanged. | 1.1.1 | 04-client-management §2.6. |
| 2.1.2 | **Client list: status and search** — List shows status badge; filter by status (tabs or dropdown). Search by name and/or email (server-side preferred). | 2.1.1 | 04 §2.3. |
| 2.1.3 | **Client profile V2 fields** — Add and expose: `goals`, `start_date`, `profile_photo_url` (Storage + URL). Optional: `height`, `weight_kg`, `date_of_birth` if added in 1.1.1. Coach detail: edit goals, start date, photo. | 1.1.1, 2.1.1 | 04 §2.2, 2.4. |
| 2.1.4 | **Invite flow (email-first)** — Optional path: coach enters email (and optionally name) → “Send invite” → create pending client or `client_invites` row; on set-password/sign-in link to client row. UI: “Invite sent”, “Pending”, optional Resend/Cancel. | 2.1.1 | 04 §2.1 (1). |
| 2.1.5 | **Manual add (record-first)** — Keep current flow; ensure it sets status, start_date, goals when provided. Portal access: Send invite / Create login as today. | 2.1.1, 2.1.3 | 04 §2.1 (2). |
| 2.1.6 | **Client detail: status and profile block** — Editable status (active/paused/completed); profile block with goals, start date, photo; “Member since” where applicable. Portal access and notes as now. | 2.1.2, 2.1.3 | 04 §2.4. |
| 2.1.7 | **Portal access and status** — If client status is `paused` or `completed`, enforce in client layout (e.g. show message, limit or block portal access per product rule). | 2.1.1, 2.1.6 | 04 §2.6. |

### 2.2 Messaging

| # | Task | Dependencies | Notes |
|---|------|---------------|--------|
| 2.2.1 | **Messages: optional columns** — Add `message_type` (e.g. `text`, `session_offer`), `updated_at` if needed; keep content as primary. | 1.1.3 | 05-messaging §2.3. |
| 2.2.2 | **Realtime end-to-end** — Ensure coach and client message pages subscribe to `postgres_changes` on `messages` (INSERT, UPDATE for `read_at`); remove or reduce polling where Realtime is used. | 1.1.3 | 05 §2.1, 12-user-flows §6. |
| 2.2.3 | **Mark read via RLS** — All mark-read updates use recipient context so new RLS UPDATE policy applies; verify no service-role requirement for normal flow. | 1.1.3, 2.2.2 | 02-database-schema §12.2. |
| 2.2.4 | **Unread counts and badge** — Coach: per-client and total unread. Client: total unread. Use `clearpath:unread-messages-updated` for nav/dashboard; ensure Realtime or refetch updates badge. | 2.2.2 | 05 §2.6. |
| 2.2.5 | **Link embedding in content** — Auto-detect URLs in message content; render YouTube/Vimeo (and optionally other links) as embeds in MessageBubble. No file upload yet. | — | 05 §2.7 (links only). |

### 2.3 Calendar and scheduling

| # | Task | Dependencies | Notes |
|---|------|---------------|--------|
| 2.3.1 | **Recurring availability table** — Add `recurring_availability` (e.g. `coach_id`, `day_of_week`, `start_time`, `end_time` (time in coach TZ), optional `session_product_id`, `label`, `tenant_id`). No end date for “every week”. | — | 06-calendar-scheduling §2.1. |
| 2.3.2 | **Coach UI: create/edit availability** — “Recurring availability” (day + time range, optional product); “Add manual slot” (date + time). Persist recurring to `recurring_availability`; manual to `availability_slots`. | 2.3.1 | 06 §2.1; 00 §1.1 gap. |
| 2.3.3 | **Materialize recurring into slots** — Cron or scheduled job: read `recurring_availability`, coach timezone from profiles; generate `availability_slots` for next 6–8 weeks. Skip or avoid overwriting slots that already have a session. | 2.3.1, 2.3.2 | 06 §2.1. |
| 2.3.4 | **Sessions: optional `end_time` / `duration_minutes`** — Add columns if desired for list views without joins; derive from slot or session_product where null. | — | 06 §2.3. |
| 2.3.5 | **Coach calendar: week view** — Add week view (e.g. Mon–Sun with time axis); same data as day/month, filter by week range. | 2.3.2 | 06 §2.4. |
| 2.3.6 | **Client: optional calendar view** — Simple month or week showing only client’s sessions (no availability slots). Reuse or share calendar grid with coach. | — | 06 §2.5. |
| 2.3.7 | **iCal feed: client feed** — `GET /api/calendar/feed/client` returning only that client’s sessions so they can “Add to Google Calendar”. | — | 06 §2.7. |
| 2.3.8 | **Automated session reminders** — Cron/scheduled job: select confirmed sessions with `scheduled_time` in e.g. 24h window; call existing n8n reminder URL (or dedicated webhook). Optional: configurable lead time per coach later. | — | 06 §2.6. |

### Phase 2 completion criteria

- Coaches can add clients (invite or manual), set status and profile fields, filter and search list.
- Coach and client messaging is real-time with correct read state and unread badges; links can be embedded.
- Coaches can set recurring and manual availability; slots are materialized; coach has month/day/week; client can see sessions in list and optionally calendar; client iCal feed works; automated reminders run.

---

## Phase 3 — Power Features

Video pipeline, program builder (modules and tasks), and advanced notifications. Build only after Phase 2 is stable.

### 3.1 Video pipeline

| # | Task | Dependencies | Notes |
|---|------|---------------|--------|
| 3.1.1 | **Coach integrations table** — Add `coach_integrations` (e.g. `coach_id`, `provider` `'google_drive'`, `refresh_token`, `access_token`, `expires_at`). RLS: coach-only; encrypt refresh_token at rest if required. | — | 07-video-pipeline §1. |
| 3.1.2 | **Google Drive OAuth** — `GET /api/integrations/google-drive/connect` (build auth URL, state with coach_id); `GET /api/integrations/google-drive/callback` (exchange code, store tokens). Token refresh helper before any Drive call. | 3.1.1 | 07 §1. |
| 3.1.3 | **Drive file list API** — `GET /api/integrations/google-drive/files?folderId=...&pageToken=...` (coach auth, use stored tokens, Drive API files.list). Return id, name, mimeType, size, modifiedTime, webViewLink. | 3.1.2 | 07 §2. |
| 3.1.4 | **Video import jobs table** — Add `video_import_jobs` (e.g. `coach_id`, `source_type`, `source_file_id`, `status` queued \| processing \| ready \| failed, optional `title`, `tenant_id`). Idempotency: (coach_id, source_type, source_file_id). | — | 07 §3. |
| 3.1.5 | **Import-from-Drive endpoint** — `POST /api/videos/import-from-drive` with `driveFileIds[]`; validate coach and Drive connection; insert jobs; enqueue worker. | 3.1.3, 3.1.4 | 07 §3. |
| 3.1.6 | **Worker: download + convert + store** — Worker (e.g. Inngest, Trigger.dev, or Edge Function + queue): download via Drive API, convert to MP4 (FFmpeg or Transloadit), upload to Supabase Storage (or chosen store); update `videos` and job status. | 3.1.4, 3.1.5 | 07 §3, §4, §5. |
| 3.1.7 | **Videos table: processing and storage** — Add `processing_status`, `storage_path`, `source_type` (e.g. `imported` \| `url`) to `videos`; playback via signed URL or `GET /api/videos/[id]/playback-url`. | 3.1.6 | 07 §5, §6. |
| 3.1.8 | **Coach UI: Connect Drive, import modal** — Settings or Videos: “Connect Google Drive”; Videos: “Import from Google Drive” (folder ID or picker), list files, select, Import; show “Recent imports” and status (queued → processing → ready). | 3.1.2, 3.1.3, 3.1.5 | 07 §2, 12-user-flows §4. |

### 3.2 Program builder

| # | Task | Dependencies | Notes |
|---|------|---------------|--------|
| 3.2.1 | **Program modules table** — Add `program_modules` (`program_id`, `title`, `description`, `sort_order`). RLS: coach manage; clients SELECT for assigned programs. | — | 08-program-builder §7.3. |
| 3.2.2 | **Content blocks table** — Add `program_content_blocks` (`module_id`, `block_type` text \| video_library \| video_embed \| link \| task \| image, `title`, `content`, `url`, `video_id`, `sort_order`). Task items in `content` as JSON. | 3.2.1 | 08 §7.4. |
| 3.2.3 | **Migration path from program_lessons** — Either: new `program_content_blocks` with one default module per program and migrate lessons into it; or keep both and have builder write to content_blocks only for new programs. | 3.2.1, 3.2.2 | 08 §7. |
| 3.2.4 | **Builder UI: modules and blocks** — Program detail: list modules (add, reorder, edit, remove); select module → list content blocks; add block (text, video library, video embed, link, task, image); reorder; edit/remove. | 3.2.2, 3.2.3 | 08 §2, §3. |
| 3.2.5 | **Client task completions** — Add `client_task_completions` (e.g. `client_id`, `content_block_id`, `task_item_id` or JSON key, `completed_at`). RLS: client own row; coach SELECT in tenant. | 3.2.2 | 08 §5.3, §7.5. |
| 3.2.6 | **Client program view: modules and blocks** — Client program view loads modules and content_blocks; render text, video (library + embed), link, image; task block with checkboxes; persist completions to `client_task_completions`. | 3.2.4, 3.2.5 | 08 §5. |
| 3.2.7 | **Progress aggregation** — Per program: modules completed, videos completed (existing `video_completions`), tasks completed. Show on program card and in program detail “Who has access”. | 3.2.5, 3.2.6 | 08 §5.3, §6. |

### 3.3 Advanced notifications

| # | Task | Dependencies | Notes |
|---|------|---------------|--------|
| 3.3.1 | **In-app notifications table** — Add `notifications` (e.g. `user_id`, `type` e.g. `session_reminder`, `session_id`, `read_at`, `created_at`). RLS: user sees own. | — | 06 §2.6. |
| 3.3.2 | **Scheduled reminder job writes notifications** — When automated reminder runs, insert row for client (and optionally coach) so in-app bell or dashboard shows “Session tomorrow at …”. | 2.3.8, 3.3.1 | 06 §2.6. |
| 3.3.3 | **UI: notification bell or dashboard strip** — Show unread count and list (e.g. session reminders); mark read on view. | 3.3.1, 3.3.2 | — |
| 3.3.4 | **Optional: message attachments** — `message_attachments` table or `attachments` JSONB on `messages`; Supabase Storage bucket; coach (and optionally client) can attach files; display in thread. | 2.2.5 | 05 §2.7. |
| 3.3.5 | **Optional: push or email for new message** — When new message inserted, call webhook or Edge Function to send push (FCM/OneSignal) or “You have a new message” email. | 2.2.2 | 05 §2.6. |

### Phase 3 completion criteria

- Coach can connect Drive, import videos, and see processing status; playback uses stored/signed URL where applicable.
- Programs support modules and content blocks (text, video, link, task, image); clients see program view and can complete tasks; progress is visible to coach.
- In-app reminders exist; optional attachments and push/email for messages if scoped.

---

## Not in V2 (defer to V3 or later)

Features that would be nice but are explicitly out of scope for V2 to keep the roadmap achievable.

- **Custom domain verification and SSL** — Tables and UI exist; automated DNS/HTTP verification and SSL provisioning are not in V2.
- **Dashboard layout editor** — Custom layout JSON and UI to edit; dashboard remains fixed layout in V2.
- **Message templates and broadcasts** — Tables exist; no UI to create templates or send broadcasts (email/SMS/in-app bulk).
- **Coach public profile and social links** — Tables exist; no settings UI for headline, bio, specialties, social links, visibility.
- **Activity log writes** — Table and RLS exist; no app code writing to it in V2.
- **Two-way Google Calendar sync** — Push ClearPath sessions to Google on create/update/delete; “import from Google” for availability. Keep one-way iCal feed only in V2.
- **White-label toggle everywhere** — Ensure “Powered by” and platform branding respect `white_label` where critical; full audit of every surface is V3.
- **Admin role** — No platform-wide admin; only coach and client in V2.
- **Multi-tenant per deployment** — Single tenant per deploy (`NEXT_PUBLIC_CLIENT_ID`); no in-app tenant switcher.
- **Client payment history UI** — If not added in Phase 1, clients do not see a list of past payments in V2.
- **Bulk client import** — No CSV or bulk add in V2.
- **Topic-based message threads** — One thread per coach–client pair only.

---

## Technically risky items and what to research first

Items that could block or significantly delay delivery if not validated early.

### 1. Video pipeline: conversion and worker

- **Risk:** FFmpeg on a server requires ops and scaling; Transloadit/Mux add cost and integration complexity. Long-running jobs may hit serverless time limits.
- **Research/prototype:**
  - Run a **small prototype**: one Drive file → download (Drive API with coach token) → convert (e.g. FFmpeg in a container or Transloadit) → upload to Supabase Storage → update DB. Measure duration, memory, and failure modes.
  - Decide **worker host**: Vercel Cron + Edge (no FFmpeg), Inngest/Trigger.dev (background function), or a small always-on worker (Railway/Render). If Edge/cron, conversion must be external (Transloadit/CloudConvert).
  - **Idempotency and retries:** Same Drive file imported twice; job fails mid-convert. Define retry and “replace or skip” behaviour before building.

### 2. Recurring availability materialization

- **Risk:** Timezone bugs (coach TZ vs UTC), overwriting slots that already have sessions, or gaps when cron doesn’t run.
- **Research/prototype:**
  - **Spec the algorithm** in code or pseudo-code: given `recurring_availability` rows and coach timezone, generate `availability_slots` for date range; never create a slot that overlaps an existing session (or define overlap rule).
  - Run a **one-off script** against test data for “next 8 weeks” and inspect output; then schedule (e.g. daily) and verify no duplicate or missing slots.

### 3. Realtime messaging at scale

- **Risk:** Supabase Realtime connections and postgres_changes; if many clients or high churn, connection limits or performance may bite.
- **Research/prototype:**
  - Confirm **Realtime** is enabled for `messages` and that filters (e.g. by sender_id/recipient_id) are applied so clients don’t receive other tenants’ events.
  - If possible, **load test** with many concurrent tabs or users in one tenant; check connection and message delivery latency.

### 4. Program builder: migration from program_lessons

- **Risk:** Existing programs use `program_lessons`; V2 adds modules and content_blocks. Migration or dual-write can be error-prone.
- **Research/prototype:**
  - **Migration strategy:** One default module per program, copy each `program_lesson` into a `program_content_blocks` row with `block_type` mapped from `lesson_type`; then switch builder to read/write content_blocks only. Optional: keep program_lessons read-only for old programs until deprecated.
  - **Read path:** Client and coach views must read from content_blocks (and fallback to program_lessons for legacy) or migrate all at once and drop fallback.

### 5. Stripe and webhook reliability

- **Risk:** Webhook secret mismatch (401), duplicate events, or missed events under load.
- **Research/prototype:**
  - **Session-created webhook:** Confirm Supabase → `POST /api/webhooks/session-created` auth and that `SUPABASE_SESSION_WEBHOOK_SECRET` is set correctly in Vercel and Supabase; check delivery history on one test insert.
  - **Idempotency:** Phase 1 adds client-side idempotency for checkout/request-payment; verify server-side handling of duplicate Stripe events (already using `stripe_webhook_events`).

### 6. Google Drive token storage and refresh

- **Risk:** Refresh token expiry, revocation, or multi-device; storing tokens securely.
- **Research/prototype:**
  - **Token storage:** Confirm RLS so only the coach (or service role for backend) can read/write their row; consider encrypting `refresh_token` at rest if compliance requires it.
  - **Refresh flow:** Implement refresh (using `refresh_token` → new `access_token`) in a small server helper; run it before every Drive API call and handle “invalid_grant” (e.g. re-prompt connect).

---

*This roadmap should be updated when phases are completed, scope changes, or new risks are identified. Cross-reference 00-current-state.md, 01-architecture.md, 02-database-schema.md, and specs 04–12 for detail.*
