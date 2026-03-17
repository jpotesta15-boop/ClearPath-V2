# S3 – Data Privacy Audit

This document audits every piece of user data collected and stored on the platform, third-party sharing, encryption, retention, user rights, session handling, and compliance considerations (GDPR/CCPA). It also flags gaps and recommendations.

---

## 1. Personal data fields collected and storage locations

### 1.1 Auth and identity (Supabase Auth + public schema)

| Data field | Where collected | Supabase location | Notes |
|------------|-----------------|-------------------|--------|
| Email | Login, signup, invite, create-client-account, client form | `auth.users.email`; `public.profiles.email`; `public.clients.email` | Primary identifier for clients (match by email to `clients`). |
| Password (hashed) | Signup, set-password, create-client-account | `auth.users.encrypted_password` | Set via Supabase Auth; never stored in app DB. |
| Full name | Coach profile, client form, invite | `public.profiles.full_name`; `public.clients.full_name` | |
| Phone | Coach profile, client profile/settings | `public.profiles.phone`; `public.clients.phone` | Used for contact and optional SMS/n8n notifications. |
| Role | On user creation (metadata) | `public.profiles.role` | `'coach'` or `'client'`. |
| Tenant/brand ID | On user creation (metadata) | `public.profiles.tenant_id`; `public.clients.client_id` (TEXT) | Multi-tenant scope (e.g. `demo`). |
| Display name, timezone, tagline, logo_url | Coach settings | `public.profiles` (display_name, timezone, tagline, logo_url) | |
| Preferences (JSONB) | Coach settings | `public.profiles.preferences` | e.g. default_session_duration_minutes. |
| Stripe Connect ID | Stripe Connect onboarding | `public.profiles.stripe_connect_account_id`, `stripe_connect_onboarded_at` | Links coach to Stripe Connect account. |

### 1.2 Client-specific (coach-managed)

| Data field | Where collected | Supabase table | Notes |
|------------|-----------------|----------------|--------|
| Client full name | Add client, edit client | `public.clients.full_name` | NOT NULL. |
| Client email | Add client, invite | `public.clients.email` | Links to auth for portal access. |
| Client phone | Add client, client settings | `public.clients.phone` | |
| Coach-only notes | Client detail (notes editor) | `public.clients.notes` | Free text; may include health/sensitive info. |
| Height, weight_kg, date_of_birth | Client profile (validation only) | **Not in DB** | `updateClientProfileSchema` includes these; **columns do not exist** on `clients` (see 02-database-schema.md). Either add migration or remove from validation. |

### 1.3 Health / goals (session and program context)

| Data field | Where stored | Supabase table | Notes |
|------------|--------------|----------------|--------|
| Session product “goal” | Session package creation | `public.session_products.goal` | Optional text (e.g. session type/goal). |
| Session notes | Create/edit session | `public.sessions.notes` | Per-session notes (can be sensitive). |
| Client notes | Client profile | `public.clients.notes` | Coach-only; may describe goals/health. |
| Preferred times / notes | Client schedule request | `public.client_time_requests.preferred_times`, `public.client_time_requests.notes` | Scheduling preferences. |
| Availability preferences | Session request flow | `public.session_requests.availability_preferences` (JSONB) | |

No dedicated “health goals” table exists; health-related content may appear in `clients.notes`, `sessions.notes`, and `session_products.goal`.

### 1.4 Messaging and broadcasts

| Data field | Where stored | Supabase table | Notes |
|------------|--------------|----------------|--------|
| Direct message content | In-app messages | `public.messages.content` | Coach ↔ client; can be sensitive. |
| Message read state | App (mark read) | `public.messages.read_at` | |
| Daily/broadcast message | Coach daily message | `public.coach_daily_messages.content` | Per-tenant, per effective_at. |
| Template subject/body | Coach templates | `public.coach_message_templates.subject`, `body_markdown` | |
| Broadcast body/segment | Coach broadcasts | `public.coach_broadcasts.body_rendered`, `segment_filter` (JSONB) | |
| Broadcast delivery status | Sending logic | `public.coach_broadcast_recipients` (student_id, delivery_status, delivery_metadata) | Links to `clients.id`. |

### 1.5 Scheduling and payments

| Data field | Where stored | Supabase table | Notes |
|------------|--------------|----------------|--------|
| Sessions (time, status, notes) | Schedule, booking | `public.sessions` | scheduled_time, status, notes, amount_cents, etc. |
| Session requests (amount, status) | Booking flow | `public.session_requests` | amount_cents, stripe_payment_intent_id, availability_preferences. |
| Payments (amount, provider, description) | Stripe webhook, manual record | `public.payments` | amount_cents, provider (stripe/zelle/…), stripe_payment_intent_id, payer_client_id, description. |
| Availability slots | Coach schedule | `public.availability_slots` | start_time, end_time, label, etc. |

### 1.6 Programs, videos, and activity

| Data field | Where stored | Supabase table | Notes |
|------------|--------------|----------------|--------|
| Program name/description | Programs | `public.programs` | |
| Program assignments | Program builder | `public.program_assignments` | Links client to program. |
| Video metadata (title, url, category) | Videos | `public.videos` | url can point to external (YouTube, Drive). |
| Video completions | Client watches | `public.video_completions` (client_id, video_id, completed_at) | |
| Activity log | (Not yet written by app) | `public.activity_log` (user_id, action, entity_type, entity_id, details JSONB) | Intended for audit; no INSERT policy yet. |

### 1.7 Coach branding and settings

| Data field | Where stored | Supabase table | Notes |
|------------|--------------|----------------|--------|
| Brand name, logo, colors, theme | Coach branding | `public.coach_brand_settings` | |
| Sender name/email, footer | Email settings | `public.coach_email_settings` | |
| Custom domain, verification token | Domains | `public.coach_domains` | |
| Welcome block, portal nav, terminology | Client experience | `public.coach_client_experience` | |
| Public profile (bio, specialties, image) | Coach profile | `public.coach_profiles`, `public.coach_social_links` | |

### 1.8 Storage (files)

| Data | Bucket | Notes |
|------|--------|--------|
| Avatar / profile images | `storage.objects` (bucket `avatars`) | Path `{auth.uid()}/...`; 2MB limit; MIME restricted (jpeg, png, gif, webp). |

Video files are not stored in Supabase; `videos.url` references external URLs only.

---

## 2. Data sent to third-party services

| Third party | Data sent | Purpose | Consent / disclosure |
|-------------|-----------|---------|----------------------|
| **Supabase (Auth)** | Email, password (hashed by Supabase), redirect URLs | Auth, invite emails, password reset emails | Implicit (auth flows). Supabase is the primary data processor. |
| **Stripe** | Checkout: product name, amount, currency; metadata: `session_request_id`. Customer email/name are collected on Stripe’s checkout page (not pre-filled by app). Connect: coach identity for account linking. | Payments, Connect onboarding | Necessary for payment; Stripe’s own privacy policy applies. No in-app consent banner for Stripe. |
| **n8n (webhooks)** | **Session booked / reminder:** `session_id`, `coach_id`, `client_id`, `scheduled_time`, `type`; **PII:** `client_email`, `client_name`, `client_phone`, `coach_name`, `coach_email`, `coach_phone`. Sent when: Stripe payment confirmed, n8n-session-booked API, send-reminder API. | Notifications (email/SMS/automation) | **No explicit user consent** in app. n8n URL is env-configured; operator controls where data goes. **GDPR/CCPA risk:** PII sent to third-party without prior consent or DPA. |

**Summary:** Supabase and Stripe are necessary for core product. n8n receives PII (name, email, phone) for session/reminder flows; consent and data-processing terms should be clarified before launch.

---

## 3. Encryption at rest and in transit

### 3.1 In transit

- All client–app and app–Supabase communication use **HTTPS** (TLS). Supabase client uses `https://*.supabase.co` (see CSP in `middleware.ts`).
- Stripe: connections to `api.stripe.com`, `js.stripe.com`, `hooks.stripe.com` are over HTTPS.

**Verdict:** Data in transit is encrypted.

### 3.2 At rest (Supabase)

- **Supabase (managed Postgres):** Supabase states that database storage is **encrypted at rest by default** (e.g. on AWS/GCP). The project does not disable this; no custom encryption layer is implemented in the app.
- **Supabase Auth:** Passwords are hashed; auth state is stored in Supabase’s infrastructure with their default at-rest encryption.
- **Supabase Storage:** Object storage follows Supabase (and underlying cloud) defaults for encryption at rest.

**Verdict:** Reliance on Supabase (and Stripe) defaults is appropriate. For formal compliance, confirm in Supabase dashboard/documentation that “Encryption at rest” is enabled for your project and note it in your privacy documentation.

---

## 4. Data retention and deletion

### 4.1 When a client is “deleted” (current behavior)

- **Implemented:** Coach can delete a client via **Delete client** (`DeleteClientButton`) or **bulk delete** (`bulkDeleteClientsAction`). This **deletes only the row in `public.clients`**.
- **Cascade:** Because of `ON DELETE CASCADE` on FKs to `clients(id)`, the following are removed with the client row:
  - `program_assignments`, `video_assignments`, `video_completions`, `session_requests`, `client_time_requests`, `coach_broadcast_recipients`, `sessions` (client_id), etc.
- **Not deleted:**
  - **`auth.users`** and **`public.profiles`** for that client (if they had portal access). The auth account and profile remain; the user can still log in but will no longer see client data (no matching `clients` row). **GDPR/CCPA issue:** “Deleting” the client does not amount to full account/personal data deletion.
  - **`payments`**: `payer_client_id` is FK to `clients(id)` with `ON DELETE SET NULL`, so the payment row remains but reference to client is nulled. Payment history is retained for the coach.
  - **`messages`**: Messages are keyed by `sender_id`/`recipient_id` → `profiles(id)`, not `clients(id)`. Deleting a client does **not** delete their messages; messages to/from that profile remain.

**Gaps:**

1. No deletion of the client’s **auth user** or **profile** when the client is deleted.
2. No purge of **messages** involving that user (would require delete by profile id after deleting or anonymizing the profile).
3. No defined **retention period** (e.g. how long payments/logs are kept after client deletion).

### 4.2 When a coach “closes” their account

- **No flow implemented.** There is no in-app “Close my account” or “Delete my coach account” for coaches.
- If a coach were removed manually (e.g. by deleting from `profiles`/`auth.users`), `ON DELETE CASCADE` from `profiles(id)` would remove: clients, programs, sessions, messages (where coach is sender/recipient), payments, availability_slots, etc. Manual deletion is not exposed in the UI and is not documented as a user right.

**Gap:** No self-service or documented process for coach account closure or data deletion.

### 4.3 Retention policy

- **No stated retention policy** in code or docs. Data is kept indefinitely except where CASCADE deletes it (e.g. when a client row is deleted).
- **Payments:** Retained after client deletion (only `payer_client_id` set to NULL). Needed for coach records; should be covered by privacy/legal policy.
- **Stripe:** Stripe retains payment data per its own policy; the app does not define a separate retention window for Stripe-related data.
- **n8n:** Any copy of PII sent to n8n is under the operator’s control; no retention or deletion flow is implemented in the app.

**Recommendation:** Define retention (e.g. 7 years for payments for tax, X months for logs) and document it. Implement full client deletion (auth + profile + messages + any orphaned references) and a coach account-closure flow.

---

## 5. User rights (export and delete)

### 5.1 Right to export (data portability)

- **Not implemented.** There is no “Download my data” or “Export my data” flow for coaches or clients.
- **GDPR (Art. 20)** and **CCPA** expect data portability in machine-readable form for data provided by the user or derived from their use of the service.

**Recommendation:** Add an export (e.g. JSON or CSV) of the requester’s personal data (profile, clients if coach, sessions, messages, etc.) and document it in the privacy policy.

### 5.2 Right to delete (erasure)

- **Client:** Coach can “delete” a client, but as above this does not remove the auth account or profile, and messages remain. **Full erasure** (auth user + profile + messages + any PII) is not implemented.
- **Coach:** No self-service or documented erasure flow.
- **GDPR (Art. 17)** and **CCPA** require the ability to request deletion, subject to legal exceptions (e.g. payment records).

**Recommendation:** Implement: (1) full client deletion (including auth user and messages), (2) coach account closure + data deletion (or anonymization) flow, and (3) a way to submit and process deletion requests (e.g. support or in-app request).

---

## 6. Session data (auth sessions)

### 6.1 How sessions work

- Auth is **Supabase Auth** (JWT in cookies via `@supabase/ssr`). Middleware uses `supabase.auth.getSession()` to protect `/coach` and `/client` routes; no session → redirect to `/login?next=...`.
- Session duration is controlled by **Supabase project settings** (JWT expiry and refresh token behaviour). The codebase does **not** set custom JWT expiry; defaults apply (e.g. 1 hour access token, longer-lived refresh token).
- **Logout:** User clicks Logout → `supabase.auth.signOut()` (e.g. in `CoachNav`, `ClientNav`, `SidebarNav`). This clears the session on the client and invalidates the session in Supabase Auth, so the JWT can no longer be refreshed.

### 6.2 Invalidation on logout

- **signOut()** removes the session from the client and tells Supabase to invalidate it. Subsequent requests no longer have a valid session cookie; middleware redirects to login. There is no custom server-side “session revocation list” in the app; invalidation is handled by Supabase.

**Recommendation:** Document in the privacy/security policy that session length follows Supabase configuration and that logout invalidates the session. For strict compliance, consider reviewing JWT expiry in the Supabase dashboard and aligning with policy (e.g. 1 hour vs 24 hours).

---

## 7. Privacy policy and terms of service

- **Current state:** No `/privacy` or `/terms` (or equivalent) routes or links were found in the app. The root layout and login flow do not link to a Privacy Policy or Terms of Service.
- **Before launch:** **Yes.** A Privacy Policy and Terms of Service are needed to:
  - Disclose what data is collected, where it is stored, and with whom it is shared (Supabase, Stripe, n8n).
  - Explain retention, user rights (access, export, deletion), and how to exercise them.
  - Satisfy GDPR (legal basis, transparency, controller/processor roles) and CCPA (notice, “Do not sell,” etc.).
  - Cover Stripe (and any n8n) data sharing and point to their policies where relevant.

**Recommendation:** Add at least `/privacy` and `/terms` pages (or links to hosted docs), and link them from login, signup, and footer so users see them before or at signup.

---

## 8. Third-party scripts and consent

- **Analytics:** No Google Analytics, Mixpanel, or other analytics script was found in `app/layout.tsx` or public HTML. CSP in production allows `script-src 'self'`, nonce, and `'strict-dynamic'`; no third-party analytics domains are in the allowlist.
- **Chat widgets:** No Intercom, Drift, or similar chat widget was found.
- **Only inline script:** A small theme script in the root layout (localStorage + `data-theme`); no user data is sent externally.

**Verdict:** No third-party scripts that collect user data without explicit consent were identified. If you add analytics or chat later, implement consent (e.g. banner) and document in the Privacy Policy.

---

## 9. GDPR / CCPA flags and summary

### 9.1 High priority

| Issue | Regulation | Recommendation |
|-------|------------|----------------|
| **Client “delete” does not delete auth/profile or messages** | GDPR Art. 17 (erasure); CCPA | Implement full client deletion: delete or anonymize auth user, profile, and all messages involving that profile; document and offer as “right to erasure.” |
| **No coach account closure / erasure** | GDPR Art. 17; CCPA | Add “Close account” for coaches with deletion (or anonymization) of coach data and linked client data per policy. |
| **PII sent to n8n without consent or DPA** | GDPR Art. 6 (lawful basis), Art. 28 (processor); CCPA | Obtain consent or rely on legitimate interest and document; ensure n8n (or your use of it) is under a Data Processing Agreement if it processes EU personal data. |
| **No data export (portability)** | GDPR Art. 20; CCPA | Provide “Download my data” (machine-readable) for coaches and clients. |
| **No Privacy Policy or Terms of Service** | GDPR Art. 13/14; CCPA §1798.100(b) | Publish Privacy Policy and Terms; link at signup/login and in footer. |

### 9.2 Medium priority

| Issue | Regulation | Recommendation |
|-------|------------|----------------|
| **Create-client-account returns password in API response** | Security / breach risk | Already in S1-security-audit; stop returning password in JSON; use invite or one-time display. |
| **No retention policy stated** | GDPR Art. 5(1)(e); CCPA | Define and document retention (e.g. payments, logs, messages) and deletion timelines. |
| **Payments table: no client SELECT policy** | Access / transparency | If clients can request “my data,” ensure they can access payment history or include it in export; add RLS or export logic. |

### 9.3 Lower priority

| Issue | Regulation | Recommendation |
|-------|------------|----------------|
| **Health/sensitive data in notes** | GDPR Art. 9 (special categories) | If you treat notes as health data, consider explicit consent and/or additional safeguards; document in Privacy Policy. |
| **Session duration not documented** | Transparency | Document Supabase JWT/session behaviour and logout in policy. |
| **Stripe: customer data on Stripe-hosted page** | GDPR/CCPA | Mention in Privacy Policy that payment data is collected by Stripe and link to Stripe’s privacy policy. |

---

## 10. References

- **Schema and RLS:** `02-database-schema.md`, `supabase/migrations/`
- **Security:** `S1-security-audit.md`
- **Auth/permissions:** `11-auth-permissions.md`
- **API routes:** `09-api-routes.md`
- **Client management:** `04-client-management.md`

---

*This audit reflects the codebase and docs as of the audit date. Re-run when adding new data fields, third-party integrations, or deletion/export flows.*
