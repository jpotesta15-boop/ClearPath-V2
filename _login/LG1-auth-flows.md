# LG1 — Authentication Flows

This document defines every authentication flow for ClearPath: coach signup and login, client login, password reset, session management, optional Google OAuth, and the login page design. Implementations should align with this spec and with the auth patterns in `.cursor/skills/auth-patterns/SKILL.md` and the security blueprint in `11-auth-permissions.md`.

---

## 1. Coach signup flow

**Entry point:** User clicks a pricing CTA (e.g. “Start free trial” or “Get started”) that leads to the coach signup journey.

### Steps

1. **Pricing CTA → Signup**
   - From `/pricing` (or equivalent landing), the CTA links to the coach signup entry (e.g. `/signup` or `/login` with a “Create account” mode).
   - User is presented with an **email + password** signup form (no magic link for initial coach signup).

2. **Email verification**
   - On submit, the app creates the user via Supabase Auth (e.g. `signUp({ email, password })`).
   - Supabase sends a **verification email** (configured in Supabase Dashboard). User is shown a “Check your email” screen with instructions.

3. **Verification complete**
   - User clicks the link in the verification email. The link uses the auth callback or a dedicated verify route that confirms the email and establishes a session (or directs them to sign in).

4. **Onboarding wizard**
   - Once the coach is **verified and signed in**, redirect to **onboarding** (`/onboarding`), not directly to the dashboard.
   - Onboarding steps (in order):
     - **Workspace name** — e.g. “Your practice name” or “Studio name”.
     - **Profile photo** — optional upload for coach avatar.
     - **First client invite** — prompt to invite at least one client (email); sends invite using the same invite flow as existing coach clients (magic link to set password).
   - Progress may be saved so the coach can complete onboarding in more than one visit. A flag (e.g. `profiles.onboarding_completed_at` or `profiles.onboarding_step`) determines whether to show the wizard or the dashboard.

5. **Dashboard**
   - After onboarding is complete, redirect to **`/coach/dashboard`**. All subsequent coach logins go to dashboard (or billing if subscription is expired; see Coach login flow).

### Summary

| Step | Location / action |
|------|-------------------|
| CTA | `/pricing` → signup entry |
| Form | Email + password signup |
| Verification | Email sent by Supabase; user clicks link |
| Post-verify | Redirect to `/onboarding` |
| Onboarding | Workspace name → profile photo → first client invite |
| Done | Redirect to `/coach/dashboard` |

---

## 2. Coach login flow

**Entry point:** Coach goes to `/login` (or is redirected there when accessing a protected coach route without a session).

### Steps

1. **Credentials**
   - Coach enters **email** and **password** and submits. App uses Supabase `signInWithPassword({ email, password })`.

2. **Post-login checks (order matters)**
   - **First login (onboarding not completed):** If the user has never completed onboarding (e.g. `profiles.onboarding_completed_at` is null), redirect to **`/onboarding`** so they finish workspace name, profile photo, and first client invite.
   - **Subscription status:** If onboarding is complete, check subscription status (e.g. via Stripe or a `subscriptions` / billing table):
     - **Active:** Redirect to **`/coach/dashboard`**.
     - **Expired or past due:** Redirect to **`/billing`** (or equivalent) so the coach can renew. Optionally allow read-only dashboard with a banner; spec is: expired → `/billing`.
   - **Default:** If no subscription record or “active” state, treat as active and redirect to **`/coach/dashboard`**.

3. **Redirect param**
   - If the user arrived at login with a **`next`** query param (e.g. `/login?next=/coach/clients/123`), after the above checks redirect to `next` when it is a safe coach path; otherwise use the default (dashboard or billing or onboarding).

### Summary

| Condition | Redirect to |
|-----------|-------------|
| First login (onboarding incomplete) | `/onboarding` |
| Onboarding complete, subscription expired | `/billing` |
| Onboarding complete, subscription active | `/coach/dashboard` (or `next` if safe) |

---

## 3. Client login flow

**Entry point:** Client receives an **invite email** from their coach (sent via the coach’s “Invite client” action).

### Steps

1. **Invite email**
   - Coach invites by email (e.g. via `POST /api/invite-client`). Backend uses Supabase Admin `inviteUserByEmail` with:
     - `user_metadata.role = 'client'` (and tenant_id as needed).
     - `redirectTo` set to the app’s **set-password** URL (e.g. `{origin}/auth/set-password`).
   - The email contains a **magic link** (Supabase invite link) that points to the app and includes the token/hash for the invite.

2. **Magic link clicked**
   - User clicks the link. Supabase Auth processes the token; the app (e.g. auth callback or set-password page) completes the session and sends the user to **`/auth/set-password`** so they can set a password (required for future email/password logins).

3. **Set password**
   - On **`/auth/set-password`**, the client enters a new password (and confirm). App calls `supabase.auth.updateUser({ password })`. No redirect to coach dashboard: client is a **client** role.

4. **Portal**
   - After setting password (and any success message), redirect the client to the **client portal**, i.e. **`/client/dashboard`** (or `/client/*`). Clients must **never** be sent to the coach dashboard; role is determined by `profiles.role` and enforced in layout and middleware.

### Summary

| Step | Location / action |
|------|-------------------|
| Invite | Coach sends invite; backend `inviteUserByEmail` with redirect to set-password |
| Link | Client clicks magic link in email |
| Set password | `/auth/set-password` — client sets password |
| After submit | Redirect to **`/client/dashboard`** (portal), not `/coach/dashboard` |

---

## 4. Password reset flow

**Entry point:** User clicks “Forgot password?” on the login page (or visits `/forgot-password` directly).

### Steps

1. **Request reset**
   - User enters **email** on `/forgot-password` and submits. App calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '{origin}/auth/set-password' })`.
   - Show a generic success message: e.g. “If an account exists for this email, you’ll receive a link to reset your password.” (Do not reveal whether the email is registered.)

2. **Email sent**
   - Supabase sends the password-reset email with a link to the app (e.g. `{origin}/auth/set-password#token=...` or query params handled by Supabase).

3. **Link clicked**
   - User clicks the link. They land on **`/auth/set-password`** with the token in the URL (hash or query). The set-password page exchanges the token for a session (or uses the hash) so the user is in a valid “recovery” state.

4. **New password form**
   - User enters **new password** and confirmation. App calls `supabase.auth.updateUser({ password })`.

5. **Redirect to login with success**
   - After a successful update, **do not** leave them on set-password. Redirect to **`/login`** with a **success** query param (e.g. `/login?message=password_reset`) and show a clear message like “Your password has been updated. Sign in with your new password.” Then the user signs in with email and the new password.

### Summary

| Step | Location / action |
|------|-------------------|
| Request | `/forgot-password` — enter email → reset email sent |
| Email | Supabase sends reset link to `redirectTo` (set-password) |
| Click | User opens link → `/auth/set-password` with token |
| Submit | New password + confirm → `updateUser({ password })` |
| After success | Redirect to **`/login?message=password_reset`** and show success message |

---

## 5. Session management

### 5.1 Session lifetime

- **Duration:** Sessions last **7 days** (configurable in Supabase Dashboard: Authentication → Settings → JWT expiry / refresh token expiry). Document and enforce this so that:
  - Access tokens and refresh behaviour align with Supabase’s JWT and refresh token settings.
  - Users are not logged out unexpectedly before 7 days if they use the app; idle timeout is a product decision (e.g. optional “log out after 30 minutes idle” can be added later).

### 5.2 Logout

- **Behaviour:** Logout must:
  1. **Invalidate the session on Supabase** — call `supabase.auth.signOut()` so the server-side session is invalidated and refresh tokens are revoked where applicable.
  2. **Clear auth cookies** — the Supabase SSR client’s signOut clears cookies when used in the same context (browser). Ensure the logout action runs in a context that has access to the same cookie store (e.g. client component or a route handler that clears the auth cookies).
- **Redirect:** After logout, redirect the user to **`/login`** (or `/` if the root is the public landing).

### 5.3 Session expires mid-use

- **Detection:** When the user makes a request (e.g. navigates to `/coach/*` or `/client/*` or calls an API) and the session is expired or invalid:
  - **Middleware:** For page requests to protected paths, middleware already redirects to `/login` when there is no session. **Preserve the page they were on** by appending it as a query param: redirect to **`/login?next={pathname}`** (e.g. `/login?next=/coach/clients/abc`). The pathname must be the full path the user was trying to access.
- **After re-login:** On successful login (or OAuth callback), read the **`next`** param. If present and **safe** (same-origin, and either `/coach/*` or `/client/*` to avoid open redirects), redirect to `next`; otherwise redirect to the default (e.g. coach dashboard, client dashboard, or onboarding).
- **APIs:** If an API is called with an expired session, return **401 Unauthorized**. The client can then redirect to `/login?next={currentPath}` so that after login the user returns to the page they were on.

### Summary

| Topic | Behaviour |
|-------|-----------|
| Session length | 7 days (Supabase JWT/refresh settings) |
| Logout | `signOut()` + clear auth cookies → redirect to `/login` |
| Expired mid-use | Redirect to `/login?next={pathname}`; after login redirect to `next` if safe |

---

## 6. Google OAuth option

If “Sign in with Google” is added (or kept) alongside email/password:

### Coexistence with email/password

- **Same user, multiple methods:** Supabase allows linking: the same user can have both an email/password identity and a Google identity. For ClearPath, the simplest approach is:
  - **Coach signup:** Offer both “Sign up with email” and “Sign in with Google”. If they choose Google, no password is set unless they add one later (account settings).
  - **Coach / client login:** Same login page shows email + password and “Sign in with Google”. No duplicate accounts: use Supabase’s “link account” or ensure OAuth uses the same email as an existing account where the product wants one account per email.
- **Invite flow:** Clients are invited by email and set a password via magic link. They can later link Google in settings if you support it; by default, client login remains email + magic link / password.

### Role assignment on first OAuth login

- **New user (no existing account):** On first OAuth sign-in, Supabase creates the user. ClearPath must set **`profiles.role`** correctly. Options:
  1. **Default new OAuth users to coach:** Use a database trigger (e.g. on `auth.users` INSERT) that sets `profiles.role = 'coach'` when the user is created via OAuth and has no `invite_token` or no `user_metadata.role`. Then new Google sign-ups become coaches and go through onboarding.
  2. **Use metadata from invite:** If the user was invited (e.g. client invite with OAuth), the invite can set `user_metadata.role = 'client'`. The trigger that creates the profile reads `user_metadata.role` and sets `profiles.role = 'client'`. So: invite flow sets role in metadata; trigger copies it to `profiles`.
- **Existing user:** If the user already has a profile (e.g. signed up with email earlier), OAuth just logs them in; role is already set. No change to role on link.

### Implementation notes

- **Callback:** OAuth redirects to `/auth/callback` with a `code`. The callback exchanges the code for a session, then loads `profiles.role` and redirects to `/coach/dashboard`, `/client/dashboard`, or `/onboarding` (for new coaches who haven’t completed onboarding), mirroring the coach login flow.
- **Redirect after OAuth:** Reuse the same “first login → onboarding”, “subscription expired → billing”, “active → dashboard” logic, and respect `next` when safe.

---

## 7. Login page design

### Layout: two halves

- **Left half (branded panel):**
  - **Logo** — ClearPath (or white-label) logo.
  - **Tagline** — Short product tagline (e.g. “Coach OS & client portal”).
  - **Coaching quote or screenshot** — One of: a short testimonial/quote, or a static screenshot/mockup of the coach or client experience. Kept minimal so the panel feels calm and professional.

- **Right half (form):**
  - **Clean white (or light) background** — High contrast for the form only; no visual clutter.
  - **Fields:** Email, Password.
  - **Forgot password link** — Placed near the password field (e.g. right-aligned or below), linking to `/forgot-password`.
  - **Submit button** — Primary CTA: “Sign in” (or “Log in”). One clear action.
  - **Optional:** “Sign in with Google” as a secondary button below the divider, if OAuth is enabled.
  - **Optional:** Link to signup (e.g. “Don’t have an account? Sign up”) pointing to the coach signup entry.

- **No clutter:** No extra links, ads, or secondary CTAs beyond sign in, forgot password, and optional signup / Google. Error and success messages appear inline (e.g. above the button or under the form).

### Responsive behaviour

- **Desktop:** Two columns (e.g. 50/50 or 40/60). Brand panel left, form right.
- **Mobile:** Stack vertically: show the logo and tagline (and optionally the quote/screenshot) at the top, then the form below, or show only the form with a compact logo for very small screens.

### Rate limiting reminder (auth lockout)

- **Limit:** **5 failed sign-in attempts per 15 minutes** per IP (or per email, if tracked server-side). After 5 failures, further attempts are blocked for the remainder of the 15-minute window.
- **Message:** When the limit is exceeded, show a **clear, user-friendly message**, e.g. “Too many failed sign-in attempts. Please try again in 15 minutes.” Do not reveal whether the email exists or whether the limit is per IP.
- **Implementation:** Apply this in middleware for `/login` (and optionally `/forgot-password`) and/or in a dedicated login API if auth is moved server-side. Use a dedicated auth rate limiter (e.g. Upstash Redis `slidingWindow(5, '15 m')` with key `auth:{ip}`). Return **429** with **Retry-After** when over limit; on the login page, detect `error=rate_limit` (or 429) and show the lockout message. See **S2-rate-limiting.md** for the suggested auth limiter and `Retry-After` behaviour.

---

## Reference: flow quick links

| Flow | Entry | Key URLs |
|------|--------|----------|
| Coach signup | Pricing CTA | Signup form → verify email → `/onboarding` → `/coach/dashboard` |
| Coach login | `/login` | Check onboarding → subscription → `/onboarding` \| `/billing` \| `/coach/dashboard` |
| Client login | Invite email | Magic link → `/auth/set-password` → `/client/dashboard` |
| Password reset | Forgot password | `/forgot-password` → email → `/auth/set-password` → `/login?message=password_reset` |
| Session expired | Any protected route | Redirect to `/login?next={pathname}`; after login redirect to `next` if safe |
| Logout | App | `signOut()` + clear cookies → `/login` |

---

*This document is the single source of truth for ClearPath authentication flows. Update it when adding or changing signup, login, onboarding, or session behaviour.*
