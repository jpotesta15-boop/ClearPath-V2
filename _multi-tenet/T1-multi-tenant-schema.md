# T1 — Multi-tenant database architecture (ClearPath)

This document defines the complete multi-tenant database architecture for ClearPath: many coaches, each with an isolated workspace. It replaces the current **tenant_id / client_id (TEXT)** model with **workspaces** and **workspace_id (UUID)**.

---

## 1. Workspaces table

Each workspace is one isolated “coach business”: one or more coaches, shared client list, shared programs/videos/sessions, and plan limits.

### SQL: `workspaces`

```sql
-- Run this in a migration before adding workspace_id to other tables.
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team')),
  stripe_customer_id TEXT,
  max_clients INTEGER NOT NULL DEFAULT 10,
  max_video_storage_gb INTEGER NOT NULL DEFAULT 5
);

CREATE INDEX idx_workspaces_owner ON public.workspaces(owner_id);
CREATE INDEX idx_workspaces_stripe_customer ON public.workspaces(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
```

**Columns**

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `name` | TEXT | NOT NULL | Workspace display name |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `owner_id` | UUID | NOT NULL | FK → `auth.users(id)`; the coach who owns the workspace |
| `plan` | TEXT | NOT NULL | `'free' \| 'pro' \| 'team'` |
| `stripe_customer_id` | TEXT | nullable | Stripe Customer for workspace billing |
| `max_clients` | INTEGER | NOT NULL | Plan limit |
| `max_video_storage_gb` | INTEGER | NOT NULL | Plan limit (GB) |

**RLS (workspaces):** Only the owner (or a super_admin via SECURITY DEFINER) may SELECT/UPDATE their workspace(s). INSERT is done by the app when a new coach signs up (e.g. service role or a signup function). See §3 and §6.

---

## 2. Coaches table (linked to auth.users and workspace)

Coaches are app users who belong to a workspace and have a role within it. One user can belong to multiple workspaces (e.g. owner of one, team_member of another).

### SQL: `coaches`

```sql
CREATE TABLE public.coaches (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'team_member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, workspace_id)
);

CREATE INDEX idx_coaches_user ON public.coaches(user_id);
CREATE INDEX idx_coaches_workspace ON public.coaches(workspace_id);
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
```

**Columns**

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `user_id` | UUID | NOT NULL | FK → `auth.users(id)` |
| `workspace_id` | UUID | NOT NULL | FK → `workspaces(id)` |
| `role` | TEXT | NOT NULL | `'owner' \| 'team_member'` (team_member for future) |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

**Semantics**

- **owner:** Created when the workspace is created; typically one per workspace. Can manage billing, invite team members, delete workspace.
- **team_member:** For a later feature; same data access as owner within the workspace (shared client list, programs, etc.), but possibly restricted admin actions.

**RLS (coaches):** Users can SELECT rows where `user_id = auth.uid()`. INSERT/UPDATE/DELETE only by workspace owner or service role (or SECURITY DEFINER signup path).

---

## 3. Helper: current user’s workspace for RLS

Every RLS policy that scopes by tenant must use “the current user’s workspace.” For coaches, that comes from `coaches`; for clients, from the client record linked to their profile.

### SQL: `current_workspace_id()`

```sql
-- Returns the workspace_id for the requesting user (coach or client).
-- Coaches: from coaches.workspace_id (first workspace if multiple; app can set app.workspace_id for multi-workspace).
-- Clients: from the clients row where clients.email = (SELECT email FROM profiles WHERE id = auth.uid()).
CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    current_setting('app.workspace_id', true)::UUID,
    -- Coach: get workspace from coaches table
    (SELECT c.workspace_id FROM public.coaches c WHERE c.user_id = auth.uid() LIMIT 1),
    -- Client: get workspace from the client record that matches this user's email
    (SELECT cl.workspace_id FROM public.clients cl
     JOIN public.profiles p ON p.id = auth.uid()
     WHERE cl.email = p.email AND cl.workspace_id IS NOT NULL
     LIMIT 1)
  );
$$;
```

**Usage**

- App can set `SET LOCAL app.workspace_id = '<uuid>'` when a coach has multiple workspaces so RLS uses the active one.
- Clients do not set it; they get workspace from their `clients` row (email match).

---

## 4. Adding `workspace_id` to every existing table (migration)

Every tenant-scoped table gets a non-nullable `workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE` and an index. Migration order must respect FKs: create `workspaces` and `coaches` first, then backfill workspace_id (see §7).

### Tables that get `workspace_id`

| Table | Notes |
|-------|--------|
| `profiles` | Denormalized workspace for “current” workspace (coach) or nullable for clients; alternatively keep profiles global and rely on coaches/clients for workspace. **Recommendation:** Add `workspace_id` nullable to profiles; set for coaches from `coaches.workspace_id`, for clients from their `clients.workspace_id`. Or leave profiles without workspace_id and use only coaches + clients for workspace context. |
| `clients` | **Replace** tenant `client_id` (TEXT) with `workspace_id` (UUID). Client belongs to workspace; all coaches in that workspace share the list. Optionally keep `created_by` (coach user_id) for audit. |
| `programs` | Add `workspace_id`; keep `coach_id` for “created by” or drop and use workspace only. |
| `program_assignments` | Add `workspace_id` (redundant with program but simplifies RLS) or derive from program. |
| `program_lessons` | Derive from program or add `workspace_id`. |
| `videos` | Add `workspace_id`. |
| `video_assignments` | Add `workspace_id` or derive from video. |
| `video_completions` | Add `workspace_id` or derive from client. |
| `availability_slots` | Add `workspace_id`. |
| `sessions` | Replace `tenant_id` (TEXT) with `workspace_id` (UUID). |
| `session_products` | Replace tenant `client_id` (TEXT) with `workspace_id`. |
| `session_requests` | Replace `tenant_id` with `workspace_id`. |
| `client_time_requests` | Replace `tenant_id` with `workspace_id`. |
| `payments` | Replace tenant `client_id` (TEXT) with `workspace_id`. |
| `messages` | Replace `client_id` (TEXT) with `workspace_id`. |
| `coach_daily_messages` | Replace `client_id` (TEXT) with `workspace_id`. |
| `coach_message_templates` | Replace `tenant_id` with `workspace_id`. |
| `coach_broadcasts` | Replace `tenant_id` with `workspace_id`. |
| `coach_broadcast_recipients` | Replace `tenant_id` with `workspace_id`. |
| `activity_log` | Replace `client_id` (TEXT) with `workspace_id`. |
| `coach_brand_settings` | Replace `tenant_id` with `workspace_id`. |
| `coach_email_settings` | Replace `tenant_id` with `workspace_id`. |
| `coach_domains` | Replace `tenant_id` with `workspace_id`. |
| `coach_dashboard_layouts` | Replace `tenant_id` with `workspace_id`. |
| `coach_client_experience` | Replace `tenant_id` with `workspace_id`. |
| `coach_profiles` | Replace `tenant_id` with `workspace_id`. |
| `coach_social_links` | Replace `tenant_id` with `workspace_id`. |

**Do not add workspace_id to:**

- `stripe_webhook_events` (global idempotency)
- `auth.users` (Supabase managed)

### Example migration (one table): `clients`

```sql
-- Add column (nullable first for backfill)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Backfill: map existing tenant client_id (TEXT) to workspace_id.
-- Option A: If you have a 1:1 mapping from tenant_id to workspace (e.g. you create one workspace per existing tenant):
--   UPDATE public.clients SET workspace_id = (SELECT id FROM public.workspaces WHERE workspaces.slug = clients.client_id) WHERE client_id IS NOT NULL;
-- Option B: Single default workspace for migration:
--   UPDATE public.clients SET workspace_id = (SELECT id FROM public.workspaces LIMIT 1) WHERE workspace_id IS NULL;

-- Then enforce NOT NULL and index
-- ALTER TABLE public.clients ALTER COLUMN workspace_id SET NOT NULL;  -- after backfill
CREATE INDEX IF NOT EXISTS idx_clients_workspace ON public.clients(workspace_id);

-- Drop old tenant column
-- ALTER TABLE public.clients DROP COLUMN IF EXISTS client_id;  -- the TEXT tenant one; keep client_id if it's the UUID FK to clients
```

(For `clients`, the existing `client_id` TEXT is tenant; the UUID column that references the “person” in other tables stays. So: add `workspace_id`, backfill, then drop the TEXT `client_id` tenant column and rename if needed to avoid confusion.)

---

## 5. RLS policy pattern (workspace-scoped)

Every select/insert/update/delete must ensure the requesting user’s workspace matches the row’s `workspace_id`.

### Standard pattern (coach and client both use `current_workspace_id()`)

- **SELECT:** `workspace_id = current_workspace_id()`
- **INSERT:** `WITH CHECK (workspace_id = current_workspace_id())` and ensure the app sets `workspace_id` to `current_workspace_id()` (or a CHECK enforces it).
- **UPDATE:** `USING (workspace_id = current_workspace_id())`
- **DELETE:** `USING (workspace_id = current_workspace_id())`

### RLS policy template (per table)

Apply to every workspace-scoped table (with RLS enabled):

```sql
-- Enable RLS
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- SELECT: user can only see rows in their workspace
CREATE POLICY "<table_name>_select_workspace"
  ON public.<table_name> FOR SELECT
  USING (workspace_id = current_workspace_id());

-- INSERT: user can only insert rows in their workspace (and must set workspace_id to current)
CREATE POLICY "<table_name>_insert_workspace"
  ON public.<table_name> FOR INSERT
  WITH CHECK (workspace_id = current_workspace_id());

-- UPDATE: user can only update rows in their workspace
CREATE POLICY "<table_name>_update_workspace"
  ON public.<table_name> FOR UPDATE
  USING (workspace_id = current_workspace_id());

-- DELETE: user can only delete rows in their workspace
CREATE POLICY "<table_name>_delete_workspace"
  ON public.<table_name> FOR DELETE
  USING (workspace_id = current_workspace_id());
```

### Tables without a direct `workspace_id` column

For tables that are reached only via FKs (e.g. `program_assignments`), either:

- Add `workspace_id` and keep it in sync (recommended for simple, uniform RLS), or
- Use a subquery in RLS, e.g. SELECT only if the related row is in the user’s workspace:

```sql
-- Example: program_assignments if you don't add workspace_id
CREATE POLICY "program_assignments_select_workspace"
  ON public.program_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id = program_assignments.program_id
      AND p.workspace_id = current_workspace_id()
    )
  );
```

Prefer adding `workspace_id` to every tenant-scoped table for consistency and index-friendly policies.

### Special cases

- **profiles:** Users can always SELECT/UPDATE their own row (`id = auth.uid()`). Optionally restrict SELECT of other profiles to same workspace via a join through `coaches` or `clients`.
- **clients:** Clients (portal users) must only see their own client row: add a policy `FOR SELECT USING (workspace_id = current_workspace_id() AND email = (SELECT email FROM profiles WHERE id = auth.uid()))`.
- **workspaces:** Only the owner (or super_admin) can SELECT/UPDATE; see §6 for admin.

---

## 6. Client scoping: clients belong to workspace (shared by coaches)

- A **client** is a row in `clients` with `workspace_id` set. That client belongs to the **workspace**, not to a single coach.
- All coaches in that workspace share the same client list: any coach with `coaches.workspace_id = X` sees all `clients` where `workspace_id = X`.
- Optional: keep `created_by_coach_id` or `coach_id` on `clients` for “primary coach” or “created by” for UX/audit; RLS still scopes by `workspace_id`.
- Sessions/programs/videos can still have a `coach_id` (which coach delivered or created the resource); the **scope** of who can see/edit is workspace, not coach.

**Summary:** Scope all client-scoped data by `workspace_id`. If two coaches are in the same workspace, they see the same clients, programs, sessions, etc.

---

## 7. Super_admin role (admin panel across workspaces)

A **super_admin** is a special user that can query (and optionally manage) all workspaces for your own admin panel. Implement via a **Postgres function with SECURITY DEFINER** so it runs with elevated privileges and bypasses RLS in a controlled way.

### 7.1 Role and bypass RLS

Create a role that can bypass RLS and own the admin functions:

```sql
-- Create role (run as superuser)
CREATE ROLE clearpath_super_admin NOLOGIN BYPASSRLS;

-- Grant usage on schema and tables (or grant SELECT/UPDATE on specific tables)
GRANT USAGE ON SCHEMA public TO clearpath_super_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO clearpath_super_admin;
-- If you use sequences:
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO clearpath_super_admin;
```

### 7.2 Admin function (SECURITY DEFINER)

The admin panel calls a function that runs as `clearpath_super_admin`, so queries inside it bypass RLS:

```sql
-- Example: list all workspaces (for admin dashboard).
-- Only allow when the caller is a known super_admin (e.g. by app_metadata or a small table).
CREATE OR REPLACE FUNCTION public.admin_list_workspaces()
RETURNS SETOF public.workspaces
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Restrict callers to super_admins (e.g. check auth.jwt() ->> 'app_metadata' ->> 'super_admin' = 'true'
  -- or a table public.super_admins(user_id) where auth.uid() IN (SELECT user_id FROM super_admins))
  IF NOT (SELECT public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed: super_admin only';
  END IF;
  RETURN QUERY SELECT * FROM public.workspaces;
$$;

-- Grant execute to authenticated users; the function body enforces who can actually call it
GRANT EXECUTE ON FUNCTION public.admin_list_workspaces() TO authenticated;
```

### 7.3 Super_admin check (small table or JWT)

Option A — table (recommended for small, controlled set):

```sql
CREATE TABLE public.super_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
-- No policies: only service role or SECURITY DEFINER functions read this.

CREATE OR REPLACE FUNCTION public.is_super_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = uid);
$$;
```

Option B — JWT `app_metadata`: in your auth callback or Supabase dashboard, set `app_metadata.super_admin = true` for admin users; then in the function use `(auth.jwt() ->> 'app_metadata')::jsonb ->> 'super_admin' = 'true'`.

### 7.4 Ownership of the admin function

So that the function runs with BYPASSRLS, it must run as a role that has BYPASSRLS. In Postgres, SECURITY DEFINER runs as the **owner** of the function. So make the function owner the role that has BYPASSRLS:

```sql
-- Create the function (as superuser or as clearpath_super_admin)
-- Then assign owner so it runs with BYPASSRLS:
ALTER FUNCTION public.admin_list_workspaces() OWNER TO clearpath_super_admin;
```

Your admin panel (Next.js API route or server action) uses the **authenticated** Supabase client (so `auth.uid()` is set) and calls `select * from admin_list_workspaces()`. Only users who pass `is_super_admin(auth.uid())` get results; others get an exception.

---

## 8. Migration order (summary)

Run migrations in this order to avoid FK and RLS issues:

1. **Create `workspaces`** (no dependency on other app tables).
2. **Create `coaches`** (depends on `workspaces`, `auth.users`).
3. **Add `workspace_id` to `clients` and backfill** (so `current_workspace_id()` can resolve client workspace). Backfill from existing tenant/client_id (TEXT) to the corresponding workspace. Do not drop the old tenant column until step 6.
4. **Create `current_workspace_id()`** (depends on `coaches` and `clients.workspace_id`).
5. **Add `workspace_id` to all other tables and backfill** (in dependency order so backfill can resolve FKs): **profiles** (optional), **programs**, **program_assignments**, **program_lessons**, **videos**, **video_assignments**, **video_completions**, **availability_slots**, **sessions**, **session_products**, **session_requests**, **client_time_requests**, **payments**, **messages**, **coach_daily_messages**, **coach_message_templates**, **coach_broadcasts**, **coach_broadcast_recipients**, **activity_log**, **coach_brand_settings**, **coach_email_settings**, **coach_domains**, **coach_dashboard_layouts**, **coach_client_experience**, **coach_profiles**, **coach_social_links**.
6. **Drop old tenant columns** (`tenant_id`, or TEXT `client_id` where it meant tenant) and old RLS policies that used `get_current_client_id()`.
7. **Create new RLS policies** using `workspace_id = current_workspace_id()` (template in §5).
8. **Create `super_admins` table**, `is_super_admin()`, and `admin_list_workspaces()` (and any other admin functions); set function owner to `clearpath_super_admin`.

For a greenfield deployment, you can create `workspaces` and `coaches` first, then create all tables with `workspace_id` from the start and skip backfill.

---

## 9. Quick reference: workspaces + RLS + super_admin

| Item | Description |
|------|-------------|
| **workspaces** | `id`, `name`, `created_at`, `owner_id`, `plan`, `stripe_customer_id`, `max_clients`, `max_video_storage_gb` |
| **coaches** | `user_id` → auth.users, `workspace_id` → workspaces, `role` (owner \| team_member) |
| **current_workspace_id()** | SECURITY DEFINER; returns workspace for current user (coach or client) |
| **RLS** | Every tenant table: SELECT/INSERT/UPDATE/DELETE with `workspace_id = current_workspace_id()` |
| **Clients** | Belong to workspace; all coaches in workspace share the client list |
| **Super_admin** | `super_admins` table or JWT + `is_super_admin()`; admin functions SECURITY DEFINER owned by BYPASSRLS role |

This gives you a complete multi-tenant schema with workspace isolation, shared client list per workspace, and a safe admin path that bypasses RLS only inside SECURITY DEFINER functions.
