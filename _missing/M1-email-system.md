# M1 — Transactional Email System (Resend + React Email)

This document designs the complete transactional email system for ClearPath using **Resend** and **React Email**. It defines every email the platform sends, their triggers, senders, subject lines, and content, plus Resend setup in Next.js and template storage.

---

## 1. Overview

- **Provider:** Resend (API-based sending; no SMTP required for app code).
- **Templates:** React Email components in `/emails`, rendered to HTML and sent via Resend.
- **Sender domain:** All emails are sent from a verified domain (e.g. `clearpath.com` or your whitelabel domain). Default sender: **ClearPath** &lt;noreply@clearpath.com&gt; unless overridden per email (e.g. client invite from coach branding).
- **Environment:** `RESEND_API_KEY` (server-only). Optional: `EMAIL_FROM_DEFAULT` and `EMAIL_FROM_NAME_DEFAULT` for default sender when not using coach branding.

---

## 2. Resend Setup in Next.js

### 2.1 Install

```bash
npm install resend @react-email/components
```

### 2.2 Environment

| Variable | Purpose | Where |
|----------|---------|--------|
| `RESEND_API_KEY` | Resend API key for sending | Server-only; Resend Dashboard → API Keys |
| `EMAIL_FROM_DEFAULT` | Default from address (e.g. `noreply@clearpath.com`) | Server-only |
| `EMAIL_FROM_NAME_DEFAULT` | Default from name (e.g. `ClearPath`) | Server-only |
| `NEXT_PUBLIC_APP_URL` | Base URL for links in emails | Already used |

Add to `03-env-variables.md` and `.env.example`.

### 2.3 Send helper (server-only)

Create `lib/email.ts` (or `lib/resend.ts`):

- Initialize Resend with `new Resend(process.env.RESEND_API_KEY)`.
- Export `sendEmail({ to, subject, react: <Component />, from?, replyTo? })`.
- Default `from`: `EMAIL_FROM_NAME_DEFAULT <EMAIL_FROM_DEFAULT>`.
- Render React Email component with `render()` from `@react-email/components` and pass HTML to Resend, or use Resend’s built-in React support if available (see Resend docs for `react` option).
- Handle errors and log (do not expose Resend errors to client).

### 2.4 Template storage: `/emails` folder

- **Location:** Project root: `/emails` (or `src/emails` if using `src/`).
- **Structure:** One React Email component per email type; shared layout and blocks in the same folder.

Example:

```
emails/
  layout/
    EmailLayout.tsx      # Shared wrapper (logo, footer, styles)
  client-invite.tsx
  session-reminder.tsx
  password-reset.tsx
  welcome-coach.tsx
  subscription-confirmation.tsx
  payment-failed.tsx
  new-message-digest.tsx
```

- **Convention:** Each file exports a default React component that accepts typed props (e.g. `ClientInviteEmailProps`). Use `@react-email/components` primitives (`Html`, `Head`, `Body`, `Container`, `Section`, `Text`, `Link`, `Button`, `Img`, etc.).
- **Preview (optional):** Use `email dev` (React Email CLI) to preview templates locally; point it at `/emails` or the folder you use.

---

## 3. Email Catalog

For each email we define: **trigger**, **sender name and address**, **subject line**, and **key content**.

---

### 3.1 Client invite email

| Field | Value |
|-------|--------|
| **Trigger** | Coach adds a client with “Send invite” (or equivalent) and submits. After the client record is created and Supabase `auth.admin.inviteUserByEmail` (or custom invite token) is used, the app sends this **custom** invite email. The email contains the magic link (from Supabase invite or from a token you generate and store). |
| **Sender name** | Coach’s email sender name from `coach_email_settings.sender_name`, or coach’s `profiles.display_name` or `full_name`, or `EMAIL_FROM_NAME_DEFAULT`. |
| **Sender address** | Coach’s `coach_email_settings.sender_email` if set and verified, otherwise `EMAIL_FROM_DEFAULT` (e.g. `noreply@clearpath.com`). |
| **Subject** | `You're invited to [Coach Name]'s client portal` or `Set up your account – [Coach Name]` |
| **Key content** | Coach’s name; coach’s logo (from brand or `coach_email_settings.email_logo_url`); short line that they’ve been invited to the coach’s client portal; one prominent CTA: “Set up your account” linking to the magic link (e.g. `/auth/set-password?token=...` or Supabase invite link); optional footer from `coach_email_settings.footer_text`. |

**Props (example):** `coachName`, `magicLink`, `logoUrl?`, `footerText?`, `clientEmail` (for personalization).

**Note:** If you keep using Supabase’s built-in invite email for the actual magic link, you can still send this as a “pre” or “friendly” invite that tells the client to check their inbox for the link; or you can replace Supabase’s email entirely by generating the link in-app and sending only this Resend email.

---

### 3.2 Session reminder (24 hours and 1 hour before)

| Field | Value |
|-------|--------|
| **Trigger** | Scheduled job (cron or external scheduler) that runs periodically (e.g. every 15 minutes), fetches upcoming sessions whose start time is in ~24h or ~1h (within a small window), and sends one reminder per (session, recipient) per lead time. Sent to **both** coach and client. |
| **Sender name** | `ClearPath` (or `EMAIL_FROM_NAME_DEFAULT`). |
| **Sender address** | `noreply@clearpath.com` (or `EMAIL_FROM_DEFAULT`). |
| **Subject (24h)** | Client: `Reminder: Session with [Coach Name] tomorrow at [Time]` — Coach: `Reminder: Session with [Client Name] tomorrow at [Time]` |
| **Subject (1h)** | Client: `Reminder: Session with [Coach Name] in 1 hour` — Coach: `Reminder: Session with [Client Name] in 1 hour` |
| **Key content** | Who the session is with (client sees coach name, coach sees client name); session date and time; optional timezone; optional “Add to calendar” link; optional link to app (schedule or session detail). Same template can take a `leadTime: '24h' | '1h'` and adjust copy. |

**Props (example):** `recipientName`, `otherPartyName` (coach or client), `sessionDate`, `sessionTime`, `timeZone?`, `leadTime: '24h' | '1h'`, `scheduleUrl?`, `isCoach: boolean`.

**Implementation note:** Can be triggered from the same cron that today calls `GET /api/sessions/upcoming` (used by n8n), or from a new server action/API that uses Resend directly instead of (or in addition to) n8n.

---

### 3.3 Password reset email

| Field | Value |
|-------|--------|
| **Trigger** | User requests password reset (e.g. “Forgot password” on login). App calls Supabase `auth.resetPasswordForEmail(email, { redirectTo: .../auth/set-password })`. Supabase sends its own reset email by default. To use Resend, either: (a) use a custom Supabase Auth hook / Edge Function that sends this template with the reset link Supabase provides, or (b) implement custom reset flow: generate token, store it, send this email with link to `/auth/set-password?token=...`. |
| **Sender name** | `ClearPath` |
| **Sender address** | `noreply@clearpath.com` |
| **Subject** | `Reset your ClearPath password` |
| **Key content** | Short line that a password reset was requested; one CTA: “Reset password” linking to the reset URL; note that the link expires (e.g. in 1 hour); if they didn’t request it, ignore the email. |

**Props (example):** `resetLink`, `expiresIn` (e.g. `"1 hour"`).

---

### 3.4 Welcome email (new coach, after email verification)

| Field | Value |
|-------|--------|
| **Trigger** | After a new coach signs up and verifies their email. Best implemented via Supabase Auth hook (e.g. `user.created` or post-confirmation) or a DB webhook on `profiles` insert where `role = 'coach'`. Send only once per user (e.g. when `email_confirmed_at` is set or on first login after signup). |
| **Sender name** | `ClearPath` |
| **Sender address** | `noreply@clearpath.com` |
| **Subject** | `Welcome to ClearPath – get started with your coach dashboard` |
| **Key content** | Welcome message; 2–3 next steps (e.g. complete your profile, add your first client, connect Stripe for payments); primary CTA: “Go to dashboard” linking to `/coach` or `/coach/clients`; support or help link. |

**Props (example):** `coachName`, `dashboardUrl`.

---

### 3.5 Subscription confirmation (coach starts paid plan)

| Field | Value |
|-------|--------|
| **Trigger** | Stripe webhook: `customer.subscription.created` or `checkout.session.completed` when the session mode is subscription and the subscription is active. Send only for successful new subscriptions (not updates/cancellations). |
| **Sender name** | `ClearPath` |
| **Sender address** | `noreply@clearpath.com` |
| **Subject** | `You're subscribed to ClearPath [Plan Name]` |
| **Key content** | Confirmation that they’re now on the paid plan; plan name and billing interval (e.g. monthly/yearly); next billing date if available; link to manage subscription (Stripe customer portal or app settings). |

**Props (example):** `coachName`, `planName`, `interval` (e.g. `monthly`), `nextBillingDate?`, `manageBillingUrl`.

---

### 3.6 Payment failed (Stripe couldn’t charge the coach)

| Field | Value |
|-------|--------|
| **Trigger** | Stripe webhook: `invoice.payment_failed`. Send to the coach (customer email or account owner). Optionally rate-limit (e.g. one email per invoice per 24h) to avoid duplicate sends on retries. |
| **Sender name** | `ClearPath` |
| **Sender address** | `noreply@clearpath.com` |
| **Subject** | `Action needed: Update your payment method` |
| **Key content** | We couldn’t charge your payment method; your subscription or access may be affected; one clear CTA: “Update billing” linking to Stripe customer portal or app billing settings; brief note that they can update card or contact support. |

**Props (example):** `coachName`, `updateBillingUrl`, `invoiceId?` (for support reference).

---

### 3.7 New message notification (optional digest)

| Field | Value |
|-------|--------|
| **Trigger** | Optional digest: if a client has unread message(s) from their coach and hasn’t opened the app (or messages page) in the last 24 hours, include them in a daily digest. Implement with a cron that: (1) finds clients with unread messages and last read or last app visit &gt; 24h ago, (2) for each client, sends one digest email (e.g. once per day). |
| **Sender name** | `ClearPath` (or coach’s sender name if you want digest “from” the coach). |
| **Sender address** | `noreply@clearpath.com` |
| **Subject** | `You have a new message from [Coach Name]` or `You have unread messages – [Coach Name]` |
| **Key content** | Short line that they have new message(s) from their coach; CTA: “View messages” linking to `/client/messages` (or deep link to conversation); optionally first line or preview of latest message (privacy-conscious). |

**Props (example):** `clientName`, `coachName`, `messagesUrl`, `unreadCount`, `previewText?`.

---

## 4. Sender and Reply-To Summary

| Email | Sender name | Sender address | Reply-To |
|-------|-------------|----------------|----------|
| Client invite | Coach (brand) or ClearPath | Coach email if set, else noreply@clearpath.com | Optional: coach’s support email |
| Session reminder | ClearPath | noreply@clearpath.com | — |
| Password reset | ClearPath | noreply@clearpath.com | — |
| Welcome (coach) | ClearPath | noreply@clearpath.com | support@clearpath.com (optional) |
| Subscription confirmation | ClearPath | noreply@clearpath.com | — |
| Payment failed | ClearPath | noreply@clearpath.com | support@clearpath.com (optional) |
| New message digest | ClearPath (or coach) | noreply@clearpath.com | — |

Use a single verified domain (e.g. `clearpath.com`) in Resend; coach custom “from” for invites should use a verified domain or Resend’s allowed from addresses.

---

## 5. Implementation Checklist

- [ ] Add `RESEND_API_KEY`, `EMAIL_FROM_DEFAULT`, `EMAIL_FROM_NAME_DEFAULT` to env and docs.
- [ ] Create `lib/email.ts` (or `lib/resend.ts`) with Resend client and `sendEmail()` helper.
- [ ] Create `/emails` folder and shared `EmailLayout` (branding, footer, unsubscribe only where applicable).
- [ ] Implement React Email components for: client-invite, session-reminder, password-reset, welcome-coach, subscription-confirmation, payment-failed, new-message-digest.
- [ ] Client invite: integrate with invite flow (replace or complement Supabase invite email); pass coach brand (name, logo, sender) from `getCoachBrand` / `getCoachEmailSettings`.
- [ ] Session reminder: add cron or use existing `GET /api/sessions/upcoming` consumer to send 24h and 1h reminders via Resend to both coach and client.
- [ ] Password reset: either Supabase hook + Resend or custom token flow.
- [ ] Welcome coach: Supabase Auth or DB webhook on coach signup/verification.
- [ ] Subscription confirmation: Stripe webhook `customer.subscription.created` / `checkout.session.completed`.
- [ ] Payment failed: Stripe webhook `invoice.payment_failed` + link to billing.
- [ ] New message digest: optional cron + “unread and no visit in 24h” logic.
- [ ] Update `03-env-variables.md` and add `.env.example` entries for Resend and default from.

---

## 6. References

- [Resend Docs](https://resend.com/docs) — API, Next.js, domain verification.
- [React Email](https://react.email) — components and preview.
- ClearPath: `04-client-management.md` (invite flow), `06-calendar-scheduling.md` (reminders), `LG1-auth-flows.md` (auth and set-password), `lib/brand-resolver.ts` (coach brand and email settings).
