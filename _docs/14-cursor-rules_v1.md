# ClearPath — Cursor Rules

This file is the single source of rules for Cursor in this project. It is also copied to the project root as `.cursorrules` so Cursor reads it automatically in every session. Follow these rules for all new and modified code.

---

## 1. Tech stack and library usage

### 1.1 Stack (do not substitute)

- **Framework:** Next.js 16 (App Router only; no Pages Router).
- **Runtime:** React 19.
- **Database & Auth:** Supabase (`@supabase/supabase-js`, `@supabase/ssr`).
- **Styling:** Tailwind CSS 4 with `@tailwindcss/postcss`.
- **UI primitives:** Radix UI (e.g. `@radix-ui/react-slot`).
- **Charts:** Recharts.
- **Animation:** Framer Motion.
- **Drag-and-drop:** @dnd-kit (core, sortable, utilities).
- **Validation:** Zod.
- **Utilities:** date-fns, clsx, tailwind-merge.

### 1.2 Supabase client — always use project clients, never create new ones

- **Server (pages, Server Actions, API routes with user session):** Always use `createClient()` from `@/lib/supabase/server`. Never instantiate `createServerClient` from `@supabase/ssr` directly in app or API code; the server helper handles cookies and tenant sync for RLS.
- **Browser (Client Components):** Always use `createClient()` from `@/lib/supabase/client`. Never create a new Supabase client in client code.
- **Webhooks / admin / bypass RLS:** Use `createServiceClient()` from `@/lib/supabase/service`. Never use the service client in code exposed to the browser.

Summary:

| Context | Import from | Use for |
|--------|-------------|---------|
| Server (user session) | `@/lib/supabase/server` | Pages, Server Actions, API routes with cookies |
| Client (browser) | `@/lib/supabase/client` | Client Components, realtime, auth state, storage |
| Server (no user / webhook) | `@/lib/supabase/service` | Webhooks, invite, create-client, health check |

### 1.3 Other libraries

- **Config / tenant:** Use `getClientId()` and `getClientConfig()` from `@/lib/config`. Do not read `process.env.NEXT_PUBLIC_CLIENT_ID` directly in shared code.
- **Env validation:** Use `validateEnv()`, `validateServiceRoleEnv()`, or `validateStripeEnv()` from `@/lib/env` in API routes that need them.
- **Rate limiting:** Use helpers from `@/lib/rate-limit` for login, forgot-password, auth callback, invite-client, create-client-account.
- **Errors:** Use `logServerError()` and `getSafeMessage()` from `@/lib/api-error` for API and server-side errors. Use `getSafeAuthMessage()` or constants from `@/lib/safe-messages` for auth UI.
- **Validation:** Use Zod schemas from `@/lib/validations` where they exist; add new schemas there for new API bodies or actions.

---

## 2. Folder structure

### 2.1 Where things go

- **Pages and route handlers:** Under `app/`. One `page.tsx` or `route.ts` per route. No `pages/` directory.
- **App Router routes:** `app/**/page.tsx` for pages; `app/**/route.ts` for API and auth handlers (e.g. `app/auth/callback/route.ts`, `app/api/health/route.ts`).
- **Server Actions:** Colocated in `app/.../actions.ts` (e.g. `app/coach/dashboard/actions.ts`, `app/coach/clients/[id]/actions.ts`).
- **Shared UI components:** Under `components/` — `components/layout/`, `components/ui/`, `components/providers/`, `components/chat/`, `components/dashboard/`.
- **Page-specific components:** Under the page’s segment, e.g. `app/coach/clients/[id]/ClientProfileDetails.tsx`, `app/coach/dashboard/DashboardContent.tsx`.
- **API routes:** Under `app/api/` only (e.g. `app/api/health/route.ts`, `app/api/stripe/create-checkout-session/route.ts`). No routes under `pages/api/`.
- **Utilities and shared logic:** Under `lib/` — Supabase clients in `lib/supabase/`, config in `lib/config.ts`, env in `lib/env.ts`, rate limit in `lib/rate-limit.ts`, validations in `lib/validations/`, error/safe-messages in `lib/api-error.ts` and `lib/safe-messages.ts`.
- **Migrations:** Under `supabase/migrations/`. Seed data: `supabase/seed.sql`.

### 2.2 Conventions

- Prefer **Server Components** by default; add `'use client'` only when using hooks, browser APIs, or the browser Supabase client.
- Use **dynamic imports** for heavy client components with `PageSkeleton` (or appropriate skeleton) as the loading fallback.
- Coach-only UI and components live under `app/coach/...`; client-portal under `app/client/...`. Shared layout and UI live under `components/`.

---

## 3. Naming conventions

### 3.1 Files and components

- **Components:** PascalCase (e.g. `ClientProfileDetails.tsx`, `PageHeader.tsx`).
- **Utilities / lib:** camelCase for file names (e.g. `api-error.ts`, `rate-limit.ts`, `safe-messages.ts`).
- **Route segments:** lowercase, kebab if multi-word (e.g. `forgot-password`, `client-experience`).
- **API route folders:** Match path segment (e.g. `app/api/sessions/[id]/send-reminder/route.ts`).

### 3.2 Functions and variables

- **Functions:** camelCase. React components are PascalCase.
- **Constants:** UPPER_SNAKE for true constants (e.g. `SAFE_MESSAGES`), camelCase for config objects.
- **Types/Interfaces:** PascalCase (e.g. `ChatMessage`, `SessionOfferData`).

### 3.3 Database (Supabase / Postgres)

- **Tables:** `snake_case` (e.g. `program_assignments`, `session_requests`, `coach_client_experience`).
- **Columns:** `snake_case` (e.g. `scheduled_time`, `stripe_connect_account_id`).
- **Tenant column:** Many tables use a column named `client_id` (TEXT) for the tenant identifier; elsewhere `client_id` (UUID) is FK to `clients`. Where ambiguous, docs use “tenant_id” for tenant and “client_id (UUID)” for the client row. Do not rename existing columns without a migration and doc update.
- **RLS / DB functions:** `get_current_client_id()` returns the tenant for RLS; use as documented in `02-database-schema.md`.

---

## 4. Code patterns to follow

### 4.1 Loading states

- **Full-page loading:** Use `PageSkeleton` from `@/components/ui/PageSkeleton` (e.g. in dynamic import `loading` or while data is loading). Use `variant` and `showHeader`/`cardCount` as needed.
- **Section-level loading:** Use `SectionShell` from `@/components/ui/SectionShell` with `state="loading"` and optional `skeletonVariant` ('hero' | 'kpi' | 'list' | 'chart').
- **Inline skeletons:** Use `SkeletonCard` or primitives from `@/components/ui/skeleton` where appropriate. Prefer existing patterns in `10-components.md` and `00-current-state.md`.

### 4.2 Error states

- **API routes:** Log with `logServerError(tag, err, context)` from `@/lib/api-error`. Return JSON with safe messages only; use `getSafeMessage(status, override)` for response bodies. Never expose stack traces or raw DB/auth errors to the client.
- **Server Actions:** On catch, use `sanitizeActionError(err, allowedMessage)` from `@/lib/api-error` and return the resulting string (or set it in state) for the UI. Log server-side only.
- **Auth UI (login, forgot-password, set-password):** Use `getSafeAuthMessage(context)` or constants from `@/lib/safe-messages`; display via `FormError` or equivalent. No global toast; errors are inline per flow.
- **Empty states:** Use `EmptyState` from `@/components/ui/empty-state` with title, optional description and action (href or onClick).

### 4.3 Auth and route protection

- **Middleware:** Already protects `/coach/*` and `/client/*` (redirect to `/login` if no session). Do not duplicate session checks in middleware for those paths.
- **Layouts:** Coach layout enforces `profile?.role === 'coach'` (redirect non-coach to `/client/dashboard`). Client layout enforces client role (redirect coach to `/coach/dashboard`). New protected pages must live under the correct segment so these layouts apply.
- **API routes that require a user:** Use `createClient()` from `@/lib/supabase/server`, then `supabase.auth.getUser()`. If coach-only or client-only, fetch `profiles` and check `role`; return 401/403 with safe messages as needed.
- **Webhooks:** Authenticate via signature or shared secret (e.g. Stripe signature, Bearer/header for n8n). Do not rely on user cookies for webhooks.

### 4.4 Forms and validation

- Use **Zod** for request body and action input. Define schemas in `lib/validations/` when reusable.
- Use **FormField, FormLabel, FormError** from `@/components/ui/form` for auth and other forms. Use **Input, Textarea, Button** from `@/components/ui` consistently.

---

## 5. Things to never do

- **Do not hardcode secrets** (API keys, service role key, webhook secrets, tokens). Use environment variables and validate with `lib/env.ts` where appropriate. Only `NEXT_PUBLIC_*` are safe in client bundle.
- **Do not use inline styles** for layout or theming. Use Tailwind classes and existing design tokens (e.g. `--cp-brand-primary`). Use `className` and shared components.
- **Do not create a new Supabase client** outside the three project clients: `createClient()` from `lib/supabase/server`, `createClient()` from `lib/supabase/client`, `createServiceClient()` from `lib/supabase/service`. Do not call `createServerClient` or `createBrowserClient` from `@supabase/ssr` directly in app/API code except in middleware and auth callback where the project explicitly does so for cookie handling.
- **Do not expose raw server/auth/database errors** to the client. Use `getSafeMessage()`, `getSafeAuthMessage()`, or `sanitizeActionError()` and log the real error server-side only.
- **Do not add API routes under `pages/api/`.** All API routes live under `app/api/`.
- **Do not add a global toast or global error banner** without aligning with the project’s “inline per flow” error approach (see `00-current-state.md` and `ERROR_HANDLING_AUDIT.md` if present).
- **Do not skip auth or role checks** on protected API routes or pages. Always verify user and role when the route is coach-only or client-only.
- **Do not use the service role client** in any code path that can be triggered by or exposed to the browser (e.g. Server Components that render for end users). Reserve it for API routes that are explicitly webhook/admin (e.g. Stripe webhook, invite-client, create-client-account, health check).

---

## 6. Before building a new component

- **Always check `10-components.md`** (Component Registry). Reuse or extend existing components (e.g. Card, ListRow, SectionHeader, EmptyState, Modal, PageSkeleton, FormField, Button). If you create a new reusable component, add it to the registry in `10-components.md` with path, what it renders, props, and where it is used.

---

## 7. Before creating a new API route

- **Always check `09-api-routes.md`** (API Routes Reference). Confirm whether an existing route already covers the need or a planned V2 route is listed. Follow the same patterns: method(s), request/response shape, auth (cookies vs Bearer/secret), which Supabase client to use, and rate limiting if applicable. When you add a new route, document it in `09-api-routes.md` (e.g. in “V2 API Routes To Create” or the quick reference) so others do not duplicate it.

---

## 8. Reference documents

Keep these docs in mind when changing behavior or adding features:

- **00-current-state.md** — Pages, routes, tables, components, feature status, known issues.
- **01-architecture.md** — Tech stack, auth, data flow, project structure, env.
- **02-database-schema.md** — Tables, columns, RLS, naming; use for any DB or RLS change.
- **03-env-variables.md** — Env catalog and where to set variables.
- **04–08, 11–12** — Feature specs (client management, messaging, calendar, video, program builder, auth/permissions, user flows).
- **13-v2-roadmap.md** — Phases, tasks, and out-of-scope for V2.

---

*Copy this file to the project root as `.cursorrules` so Cursor loads it automatically.*
