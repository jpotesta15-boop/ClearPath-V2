---
name: form-validation
description: Standard form pattern with react-hook-form and Zod, field-level and general errors, submit disabling, server-side error handling, and form reset. Use when implementing or reviewing forms and API validation.
---

# Form validation (react-hook-form + Zod)

Use this pattern for all forms that need client-side validation, server round-trips, and clear error UX. Keeps validation in one place (Zod schema), integrates with API error responses, and avoids duplicate state.

---

## 1. Dependencies

Ensure these are installed:

- `react-hook-form` — form state and submission
- `@hookform/resolvers` — connects Zod schema to react-hook-form
- `zod` — schema and validation (already in project)

```bash
npm install react-hook-form @hookform/resolvers
```

---

## 2. Standard form setup

**Rules:**

- Define a **Zod schema** for the form shape; use it for both client validation and (optionally) API request/response validation.
- Use `useForm` with `zodResolver(schema)` so validation runs on change/blur/submit.
- Use `mode: 'onTouched'` or `mode: 'onBlur'` so errors show after user interaction; avoid `onChange` for every keystroke unless needed.
- Type the form with `z.infer<typeof schema>`.

**Exact pattern:**

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const myFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  message: z.string().min(10, 'At least 10 characters'),
})

type MyFormValues = z.infer<typeof myFormSchema>

function MyForm() {
  const form = useForm<MyFormValues>({
    resolver: zodResolver(myFormSchema),
    defaultValues: {
      name: '',
      email: '',
      message: '',
    },
    mode: 'onTouched',
  })
  // ...
}
```

---

## 3. Field-level validation errors

**Rule:** Show errors from `form.formState.errors` next to each field. Use `form.register('fieldName')` for native inputs so react-hook-form tracks value and error.

**Pattern:**

- Spread `...form.register('fieldName')` onto the input (or use `Controller` for custom components).
- After the input, render the error for that field when present.
- Optionally add `aria-invalid` and a class when there is an error so styling and a11y are correct.

```tsx
const { register, formState: { errors } } = form

<input
  {...register('name')}
  aria-invalid={!!errors.name}
  className={cn(errors.name && 'border-[var(--cp-accent-danger)]')}
/>
{errors.name && (
  <p className="mt-1 text-sm text-[var(--cp-accent-danger)]" role="alert">
    {errors.name.message}
  </p>
)}
```

Use the same pattern for each field; keep the error message source as `errors.fieldName?.message`.

---

## 4. General form error (non-field)

**Rule:** For errors that are not tied to a single field (e.g. “Something went wrong”, “Invalid credentials”), set a root error and show it above the submit button.

**Setting a root error:**

```tsx
form.setError('root', { type: 'manual', message: 'Something went wrong. Please try again.' })
```

**Rendering:**

```tsx
const { formState: { errors } } = form

{errors.root && (
  <div className="rounded-md border border-[var(--cp-accent-danger)] bg-[var(--cp-accent-danger-subtle)] px-3 py-2 text-sm text-[var(--cp-accent-danger)]" role="alert">
    {errors.root.message}
  </div>
)}
```

Place this block once near the top of the form or just above the submit button. Clear it when the user changes input or resubmits (e.g. in `onSubmit` by calling `form.clearErrors('root')` at the start if desired).

---

## 5. Disable submit during submission

**Rule:** Prevent double submit and show loading state by disabling the submit button while the request is in flight.

**Pattern:**

- Use `formState.isSubmitting` from react-hook-form. It is `true` from when `handleSubmit` runs your async `onSubmit` until the promise settles.
- Disable the button and optionally show loading text or a spinner.

```tsx
const { formState: { isSubmitting } } = form

<Button type="submit" disabled={isSubmitting}>
  {isSubmitting ? 'Saving…' : 'Save'}
</Button>
```

Do **not** maintain a separate `isLoading` state for the submit button; use `isSubmitting` so it stays in sync with react-hook-form’s submit lifecycle.

---

## 6. Server-side validation errors from API

**Rule:** When the API returns validation errors (e.g. 400 with field messages), map them into the form so they appear as field-level or root errors. Do not rely only on a toast or a single message if you have per-field errors.

**Typical API shape:** Either a single `message` or an object with field keys:

```ts
// Option A: single message
{ success: false, message: 'Invalid request' }

// Option B: field errors (common with Zod on server)
{ success: false, errors: { name: 'Name is required', email: 'Invalid email' } }
```

**In the form’s onSubmit (after calling the API):**

- If the response is 4xx, parse the body.
- For **field errors**: loop and call `form.setError(field, { type: 'server', message })`.
- For a **general error**: call `form.setError('root', { type: 'manual', message })`.
- Do **not** throw inside `onSubmit` if you want to keep the form open and show errors; return after setting errors.

```tsx
async function onSubmit(values: MyFormValues) {
  form.clearErrors('root')
  const res = await fetch('/api/my-endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (data.errors && typeof data.errors === 'object') {
      Object.entries(data.errors).forEach(([field, message]) => {
        if (field in values && typeof message === 'string') {
          form.setError(field as keyof MyFormValues, { type: 'server', message })
        }
      })
    } else if (data.message && typeof data.message === 'string') {
      form.setError('root', { type: 'manual', message: data.message })
    } else {
      form.setError('root', { type: 'manual', message: 'Something went wrong. Please try again.' })
    }
    return
  }
  // success path: reset form (see section 7)
}
```

Ensure your API route returns a consistent shape (e.g. `{ success: false, message?: string, errors?: Record<string, string> }`) so the client can always map it.

---

## 7. Reset form after success

**Rule:** After a successful submit, clear the form and optionally show a success state. Use react-hook-form’s `reset()` so default values and internal state are in sync.

**Pattern:**

- On success (after the API returns 2xx), call `form.reset()`.
- If you want to reset to specific values (e.g. keep some fields), pass them: `form.reset({ name: '', email: '', message: '' })` or the same as `defaultValues`.
- Optionally set a short-lived success message in state and clear root error before reset.

```tsx
if (!res.ok) {
  // ... set errors, return
}
form.clearErrors('root')
form.reset()
// Optional: setSuccessMessage('Saved!')
```

---

## 8. Complete working example (3 fields)

Form with **name**, **email**, and **message**; field-level errors, general error, disabled submit, server error handling, and reset on success. Uses this project’s `Button` and `Input` from `@/components/ui`.

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
})

type ContactFormValues = z.infer<typeof contactSchema>

export function ContactForm() {
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      message: '',
    },
    mode: 'onTouched',
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
    reset,
  } = form

  async function onSubmit(values: ContactFormValues) {
    clearErrors('root')
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      if (data.errors && typeof data.errors === 'object') {
        Object.entries(data.errors).forEach(([field, message]) => {
          if (field in values && typeof message === 'string') {
            setError(field as keyof ContactFormValues, { type: 'server', message })
          }
        })
      } else if (typeof data.message === 'string') {
        setError('root', { type: 'manual', message: data.message })
      } else {
        setError('root', { type: 'manual', message: 'Something went wrong. Please try again.' })
      }
      return
    }

    clearErrors('root')
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      {errors.root && (
        <div
          className="rounded-md border border-[var(--cp-accent-danger)] bg-[var(--cp-accent-danger-subtle)] px-3 py-2 text-sm text-[var(--cp-accent-danger)]"
          role="alert"
        >
          {errors.root.message}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-[var(--cp-text-primary)] mb-1">
          Name
        </label>
        <Input
          id="name"
          {...register('name')}
          aria-invalid={!!errors.name}
          className={cn(errors.name && 'border-[var(--cp-accent-danger)]')}
          placeholder="Your name"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-[var(--cp-accent-danger)]" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-[var(--cp-text-primary)] mb-1">
          Email
        </label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          aria-invalid={!!errors.email}
          className={cn(errors.email && 'border-[var(--cp-accent-danger)]')}
          placeholder="you@example.com"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-[var(--cp-accent-danger)]" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-[var(--cp-text-primary)] mb-1">
          Message
        </label>
        <textarea
          id="message"
          {...register('message')}
          aria-invalid={!!errors.message}
          className={cn(
            'flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm text-[var(--cp-text-primary)] border-[var(--cp-border-subtle)] bg-[var(--cp-bg-surface)] placeholder:text-[var(--cp-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cp-border-focus)] focus-visible:ring-offset-2 disabled:opacity-50',
            errors.message && 'border-[var(--cp-accent-danger)]'
          )}
          placeholder="Your message..."
        />
        {errors.message && (
          <p className="mt-1 text-sm text-[var(--cp-accent-danger)]" role="alert">
            {errors.message.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send message'}
      </Button>
    </form>
  )
}
```

**Summary:**

- **Schema:** Zod defines shape and messages; `zodResolver` wires it to the form.
- **Field errors:** `errors.name` / `errors.email` / `errors.message` with `role="alert"` and danger styling.
- **General error:** `errors.root` rendered once at the top.
- **Submit state:** `disabled={isSubmitting}` and “Sending…” label.
- **Server errors:** On non-ok response, `data.errors` → per-field `setError`, else `data.message` or fallback → root `setError`.
- **Reset:** On success, `clearErrors('root')` and `reset()`.

Use this pattern for any form that submits to an API and should show validation errors, loading state, and reset after success.
