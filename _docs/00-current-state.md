# ClearPath Demo — Current State Audit

This document is the foundation for building V2. It catalogs every page and route, Supabase tables, major components, feature status, and known issues. All file and table names are specific for reference.

---

## 1. Pages and Routes

### 1.1 App Router Pages (file paths and purpose)

| Route | File | Purpose |
|-------|------|--------|
| **/** | `app/page.tsx` | Home: if not logged in → `/login`; if coach → `/coach/dashboard`; if client → `/client/dashboard`. |
| **/login** | `app/login/page.tsx` | Login (email/password). Rate-limited (30/min per IP). |
| **/forgot-password** | `app/forgot-password/page.tsx` | Forgot password flow. Rate-limited. |
| **/auth/set-password** | `app/auth/set-password/page.tsx` | Set password (e.g. after invite). |
| **/coach/dashboard** | `app/coach/dashboard/page.tsx` | Coach dashboard: KPIs (clients, messages, slots, packages), revenue, recent messages, quick actions. Uses `DashboardContent.tsx`. |
| **/coach/schedule** | `app/coach/schedule/page.tsx` | Coach schedule: availability slots, sessions, book session, edit/complete/cancel session, approve time requests, send reminder. |
| **/coach/clients** | `app/coach/clients/page.tsx` | Coach client list with search; uses `ClientListWithActions.tsx`. |
| **/coach/clients/new** | `app/coach/clients/new/page.tsx` | Add new client (invite or create account). |
| **/coach/clients/[id]** | `app/coach/clients/[id]/page.tsx` | Client detail: profile, notes, portal access, session history with pay, request payment, delete. Uses `ClientProfileDetails.tsx`, `ClientNotesEditor.tsx`, `ClientPortalAccess.tsx`, `SessionHistoryWithPay.tsx`, `RequestPaymentButton.tsx`, `DeleteClientButton.tsx`, `ClientNameEditor.tsx`, `ClientPhoneEditor.tsx`. |
| **/coach/messages** | `app/coach/messages/page.tsx` | Coach messages: select client, thread view, send message, mark read, submit availability from session requests. Uses `MessageThread`. |
| **/coach/programs** | `app/coach/programs/page.tsx` | Coach programs list; create/delete program. |
| **/coach/programs/[id]** | `app/coach/programs/[id]/page.tsx` | Program detail: lessons (video/link/note/image), reorder, add/remove, assign clients. Uses `ProgramDetailClient.tsx`, `ProgramDetailDynamic.tsx`. |
| **/coach/videos** | `app/coach/videos/page.tsx` | Coach video library: add/edit/delete videos, assign to clients, see usage in programs. |
| **/coach/session-packages** | `app/coach/session-packages/page.tsx` | Session packages (session_products): create, deactivate; send offer to client. |
| **/coach/payments** | `app/coach/payments/page.tsx` | Payments list; record manual payment. |
| **/coach/analytics** | `app/coach/analytics/page.tsx` | Analytics: monthly revenue chart, client stats (sessions attended, last session, total spent). Uses `AnalyticsContent.tsx`. |
| **/coach/daily-message** | `app/coach/daily-message/page.tsx` | Coach daily/dashboard message for clients. |
| **/coach/settings** | `app/coach/settings/page.tsx` | Coach settings: profile (display name, timezone, logo, tagline), Stripe Connect, theme (mode + accent). |
| **/coach/settings/branding** | `app/coach/settings/branding/page.tsx` | Branding: brand settings, email settings, custom domains, client experience (welcome, portal nav). |
| **/coach/settings/client-experience** | `app/coach/settings/client-experience/page.tsx` | Client experience: welcome block, intro video, portal nav, terminology. |
| **/client/dashboard** | `app/client/dashboard/page.tsx` | Client dashboard: next session, unpaid/pending offers, assigned programs. |
| **/client/programs** | `app/client/programs/page.tsx` | Client view of assigned programs (no lesson drill-down in this page). |
| **/client/schedule** | `app/client/schedule/page.tsx` | Client schedule: upcoming sessions, submit time request. Uses `ClientScheduleContent.tsx`. |
| **/client/videos** | `app/client/videos/page.tsx` | Client video library; mark complete. Uses `ClientVideosContent.tsx`. |
| **/client/messages** | `app/client/messages/page.tsx` | Client messages: thread with coach, mark read. Uses `MessageThread`. |
| **/client/settings** | `app/client/settings/page.tsx` | Client settings: theme (mode + accent), phone. |

### 1.2 Auth Route Handler

| Route | File | Purpose |
|-------|------|--------|
| **GET /auth/callback** | `app/auth/callback/route.ts` | OAuth/code exchange; sets session; redirects coach → `/coach/dashboard`, client → `/client/dashboard`. Rate-limited (15/min per IP). |

### 1.3 API Routes

| Method + Path | File | Purpose |
|---------------|------|--------|
| **GET /api/health** | `app/api/health/route.ts` | Health check; pings Supabase (profiles limit 1). |
| **POST /api/invite-client** | `app/api/invite-client/route.ts` | Coach invites client by email (magic link). Auth: cookie (coach). Rate limit: 20/min per IP. |
| **POST /api/create-client-account** | `app/api/create-client-account/route.ts` | Coach creates client account (email + generated password). Auth: cookie (coach). Rate limit: 20/min per IP. |
| **GET /api/calendar/feed** | `app/api/calendar/feed/route.ts` | Calendar feed (e.g. iCal). Auth: cookie. |
| **GET /api/sessions/upcoming** | `app/api/sessions/upcoming/route.ts` | Upcoming sessions (profiles/clients for display). |
| **POST /api/sessions/[id]/send-reminder** | `app/api/sessions/[id]/send-reminder/route.ts` | Send manual reminder for a session (forwards to n8n when configured). |
| **GET /api/coach/sessions** | `app/api/coach/sessions/route.ts` | Coach sessions (for external/API use). |
| **GET /api/coach/test-n8n** | `app/api/coach/test-n8n/route.ts` | Test n8n connection (coach auth); hits `N8N_SESSION_BOOKED_WEBHOOK_URL`. |
| **POST /api/stripe/create-checkout-session** | `app/api/stripe/create-checkout-session/route.ts` | Create Stripe Checkout session (e.g. for client paying session package). |
| **POST /api/stripe/request-payment** | `app/api/stripe/request-payment/route.ts` | Create Stripe payment link for a session request (coach requests payment from client). |
| **GET /api/stripe/connect/account-link** | `app/api/stripe/connect/account-link/route.ts` | Create Stripe Connect account link for coach onboarding. |
| **POST /api/webhooks/stripe** | `app/api/webhooks/stripe/route.ts` | Stripe webhook: idempotency via `stripe_webhook_events`; records payment in `payments`; can create/update session. |
| **POST /api/webhooks/session-created** | `app/api/webhooks/session-created/route.ts` | Supabase DB webhook: on `sessions` INSERT, forwards to n8n (when `SUPABASE_SESSION_WEBHOOK_SECRET` set). |
| **POST /api/webhooks/n8n-session-booked** | `app/api/webhooks/n8n-session-booked/route.ts` | n8n session-booked webhook receiver. |
| **POST /api/webhooks/n8n-video** | `app/api/webhooks/n8n-video/route.ts` | n8n video workflow webhook (e.g. Google Drive → video library). |

### 1.4 Route Protection

- **middleware.ts**: Protects `/coach/*` and `/client/*` (redirect to `/login` if no session). Applies rate limits to `/login`, `/forgot-password`. Sets CSP in production. Does not redirect `/` when authenticated (role-based redirect is done in `app/page.tsx` and layouts).

---

## 2. Supabase Tables and Data

All tables live in `public` schema. Tenant isolation uses `get_current_client_id()` (from `profiles.tenant_id` or `app.client_id` session var); many tables use a `client_id` or `tenant_id` column storing the tenant identifier (TEXT, e.g. `'default'`).

| Table | Purpose / Data held |
|-------|---------------------|
| **profiles** | Extends auth.users. `id` (PK, FK auth.users), `email`, `full_name`, `role` ('coach' \| 'client'), `tenant_id`, `display_name`, `timezone`, `logo_url`, `tagline`, `phone`, `preferences` (JSONB), `stripe_connect_account_id`, `stripe_connect_onboarded_at`, `created_at`, `updated_at`. |
| **clients** | Coach’s clients. `id` (PK), `coach_id` (FK profiles), `full_name`, `email`, `phone`, `notes`, `client_id` (tenant), `created_at`, `updated_at`. |
| **programs** | Coach’s programs. `id`, `coach_id`, `name`, `description`, `client_id` (tenant), `created_at`, `updated_at`. |
| **program_assignments** | Which client has which program. `id`, `program_id`, `client_id` (FK clients), `assigned_at`. UNIQUE(program_id, client_id). |
| **program_lessons** | Lessons in a program (ordered). `id`, `program_id`, `video_id` (nullable), `lesson_type` ('video' \| 'link' \| 'note' \| 'image'), `title`, `url`, `content`, `sort_order`, `created_at`. UNIQUE(program_id, video_id) where video used. |
| **videos** | Coach’s video library. `id`, `coach_id`, `title`, `description`, `url`, `thumbnail_url`, `category`, `client_id` (tenant), `created_at`. |
| **video_assignments** | Videos assigned to clients. `id`, `video_id`, `client_id` (FK clients), `assigned_at`. UNIQUE(video_id, client_id). |
| **video_completions** | Client marked video done. `id`, `client_id`, `video_id`, `completed_at`. UNIQUE(client_id, video_id). |
| **availability_slots** | Coach availability. `id`, `coach_id`, `start_time`, `end_time`, `is_group_session`, `max_participants`, `session_product_id` (optional, for paid slot), `label`, `client_id` (tenant), `created_at`. |
| **sessions** | Booked sessions. `id`, `coach_id`, `client_id` (FK clients), `availability_slot_id`, `scheduled_time`, `status` ('pending' \| 'confirmed' \| 'cancelled' \| 'completed'), `notes`, `session_request_id`, `session_product_id`, `amount_cents`, `tenant_id`, `paid_at`, `created_at`, `updated_at`. |
| **session_products** | Sellable session packages. `id`, `coach_id`, `client_id` (tenant TEXT), `name`, `description`, `goal`, `duration_minutes`, `price_cents`, `max_participants`, `is_active`, `created_at`, `updated_at`. |
| **session_requests** | Offer → accept → pay → availability → scheduled. `id`, `coach_id`, `client_id` (FK clients), `session_product_id`, `tenant_id`, `status` ('offered' \| 'accepted' \| 'payment_pending' \| 'paid' \| 'availability_submitted' \| 'scheduled' \| 'cancelled'), `amount_cents`, `stripe_payment_intent_id`, `availability_slot_id`, `availability_preferences` (JSONB), `created_at`, `updated_at`. |
| **client_time_requests** | Client-submitted time preferences. `id`, `client_id`, `coach_id`, `tenant_id`, `preferred_times`, `notes`, `status` ('pending' \| 'offered' \| 'confirmed' \| 'declined'), `session_request_id`, `created_at`, `updated_at`. |
| **payments** | Payment records. `id`, `coach_id`, `client_id` (tenant TEXT), `session_request_id`, `session_id`, `amount_cents`, `currency`, `status` ('succeeded' \| 'refunded' \| 'cancelled' \| 'recorded_manual'), `provider` ('stripe' \| 'zelle' \| 'paypal' \| 'cashapp' \| 'other'), `stripe_payment_intent_id`, `payer_client_id`, `description`, `created_at`. |
| **messages** | In-app messages. `id`, `sender_id`, `recipient_id`, `content`, `read_at`, `client_id` (tenant), `created_at`. Realtime enabled. |
| **activity_log** | User activity log. `id`, `user_id`, `action`, `entity_type`, `entity_id`, `details` (JSONB), `client_id` (tenant), `created_at`. **Not written to by app code** in the current codebase; table exists and is RLS-protected. |
| **stripe_webhook_events** | Idempotency for Stripe webhooks. `event_id` (PK), `processed_at`. |
| **coach_brand_settings** | Per-coach branding. `coach_id` (PK), `tenant_id`, `logo_url`, `app_icon_url`, `brand_image_url`, `primary_color`, `secondary_color`, `accent_color`, `theme_mode`, `brand_name`, `favicon_url`, `background_color`, `white_label`, `created_at`, `updated_at`. |
| **coach_email_settings** | Email branding. `coach_id` (PK), `tenant_id`, `sender_name`, `sender_email`, `email_logo_url`, `footer_text`, `created_at`, `updated_at`. |
| **coach_domains** | Custom domains. `id`, `coach_id`, `tenant_id`, `domain`, `status`, `verification_token`, `verification_method`, `domain_verified`, `last_checked_at`, `error_message`, `requested_at`, `ssl_status`. |
| **coach_dashboard_layouts** | Dashboard layout JSON. `id`, `coach_id`, `tenant_id`, `name`, `is_default`, `layout_json`, `created_at`, `updated_at`. |
| **coach_client_experience** | Client portal customization. `coach_id` (PK), `tenant_id`, `welcome_title`, `welcome_body`, `hero_image_url`, `intro_video_source`, `intro_video_url`, `intro_video_metadata`, `show_welcome_block`, `portal_nav_enabled` (JSONB), `portal_booking_instructions`, `terminology` (JSONB), `portal_theme_overrides`, `created_at`, `updated_at`. |
| **coach_message_templates** | Message templates. `id`, `coach_id`, `tenant_id`, `name`, `subject`, `body_markdown`, `channel`, `is_default`, `created_at`, `updated_at`. |
| **coach_broadcasts** | Broadcast sends. `id`, `coach_id`, `tenant_id`, `template_id`, `subject`, `body_rendered`, `channel`, `segment_filter`, `status`, `send_at`, `created_at`, `updated_at`. |
| **coach_broadcast_recipients** | Per-recipient delivery. `id`, `broadcast_id`, `student_id` (FK clients), `tenant_id`, `delivery_status`, `delivery_metadata`, `delivered_at`. |
| **coach_profiles** | Coach public profile. `coach_id` (PK), `tenant_id`, `headline`, `bio`, `specialties`, `profile_image_url`, `is_public`, `show_social_links`, `created_at`, `updated_at`. |
| **coach_social_links** | Social links. `id`, `coach_id`, `tenant_id`, `platform`, `label`, `url`, `sort_order`. |
| **coach_daily_messages** | Daily/dashboard message for clients. `id`, `client_id` (tenant TEXT), `coach_id`, `content`, `effective_at`, `created_at`. |

Migrations live under `supabase/migrations/` (e.g. `20240101000000_initial_schema.sql` through `20260312000000_white_label_branding.sql`). Seed data: `supabase/seed.sql`.

---

## 3. Major Components and Location

### 3.1 Layout and navigation

| Component | Path | Purpose |
|-----------|------|--------|
| **AppLayout** | `components/layout/AppLayout.tsx` | Main app shell (sidebar + content area). |
| **SidebarNav** | `components/SidebarNav.tsx` | Sidebar navigation (uses nav items from layout). |
| **CoachNav** | `components/CoachNav.tsx` | Coach nav items (used in coach layout). |
| **ClientNav** | `components/ClientNav.tsx` | Client nav items (filtered by portal_nav_enabled). |
| **MobileBottomNav** | `components/MobileBottomNav.tsx` | Mobile bottom nav. |
| **CoachHeader** | `components/layout/CoachHeader.tsx` | Coach header (logo, user). |
| **PageHeader** | `components/layout/PageHeader.tsx` | Page title + optional subtitle and action. |
| **AnimatedPage** / **AnimatedPageWithExit** | `components/layout/AnimatedPage.tsx` | Page transition animation. |

### 3.2 Providers

| Component | Path | Purpose |
|-----------|------|--------|
| **ThemeProvider** | `components/providers/ThemeProvider.tsx` | Theme context. |
| **ThemeVariantProvider** | `components/providers/ThemeVariantProvider.tsx` | Theme mode + accent color. |
| **BrandThemeProvider** | `components/providers/BrandThemeProvider.tsx` | Brand color overrides. |
| **ClientBrandWrapper** | `components/providers/ClientBrandWrapper.tsx` | Wraps client app with coach brand. |

### 3.3 Dashboard

| Component | Path | Purpose |
|-----------|------|--------|
| **DashboardHero** | `components/dashboard/DashboardHero.tsx` | Hero section (revenue, week). |
| **DashboardKPIStrip** | `components/dashboard/DashboardKPIStrip.tsx` | KPI strip (clients, messages, slots, packages). |
| **KPIBlock** | `components/ui/KPIBlock.tsx` | Single KPI block. |

### 3.4 Chat

| Component | Path | Purpose |
|-----------|------|--------|
| **MessageThread** | `components/chat/MessageThread.tsx` | Thread UI; send, mark read. |
| **MessageBubble** | `components/chat/MessageBubble.tsx` | Single message bubble. |

### 3.5 UI primitives and shared

| Component | Path | Purpose |
|-----------|------|--------|
| **button** | `components/ui/button.tsx` | Button. |
| **card** (Card, CardContent, CardHeader, CardTitle) | `components/ui/card.tsx` | Card layout. |
| **input** | `components/ui/input.tsx` | Text input. |
| **textarea** | `components/ui/textarea.tsx` | Textarea. |
| **form** (FormField, FormLabel, FormError) | `components/ui/form.tsx` | Form field + error. |
| **modal** | `components/ui/modal.tsx` | Modal dialog. |
| **empty-state** | `components/ui/empty-state.tsx` | Empty state with optional CTA. |
| **loading** | `components/ui/loading.tsx` | Spinner (legacy; full-page uses PageSkeleton). |
| **skeleton** | `components/ui/skeleton.tsx` | Skeleton primitive. |
| **PageSkeleton** | `components/ui/PageSkeleton.tsx` | Full-page skeleton (list/hero/kpi/chart variants). |
| **SkeletonCard** | `components/ui/SkeletonCard.tsx` | Card-shaped skeleton. |
| **SectionShell** | `components/ui/SectionShell.tsx` | Section wrapper with optional loading. |
| **SectionHeader** | `components/ui/SectionHeader.tsx` | Section title. |
| **StatusBadge** | `components/ui/StatusBadge.tsx` | Status badge. |
| **ListRow** | `components/ui/ListRow.tsx` | List row. |
| **ActionRow** | `components/ui/ActionRow.tsx` | Action row. |

### 3.6 Coach client-detail components (under `app/coach/clients/[id]/`)

| Component | Path | Purpose |
|-----------|------|--------|
| **ClientProfileDetails** | `app/coach/clients/[id]/ClientProfileDetails.tsx` | Profile display and edit (name, email, phone). |
| **ClientNameEditor** | `app/coach/clients/[id]/ClientNameEditor.tsx` | Inline name edit. |
| **ClientPhoneEditor** | `app/coach/clients/[id]/ClientPhoneEditor.tsx` | Inline phone edit. |
| **ClientNotesEditor** | `app/coach/clients/[id]/ClientNotesEditor.tsx` | Notes edit. |
| **ClientPortalAccess** | `app/coach/clients/[id]/ClientPortalAccess.tsx` | Portal access / invite link. |
| **SessionHistoryWithPay** | `app/coach/clients/[id]/SessionHistoryWithPay.tsx` | Session list with mark paid / record manual payment. |
| **RequestPaymentButton** | `app/coach/clients/[id]/RequestPaymentButton.tsx` | Request payment (Stripe link). |
| **DeleteClientButton** | `app/coach/clients/[id]/DeleteClientButton.tsx` | Delete client. |

### 3.7 Other page-specific components

| Component | Path | Purpose |
|-----------|------|--------|
| **ClientListWithActions** | `app/coach/clients/ClientListWithActions.tsx` | Client list with search and actions. |
| **DashboardContent** | `app/coach/dashboard/DashboardContent.tsx` | Coach dashboard content (client). |
| **AnalyticsContent** | `app/coach/analytics/AnalyticsContent.tsx` | Analytics charts and client stats. |
| **ProgramDetailClient** | `app/coach/programs/[id]/ProgramDetailClient.tsx` | Program detail (lessons, assignments). |
| **ProgramDetailDynamic** | `app/coach/programs/[id]/ProgramDetailDynamic.tsx` | Dynamic wrapper for program detail. |
| **ClientScheduleContent** | `app/client/schedule/ClientScheduleContent.tsx` | Client schedule (upcoming, time request). |
| **ClientVideosContent** | `app/client/videos/ClientVideosContent.tsx` | Client videos and completion. |

### 3.8 Error UI

| Component | Path | Purpose |
|-----------|------|--------|
| **error.tsx** | `app/error.tsx` | Route error boundary. |
| **global-error.tsx** | `app/global-error.tsx` | Global error boundary. |

---

## 4. Features That Are Fully Working

- **Auth**: Login, forgot password, set password; role-based redirect (coach/client); auth callback rate limit.
- **Coach dashboard**: KPIs, revenue, recent messages, Connect Stripe CTA, empty states.
- **Coach schedule**: Availability slots CRUD, sessions list, book session (from request or ad hoc), edit/delete session, mark completed/cancelled, approve time request and create session, send reminder (calls n8n when configured).
- **Coach clients**: List with search, add client (invite or create account), client detail (profile, notes, portal access, session history, request payment, delete client).
- **Coach messages**: Select client, thread, send message, mark read, submit availability from session request.
- **Coach programs**: List, create, delete; program detail with lessons (video/link/note/image), reorder, add/remove lessons, assign/remove clients.
- **Coach videos**: List, add/edit/delete, assign to clients, see program usage.
- **Coach session packages**: Create package, deactivate, send offer to client (message with link).
- **Coach payments**: List payments, record manual payment.
- **Coach analytics**: Monthly revenue, client stats (sessions, last session, total spent).
- **Coach daily message**: Set daily/dashboard message for clients.
- **Coach settings**: Profile (display name, timezone, logo, tagline), Stripe Connect link, theme (mode + accent).
- **Coach settings – branding**: Brand settings, email settings, custom domains (UI), client experience (welcome, portal nav).
- **Coach settings – client experience**: Welcome block, intro video, portal nav toggles, terminology.
- **Client dashboard**: Next session, unpaid/pending offers, assigned programs.
- **Client programs**: View assigned programs.
- **Client schedule**: Upcoming sessions, submit time request.
- **Client videos**: View assigned videos, mark complete.
- **Client messages**: Thread with coach, mark read.
- **Client settings**: Theme (mode + accent), phone.
- **Stripe**: Checkout session (client pays package), request payment link, Connect account link; webhook records payment and can create/update session; idempotency via `stripe_webhook_events`.
- **n8n**: Session-booked webhook (booked/reminder/payment_confirmed), test-n8n endpoint; optional Supabase session-created webhook; n8n-video webhook for video ingestion.
- **Tenant isolation**: RLS and `get_current_client_id()`; `getClientId()` from `NEXT_PUBLIC_CLIENT_ID` or `'default'`.
- **Loading states**: PageSkeleton on major data pages; inline skeletons where documented in LOADING_STATES_AUDIT.md.
- **Error handling**: Per-flow error states and safe API messages as in ERROR_HANDLING_AUDIT.md; no global toast.

---

## 5. Features Partially Built or Broken

- **Custom domains**: Tables and branding UI exist (`coach_domains`, verification_token, status); no automated DNS/HTTP verification or SSL provisioning in app. Domain verification and SSL are “pending” unless implemented elsewhere.
- **Dashboard layouts**: Table `coach_dashboard_layouts` exists; no UI to edit or apply custom layout JSON; dashboard is fixed layout.
- **Message templates and broadcasts**: Tables `coach_message_templates` and `coach_broadcasts` / `coach_broadcast_recipients` exist; no UI to create templates or send broadcasts.
- **Coach public profile / social links**: Tables `coach_profiles` and `coach_social_links` exist; no settings UI to edit headline, bio, specialties, social links, or visibility.
- **Activity log**: Table and RLS exist; no app code writes to it; effectively unused.
- **Calendar feed**: Route `GET /api/calendar/feed` exists; implementation and format (e.g. iCal) not verified in this audit; may be minimal or stub.
- **Client programs page**: Lists assigned programs; no in-page drill into program lessons (lesson list is in coach program detail, not in client programs list).
- **Portal nav filtering**: Client nav uses `portal_nav_enabled` from `coach_client_experience`; if not set or mis-set, clients may see all nav items or miss some.
- **Realtime messages**: Publication added for `messages`; UI uses polling/refetch in places; realtime may not be fully wired end-to-end in all flows.
- **White-label**: Brand settings and client-readable brand policy exist; “Powered by” and platform branding visibility may not be fully toggled everywhere by `white_label`.

---

## 6. Known Bugs and Issues

- **Error handling**: No global toast/banner; errors are inline per flow. Network timeouts (e.g. AbortController) not implemented. RLS/permission errors often surface as generic “Please try again” (see ERROR_HANDLING_AUDIT.md).
- **Session-created webhook**: Depends on Supabase webhook + `SUPABASE_SESSION_WEBHOOK_SECRET`; 401/secret mismatch can cause silent failure; docs recommend checking Vercel env and Supabase delivery history.
- **n8n**: If `N8N_SESSION_BOOKED_WEBHOOK_URL` is wrong or n8n is down, reminder/booked notifications fail (user sees 502 or error from test-n8n).
- **Stripe**: No idempotency key from client for checkout/request-payment; retries can create duplicate links/sessions if user double-clicks (server-side Stripe idempotency only for webhook).
- **Rate limits**: Login and auth callback are rate-limited by IP; invite/create-client are rate-limited; other API routes are not rate-limited (per ARCHITECTURE.md).
- **Middleware**: Authenticated `/` is not redirected to dashboard in middleware (handled in `app/page.tsx` and layouts); coach visiting `/client/*` or client visiting `/coach/*` is redirected in layout (e.g. client layout redirects coach to `/coach/dashboard`).
- **client_id vs tenant**: In `session_products` and `payments`, `client_id` is TEXT (tenant id); in `session_requests` and `clients`, `client_id` is UUID (client row). Naming can cause confusion when writing RLS or queries.
- **Client matching**: Client is matched to profile by email; if same email is used for multiple clients under different coaches/tenants, behavior may be ambiguous without tenant scoping in all paths.
- **getClientId() in client components**: Some client components (e.g. `ClientScheduleContent.tsx`, `DashboardContent.tsx`) call `getClientId()` which in browser only has access to `process.env.NEXT_PUBLIC_CLIENT_ID`; ensure env is set in client bundle for those pages.

---

## Summary for V2

- **Pages/routes**: 26 app pages, 1 auth GET route, 15 API routes; middleware protects coach/client and rate-limits login/forgot-password.
- **Supabase**: 28+ tables; core entities are profiles, clients, programs, program_lessons, videos, video_assignments, video_completions, availability_slots, sessions, session_products, session_requests, client_time_requests, payments, messages; plus Stripe idempotency, branding, domains, dashboard layouts, client experience, templates, broadcasts, coach profile/social, daily messages.
- **Components**: Shared layout/nav, providers, dashboard, chat, and UI primitives in `components/`; coach client-detail and program/video/schedule content in `app/` next to pages.
- **Solid**: Auth, coach and client CRUD flows, schedule, messages, programs, videos, session packages, payments, Stripe Connect and webhook, analytics, settings and branding UI, tenant isolation, loading and error handling patterns.
- **Partial/unused**: Custom domain verification, dashboard layout editor, message templates/broadcasts, coach public profile/social UI, activity_log, full realtime and white-label toggles; calendar feed and client program lesson view need verification.
- **Risks**: No global toast, no request timeouts, Stripe client-side idempotency, webhook secret/env sensitivity, client_id/tenant naming, and client-side `getClientId()` env dependency.

Use this document as the single source of truth for scope and gaps when planning V2.
