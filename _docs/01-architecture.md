# 01 — Architecture (Technical Reference)

This document is the **single source of truth** for technical decisions: tech stack, authentication, data flow, project structure, third-party integrations, and environment variables. Use it when onboarding, refactoring, or planning V2.

---

## 1. Tech Stack

| Layer | Technology | Version / Notes |
|-------|------------|-----------------|
| **Framework** | Next.js | 16.1.6 (App Router only; no Pages Router) |
| **Runtime** | React | 19.2.3 |
| **Database & Auth** | Supabase | `@supabase/supabase-js` ^2.96.0, `@supabase/ssr` ^0.8.0 |
| **Hosting** | Vercel | Recommended deployment target (see README, DEPLOY_CHECKLIST, CLIENT_SETUP) |
| **Payments** | Stripe | ^17.7.0 — Checkout, Connect, webhooks |
| **Rate limiting** | Upstash Redis | `@upstash/ratelimit` ^2.0.8, `@upstash/redis` ^1.36.3 |
| **Styling** | Tailwind CSS | ^4 with `@tailwindcss/postcss` ^4 |
| **UI primitives** | Radix UI (Slot) | `@radix-ui/react-slot` ^1.2.4 |
| **Charts** | Recharts | ^3.7.0 |
| **Animation** | Framer Motion | ^12.34.5 |
| **Drag-and-drop** | @dnd-kit | core ^6.3.1, sortable ^10.0.0, utilities ^3.2.2 |
| **Validation** | Zod | ^4.3.6 |
| **Utilities** | date-fns, clsx, tailwind-merge | date-fns ^4.1.0 |

- **TypeScript**: 5.9.3  
- **Node types**: @types/node ^20, @types/react ^19  

No other backend framework: Next.js API routes and Server Actions are the only server-side surface. Supabase provides Postgres, Auth, Storage, and optional Realtime.

---

## 2. Authentication

### 2.1 Library and flow

- **Provider**: Supabase Auth (`@supabase/supabase-js` + `@supabase/ssr`).
- **Methods**:
  - **Email/password**: `signInWithPassword()` and `signUp()` from the browser client (`lib/supabase.ts`) on the login and set-password pages.
  - **OAuth (e.g. Google)**: `signInWithOAuth({ provider: 'google' })` from the browser client; redirects to Supabase, then back to the app.
- **Code exchange**: After OAuth or magic link, Supabase redirects to `GET /auth/callback` with a `code`. The callback route uses `createServerClient` from `@supabase/ssr` and `exchangeCodeForSession(code)` to establish the session.

### 2.2 Session storage

- **Sessions are stored in HTTP-only cookies**.
- The Supabase SSR helpers (`createServerClient` / `createBrowserClient`) read and write cookies:
  - **Server**: `lib/supabase-server.ts` uses `cookies()` from `next/headers` and passes a `getAll` / `setAll` cookie adapter to `createServerClient`.
  - **Middleware**: `middleware.ts` uses `createServerClientForMiddleware(request, response)` from `lib/supabase-server.ts` so session refresh can happen at the edge.
  - **Browser**: `lib/supabase.ts` uses `createBrowserClient` (from `@supabase/ssr`), which uses the same cookie-based session storage in the browser.
- No separate session store (e.g. Redis) for auth; Supabase issues JWT-based sessions and the SSR package persists them in cookies.

### 2.3 Role and tenant

- **Role**: Stored in `public.profiles` (`role`: `'coach' | 'client'`). After login, layouts and pages call `supabase.auth.getUser()` and optionally `profiles.role` to redirect (e.g. coach → `/coach/dashboard`, client → `/client/dashboard`).
- **Tenant**: `profiles.tenant_id` (TEXT) and deployment-level `getClientId()` (`NEXT_PUBLIC_CLIENT_ID` or `'default'`). The server client syncs `profiles.tenant_id` with `getClientId()` when they differ so RLS sees the correct tenant.

### 2.4 Route protection

- **Middleware** (`middleware.ts`): Protects `/coach/*` and `/client/*`; if there is no session, redirects to `/login?next=...`. Does not redirect `/` when authenticated (role-based redirect is done in `app/page.tsx` and in coach/client layouts).
- **Layouts**: Coach layout and client layout verify `user` and `profile.role`; coach layout redirects non-coaches to `/client/dashboard`, client layout redirects non-clients to `/coach/dashboard`.
- **Rate limits**: Login and forgot-password page loads: 30/min per IP. Auth callback: 15/min per IP. Applied in middleware and in the callback route.

---

## 3. Data flow (database → UI)

### 3.1 Supabase client choice

| Client | File | When to use |
|--------|------|-------------|
| **createBrowserClient** | `lib/supabase.ts` | Client components: realtime, auth state, storage uploads, any call that must run in the browser. |
| **createServerClient** | `lib/supabase-server.ts` | Server components, API routes with user session (cookies), Server Actions. RLS applies; tenant comes from `getClientId()` and profile. |
| **createServiceClient** | `lib/supabase/service.ts` | Admin/webhook-only: invite client, create client account, Stripe webhooks, n8n webhooks. Bypasses RLS; never expose to the client. |

- **Server** `createClient()` in `lib/supabase-server.ts` uses `createServerClient` from `@supabase/ssr` with the request cookie store and, when `getClientId()` is set, syncs the user’s `profiles.tenant_id` so RLS policies see the correct tenant.
- **RLS**: Policies use `auth.uid()` and/or `get_current_client_id()` (which reads from the user’s `profiles.tenant_id`). Tenant isolation is single-tenant-per-deployment via `NEXT_PUBLIC_CLIENT_ID`.

### 3.2 Typical patterns

- **Server Components (e.g. coach dashboard)**: Page is async; calls `createClient()` from `lib/supabase-server`, then `supabase.auth.getUser()` and multiple `supabase.from('...').select(...)` (and optional `revalidatePath` in actions). Data is fetched on the server and passed as props or consumed in the same tree; no client-side data layer.
- **Client Components**: Use `createClient()` from `lib/supabase` for realtime subscriptions, auth state, or user-triggered reads/writes (e.g. messages, schedule, settings forms). Some pages use a server component wrapper that fetches initial data and a client child that does subsequent fetches or mutations.
- **Server Actions**: Import `createClient` from `lib/supabase-server`, call `getUser()`, then perform inserts/updates/deletes; call `revalidatePath()` (or similar) to refresh UI.
- **API routes**: User-context routes use the shared `createClient()` from `lib/supabase-server` (or `createServerClientForMiddleware` in middleware); webhooks use `createServiceClient` and validate external secrets/signatures.

### 3.3 No global state for server data

- No Redux or React Query for server data. Server state is loaded in Server Components or refetched via Server Actions and `revalidatePath`. Client-only state (e.g. form state, selected thread) lives in React state or URL.

---

## 4. Project structure

### 4.1 Router

- **App Router only**. There is no `pages/` directory. All routes live under `app/`.

### 4.2 Key folders

```
app/
  layout.tsx                 # Root layout: font, ThemeProvider, ThemeVariantProvider, brand colors
  page.tsx                   # Home: redirect by role or to /login
  login/, forgot-password/   # Auth pages (client components; use browser Supabase client)
  auth/
    callback/route.ts        # GET: OAuth/code exchange, sets session, redirect by role
    set-password/page.tsx    # Set password (e.g. after invite)
  coach/                     # Coach area
    layout.tsx               # Auth + role check, sidebar, CoachHeader, ClientBrandWrapper
    dashboard/, schedule/, clients/, messages/, programs/, videos/,
    session-packages/, payments/, analytics/, daily-message/, settings/
  client/                    # Client portal
    layout.tsx               # Auth + role check, client nav
    dashboard/, programs/, schedule/, videos/, messages/, settings/
  api/                       # API routes (see 00-current-state.md for full list)
  error.tsx, global-error.tsx

components/                  # Shared UI
  layout/                    # AppLayout, CoachHeader, PageHeader, AnimatedPage, etc.
  providers/                 # ThemeProvider, ThemeVariantProvider, BrandThemeProvider, ClientBrandWrapper
  ui/                        # button, card, input, form, modal, empty-state, skeleton, etc.
  SidebarNav, CoachNav, ClientNav, MobileBottomNav
  chat/                      # MessageThread, MessageBubble
  dashboard/                 # DashboardHero, DashboardKPIStrip

lib/
  supabase.ts                # Browser client (createClient for Client Components)
  supabase-server.ts         # Server client (createClient, createServerClientForMiddleware for edge)
  supabase/                  # service.ts (service role; admin/webhooks only)
  config.ts                  # getClientId(), getClientConfig() (client-config.json + env)
  rate-limit.ts              # Upstash Redis or in-memory rate limiting
  env.ts                     # validateEnv(), validateServiceRoleEnv(), validateStripeEnv()
  branding, brand-resolver   # Brand colors, coach brand from DB
  validations/               # Zod schemas (e.g. invite, create-client)
  api-error, safe-messages   # Error logging and user-safe messages
  notify-session-booked.ts   # Calls n8n when session is booked (optional)

supabase/
  migrations/                # SQL migrations (public schema, RLS, storage, etc.)
  seed.sql                   # Seed data
```

- **Route handlers**: Under `app/**/route.ts` (e.g. `app/auth/callback/route.ts`, `app/api/health/route.ts`).
- **Server Actions**: Colocated in `app/.../actions.ts` (e.g. `app/coach/dashboard/actions.ts`, `app/coach/clients/[id]/actions.ts`).

### 4.3 Conventions

- **Server Components** by default; add `'use client'` only when using hooks, browser APIs, or the browser Supabase client.
- **Dynamic imports**: Used for heavy client components (e.g. `DashboardContent`) with `PageSkeleton` as loading fallback.
- **Coaching-specific components** (e.g. client detail, program detail) live under `app/coach/...` or `app/client/...`; shared layout and UI live under `components/`.

---

## 5. Third-party APIs and integrations

| Integration | Purpose | How it’s used |
|-------------|---------|----------------|
| **Supabase** | Database, Auth, Storage, Realtime | Via `@supabase/supabase-js` and `@supabase/ssr`; RLS for tenant and role isolation. |
| **Stripe** | Payments, Connect | **Checkout**: `POST /api/stripe/create-checkout-session` creates a session; client is redirected to Stripe. **Request payment**: `POST /api/stripe/request-payment` creates a payment link. **Connect**: `GET /api/stripe/connect/account-link` returns an onboarding link for coaches. **Webhook**: `POST /api/webhooks/stripe` receives `checkout.session.completed`, verified by `STRIPE_WEBHOOK_SECRET`; idempotency via `stripe_webhook_events` table; records payments and can create/update sessions. |
| **n8n** | Workflows (session booked, reminders, video ingestion) | **Session booked**: Optional `N8N_SESSION_BOOKED_WEBHOOK_URL`; app calls it from `lib/notify-session-booked.ts` and from session-created webhook when configured. **Send reminder**: `POST /api/sessions/[id]/send-reminder` forwards to `N8N_SESSION_REMINDER_ON_DEMAND_URL`. **Test**: `GET /api/coach/test-n8n` hits `N8N_SESSION_BOOKED_WEBHOOK_URL`. **Video**: `POST /api/webhooks/n8n-video` receives webhook (Bearer or header secret `N8N_VIDEO_WEBHOOK_SECRET`); can use `N8N_DEFAULT_COACH_ID`. **Upcoming sessions**: `GET /api/sessions/upcoming` can be called by n8n with `N8N_SESSION_REMINDER_SECRET` or `N8N_VIDEO_WEBHOOK_SECRET`. |
| **Upstash Redis** | Rate limiting | When `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, `lib/rate-limit.ts` uses `@upstash/ratelimit` and `@upstash/redis`; otherwise in-memory (single-instance only). Used for login, forgot-password, auth callback, invite-client, create-client-account. |
| **Supabase Database Webhook** | Session-created event | Optional. Supabase can call `POST /api/webhooks/session-created` on `sessions` INSERT; auth via `SUPABASE_SESSION_WEBHOOK_SECRET` (query param or Bearer). Used to forward to n8n. |
| **Vercel** | Hosting | Recommended deployment; env vars and redirect URLs documented for Vercel. No Vercel-specific APIs in code; Next.js runs as a standard Node server. |

---

## 6. Environment variables

### 6.1 Organisation and validation

- **Validation**: `lib/env.ts` exposes `validateEnv()` (required server vars), `validateServiceRoleEnv()` (service role), `validateStripeEnv()` (Stripe). Used in API routes so missing vars fail fast.
- **Client vs server**: Only `NEXT_PUBLIC_*` are exposed to the client bundle. Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_*`, `*_SECRET`, etc.) are server-only.
- **Tenant**: `NEXT_PUBLIC_CLIENT_ID` defines the deployment tenant (e.g. `demo`, `coach-jane`); can be overridden or aligned with `client-config.json` via `lib/config.ts` (server reads file; client uses env only).

### 6.2 Reference list

**Required (core)**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public, RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; invite, create-client, webhooks (bypasses RLS) |
| `NEXT_PUBLIC_CLIENT_ID` | Tenant ID for this deployment (e.g. `default`, `demo`) |

**Required for Stripe**

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe API key (Checkout, Connect, payment links) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification for `POST /api/webhooks/stripe` |

**Optional — branding / app**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Base URL for redirects and CORS (middleware; Stripe Connect return URL) |
| `NEXT_PUBLIC_CLIENT_NAME` | Display name (e.g. whitelabel) |
| `NEXT_PUBLIC_BRAND_PRIMARY` | Primary brand color (hex) |
| `NEXT_PUBLIC_BRAND_SECONDARY` | Secondary brand color (hex) |
| `NEXT_PUBLIC_DEMO_MODE` | Set to `true` to show demo credentials on login |

**Optional — rate limiting**

| Variable | Purpose |
|----------|---------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |

**Optional — n8n**

| Variable | Purpose |
|----------|---------|
| `N8N_SESSION_BOOKED_WEBHOOK_URL` | n8n webhook URL for session booked / confirmation |
| `N8N_SESSION_REMINDER_ON_DEMAND_URL` | n8n URL for manual “send reminder” from coach |
| `N8N_SESSION_REMINDER_SECRET` | Bearer secret for `GET /api/sessions/upcoming` (e.g. reminder workflow) |
| `N8N_VIDEO_WEBHOOK_SECRET` | Secret for `POST /api/webhooks/n8n-video` |
| `N8N_DEFAULT_COACH_ID` | Default coach UUID when n8n video webhook omits `coach_id` |

**Optional — Supabase webhook**

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SESSION_WEBHOOK_SECRET` | Auth for `POST /api/webhooks/session-created` (Supabase DB webhook → n8n) |

### 6.3 Where to set them

- **Local**: `.env.local` (not committed; see `.gitignore`).
- **Production / staging**: Host environment (e.g. Vercel Project → Settings → Environment Variables). See `docs/DEPLOY_CHECKLIST.md` and `CLIENT_SETUP.md`.

---

## Summary

- **Stack**: Next.js 16 (App Router), React 19, Supabase (DB + Auth + Storage), Stripe, Upstash (rate limit), Tailwind 4, TypeScript; deployed on Vercel.
- **Auth**: Supabase Auth; sessions in HTTP-only cookies via `@supabase/ssr`; role and tenant from `profiles` and `getClientId()`.
- **Data**: Server Components and Server Actions use `createClient()` from `lib/supabase-server` (RLS + tenant sync); Client Components use `lib/supabase`; webhooks/admin use `createServiceClient()`.
- **Structure**: App Router only; `app/` for routes and route-specific components; `components/` for shared layout and UI; `lib/` for Supabase clients, config, rate limit, validation, and helpers.
- **Integrations**: Stripe (Checkout, Connect, webhook), n8n (session booked, reminder, video, upcoming), Upstash Redis (rate limit), optional Supabase DB webhook.
- **Env**: Required and optional vars listed above; validated in `lib/env.ts`; `NEXT_PUBLIC_*` for client, rest server-only.

This document should be updated whenever the stack, auth model, data flow, folder conventions, or env vars change.
