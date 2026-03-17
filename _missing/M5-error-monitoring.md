# M5 — Error monitoring (ClearPath V2)

This document describes the minimum error monitoring setup for ClearPath V2 using Sentry (free tier), plus health checks and Vercel logs. Use this before taking paying customers.

---

## 1. Sentry setup: install and configuration

### 1.1 Install and run the wizard

```bash
npx @sentry/wizard@latest -i nextjs
```

The wizard will:

- Install `@sentry/nextjs`
- Prompt for your Sentry org and project (or create a new project)
- Create or update config files and `next.config`
- Optionally create `.env.sentry-build-plugin` for source map uploads (CI)

Use a **public DSN** so client and server can send events. Add to `.env.local`:

```env
NEXT_PUBLIC_SENTRY_DSN=https://xxxx@xxxx.ingest.sentry.io/xxxx
```

For source maps in production (optional but recommended), set in your CI/Vercel env:

```env
SENTRY_AUTH_TOKEN=<token from Sentry Settings → Auth Tokens>
```

### 1.2 Exact configuration files

Sentry’s current Next.js setup uses **three** SDK entry points plus **one** instrumentation file. Keep these in the **project root** (or in `src/` if your app lives there).

#### `instrumentation-client.ts` (client-side)

Client-side SDK init. Named `instrumentation-client.ts` in the official Next.js guide (replaces the older `sentry.client.config.ts` pattern).

```ts
// instrumentation-client.ts (project root)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  sendDefaultPii: false, // set true only if you need IP/headers and have a privacy policy

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  environment: process.env.NODE_ENV,
});
```

#### `sentry.server.config.ts` (Node.js server)

Loaded only in the Node.js runtime (API routes, Server Components, server actions).

```ts
// sentry.server.config.ts (project root)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  environment: process.env.NODE_ENV,
});
```

#### `sentry.edge.config.ts` (Edge runtime)

Loaded only in the Edge runtime (middleware, edge API routes).

```ts
// sentry.edge.config.ts (project root)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  environment: process.env.NODE_ENV,
});
```

#### `instrumentation.ts` (register server/edge and capture request errors)

Next.js loads this once. It imports the server and edge configs and registers `onRequestError` so unhandled errors in Server Components, middleware, and route handlers are sent to Sentry.

```ts
// instrumentation.ts (project root)
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
```

#### `next.config.ts` (wrap with Sentry)

```ts
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // ... your existing config (headers, etc.)
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "your-org-slug",
  project: process.env.SENTRY_PROJECT ?? "clearpath-v2",

  silent: !process.env.CI,

  authToken: process.env.SENTRY_AUTH_TOKEN,

  widenClientFileUpload: true,
});
```

Set `SENTRY_ORG` and `SENTRY_PROJECT` in CI/Vercel if you prefer not to hardcode them.

### 1.3 Capture React render errors (App Router)

Create `app/global-error.tsx` so errors in the React tree are reported to Sentry:

```tsx
// app/global-error.tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
```

---

## 2. Capturing errors in API routes

Wrap route handler logic in try/catch and call `Sentry.captureException` so every server error is reported, even when you return a safe JSON response.

Pattern:

```ts
// app/api/your-route/route.ts
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { getSafeMessage, logServerError } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    // ... auth, validation, DB, external APIs ...
    return NextResponse.json({ data: result });
  } catch (err) {
    logServerError("your-route", err, { requestId: request.headers.get("x-vercel-id") });
    Sentry.captureException(err);
    return NextResponse.json(
      { error: getSafeMessage(500) },
      { status: 500 }
    );
  }
}
```

- Keep using `logServerError` for your existing logs (e.g. Vercel / log drains).
- Add `Sentry.captureException(err)` so Sentry gets the same error with stack and context.
- Return only safe messages to the client via `getSafeMessage`.

Apply this pattern to all API routes that can throw (DB, Stripe, Supabase, etc.). You can centralize in a small wrapper if you prefer:

```ts
// lib/withSentryHandler.ts (optional)
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { getSafeMessage, logServerError } from "@/lib/api-error";

export function withSentryHandler<T extends Request>(
  tag: string,
  handler: (req: T) => Promise<NextResponse>
) {
  return async (req: T) => {
    try {
      return await handler(req);
    } catch (err) {
      logServerError(tag, err, {});
      Sentry.captureException(err);
      return NextResponse.json({ error: getSafeMessage(500) }, { status: 500 });
    }
  };
}
```

---

## 3. User context (coach or client who triggered the error)

Set user context after auth so every Sentry event (client and server) is tied to the current user. That way you can see “which coach or client hit this error.”

### 3.1 Server-side (layouts, API routes, server actions)

After you resolve the current user (e.g. from Supabase `getUser()` and `profiles`), set context once per request:

```ts
import * as Sentry from "@sentry/nextjs";

// After auth, e.g. in a layout or API route:
const { data: { user } } = await supabase.auth.getUser();
const profile = await getProfile(supabase, user?.id);

if (user && profile) {
  Sentry.setUser({
    id: user.id,
    email: user.email ?? undefined,
    role: profile.role,           // "coach" | "client"
    // Do not set PII you don’t need; avoid full name if not required.
  });
}
```

In API routes, call `Sentry.setUser` after you validate the session and load the profile. In layouts, you can set it at the top of the layout so all server-rendered errors for that request carry the same user.

### 3.2 Client-side

If you have a client-side auth provider or layout that knows the user, set the same context there so client-side errors are attributed:

```ts
import * as Sentry from "@sentry/nextjs";

// After you have user + profile (e.g. from React context or a hook):
Sentry.setUser({
  id: user.id,
  email: user.email ?? undefined,
  role: profile.role,
});
```

Clear user on logout:

```ts
Sentry.setUser(null);
```

---

## 4. Custom tags (e.g. filter by coach / workspace)

Tag events with `workspace_id` (or current tenant identifier) so you can filter in Sentry by coach/workspace. Use the same identifier you use for RLS and multi-tenant logic.

### 4.1 Server-side

After you know the current workspace/tenant (e.g. from profile or `getClientId()`):

```ts
import * as Sentry from "@sentry/nextjs";

// Once per request, after auth and resolving tenant/workspace:
Sentry.setTag("workspace_id", workspaceIdOrTenantId);
// Optional:
Sentry.setTag("role", profile.role);
```

If you don’t have `workspaces` yet (T1 not applied), use your current tenant id:

```ts
Sentry.setTag("workspace_id", getClientId()); // or tenant_id from profile
```

### 4.2 Client-side

Set the same tag after the client knows the workspace/tenant (e.g. from layout or context):

```ts
Sentry.setTag("workspace_id", tenantId);
```

In Sentry: **Issues → filter by tag `workspace_id`** to see errors for a specific coach/workspace.

---

## 5. Vercel logs

- **Quick debugging:** Use **Vercel Dashboard → Project → Logs** (or “Log Explorer” where available) to inspect function logs, build logs, and edge logs. Filter by time, path, status code, or log level.
- **Persistent / advanced:** **Log Drains** (Pro/Enterprise) send logs to an HTTP endpoint or a supported logging service (e.g. Datadog, Axiom, Better Stack). Configure under **Project Settings → Log Drains**. Useful for retention, search, and alerting beyond Vercel’s UI.

For the minimum needed before paying customers, the built-in Log Explorer is enough; add a log drain later if you need long-term retention or external alerting.

---

## 6. Health route for uptime monitoring

Use a single `/api/health` route that:

- Returns **200** with a **timestamp** when the app is up (for uptime monitors like UptimeRobot).
- Optionally performs readiness checks (env, DB) and returns **503** when not ready (so orchestrators can avoid sending traffic).

Existing behavior in this repo:

- **200** when required env vars are set and the DB is reachable, with `ok: true` and `timestamp` (ISO string).
- **503** when env is missing or DB is unavailable, with a short `reason` and no stack/details.

Example response for “up”:

```json
{ "ok": true, "timestamp": "2025-03-15T12:00:00.000Z" }
```

**UptimeRobot (free):**

1. Create a monitor with URL `https://your-domain.com/api/health`.
2. Set “Check interval” (e.g. 5 minutes).
3. Expect status **200** and optionally assert response body contains `"ok":true` or the `timestamp` field.

No separate “liveness” endpoint is required; the same route serves both liveness (200 + timestamp) and readiness (503 when not ready).

---

## 7. One Sentry alert: email when a new error type appears

Configure a single issue alert so you get an email when a **new** issue (new error type) is created:

1. In Sentry: **Project → Alerts → Create Alert** (or **Alerts → Issue Alerts**).
2. **Alert type:** Issue Alert.
3. **When:** “A new issue is created” (or “The issue’s state changes from unresolved to resolved” is not what you want here; pick the trigger that means “new issue”).
4. **Then:** Add action **Send a notification** → choose **Email** and select yourself (or the team).
5. Save.

Result: every time Sentry creates a new issue (new error type/fingerprint), you get an email. Optionally add a second alert for “An issue changes state to resolved” if you want to know when something is fixed.

---

## Summary checklist

| Item | Done |
|------|------|
| Install `@sentry/nextjs`, run wizard, add DSN to env | ☐ |
| Add `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts` | ☐ |
| Wrap `next.config` with `withSentryConfig` | ☐ |
| Add `app/global-error.tsx` and call `Sentry.captureException` | ☐ |
| API routes: try/catch + `logServerError` + `Sentry.captureException` | ☐ |
| Set `Sentry.setUser` after auth (server and client) | ☐ |
| Set `Sentry.setTag("workspace_id", ...)` (or tenant id) | ☐ |
| Use Vercel Log Explorer (and optional log drain later) | ☐ |
| `/api/health` returns 200 with timestamp when ok | ☐ |
| UptimeRobot monitor pointing at `/api/health` | ☐ |
| Sentry issue alert: “New issue created” → email me | ☐ |

This is the minimum monitoring needed before taking paying customers.
