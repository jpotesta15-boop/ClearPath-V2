# A3 – Performance scan: Supabase & data-fetching audit

This document audits Supabase queries and data-fetching patterns across the project. Each finding is rated **low**, **medium**, or **high** impact and includes a concrete fix.

---

## 1. Full-table scans (SELECT * or unfiltered / unlimited queries)

Queries that fetch an entire table without a `WHERE` clause or `LIMIT` (or equivalent filter) can become slow as data grows.

| Location | Query / behavior | Impact | Fix |
|----------|------------------|--------|-----|
| `app/client/schedule/page.tsx` | `clients.select('*').eq('email', user.email).single()` | **Low** | Keep `.single()`; consider selecting only needed columns, e.g. `select('id, coach_id, client_id, full_name')` to reduce payload. |
| `app/client/dashboard/page.tsx` | `clients.select('*').eq('email', user?.email).single()` | **Low** | Same: restrict to needed columns (e.g. `id, coach_id, client_id, full_name, email`) instead of `*`. |
| `app/client/videos/page.tsx` | `clients.select('*').eq('email', user?.email).single()` | **Low** | Same: select only required columns. |
| `app/client/programs/page.tsx` | `clients.select('*').eq('email', user?.email).single()` | **Low** | Same: select only required columns. |
| `app/coach/clients/[id]/page.tsx` | `clients.select('*').eq('id', id).eq('coach_id', user!.id).single()` | **Low** | Select only columns used on the page (e.g. id, full_name, email, phone, notes, coach_id, client_id) instead of `*`. |
| `app/coach/programs/page.tsx` | `programs.select('*').eq('coach_id', user.id)` | **Low** | Select only needed columns (e.g. `id, name, description, created_at, updated_at`). |
| `app/coach/session-packages/page.tsx` | `session_products.select('*').eq('coach_id', user.id)...` | **Low** | Select only columns needed for list/edit (e.g. id, name, description, goal, duration_minutes, price_cents, max_participants, is_active, created_at). |
| `app/coach/videos/page.tsx` | `videos.select('*').eq('coach_id', user.id).eq('client_id', tenantId)` | **Low** | Select only needed columns (e.g. id, title, description, url, category, thumbnail_url, created_at). |
| `app/coach/payments/page.tsx` | `payments.select('*').eq('coach_id', user.id)...` | **Low** | Select only columns used in the UI (e.g. id, amount_cents, created_at, status, provider, payer_client_id, session_id). |
| `app/coach/daily-message/page.tsx` | `coach_daily_messages.select('*')` (twice) | **Low** | Use explicit columns, e.g. `id, content, effective_at, created_at`. |
| `app/coach/messages/page.tsx` | `clients.select('*').eq('coach_id', user.id)` in `loadClients` | **Low** | Select only columns needed for list/chat (e.g. id, full_name, email). |
| `app/coach/dashboard/page.tsx` | `clients.select('*').eq('coach_id', user!.id)` | **Low** | Select only columns needed for dashboard (e.g. id, full_name). Same for other `.select('*')` in that file where a subset of columns would suffice. |
| `app/coach/schedule/page.tsx` | `availability_slots.select('*')`, `sessions.select('*, clients(*), availability_slots(*)')`, `session_products.select('*')` | **Low** | Prefer explicit column lists for slots and session_products; keep joins only where needed. |
| `app/client/schedule/ClientScheduleContent.tsx` | `clients.select('*')`, `sessions.select('*')`, `session_requests.select('*')`, `client_time_requests.select('*')` | **Low** | When refetching on client, use the same explicit column lists as the server page to avoid over-fetching. |

**Summary:** No true full-table scan without any filter; all queries use at least `eq('coach_id', ...)` or `eq('email', ...)` or `eq('id', ...)`. The main improvement is replacing `select('*')` with explicit column lists to reduce payload size and clarify contracts.

---

## 2. N+1 queries (query inside a loop)

A query executed per item in a list (e.g. per client or per session) causes N+1 round-trips.

| Location | Pattern | Impact | Fix |
|----------|---------|--------|-----|
| **None found** | — | — | No clear N+1 pattern identified. Coach dashboard fetches `recentMessageIds` then does a single batched `profiles.select(...).in('id', recentMessageIds)`. Messages page uses `Promise.all` for profiles + unread messages. Sessions/upcoming API batches coach and client lookups by ID. |

**Recommendation:** When adding new features (e.g. per-row actions), avoid fetching in a `.map()` or `for` loop; batch by ID with `.in('id', ids)` or use joins.

---

## 3. Pages with more than 3 Supabase calls before first render

Pages that make many sequential or parallel Supabase calls before rendering can delay TTFB and increase latency.

| Page / route | # of calls (before render) | Impact | Fix |
|--------------|----------------------------|--------|-----|
| `app/coach/dashboard/page.tsx` | 16 (15 in `Promise.all` + 1 conditional `profiles.in('id', recentMessageIds)`) | **High** | Reduce round-trips: (1) Combine dashboard data into fewer queries where possible (e.g. one RPC or a view that returns aggregated stats). (2) Move non-critical data (e.g. recent messages, daily message) to client fetch or a secondary request after shell render. (3) Consider a single “dashboard payload” server action or route that returns one JSON blob. |
| `app/client/schedule/page.tsx` | 7 (auth + client + 5 in `Promise.all`) | **Medium** | Already parallelized. Optional: serve a minimal shell (e.g. from layout) and load schedule data in one combined query or RPC that returns client + coach timezone + slots + sessions + requests + time requests. |
| `app/client/dashboard/page.tsx` | 7 (auth + client + 5 in `Promise.all`) | **Medium** | Same as above: consider one server-side “dashboard” query or RPC that returns client + sessions + programs + daily message + experience + unpaid requests. |
| `app/coach/clients/[id]/page.tsx` | 9 (auth + client + 7 in `Promise.all`) | **Medium** | Already parallel. Optional: single RPC or view that returns client + sessions + programs + session_requests + counts + last session in one call. |
| `app/api/calendar/feed/route.ts` | 4 (auth + profile + sessions + slots) | **Low** | Keep as-is or combine sessions + slots in one query if feasible. |

**Fix (high-impact):** For coach dashboard, introduce a small set of batched queries or one RPC, e.g. `get_dashboard_data(p_coach_id uuid, p_tenant_id text)` returning JSON with clients, session counts, next session, revenue, unread count, etc., so the page makes 1–2 calls instead of 16.

---

## 4. Large data fetches that should be paginated

Any list that can grow unbounded should be limited or paginated.

| Location | Query / table | Impact | Fix |
|----------|----------------|--------|-----|
| `app/coach/dashboard/page.tsx` | `clients.select('*').eq('coach_id', user!.id)` — all clients | **Medium** | Dashboard likely needs only a count or top N. Use `.select('id', { count: 'exact', head: true })` for count, or `.limit(50)` / paginate if showing a list. |
| `app/coach/dashboard/page.tsx` | `payments.select('amount_cents, created_at').eq(...)` — all payments for revenue | **Medium** | For “revenue so far” you can keep one query but add `.limit(1000)` or a date range to avoid unbounded growth. Prefer aggregating in DB (e.g. `sum(amount_cents)`) via RPC or raw SQL. |
| `app/coach/schedule/page.tsx` | `sessions.select('*, clients(*), availability_slots(*)').eq('coach_id', user.id)` — all sessions | **High** | Sessions grow over time. Add `.limit(200)` or cursor-based pagination by `scheduled_time`, and load more on scroll or “Load more”. |
| `app/coach/schedule/page.tsx` | `availability_slots.select('*').eq('coach_id', user.id)` | **Medium** | Slots can grow. Add `.limit(500)` or paginate by `start_time` (e.g. next 3 months). |
| `app/coach/clients/[id]/page.tsx` | `session_requests` for client — no limit | **Medium** | Add `.limit(50)` (or paginate) so clients with long history don’t slow the page. |
| `app/coach/analytics/page.tsx` | `sessions` and `payments` — all for coach | **Medium** | Already in-memory aggregation. Add date range or `.limit` to sessions/payments to avoid pulling years of data. |
| `app/client/schedule/page.tsx` & `ClientScheduleContent.tsx` | `sessions`, `session_requests`, `client_time_requests` — no limit | **Medium** | Add `.limit(100)` (or similar) per list so heavy users don’t pull huge payloads. |
| `app/coach/messages/page.tsx` | `clients.select('*')` — all clients | **Medium** | Add `.limit(200)` or paginate client list for coaches with many clients. |
| `app/coach/videos/page.tsx` | `videos.select('*')` — all videos | **Medium** | Add `.limit(100)` and “Load more” or pagination. |
| `app/coach/payments/page.tsx` | `payments.select('*')` — all payments | **Medium** | Add `.limit(100)` and pagination or “Load more”. |

**Summary:** Add `.limit(N)` and/or pagination (or DB-side aggregation) for: coach schedule (sessions/slots), coach dashboard (clients/payments), client schedule lists, coach messages (clients), coach videos, coach payments, and client detail session_requests.

---

## 5. Images not using Next.js `Image` component

Using `<img>` instead of `next/image` skips optimization (sizing, format, lazy loading).

| Location | Usage | Impact | Fix |
|----------|--------|--------|-----|
| `app/client/dashboard/page.tsx` | `<img src={clientExperience.hero_image_url} ... />` | **Medium** | Replace with `<Image src={...} alt="..." width={...} height={...} />` (or fill). Use `unoptimized` if URL is external and domain not in `images.domains`. |
| `app/coach/settings/client-experience/page.tsx` | `<img src={heroUrl} ... />` (hero preview) | **Low** | Use `next/image` with appropriate width/height or fill. |
| `app/coach/settings/page.tsx` | `<img src={logoUrl} ... />` (logo preview) | **Low** | Same. |
| `app/coach/settings/branding/page.tsx` | `<img src={logoUrl} ... />` | **Low** | Same. |
| `components/SidebarNav.tsx` | `<img src={logoUrl} ... />` | **Low** | Same; small fixed size, good candidate for `Image`. |
| `app/coach/videos/page.tsx` | `<img src={thumb} ... />` (video thumbnails) | **Medium** | Use `next/image` for thumbnails (e.g. fixed size or fill in aspect box). For external YouTube/Drive URLs, add domains to `next.config.js` or use `unoptimized` if needed. |

**Fix:** Replace each with `<Image>` from `next/image`; set `width`/`height` or `fill` and `sizes` where relevant. Configure `images.remotePatterns` in `next.config.ts` for external image domains (e.g. Supabase storage, YouTube thumbnails).

---

## 6. Client components fetching data that could be server components

Client components that fetch on mount duplicate logic and delay rendering; the same data can often be fetched on the server and passed as props.

| Page / component | Issue | Impact | Fix |
|------------------|--------|--------|-----|
| `app/client/schedule/ClientScheduleContent.tsx` | Fetches client, slots, sessions, requests, time requests on client when `!initialData?.client` (e.g. no cookie). Same data is already fetched on server when user is known. | **Medium** | Keep server page as source of truth; always pass `initialData` when the server has the client. Only use client fetch for “no client” or revalidation after mutations (e.g. after booking). Avoid duplicate full load on client when server already sent data. |
| `app/coach/daily-message/page.tsx` | Entire page is client; fetches coach_daily_messages on mount. | **Medium** | Convert to server page: fetch latest + history in async `page.tsx`, pass as props to a small client component only for the form and realtime updates. |
| `app/coach/programs/page.tsx` | Client page; fetches programs on mount. | **Medium** | Convert to server component: fetch programs in async `page.tsx`, pass to client component for create/edit/delete actions and modal state. |
| `app/coach/session-packages/page.tsx` | Client page; fetches session_products + clients on mount. | **Medium** | Same: server-fetch products + clients, pass as initial data to client component for mutations and UI state. |
| `app/coach/videos/page.tsx` | Client page; fetches videos, clients, programs on mount (and assignments/programs when a video is selected). | **High** | Fetch videos (and optionally clients/programs) on the server; pass as props. Keep client component for selection state, assignments modal, and mutations. |
| `app/coach/payments/page.tsx` | Client page; fetches payments and clients on mount. | **Medium** | Server-fetch initial payments + clients, pass as props; client handles filters and “record payment” flow. |
| `app/coach/schedule/page.tsx` | Full client page; fetches profile, slots, sessions, clients, products, requests, time requests on mount. | **High** | Split: server page fetches initial slots/sessions/clients/products/requests (with limits), passes to client. Client handles calendar UI, booking modals, and mutations. |
| `app/coach/settings/client-experience/page.tsx` | Client; fetches coach_client_experience and profile on mount. | **Medium** | Fetch experience + profile in server page, pass to client form for uploads and updates. |
| `app/coach/settings/page.tsx` | Client; fetches profile on mount. | **Low** | Server-fetch profile, pass to client for form. |
| `app/coach/settings/branding/page.tsx` | Client; fetches brand settings on mount. | **Low** | Server-fetch, pass to client. |
| `app/coach/messages/page.tsx` | Client; fetches clients then messages per client. | **Medium** | Server-fetch clients list (and optionally initial thread for ?client=); pass to client for realtime and sending. |

**Summary:** Prefer server components for initial data; use client components for interactivity, forms, and realtime. This improves TTFB, avoids double loading, and keeps a single source of truth.

---

## 7. Missing database indexes

Columns used in `WHERE` or `ORDER BY` should be indexed (or part of a composite index) to avoid full table scans. Schema from `02-database-schema.md` and migrations was used.

| Table | Column(s) used in app | Current indexes | Gap | Impact | Fix |
|-------|------------------------|-----------------|-----|--------|-----|
| `availability_slots` | `coach_id`, `start_time` (WHERE/ORDER) | `idx_availability_slots_client_id`, `idx_availability_slots_session_product` | No index on `coach_id`; `start_time` used in range + order | **High** | Add: `CREATE INDEX idx_availability_slots_coach_start ON availability_slots(coach_id, start_time);` |
| `programs` | `coach_id` (WHERE), `created_at` (ORDER) | `idx_programs_client_id` (tenant only) | No index on `coach_id` | **Medium** | Add: `CREATE INDEX idx_programs_coach_id ON programs(coach_id);` or composite `(coach_id, created_at)` for list order. |
| `videos` | `coach_id`, `client_id` (tenant), `created_at` (ORDER) | `idx_videos_client_id` (tenant) | No index on `coach_id` | **Medium** | Add: `CREATE INDEX idx_videos_coach_id ON videos(coach_id);` or `(coach_id, created_at)`. |
| `messages` | `recipient_id`, `read_at` (WHERE for unread count) | `idx_messages_recipient`, `idx_messages_sender` | No composite for unread (recipient + read_at) | **Medium** | Add: `CREATE INDEX idx_messages_recipient_read_at ON messages(recipient_id, read_at);` (partial: `WHERE read_at IS NULL` if only unread is hot). |
| `coach_daily_messages` | `coach_id`, `client_id`, `effective_at`, `created_at` (WHERE/ORDER) | `idx_coach_daily_messages_coach_client` on `(coach_id, client_id, effective_at)` | Order by `created_at` not in index | **Low** | Add composite: `(coach_id, client_id, created_at DESC)` for “latest by created_at” queries, or rely on existing index if effective_at is primary. |
| `coach_client_experience` | `coach_id`, `tenant_id` (WHERE) | `idx_coach_client_experience_tenant` | Queries filter by both; tenant-only index less ideal | **Low** | Add: `CREATE INDEX idx_coach_client_experience_coach_tenant ON coach_client_experience(coach_id, tenant_id);` |

**Summary:** Add indexes for: `availability_slots(coach_id, start_time)`, `programs(coach_id)`, `videos(coach_id)`, `messages(recipient_id, read_at)`, and optionally coach_client_experience and coach_daily_messages as above.

---

## Summary table

| Category | Count | Priority |
|----------|-------|----------|
| Full-table / select * | 14 (all low; use explicit columns) | Low |
| N+1 | 0 | — |
| >3 calls before render | 5 pages (1 high, 3 medium, 1 low) | High for coach dashboard |
| Pagination / limits | 9 areas | Medium–High |
| Images not Next/Image | 6 | Low–Medium |
| Client fetch → server | 11 pages/components | Medium–High |
| Missing indexes | 6 | Medium–High |

**Recommended order of work:** (1) Coach dashboard: reduce to 1–2 data calls or RPC. (2) Add pagination/limits for sessions, slots, payments, videos, clients. (3) Add missing indexes (availability_slots, programs, videos, messages). (4) Convert heavy client-fetched pages (schedule, videos, programs, session-packages, payments) to server data + client UI. (5) Replace `select('*')` with explicit columns. (6) Swap `<img>` for `next/image` where beneficial.
