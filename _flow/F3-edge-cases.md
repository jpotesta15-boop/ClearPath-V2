# F3 – Edge Cases & Failure Scenarios

Findings from testing and codebase review of edge cases and failure scenarios. For each: **what currently happens**, **what should happen**, and **rating** (handled well / partially handled / not handled at all).

---

## 1. Coach deletes a client who has active programs and pending messages — what happens to all their data?

**Current behavior**

- The coach runs the delete action (`deleteClientAction` in `app/coach/clients/[id]/actions.ts`), which deletes the row from `clients` with `coach_id = user.id`. There is no check for active programs, pending session requests, or unread messages.
- **Database:**  
  - `program_assignments`, `sessions`, `session_requests`, `video_assignments`, `client_time_requests`, `video_completions` reference `clients(id)` with `ON DELETE CASCADE`, so those rows are removed when the client is deleted.  
  - `messages` reference `profiles(id)` (sender_id, recipient_id), not `clients`. So message rows are **not** deleted; they remain in the DB. The coach’s Messages UI is keyed by client, so that conversation effectively disappears from the coach’s view even though the data still exists.
- The UI only warns: “Assignments and session history will be removed” (`DeleteClientButton.tsx`). It does not mention programs, pending session offers, or messages.

**What should happen**

- Before delete: warn about active program assignments, pending session requests, and any unread/pending messages, and optionally require explicit confirmation (e.g. “I understand this will remove…”).
- Decide policy for messages: either soft-delete or anonymize conversation history for the deleted client, or document that messages are retained for compliance and that the coach loses in-app access to them.
- Consider soft-delete (e.g. `deleted_at`) for clients so that accidental deletes can be recovered and dependent data can be handled in a controlled way.

**Rating:** **Partially handled** — dependent data is removed by CASCADE where FKs exist; messages are not tied to client delete and no upfront warning or recovery path exists.

---

## 2. Video import from Google Drive fails halfway through — is there an error state, can it be retried?

**Current behavior**

- Video “import” is implemented as a single-video webhook: `POST /api/webhooks/n8n-video`. Each request inserts one row into `videos`. There is no batch job table, no `video_import_jobs` (or similar), and no processing pipeline in the app (see `app/api/webhooks/n8n-video/route.ts` and `docs/n8n-google-drive-video.md`).
- If a request fails: the route returns 400/500 with a JSON error; the client (n8n or caller) can see the failure. The app does not persist “failed” or “partial” state; it only logs via `logServerError`.
- There is no in-app “error state” or list of failed imports. Retry is entirely up to the caller (e.g. n8n retry node); the app does not queue or retry.

**What should happen**

- For a true “halfway through” batch: introduce a job table (e.g. `video_import_jobs`) with status (`queued` / `processing` / `ready` / `failed`) and optional error message, so the UI can show failed items and support “retry.”
- Webhook should either accept one video per request (current behavior) with clear error responses for retry, or accept a batch and create one job per item with status so partial failure is visible and retriable in the app.

**Rating:** **Partially handled** — single-request failures are reported via HTTP and can be retried by the caller; no persisted error state or in-app retry for “halfway” batch imports.

---

## 3. Client tries to access a program that has been unassigned from them — do they see an error or a blank page?

**Current behavior**

- The client Programs experience is a single page: `app/client/programs/page.tsx`. It loads the client by email, then loads `program_assignments` for that client and only shows programs that are currently assigned. There is **no** client route like `/client/programs/[id]` or a direct URL that includes a program ID.
- So a client cannot “navigate to” a specific program by ID in the app. If a program is unassigned, it simply no longer appears in the list. There is no case where they open a “program detail” page that could go blank or throw for an unassigned program.
- If a future feature adds direct links to a program or lesson (e.g. `/client/programs/123`), then unassigned access would need to be handled (e.g. 403 or “No longer assigned” message).

**What should happen**

- As long as there is no direct program-by-ID URL for clients: current behavior is acceptable (unassigned = not in list).
- If direct program/lesson URLs are added: the server should check that the current client still has an assignment to that program and return a clear error or “No longer assigned” page instead of a blank or generic error.

**Rating:** **Handled well** for the current UX (list-only); **not applicable** for a direct program URL until such a route exists.

---

## 4. Two coaches accidentally get access to the same client record — is this possible with the current RLS setup?

**Current behavior**

- In the schema, `clients` has a single `coach_id` UUID (FK to `profiles(id)`). Each client row belongs to exactly one coach.
- RLS (`supabase/migrations/20240102000000_add_tenant_isolation.sql`): “Coaches can manage clients in their tenant” requires `client_id = get_current_client_id()` and `coach_id IN (SELECT id FROM profiles WHERE id = auth.uid() AND role = 'coach' AND tenant_id = get_current_client_id())`. So a coach only sees/edits clients where `clients.coach_id = auth.uid()`.
- Because `coach_id` is a single column, one client row cannot be shared by two coaches. Two coaches in the same tenant have different client rows; they cannot both “own” the same client record.

**What should happen**

- No change required for “two coaches, one client record”: the data model and RLS prevent it. If the product later supports shared clients (e.g. co-coaches), the schema would need something like a junction table (e.g. `coach_clients`) and RLS updated accordingly.

**Rating:** **Handled well** — not possible with current RLS and schema.

---

## 5. Coach submits a form with an empty required field — client-side validation, server-side validation, or neither?

**Current behavior**

- **Client-side:** Many forms use HTML5 `required` (e.g. coach schedule, session packages, programs, new client full name, login, messages textarea). So in normal use, the browser blocks submit when a required field is empty.
- **Server-side:**  
  - API routes that accept JSON use Zod schemas (e.g. `createSessionSchema`, `createClientAccountSchema`, `n8nVideoSchema`) and return 400 with a message when validation fails.  
  - Some flows use server actions or direct Supabase from the client (e.g. new client form in `app/coach/clients/new/page.tsx`). Those do not run through a shared Zod layer; the insert can fail on DB constraints (e.g. `full_name NOT NULL`), and the UI shows a generic error (`GENERIC_FAILED`) from `insertError`.
- So: client-side validation is common but can be bypassed; server-side is strong for API routes and weak for direct-Supabase forms (only DB constraints plus generic error message).

**What should happen**

- All forms that mutate data should validate on the server (e.g. shared Zod schemas in server actions or API routes) and return field-level or clear messages. Client-side `required` and Zod can mirror this for UX.
- Replace generic “Something went wrong” with specific messages where possible (e.g. “Full name is required”).

**Rating:** **Partially handled** — client-side validation and API validation exist; server-side validation is inconsistent for forms that write via Supabase from the client, and error messages are often generic.

---

## 6. Supabase connection drops during a message send — does the message get lost silently?

**Current behavior**

- Coach and client message send (e.g. `app/coach/messages/page.tsx` `handleSendMessage`, client messages equivalent) do a single `supabase.from('messages').insert(...)`. If the request fails (network/connection drop, timeout, or Supabase error), the `error` branch runs and the UI sets an error message (e.g. “Failed to send. Please try again.”).
- The message is not stored in a “pending” or “draft” queue; there is no automatic retry. The user must resend manually. So the message is not “lost silently”—the user sees a failure—but it can be “lost” in the sense that they have to retype and resend.

**What should happen**

- Keep showing an error so the message is not lost silently (already done).
- Optionally: keep the unsent content in the input or in local state so the user doesn’t lose what they typed; and/or add a “Retry” action. For higher reliability, consider a small outbox (e.g. store pending in state or IndexedDB and retry on reconnect).

**Rating:** **Partially handled** — failure is visible and the user can retry; no automatic retry or persistence of unsent content.

---

## 7. User uploads a file that is too large or the wrong type — what error do they see?

**Current behavior**

- The only in-app file upload is avatar/logo in coach settings (`app/coach/settings/page.tsx`, `app/coach/settings/branding/page.tsx`). Before calling Supabase Storage:
  - **Type:** `if (!file.type.startsWith('image/'))` → user sees “Please choose an image (JPEG, PNG, GIF, or WebP).”
  - **Size:** `if (file.size > 2 * 1024 * 1024)` → user sees “Image must be under 2 MB.”
- The Storage bucket (`supabase/migrations/20240114000000_storage_avatars.sql`) enforces `file_size_limit = 2097152` and `allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']`. So invalid uploads that bypass client-side checks are still rejected by Storage; the UI then shows a generic failure message (`GENERIC_FAILED`) from the Storage `error`.

**What should happen**

- Keep client-side checks and clear messages (already good). For Storage errors, map common codes (e.g. size or type rejection) to the same user-friendly messages (“Image must be under 2 MB”, “Please choose an image…”) so server-side enforcement is visible in a consistent way.

**Rating:** **Handled well** — client-side validation with clear errors; server-side limits in place; only improvement is friendlier mapping of Storage errors.

---

## 8. Coach tries to schedule two sessions at exactly the same time — does the system prevent this?

**Current behavior**

- Session creation goes through `POST /api/coach/sessions` (`app/api/coach/sessions/route.ts`) or direct Supabase insert from the coach schedule page. The code does **not** check for an existing session for the same coach at the same (or overlapping) `scheduled_time`.
- There is no unique constraint on `(coach_id, scheduled_time)` (or similar) in the schema. So the coach can create two sessions at the same time for the same or different clients; both inserts succeed.

**What should happen**

- Before inserting a session, the server should check for an existing non-cancelled session for that coach whose time range overlaps the new one (or at least same `scheduled_time`), and return a clear error (e.g. “You already have a session at this time”).
- Optionally add a DB constraint or unique index to enforce no overlapping sessions per coach (e.g. exclusion constraint on `(coach_id, tstzrange(scheduled_time, end_time))` if end time is stored or derivable).

**Rating:** **Not handled at all** — double-booking at the same time is allowed; no check or constraint.

---

## 9. New user signs up with an email that already exists — what happens?

**Current behavior**

- “Create client account” is done via `POST /api/create-client-account` (coach-only). It uses `createClientAccountSchema` for input and `admin.auth.admin.createUser`. If Supabase Auth returns an error (e.g. “User already registered”), the route (in `app/api/create-client-account/route.ts`) checks `error.message` for “already” or “registered” and returns a **user-friendly** message: “This email already has an account.” (status 400). Otherwise it returns a generic safe message.
- Invite flow (`/api/invite-client`) uses Magic Link / invite; behavior for “email already exists” would depend on Supabase invite semantics (e.g. may resend invite). Not re-checked in this audit.
- Standard sign-up (e.g. coach or client self-signup) was not fully traced; the create-client-account path is explicitly handled.

**What should happen**

- Ensure all sign-up and invite paths return a clear, non-leaking message when the email is already registered (e.g. “This email already has an account” or “An invite was sent to this email”) and do not reveal whether the account exists for unauthenticated callers if that’s a security requirement.

**Rating:** **Handled well** for the create-client-account flow; other sign-up/invite paths should be verified similarly.

---

## 10. Session token expires while a user is mid-action — are they redirected to login gracefully?

**Current behavior**

- **Middleware** (`middleware.ts`): For `/coach` and `/client`, it uses `supabase.auth.getSession()`. If there is no session, it redirects to `/login?next=<pathname>`. So when the user **navigates** to a new page after expiry, they get redirected to login with a return URL.
- **Mid-action (e.g. submit a form):** The request goes to an API route or server action, which calls `getUser()`. If the token is expired, Supabase returns an unauthenticated state; the route typically returns 401 Unauthorized. There is **no** app-wide handling of 401 in the client (e.g. no global fetch interceptor or React context that redirects to login on 401). So the user may see a generic error (e.g. “Could not create session” or “Failed to send”) or a 401 response without an automatic redirect to login. They must navigate (e.g. refresh or click a link) to hit middleware and then get redirected to login.

**What should happen**

- For API and server actions that return 401: either return a structured body (e.g. `{ error: 'Unauthorized', code: 'SESSION_EXPIRED' }`) and have the client detect it and redirect to `/login?next=...`, or use a global client-side handler (e.g. in a fetch wrapper or layout effect) to redirect on 401 so the user is always sent to login gracefully after expiry.

**Rating:** **Partially handled** — navigation after expiry is handled by middleware; mid-action 401 does not trigger an automatic redirect to login and can appear as a generic failure.

---

## Summary table

| # | Scenario | Rating |
|---|----------|--------|
| 1 | Coach deletes client with active programs and pending messages | Partially handled |
| 2 | Video import from Google Drive fails halfway | Partially handled |
| 3 | Client accesses unassigned program | Handled well (no direct program URL) |
| 4 | Two coaches same client record | Handled well (not possible) |
| 5 | Coach submits form with empty required field | Partially handled |
| 6 | Supabase connection drops during message send | Partially handled |
| 7 | File too large or wrong type on upload | Handled well |
| 8 | Coach schedules two sessions at same time | Not handled at all |
| 9 | New user signs up with existing email | Handled well (create-client-account) |
| 10 | Session token expires mid-action | Partially handled |
