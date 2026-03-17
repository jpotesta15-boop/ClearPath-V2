# M2 — Coach Onboarding Flow (ClearPath)

This document specifies the **coach onboarding wizard**: a short, one-time flow that new coaches complete before reaching the dashboard. It defines the four steps, data persisted at each step, how completion is tracked, the progress indicator, and redirect behavior.

---

## 1. Overview

- **Who sees it:** Any coach who has never completed onboarding (see §5).
- **When:** After sign-up/sign-in, before the coach dashboard. The wizard is the first experience in the coach area.
- **One-time only:** Once `completed_onboarding` is true, the coach always lands on the dashboard; the wizard is never shown again (even on refresh or return visits).
- **Route:** `GET /coach/onboarding` — single route; step is controlled by client state or query (e.g. `?step=2`) or by stored progress so refresh preserves step.

---

## 2. Wizard steps

### Step 1 — “Set up your workspace”

**Purpose:** Capture workspace identity and branding basics.

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| Workspace name | Text | Yes | Display name for the coach’s business/workspace (e.g. “Jane’s Fitness”, “Peak Performance Coaching”). |
| Profile photo | File upload | Yes | Coach profile/avatar image. Upload to Supabase Storage `avatars` (or dedicated bucket); store URL in profile. |
| Logo | File upload | No | Optional workspace/brand logo. Stored in brand settings or profile. |

**UI notes:**

- Workspace name: single text input, placeholder e.g. “Your coaching business name”.
- Profile photo: upload area with preview; accept image types per existing storage policy (e.g. jpeg, png, gif, webp); max size per bucket policy (e.g. 2MB).
- Logo: optional upload with “Skip” or “Add logo later”; same constraints.

**Data saved at Step 1:** See §4.1.

---

### Step 2 — “Tell us about your coaching”

**Purpose:** Segment and context for product/analytics and future personalization.

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| Type of coaching | Multi-select | Yes (at least one) | Options: **Fitness**, **Life**, **Business**, **Nutrition**. Coach can select multiple. |
| Current client count | Single choice or number | Yes | “How many clients do you currently have?” — e.g. options: 0, 1–5, 6–10, 11–25, 26–50, 50+ or a number input with bands. |

**UI notes:**

- Type of coaching: checkboxes or multi-select (e.g. “Select all that apply”).
- Client count: dropdown or radio group; store as a band or exact number depending on analytics needs.

**Data saved at Step 2:** See §4.2.

---

### Step 3 — “Invite your first client”

**Purpose:** Optional quick win; coach can send one invite from the wizard.

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| Client name | Text | If submitting | Required when not skipping. |
| Client email | Email | If submitting | Required when not skipping. |

**Behavior:**

- **Skippable:** Prominent “Skip for now” (or “I’ll add clients later”) that advances to Step 4 without creating a client or sending email.
- **If not skipped:** Validate name and email; create a row in `clients` (coach_id, full_name, email, tenant_id/workspace_id as applicable); call existing invite flow (e.g. `POST /api/invite-client` with `{ email }`) to send the invite email. Show success message (e.g. “Invite sent to …”) then allow continuing to Step 4.

**Data saved at Step 3:** See §4.3.

---

### Step 4 — “You’re ready”

**Purpose:** Success screen with clear next actions; completing this step marks onboarding complete.

**Content:**

- Short success headline (e.g. “You’re all set” or “Your workspace is ready”).
- Subheading or one line of encouragement.
- **Three large clickable cards**, each representing a first action:

| Card | Label (example) | Destination |
|------|------------------|-------------|
| 1 | Add a client | `/coach/clients/new` |
| 2 | Create a program | `/coach/programs` (or `/coach/programs/new` if available) |
| 3 | Import a video | `/coach/videos` (or upload flow) |

**Behavior:**

- Each card is a link or button that navigates to the given route.
- **On entering Step 4:** Mark onboarding complete (set `completed_onboarding = true`). This can happen when the user lands on Step 4 (e.g. after “Continue” from Step 3) or when they click any of the three cards; recommended: set `completed_onboarding = true` as soon as they reach Step 4 so that even “Go to dashboard” or browser refresh sends them to the dashboard.
- Optional: provide a “Go to dashboard” button that links to `/coach/dashboard` for users who don’t want to pick one of the three actions immediately.

---

## 3. Progress indicator

- **Placement:** Top of the wizard (above step content), inside the onboarding layout.
- **Style:** Subtle — e.g. a thin progress bar or 4 dots/circles (one per step). Do not dominate the layout.
- **States:**
  - Current step: highlighted (e.g. filled circle or bar segment).
  - Completed steps: distinct “done” state (e.g. checkmark or filled).
  - Future steps: neutral (e.g. outline or muted).
- **No step labels required** in the indicator; step title in the content is enough. Optionally show “Step 1 of 4” text next to the indicator.
- **Responsive:** Same indicator on mobile; can collapse to “Step X of 4” if space is tight.

---

## 4. Data saved at each step

### 4.1 After Step 1 (Set up your workspace)

Persist as soon as the user leaves Step 1 (e.g. on “Continue”) or on blur/auto-save if desired. Prefer save on “Continue” for clarity.

| Data | Where to store (current schema) | Where to store (T1 workspaces) |
|------|---------------------------------|---------------------------------|
| Workspace name | `coach_brand_settings.brand_name` and/or `profiles.display_name`; if no workspace table, “workspace” name can be `profiles.display_name` or a new column on `profiles` / `coach_brand_settings` | `workspaces.name` (workspace row created on signup or at Step 1) |
| Profile photo URL | `profiles` (e.g. `logo_url` for avatar) or `coach_profiles.profile_image_url` | Same; coach profile/avatar is per user. Prefer `coach_profiles.profile_image_url` or `profiles` avatar field. |
| Logo URL | `coach_brand_settings.logo_url` or `profiles.logo_url` | Same; `coach_brand_settings.logo_url` or workspace-level logo if table exists. |

**Upload flow:** Use Supabase Storage (e.g. `avatars` bucket with path `{user_id}/avatar.{ext}` and `{user_id}/logo.{ext}`). After upload, persist the public or signed URL in the appropriate table(s).

---

### 4.2 After Step 2 (Tell us about your coaching)

| Data | Where to store |
|------|-----------------|
| Coaching types (multi-select) | **Option A:** `profiles.preferences` JSONB, e.g. `{ "onboarding_coaching_types": ["fitness", "nutrition"] }`. **Option B:** New column `profiles.coaching_types` TEXT[] or JSONB. **Option C:** If T1, a `workspace_preferences` or `workspaces` JSONB column. Prefer one place (e.g. `profiles.preferences`) for simplicity. |
| Current client count | **Option A:** `profiles.preferences`, e.g. `{ "onboarding_client_count_band": "6-10" }` or `"onboarding_client_count": 8`. **Option B:** New column on `profiles` or workspace. |

Use a single place (e.g. `profiles.preferences`) so that onboarding data is easy to query and does not require new migrations if not using T1 yet.

---

### 4.3 After Step 3 (Invite your first client)

- **If skipped:** No data.
- **If submitted:**
  - Insert into `clients`: `coach_id`, `full_name`, `email`, and tenant (`client_id` / `tenant_id` or `workspace_id` per schema). Do not set `phone`/`notes` if not collected.
  - Call existing `POST /api/invite-client` with `{ email }` (and ensure tenant/workspace context is set so the invite is associated with the correct coach/workspace). Optionally extend the API to accept `full_name` for the invite email content.
  - No separate “onboarding” table needed; the client row is the record.

---

### 4.4 Step 4 (You’re ready)

The only persistence at Step 4 is marking onboarding **complete** (see §5). No additional form data.

---

## 5. Tracking completion: `completed_onboarding`

### 5.1 Where to store

- **If using T1 multi-tenant schema (workspaces):** Add a column on `workspaces`:
  - `completed_onboarding BOOLEAN NOT NULL DEFAULT FALSE`
  - When the coach reaches Step 4 (or submits Step 3 and goes to Step 4), set `completed_onboarding = TRUE` for their workspace.
- **If still on current schema (no workspaces):** Add a column on `profiles`:
  - `completed_onboarding BOOLEAN NOT NULL DEFAULT FALSE`
  - When the coach reaches Step 4, set `completed_onboarding = TRUE` for their profile (`profiles.id = auth.uid()`).

**Recommendation:** Prefer workspace-level in T1 so that “workspace is set up” is the unit of completion. Until workspaces exist, use `profiles.completed_onboarding`.

### 5.2 When to set true

- Set `completed_onboarding = true` when the user **enters Step 4** (e.g. when the wizard state or route shows the “You’re ready” screen). This can be done:
  - **Client-side:** After transition to step 4, call a small API or Server Action that updates the flag.
  - **Server-side:** If step is in the URL (e.g. `?step=4`), the onboarding page can set the flag when it renders step 4 for an authenticated coach.

Do not set it when the user only clicks one of the three cards; set it on **reaching** Step 4 so that a refresh or “Go to dashboard” already sees onboarding complete.

### 5.3 Migration (example for current schema)

```sql
-- If using profiles (current schema)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS completed_onboarding BOOLEAN NOT NULL DEFAULT FALSE;

-- If using T1 workspaces (add to workspaces table)
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS completed_onboarding BOOLEAN NOT NULL DEFAULT FALSE;
```

---

## 6. When to show the wizard vs dashboard

### 6.1 Rule

- **Coach has not completed onboarding** (`completed_onboarding = false`): Any visit to `/coach/*` (except `/coach/onboarding`) should redirect to `/coach/onboarding`.
- **Coach has completed onboarding** (`completed_onboarding = true`): Visiting `/coach/onboarding` should redirect to `/coach/dashboard`. The wizard is never shown again.

### 6.2 Where to enforce

- **Option A — Coach layout (`app/coach/layout.tsx`):** After confirming the user is a coach (role check), fetch `completed_onboarding` (from profile or workspace). If false and pathname is not `/coach/onboarding`, redirect to `/coach/onboarding`. If true and pathname is `/coach/onboarding`, redirect to `/coach/dashboard`.
- **Option B — Middleware:** Middleware can read the session and, for coach routes, call an API or use a small server check to read `completed_onboarding`; redirect accordingly. This keeps logic in one place but may require an extra lookup or cookie.
- **Recommendation:** Implement in the **coach layout** (server component): one fetch of profile/workspace, then redirect. Keeps middleware simple and avoids extra round-trips.

### 6.3 Auth callback

- After sign-up or OAuth, the auth callback currently redirects coaches to `/coach/dashboard`. Change this to redirect coaches to `/coach/onboarding`. The coach layout will then:
  - If `completed_onboarding` is false: show the onboarding page (no redirect).
  - If `completed_onboarding` is true: redirect to `/coach/dashboard`.

So: **auth callback** → `/coach/onboarding` for coaches. **Coach layout** → if not completed, stay on onboarding; if completed, redirect to dashboard when user tries to open `/coach/onboarding`.

---

## 7. Implementation checklist

- [ ] Add `completed_onboarding` to `profiles` (or `workspaces` when T1 is in use).
- [ ] Create route `app/coach/onboarding/page.tsx` (and optional `layout.tsx` for progress indicator).
- [ ] Implement four steps (state or URL query), progress indicator, and per-step persistence.
- [ ] Step 1: Form + uploads; save workspace name, profile photo URL, optional logo URL to current schema (or workspaces).
- [ ] Step 2: Multi-select coaching types + client count; save to `profiles.preferences` (or agreed column).
- [ ] Step 3: Name + email form, skippable; on submit create client and call invite API; then go to Step 4.
- [ ] Step 4: Success screen with three cards (Add client, Create program, Import video); set `completed_onboarding = true` when step 4 is shown.
- [ ] Coach layout: if coach and `completed_onboarding` is false and path ≠ `/coach/onboarding`, redirect to `/coach/onboarding`; if true and path is `/coach/onboarding`, redirect to `/coach/dashboard`.
- [ ] Auth callback: redirect coaches to `/coach/onboarding` instead of `/coach/dashboard`.
- [ ] Ensure invite-client API (and client creation) use the correct tenant/workspace context when called from onboarding.

---

## 8. Edge cases

- **User closes browser on Step 2:** On next visit, layout redirects to `/coach/onboarding`. Wizard should restore step from saved data (e.g. step index in `preferences` or derive from what’s already filled) so they can resume; otherwise start at Step 1 and prefill what’s saved.
- **Upload fails (Step 1):** Show inline error; do not advance until profile photo is saved or allow “Skip” for logo only; profile photo can remain required.
- **Invite fails (Step 3):** Show error (e.g. “This email already has an account” or “Failed to send invite”); allow retry or skip. Do not block moving to Step 4 (they can add the client later from the dashboard).
- **Already completed:** If `completed_onboarding` is true, coach layout redirects `/coach/onboarding` → `/coach/dashboard`; no need to show the wizard again.

---

*This document should be updated when the wizard steps change, the schema for onboarding data changes, or redirect logic moves (e.g. into middleware).*
