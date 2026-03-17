# M3 — In-App Notification System (ClearPath)

This document designs the in-app notification system for ClearPath: a simple Supabase-powered flow that creates notifications for key events, stores them in a single table, delivers them in real time via Supabase Realtime, and lets coaches control email vs in-app delivery per event type. This is not a full notification service—no push, no SMS—just in-app + optional email where configured.

---

## 1. Events that create a notification

The following events insert a row into `public.notifications` (and may trigger an email based on preferences; see §5 and §6).

| Event | Description | Recipient | Typical `type` | Example title | Example link |
|-------|-------------|-----------|----------------|---------------|--------------|
| **New message received** | A message is sent to the user (coach gets message from client; client gets message from coach). | Message recipient | `new_message` | "New message from [Sender Name]" | `/coach/messages` or `/client/messages` |
| **Client completed a task** | Client marks a program task/lesson as complete. | Coach (client’s coach) | `task_completed` | "[Client Name] completed a task" | `/coach/clients/[id]` or program view |
| **Upcoming session in 1 hour** | A session starts in ~1 hour (from cron or scheduler). | Coach and client | `session_reminder_1h` | "Session with [Other Party] in 1 hour" | `/coach/schedule` or `/client/schedule` |
| **Client viewed program first time** | Client opens their program (or first lesson) for the first time. | Coach | `program_first_view` | "[Client Name] viewed their program" | `/coach/clients/[id]` or program |

**Implementation notes**

- **New message:** On insert into `messages` (or equivalent), determine recipient; insert one notification per recipient. `link` can include thread or session id if you have a deep link.
- **Task completed:** On update (or insert into a completion table) that marks a task complete, resolve the client’s coach (and workspace if multi-tenant) and insert one notification for that coach.
- **Upcoming session 1h:** Same cron/scheduler that drives session reminders (see M1); for each session in the 1h window, insert one notification for the coach and one for the client. Optionally also create notifications for 24h reminder if desired (same pattern; add type `session_reminder_24h`).
- **Program first view:** When the client loads the program (or first lesson) for the first time, set a “first viewed at” timestamp (e.g. on `program_assignments` or a small `program_views` table) and insert one notification for the coach. Only fire once per (client, program).

Additional event types (e.g. payment received, client signed up) can be added later by extending the `type` enum and the preference toggles in §6.

---

## 2. Notifications table in Supabase

A single table holds all in-app notifications. Each row is for one user and one occurrence.

### SQL: `notifications`

```sql
-- Notification types (extend as needed).
CREATE TYPE public.notification_type AS ENUM (
  'new_message',
  'task_completed',
  'session_reminder_1h',
  'session_reminder_24h',
  'program_first_view'
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Optional: for filtering or display (e.g. client_id for "who completed the task").
  meta JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_read_created ON public.notifications(user_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
```

**Columns**

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | UUID | NOT NULL | PK |
| `user_id` | UUID | NOT NULL | FK → `auth.users(id)`; recipient of the notification |
| `type` | notification_type | NOT NULL | Event type for preferences and UI |
| `title` | TEXT | NOT NULL | Short title (e.g. "New message from Jane") |
| `body` | TEXT | nullable | Optional longer text or preview |
| `read` | BOOLEAN | NOT NULL | Default false; set true when user opens or “marks as read” |
| `link` | TEXT | nullable | Where to go when clicked (e.g. `/coach/messages`, `/client/schedule`) |
| `created_at` | TIMESTAMPTZ | NOT NULL | For ordering and “last 10” |
| `meta` | JSONB | NOT NULL | Optional payload (e.g. `{ "client_id": "...", "session_id": "..." }`) for UI or deep links |

**RLS**

- Users may only see and update their own notifications:

```sql
-- SELECT: own notifications only
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- UPDATE: only to mark read (and only own rows)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT: not by end users; use service role or SECURITY DEFINER in app/cron
-- So no INSERT policy for authenticated users, or use a DB function with SECURITY DEFINER.
```

**Who inserts:** Notifications are created by backend logic (API routes, server actions, or cron) using the **service role** client (or a SECURITY DEFINER function that inserts into `notifications`). This keeps RLS simple and avoids clients creating fake notifications.

---

## 3. Notification bell UI (top nav)

- **Placement:** Same spot in the top nav for coach and client (e.g. right side, before profile/avatar).
- **Icon:** Bell icon (e.g. Lucide `Bell`). No label required; tooltip “Notifications” is enough.
- **Unread count badge:** Show a small badge with the count of `read = false` for the current user (e.g. “3”). Hide the number when 0; optionally still show the bell. Cap display at “9+” if you want to avoid wide badges.
- **Dropdown (on click):**
  - List the **last 10** notifications (ordered by `created_at DESC`), regardless of read state.
  - Each row: icon (optional per type), title, relative time (e.g. “2 min ago”), and optionally one line of body. Clicking a row navigates to `link` (if present) and marks that notification as read.
  - **“Mark all as read”** button at top or bottom of the dropdown; calls an API or Supabase update to set `read = true` for all notifications for `auth.uid()`.
- **Empty state:** If there are no notifications, show a short message in the dropdown (e.g. “No notifications yet”).

**Data**

- **Initial load:** On layout or nav load, fetch unread count and last 10 (e.g. `GET /api/notifications` or direct Supabase `from('notifications').select().eq('user_id', uid).order('created_at', { ascending: false }).limit(10)`).
- **Realtime:** Subscribe to `notifications` for `user_id = auth.uid()` (see §4); on INSERT, increment unread count and prepend to the list; optionally show a small toast or in-dropdown highlight for the new item.

---

## 4. Real-time delivery (Supabase Realtime)

Notifications appear in the bell without a full page reload by subscribing to the `notifications` table filtered by the current user.

**Pattern**

- Use the **client** Supabase instance (e.g. `createClient()` from `@/lib/supabase/client`) inside a **client component** (e.g. the nav that contains the bell).
- Subscribe in a `useEffect` with dependencies `[userId]` (and cleanup on unmount or when `userId` changes). See `.cursor/skills/supabase-realtime/SKILL-realtime.md` for the exact pattern (channel ref, `removeChannel` in cleanup).
- Filter by `user_id`: use **postgres_changes** with a filter so only rows for the current user are received.

**Subscription**

- **Channel name:** e.g. `notifications:${userId}` (unique per user).
- **Event:** `postgres_changes` on `public.notifications`, event `INSERT`.
- **Filter:** `filter: 'user_id=eq.' + userId` (Supabase Realtime allows filter by column so only this user’s new rows are sent).

**On payload**

- Increment local unread count (or refetch count).
- Prepend the new notification to the list in the dropdown (and optionally show a brief toast or highlight).
- If the dropdown is open, you can animate the new row in.

**Cleanup**

- In the effect’s return, call `supabase.removeChannel(channelRef.current)` so you don’t leave channels open when the user logs out or the component unmounts.

**Realtime enablement**

- In Supabase Dashboard: **Database → Replication** — ensure `public.notifications` is enabled for replication (then Realtime can broadcast INSERTs).

---

## 5. Email vs in-app only

Every notification is **always** created as an in-app row. Whether an **email** is also sent depends on the event type and the user’s **notification preferences** (§6).

**Default behavior (before preferences exist)**

| Event | In-app | Email (default) |
|-------|--------|------------------|
| New message received | Yes | Yes (once per message or digest; see M1) |
| Client completed a task | Yes | No |
| Upcoming session in 1 hour | Yes | Yes (session reminder; see M1) |
| Client viewed program first time | Yes | No |

**After preferences (coach-only)**

Coaches can override these per event: **in-app only**, **email only**, or **both**. Clients do not get a preferences page in this design; they always get in-app, and email for messages/session reminders as per M1 (or future client preferences if you add them).

**Logic**

- When the app (or cron) **creates a notification**, it always inserts into `notifications`.
- Then it checks: “Should we also send an email for this (user_id, type)?”  
  - If the recipient is a coach, read `notification_preferences` (see §6) for that coach and `type`; if the preference is `email` or `both`, send the corresponding transactional email (using M1 templates and Resend).  
  - If the recipient is a client, use app defaults (e.g. send for new_message and session_reminder_1h; no email for task_completed or program_first_view for clients—those are coach-only events).

So: **in-app = always;** email = conditional on type and preferences (and for clients, on app defaults until you add client preferences).

---

## 6. Notification preferences page (coaches)

A **Notification preferences** page (e.g. under **Coach → Settings → Notifications**) allows coaches to choose, per event type, whether they want **in-app only**, **email only**, or **both**.

**Storage: `notification_preferences` table**

```sql
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type public.notification_type NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'both')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, notification_type)
);

CREATE INDEX idx_notification_preferences_user ON public.notification_preferences(user_id);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**UI**

- One row per event type that supports email (e.g. new message, task completed, session reminder 1h, program first view).
- Each row: label (e.g. “New message received”), and a control to choose:
  - **In-app only**
  - **Email only**
  - **Both**
- Save button or auto-save on change; persist to `notification_preferences` (upsert by `user_id` + `notification_type`).

**Defaults**

- If a coach has no row for a given `notification_type`, use the default from §5 (e.g. email for new_message and session_reminder_1h, in-app only for task_completed and program_first_view). Optionally seed defaults on first visit to the preferences page.

**Scope**

- Only coaches get this page in v1. Clients can be added later with a similar table and UI if needed.

---

## 7. Summary

| Piece | Detail |
|-------|--------|
| **Events** | New message, client completed task, upcoming session 1h, client viewed program first time (and optional 24h session reminder). |
| **Table** | `notifications`: user_id, type, title, body, read, link, created_at, meta. RLS: users see/update only own rows; inserts via service role or SECURITY DEFINER. |
| **Bell UI** | Icon + unread count badge; dropdown with last 10; mark as read on click; “Mark all as read” button. |
| **Realtime** | Supabase Realtime postgres_changes on `notifications`, filter `user_id=eq.<uid>`; subscribe in nav component with proper cleanup. |
| **Email** | In-app always; email conditional on event type and coach notification preferences (and client defaults). |
| **Preferences** | Coach settings page: per-event toggles for in-app only / email only / both; stored in `notification_preferences`. |

This keeps the system simple and fully Supabase-powered: one table for notifications, one for preferences, Realtime for live updates, and optional email via existing M1/Resend setup.
