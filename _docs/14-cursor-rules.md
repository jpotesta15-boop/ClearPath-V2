# ClearPath Coach Operating System — V2  
# .cursorrules — Read this before every single session

This document is the single source of rules for Cursor in this project. It is also used as `.cursorrules` at the project root so Cursor reads it automatically in every session. Follow these rules for all new and modified code.

---

## PROJECT IDENTITY

- **Project:** ClearPath Coach Operating System  
- **Version:** 2.0  
- **Type:** Multi-tenant SaaS — coaching platform  
- **Stack:** Next.js 14 (App Router), Supabase, Vercel, TypeScript, Tailwind CSS  
- **App URL:** app.clearpath.com  
- **Marketing URL:** clearpath.com (separate repo — do not touch from this project)

---

## MANDATORY SESSION START

Before doing anything in a new session, always:

1. Read `_docs/01-architecture.md`
2. Read `_docs/02-database-schema.md`
3. Read `_docs/13-v2-roadmap.md`
4. Summarize what you understand about the current state of the project
5. Confirm which phase of the roadmap we are in
6. Then wait for the user to tell you what to build today

**Never start writing code before completing this checklist.**

---

## FOLDER STRUCTURE — WHERE EVERYTHING LIVES

```
app/
  (auth)/           → login, signup, password reset — public routes
  (coach)/          → all coach-facing pages — requires coach role
  (client)/         → client portal — requires client role
  (admin)/          → super-admin panel — requires super_admin role
  onboarding/       → first-time coach setup wizard
  billing/          → subscription management
  api/              → all API route handlers

components/
  ui/               → base components (Button, Input, Card, Badge, Modal)
  layout/           → Sidebar, Nav, MobileNav, PageHeader
  coach/            → coach-specific components
  client/           → client-specific components
  shared/           → components used by both coach and client

lib/
  supabase.ts       → THE ONLY place Supabase clients are created
  supabase-server.ts → server-side Supabase client
  stripe.ts         → Stripe client
  utils.ts          → shared utility functions
  validations.ts    → Zod schemas

types/
  database.ts       → Supabase generated types
  index.ts          → shared TypeScript types

middleware.ts       → route protection and role-based redirects
_docs/              → all 49 project documents
_design/            → 6 design documents
_docs/skills/       → 10 skill documents
```

---

## DATABASE — MULTI-TENANT RULES

### The #1 rule — workspace isolation

Every single table that holds user data MUST have:

- A `workspace_id` UUID column with NOT NULL constraint  
- A foreign key to the `workspaces` table  
- An RLS policy that enforces workspace isolation  

### RLS policy pattern — use this exact structure every time

```sql
-- SELECT
CREATE POLICY "workspace_select" ON table_name
  FOR SELECT USING (
    workspace_id = (
      SELECT workspace_id FROM coaches WHERE user_id = auth.uid()
    )
  );

-- INSERT
CREATE POLICY "workspace_insert" ON table_name
  FOR INSERT WITH CHECK (
    workspace_id = (
      SELECT workspace_id FROM coaches WHERE user_id = auth.uid()
    )
  );
```

### Tables that exist (check 02-database-schema.md for full schema)

- `workspaces` — tenant root, every coach belongs to one  
- `coaches` — linked to auth.users and workspaces  
- `clients` — scoped to workspace_id  
- `sessions` — scoped to workspace_id  
- `messages` — scoped to workspace_id  
- `programs` — scoped to workspace_id  
- `videos` — scoped to workspace_id  
- `notifications` — scoped to user_id  

### Before creating any new table

1. Check 02-database-schema.md to confirm it doesn't already exist  
2. Add `workspace_id` as the first column after `id`  
3. Write the RLS policies immediately — never leave a table unprotected  
4. Add indexes on `workspace_id` and any column used in WHERE or ORDER BY  

---

## SUPABASE — HOW TO USE IT CORRECTLY

Read `_docs/skills/SKILL-supabase-patterns.md` for full patterns.

### Import rules

- Server components / API routes → import from `@/lib/supabase-server`  
- Client components → import from `@/lib/supabase`  
- NEVER create a new Supabase client inline — always import from lib/  
- NEVER use the service role key in client-side code  

### Query pattern — always handle errors

```ts
const { data, error } = await supabase
  .from('clients')
  .select('*')
  .eq('workspace_id', workspaceId);

if (error) {
  // handle error — never ignore it
  throw new Error(error.message);
}
```

### Never do this

- `SELECT *` in production — always specify columns  
- Queries inside loops (N+1 problem) — fetch all at once  
- Unfiltered fetches with no WHERE clause on large tables  
- Using `.data` without checking `.error` first  

---

## AUTHENTICATION & ROUTE PROTECTION

Read `_docs/skills/SKILL-auth-patterns.md` for full patterns.

### User roles

- **coach** — owns a workspace, accesses /coach/* routes  
- **client** — belongs to a workspace, accesses /client/portal only  
- **super_admin** — internal only, accesses /admin/* routes  

### Route protection rules

- ALL /coach/* routes require: authenticated + role === 'coach' + active subscription  
- ALL /client/* routes require: authenticated + role === 'client'  
- ALL /admin/* routes require: authenticated + role === 'super_admin'  
- /login, /signup, /auth/* are public — no auth check needed  

### Middleware redirect logic

- Not authenticated → redirect to /login  
- Coach, first login → redirect to /onboarding  
- Coach, subscription expired → redirect to /billing  
- Coach, active → redirect to /dashboard  
- Client → redirect to /portal  
- Super admin → redirect to /admin/dashboard  

**Never check auth only on the client side — always protect in middleware too.**

---

## API ROUTES — RULES

Read `_docs/09-api-routes.md` before creating any new API route.

### Before creating a new API route

1. Check 09-api-routes.md — does it already exist?  
2. If it exists, use the existing one — never create a duplicate  

### Every API route must

- Verify the session token at the top before any logic  
- Check the user's role before any data access  
- Validate the request body with Zod before using any input  
- Return consistent error responses: `{ error: 'Human-readable message' }`  
- Return consistent success responses: `{ data: result }`  
- Have rate limiting on any auth, write, or upload endpoint  

### Rate limiting — apply to every route that writes data

- Auth endpoints: 5 requests per 15 minutes per IP  
- Message send: 60 per minute per user  
- File/video upload: 10 per hour per user  
- General API: 100 per minute per user  
- Return 429 with Retry-After header when limit is hit  

---

## COMPONENTS — RULES

Read `_docs/10-components.md` before building any new component.

### Before building a new component

1. Check 10-components.md — does it already exist?  
2. If it exists, use and extend it — never create a duplicate  

### Every component must have

- A loading state (skeleton, not spinner — match the shape of the content)  
- An error state (clear message + retry action if applicable)  
- An empty state for any list or data view (headline + description + CTA)  

### Component file naming

- PascalCase for component files: `ClientCard.tsx`  
- kebab-case for utility/hook files: `use-clients.ts`  
- Group by feature: `components/coach/ClientCard.tsx`  

---

## DESIGN SYSTEM — NEVER DEVIATE FROM THESE

Read `_design/D1-brand-identity.md` and `_design/D3-component-styles.md` before building any UI.

### Colors — CSS variables (defined in globals.css)

- Background: `--color-white: #FFFFFF`  
- Surface: `--color-surface: #F8F7F4`  
- Primary text: `--color-ink: #1A1A1A` (never pure #000000)  
- Secondary text: `--color-muted: #6B6B6B`  
- Border: `--color-border: #E8E6E1`  
- Accent: `--color-accent` (your chosen accent — set in D1)  
- Accent background: `--color-accent-bg`  

### Typography

- Font: Inter (from Google Fonts)  
- Body: 15px / weight 400 / line-height 1.6  
- Headings: weight 500 only (never 600 or 700 except marketing headlines)  
- Labels/caps: weight 500 / letter-spacing 0.06em  

### Spacing — 8px base unit only

- xs: 4px — sm: 8px — md: 16px — lg: 24px — xl: 32px — 2xl: 48px  
- Never use arbitrary values like `p-[13px]` or `mt-[22px]`  

### Buttons — always verb + noun

- "Add client" not "Submit"  
- "Send message" not "OK"  
- "Import video" not "Upload"  
- "Create program" not "New"  
- Destructive buttons are red and name the specific item: "Delete Sarah Johnson"  

### Border radius

- Inputs, small elements: rounded-lg (8px)  
- Cards, modals, panels: rounded-xl (12px)  
- Buttons: rounded-lg (8px)  
- Pills/badges: rounded-full  

### Shadows

- None — use borders only (0.5px solid var(--color-border))  

---

## ERROR HANDLING — EVERY STATE MUST BE HANDLED

Read `_docs/skills/SKILL-error-handling.md` for full patterns.

### The three states every data-fetching component needs

1. **Loading** → skeleton that matches the shape of the loaded content  
2. **Error** → clear message + retry button  
3. **Empty** → headline + one-line description + primary action CTA  

### Toast notifications

- Success: specific — "Client added" not "Success"  
- Error: specific — "Couldn't send message — try again" not "Error"  
- Never show raw error messages or stack traces to users  
- Auto-dismiss after 4 seconds  

### API error responses — plain English always

- Network error → "Something went wrong — check your connection and try again"  
- Auth expired → "Your session expired — please log back in"  
- Not found → "We couldn't find that [item] — it may have been deleted"  
- Validation → be specific: "Email address isn't valid" not "Invalid input"  
- Rate limited → "Too many attempts — please wait [X] minutes and try again"  

---

## FORMS — VALIDATION RULES

Read `_docs/skills/SKILL-form-validation.md` for full patterns.

- Always use: **react-hook-form + Zod** for all forms  
- Always validate: both client-side (Zod) AND server-side (API route)  
- Never trust client-side validation alone  

### Form UX rules

- Show errors inline below each field — never in a generic alert  
- Disable submit button while submitting — show loading spinner in button  
- Keep button same width when loading — never let it resize  
- On success: show toast + reset form or redirect  
- Required fields: mark with * in the label, not just in the placeholder  

---

## MOBILE & RESPONSIVE

Read `_docs/skills/SKILL-responsive-design.md` for full patterns.

### Breakpoints

- mobile: 375px (default — mobile first)  
- tablet: md: 768px  
- desktop: lg: 1024px  
- wide: xl: 1280px  

### Mobile rules

- Sidebar collapses below lg — replaced by bottom tab bar (4 tabs)  
- All touch targets minimum 44x44px — use `min-h-[44px]` on small buttons  
- Client portal is the most critical mobile view — test on 375px  
- Program builder, video import, admin panel are desktop-only — show "Please open on desktop" message on mobile instead of broken layout  

### Never

- Hide content with display:none during streaming  
- Use `1fr` without overflow safety — use `minmax(0, 1fr)` in grid templates  

---

## COPY & TONE

Read `_docs/skills/SKILL-copy-tone.md` for full patterns.

- **Voice:** direct, warm, professional — like a knowledgeable colleague  
- **Never write:** "An error occurred", "Operation successful", "Please try again"  
- **Always write:** specific, human, action-oriented copy  

### Loading messages — always say what is loading

- "Loading your clients..." not "Loading..."  
- "Getting your schedule..." not "Please wait..."  

### Empty states — always three parts

1. What's missing (one line)  
2. Why it matters (one line)  
3. CTA button with verb + noun label  

### Confirmation dialogs — always name the specific item

- "Delete Sarah Johnson?" not "Delete this client?"  
- Confirm button text matches the action in red: "Delete client"  

---

## SECURITY — NON-NEGOTIABLE

Read `_security/S1-security-audit.md` and `_security/S2-rate-limiting.md`.

### Hard rules — never break these

- Never put API keys, secrets, or tokens in client-side code  
- Never put sensitive data in URL parameters  
- Never skip RLS on any table  
- Never bypass RLS using the service role key in a client-accessible route  
- Never render user-supplied HTML without sanitisation  
- Never build SQL queries by concatenating user input  
- Never log sensitive data (passwords, tokens, personal info) to console  
- Always validate file type AND size before accepting uploads  
- Always check the user owns the resource before returning it  

### Environment variables

- `NEXT_PUBLIC_` prefix: only for values safe to expose to the browser  
- Everything else: server-only, never prefixed with NEXT_PUBLIC_  
- Never commit .env.local to git — it is in .gitignore  

---

## PERFORMANCE

### Database

- Never SELECT * — always name the columns you need  
- Always paginate lists over 20 items  
- Always add indexes on columns used in WHERE or ORDER BY  
- Never run queries inside loops — fetch all needed data in one query  

### Next.js

- Use server components by default — only add 'use client' when needed  
- Use next/image for every image — never a plain `<img>` tag  
- Use next/link for every internal link — never a plain `<a>` tag  
- Use loading.tsx files for automatic suspense boundaries on heavy pages  

### Never

- Import a whole library when you only need one function  
- Add a new npm package without checking if one already does the job  
- Leave unused imports in files  

---

## MULTI-TENANT — CHECKLIST FOR EVERY NEW FEATURE

Before considering any new feature complete, verify:

- [ ] Every new table has workspace_id  
- [ ] Every new table has RLS policies for select/insert/update/delete  
- [ ] Coach A cannot access Coach B's data — test this mentally  
- [ ] Client A cannot access Client B's data — test this mentally  
- [ ] The feature respects the workspace's plan limits if applicable  
- [ ] No raw IDs are exposed in URLs that could be guessed (use UUIDs)  

---

## DEPLOYMENT — BEFORE ANY PUSH TO MAIN

- [ ] npm run build passes with zero errors  
- [ ] npm run lint passes with zero errors  
- [ ] All console.log statements removed  
- [ ] All TODO comments either resolved or tracked  
- [ ] No hardcoded secrets anywhere in the diff  
- [ ] New environment variables added to Vercel dashboard  
- [ ] Database migration written and tested on dev before running on prod  
- [ ] Manual Supabase snapshot taken before any migration  

---

## QUICK REFERENCE — SKILL DOCUMENTS

When working on these areas, read the skill doc first:

| Area | Skill document |
|------|-----------------|
| Supabase queries | _docs/skills/SKILL-supabase-patterns.md |
| Auth & route guards | _docs/skills/SKILL-auth-patterns.md |
| Forms & validation | _docs/skills/SKILL-form-validation.md |
| Realtime / messaging | _docs/skills/SKILL-realtime.md |
| Video pipeline | _docs/skills/SKILL-video-processing.md |
| Error handling | _docs/skills/SKILL-error-handling.md |
| Responsive layout | _docs/skills/SKILL-responsive-design.md |
| Accessibility | _docs/skills/SKILL-accessibility.md |
| Animation | _docs/skills/SKILL-motion-animation.md |
| Copy & tone | _docs/skills/SKILL-copy-tone.md |

**Note:** Skills live under `.cursor/skills/` (e.g. `.cursor/skills/copy-tone/SKILL-copy-tone.md`). Use `_docs/skills/` in .cursorrules if you alias that path; otherwise reference `.cursor/skills/` as needed.

---

## QUICK REFERENCE — FEATURE DOCS

| Feature | Document |
|---------|----------|
| Client management | _docs/04-client-management.md |
| Messaging | _docs/05-messaging.md |
| Calendar/scheduling | _docs/06-calendar-scheduling.md |
| Video pipeline | _docs/07-video-pipeline.md |
| Program builder | _docs/08-program-builder.md |
| API routes map | _docs/09-api-routes.md |
| Component registry | _docs/10-components.md |
| Auth & permissions | _docs/11-auth-permissions.md |
| User flows | _docs/12-user-flows.md |
| V2 roadmap | _docs/13-v2-roadmap.md |
| Multi-tenant schema | _docs/T1-multi-tenant-schema.md |
| Billing/Stripe | _docs/T2-billing-subscriptions.md |
| Email system | _docs/M1-email-system.md |
| Onboarding wizard | _docs/M2-onboarding-flow.md |
| Login & auth flows | _docs/LG1-auth-flows.md |

---

## THE GOLDEN RULES — READ THESE EVERY SESSION

1. Every table gets workspace_id + RLS. No exceptions. Ever.  
2. Read the doc before building the feature.  
3. Check components.md before creating a new component.  
4. Check api-routes.md before creating a new route.  
5. Every page needs loading + error + empty states.  
6. Never show raw errors to users — always translate to plain English.  
7. Never hardcode a secret — always use environment variables.  
8. Mobile first — test the client portal on 375px always.  
9. Buttons are verb + noun. Always.  
10. If something feels like it might already exist — it probably does. Check first.  
