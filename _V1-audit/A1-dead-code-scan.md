# Dead Code Scan Report

**Generated:** 2025-03-15  
**Scope:** Full project (app, components, lib, API routes).  
**Method:** Grep/codebase search for imports, Supabase `.from()`, `process.env`, npm package usage, exports vs usage, console/debugger, TODO/FIXME, and commented blocks.

---

## 1. Files never imported or referenced

These files are not entry points (page/layout/route/middleware) and are not imported by any other file.

| File | Recommendation |
|------|----------------|
| `lib/db-helpers.ts` | **Delete** – Exports `withClientId`, `insertWithClientId`, `updateWithClientId`. No file imports this module. Only mentioned in `CLIENT_SETUP.md`. If you want tenant-scoped inserts later, reintroduce from version control. |
| `components/CoachNav.tsx` | **Delete or keep** – Full nav component for coach; layouts use `SidebarNav` + `MobileBottomNav` instead (per `10-components.md`). Delete if you have no plan to use it; keep if you intend to offer a top-nav variant. |
| `components/ClientNav.tsx` | **Delete or keep** – Same as CoachNav for client side. Same recommendation. |
| `components/ui/loading.tsx` | **Delete** – Exports `Loading` spinner. No imports in code; pages use `PageSkeleton` or inline loading. Docs already note it’s legacy. |
| `components/ui/SectionShell.tsx` | **Keep** – Not imported in app code but documented in `10-components.md` and cursor rules as the section-level loading/empty/error pattern. Keep for consistency and future use; consider using it on a page to avoid “dead” status. |

**Count: 5 files** (4 clear candidates for delete/consolidation; 1 keep but consider using).

---

## 2. Functions or components defined but never called

| File | Symbol | Recommendation |
|------|--------|----------------|
| `lib/logger.ts` | `logInfo` | **Keep** – Exported for future use; only `logError` is used (via `lib/api-error.ts`). Keep for consistent logging API. |
| `lib/db-helpers.ts` | `withClientId`, `insertWithClientId`, `updateWithClientId` | **Delete** – Only used inside the file; the file itself is never imported, so these are dead. |
| `components/ui/loading.tsx` | `Loading` | **Delete** – Component never imported (see §1). |
| `components/CoachNav.tsx` | `CoachNav` (default export) | **Delete or keep** – Never imported (see §1). |
| `components/ClientNav.tsx` | `ClientNav` (default export) | **Delete or keep** – Never imported (see §1). |
| `components/ui/SectionShell.tsx` | `SectionShell`, `SectionState` | **Keep** – Documented pattern; consider using in a page. |

**Count: 6** (3 delete with their files, 2 delete/keep with CoachNav/ClientNav, 1 keep).

---

## 3. Supabase tables never queried in code

Schema source: `02-database-schema.md`. Usage: grep for `.from('table_name')` and `storage.from()` in `*.ts`/`*.tsx`.

Tables **never** referenced in app or lib code:

| Table | Recommendation |
|-------|----------------|
| `coach_message_templates` | **Keep** – Messaging/broadcast feature; add when you implement template UI or sending. |
| `coach_broadcasts` | **Keep** – Same; future broadcast sends. |
| `coach_broadcast_recipients` | **Keep** – Same; per-recipient delivery status. |
| `activity_log` | **Keep** – Audit/activity; add when you implement logging. |
| `coach_dashboard_layouts` | **Keep** – Custom dashboard layouts; add when you implement layout editor. |
| `coach_profiles` | **Keep** – Public coach profile (bio, specialties); add when you add public profile or marketing page. |
| `coach_social_links` | **Keep** – Social links for coach; add when you surface them in UI. |

**Count: 7 tables** – All are schema-only for now; keep for planned features.

---

## 4. npm packages in package.json never imported

All listed dependencies were checked for import/require usage.

| Package | Status |
|---------|--------|
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | Used in `app/coach/programs/[id]/ProgramDetailClient.tsx` |
| `@radix-ui/react-slot` | Used in `components/ui/button.tsx` |
| `@supabase/ssr`, `@supabase/supabase-js` | Used in supabase client/server/service |
| `@upstash/ratelimit`, `@upstash/redis` | Used in `lib/rate-limit.ts` |
| `clsx`, `tailwind-merge` | Used in `lib/utils.ts` (`cn()`) |
| `date-fns` | Used in many pages/components |
| `framer-motion` | Used in layout, cards, modals, analytics, login, etc. |
| `next`, `react`, `react-dom` | Framework |
| `recharts` | Used in `app/coach/analytics/AnalyticsContent.tsx` and `app/coach/dashboard/DashboardContent.tsx` |
| `stripe` | Used in Stripe API routes |
| `zod` | Used in `lib/validations` and Stripe routes |

**Count: 0** – Every dependency is used.

---

## 5. Environment variables in .env.local never used

**Note:** `.env.local` was not found in the repository (typically gitignored). The scan instead used:

- Variables referenced in code (`process.env.*` and `lib/env.ts`).
- Variables documented in `03-env-variables.md` and `lib/env.ts`.

All variables that appear in code are used somewhere. No env var that is **defined in code or docs** was found to be **never referenced**.

If you maintain a local `.env.local`, you can diff its keys against the list in `03-env-variables.md` to find any extra keys that are never read in the codebase.

**Count: 0** (no unused vars among those referenced in code/docs).

---

## 6. Commented-out blocks of code longer than 3 lines

Searched for multi-line `//` or `/* ... */` blocks that look like commented-out code (assignments, function calls, control flow).

**Result:** No commented-out code block longer than 3 lines was found. Long comment blocks found are explanatory (e.g. middleware redirect logic, `lib/supabase/server.ts` RLS/session notes, token docs in `lib/theme/tokens.ts`), not disabled code.

**Count: 0.**

---

## 7. TODO and FIXME comments (file and line)

Searched for `TODO`, `FIXME`, `XXX`, `HACK` in `*.ts`, `*.tsx`, `*.js`, `*.jsx`.

| File | Line | Content |
|------|------|--------|
| `app/api/webhooks/session-created/route.ts` | 14 | Comment contains "XXX" in the phrase "?secret=XXX" (placeholder in doc string for the secret query param). **Not a TODO.** |

No genuine TODO or FIXME comments were found.

**Count: 0** (one false positive only).

---

## 8. console.log, console.error, console.warn, console.info, debugger

| File | Line | Code | Recommendation |
|------|------|------|----------------|
| `lib/config.ts` | 62 | `console.warn(...)` | **Keep** – Warns when tenant ID from config and env disagree; useful for setup. |
| `app/api/webhooks/stripe/route.ts` | 11 | `console.error('Stripe webhook: missing env', ...)` | **Keep** – Fail-fast when Stripe env is missing. |
| `app/api/stripe/create-checkout-session/route.ts` | 12 | `console.warn('STRIPE_SECRET_KEY is not set; ...')` | **Keep** – Same. |
| `app/api/webhooks/session-created/route.ts` | 50 | `console.log('[session-created] Unauthorized: ...')` | **Fix** – Prefer structured logger (e.g. `logError` from `@/lib/logger`) for server. |
| `app/api/webhooks/session-created/route.ts` | 58 | `console.log('[session-created] Invalid JSON:', e)` | **Fix** – Use logger. |
| `app/api/webhooks/session-created/route.ts` | 64 | `console.log('[session-created] Skipped: type=...')` | **Fix** – Use logger (e.g. logInfo). |
| `app/api/webhooks/session-created/route.ts` | 83 | `console.log('[session-created] Skipped: status=...')` | **Fix** – Use logger. |
| `app/api/webhooks/session-created/route.ts` | 87 | `console.log('[session-created] Forwarding to n8n ...')` | **Fix** – Use logger. |
| `lib/notify-session-booked.ts` | 21 | `console.warn('[notify-session-booked] N8N_... not set ...')` | **Keep or fix** – Optional: switch to `lib/logger` for consistency. |
| `lib/notify-session-booked.ts` | 57 | `console.error('[notify-session-booked] n8n responded', ...)` | **Fix** – Use `logError` from `@/lib/logger`. |
| `lib/notify-session-booked.ts` | 60 | `console.log('[notify-session-booked] n8n accepted', ...)` | **Fix** – Use `logInfo`. |
| `lib/notify-session-booked.ts` | 63 | `console.error('[notify-session-booked]', err)` | **Fix** – Use `logError`. |
| `app/api/webhooks/n8n-video/route.ts` | 23 | `console.error('[n8n-video] Invalid JSON:', e)` | **Fix** – Use `logServerError` or `logError`. |
| `lib/logger.ts` | 23 | `console.error(JSON.stringify(...))` | **Keep** – Implementation of `logError`; intentional. |
| `lib/logger.ts` | 28 | `console.info(JSON.stringify(...))` | **Keep** – Implementation of `logInfo`; intentional. |
| `app/api/stripe/connect/account-link/route.ts` | 9 | `console.warn('STRIPE_SECRET_KEY is not set; ...')` | **Keep** – Env warning. |
| `app/api/stripe/connect/account-link/route.ts` | 83 | `console.error('Failed to save stripe_connect_account_id', ...)` | **Fix** – Use `logServerError` or `logError`. |
| `app/api/stripe/connect/account-link/route.ts` | 101 | `console.error('[stripe-connect] account-link error:', err)` | **Fix** – Use logger. |
| `app/coach/clients/[id]/actions.ts` | 78 | `console.error('[updateClientProfile]', error)` | **Fix** – Use `logServerError` or `logError`. |
| `app/error.tsx` | 15 | `console.error(error)` | **Keep** – React error boundary; logging to console is appropriate. |
| `app/api/sessions/upcoming/route.ts` | 35 | `console.error('[sessions/upcoming]', error)` | **Fix** – Use logger. |
| `lib/supabase/server.ts` | 59 | `console.error('Failed to set client_id in session:', error)` | **Fix** – Use logger. |
| `app/global-error.tsx` | 13 | `console.error(error)` | **Keep** – Global error boundary. |
| `app/api/coach/sessions/route.ts` | 68 | `console.error('[coach/sessions] insert failed:', ...)` | **Fix** – Use logger. |
| `app/api/coach/sessions/route.ts` | 83 | `console.log('[coach/sessions] session created', ...)` | **Fix** – Use `logInfo` or remove if too noisy. |
| `app/api/coach/sessions/route.ts` | 85 | `console.log('[coach/sessions] n8n triggered:', ...)` | **Fix** – Use `logInfo` or remove. |

No `debugger` statements were found.

**Count: 24** (20 fix to use logger where appropriate, 4 keep as-is).

---

## Summary counts

| Category | Count |
|----------|-------|
| (1) Files never imported or referenced | **5** |
| (2) Functions/components defined but never called | **6** |
| (3) Supabase tables never queried | **7** |
| (4) npm packages never imported | **0** |
| (5) Env variables in .env.local never used | **0** (N/A – file not in repo) |
| (6) Commented-out code blocks > 3 lines | **0** |
| (7) TODO/FIXME comments | **0** |
| (8) console.* / debugger | **24** (no debugger) |

**Total items reported:** **42** (excluding the 0-valued categories and the “keep” recommendations that don’t require a code change).

---

## Recommended next steps

1. **Delete dead files:** `lib/db-helpers.ts`, `components/ui/loading.tsx`. Optionally remove `components/CoachNav.tsx` and `components/ClientNav.tsx` if you do not plan to use them.
2. **Keep but use:** `components/ui/SectionShell.tsx` – use on at least one page for section-level loading/empty/error so it’s not dead.
3. **Logging:** Replace ad-hoc `console.log`/`console.error` in API routes and lib with `logError`/`logInfo` (and `logServerError` where applicable) from `@/lib/logger` and `@/lib/api-error`.
4. **Supabase:** Leave the 7 unused tables as-is for future messaging, activity, and coach profile features.
5. **Env:** When adding new env vars, document them in `03-env-variables.md` and, if desired, add validation in `lib/env.ts` so unused or missing vars are easy to spot.
