---
name: supabase-realtime
description: Correct Supabase Realtime usage in Next.js and React—subscribe in useEffect with proper cleanup, handle own-action deduplication, reconnection, and the exact pattern for a live-updating message thread. Use when implementing or reviewing Realtime subscriptions in client components.
---

# Supabase Realtime in Next.js (React)

Use this skill when adding or reviewing Supabase Realtime subscriptions in client components. Realtime runs only in the browser; use the **client** Supabase instance from `@/lib/supabase/client` (see the supabase-patterns skill). Incorrect subscription lifecycle causes memory leaks, duplicate messages, and "Too many channels" errors.

---

## 1. Where and how to subscribe

**Rules:**

- Subscribe only in **client components** (`'use client'`).
- Use **one** `useEffect` whose dependencies are the minimal set needed for the channel (e.g. `userId`, `threadId`). When any of these change, the effect will re-run: cleanup runs first (unsubscribe), then the new subscription is created.
- Create the channel **synchronously** inside the effect so the cleanup function can always remove it. If you need async data (e.g. `getUser()`) to build the channel name, see the "Async setup" pattern below.
- Store the channel in a **ref** so the cleanup can remove the current channel even when the subscription was created asynchronously.

**Correct pattern (synchronous):**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

function MyComponent({ threadId }: { threadId: string }) {
  const supabase = createClient()
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  useEffect(() => {
    const channel = supabase
      .channel(`thread:${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          // Handle payload; prefer setState with updater to avoid stale closure
          setMessages((prev) => [...])
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [threadId])

  // ...
}
```

**Why a ref:** The cleanup runs when the component unmounts or when `threadId` changes. The ref holds the **latest** channel so we always remove the right one. If you stored the channel in a variable only (e.g. `let channel`), an async path might set `channel` after the cleanup has already run—so cleanup would remove nothing.

---

## 2. Proper cleanup (avoid memory leaks and "Too many channels")

**Rule:** Every `useEffect` that calls `.channel(...).on(...).subscribe()` **must** return a cleanup function that calls `supabase.removeChannel(channel)`.

**Correct cleanup:**

```tsx
return () => {
  if (channelRef.current) {
    supabase.removeChannel(channelRef.current)
    channelRef.current = null
  }
}
```

**What breaks if you subscribe in useEffect without correct cleanup:**

1. **Multiple active channels** – Each time the effect runs (e.g. dependency change or strict mode double-mount), a new channel is created. Without cleanup, the previous channel is never removed. You get duplicate handlers and duplicate UI updates.
2. **"Too many channels" / Realtime limits** – Supabase has a limit on open channels per client. Orphaned channels accumulate on navigation (user opens Messages, leaves, opens again) and eventually subscription fails.
3. **Memory leaks** – The Realtime client and the callback closures hold references. Unsubscribed channels and their listeners are not freed until `removeChannel` is called.
4. **setState on unmounted component** – If the component unmounts (e.g. user navigates away) and a message arrives later, the callback still runs and calls `setMessages` (or similar). React will warn: "Can't perform a React state update on an unmounted component." In the worst case this can cause inconsistent UI or errors. Cleanup ensures no more callbacks run after unmount.
5. **Stale closures** – Without cleanup, an old callback might still run and close over an old `threadId` or `userId`, merging data into the wrong thread or state.

So: **always return a cleanup that removes the channel**. Use a ref so the cleanup removes the channel that was actually created in this effect run (important when setup is async).

---

## 3. Async setup (e.g. channel name depends on `getUser()`)

If the channel name or filter depends on async data, you must still clean up. Use a **cancelled** flag so you don’t assign the channel or call setState after unmount.

**Pattern:**

```tsx
useEffect(() => {
  let cancelled = false
  const channelRefForEffect = { current: null as ReturnType<ReturnType<typeof createClient>['channel']> | null }

  async function setup() {
    const { data: { user } } = await supabase.auth.getUser()
    if (cancelled || !user) return

    const channel = supabase
      .channel(`messages:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (cancelled) return
        setMessages((prev) => [...])
      })
      .subscribe()

    if (cancelled) {
      supabase.removeChannel(channel)
      return
    }
    channelRefForEffect.current = channel
    channelRef.current = channel
  }

  setup()

  return () => {
    cancelled = true
    if (channelRefForEffect.current) {
      supabase.removeChannel(channelRefForEffect.current)
      channelRefForEffect.current = null
      channelRef.current = null
    }
  }
}, [])
```

Here the ref is updated only after the async work and a cancelled check, and cleanup both sets `cancelled = true` and removes the channel if it was ever assigned. Avoid starting the subscription inside a `.then()` without a ref and cancelled flag—otherwise cleanup can run before `.then()` and you’ll never remove the channel.

---

## 4. Handling the current user’s own action (deduplication)

When the user sends a message, you typically:

1. Insert into the DB (e.g. `supabase.from('messages').insert(...)`).
2. Update UI optimistically (append a temporary or real row to local state).

Realtime will then fire an `INSERT` for that same row. If you don’t handle it, you can get a **duplicate** message (optimistic + realtime insert).

**Options:**

**A. Deduplicate by id in the Realtime handler (recommended)**  
Keep the optimistic update; in the Realtime callback, only add the row if it’s not already in state. Use the real row’s `id` once the DB returns it (or use a stable temp id and replace when realtime fires).

```tsx
.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
  const msg = payload.new as MessageRow
  setMessages((prev) => {
    if (prev.some((m) => m.id === msg.id)) return prev
    return [...prev, msg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  })
})
```

So: same thread, same conversation—always merge by `id` and sort by `created_at`. Optimistic message might have a temp id like `temp-${Date.now()}`; when the realtime payload arrives with the real `id`, you can either replace the temp row or drop the duplicate (if you already added an optimistic row with the same content and just need to avoid double-add).

**B. Ignore own sends in the handler**  
If you only want to show messages from others in Realtime, you can skip when the sender is the current user:

```tsx
if (msg.sender_id === currentUser.id) return
```

Then you **must** rely on optimistic update for the sender’s own message; the Realtime event is ignored for them. This is simpler but requires that the optimistic row is correct (e.g. real `id` might come later via a refetch or a second channel event you don’t ignore).

**Recommendation:** Use **A** (dedupe by id) so one code path handles both “message from me” and “message from other”; keep optimistic UI and replace or merge when the real row arrives.

---

## 5. Reconnection when the connection drops

Supabase Realtime (Phoenix channels) **reconnects automatically** when the connection drops. You don’t have to resubscribe manually in most cases.

You can still:

- **Observe status** – `.subscribe((status) => { ... })` gives you status updates (e.g. `SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`). Use this to show “Reconnecting…” or an error state.
- **Resubscribe on error** – If you get `CHANNEL_ERROR` or `CLOSED`, you can call your cleanup and then run the same effect again (e.g. by bumping a “retry” state or relying on a dependency). Often the client will reconnect and the same channel will work again; only resubscribe if you see persistent failures.

**Example: status callback and optional retry**

```tsx
const [realtimeStatus, setRealtimeStatus] = useState<'idle' | 'subscribed' | 'error'>('idle')

// inside useEffect:
const channel = supabase
  .channel(`thread:${threadId}`)
  .on(/* ... */)
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') setRealtimeStatus('subscribed')
    if (status === 'CHANNEL_ERROR' || status === 'CLOSED') setRealtimeStatus('error')
  })
```

Then in UI you can show a banner when `realtimeStatus === 'error'` and optionally a “Retry” button that triggers a resubscribe (e.g. by toggling a key or calling a function that removes the channel and re-runs the effect).

---

## 6. Exact pattern: live-updating message thread

End-to-end pattern for a single thread: load once, subscribe to inserts (and optionally updates for `read_at`), optimistic send, and dedupe.

**Steps:**

1. **Initial load** – In the same or another `useEffect`, fetch messages for the thread (e.g. by `threadId` or participant ids). Set `messages` and `loading = false`. Use the same loading/error pattern as in supabase-patterns.
2. **Subscribe in useEffect** – Channel name or filter should include the thread (e.g. `thread:${threadId}` or filter by `sender_id`/`recipient_id` in the handler). Listen to `postgres_changes` with `event: 'INSERT'` (and optionally `UPDATE` for read receipts).
3. **In the handler** – Dedupe by `id`; merge and sort by `created_at`. Use functional updates: `setMessages((prev) => ...)` so you don’t depend on stale state.
4. **On send** – Insert via Supabase, then optimistically append to `messages` (with temp id or placeholder). Clear input. When the Realtime `INSERT` arrives, dedupe by id so the optimistic row is either replaced or not duplicated.
5. **Cleanup** – Return a function that calls `supabase.removeChannel(channelRef.current)` and sets the ref to `null`.

**Minimal code shape:**

```tsx
const [messages, setMessages] = useState<MessageRow[]>([])
const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
const supabase = createClient()

// 1. Initial load
useEffect(() => {
  let cancelled = false
  async function load() {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${userId})`)
      .order('created_at', { ascending: true })
    if (cancelled) return
    if (!error) setMessages(data ?? [])
  }
  load()
  return () => { cancelled = true }
}, [userId, otherId])

// 2. Realtime subscription with cleanup
useEffect(() => {
  if (!userId || !otherId) return

  const channel = supabase
    .channel(`messages:${userId}:${otherId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        const msg = payload.new as MessageRow
        if (msg.sender_id !== userId && msg.sender_id !== otherId && msg.recipient_id !== userId && msg.recipient_id !== otherId) return
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        })
      }
    )
    .subscribe()

  channelRef.current = channel
  return () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }
}, [userId, otherId])

// 3. Send: insert + optimistic
async function handleSend(content: string) {
  const { data: inserted, error } = await supabase
    .from('messages')
    .insert({ sender_id: userId, recipient_id: otherId, content })
    .select('id, created_at, ...')
    .single()
  if (error) { setSendError(error.message); return }
  setMessages((prev) => {
    const withoutTemp = prev.filter((m) => m.id !== `temp-${pendingId}`)
    return [...withoutTemp, inserted].sort(...)
  })
}
```

For optimistic send without waiting for `.select()`, append a row with a temp id and let the Realtime handler replace or dedupe when the real row arrives (as in section 4).

---

## 7. Checklist

- [ ] Use **client** Supabase only: `createClient()` from `@/lib/supabase/client`.
- [ ] Subscribe inside **one** `useEffect` with the right dependencies (e.g. thread or user ids).
- [ ] Store the channel in a **ref** and **always** clean up: `return () => { supabase.removeChannel(channelRef.current); channelRef.current = null }`.
- [ ] If setup is async, use a **cancelled** flag and assign the channel only after checking `!cancelled`; cleanup sets `cancelled = true` and removes the channel.
- [ ] For live threads: **dedupe by message id** in the Realtime handler so the current user’s own insert doesn’t duplicate the optimistic update.
- [ ] Use **functional state updates** in the Realtime callback: `setMessages((prev) => ...)` to avoid stale closures.
- [ ] Optionally use `.subscribe((status) => ...)` for reconnection UI or retry logic.

---

## 8. Summary: what breaks without correct cleanup

| Issue | Cause |
|-------|--------|
| Duplicate messages / double UI updates | New channel each time effect runs; old channel never removed, so multiple handlers run. |
| "Too many channels" or subscription failures | Orphaned channels accumulate across navigations. |
| Memory growth | Channel and callback references kept alive until `removeChannel`. |
| setState on unmounted component | Realtime callback runs after unmount and calls setState. |
| Wrong thread or stale data | Old callback still running with previous `threadId`/deps. |

Always: **create channel in effect → store in ref → return cleanup that removes channel and nulls ref.**
