---
name: accessibility
description: ClearPath V2 accessibility standard — focus states, colour contrast (WCAG AA), semantic HTML, ARIA labels, images/icons, and loading states. Use when building or reviewing any component to ensure keyboard, screen-reader, and visual accessibility.
---

# Accessibility — ClearPath V2

Every component must meet this accessibility standard. The rules cover focus, contrast, semantics, ARIA, images/icons, and loading states. Follow the do/don't examples for each rule.

---

## 1. Focus states

**Rule:** Every interactive element (buttons, links, inputs, select menus) must have a **visible focus ring**. Use `focus-visible:ring-2 focus-visible:ring-[accent-color] focus-visible:ring-offset-2`. Never remove focus outlines without replacing them with a visible alternative.

**Do:**

```tsx
<button
  type="button"
  className="rounded-lg bg-primary px-4 py-2 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
>
  Save
</button>

<a
  href="/coach/clients"
  className="text-link underline focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:rounded"
>
  View clients
</a>

<input
  type="text"
  className="border rounded px-3 py-2 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
/>
```

**Don't:**

```tsx
{/* No focus ring — keyboard users cannot see focus */}
<button className="rounded bg-primary px-4 py-2">Save</button>

{/* Removing outline without replacement — forbidden */}
<button className="rounded bg-primary px-4 py-2 outline-none">Save</button>

{/* Only :focus (not focus-visible) — ring shows on mouse click too; prefer focus-visible for keyboard-only ring */}
<button className="rounded bg-primary px-4 py-2 focus:ring-2">Save</button>
```

---

## 2. Colour contrast

**Rule:** All body text must meet **WCAG AA** minimum **4.5:1** contrast ratio against its background. Use **#1A1A1A** on **#FFFFFF** for body text (18.1:1). Use **#6B6B6B** on white for **labels/secondary text only** (5.7:1). Never use lower-contrast greys for body copy.

**Do:**

```tsx
<p className="text-[#1A1A1A] bg-white">
  This is body text and meets WCAG AA.
</p>

<label className="text-[#6B6B6B]">Email address</label>
<input type="email" className="text-[#1A1A1A]" />

{/* Tailwind: use semantic tokens that map to these values */}
<p className="text-gray-900">Body text</p>
<span className="text-gray-600">Label or secondary only</span>
```

**Don't:**

```tsx
{/* Too low contrast for body text — fails AA */}
<p className="text-gray-500">This is hard to read.</p>

{/* Placeholder-style grey for body — never */}
<p className="text-[#9CA3AF]">Main content</p>

{/* Use #6B6B6B only for labels/captions, not paragraphs */}
<p className="text-[#6B6B6B]">Long paragraph of body copy…</p>
```

---

## 3. Semantic HTML

**Rule:** Use **`<button>`** for buttons (never `div` or `span` with `onClick`). Use **`<nav>`** for navigation. Use **`<main>`** for the main content area. Use **`h1` / `h2` / `h3`** in **logical order** — never skip heading levels (e.g. no `h1` then `h3`).

**Do:**

```tsx
<button type="button" onClick={handleSave}>
  Save changes
</button>

<nav aria-label="Main">
  <Link href="/coach">Home</Link>
  <Link href="/coach/clients">Clients</Link>
</nav>

<main>
  <h1>Dashboard</h1>
  <section>
    <h2>Recent activity</h2>
    <h3>This week</h3>
  </section>
</main>
```

**Don't:**

```tsx
{/* Not a button — bad for a11y and keyboard */}
<div role="button" onClick={handleSave}>Save</div>
<span onClick={handleSave}>Save</span>

{/* Navigation not in nav */}
<div className="flex gap-4">
  <Link href="/coach">Home</Link>
</div>

{/* Main content not in main */}
<div className="content">
  <h1>Dashboard</h1>
</div>

{/* Skipped heading level */}
<h1>Dashboard</h1>
<h3>Recent activity</h3>
```

---

## 4. ARIA labels

**Rule:** Every **icon button** needs **`aria-label="description"`**. Every **form input** needs a **visible label** (not just placeholder text). Every **modal** needs **`aria-modal="true"`** and **focus trapped** inside it.

**Do:**

```tsx
<button
  type="button"
  aria-label="Close dialog"
  className="p-2 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
>
  <XIcon className="w-5 h-5" aria-hidden="true" />
</button>

<label htmlFor="email">Email</label>
<input id="email" type="email" placeholder="you@example.com" />

<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  onKeyDown={trapFocus}
>
  <h2 id="modal-title">Confirm action</h2>
  <button type="button">Cancel</button>
  <button type="button">Confirm</button>
</div>
```

**Don't:**

```tsx
{/* Icon button with no accessible name */}
<button type="button"><XIcon /></button>

{/* Input with only placeholder — no visible label */}
<input type="email" placeholder="Email" />

{/* Modal without aria-modal or focus trap */}
<div className="modal">
  <h2>Confirm</h2>
  <button>Cancel</button>
  <button>Confirm</button>
</div>
```

---

## 5. Images and icons

**Rule:** Every **`<img>`** needs an **`alt`** attribute (use `alt=""` only for decorative images). **Decorative** icons get **`aria-hidden="true"`**. **Meaningful** (standalone) icons get **`aria-label`** on the button/link, or the icon is wrapped in a labeled control.

**Do:**

```tsx
<img src="/logo.svg" alt="ClearPath logo" />

<img src="/decorative-line.svg" alt="" role="presentation" />

<button aria-label="Delete client">
  <TrashIcon className="w-5 h-5" aria-hidden="true" />
</button>

<span className="flex items-center gap-2">
  <CheckIcon className="w-5 h-5 text-green-600" aria-hidden="true" />
  Saved
</span>
```

**Don't:**

```tsx
{/* Missing alt */}
<img src="/logo.svg" />

{/* Decorative icon without aria-hidden — can be announced */}
<button><TrashIcon /></button>

{/* Standalone meaningful icon with no label */}
<button><SettingsIcon /></button>
```

---

## 6. Loading states

**Rule:** When content is **loading**, use **`aria-busy="true"`** on the **container** and **`aria-live="polite"`** on the element that **updates when loading completes**. This lets assistive tech announce the loading state and the arrival of content.

**Do:**

```tsx
<div aria-busy={isLoading} aria-live="polite">
  {isLoading ? (
    <p>Loading…</p>
  ) : (
    <ul>{items.map((i) => <li key={i.id}>{i.name}</li>)}</ul>
  )}
</div>

<section aria-busy={fetching} aria-live="polite">
  {fetching && <span className="sr-only">Loading clients</span>}
  {!fetching && <ClientList clients={clients} />}
</section>
```

**Don't:**

```tsx
{/* No aria-busy or aria-live — screen readers get no loading feedback */}
<div>
  {isLoading ? <Spinner /> : <Content />}
</div>

{/* aria-live on wrong element or missing container state */}
<div>
  <div aria-live="polite">{data}</div>
</div>
```

---

## Summary

| Rule            | Requirement |
|-----------------|-------------|
| Focus           | `focus-visible:ring-2 focus-visible:ring-[accent] focus-visible:ring-offset-2` on all interactive elements; never remove outline without replacement. |
| Contrast        | Body text `#1A1A1A` on white; secondary/labels `#6B6B6B` on white only. |
| Semantics       | `<button>`, `<nav>`, `<main>`; heading order `h1` → `h2` → `h3` with no skips. |
| ARIA            | Icon buttons: `aria-label`; inputs: visible `<label>`; modals: `aria-modal="true"` + focus trap. |
| Images/icons    | `img` has `alt`; decorative icons `aria-hidden="true"`; meaningful icons in labeled controls. |
| Loading         | Container `aria-busy="true"`; updating region `aria-live="polite"`. |
