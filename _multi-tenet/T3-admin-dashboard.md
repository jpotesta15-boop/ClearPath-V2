# T3 — Super-admin dashboard (ClearPath)

This document defines the **internal-only** ClearPath super-admin panel: overview metrics, coach/workspace list, manual plan changes, usage by workspace, how the super_admin role works in Supabase, and how to deploy it so it is completely inaccessible to regular users.

**Prerequisites:** T1 multi-tenant schema (workspaces, coaches, RLS, admin bypass), T2 billing (subscriptions, Stripe, plan_limits).

---

## 1. Overview

- **Route:** `/admin` (or `admin.clearpath.com` if using subdomain deployment).
- **Access:** Only users with role `super_admin` in the `admin_users` table. Enforced in middleware and again in layout/API.
- **Purpose:** Platform management: view aggregate metrics, list and inspect workspaces, change plans for support, view usage, and optionally impersonate a workspace for support.

---

## 2. Overview page (`/admin` or `/admin/dashboard`)

Single dashboard view with high-level platform metrics. All data is aggregated across workspaces (via admin-only Supabase calls or SECURITY DEFINER functions).

### 2.1 Metrics to display

| Metric | Description | Source |
|--------|-------------|--------|
| **Total coaches** | Number of distinct workspaces (or count of workspace owners / coaches with role owner). | `SELECT COUNT(*) FROM workspaces` (admin function). |
| **Total active subscriptions** | Number of workspaces with a subscription in `active` or `trialing` status. | `subscriptions` where `status IN ('active', 'trialing')`, or from Stripe. |
| **MRR (monthly recurring revenue)** | Sum of recurring monthly revenue from Stripe for all active/trialing subscriptions. | Stripe API: list subscriptions with `status: 'active'` (and optionally `trialing`), sum `plan.amount` per subscription, or use Stripe Reporting / Balance API. Alternatively compute from `subscriptions` + `plan_limits.stripe_price_id` and Stripe Price amounts (cached in app or DB). |
| **Total clients (all workspaces)** | Sum of client counts across all workspaces. | `SELECT COUNT(*) FROM clients` (admin function) or `SELECT workspace_id, COUNT(*) FROM clients GROUP BY workspace_id` then sum. |
| **Total videos stored** | Total number of video records (or total storage in bytes). | `SELECT COUNT(*) FROM videos` and optionally `SELECT COALESCE(SUM(size_bytes), 0) FROM videos` (admin function). |

### 2.2 Implementation notes

- **MRR:** Prefer Stripe as source of truth. Options: (a) Stripe API `subscriptions.list({ status: 'active', expand: ['data.items.data.price'] })` and sum `items[].price.unit_amount` per subscription; (b) store monthly amount in `subscriptions` or `plan_limits` and aggregate in DB for fast dashboard load.
- **Caching:** Overview can call admin RPCs that run as SECURITY DEFINER; for very large datasets, consider materialized views or nightly aggregates updated by a cron job.
- **UI:** Cards or a simple table for the five metrics; optional trend (e.g. MRR vs last month) if historical data is stored.

---

## 3. Coach / workspace list (`/admin/workspaces`)

A list of every workspace with key fields and actions for support.

### 3.1 Columns

| Column | Description |
|--------|-------------|
| **Workspace** | `workspaces.name`, `workspaces.id` (link or copy). |
| **Plan** | `workspaces.plan` (e.g. `starter`, `pro`, `scale`). |
| **Client count** | Number of rows in `clients` for this `workspace_id`. |
| **Last active date** | Latest activity for the workspace: e.g. `MAX(sessions.updated_at)`, or `MAX(activity_log.created_at)`, or a dedicated `workspaces.last_active_at` updated by app/trigger. |
| **Subscription status** | From `subscriptions.status`: `inactive`, `trialing`, `active`, `past_due`, `canceled`, `unpaid`. Display with clear labels (e.g. “Active”, “Trialing”, “Past due”, “Canceled”). |
| **Actions** | **Impersonate / View workspace** button: for support, open or redirect into that workspace’s context (see §3.2). |

### 3.2 Impersonate / view workspace for support

- **Button:** “View workspace” or “Impersonate” per row.
- **Behavior options:**
  - **Option A (recommended):** Open the coach dashboard in a new tab **as that workspace** by setting a one-time token or server-side session that the app interprets as “viewing as workspace X”. The admin user stays logged in as themselves; the app (e.g. `/coach/*` with a special query or cookie) runs with `app.workspace_id = target_workspace_id` and uses a **service role or admin RPC** to load data for that workspace. No actual “login as coach” — just view-only or limited actions in context of that workspace.
  - **Option B:** True impersonation: admin clicks “Impersonate”, app creates a short-lived token or session that makes subsequent requests run as the workspace owner (e.g. set cookie or header `X-Impersonate-Workspace: <id>`); middleware and API resolve workspace from that and allow read (and optionally limited write) for that workspace. Requires careful audit so the admin cannot escalate to other workspaces.
- **Security:** Only allow when the requesting user is in `admin_users` with `role = 'super_admin'`. Log impersonation (who, which workspace, when) in an `admin_audit_log` table.

---

## 4. Manual plan upgrade / downgrade

Allow super-admin to change a workspace’s plan without going through Stripe (e.g. comp a month, support override, or migration).

### 4.1 UI

- From the workspace list, an action “Change plan” (or a dedicated page `/admin/workspaces/[id]/plan`).
- Dropdown or buttons: select target plan (`starter` | `pro` | `scale`).
- Optional: “Reason” or “Note” for audit.
- Confirm; on submit, call an admin-only API.

### 4.2 Backend behavior

1. **Validate:** Caller is super_admin (middleware + API check).
2. **Update DB:** Set `workspaces.plan = target_plan` and set `workspaces.max_clients` and `workspaces.max_video_storage_gb` from `plan_limits` for that plan.
3. **Optional:** Update `subscriptions` for that workspace (e.g. set `plan = target_plan`, leave Stripe fields as-is so you don’t overwrite Stripe state) so admin and Stripe webhooks stay consistent. If you want “manual override” to take precedence over Stripe until next webhook, document that in T2.
4. **Optional:** Sync to Stripe (e.g. change subscription item to the new price) so MRR and Stripe match; if you don’t sync, Stripe and DB can diverge — use only for comp/support cases.
5. **Audit:** Log in `admin_audit_log`: admin user, workspace_id, old_plan, new_plan, timestamp.

### 4.3 API

- `PATCH /api/admin/workspaces/[workspaceId]/plan` (or POST with body `{ plan: 'pro' }`). Server: verify super_admin, then update `workspaces` (and optionally `subscriptions`) from `plan_limits`.

---

## 5. Usage page (`/admin/usage`)

Per-workspace usage for storage and API calls.

### 5.1 Storage by workspace

- **Metric:** Total storage used per workspace (e.g. for videos).
- **Source:**  
  - **Option A:** `SELECT workspace_id, COALESCE(SUM(size_bytes), 0) AS bytes FROM videos GROUP BY workspace_id` (admin RPC).  
  - **Option B:** If videos are in Supabase Storage, aggregate bucket metadata or a `workspace_storage_usage_bytes` table updated on upload/delete (see T2).
- **Display:** Table: workspace name/id, storage used (e.g. GB), limit (from `workspaces.max_video_storage_gb`), percentage used. Optional: sort by usage, filter by over limit.

### 5.2 API calls by workspace

- **Metric:** Number of API requests (or “billable” requests) per workspace over a period (e.g. last 30 days).
- **Source:** Requires instrumentation: either (a) log each request with `workspace_id` (from auth/session) to a table (e.g. `api_usage_log(workspace_id, created_at)`) and aggregate, or (b) use a third-party (e.g. Vercel Analytics, custom log drain) and tag by workspace. If not yet implemented, document “To be added: log workspace_id per request and aggregate in `api_usage` or similar.”
- **Display:** Table: workspace, period, request count. Optional: export CSV.

---

## 6. Super_admin role in Supabase

Access to `/admin` and admin APIs is restricted to users who have the **super_admin** role. This is enforced in two places: **middleware** (redirect unauthenticated or non–super_admin users) and **layout/API** (re-verify before rendering or returning data).

### 6.1 `admin_users` table

Use a small, separate table that lists which auth users are platform admins. Only one or two rows in practice (you and possibly one other).

```sql
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_admin_users_user_id ON public.admin_users(user_id);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
-- No RLS policies: only service role or SECURITY DEFINER functions read this table.
-- Application code uses service role or a DEFINER function to check membership.
```

- **Purpose:** Single source of truth for “is this user a super_admin?”. No reliance on JWT claims for this (JWT can be kept minimal).
- **Population:** Insert your (and any other admin’s) `auth.users.id` after signup. Do this via Supabase dashboard or a one-off migration with the known user UUID.

### 6.2 How the app checks super_admin

- **Middleware:** For requests to `/admin` (or the admin path you use), after confirming the user is authenticated (e.g. via Supabase session in cookies), the middleware must determine if that user is a super_admin. Because RLS on `admin_users` has no SELECT for regular users, the app **cannot** use the normal Supabase client to read `admin_users`. Two options:
  - **Option A (recommended):** In middleware, call an **API route** (e.g. `GET /api/admin/me` or internal) that uses the **service role** client: read session (or user id from cookie), then query `admin_users` with the service role; return 200 if `user_id` exists (and optionally `role = 'super_admin'`). Middleware calls this API (same origin) and redirects to `/login` or 403 if not super_admin. Keep this route strict and rate-limited.
  - **Option B:** Use a **SECURITY DEFINER** function that returns true/false, e.g. `SELECT public.is_super_admin(auth.uid())`. The authenticated Supabase client can call it because the function runs as its owner (e.g. `clearpath_super_admin`) and only returns a boolean; the table data is not exposed. Then middleware would need to run in a context where it can call Supabase with the user’s session (e.g. same as coach/client auth in middleware). If your middleware already has the session, you can call `supabase.rpc('is_super_admin', { uid: user.id })` or a wrapper that takes no args and uses `auth.uid()` inside.
- **Layout / API:** Every admin page layout and every admin API route must **again** verify the user is a super_admin (e.g. call the same `is_super_admin(uid)` or service-role check). Never rely on middleware alone.

### 6.3 Relation to T1’s `super_admins` and `is_super_admin()`

- T1 defines `super_admins(user_id)` and `is_super_admin(uid)` (SECURITY DEFINER) for use in **admin RPCs** (e.g. `admin_list_workspaces()`). You can either:
  - **Use the same table name:** Rename T1’s `super_admins` to `admin_users` and add a `role` column (e.g. `super_admin`), and have `is_super_admin(uid)` check `EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = uid AND role = 'super_admin')`, or
  - **Keep two concepts:** Keep `super_admins` for the DEFINER functions and add `admin_users` for app/middleware; then keep them in sync (e.g. trigger or application logic so that every `admin_users` row with `role = 'super_admin'` has a corresponding `super_admins.user_id`). Simplest is **one table** `admin_users` with `role = 'super_admin'` and use it everywhere: in middleware (via API or RPC that checks this table), in layout, and in `is_super_admin(uid)` (SECURITY DEFINER reads `admin_users`).

Recommended: **Single table `admin_users`** with `role TEXT CHECK (role IN ('super_admin'))`. Implement `is_super_admin(uid)` to `SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = uid AND role = 'super_admin')` with SECURITY DEFINER so admin RPCs (e.g. listing workspaces) can use it. Middleware then either calls an API that uses service role to read `admin_users`, or calls an RPC like `is_super_admin` with the current user’s id from the session.

---

## 7. Deploying so the admin panel is inaccessible to regular users

Two complementary strategies: **routing / URL** and **authentication**.

### 7.1 URL strategy

- **Option A — Separate subdomain (recommended):** Deploy the admin app (or same app with host check) at **`admin.clearpath.com`**.  
  - **Benefits:** Clear separation; you can put `admin.clearpath.com` behind stricter firewall or IP allowlist; DNS and SSL are straightforward.  
  - **Implementation:** Same Next.js app: in middleware, if `request.nextUrl.hostname === 'admin.clearpath.com'`, treat the request as admin-only (require super_admin and redirect to admin login if not). All routes under that host are admin. Optionally run a separate small app on a different subdomain that only serves `/admin` and proxies to the main app for auth.  
- **Option B — Deeply obscured path:** Use a path that is not guessable, e.g. `/a8f3b2c1-4d5e-6f7a-8b9c-0d1e2f3a4b5c` or a long random slug stored in env (e.g. `ADMIN_PATH_SECRET=xyz...`). Middleware allows access to that path only when the user is super_admin; otherwise 404.  
  - **Benefits:** Single domain; no subdomain setup.  
  - **Drawbacks:** Path can leak via logs, referrer, or history; less “invisible” than a separate subdomain.

Prefer **Option A** for production so admin is clearly isolated and you can add network-level controls (e.g. VPN or IP allowlist for `admin.clearpath.com`).

### 7.2 Two-factor authentication (2FA)

- **Require 2FA for super_admin:** Even if someone obtains a super_admin’s password, 2FA adds a second factor. Implement by:
  - Enforcing 2FA for any user in `admin_users`: at first admin login (or next login after being added to `admin_users`), redirect to a “Set up 2FA” flow (e.g. TOTP via Supabase or a library), and store a flag (e.g. `admin_users.totp_enabled` or in `auth.users` app_metadata) so that subsequent logins to `/admin` require the TOTP code.
  - Or use Supabase’s built-in MFA when available and require it for admin users.
- **Admin login flow:** Use a dedicated admin login page (e.g. `admin.clearpath.com/login` or the obscured path + `/login`) that only accepts email/password (and 2FA) for users who are in `admin_users`; reject others with “Access denied” without revealing that an admin area exists. After login, verify `admin_users` again and then allow access to the dashboard.

### 7.3 Summary

| Measure | Recommendation |
|--------|-----------------|
| **URL** | Prefer `admin.clearpath.com`; alternatively a secret path in env. |
| **Auth** | Only users in `admin_users` with `role = 'super_admin'`. |
| **Check** | Middleware + every admin layout and API route. |
| **2FA** | Required for super_admin accounts. |
| **Network** | Optional: restrict `admin.clearpath.com` by IP or VPN. |
| **Audit** | Log admin actions (plan changes, impersonation) in `admin_audit_log`. |

This keeps the super-admin panel internal-only and makes it very hard for regular users to discover or access it.
