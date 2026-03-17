# Messaging — Current State & V2 Specification

This document summarizes existing messaging/chat code in the project and defines the complete V2 messaging system: delivery model, conversation structure, data model, coach inbox, client view, unread/notifications, attachments, Supabase schema/RLS, and build-vs-buy recommendation.

---

## Part 1: Current State (What Exists)

### 1.1 Direct messages (coach ↔ client)

**Locations:** `app/client/messages/page.tsx`, `app/coach/messages/page.tsx`, `components/chat/MessageThread.tsx`, `components/chat/MessageBubble.tsx`, `components/chat/types.ts`

**Database:** `public.messages` — `id`, `sender_id`, `recipient_id`, `content`, `read_at`, `created_at`, `client_id` (tenant). RLS: view/send in tenant; no UPDATE policy (read_at is updated in app code). Realtime: table is in `supabase_realtime` publication (`supabase/migrations/20240117000000_realtime_messages.sql`).

**Behavior:**

- **Client:** Single thread with their coach. Resolves client by `clients.email = user.email`, loads messages with coach’s `profiles.id`. Subscribes to `postgres_changes` on `messages` for INSERT; marks messages as read on open and dispatches `clearpath:unread-messages-updated`.
- **Coach:** Inbox = list of clients (from `clients` where `coach_id = user.id`). Selecting a client loads messages between coach and that client’s profile (matched by `client.email`). Realtime per selected client; unread counts per client derived from messages where `recipient_id = coach` and `read_at IS NULL`. “Request session” sends a JSON payload in `content` (`type: 'session_offer'`) and inserts a session_request.
- **Content:** Plain text or JSON. Session offers are stored as JSON in `content` and rendered as special bubbles with CTA (e.g. “View & pay in Schedule”).

**Unread / badges:** Dashboard loads `unseenMessagesCount` (count where `recipient_id = user.id`, `read_at` null). Sidebar/MobileBottomNav listen for `clearpath:unread-messages-updated` and optionally subscribe to Realtime INSERT/UPDATE on `messages` to refresh badge. No push/email/SMS for new messages.

**Other:** “Daily message” is separate: `coach_daily_messages` (broadcast to all clients), not 1:1 chat. No file or video attachments in messages.

---

## Part 2: V2 Messaging System Specification

### 2.1 Real-time vs async — recommendation

**Recommendation: Real-time (Supabase Realtime) with async fallback.**

- **Why real-time for a coaching app:** Clients and coaches expect chat-like behavior: send and see replies without refresh. Session coordination, quick questions, and session offers benefit from instant visibility. You already use Supabase Realtime for `messages` and it fits the 1:1, low-volume pattern.
- **Keep:** Postgres Changes on `messages` (INSERT, and UPDATE for `read_at`) so both sides get live updates when the other sends or marks read.
- **Async fallback:** Initial load remains REST/query; if Realtime is unavailable or the user is offline, polling or next page load still shows history. Optional: push notifications (e.g. OneSignal, FCM) or email digests for “new message when you’re not in the app” — those are async on top of real-time in-app.

So: **primary experience = real-time (Supabase Realtime); persistence and reliability = async (Postgres + optional push/email).**

---

### 2.2 Conversation structure

**Recommendation: One thread per coach–client pair (no topic threads).**

- One continuous thread per coach–client pair is enough for typical coaching: scheduling, check-ins, session offers, and general Q&A. Topic-based threads add UI and schema complexity without clear payoff for this use case.
- **Implementation:** No separate `conversations` table required. A “conversation” is the set of rows in `messages` where `(sender_id, recipient_id)` equals `(coach_id, client_profile_id)` or `(client_profile_id, coach_id)`, scoped by tenant. Order by `created_at` and optionally use `client_id` (tenant) for multi-tenant filtering.
- **Session offers** can stay as special message types (e.g. JSON in `content` or a `message_type` column) inside the same thread so the flow stays in one place.

If you later need “topics” (e.g. “Session 3 – follow-up”), you can add an optional `thread_id` or `topic` and still keep the default as one thread per pair.

---

### 2.3 Message data model

**Recommended fields:**

| Field           | Type        | Nullable | Notes |
|----------------|-------------|----------|--------|
| `id`           | UUID        | NOT NULL | PK |
| `sender_id`    | UUID        | NOT NULL | FK → `profiles(id)` |
| `recipient_id` | UUID        | NOT NULL | FK → `profiles(id)` |
| `client_id`    | TEXT        | nullable | Tenant (current name in schema; conceptually tenant_id) |
| `content`      | TEXT        | NOT NULL | Plain text or JSON for structured types (e.g. session_offer) |
| `message_type`| TEXT        | nullable | e.g. `'text'`, `'session_offer'`, `'file'` — optional, can infer from content JSON |
| `read_at`      | TIMESTAMPTZ | nullable | When recipient first read the message |
| `created_at`   | TIMESTAMPTZ | NOT NULL | Send time |
| `updated_at`   | TIMESTAMPTZ | nullable | Optional, for edits/deletes |

**Optional for V2 attachments (see 2.7):**

- `attachments` JSONB: array of `{ type, url, name, size }` or similar.
- Or a separate `message_attachments` table keyed by `message_id`.

**Sender/recipient:** Always profile IDs. For coach–client, one is the coach’s `profiles.id`, the other is the client’s `profiles.id` (the client record is linked via `clients.email = profiles.email`).

**Read status:** Single `read_at` timestamp is enough: when set, the message is read. For “unread count,” use `WHERE recipient_id = :user_id AND read_at IS NULL`. No need for “delivered” vs “read” unless you add that later.

---

### 2.4 How the coach views all conversations (inbox)

- **List (inbox):** All clients of the coach in the current tenant (`clients` where `coach_id = auth.uid()` and tenant). For each client, show:
  - Client name (and optionally email).
  - Last message preview and time (from latest message in that coach–client thread).
  - Unread count for that thread (messages where `recipient_id = coach` and `read_at IS NULL` and sender = that client’s profile).
- **Sorting:** By last message `created_at` descending (most recent first), with unread threads optionally pinned or visually highlighted.
- **Selection:** Clicking a client opens the single thread (all messages with that client’s profile), real-time subscribed, and marks as read when the coach views it.
- **Compose:** Coach can only reply in the open thread; “Request session” can continue to post a session-offer message into the same thread.

No separate “all messages” feed is required; the inbox is the list of coach–client threads with preview and unread.

---

### 2.5 How the client views their conversation

- **Single thread:** The client has exactly one conversation (with their coach). Show all messages in that thread ordered by `created_at`.
- **Resolution:** Client is identified by `clients.email = profiles.email` (and tenant); coach is `clients.coach_id` → `profiles.id`. Load messages where `(sender_id, recipient_id)` is either `(client_profile_id, coach_id)` or `(coach_id, client_profile_id)`.
- **Real-time:** Subscribe to Postgres Changes on `messages` for the current user (e.g. filter by `recipient_id = auth.uid()` or sender/recipient in the pair) so new messages and read receipts appear without refresh.
- **Mark read:** When the client opens the Messages page, mark all messages where `recipient_id = client_profile_id` as read (`read_at = now()`).

This matches the existing client messages page; V2 keeps the same mental model and improves with real-time and clear read state.

---

### 2.6 Unread message counts and notifications

- **Unread count (in-app):**
  - **Coach:** Total unread = count of messages where `recipient_id = coach_id` and `read_at IS NULL`. Per-client unread = same filter with `sender_id = client_profile_id`. Use these for sidebar badge and per-conversation badges.
  - **Client:** Total unread = count where `recipient_id = client_profile_id` and `read_at IS NULL` (typically one thread).
- **Where to show:** Nav item “Messages” (and optionally coach dashboard) with a badge; coach inbox shows per-client unread. Existing event `clearpath:unread-messages-updated` can carry `totalUnread` (and optionally per-thread data) so SidebarNav/MobileBottomNav and dashboard stay in sync after Realtime INSERT/UPDATE or after marking read.
- **Notifications (optional V2):**
  - **Push:** When a new message is inserted with `recipient_id = X`, call a small serverless function or Edge Function that sends a push notification to user X (e.g. via OneSignal, FCM, or Supabase push if you add it). Prefer “new message” title and body from content (or “New message from Coach” for client).
  - **Email:** Optional digest or single “You have a new message” email for users who haven’t opened the app in N hours.
  - No need for in-app sound/browser notification unless you explicitly add it; badge + Realtime is enough for MVP.

---

### 2.7 Files and videos in messages

**Recommendation: Allow coaches (and optionally clients) to send files/links in messages.**

- **Scope:** Small files (e.g. PDFs, images) and links to videos (YouTube, Vimeo, Google Drive) are the most useful for coaching (forms, exercise clips, etc.). Full in-app video upload/transcode is a larger feature.
- **Options:**
  1. **Links only (simplest):** No new schema. Coaches paste links in `content`; you can auto-detect URLs and render embeds (e.g. YouTube) in `MessageBubble`. No file upload.
  2. **File uploads (V2):** Store files in Supabase Storage (e.g. bucket `message-attachments`, path `{tenant_id}/{message_id}/{filename}`). Add to message either:
     - **Option A:** `attachments` JSONB on `messages`: `[{ "type": "file", "url": "...", "name": "...", "size": 1234 }]`, or  
     - **Option B:** Table `message_attachments(message_id, file_url, file_name, file_size, content_type)`.  
   RLS: only participants of the thread can read; only sender (or coach) can insert. Use signed URLs or public read policy scoped by tenant/thread.
- **Videos:** Prefer links to existing video resources (YouTube, Drive, Vimeo) embedded in the thread. If you add uploads, store in Storage and link from the message (same attachment model). No need for a separate “video message” type unless you add recording-in-app later.

**Practical V2:** Support link embedding in content first; then add optional file upload (and optionally `message_type = 'file'` or attachments array/table) with Storage + RLS.

---

### 2.8 Supabase tables and RLS (exact)

**Table: `public.messages` (existing, with optional additions)**

```sql
-- Existing columns; ensure these exist:
-- id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
-- sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
-- recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
-- content TEXT NOT NULL,
-- read_at TIMESTAMPTZ,
-- created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
-- client_id TEXT  -- tenant

-- Optional V2: message_type, updated_at, attachments
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Indexes (existing + optional for inbox)
CREATE INDEX IF NOT EXISTS idx_messages_recipient_read
  ON public.messages(recipient_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_sender_recipient_created
  ON public.messages(sender_id, recipient_id, created_at DESC);
```

**RLS policies**

- **SELECT (view messages in tenant):** User can see a message if they are sender or recipient and the message is in their tenant.

```sql
CREATE POLICY "Users can view messages in their tenant" ON public.messages
  FOR SELECT USING (
    client_id = get_current_client_id()
    AND (auth.uid() = sender_id OR auth.uid() = recipient_id)
  );
```

- **INSERT (send):** Sender must be current user; tenant must match.

```sql
CREATE POLICY "Users can send messages in their tenant" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND client_id = get_current_client_id()
  );
```

- **UPDATE (mark read):** Only the recipient may set `read_at` (and optionally restrict to only updating `read_at`).

```sql
CREATE POLICY "Recipients can mark messages read" ON public.messages
  FOR UPDATE USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);
```

- **DELETE:** Optional; if you support “delete for me,” add a soft-delete or a separate policy. Not required for MVP.

**Realtime:** Keep `public.messages` in the `supabase_realtime` publication so INSERT/UPDATE are broadcast. Clients subscribe with filters (e.g. by `sender_id`/`recipient_id`) to avoid receiving every tenant’s messages.

**No separate `conversations` table:** Thread is derived from messages; “last message” and “unread count” are queries/views or app logic.

---

## Part 3: Build custom vs use a service (Stream / Sendbird)

**Recommendation: Build custom on Supabase (current direction).**

**Reasons:**

1. **You already have the core:** Real-time 1:1 messages, tenant-scoped RLS, coach inbox, client thread, and unread counts are implemented. Gaps are small: RLS UPDATE for `read_at`, optional `message_type`/attachments, and clearer “last message per thread” for inbox.
2. **Coaching is 1:1 and low volume:** You don’t need channels, large groups, moderation queues, or complex presence. Supabase Realtime + Postgres is enough for delivery and ordering.
3. **Cost and control:** Stream/Sendbird add a monthly cost and a second system. Keeping everything in Supabase keeps one auth, one RLS model, and one place to debug.
4. **Session offers and daily messages are custom:** Your session-offer payload and coach_daily_messages are app-specific. A third-party chat SDK would still need a custom layer for those; staying custom keeps one mental model.
5. **When to reconsider:** If you later need rich features (e.g. typing indicators, presence, reactions, full moderation dashboard, or very high scale), you can evaluate Stream/Sendbird again. For a coaching app with one thread per client and optional file links/uploads, custom Supabase is sufficient and simpler to maintain.

**Summary:** Use **Supabase (Postgres + Realtime)** for the V2 messaging system; add RLS UPDATE for read receipts, optional attachments/link embedding, and optional push/email for notifications. Revisit a managed chat service only if requirements grow beyond 1:1, tenant-scoped, low-volume messaging.
