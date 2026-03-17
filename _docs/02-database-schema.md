# Database schema reference

This document describes the Supabase/PostgreSQL schema as defined in `supabase/migrations/`. It covers every table, columns (type and nullability), foreign keys, indexes, and Row Level Security (RLS) policies. Gaps and inconsistencies are flagged at the end.

**Naming note:** The codebase uses `client_id` in two senses: (1) **tenant identifier** (TEXT), i.e. which “tenant” or “brand” (e.g. `demo`) a row belongs to; (2) **client record ID** (UUID), i.e. FK to `public.clients` (the person being coached). Where ambiguous, this doc uses “tenant_id” for (1) and “client_id (UUID)” for (2).

---

## 1. Core & auth

### 1.1 `public.profiles`

Extends `auth.users`; one row per app user (coach or client).

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK, FK → `auth.users(id)` |
| `email` | TEXT | nullable | |
| `full_name` | TEXT | nullable | |
| `role` | TEXT | NOT NULL | CHECK: `'coach' \| 'client'` |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `updated_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `tenant_id` | TEXT | nullable | Tenant/brand (e.g. `demo`) |
| `stripe_connect_account_id` | TEXT | nullable | Stripe Connect account |
| `stripe_connect_onboarded_at` | TIMESTAMPTZ | nullable | |
| `display_name` | TEXT | nullable | Coach display name |
| `timezone` | TEXT | nullable | IANA (e.g. America/New_York) |
| `preferences` | JSONB | NOT NULL (default '{}') | e.g. default_session_duration_minutes |
| `logo_url` | TEXT | nullable | |
| `tagline` | TEXT | nullable | |
| `phone` | TEXT | nullable | SMS / contact |

**Foreign keys**

- `id` → `auth.users(id)` (PRIMARY KEY)

**Indexes**

- `idx_profiles_tenant` ON `tenant_id`
- `idx_profiles_stripe_connect_account` ON `stripe_connect_account_id` (partial: WHERE NOT NULL)

**RLS**

- **Users can view profiles in their tenant:** SELECT where `tenant_id = get_current_client_id()` OR `id = auth.uid()`
- **Users can update own profile:** UPDATE where `auth.uid() = id`

**Trigger**

- `on_auth_user_created`: after INSERT on `auth.users`, calls `handle_new_user()` to insert a `profiles` row (role from count; `tenant_id` from `raw_user_meta_data->>'tenant_id'`).

---

## 2. Client management

### 2.1 `public.clients`

One row per “client” (person being coached) per coach/tenant.

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK (default uuid_generate_v4()) |
| `coach_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `full_name` | TEXT | NOT NULL | |
| `email` | TEXT | nullable | Links to auth user for portal access |
| `phone` | TEXT | nullable | |
| `notes` | TEXT | nullable | Coach-only notes |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `updated_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `client_id` | TEXT | nullable | Tenant identifier |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE

**Indexes**

- `idx_clients_coach` ON `coach_id`
- `idx_clients_client_id` ON `client_id`

**RLS**

- **Coaches can manage clients in their tenant:** ALL where tenant `client_id = get_current_client_id()` and coach is in that tenant
- **Clients can view themselves in their tenant:** SELECT where `client_id = get_current_client_id()` and `email = (SELECT email FROM profiles WHERE id = auth.uid())`
- **Clients can update own phone:** UPDATE where same tenant and email match auth user

**Inconsistency / app usage:** `lib/validations/index.ts`’s `updateClientProfileSchema` includes `height`, `weight_kg`, `date_of_birth`. These columns are **not** present on `clients`; either add them in a migration or remove from the schema/validation.

---

## 3. Programs & lessons

### 3.1 `public.programs`

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `coach_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `name` | TEXT | NOT NULL | |
| `description` | TEXT | nullable | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `updated_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `client_id` | TEXT | nullable | Tenant |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE

**Indexes**

- `idx_programs_client_id` ON `client_id`

**RLS**

- **Coaches can manage programs in their tenant:** ALL where `client_id = get_current_client_id()` and coach in tenant

---

### 3.2 `public.program_assignments`

Links programs to clients (who is assigned which program).

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `program_id` | UUID | NOT NULL | FK → `programs(id)` ON DELETE CASCADE |
| `client_id` | UUID | NOT NULL | FK → `clients(id)` ON DELETE CASCADE |
| `assigned_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |

**Unique:** `(program_id, client_id)`

**Foreign keys**

- `program_id` → `public.programs(id)` ON DELETE CASCADE  
- `client_id` → `public.clients(id)` ON DELETE CASCADE

**RLS**

- **Clients can view assigned programs in their tenant:** SELECT only; checks tenant and program/client membership

**Gap:** No RLS policy allows **coaches** to INSERT/UPDATE/DELETE on `program_assignments`. Coach UI (e.g. program detail, videos page) does modify assignments; access likely relies on service role or a missing coach policy.

---

### 3.3 `public.program_lessons`

Ordered lessons (video/link/note/image) within a program.

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `program_id` | UUID | NOT NULL | FK → `programs(id)` ON DELETE CASCADE |
| `video_id` | UUID | nullable | FK → `videos(id)` ON DELETE CASCADE (null for non-video lessons) |
| `sort_order` | INTEGER | NOT NULL (default 0) | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `lesson_type` | TEXT | NOT NULL (default 'video') | CHECK: `'video' \| 'link' \| 'note' \| 'image'` |
| `title` | TEXT | nullable | |
| `url` | TEXT | nullable | |
| `content` | TEXT | nullable | |

**Unique:** `(program_id, video_id)` (video_id can be null for non-video lessons; uniqueness behavior with nulls is DB-dependent)

**Foreign keys**

- `program_id` → `public.programs(id)` ON DELETE CASCADE  
- `video_id` → `public.videos(id)` ON DELETE CASCADE

**Indexes**

- `idx_program_lessons_program` ON `program_id`

**RLS**

- **Coach can manage program lessons:** ALL where program’s `coach_id = auth.uid()`
- **Clients can view assigned program lessons:** SELECT where assignment exists for current user’s client and program

---

## 4. Videos & assignments

### 4.1 `public.videos`

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `coach_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `title` | TEXT | NOT NULL | |
| `description` | TEXT | nullable | |
| `url` | TEXT | NOT NULL | |
| `category` | TEXT | nullable | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `thumbnail_url` | TEXT | nullable | |
| `client_id` | TEXT | nullable | Tenant |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE

**Indexes**

- `idx_videos_client_id` ON `client_id`

**RLS**

- **Coaches can manage videos in their tenant:** ALL where tenant and coach match  
- **Clients can view assigned videos:** via `video_assignments` (SELECT on that table)

---

### 4.2 `public.video_assignments`

Which clients have access to which videos.

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `video_id` | UUID | NOT NULL | FK → `videos(id)` ON DELETE CASCADE |
| `client_id` | UUID | NOT NULL | FK → `clients(id)` ON DELETE CASCADE |
| `assigned_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |

**Unique:** `(video_id, client_id)`

**Foreign keys**

- `video_id` → `public.videos(id)` ON DELETE CASCADE  
- `client_id` → `public.clients(id)` ON DELETE CASCADE

**RLS**

- **Clients can view assigned videos in their tenant:** SELECT (tenant + assignment check)
- **Coaches can manage video assignments in their tenant:** ALL where video and client belong to coach and tenant

---

### 4.3 `public.video_completions`

Client completion of videos (one row per client per video).

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `client_id` | UUID | NOT NULL | FK → `clients(id)` ON DELETE CASCADE |
| `video_id` | UUID | NOT NULL | FK → `videos(id)` ON DELETE CASCADE |
| `completed_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |

**Unique:** `(client_id, video_id)`

**Foreign keys**

- `client_id` → `public.clients(id)` ON DELETE CASCADE  
- `video_id` → `public.videos(id)` ON DELETE CASCADE

**Indexes**

- `idx_video_completions_client` ON `client_id`  
- `idx_video_completions_video` ON `video_id`

**RLS**

- **Clients can manage own video completions:** ALL where client row email matches auth user
- **Coaches can view video completions in tenant:** SELECT where client belongs to coach and tenant (or legacy `client_id` IS NULL)

**Note:** No `tenant_id` column; tenant inferred via `clients.client_id` in RLS.

---

## 5. Calendar / scheduling

### 5.1 `public.availability_slots`

Coach-defined time slots (can be linked to a session product).

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `coach_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `start_time` | TIMESTAMPTZ | NOT NULL | |
| `end_time` | TIMESTAMPTZ | NOT NULL | |
| `is_group_session` | BOOLEAN | NOT NULL (default FALSE) | |
| `max_participants` | INTEGER | NOT NULL (default 1) | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `client_id` | TEXT | nullable | Tenant |
| `session_product_id` | UUID | nullable | FK → `session_products(id)` ON DELETE SET NULL |
| `label` | TEXT | nullable | |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE  
- `session_product_id` → `public.session_products(id)` ON DELETE SET NULL

**Indexes**

- `idx_availability_slots_client_id` ON `client_id`  
- `idx_availability_slots_session_product` ON `session_product_id`

**RLS**

- **Coaches can manage availability in their tenant:** ALL  
- **Clients can view coach availability in their tenant:** SELECT where `client_id = get_current_client_id()`

---

### 5.2 `public.sessions`

Booked sessions (can link to session_request and availability_slot).

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `coach_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `client_id` | UUID | NOT NULL | FK → `clients(id)` ON DELETE CASCADE |
| `availability_slot_id` | UUID | nullable | FK → `availability_slots(id)` ON DELETE SET NULL |
| `scheduled_time` | TIMESTAMPTZ | NOT NULL | |
| `status` | TEXT | NOT NULL (default 'pending') | CHECK: `'pending' \| 'confirmed' \| 'cancelled' \| 'completed'` |
| `notes` | TEXT | nullable | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `updated_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `paid_at` | TIMESTAMPTZ | nullable | When coach marked as paid |
| `tenant_id` | TEXT | nullable | Tenant (for RLS) |
| `session_request_id` | UUID | nullable | FK → `session_requests(id)` ON DELETE SET NULL |
| `session_product_id` | UUID | nullable | FK → `session_products(id)` ON DELETE SET NULL |
| `amount_cents` | INTEGER | nullable | |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE  
- `client_id` → `public.clients(id)` ON DELETE CASCADE  
- `availability_slot_id` → `public.availability_slots(id)` ON DELETE SET NULL  
- `session_request_id` → `public.session_requests(id)` ON DELETE SET NULL  
- `session_product_id` → `public.session_products(id)` ON DELETE SET NULL

**Indexes**

- `idx_sessions_coach` ON `coach_id`  
- `idx_sessions_client` ON `client_id` (UUID; the client record, not tenant)  
- `idx_sessions_status` ON `status`  
- `idx_sessions_tenant_id` ON `tenant_id`  
- `idx_sessions_session_request` ON `session_request_id`

**RLS**

- **Coaches can manage sessions in their tenant:** ALL where `tenant_id` and coach tenant match  
- **Clients can view sessions in their tenant:** SELECT where tenant and client record match auth  
- **Clients can create session requests in their tenant:** INSERT with same checks

---

### 5.3 `public.session_products`

Sellable session packages (e.g. “5-pack”, “single”).

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `coach_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `client_id` | TEXT | NOT NULL | Tenant (naming collision with concept of “client” person) |
| `name` | TEXT | NOT NULL | |
| `description` | TEXT | nullable | |
| `goal` | TEXT | nullable | |
| `duration_minutes` | INTEGER | NOT NULL (default 45) | |
| `price_cents` | INTEGER | NOT NULL | |
| `max_participants` | INTEGER | NOT NULL (default 1) | |
| `is_active` | BOOLEAN | NOT NULL (default TRUE) | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `updated_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE

**Indexes**

- `idx_session_products_coach` ON `coach_id`  
- `idx_session_products_client_id` ON `client_id`

**RLS**

- **Coaches can manage session_products in their tenant:** ALL where tenant and coach match

---

### 5.4 `public.session_requests`

Request flow: offered → accepted → payment → availability → scheduled.

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `coach_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `client_id` | UUID | NOT NULL | FK → `clients(id)` ON DELETE CASCADE |
| `session_product_id` | UUID | nullable | FK → `session_products(id)` ON DELETE SET NULL |
| `tenant_id` | TEXT | NOT NULL | Tenant |
| `status` | TEXT | NOT NULL (default 'offered') | CHECK: `offered`, `accepted`, `payment_pending`, `paid`, `availability_submitted`, `scheduled`, `cancelled` |
| `amount_cents` | INTEGER | NOT NULL | |
| `stripe_payment_intent_id` | TEXT | nullable | |
| `availability_preferences` | JSONB | nullable | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `updated_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `availability_slot_id` | UUID | nullable | FK → `availability_slots(id)` ON DELETE SET NULL |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE  
- `client_id` → `public.clients(id)` ON DELETE CASCADE  
- `session_product_id` → `public.session_products(id)` ON DELETE SET NULL  
- `availability_slot_id` → `public.availability_slots(id)` ON DELETE SET NULL

**Indexes**

- `idx_session_requests_coach` ON `coach_id`  
- `idx_session_requests_client` ON `client_id`  
- `idx_session_requests_status` ON `status`  
- `idx_session_requests_tenant` ON `tenant_id`  
- `idx_session_requests_availability_slot` ON `availability_slot_id`

**RLS**

- **Coaches can manage session_requests in their tenant:** ALL  
- **Clients can view own session_requests:** SELECT  
- **Clients can update own session_requests:** UPDATE  

---

### 5.5 `public.client_time_requests`

Client-submitted preferred times; coach can confirm and link to session_request.

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `client_id` | UUID | NOT NULL | FK → `clients(id)` ON DELETE CASCADE |
| `coach_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `tenant_id` | TEXT | NOT NULL | Tenant |
| `preferred_times` | TEXT | NOT NULL | |
| `notes` | TEXT | nullable | |
| `status` | TEXT | NOT NULL (default 'pending') | CHECK: `'pending' \| 'offered' \| 'confirmed' \| 'declined'` |
| `session_request_id` | UUID | nullable | FK → `session_requests(id)` ON DELETE SET NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `updated_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |

**Foreign keys**

- `client_id` → `public.clients(id)` ON DELETE CASCADE  
- `coach_id` → `public.profiles(id)` ON DELETE CASCADE  
- `session_request_id` → `public.session_requests(id)` ON DELETE SET NULL

**Indexes**

- `idx_client_time_requests_coach` ON `coach_id`  
- `idx_client_time_requests_client` ON `client_id`  
- `idx_client_time_requests_tenant` ON `tenant_id`  
- `idx_client_time_requests_status` ON `status`

**RLS**

- **Coaches can manage client_time_requests in their tenant:** ALL  
- **Clients can insert own client_time_requests:** INSERT  
- **Clients can view own client_time_requests:** SELECT  

---

## 6. Payments

### 6.1 `public.payments`

Record of payments (Stripe or manual).

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `coach_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `client_id` | TEXT | NOT NULL | Tenant |
| `session_request_id` | UUID | nullable | FK → `session_requests(id)` ON DELETE SET NULL |
| `session_id` | UUID | nullable | FK → `sessions(id)` ON DELETE SET NULL |
| `amount_cents` | INTEGER | NOT NULL | |
| `currency` | TEXT | NOT NULL (default 'usd') | |
| `status` | TEXT | NOT NULL (default 'succeeded') | CHECK: `'succeeded' \| 'refunded' \| 'cancelled' \| 'recorded_manual'` |
| `provider` | TEXT | NOT NULL | CHECK: `'stripe' \| 'zelle' \| 'paypal' \| 'cashapp' \| 'other'` |
| `stripe_payment_intent_id` | TEXT | nullable | |
| `payer_client_id` | UUID | nullable | FK → `clients(id)` ON DELETE SET NULL |
| `description` | TEXT | nullable | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE  
- `session_request_id` → `public.session_requests(id)` ON DELETE SET NULL  
- `session_id` → `public.sessions(id)` ON DELETE SET NULL  
- `payer_client_id` → `public.clients(id)` ON DELETE SET NULL

**Indexes**

- `idx_payments_coach` ON `coach_id`  
- `idx_payments_client_id` ON `client_id`  
- `idx_payments_created_at` ON `created_at`

**RLS**

- **Coaches can manage payments in their tenant:** ALL  

**Note:** No policy for clients to SELECT their own payments; add one if client payment history is required.

---

## 7. Messaging

### 7.1 `public.messages`

Direct messages between users (coach ↔ client).

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `sender_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `recipient_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `content` | TEXT | NOT NULL | |
| `read_at` | TIMESTAMPTZ | nullable | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `client_id` | TEXT | nullable | Tenant |

**Foreign keys**

- `sender_id` → `public.profiles(id)` ON DELETE CASCADE  
- `recipient_id` → `public.profiles(id)` ON DELETE CASCADE

**Indexes**

- `idx_messages_recipient` ON `recipient_id`  
- `idx_messages_sender` ON `sender_id`  
- `idx_messages_client_id` ON `client_id`

**RLS**

- **Users can view messages in their tenant:** SELECT where `client_id = get_current_client_id()` and (sender or recipient = auth.uid())  
- **Users can send messages in their tenant:** INSERT with `client_id` and sender = auth.uid()

**Realtime:** Table is in `supabase_realtime` publication for live updates.

**Gap:** No UPDATE policy; `read_at` is updated in app code. Either add an RLS policy allowing recipient to UPDATE `read_at` for their messages, or use service role for that update.

---

### 7.2 `public.coach_daily_messages`

Dashboard / daily message from coach to all clients in tenant.

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `client_id` | TEXT | NOT NULL | Tenant (not FK to clients) |
| `coach_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `content` | TEXT | NOT NULL | |
| `effective_at` | DATE | nullable | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE

**Indexes**

- `idx_coach_daily_messages_coach_client` ON `(coach_id, client_id, effective_at)`

**RLS**

- **Coaches can manage daily messages in their tenant:** ALL  
- **Clients can view coach daily messages in their tenant:** SELECT where `client_id = get_current_client_id()`

---

### 7.3 `public.coach_message_templates`

Templates for broadcasts (email/SMS/in-app).

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `coach_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `tenant_id` | TEXT | NOT NULL | Tenant |
| `name` | TEXT | NOT NULL | |
| `subject` | TEXT | nullable | |
| `body_markdown` | TEXT | NOT NULL | |
| `channel` | TEXT | NOT NULL (default 'email') | CHECK: `'email' \| 'sms' \| 'in_app'` |
| `is_default` | BOOLEAN | NOT NULL (default FALSE) | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `updated_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE

**Indexes**

- `idx_coach_message_templates_coach` ON `coach_id`  
- `idx_coach_message_templates_tenant` ON `tenant_id`

**RLS**

- **Coaches can manage coach_message_templates in their tenant:** ALL  

---

### 7.4 `public.coach_broadcasts`

Broadcast sends (draft/scheduled/sent).

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `coach_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `tenant_id` | TEXT | NOT NULL | Tenant |
| `template_id` | UUID | nullable | FK → `coach_message_templates(id)` ON DELETE SET NULL |
| `subject` | TEXT | nullable | |
| `body_rendered` | TEXT | NOT NULL | |
| `channel` | TEXT | NOT NULL (default 'email') | CHECK: `'email' \| 'sms' \| 'in_app'` |
| `segment_filter` | JSONB | nullable | |
| `status` | TEXT | NOT NULL (default 'draft') | CHECK: `draft`, `scheduled`, `sending`, `sent`, `failed`, `canceled` |
| `send_at` | TIMESTAMPTZ | nullable | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `updated_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE  
- `template_id` → `public.coach_message_templates(id)` ON DELETE SET NULL

**Indexes**

- `idx_coach_broadcasts_coach` ON `coach_id`  
- `idx_coach_broadcasts_tenant` ON `tenant_id`  
- `idx_coach_broadcasts_send_at` ON `send_at`

**RLS**

- **Coaches can manage coach_broadcasts in their tenant:** ALL  

---

### 7.5 `public.coach_broadcast_recipients`

Per-recipient delivery status for broadcasts.

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `broadcast_id` | UUID | NOT NULL | FK → `coach_broadcasts(id)` ON DELETE CASCADE |
| `student_id` | UUID | NOT NULL | FK → `clients(id)` ON DELETE CASCADE |
| `tenant_id` | TEXT | NOT NULL | Tenant |
| `delivery_status` | TEXT | NOT NULL (default 'pending') | CHECK: `pending`, `queued`, `sent`, `bounced`, `failed`, `unsubscribed` |
| `delivery_metadata` | JSONB | nullable | |
| `delivered_at` | TIMESTAMPTZ | nullable | |

**Foreign keys**

- `broadcast_id` → `public.coach_broadcasts(id)` ON DELETE CASCADE  
- `student_id` → `public.clients(id)` ON DELETE CASCADE

**Indexes**

- `idx_coach_broadcast_recipients_broadcast` ON `broadcast_id`  
- `idx_coach_broadcast_recipients_tenant` ON `tenant_id`

**RLS**

- **Coaches can view coach_broadcast_recipients in their tenant:** SELECT only (no INSERT/UPDATE by RLS; likely service role for sending)

---

## 8. Activity & system

### 8.1 `public.activity_log`

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `user_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `action` | TEXT | NOT NULL | |
| `entity_type` | TEXT | nullable | |
| `entity_id` | UUID | nullable | |
| `details` | JSONB | nullable | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `client_id` | TEXT | nullable | Tenant |

**Foreign keys**

- `user_id` → `public.profiles(id)` ON DELETE CASCADE

**Indexes**

- (none in migrations)

**RLS**

- **Users can view activity in their tenant:** SELECT where `client_id = get_current_client_id()` and `user_id = auth.uid()`

**Gap:** No INSERT policy; logging usually done with service role or a dedicated policy.

---

### 8.2 `public.stripe_webhook_events`

Idempotency for Stripe webhooks.

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `event_id` | TEXT | NOT NULL | PK (Stripe event ID) |
| `processed_at` | TIMESTAMPTZ | NOT NULL (default now()) | |

**Indexes:** none (PK on `event_id`)

**RLS:** Not enabled. Table is intended for service-role-only use in webhook handler.

---

## 9. Coach branding & white-label

### 9.1 `public.coach_brand_settings`

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `coach_id` | UUID | NOT NULL | PK, FK → `profiles(id)` ON DELETE CASCADE |
| `tenant_id` | TEXT | NOT NULL | Tenant |
| `logo_url` | TEXT | nullable | |
| `app_icon_url` | TEXT | nullable | |
| `brand_image_url` | TEXT | nullable | |
| `primary_color` | TEXT | nullable | |
| `secondary_color` | TEXT | nullable | |
| `accent_color` | TEXT | nullable | |
| `theme_mode` | TEXT | NOT NULL (default 'system') | CHECK: `'light' \| 'dark' \| 'system'` |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `updated_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `brand_name` | TEXT | nullable | |
| `favicon_url` | TEXT | nullable | |
| `background_color` | TEXT | nullable | |
| `white_label` | BOOLEAN | NOT NULL (default FALSE) | Hide platform branding |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE

**Indexes**

- `idx_coach_brand_settings_tenant` ON `tenant_id`

**RLS**

- **Coaches can manage coach_brand_settings in their tenant:** ALL  
- **Clients can read coach_brand_settings for their coach:** SELECT for portal white-labeling  

---

### 9.2 `public.coach_email_settings`

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `coach_id` | UUID | NOT NULL | PK, FK → `profiles(id)` ON DELETE CASCADE |
| `tenant_id` | TEXT | NOT NULL | Tenant |
| `sender_name` | TEXT | nullable | |
| `sender_email` | TEXT | nullable | |
| `email_logo_url` | TEXT | nullable | |
| `footer_text` | TEXT | nullable | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `updated_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE

**Indexes**

- `idx_coach_email_settings_tenant` ON `tenant_id`

**RLS**

- **Coaches can manage coach_email_settings in their tenant:** ALL  

---

### 9.3 `public.coach_domains`

Custom domains for coach portals.

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `coach_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `tenant_id` | TEXT | NOT NULL | Tenant |
| `domain` | TEXT | NOT NULL | UNIQUE |
| `status` | TEXT | NOT NULL (default 'pending_verification') | CHECK: `pending_verification`, `verifying`, `active`, `error`, `disabled` |
| `verification_token` | TEXT | NOT NULL | |
| `verification_method` | TEXT | NOT NULL (default 'dns_txt') | CHECK: `'dns_txt' \| 'http_file'` |
| `last_checked_at` | TIMESTAMPTZ | nullable | |
| `error_message` | TEXT | nullable | |
| `requested_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `ssl_status` | TEXT | NOT NULL (default 'not_started') | CHECK: `not_started`, `provisioning`, `issued`, `failed` |
| `domain_verified` | BOOLEAN | NOT NULL (default FALSE) | True when verification succeeded |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE

**Indexes**

- `idx_coach_domains_coach` ON `coach_id`  
- `idx_coach_domains_tenant` ON `tenant_id`

**RLS**

- **Coaches can manage coach_domains in their tenant:** ALL  

---

### 9.4 `public.coach_dashboard_layouts`

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `coach_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `tenant_id` | TEXT | NOT NULL | Tenant |
| `name` | TEXT | NOT NULL (default 'default') | |
| `is_default` | BOOLEAN | NOT NULL (default TRUE) | |
| `layout_json` | JSONB | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `updated_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE

**Indexes**

- `idx_coach_dashboard_layouts_coach` ON `coach_id`  
- `idx_coach_dashboard_layouts_tenant` ON `tenant_id`

**RLS**

- **Coaches can manage coach_dashboard_layouts in their tenant:** ALL  

---

### 9.5 `public.coach_client_experience`

Portal welcome, theme, nav, terminology.

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `coach_id` | UUID | NOT NULL | PK, FK → `profiles(id)` ON DELETE CASCADE |
| `tenant_id` | TEXT | NOT NULL | Tenant |
| `welcome_title` | TEXT | nullable | |
| `welcome_body` | TEXT | nullable | |
| `hero_image_url` | TEXT | nullable | |
| `intro_video_source` | TEXT | nullable | CHECK: `'google_drive' \| 'youtube' \| 'upload'` |
| `intro_video_url` | TEXT | nullable | |
| `intro_video_metadata` | JSONB | nullable | |
| `show_welcome_block` | BOOLEAN | NOT NULL (default TRUE) | |
| `portal_theme_overrides` | JSONB | nullable | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `updated_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `portal_nav_enabled` | JSONB | NOT NULL (default array) | e.g. `["schedule","messages","programs","videos","payments"]` |
| `portal_booking_instructions` | TEXT | nullable | |
| `terminology` | JSONB | NOT NULL (default '{}') | Label overrides |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE

**Indexes**

- `idx_coach_client_experience_tenant` ON `tenant_id`

**RLS**

- **Coaches can manage coach_client_experience in their tenant:** ALL  

---

### 9.6 `public.coach_profiles`

Public coach profile (bio, specialties, social).

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `coach_id` | UUID | NOT NULL | PK, FK → `profiles(id)` ON DELETE CASCADE |
| `tenant_id` | TEXT | NOT NULL | Tenant |
| `headline` | TEXT | nullable | |
| `bio` | TEXT | nullable | |
| `specialties` | TEXT[] | nullable | |
| `profile_image_url` | TEXT | nullable | |
| `is_public` | BOOLEAN | NOT NULL (default TRUE) | |
| `show_social_links` | BOOLEAN | NOT NULL (default TRUE) | |
| `created_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |
| `updated_at` | TIMESTAMPTZ | NOT NULL (default NOW()) | |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE

**Indexes**

- `idx_coach_profiles_tenant` ON `tenant_id`

**RLS**

- **Coaches can manage coach_profiles in their tenant:** ALL  

---

### 9.7 `public.coach_social_links`

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `coach_id` | UUID | NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `tenant_id` | TEXT | NOT NULL | Tenant |
| `platform` | TEXT | NOT NULL | CHECK: `website`, `instagram`, `facebook`, `tiktok`, `linkedin`, `youtube`, `x`, `other` |
| `label` | TEXT | nullable | |
| `url` | TEXT | NOT NULL | |
| `sort_order` | INTEGER | NOT NULL (default 0) | |

**Foreign keys**

- `coach_id` → `public.profiles(id)` ON DELETE CASCADE

**Indexes**

- `idx_coach_social_links_coach` ON `coach_id`  
- `idx_coach_social_links_tenant` ON `tenant_id`

**RLS**

- **Coaches can manage coach_social_links in their tenant:** ALL  

---

## 10. Storage

- **Bucket `avatars`:** Public; 2MB limit; MIME types: jpeg, png, gif, webp.  
- **RLS on `storage.objects`:** Users can INSERT/UPDATE/DELETE only objects under path `{auth.uid()}/...` in bucket `avatars`. Public read via bucket setting.

Video files are not stored in Supabase Storage in the current schema; `videos.url` points to external URLs (e.g. YouTube, Drive, or other hosts). A dedicated **video storage** table or bucket is not present.

---

## 11. Helper function

- **`get_current_client_id()`** (SECURITY DEFINER): Returns `current_setting('app.client_id', true)` or, if unset, `profiles.tenant_id` for `auth.uid()`. Used by RLS to scope rows by tenant. The app must set `app.client_id` (e.g. via `SET LOCAL`) when using a specific tenant.

---

## 12. Missing or incomplete areas

### 12.1 Client management

- **Present:** `clients` (with coach, contact, notes, tenant).  
- **Missing / inconsistent:**  
  - **Client profile fields:** Validations reference `height`, `weight_kg`, `date_of_birth` on client profile; these columns do **not** exist on `clients`. Add them in a migration or remove from validation and UI.

### 12.2 Messaging

- **Present:** `messages` (1:1), `coach_daily_messages`, `coach_message_templates`, `coach_broadcasts`, `coach_broadcast_recipients`.  
- **Gaps:**  
  - **messages:** No RLS for UPDATE (e.g. marking `read_at`); app uses update in code—add recipient UPDATE policy or rely on service role.  
  - **coach_broadcast_recipients:** Only SELECT for coaches; INSERT/UPDATE (delivery status) likely done with service role.

### 12.3 Calendar / scheduling

- **Present:** `availability_slots`, `sessions`, `session_products`, `session_requests`, `client_time_requests`; FKs and tenant RLS are in place.  
- **Gaps:**  
  - No dedicated **recurring availability** table (e.g. “every Tuesday 5–7pm”); slots are one-off.  
  - No **calendar event** or **sync** table (e.g. for iCal/Google); calendar feed is built from `sessions` and `availability_slots` in app/API.  
  - **Index naming:** `idx_sessions_client_id` indexes `sessions.client_id` (UUID FK to `clients`), not tenant; name can be misleading.

### 12.4 Video storage

- **Present:** `videos` (metadata + `url`, `thumbnail_url`), `video_assignments`, `video_completions`.  
- **Missing:**  
  - No Supabase Storage bucket or table for **uploaded video files**; all video is external URL–based.  
  - No **transcoding/encoding status** or **storage path** column if you later add uploads.

### 12.5 Program creation

- **Present:** `programs`, `program_lessons`, `program_assignments`.  
- **Gaps:**  
  - **program_assignments:** No RLS policy for coaches to INSERT/UPDATE/DELETE; coach UI edits assignments (e.g. program detail, videos page). Add a “Coaches can manage program_assignments in their tenant” policy or document service-role usage.  
  - **program_lessons:** `UNIQUE(program_id, video_id)` with nullable `video_id` may not enforce one “non-video” lesson per slot as intended (DB-dependent); consider a partial unique index or different model for non-video lessons.

---

## 13. Incomplete or inconsistent tables (summary)

| Table / area | Issue |
|--------------|--------|
| **clients** | Validation/UI expect `height`, `weight_kg`, `date_of_birth`; columns missing in DB. |
| **program_assignments** | No coach RLS for INSERT/UPDATE/DELETE; coach flows assume they can modify. |
| **messages** | No UPDATE policy for recipient (e.g. `read_at`); currently app or service role. |
| **payments** | No client SELECT policy if client payment history is required in UI. |
| **activity_log** | No INSERT policy; logging typically needs service role or dedicated policy. |
| **session_products** | Column `client_id` (TEXT) is tenant id; naming can be confused with UUID `clients.id`. |
| **sessions** | `idx_sessions_client_id` is on UUID `client_id` (fighter), not tenant; name misleading. |
| **stripe_webhook_events** | No RLS (intentional for service-role webhook handler). |
| **program_lessons** | `video_id` nullable + `UNIQUE(program_id, video_id)`; semantics for non-video lessons may need tightening. |
| **Video storage** | No table or bucket for uploaded videos; all video is external URL. |

---

*Generated from `supabase/migrations/` and app usage (Supabase client calls, validations).*
