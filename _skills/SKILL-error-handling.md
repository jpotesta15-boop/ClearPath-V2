---
name: error-handling
description: Platform standard for toasts, API error responses, try/catch in routes, component loading/error states, Next.js error boundaries, and server-side logging without leaking stack traces. Use when implementing or reviewing error handling anywhere in the app.
---

# Error handling

Use these patterns everywhere: API routes, server actions, client components, and error boundaries. Never expose stack traces, DB errors, or internal details to the client. Always log server-side and show safe, user-facing messages.

---

## 1. Toast notifications

**Rule:** Use **sonner** for success, error, and warning toasts. Keep messages short and actionable. Trigger toasts from client code after API/action results or in catch blocks.

**Dependency:**

```bash
npm install sonner
```

**Provider:** Add `<Toaster />` once in the root layout (e.g. `app/layout.tsx`).

```tsx
// app/layout.tsx
import { Toaster } from 'sonner'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
```

**Triggering toasts:**

```tsx
import { toast } from 'sonner'

// Success (e.g. after save, delete, or API success)
toast.success('Session saved')
toast.success('Reminder sent')

// Error (e.g. after failed fetch or server action)
toast.error('Could not save. Please try again.')
toast.error(message) // message from API response or fallback

// Warning (e.g. validation or non-fatal issues)
toast.warning('Some fields were skipped')
toast.warning('Session is in the past')
```

**Do:**

- Use `toast.success()` for completed actions, `toast.error()` for failures, `toast.warning()` for recoverable or caution cases.
- Use the API `error` message when available (sanitized server-side); otherwise a short fallback like "Something went wrong. Please try again."
- Keep messages under ~60 characters when possible.

**Don't:**

- Don’t toast and also show the same message in an inline error (pick one: toast for global feedback, inline for form/field context).
- Don’t pass raw `Error` objects or stack traces to `toast.error()`; pass a string only.
- Don’t use a different toast library (e.g. react-hot-toast) without updating this skill and the codebase.

```tsx
// Do: use API error or safe fallback
const res = await fetch('/api/...')
const data = await res.json()
if (!res.ok) {
  toast.error(data?.error ?? 'Something went wrong. Please try again.')
  return
}
toast.success('Done')

// Don't: toast raw error or internal message
toast.error(err.message)  // may leak internal/DB text
toast.error(String(err))  // may include stack
```

---

## 2. Try/catch in API route handlers

**Rule:** Wrap risky logic (DB, external APIs, JSON parse) in try/catch. Use `getSafeMessage` and `logServerError` from `@/lib/api-error`. Return a consistent JSON error shape and never send stack traces or internal errors to the client.

**Imports:**

```ts
import { NextResponse } from 'next/server'
import { getSafeMessage, logServerError } from '@/lib/api-error'
```

**Pattern:**

1. Auth/role checks first (return 401/403 as needed).
2. Parse/validate input in try/catch; on parse failure return 400 with a safe message.
3. Do the main work (DB, external call) in try; on failure log with `logServerError(tag, err, context)` and return 4xx/5xx with `getSafeMessage(status, optionalOverride)`.
4. In catch, always call `logServerError` then return `NextResponse.json({ error: getSafeMessage(status) }, { status })`.

**Do:**

- Use a short, stable tag for each route (e.g. `'send-reminder'`, `'create-session'`) so logs are filterable.
- Return 400 for bad input, 401 for unauthenticated, 403 for forbidden, 404 for missing resource, 429 for rate limit, 500/502 for server/upstream failures.
- For known business rules (e.g. "Session has already passed"), you may pass a short override to `getSafeMessage(400, 'Session has already passed')` if the message is safe and under 200 chars.

**Don't:**

- Don’t return `err.message`, `sessionError.message`, or any raw DB/external error text to the client.
- Don’t omit try/catch around `request.json()`, Supabase calls, or fetch to external services.
- Don’t log and then rethrow; log and return a response.

```ts
// Do: try/catch, log server-side, return safe message
try {
  const res = await fetch(EXTERNAL_URL, { ... })
  if (!res.ok) {
    const text = await res.text()
    logServerError('send-reminder', new Error(`Forward failed: ${res.status}`), { status: res.status, body: text.slice(0, 200) })
    return NextResponse.json(
      { error: getSafeMessage(502, 'Could not send reminder. Try again later.') },
      { status: 502 }
    )
  }
  return NextResponse.json({ ok: true })
} catch (err) {
  logServerError('send-reminder', err)
  return NextResponse.json(
    { error: getSafeMessage(502, 'Could not send reminder. Try again later.') },
    { status: 502 }
  )
}
```

```ts
// Don't: return raw error or skip logging
} catch (err) {
  return NextResponse.json(
    { error: err instanceof Error ? err.message : 'Error' },  // leaks internal/DB messages
    { status: 500 }
  )
}
```

```ts
// Don't: expose DB error to client
if (sessionError) {
  console.error('[coach/sessions] insert failed:', sessionError)
  return NextResponse.json(
    { error: sessionError.message ?? 'Could not create session' },  // DB message can leak
    { status: 500 }
  )
}
// Do: log and return safe message
if (sessionError) {
  logServerError('coach-sessions', sessionError, { op: 'insert' })
  return NextResponse.json(
    { error: getSafeMessage(500, 'Could not create session') },
    { status: 500 }
  )
}
```

---

## 3. API error response format

**Rule:** All error responses from API routes use the same shape and status codes. Client code can rely on `res.ok` and a single `error` string.

**Shape:**

- **Body:** `{ error: string }` — one user-facing message. No `message`, `details`, or `stack`.
- **Status:** Use standard HTTP status codes (400, 401, 403, 404, 429, 500, 502).

**Success body:** Can be anything (e.g. `{ id: '...' }`, `{ ok: true }`). Do not put an `error` key on success.

**Do:**

- Return `NextResponse.json({ error: getSafeMessage(status) }, { status })` for generic errors.
- Return `NextResponse.json({ error: getSafeMessage(status, 'Short safe override') }, { status })` when you have a specific, safe message (e.g. "Session has already passed").
- Keep error strings under 200 characters; `getSafeMessage` enforces this for overrides.

**Don't:**

- Don’t return `{ message: '...' }` or `{ error: string, stack: string }` or any extra debug fields to the client.
- Don’t return 200 with `{ error: '...' }`; use the correct status code.

```ts
// Do: consistent shape and status
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
return NextResponse.json({ error: getSafeMessage(404) }, { status: 404 })
return NextResponse.json({ error: getSafeMessage(500, 'Could not create session') }, { status: 500 })
```

```ts
// Don't: mixed keys or debug info
return NextResponse.json({ message: 'Not found' }, { status: 404 })
return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 })
```

**Client usage:**

```ts
const res = await fetch('/api/...')
const data = await res.json().catch(() => ({}))
if (!res.ok) {
  const message = data?.error ?? getSafeMessage(res.status) // or a fallback string
  toast.error(message)
  return
}
```

---

## 4. Component loading and error states

**Rule:** Distinguish loading from error. Show a loading UI (skeleton or spinner) while fetching; show a dedicated error state with retry when the fetch fails. Don’t show content and loading at the same time; don’t use the same UI for "empty list" and "error".

**Loading state:**

- Set `loading` to `true` before fetch, set to `false` after (success or failure).
- While `loading === true`, render a skeleton or spinner and return early; don’t render the main content yet.

**Error state:**

- Store an `error` string (or `null`) from the API response or catch block.
- When `error` is set, render an error UI: short message + retry action (and optionally a toast).
- After a successful retry, clear `error` and show content.

**Do:**

- Use a `loading` boolean and an `error` string (or null); set both in the same flow (e.g. `setLoading(true); setError(null)` then fetch, then `setLoading(false)` and on failure `setError(data?.error ?? '...')`).
- Prefer a skeleton (e.g. `PageSkeleton`) for full-page loading so layout doesn’t jump.
- For form submit, use a `submitting` flag and disable the submit button; show field errors or a single form error message, and optionally toast on failure.

**Don’t:**

- Don’t show the main content while `loading` is true.
- Don’t use the same block for "no data" and "error" (e.g. "No items" vs "Could not load items. Try again.").
- Don’t leave loading true forever on error; set `loading = false` and `error = message`.

```tsx
// Do: loading then content or error
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  let cancelled = false
  setError(null)
  fetchData()
    .then((data) => { if (!cancelled) setData(data) })
    .catch((e) => { if (!cancelled) setError(e.message ?? 'Something went wrong') })
    .finally(() => { if (!cancelled) setLoading(false) })
  return () => { cancelled = true }
}, [/* deps */])

if (loading) return <PageSkeleton />
if (error) return (
  <div className="...">
    <p>{error}</p>
    <Button onClick={() => { setError(null); setLoading(true); /* refetch */ }}>Try again</Button>
  </div>
)
return <div>{/* main content */}</div>
```

```tsx
// Don't: content and loading together, or no error state
if (loading) return <Spinner />
// missing: if (error) return <ErrorUI />
return <div>{data?.items?.length ? ... : 'No items'}</div>  // "No items" != "Failed to load"
```

---

## 5. Next.js error boundary files (error.tsx)

**Rule:** Use `error.tsx` (and optionally `global-error.tsx`) to catch React render errors and show a generic message with a retry. Log the error for debugging (or send to a reporting service); never render the error message or stack to the user.

**Placement:**

- **`app/error.tsx`** — catches errors in the same segment and below; wraps the segment layout. Renders within the app layout (nav, etc.).
- **`app/global-error.tsx`** — catches errors in the root layout; must render its own `<html>` and `<body>` because the root layout is not mounted.
- **`app/coach/error.tsx`**, **`app/client/error.tsx`** — optional; catch errors in those segments and show a segment-specific message.

**Pattern:**

- Component receives `error` (Error) and `reset()` (function).
- In `useEffect`, log the error (e.g. `console.error(error)` or send to reporting). Do not render `error.message` or `error.stack`.
- Render a short, generic message ("Something went wrong") and a "Try again" button that calls `reset()`.

**Do:**

- Use a single, generic user-facing message in the UI.
- Call `reset()` so the user can try again without a full refresh.
- In production, consider sending `error` (and optional `digest`) to an error reporting service instead of or in addition to `console.error`.

**Don’t:**

- Don’t render `error.message` or `error.stack` in the UI (they can leak internal info).
- Don’t forget to provide a retry (e.g. button that calls `reset()`).

```tsx
// Do: log in effect, generic UI, reset
'use client'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
    // in production: reportError(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <h1 className="text-xl font-semibold text-[var(--cp-text-primary)]">Something went wrong</h1>
      <p className="mt-2 text-sm text-[var(--cp-text-muted)] text-center max-w-md">
        We couldn’t complete your request. Please try again.
      </p>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </div>
  )
}
```

```tsx
// Don't: expose error details to user
return (
  <div>
    <p>{error.message}</p>
    <pre>{error.stack}</pre>
  </div>
)
```

**global-error.tsx:** Same idea; must render full document and minimal styles (root layout is not mounted). Use inline styles or a very small subset of design tokens so the page still renders if the rest of the app is broken.

---

## 6. Server-side logging (no stack traces to client)

**Rule:** Log errors and useful context server-side with `logError` from `@/lib/logger` or `logServerError` from `@/lib/api-error`. Never include stack traces, DB rows, or internal messages in API responses or in any client-visible output.

**Where to log:**

- **API routes:** Use `logServerError(tag, err, context)` in catch blocks and when handling failed Supabase/external calls. Tag = route or operation name (e.g. `'send-reminder'`, `'coach-sessions'`).
- **Server actions:** Use `sanitizeActionError(err, allowedMessage)` from `@/lib/api-error` — it logs and returns a safe string for the client.
- **One-off server code:** Use `logError(tag, message, context)` from `@/lib/logger`; context is sanitized (PII/secrets redacted).

**What to include in logs:**

- Tag, message, and optional context (e.g. `{ status: res.status, id }`). Do not log full request bodies with passwords or tokens; `lib/logger` redacts known keys.
- Stack is included automatically by `logServerError` when `err` is an `Error`; it stays server-side only.

**Do:**

- Use a consistent tag per route or feature so logs are searchable.
- Prefer `logServerError` in API routes so both logging and safe response are aligned.
- Keep context objects small and free of PII (or rely on logger redaction for known keys).

**Don’t:**

- Don’t send `err.stack`, `error.stack`, or any internal message in `NextResponse.json()` or in HTML.
- Don’t log full request/response bodies that might contain secrets; log status codes and safe identifiers.

```ts
// Do: log server-side with tag and safe context
logServerError('send-reminder', err)
logServerError('send-reminder', new Error(`Forward failed: ${res.status}`), { status: res.status, body: text.slice(0, 200) })
```

```ts
// Don't: include stack or internal message in response
return NextResponse.json({
  error: err instanceof Error ? err.message : 'Error',
  stack: err instanceof Error ? err.stack : undefined,
}, { status: 500 })
```

**Summary:**

| Layer            | Log / report                         | Expose to client                    |
|-----------------|--------------------------------------|------------------------------------|
| API route       | `logServerError(tag, err, context)`  | `getSafeMessage(status)` only      |
| Server action   | `sanitizeActionError(err)` (logs)    | Returned string only               |
| error.tsx       | `console.error(error)` or reporter   | Generic "Something went wrong"     |
| Component fetch | Optional toast from `data?.error`    | Message from API or fallback string |
