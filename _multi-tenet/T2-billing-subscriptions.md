# T2 — Billing & subscriptions (ClearPath)

This document defines the ClearPath billing system using Stripe: pricing tiers, coach signup flow, Stripe integration (Checkout, Customer Portal, webhooks), plan limit enforcement, Supabase schema, subscription lapse behavior, and webhook handler logic.

**Prerequisites:** T1 multi-tenant schema (workspaces, `stripe_customer_id`, `max_clients`, `max_video_storage_gb`). Billing is **per workspace**; the workspace owner manages the subscription.

---

## 1. Pricing tiers

Three plans with clear limits and suggested price points.

| Tier | Max clients | Video storage | Features | Suggested price |
|------|-------------|---------------|----------|------------------|
| **Starter** | 5 | 5 GB | Core client list, programs, sessions, basic messaging, client portal | **$29/mo** |
| **Pro** | 20 | 25 GB | Everything in Starter + session packages, video library, calendar, payments (Stripe Connect), daily message templates | **$79/mo** |
| **Scale** | Unlimited* | 100 GB | Everything in Pro + priority support, higher storage | **$199/mo** |

\* “Unlimited” = enforce a high cap in code (e.g. 500) for safety; treat as unlimited in UI and marketing.

**Stripe setup**

- Create three **Products** in Stripe (e.g. “ClearPath Starter”, “ClearPath Pro”, “ClearPath Scale”).
- Each product has one **Price** (recurring monthly, USD).
- Store Stripe **Price IDs** in env or in `plan_limits` (e.g. `stripe_price_id_starter`, `stripe_price_id_pro`, `stripe_price_id_scale`).

**Plan slug in app:** Use `starter` | `pro` | `scale` in code and DB. Map to T1 `workspaces.plan` (T1 used `free` | `pro` | `team`; treat `free` as pre-trial or lapsed, and align `pro`/`team` with Pro/Scale or migrate to `starter`/`pro`/`scale`).

---

## 2. Coach signup: free trial and when billing starts

- **Free trial:** 14 days. Coach gets full access to the selected plan (e.g. Pro) for 14 days without a charge.
- **When billing starts:** First invoice is created and charged at the **end** of the trial (Stripe “trial period” on the subscription). If the coach cancels during the trial, no charge; subscription ends at trial end.
- **Signup flow:**
  1. Coach signs up (auth + create workspace + default `plan = 'starter'` or chosen tier).
  2. Before or after email verification, coach is prompted to “Start free trial” → redirect to **Stripe Checkout** in `subscription` mode with `subscription_data.trial_period_days: 14` and the chosen price.
  3. Checkout collects payment method but does not charge until trial end; Stripe sends `checkout.session.completed` when the subscription is created (with `status: 'trialing'`).
  4. Webhook creates/updates the workspace’s subscription record and sets plan/limits; app allows full access during trial.
  5. At trial end Stripe charges the customer and may send `customer.subscription.updated` (e.g. `status: 'active'`); no change to plan limits, only status sync.

**Optional:** Allow “Skip trial” so the first charge happens immediately (no `trial_period_days`).

---

## 3. Stripe integration overview

| Concern | Approach |
|--------|----------|
| **Initial subscription (and trial)** | **Stripe Checkout** — redirect coach to Checkout in `mode: 'subscription'` with the chosen Price, trial, and `metadata.workspace_id`. |
| **Self-service billing** | **Stripe Customer Portal** — link from coach settings to Portal so they can update payment method, view invoices, switch plan, cancel. |
| **Sync subscription state** | **Stripe webhooks** — update Supabase `subscriptions` and `workspaces` (plan, limits, status) on `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. |

**Checkout (subscription)**

- Create Stripe Customer for the workspace (or reuse `workspaces.stripe_customer_id`).
- Create Checkout Session with:
  - `mode: 'subscription'`
  - `customer` or `customer_email` (if new customer)
  - `line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }]`
  - `subscription_data: { trial_period_days: 14, metadata: { workspace_id } }`
  - `success_url` / `cancel_url` (e.g. `/coach/settings/billing?success=1` / `?cancelled=1`)
  - `metadata.workspace_id` for the webhook

**Customer Portal**

- Create a billing portal session: `stripe.billingPortal.sessions.create({ customer: workspace.stripe_customer_id, return_url })`.
- Redirect the coach to `session.url`. In Portal they can change plan (which will fire `customer.subscription.updated`).

**Webhooks**

- Use the same endpoint as today (e.g. `POST /api/webhooks/stripe`) and the existing `stripe_webhook_events` idempotency table.
- Listen for the three events below; for each, verify signature, then process (and store `event.id` for idempotency). Return 200 quickly; do heavy work after returning if needed (or keep it fast with direct DB updates).

---

## 4. Enforcing plan limits

Enforcement is **per workspace** and should run **before** the write (add client, upload video).

### 4.1 Client count

- **Where:** Before inserting a new row into `clients` (e.g. “Add client” API or server action).
- **Logic:**
  1. Resolve `workspace_id` for the current coach (e.g. from `coaches` or session).
  2. Load workspace’s `max_clients` and current count: `SELECT COUNT(*) FROM clients WHERE workspace_id = ?`.
  3. If `count >= max_clients`, **reject** the request and return a structured error (e.g. `{ code: 'PLAN_LIMIT_CLIENTS', message: '…', upgradeRequired: true }`).
  4. If under limit, allow insert.
- **UI:** When the API returns `upgradeRequired` (or equivalent), show an **upgrade prompt** (modal or banner): “You’ve reached the client limit for your plan. Upgrade to add more clients.” with a link to billing/Checkout.

### 4.2 Video storage

- **Where:** Before starting a video upload (or before confirming upload that would persist to storage).
- **Logic:**
  1. Resolve `workspace_id` and workspace’s `max_video_storage_gb`.
  2. Compute current usage: sum of `videos.size_bytes` (or from storage bucket metadata) for the workspace. If stored elsewhere, use a `workspace_storage_usage_bytes` cache or table updated on upload/delete.
  3. If `(current_usage_bytes + size_of_new_upload) > max_video_storage_gb * 1e9`, **reject** and return e.g. `{ code: 'PLAN_LIMIT_STORAGE', upgradeRequired: true }`.
  4. Otherwise allow upload.
- **UI:** On limit hit, show upgrade prompt: “You’ve reached your video storage limit. Upgrade for more space.”

### 4.3 Upgrade prompt (shared)

- Single component or pattern: when any “plan limit” error is returned, show a modal/banner with short copy and a CTA to “Upgrade plan” linking to `/coach/settings/billing` or directly to Stripe Checkout/Portal.

---

## 5. Supabase tables

### 5.1 `subscriptions` (linked to workspaces)

Stores the current subscription state per workspace; updated by webhooks and optionally by app when creating Checkout.

```sql
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  plan TEXT NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter', 'pro', 'scale')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id)
);

CREATE INDEX idx_subscriptions_workspace ON public.subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_stripe_sub ON public.subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
```

**RLS:** Workspace owners (and team members if desired) can SELECT their workspace’s subscription; INSERT/UPDATE/DELETE only via service role (webhooks) or a secured server-side path.

**Sync to `workspaces`:** When subscription status or plan changes, update `workspaces.plan`, `workspaces.stripe_customer_id`, `workspaces.max_clients`, and `workspaces.max_video_storage_gb` from `plan_limits` so the rest of the app reads from one place.

### 5.2 `plan_limits` (reference table)

Static table of limits per plan; no RLS or only read-only for anon/authenticated.

```sql
CREATE TABLE public.plan_limits (
  plan TEXT PRIMARY KEY CHECK (plan IN ('starter', 'pro', 'scale')),
  max_clients INTEGER NOT NULL,
  max_video_storage_gb INTEGER NOT NULL,
  stripe_price_id TEXT,
  features JSONB NOT NULL DEFAULT '{}'
);

INSERT INTO public.plan_limits (plan, max_clients, max_video_storage_gb, stripe_price_id) VALUES
  ('starter', 5, 5, NULL),   -- set STRIPE_PRICE_ID_STARTER in env or here
  ('pro', 20, 25, NULL),
  ('scale', 500, 100, NULL);
```

Webhook (or app) looks up `plan_limits` by `plan` and writes `max_clients` and `max_video_storage_gb` into `workspaces` when subscription is created or changed.

---

## 6. When a subscription lapses

- **Grace period:** After Stripe marks the subscription as `past_due` or `unpaid`, allow **7 days** of full access while you show a “Update payment method” banner and send email. During this time, treat status as “grace” in app logic (e.g. don’t downgrade yet).
- **Read-only mode:** After grace (or immediately after `canceled`/`unpaid` if you prefer no grace): set workspace to **read-only** — coaches and clients can view data but cannot:
  - Add/edit/delete clients, programs, sessions, videos, messages (or any mutating action).
  - Use Stripe Connect for new session payments (optional: allow viewing only).
  Implement by:
  - Storing `workspace.billing_status` (e.g. `'active' | 'grace' | 'read_only'`) and checking it in API routes and server actions before any write; or
  - Deriving from `subscriptions.status` (e.g. `active`/`trialing` = full access, `past_due` = grace, `canceled`/`unpaid` = read-only).
- **Data retention:** Keep workspace and client data for **90 days** after subscription ends. During read-only, show “Your subscription has ended. Resubscribe within 90 days to keep your data.” After 90 days, you may anonymize or delete workspace data per your policy (run a scheduled job; exact deletion logic out of scope here).

---

## 7. Stripe webhook events and handler logic

Use the same webhook endpoint and idempotency table (`stripe_webhook_events`). For each event type below, (1) verify signature, (2) insert `event.id` for idempotency (ignore if duplicate), (3) run the handler, (4) return 200.

### 7.1 `checkout.session.completed`

- **When:** Coach completes Stripe Checkout for a new subscription (or after trial starts).
- **Handler:**
  1. If `session.mode !== 'subscription'`, skip (e.g. existing one-time payment logic for session requests).
  2. Get `workspace_id` from `session.metadata.workspace_id`. If missing, log and return 200.
  3. Get or create subscription row for this workspace:
     - If `session.subscription` (Stripe subscription ID): fetch Subscription from Stripe, get `status`, `items.data[0].price.id`, `current_period_start/end`, `trial_start`/`trial_end`, `cancel_at_period_end`, `customer`.
  4. Map Stripe price ID to plan (e.g. via `plan_limits.stripe_price_id` or env map).
  5. Upsert `subscriptions`: `workspace_id`, `stripe_subscription_id`, `stripe_customer_id`, `status`, `plan`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, `trial_start`, `trial_end`, `updated_at`.
  6. Update `workspaces`: set `stripe_customer_id`, `plan`, `max_clients`, `max_video_storage_gb` from `plan_limits` for that plan.
  7. Return 200.

### 7.2 `customer.subscription.updated`

- **When:** Subscription is renewed, plan is changed in Portal, trial ends, or subscription is set to cancel at period end.
- **Handler:**
  1. Load subscription from DB by `event.data.object.id` (Stripe subscription ID).
  2. If not found, optionally fetch from Stripe and find workspace by `subscription.metadata.workspace_id` (if you set it) or by `stripe_customer_id` on workspaces; create or update `subscriptions` row.
  3. Update subscription row from event object: `status`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, `trial_end` (if any), and if the price changed, new `plan` from price ID.
  4. Update `workspaces` for that `workspace_id`: `plan`, `max_clients`, `max_video_storage_gb` from `plan_limits` for the (possibly new) plan.
  5. If `status` is `past_due` or `unpaid`, you can set workspace `billing_status = 'grace'` (if you use that column); when you implement read-only, switch to `read_only` after grace.
  6. Return 200.

### 7.3 `customer.subscription.deleted`

- **When:** Subscription is canceled (immediately or at period end).
- **Handler:**
  1. Find `subscriptions` row by `stripe_subscription_id = event.data.object.id`.
  2. Update row: `status = 'canceled'`, `updated_at = NOW()`. Optionally clear `stripe_subscription_id` or leave it for audit.
  3. Update `workspaces`: set `plan = 'free'` (or a dedicated `lapsed` plan), `max_clients` and `max_video_storage_gb` to your free-tier limits (e.g. 0 or 1 client, 0 GB) so new writes are blocked by limit checks. Set `billing_status = 'read_only'` (or equivalent) so read-only mode is enforced.
  4. Return 200.

**Idempotency:** For all three, insert `event.id` into `stripe_webhook_events` at the start of processing. If insert fails with unique violation, return 200 without applying changes.

---

## 8. Quick reference

| Item | Description |
|------|-------------|
| **Tiers** | Starter (5 clients, 5 GB) $29/mo; Pro (20, 25 GB) $79/mo; Scale (500, 100 GB) $199/mo |
| **Trial** | 14 days; first charge at trial end via Stripe |
| **Checkout** | Stripe Checkout, `mode: 'subscription'`, trial and `metadata.workspace_id` |
| **Portal** | Stripe Customer Portal for payment method, invoices, plan change, cancel |
| **Webhooks** | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` → sync to `subscriptions` and `workspaces` |
| **Limits** | Check client count and storage before add/upload; return upgrade error and show upgrade prompt |
| **Tables** | `subscriptions` (per workspace), `plan_limits` (plan → limits, price ID) |
| **Lapse** | 7-day grace → read-only → 90-day retention then data handling per policy |

This design keeps billing workspace-scoped, uses Stripe for payments and self-service, and keeps Supabase as the source of truth for plan and limits so the app can enforce them consistently.
