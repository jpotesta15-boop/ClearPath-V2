# A2 — V2 Data Model Gaps & Migration Blueprint

This document analyses the current Supabase schema against every V2 feature (client management, messaging, calendar scheduling, video pipeline, program builder). For each area it lists: existing tables and completeness, partial tables and missing columns, new tables with full definitions, foreign keys to add, indexes for performance, and RLS policies required. The final section is the **V2 database migration blueprint**: a numbered list of SQL migration files in the exact order they should be run.

**Sources:** `02-database-schema.md`, `13-v2-roadmap.md`, `04-client-management.md`, `05-messaging.md`, `06-calendar-scheduling.md`, `07-video-pipeline.md`, `08-program-builder.md`, and `supabase/migrations/`.

---

## 1. Client management (V2)

### 1.1 Tables that already exist and completeness

| Table | Status | Notes |
|-------|--------|--------|
| **`public.clients`** | **Partial** | Exists with `id`, `coach_id`, `full_name`, `email`, `phone`, `notes`, `created_at`, `updated_at`, `client_id` (tenant). Missing all V2 profile and status columns. |
| **`public.profiles`** | Complete | Used for auth and coach/client resolution; no changes required for client management. |

### 1.2 Partially built tables — missing columns

**`public.clients`**

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `status` | TEXT | NOT NULL DEFAULT `'active'` | CHECK: `'active' \| 'paused' \| 'completed'` |
| `start_date` | DATE | NULL | When client started with coach |
| `goals` | TEXT | NULL | Free-text goals |
| `profile_photo_url` | TEXT | NULL | URL (e.g. Storage) |
| `height` | TEXT | NULL | Align with existing validation/UI |
| `weight_kg` | NUMERIC | NULL | |
| `date_of_birth` | DATE | NULL | |

Existing schema uses `client_id` (TEXT) for tenant; no rename in V2. No new FK required for these columns.

### 1.3 Tables to create from scratch

**Optional: `public.client_invites`** (only if invite-first flow is implemented)

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK, default gen_random_uuid() |
| `coach_id` | UUID | NOT NULL | FK → profiles(id) ON DELETE CASCADE |
| `email` | TEXT | NOT NULL | |
| `invited_at` | TIMESTAMPTZ | NOT NULL | default NOW() |
| `status` | TEXT | NOT NULL | e.g. 'pending' \| 'accepted' \| 'expired' |
| `tenant_id` | TEXT | NULL | get_current_client_id() |
| `created_at` | TIMESTAMPTZ | NOT NULL | default NOW() |

No other new tables required for client management.

### 1.4 Foreign keys to add

- **`client_invites`** (if created): `coach_id` → `public.profiles(id)` ON DELETE CASCADE. No FK from `clients` to `auth.users` in V2 (link remains by email).

### 1.5 Indexes for performance

- **`clients`:** `(coach_id, status)` for filtered list (e.g. active only).
- **`clients`:** Optional `(start_date)` for “sort by start date”.
- **`client_invites`** (if created): `(coach_id)`, `(email, coach_id)` for lookup.

### 1.6 RLS policies required

- **`clients`:** No new policies. Existing “Coaches can manage clients in their tenant” (ALL) and “Clients can view themselves” / “Clients can update own phone” remain. Ensure coach UPDATE can set `status`, `goals`, `start_date`, `profile_photo_url`. Client UPDATE remains own row (phone; optionally profile_photo if product allows).
- **`client_invites`** (if created): Coach INSERT/SELECT/UPDATE/DELETE where `tenant_id = get_current_client_id()` and `coach_id = auth.uid()` (or coach in tenant). No client access.

**Storage:** Create bucket `client-photos` with RLS: coach upload/delete for their clients; client read/update own if allowed. Store URL in `clients.profile_photo_url`.

---

## 2. Messaging (V2)

### 2.1 Tables that already exist and completeness

| Table | Status | Notes |
|-------|--------|--------|
| **`public.messages`** | **Partial** | Has `id`, `sender_id`, `recipient_id`, `content`, `read_at`, `created_at`, `client_id`. Missing `message_type`, `updated_at`, and optional `attachments`. No UPDATE policy for recipient (read_at). |

### 2.2 Partially built tables — missing columns

**`public.messages`**

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `message_type` | TEXT | NULL | e.g. 'text', 'session_offer', 'file'; default 'text' |
| `updated_at` | TIMESTAMPTZ | NULL | For edits |
| `attachments` | JSONB | NULL | Default '[]'; array of { type, url, name, size } (optional V2) |

### 2.3 Tables to create from scratch

None. Optional: **`public.message_attachments`** if using separate table instead of JSONB (not in V2 minimum; 05-messaging allows JSONB on `messages`).

### 2.4 Foreign keys to add

None (sender_id, recipient_id already reference profiles).

### 2.5 Indexes for performance

- **`messages`:** `(recipient_id, read_at)` WHERE `read_at IS NULL` for unread counts.
- **`messages`:** `(sender_id, recipient_id, created_at DESC)` for thread ordering / inbox “last message”.

### 2.6 RLS policies required

- **SELECT:** Existing “Users can view messages in their tenant” (client_id + sender/recipient) — keep.
- **INSERT:** Existing “Users can send messages in their tenant” — keep.
- **UPDATE (new):** “Recipients can mark messages read” — allow recipient to UPDATE (e.g. only `read_at`) where `recipient_id = auth.uid()`.

**Realtime:** Keep `messages` in `supabase_realtime` publication (already done).

---

## 3. Calendar scheduling (V2)

### 3.1 Tables that already exist and completeness

| Table | Status | Notes |
|-------|--------|--------|
| **`public.availability_slots`** | Partial | Has coach_id, start_time, end_time, is_group_session, max_participants, session_product_id, label, client_id, created_at. No recurring source or link. |
| **`public.sessions`** | Partial | Has all core fields; missing optional `end_time`, `duration_minutes`, `type`. |
| **`public.session_products`** | Complete | No V2 schema changes. |
| **`public.session_requests`** | Complete | No V2 schema changes. |
| **`public.client_time_requests`** | Complete | No V2 schema changes. |

### 3.2 Partially built tables — missing columns

**`public.availability_slots`** (optional for traceability)

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `source` | TEXT | NULL | 'manual' \| 'recurring' |
| `recurring_availability_id` | UUID | NULL | FK → recurring_availability(id) ON DELETE SET NULL |

**`public.sessions`** (optional for list views without joins)

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `end_time` | TIMESTAMPTZ | NULL | Explicit end; else derive from slot/product |
| `duration_minutes` | INTEGER | NULL | Denormalized for display |
| `type` | TEXT | NULL | e.g. 'private', 'group', 'assessment' |

### 3.3 Tables to create from scratch

**`public.recurring_availability`**

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK, default gen_random_uuid() |
| `coach_id` | UUID | NOT NULL | FK → profiles(id) ON DELETE CASCADE |
| `tenant_id` | TEXT | NULL | |
| `day_of_week` | SMALLINT | NOT NULL | 0–6 (Sun–Sat) |
| `start_time` | TIME | NOT NULL | Time of day in coach TZ |
| `end_time` | TIME | NOT NULL | |
| `session_product_id` | UUID | NULL | FK → session_products(id) ON DELETE SET NULL |
| `label` | TEXT | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | default NOW() |
| `updated_at` | TIMESTAMPTZ | NOT NULL | default NOW() |

**`public.notifications`** (in-app reminders)

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK, default gen_random_uuid() |
| `user_id` | UUID | NOT NULL | FK → profiles(id) ON DELETE CASCADE |
| `type` | TEXT | NOT NULL | e.g. 'session_reminder' |
| `session_id` | UUID | NULL | FK → sessions(id) ON DELETE SET NULL |
| `title` | TEXT | NULL | |
| `body` | TEXT | NULL | |
| `read_at` | TIMESTAMPTZ | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | default NOW() |

### 3.4 Foreign keys to add

- **`recurring_availability`:** `coach_id` → `public.profiles(id)` ON DELETE CASCADE; `session_product_id` → `public.session_products(id)` ON DELETE SET NULL.
- **`availability_slots`** (if new columns added): `recurring_availability_id` → `public.recurring_availability(id)` ON DELETE SET NULL.
- **`notifications`:** `user_id` → `public.profiles(id)` ON DELETE CASCADE; `session_id` → `public.sessions(id)` ON DELETE SET NULL.

### 3.5 Indexes for performance

- **`recurring_availability`:** `(coach_id)`, `(coach_id, day_of_week)`.
- **`notifications`:** `(user_id)`, `(user_id, read_at)` WHERE read_at IS NULL for unread badge.
- **`availability_slots`** (if `recurring_availability_id` added): index on `recurring_availability_id`.

### 3.6 RLS policies required

- **`recurring_availability`:** Coach ALL where `tenant_id = get_current_client_id()` and `coach_id` in (profiles where auth.uid() and role = 'coach' and tenant_id = get_current_client_id()). Clients: no access.
- **`notifications`:** User SELECT/UPDATE own rows (`user_id = auth.uid()`); INSERT by backend/service role only (no RLS INSERT for users).
- **`availability_slots`:** No change if only optional columns added.
- **`sessions`:** No RLS change.

---

## 4. Video pipeline (V2)

### 4.1 Tables that already exist and completeness

| Table | Status | Notes |
|-------|--------|--------|
| **`public.videos`** | **Partial** | Has id, coach_id, title, description, url, category, created_at, thumbnail_url, client_id. Missing source_type, storage_provider, storage_path, processing_status, duration_seconds. |
| **`public.video_assignments`** | Complete | No V2 schema changes. |
| **`public.video_completions`** | Complete | No V2 schema changes. |

### 4.2 Partially built tables — missing columns

**`public.videos`**

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `source_type` | TEXT | NOT NULL | Default 'url'; 'url' \| 'imported' |
| `storage_provider` | TEXT | NULL | 'supabase' \| 's3' \| 'cloudinary' when imported |
| `storage_path` | TEXT | NULL | Path for signed URL |
| `processing_status` | TEXT | NULL | 'ready' \| 'processing' \| 'failed'; null for url |
| `duration_seconds` | INTEGER | NULL | Optional |

### 4.3 Tables to create from scratch

**`public.coach_integrations`**

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK, default gen_random_uuid() |
| `coach_id` | UUID | NOT NULL | FK → profiles(id) ON DELETE CASCADE |
| `provider` | TEXT | NOT NULL | e.g. 'google_drive' |
| `access_token` | TEXT | NULL | Prefer encrypt at rest |
| `refresh_token` | TEXT | NULL | |
| `expires_at` | TIMESTAMPTZ | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | default NOW() |
| `updated_at` | TIMESTAMPTZ | NOT NULL | default NOW() |

UNIQUE(coach_id, provider).

**`public.video_import_jobs`**

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK, default gen_random_uuid() |
| `coach_id` | UUID | NOT NULL | FK → profiles(id) ON DELETE CASCADE |
| `tenant_id` | TEXT | NOT NULL | |
| `source_type` | TEXT | NOT NULL | 'google_drive' |
| `source_file_id` | TEXT | NOT NULL | Drive file ID |
| `source_file_name` | TEXT | NULL | For display |
| `status` | TEXT | NOT NULL | 'queued' \| 'downloading' \| 'processing' \| 'uploading' \| 'ready' \| 'failed' |
| `video_id` | UUID | NULL | FK → videos(id) ON DELETE SET NULL; set when ready |
| `error_message` | TEXT | NULL | When failed |
| `error_code` | TEXT | NULL | Optional |
| `created_at` | TIMESTAMPTZ | NOT NULL | default NOW() |
| `updated_at` | TIMESTAMPTZ | NOT NULL | default NOW() |
| `failed_at` | TIMESTAMPTZ | NULL | |

Idempotency: UNIQUE(coach_id, source_type, source_file_id) or unique index.

### 4.4 Foreign keys to add

- **`coach_integrations`:** `coach_id` → `public.profiles(id)` ON DELETE CASCADE.
- **`video_import_jobs`:** `coach_id` → `public.profiles(id)` ON DELETE CASCADE; `video_id` → `public.videos(id)` ON DELETE SET NULL.

### 4.5 Indexes for performance

- **`videos`:** Optional `(coach_id, processing_status)` for “my imports” list.
- **`coach_integrations`:** Unique index on `(coach_id, provider)`; index on `coach_id`.
- **`video_import_jobs`:** `(coach_id, status)`, `(status)` for worker polling, `(coach_id, source_type, source_file_id)` for idempotency.

### 4.6 RLS policies required

- **`videos`:** No policy change; existing coach/client policies remain.
- **`coach_integrations`:** Coach SELECT/INSERT/UPDATE/DELETE own rows (coach_id = auth.uid() and tenant). Backend uses service role for token read on Drive API.
- **`video_import_jobs`:** Coach SELECT own rows (coach_id = auth.uid() and tenant_id = get_current_client_id()). INSERT/UPDATE by coach or service role (worker updates via service role).

**Storage:** Bucket for imported videos (e.g. `coach-videos` or `videos`) with path `{tenant_id}/{coach_id}/{video_id}.mp4`; RLS or signed URLs for playback.

---

## 5. Program builder (V2)

### 5.1 Tables that already exist and completeness

| Table | Status | Notes |
|-------|--------|--------|
| **`public.programs`** | Partial | Has id, coach_id, name, description, client_id, created_at, updated_at. Optional V2: `is_template` (boolean). |
| **`public.program_assignments`** | Partial | Exists; **missing coach RLS for INSERT/UPDATE/DELETE** (only client SELECT exists). |
| **`public.program_lessons`** | Complete for V1 | Kept for backward compatibility; V2 adds modules + content blocks. |
| **`public.video_completions`** | Complete | Used for progress; no schema change. |

### 5.2 Partially built tables — missing columns

**`public.programs`** (optional V2)

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `is_template` | BOOLEAN | NOT NULL | Default false; for “assign to many” |

**`public.program_assignments`** — no new columns; only RLS and indexes.

### 5.3 Tables to create from scratch

**`public.program_modules`**

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK, default gen_random_uuid() |
| `program_id` | UUID | NOT NULL | FK → programs(id) ON DELETE CASCADE |
| `title` | TEXT | NOT NULL | |
| `description` | TEXT | NULL | |
| `sort_order` | INTEGER | NOT NULL | Default 0 |
| `created_at` | TIMESTAMPTZ | NOT NULL | default NOW() |
| `updated_at` | TIMESTAMPTZ | NOT NULL | default NOW() |

**`public.program_content_blocks`**

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK, default gen_random_uuid() |
| `module_id` | UUID | NOT NULL | FK → program_modules(id) ON DELETE CASCADE |
| `block_type` | TEXT | NOT NULL | 'text' \| 'video_library' \| 'video_embed' \| 'link' \| 'task' \| 'image' |
| `title` | TEXT | NULL | |
| `content` | TEXT | NULL | Body or JSON for task items |
| `url` | TEXT | NULL | For link, image, embed |
| `video_id` | UUID | NULL | FK → videos(id) for block_type = 'video_library' |
| `sort_order` | INTEGER | NOT NULL | Default 0 |
| `created_at` | TIMESTAMPTZ | NOT NULL | default NOW() |
| `updated_at` | TIMESTAMPTZ | NOT NULL | default NOW() |

**`public.client_task_completions`**

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK, default gen_random_uuid() |
| `client_id` | UUID | NOT NULL | FK → clients(id) ON DELETE CASCADE |
| `content_block_id` | UUID | NOT NULL | FK → program_content_blocks(id) ON DELETE CASCADE |
| `task_item_id` | TEXT | NOT NULL | Id from block JSON |
| `completed_at` | TIMESTAMPTZ | NOT NULL | default NOW() |

UNIQUE(client_id, content_block_id, task_item_id).

### 5.4 Foreign keys to add

- **`program_modules`:** `program_id` → `public.programs(id)` ON DELETE CASCADE.
- **`program_content_blocks`:** `module_id` → `public.program_modules(id)` ON DELETE CASCADE; `video_id` → `public.videos(id)` ON DELETE SET NULL (or CASCADE per product).
- **`client_task_completions`:** `client_id` → `public.clients(id)` ON DELETE CASCADE; `content_block_id` → `public.program_content_blocks(id)` ON DELETE CASCADE.

### 5.5 Indexes for performance

- **`program_modules`:** `(program_id)`, `(program_id, sort_order)`.
- **`program_content_blocks`:** `(module_id)`, `(module_id, sort_order)`.
- **`program_assignments`:** Existing (program_id, client_id); add `(client_id)` if not present for “my programs” query.
- **`client_task_completions`:** `(client_id)`, `(content_block_id)` for progress aggregation.

### 5.6 RLS policies required

- **`program_assignments` (fix):** Add coach policy: INSERT/UPDATE/DELETE where program belongs to coach in tenant (`EXISTS (SELECT 1 FROM programs WHERE programs.id = program_assignments.program_id AND programs.coach_id = auth.uid() AND programs.client_id = get_current_client_id())`). Keep existing client SELECT.
- **`program_modules`:** Coach ALL where program’s coach_id = auth.uid() and program’s client_id = get_current_client_id(). Client SELECT where program is assigned to client (via program_assignments + email match).
- **`program_content_blocks`:** Coach ALL where module’s program belongs to coach (via program_modules → programs). Client SELECT where module’s program is assigned to client.
- **`client_task_completions`:** Client ALL (SELECT, INSERT, UPDATE, DELETE) where client_id matches client row for auth.uid() (email match). Coach SELECT where client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid()).

---

## 6. Cross-cutting (Phase 1)

### 6.1 RLS and schema fixes (from 02-database-schema §12)

- **`program_assignments`:** Add coach INSERT/UPDATE/DELETE in tenant (see 5.6).
- **`messages`:** Add UPDATE for recipient (read_at) (see 2.6).
- **`payments` (optional):** If client payment history is in scope, add SELECT for clients where payer_client_id = client row for auth.uid() (and tenant).
- **`activity_log` (optional):** No INSERT policy today; logging typically uses service role. Add INSERT for authenticated users in tenant if app should write via RLS.

---

## 7. V2 database migration blueprint (ordered SQL migrations)

Run migrations in this order. Each step is a single migration file; dependencies are respected.

| # | Migration filename | Purpose |
|---|--------------------|--------|
| 1 | `20250101000000_v2_clients_columns.sql` | Add to `clients`: status, start_date, goals, profile_photo_url, height, weight_kg, date_of_birth. CHECK on status. Index (coach_id, status); optional index start_date. |
| 2 | `20250101000001_v2_messages_columns_and_policies.sql` | Add to `messages`: message_type, updated_at, attachments (JSONB). Index idx_messages_recipient_read (recipient_id, read_at) WHERE read_at IS NULL; idx_messages_sender_recipient_created. Add RLS policy "Recipients can mark messages read" (UPDATE). |
| 3 | `20250101000002_v2_program_assignments_coach_rls.sql` | Add RLS policies on program_assignments for coach INSERT/UPDATE/DELETE in tenant. |
| 4 | `20250101000003_v2_payments_client_select_optional.sql` | (Optional) Add RLS SELECT on payments for clients (own payments by payer_client_id + tenant). |
| 5 | `20250101000004_v2_recurring_availability.sql` | Create table recurring_availability with all columns and FKs; indexes; RLS (coach only). |
| 6 | `20250101000005_v2_sessions_availability_optional_columns.sql` | Add to sessions: end_time, duration_minutes, type. Add to availability_slots: source, recurring_availability_id (FK); index on recurring_availability_id. |
| 7 | `20250101000006_v2_notifications.sql` | Create table notifications; FKs to profiles and sessions; indexes; RLS (user SELECT/UPDATE own; no user INSERT). |
| 8 | `20250101000007_v2_videos_pipeline_columns.sql` | Add to videos: source_type (default 'url'), storage_provider, storage_path, processing_status, duration_seconds. Backfill existing rows with source_type = 'url'. |
| 9 | `20250101000008_v2_coach_integrations.sql` | Create table coach_integrations; FK coach_id → profiles; UNIQUE(coach_id, provider); indexes; RLS (coach own rows). |
| 10 | `20250101000009_v2_video_import_jobs.sql` | Create table video_import_jobs; FKs coach_id, video_id; indexes including idempotency; RLS (coach SELECT; worker uses service role). |
| 11 | `20250101000010_v2_program_modules.sql` | Create table program_modules; FK program_id → programs; indexes; RLS (coach ALL, client SELECT for assigned programs). |
| 12 | `20250101000011_v2_program_content_blocks.sql` | Create table program_content_blocks; FKs module_id → program_modules, video_id → videos; indexes; RLS (coach ALL, client SELECT for assigned). |
| 13 | `20250101000012_v2_client_task_completions.sql` | Create table client_task_completions; FKs client_id, content_block_id; UNIQUE(client_id, content_block_id, task_item_id); indexes; RLS (client ALL own, coach SELECT). |
| 14 | `20250101000013_v2_programs_is_template_optional.sql` | (Optional) Add programs.is_template BOOLEAN NOT NULL DEFAULT false. |
| 15 | `20250101000014_v2_client_invites_optional.sql` | (Optional) Create client_invites table; FK coach_id; indexes; RLS coach only. |
| 16 | `20250101000015_v2_storage_buckets.sql` | Create Storage bucket client-photos (and optionally message-attachments, coach-videos) with RLS policies. |

**Notes:**

- Migrations 4, 14, 15 are optional depending on product scope (client payment history, is_template, invite-first flow).
- Migration 16 may be split into separate migrations per bucket if preferred.
- After migrations, run a one-off data migration to create one default `program_modules` row per program and migrate `program_lessons` into `program_content_blocks` if adopting full program builder (see 08-program-builder §7.7); that can be a separate migration or script.
- Ensure `get_current_client_id()` and tenant RLS patterns are unchanged; new policies reuse them where applicable.

---

*This document is the V2 database migration blueprint. Cross-reference 02-database-schema.md and specs 04–08 for full field semantics and 13-v2-roadmap.md for phase ordering.*
