---
name: supabase-patterns
description: Correct Supabase client usage (server vs client vs admin), typed queries, error handling, loading/error/success fetch pattern, and RLS for coach-owns-client data. Use when writing or reviewing Supabase data access, API routes, or RLS policies.
---

# Supabase patterns

## 1. Which client to use

| Context | Import | Usage |
|--------|--------|--------|
| **Client components** (browser) | `import { createClient } from '@/lib/supabase/client'` | Uses `createBrowserClient`; one instance per app, runs in browser. |
| **Server components, Server Actions, Route Handlers that need user session** | `import { createClient } from '@/lib/supabase/server'` | Uses `createServerClient` with cookies; **async**: `const supabase = await createClient()`. |
| **Route Handlers (e.g. auth callback)** | `import { createServerClient } from '@supabase/ssr'` | Build client manually with `cookies()` and cookie get/set so cookies are written. Do **not** use `@/lib/supabase/server` in route handlers that must set auth cookies (e.g. OAuth callback). |
| **API routes / server-only, bypass RLS** | `import { createServiceClient } from '@/lib/supabase/service'` | Service role key; **never** expose to client or use for user-scoped reads when RLS should apply. Use only when you need to bypass RLS (webhooks, server-side admin). |

**Rules:**

- **Client components** → `@/lib/supabase/client` only; never server or service.
- **Server Actions / Server Components** → `@/lib/supabase/server` with `await createClient()`.
- **Route Handlers that set auth cookies** (e.g. `/auth/callback`) → `createServerClient` from `@supabase/ssr` with cookie adapter.
- **Service client** → Only in API routes or server code; after validating the acting user with the anon/server client, use service client only for operations that must bypass RLS (e.g. lookup by id without session).

---

## 2. Data fetch: loading / error / success

Use a single pattern so every fetch is predictable.

**Server (Server Components / Actions):**

- Always destructure both `data` and `error`.
- Check `error` first; if present, return a safe response or throw/handle; only then use `data`.
- For optional rows use `.maybeSingle()` and treat `data === null` as “not found”.

**Client (React):**

- Use explicit state: `loading`, `error`, and the success payload (e.g. `data`).
- Set `loading = true` at start, then either `error = message` and `loading = false` or `data = result` and `loading = false`.
- Render: if `loading` show skeleton/spinner; if `error` show error UI; else render from `data`.

**Example (client):**

```tsx
const [data, setData] = useState<Row[] | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  let cancelled = false
  async function fetch() {
    const supabase = createClient() // from @/lib/supabase/client
    const { data: result, error: err } = await supabase
      .from('table_name')
      .select('id, name')
      .eq('coach_id', userId)
    if (cancelled) return
    if (err) {
      setError(err.message)
      setData(null)
    } else {
      setError(null)
      setData(result ?? [])
    }
    setLoading(false)
  }
  fetch()
  return () => { cancelled = true }
}, [userId])

if (loading) return <Skeleton />
if (error) return <ErrorMessage message={error} />
return <List items={data ?? []} />
```

**Example (server action):**

```ts
const supabase = await createClient()
const { data, error } = await supabase
  .from('clients')
  .select('id, full_name')
  .eq('id', clientId)
  .eq('coach_id', user.id)
  .single()

if (error) return { error: 'Failed to load client' }
if (!data) return { error: 'Client not found' }
// use data
```

---

## 3. Typed queries

- Prefer a shared `Database` type (e.g. from `supabase gen types typescript`) and pass it into the Supabase client type so `.from('table')` and `.select()` are typed.
- If no generated types yet, type the **result** of the query:

```ts
type ClientRow = {
  id: string
  coach_id: string
  full_name: string | null
  email: string | null
  // ...
}

const { data, error } = await supabase
  .from('clients')
  .select('id, coach_id, full_name, email')
  .eq('id', id)
  .single()

const client = data as ClientRow | null
```

- For inserts/updates, use a type for the payload so required columns and types are enforced.

---

## 4. Error handling: never use `.data` without checking `.error`

Every Supabase query returns `{ data, error }`. **Always** handle `error` before trusting `data`.

**Correct:**

```ts
const { data, error } = await supabase.from('clients').select('*').eq('id', id).single()
if (error) {
  console.error('[fetchClient]', error)
  return { error: error.message }
}
if (!data) return { error: 'Not found' }
// use data
```

**Correct (insert/update):**

```ts
const { error } = await supabase.from('payments').insert(payload)
if (error) return { error: error.message }
```

**Wrong:**

- Using only `const { data } = await supabase...` and then using `data` without checking `error`.
- Using only `const { data: client } = await supabase...` and then `if (!client)` without checking `error` (you cannot distinguish “row not found” from “permission denied” or “DB error”).
- In `Promise.all` results, using `res.data` without checking `res.error` for each result.

---

## 5. RLS pattern: coach-owns-client data

Tables that belong to a coach (clients, sessions, programs, etc.) have a `coach_id` column. RLS must restrict access so that:

- Coaches see only rows where they are the owner (and optionally in the same tenant).
- Clients see only rows that belong to them (e.g. via `client_id` or email match).

**Standard coach policy (single-tenant or tenant-aware):**

- **Simple (no tenant):** `coach_id = auth.uid()`.
- **With tenant:** coach must be the current user and in the same tenant; table may have `client_id` (tenant id) and `coach_id`.

**Example – coach can manage rows in their tenant:**

```sql
CREATE POLICY "Coaches can manage <table> in their tenant"
ON public.<table_name>
FOR ALL
USING (
  client_id = get_current_client_id()
  AND coach_id IN (
    SELECT id FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'coach'
      AND tenant_id = get_current_client_id()
  )
);
```

**Example – simpler (coach_id only):**

```sql
CREATE POLICY "Coaches can manage client_time_requests in their tenant"
ON public.client_time_requests
FOR ALL
USING (coach_id = auth.uid());
```

**Client-side policies:** For tables that clients read (e.g. their own session_requests), use something like:

```sql
USING (
  email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  AND client_id = get_current_client_id()
);
```

Always scope by both identity (`auth.uid()` or email) and tenant where the schema has a tenant column.

---

## 6. Bad patterns to never use

**Bad 1: Using only `data`, ignoring `error`**

```ts
const { data: client } = await supabase.from('clients').select('*').eq('id', id).single()
if (!client) return null
```

Problems: You cannot tell “not found” from “RLS denied” or “DB error”. Users may see “not found” when the real issue is permission or server error. Fix: always destructure `error`, check it first, then use `data`.

---

**Bad 2: Service client for user-scoped reads**

```ts
const supabaseAdmin = createServiceClient()
const { data: client } = await supabaseAdmin.from('clients').select('*').eq('id', clientId).single()
// then use client without verifying coach_id === currentUser.id
```

Problems: Bypasses RLS; any caller could request any client id. Fix: Either use the server/client Supabase (with session) so RLS applies, or if you must use service client (e.g. in a webhook), after fetch **assert** ownership (e.g. `if (client.coach_id !== currentUser.id) return 404`) and never expose raw service client to the client.

---

**Bad 3: Client component using server or service client**

```ts
// in a 'use client' component
import { createClient } from '@/lib/supabase/server'
// or
import { createServiceClient } from '@/lib/supabase/service'
```

Problems: Server client is async and uses server cookies; service client exposes the service role. Fix: In client components use only `import { createClient } from '@/lib/supabase/client'`.

---

## Summary checklist

- [ ] Client component → `@/lib/supabase/client` only.
- [ ] Server Action / Server Component → `@/lib/supabase/server`, `await createClient()`.
- [ ] Route Handler that sets auth cookies → `createServerClient` from `@supabase/ssr` with cookies.
- [ ] Need to bypass RLS (webhooks, admin) → `createServiceClient()` in server-only code; always validate ownership when acting on behalf of a user.
- [ ] Every query: destructure `error` and check it before using `data`.
- [ ] Client fetches: explicit loading, error, and success state; render accordingly.
- [ ] RLS for coach-owned tables: restrict by `coach_id` (and tenant where applicable); for client-facing tables restrict by auth.uid()/email and tenant.
