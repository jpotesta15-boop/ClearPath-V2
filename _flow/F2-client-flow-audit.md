# F2 Client Flow Audit

This document traces each **client** user journey through the actual codebase: pages visited, API calls, data saved, and flags broken steps, missing screens, and poor experience. Friction score: 1–10 (10 = completely smooth). Special attention is given to the first 5 minutes a new client spends in the app.

---

## Journey 1: Client receives invite email → clicks link → sets up password → first screen

### Code trace

| Step | Location | What happens |
|------|----------|--------------|
| Invite email | `app/api/invite-client/route.ts` | Coach calls `inviteUserByEmail` with `redirectTo: origin + '/auth/set-password'`. Client receives Supabase invite email; link points to `{origin}/auth/set-password` (token in hash after redirect). |
| Click link | — | Client opens link in browser; lands on `/auth/set-password` with hash (e.g. `#access_token=...`). |
| Set-password page | `app/auth/set-password/page.tsx` | **If no session and no hash:** redirect to `/login`. **If hash:** wait 300ms, re-check session (Supabase client parses hash and establishes session). **If session:** show form. Form: New password, Confirm password, min 6 chars; submit calls `supabase.auth.updateUser({ password })`. |
| After set password | Same file L65–79 | Fetches `profiles.role`; redirects to `/coach/dashboard` or `/client/dashboard`. Client goes to `/client/dashboard`. |
| Client layout | `app/client/layout.tsx` | Runs before dashboard: auth check, profile tenant_id sync, coach redirect; loads client by `clients.email = user.email`. If no client row, layout still renders (no redirect). |
| First screen | `app/client/dashboard/page.tsx` | **If no client record:** Renders inline error: "No client record for this account", "Your coach needs to add you as a client with this exact email", "Create login" — and "Back to login". **If client exists:** PageHeader "Home", "Welcome back, {full_name}"; optional welcome card from `coach_client_experience` (title, body, hero image, intro video); balance owed card if any; then conditional content. |
| First-screen content | Same file L88–91, L168–188 | `hasContent = (upcomingSessions.length) \|\| (programs.length) \|\| dailyMessage`. **If !hasContent:** Single card: "To get started, tell your coach when you're free" with "Go to Schedule" and "Messages" link. Then two cards: **Upcoming Sessions** (empty state + "Go to Schedule") and **My Programs** (empty state + "View programs"). |

### Broken steps / gaps

- **No client record after invite:** If the coach sent an invite but the client row was created with a different email (or not yet created), the client lands on dashboard and sees "No client record for this account". This is confusing right after setting a password — they have an account but the app says the coach must add them. The invite flow creates the auth user; the coach must have already added the client row (with matching email) when sending the invite. If coach adds client then invites, order is correct; if invite is sent without a client row, the client hits this dead end.
- **First screen is not onboarding:** There is no "Welcome! Here’s your first step" or guided first-time flow. A new client with no sessions, no programs, and no daily message sees a generic "tell your coach when you're free" card and two empty-state cards. The welcome block (from coach_client_experience) helps only if the coach configured it; many new clients will see a dashboard that doesn’t clearly say "do this first."
- **Program names on dashboard are not links:** "My Programs" lists program names and descriptions but they are not clickable. There is no `/client/programs/[id]` route — client must go to Programs and see the same list there. No deep link from dashboard into a specific program.
- **Set-password without hash:** If a client bookmarks `/auth/set-password` or loses the hash, they are sent to login. No message like "Use the link from your invite email."

### Friction score: **5/10**

### Specific fixes

1. **First 5 minutes:** Add an explicit "New here?" or first-login state (e.g. from `profiles` or a `client_first_login_at`): show a short onboarding card ("Your dashboard — here you’ll see sessions, programs, and messages from your coach") with one primary CTA (e.g. "Go to Schedule" or "View Programs") before or above the rest of the dashboard.
2. Make "My Programs" on the dashboard link each program to `/client/programs` (or future `/client/programs/[id]`) so the first action is obvious.
3. When no client record is found, add: "If you just set your password, your coach may still be adding you. Try again in a few minutes or contact them."
4. On set-password page, if there is no hash and no session, show a short message: "Use the link from your invite email to set your password," then redirect to login.
5. Consider a "Welcome" modal or banner on first dashboard load (dismissible, stored in profile or localStorage) that explains the three areas: Schedule, Programs, Messages.

---

## Journey 2: Client logs in → views assigned program → watches video → marks task complete → coach sees progress

### Code trace

| Step | Location | What happens |
|------|----------|--------------|
| Login | `app/login/page.tsx` L75–102 | `signInWithPassword`; then fetch `profiles.role`; `router.push('/client/dashboard')`. |
| View programs | `app/client/programs/page.tsx` | Server: loads `program_assignments` + `programs`, `program_lessons` for assigned program IDs. Renders list of programs; each program shows **Lessons** as a flat list (video, link, note, image). **Video lessons:** link to `/client/videos` (text link only — no in-program viewer). No `/client/programs/[id]` route in codebase. |
| Watch video | `app/client/videos/page.tsx` + `ClientVideosContent.tsx` | Server loads `video_assignments` and `video_completions` for client. Client sees grid of assigned videos; click opens a **modal** with embed (or "Open in new tab" if URL not embeddable). |
| Mark complete | `ClientVideosContent.tsx` L34–43 | "Mark done" button in modal (and "Done" badge on card). `supabase.from('video_completions').upsert({ client_id, video_id }, { onConflict: 'client_id,video_id' })`. |
| Task complete | — | **V1 has no task blocks.** Schema and docs (08-program-builder, A2-data-model-gaps) describe `client_task_completions` for V2; there is no `client_task_completions` table or UI in the client app. Programs only have lesson types: video, link, note, image. So "mark a task complete" **does not exist** in the client journey — only "Mark done" for videos. |
| Coach sees progress | `app/coach/clients/[id]/page.tsx` L66, `app/coach/programs/[id]/ProgramDetailClient.tsx` L204 | Client detail page loads `video_completions` count for the client. Program detail "Who has access" shows "X/Y videos done" per client (from `video_completions` for that client and program’s lesson video_ids). **Coach does see video completion progress.** No task progress (no task blocks in V1). |

### Broken steps / gaps

- **No program detail view for client:** Client cannot open "Program X" and see a single program with modules/lessons in one view. They see a list on `/client/programs`; video lessons are links to `/client/videos`, so watching a "program video" means leaving the program list and finding the same video in the library. Flow is fragmented.
- **Videos vs programs disconnect:** From Programs, "Video" lessons link to `/client/videos` with no context (e.g. "Part 2 of Program Y"). Client may not know which video belongs to which program when on the Videos page.
- **Task completion not implemented:** User flow doc (12-user-flows) describes completing a task (checklist) in a program. The codebase has no task/checklist blocks and no `client_task_completions`. Journey should be described as "marks **video** complete"; any "task" completion is V2-only.
- **Coach sees video progress only:** Coach sees "X/Y videos done" on program and client detail. No task or module completion to show.

### Friction score: **5/10**

### Specific fixes

1. Add a client program detail view (e.g. `/client/programs/[id]`) that shows one program’s lessons in order, with inline video player or clear "Watch on Videos page" with program context (e.g. "Program: Getting Started — Video 2").
2. On `/client/videos`, show which program(s) each video is part of (e.g. badge or subtitle "From: Program name") when the video appears in program lessons.
3. For the documented "task complete" journey: either implement task blocks + `client_task_completions` (V2) or update docs to say only video completion exists in V1.
4. From Programs list, make video lessons open the Videos page with a query/hash (e.g. `?video=id`) and optionally auto-open that video modal so the flow is "click video in program → watch → mark done" without hunting in the library.

---

## Journey 3: Client messages coach → how long before they see a reply → notifications

### Code trace

| Step | Location | What happens |
|------|----------|--------------|
| Client sends message | `app/client/messages/page.tsx` L183–206 | Form submit: `supabase.from('messages').insert({ sender_id: user.id, recipient_id: coach.id, content })`. Message appears in thread optimistically; `loadData()` refetches. |
| Realtime (client) | Same file L35–63 | Subscription: `postgres_changes` on `messages` INSERT. Filter: `sender_id === coach.id \|\| recipient_id === coach.id`. On new row: append to state (sorted by created_at). If `msg.recipient_id === currentUser.id`, call `updateUnreadBadge(user.id)`. |
| When client sees reply | — | **If client is on Messages page:** New message appears in thread immediately via Realtime. **If client is on another page:** Realtime still fires; `updateUnreadBadge` runs (counts unread, dispatches `clearpath:unread-messages-updated` with `totalUnread`). |
| Unread badge (client) | `app/client/layout.tsx`, `components/SidebarNav.tsx`, `components/MobileBottomNav.tsx` | **Client layout does not pass initial unread count** to nav. Nav items come from layout with no `badgeCount`. SidebarNav subscribes to Realtime INSERT/UPDATE on `messages`; when `payload.new.recipient_id === user.id` it calls `clearMessagesBadge()` which dispatches `clearpath:unread-messages-updated` **with no detail**. The event handler in SidebarNav (L131–137) sets **badgeCount to 0** for Messages. So when a new message arrives for the current user, the app **clears** the badge instead of showing "1". Client never sees an unread count on the Messages nav item. |
| Notifications | `05-messaging.md` | "No push/email/SMS for new messages." Confirmed: no email, no push, no in-app badge for client when coach replies (unless client is on Messages page and sees the new bubble). |

### Broken steps / gaps

- **Reply visibility:** When the client is on the Messages page, they see the reply in real time (Realtime). When they are on any other page, they do not see a badge or notification — and the current Realtime handler incorrectly clears the badge.
- **No initial unread count:** Client layout never fetches "messages where recipient_id = me and read_at IS NULL"; the sidebar/bottom nav never get an initial badge. Only the coach messages page fetches unread and dispatches; client has no equivalent on layout or dashboard.
- **No email/push:** If the client closes the app, they have no way to know the coach replied until they open the app and go to Messages.

### Friction score: **4/10**

### Specific fixes

1. **Unread badge for client:** In client layout (or a client wrapper), fetch count of messages where `recipient_id = current user` and `read_at IS NULL`; pass as `badgeCount` for the Messages nav item. Ensure SidebarNav and MobileBottomNav display this initial value.
2. **Realtime when new message arrives:** When Realtime fires for a new message with `recipient_id === user.id`, **increment or set** the Messages badge (e.g. fetch count and dispatch `clearpath:unread-messages-updated` with `detail: { totalUnread }`), instead of dispatching with no detail (which currently sets badge to 0).
3. **Mark read and clear badge:** When the client opens the Messages page, keep existing behavior: mark messages read and dispatch so badge clears. Ensure the event detail for "clear" (e.g. totalUnread: 0) is used to set badge to 0, and the "new message" path sets badge to the actual count.
4. **Optional (V2):** Email or push when coach sends a message (e.g. "Your coach replied") so clients who are not in the app get notified.

---

## Journey 4: Client views upcoming sessions → calendar look → add to phone calendar

### Code trace

| Step | Location | What happens |
|------|----------|--------------|
| Dashboard | `app/client/dashboard/page.tsx` L46–55, L213–242 | Upcoming sessions: `sessions` where `client_id`, `status = 'confirmed'`, `scheduled_time >= now`, order ascending, limit 5. Shown in "Upcoming Sessions" card as list (date/time, status badge). No calendar grid. |
| Schedule page | `app/client/schedule/ClientScheduleContent.tsx` | **List-only UI:** (1) "Request a session" (textarea + "Send request"), (2) "Session offers" (accept/decline, pay, submit availability), (3) "Available slots to book" (list of slots with "Book & pay" / "Request session"), (4) "My Sessions" (list of sessions with date, time, status, "Request cancel"). Times formatted with `formatInTz(session.scheduled_time)` using coach timezone or client’s `Intl` default. **No month or week calendar view** — only lists. |
| Add to calendar | `app/api/calendar/feed/route.ts` | `GET /api/calendar/feed`: checks `profile.role === 'coach'`; **returns 403 Forbidden for clients**. Returns iCal (`text/calendar`) for coach’s sessions and availability. **No client-facing calendar feed.** Docs (06-calendar-scheduling, 09-api-routes, 13-v2-roadmap) describe a client iCal feed as V2. |

### Broken steps / gaps

- **No calendar view:** Client never sees a month or week grid. They see lists: "My Sessions", "Session offers", "Available slots". That’s fine for clarity but doesn’t match the phrase "what does the calendar look like" — there is no calendar UI.
- **Cannot add to phone calendar:** There is no "Add to Google Calendar" or "Subscribe" or ".ics download" for the client. The only iCal feed is coach-only. Clients cannot add sessions to their phone or Google Calendar from the app.

### Friction score: **5/10**

### Specific fixes

1. Add a client iCal feed: e.g. `GET /api/calendar/feed/client` (or same route with role check: if client, return only that client’s sessions). Return `text/calendar` with VEVENTs for confirmed/upcoming sessions. Document the URL so clients can subscribe in Google Calendar or Apple Calendar.
2. On client Schedule page, add a clear CTA: "Add to your calendar" linking to the feed URL or a one-click "Copy subscription link" / "Download .ics" so clients can add sessions to their phone.
3. Optional: Add a simple month or week calendar view on the client Schedule page (read-only) showing "My Sessions" in a grid so the "calendar" is visible in-app as well as exportable.

---

## Journey 5: Client on phone — is the experience mobile-friendly?

### Code trace

| Area | Location | What happens |
|------|----------|--------------|
| Layout | `app/client/layout.tsx` | Renders `SidebarNav` + `AppLayout` + `MobileBottomNav`. No conditional by viewport for layout structure. |
| Sidebar | `components/SidebarNav.tsx` L262 | Sidebar class: `hidden md:flex` — **sidebar is hidden below `md`**. On phones and small tablets only the bottom nav is visible. |
| Bottom nav | `components/MobileBottomNav.tsx` L151, L159 | Visible with `md:hidden`; shows items where `primaryLabels.has(item.label)`. For client: `primaryLabels = {"Home", "Programs", "Schedule", "Messages", "Settings"}`. **"Videos" is not in the set** — so on mobile the client has **no link to Videos** in the bottom nav. The only way to reach `/client/videos` on mobile would be the sidebar, which is hidden. So **client cannot reach Videos from mobile nav.** |
| Main content | `components/layout/AppLayout.tsx` | `pb-24 lg:py-10` — extra bottom padding on small screens for the fixed bottom nav. `px-4 sm:px-6 lg:px-8` — responsive padding. |
| Pages | Client pages | Use responsive classes (e.g. `grid-cols-1 md:grid-cols-2`, `flex-col md:flex-row`). Modals (e.g. video modal, availability modal) use `p-4`, `max-h-[90vh]` and are scrollable. No obvious desktop-only assumptions. |
| Touch / UX | — | Buttons and links are standard size. No explicit touch-target audit. Message thread has `max-h-[420px]` and overflow-y-auto — usable on phone. |

### Broken steps / gaps

- **Videos inaccessible on mobile:** The client bottom nav shows Home, Programs, Schedule, Messages, Settings. **Videos is missing.** So a client on a phone cannot navigate to "My Videos" unless they have a direct URL or a link from somewhere (e.g. from Programs, video lessons link to `/client/videos` — so they can get there by clicking a program video link, but there is no nav item). If they leave the Videos page, they cannot get back via the bottom nav.
- **No "More" or overflow menu:** There is no way on mobile to access items not in the bottom nav (e.g. Videos). Either add Videos to the client’s primary set for MobileBottomNav or add a "More" item that expands to Videos (and any other secondary items).

### Friction score: **5/10**

### Specific fixes

1. **Videos on mobile:** Add "Videos" to the client’s `primaryLabels` in `MobileBottomNav.tsx` (e.g. `new Set(["Home", "Programs", "Schedule", "Videos", "Messages", "Settings"])`). If that makes the bar too crowded, add a "More" tab that reveals Videos (and optionally other links) so the client can always reach Videos from the phone.
2. Ensure all client primary actions (Home, Programs, Schedule, Videos, Messages, Settings) are reachable in at most two taps on mobile (either in bottom nav or in one "More" menu).
3. Optional: Audit touch targets (min 44px) and font sizes on client pages for small screens.

---

## Journey 6: Client has no assigned program yet — what do they see?

### Code trace

| Step | Location | What happens |
|------|----------|--------------|
| Dashboard | `app/client/dashboard/page.tsx` L46–55, L88–91, L252–268 | `programs` from `program_assignments` + `programs`; if empty, `hasContent` can still be true if there are upcoming sessions or a daily message. **If no programs and no sessions and no daily message:** Shows the single card "To get started, tell your coach when you're free" (Schedule + Messages). Then the two-column section: **Upcoming Sessions** (empty state: "No upcoming sessions", "Go to Schedule") and **My Programs** (empty state: "No programs assigned", "Your coach will assign programs here. Check back later.", action "View programs"). So **not a blank screen** — clear empty states with CTAs. |
| Programs page | `app/client/programs/page.tsx` L162–167 | If `assignments.length === 0`: `<EmptyState title="No programs assigned yet" description="Your coach will assign programs here." action={{ label: "Back to dashboard", href: "/client/dashboard" }} />`. Clear and helpful. |

### Broken steps / gaps

- **Dashboard empty state is generic:** When there are no programs (and no sessions, no daily message), the main card says "tell your coach when you're free" — which is schedule-focused. It doesn’t say "You don’t have any programs yet; your coach will add them when ready." The "My Programs" card does say "No programs assigned" and "Check back later", which is good. So the experience is acceptable but could be slightly clearer that "no program yet" is expected and what to do (e.g. message coach or wait).
- **Videos page with no assignments:** If client has no video_assignments, `ClientVideosContent` shows EmptyState "No videos assigned yet", "Your coach will assign videos here." — good.

### Friction score: **8/10**

### Specific fixes

1. When the client has no programs, consider a small line in the dashboard empty card: "No programs or sessions yet? Your coach may still be setting things up — you can message them or check back later."
2. Optional: On first load with zero programs, show a one-time tip: "Programs will appear here when your coach assigns them. You can still use Schedule and Messages."

---

## Summary table

| Journey | Friction (1–10) | Main issues |
|---------|-----------------|------------|
| 1. Invite → set password → first screen | 5 | No client record edge case confusing; no first-time onboarding; program names on dashboard not links; set-password without hash sends to login with no explanation. |
| 2. Login → program → video → task → coach sees | 5 | No client program detail page; video lessons only link to Videos (fragmented); no task completion in V1 (only video "Mark done"); coach sees video progress only. |
| 3. Client messages coach → reply → notifications | 4 | Reply visible in real time only if on Messages page; unread badge broken (cleared instead of set); no initial unread count for client; no email/push. |
| 4. Client views sessions → calendar → add to phone | 5 | List-only UI (no calendar grid); no client iCal feed — cannot add sessions to phone/Google Calendar. |
| 5. Client on phone — mobile-friendly | 5 | Videos not in bottom nav — client cannot reach Videos on mobile without a direct link. |
| 6. No program assigned — empty state | 8 | Helpful empty states on dashboard and Programs; minor copy improvement possible. |

---

## First 5 minutes: what determines whether they come back

1. **Landing after set password:** They must see a clear "you’re in" and one obvious next step. Right now they see a generic dashboard; if the coach set a welcome block it helps, but many will see empty sections and a generic "tell your coach when you're free." **Add a short first-time onboarding or welcome CTA.**
2. **No client record:** If they hit "No client record" right after setting a password, they may think the app is broken. **Soften the copy and suggest waiting or contacting the coach.**
3. **Finding something to do:** The first concrete action (Schedule vs Messages vs Programs) should be obvious. **One primary "Get started" or "Next step" CTA** (e.g. "Go to Schedule" or "Message your coach") would reduce confusion.
4. **Mobile:** If they’re on a phone and try to find "Videos" or "Programs," they must be able to reach them from the bottom nav. **Fix Videos missing from client mobile nav.**

---

## Document info

- **Audit date:** 2025-03-15  
- **Scope:** Client user journeys only; code traced in `app/client/`, `app/auth/set-password/`, `app/login/`, `app/api/invite-client/`, `app/api/calendar/feed/`, `components/MobileBottomNav.tsx`, `components/SidebarNav.tsx`, and related layouts.  
- **References:** `12-user-flows.md`, `05-messaging.md`, `06-calendar-scheduling.md`, `08-program-builder.md`, `F1-coach-flow-audit.md`, `A5-v1-honest-summary.md`.
