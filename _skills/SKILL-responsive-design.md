---
name: responsive-design
description: ClearPath V2 responsive behavior — breakpoints, mobile nav (sidebar vs bottom bar), single-column layouts, coach/client mobile UX, touch targets (44px), and desktop-only flows. Use when building or reviewing any layout, nav, or component that must work from 375px to wide screens.
---

# Responsive design — ClearPath V2

Every component must behave correctly at mobile (375px), tablet (768px), desktop (1024px), and wide (1280px). This skill defines the exact breakpoints, nav pattern, layout rules, and touch targets. Follow the Tailwind do/don't examples for each rule.

---

## 1. Breakpoints and Tailwind config

**Breakpoints (min-width):**

| Name    | Width   | Use |
|--------|---------|-----|
| mobile | 375px   | Design target for smallest phones; test at this width. |
| tablet | 768px   | Large phones / small tablets; 2-column where appropriate. |
| desktop| 1024px  | Sidebar visible; full app chrome. |
| wide   | 1280px  | Max content width; comfortable reading. |

**Tailwind config:** Use Tailwind’s default `sm`, `md`, `lg`, `xl`, `2xl` but **map them** to ClearPath breakpoints so that:

- **Below 768px** = mobile (default, no prefix).
- **768px and up** = `md:` (tablet).
- **1024px and up** = `lg:` (desktop — sidebar, full nav).
- **1280px and up** = `xl:` (wide).

Add to `tailwind.config.ts` so that `lg` is 1024px (Tailwind’s default) and we use it consistently for “sidebar visible”:

```ts
// tailwind.config.ts — theme.extend
screens: {
  'sm': '640px',   // optional intermediate
  'md': '768px',
  'lg': '1024px',  // sidebar threshold
  'xl': '1280px',
  '2xl': '1536px',
}
```

**Rule:** All responsive classes use `md:` for tablet, `lg:` for desktop (sidebar), `xl:` for wide. Do not use arbitrary breakpoints (e.g. `min-[900px]:`).

**Do:**

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

**Don't:**

```tsx
<div className="grid grid-cols-1 min-[900px]:grid-cols-2">
```

---

## 2. Mobile nav pattern — sidebar vs bottom tab bar

- **At `lg` (1024px) and above:** Show the **sidebar**. Main content sits next to it; no bottom bar.
- **Below `lg` (1024px):** **Hide the sidebar completely.** Never show the sidebar on mobile. Replace it with a **fixed bottom tab bar** with exactly **4 items**: **Home, Clients, Calendar, Messages.**

**Implementation:**

- Sidebar: visible only with `hidden lg:flex` (or equivalent). Never visible below 1024px.
- Bottom bar: visible only below `lg`, e.g. `lg:hidden`, fixed to bottom, with 4 tabs: Home, Clients, Calendar, Messages. (Calendar = schedule/calendar route.)
- Main content: full width below `lg`; with sidebar offset at `lg:` (e.g. `lg:pl-[sidebar-width]`).
- Bottom bar height: use at least `min-h-[56px]` or `h-14` so taps are comfortable; add `pb-safe` if you support safe-area insets.

**Do:**

```tsx
{/* Sidebar: desktop only */}
<aside className="hidden lg:flex lg:flex-col lg:w-60 ...">

{/* Bottom nav: mobile/tablet only, 4 items */}
<nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden ...">
  <Link href="/coach">Home</Link>
  <Link href="/coach/clients">Clients</Link>
  <Link href="/coach/schedule">Calendar</Link>
  <Link href="/coach/messages">Messages</Link>
</nav>

{/* Main content: full width on mobile */}
<main className="flex-1 min-w-0 lg:pl-60 pb-20 lg:pb-0">
```

**Don't:**

```tsx
{/* Don't show sidebar on mobile */}
<aside className="flex flex-col w-60 ...">

{/* Don't use 5+ items in bottom bar or different set */}
<nav className="...">
  <Link>Home</Link>
  <Link>Clients</Link>
  <Link>Programs</Link>
  <Link>Videos</Link>
  <Link>Settings</Link>
</nav>
```

---

## 3. Single-column on mobile

These layouts **must** be single-column on mobile (default), then multi-column from tablet/desktop:

- **Client grid** (coach clients list): 1 column on mobile, then 2+ at `md:` or `lg:`.
- **Program modules** (client program view): one module per row on mobile; optional 2 columns at `md:` if content allows.
- **Dashboard stats** (e.g. cards with numbers): stack vertically on mobile; grid 2 or 3 columns at `md:` or `lg:`.

**Do:**

```tsx
{/* Client grid */}
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

{/* Program modules */}
<section className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-6">

{/* Dashboard stats */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

**Don't:**

```tsx
{/* Don't force multiple columns on small screens */}
<div className="grid grid-cols-3 gap-4">

{/* Don't use fixed min-width that overflows 375px */}
<div className="grid grid-cols-2 min-w-[400px] gap-4">
```

---

## 4. Coach dashboard on mobile

On viewports below `lg` (1024px):

- **Stats:** Stack vertically. Use `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3` or similar so at 375px there is only one column.
- **Sidebar:** Gone (see §2). Do not render a drawer or collapsible sidebar as the main nav on mobile; use the bottom bar only.
- **Content:** Full width. No sidebar offset; padding from container only (e.g. `px-4`).

**Do:**

```tsx
<div className="space-y-6">
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <StatCard />
    <StatCard />
    <StatCard />
    <StatCard />
  </div>
  <section className="w-full max-w-full min-w-0">...</section>
</div>
```

**Don't:**

```tsx
{/* Don't keep sidebar or sidebar space on mobile */}
<div className="flex">
  <aside className="w-60">...</aside>
  <div className="flex-1">...</div>
</div>

{/* Don't use horizontal scroll for stats on mobile */}
<div className="flex gap-4 overflow-x-auto">
```

---

## 5. Client portal on mobile (critical)

The **client portal is the most important mobile experience.** Program content, session details, and messages must all be **fully usable on a 375px-wide screen.**

- **Program content:** Single column; no side-by-side layout that squashes text. Use `w-full min-w-0`, avoid fixed widths. Typography and spacing readable at 375px.
- **Session details:** Stack date, time, type, link. Buttons (e.g. “Join”, “Reschedule”) full-width or large touch targets (see §6).
- **Messages:** Message list and thread must not overflow. Input and send button always visible; avoid keyboard covering critical UI (use appropriate padding / scroll).

**Do:**

```tsx
{/* Program content: single column, readable */}
<article className="w-full max-w-full min-w-0 px-4 space-y-4">
  <h1 className="text-lg font-semibold break-words">...</h1>
  <div className="prose prose-sm max-w-none">...</div>
</article>

{/* Session card: stacked, full-width actions */}
<div className="flex flex-col gap-3 p-4 rounded-lg border">
  <p className="text-sm">...</p>
  <button className="w-full min-h-[44px] py-3 ...">Join session</button>
</div>

{/* Messages: full width, no min-width */}
<div className="flex flex-col h-[80vh] min-h-0 w-full">
  <div className="flex-1 overflow-y-auto min-h-0">...</div>
  <form className="flex gap-2 p-2 shrink-0">...</form>
</div>
```

**Don't:**

```tsx
{/* Don't force wide min-width on client content */}
<div className="min-w-[400px]">

{/* Don't use tiny tap targets for primary actions */}
<button className="px-2 py-1">Join</button>

{/* Don't use multi-column for session list on mobile */}
<div className="grid grid-cols-2 gap-2">
```

---

## 6. Touch target rule (44×44px minimum)

Every tappable element (buttons, links, icon-only controls) must have a **minimum 44×44px** touch target on mobile so fingers can tap accurately.

- Use **`py-3`** or **`min-h-[44px]`** (and sufficient horizontal padding or `min-w-[44px]` for icon buttons) for buttons and primary links.
- For inline links in text, ensure padding or line-height so the effective tap area is at least 44px tall where possible, or use a dedicated button-style control on mobile.

**Do:**

```tsx
<button className="py-3 px-4 rounded-lg ...">Save</button>
<button className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg ...">
  <Icon />
</button>
<Link href="..." className="inline-flex items-center min-h-[44px] py-3 ...">View program</Link>
```

**Don't:**

```tsx
<button className="px-2 py-1 text-sm">Save</button>
<a href="..." className="text-blue-600"><Icon className="w-4 h-4" /></a>
```

---

## 7. Desktop-only flows — no mobile layout

These flows are **desktop-only**: program builder, video import, admin panel. On viewports below `lg` (1024px), **do not** render the full complex layout. Instead show a single **“Please use a desktop or tablet (1024px+) for this”** (or similar) message so the user is not left with a broken or unusable UI.

- **Program builder:** Desktop only.
- **Video import:** Desktop only.
- **Admin panel:** Desktop only.

**Do:**

```tsx
export function ProgramBuilderPage() {
  return (
    <>
      <div className="lg:hidden flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
        <p className="text-[var(--cp-text-muted)]">
          Please use a desktop or tablet (1024px or wider) for the program builder.
        </p>
      </div>
      <div className="hidden lg:block">
        {/* Full program builder UI */}
      </div>
    </>
  )
}
```

**Don't:**

```tsx
{/* Don't try to make program builder/video import/admin work on 375px */}
<div className="w-full overflow-x-auto">
  <div className="min-w-[1200px]">...</div>
</div>
```

---

## Summary checklist

- **Breakpoints:** `md` 768px, `lg` 1024px (sidebar threshold), `xl` 1280px; no arbitrary breakpoints.
- **Nav:** Sidebar only at `lg+`; below `lg`, bottom bar only with 4 items: Home, Clients, Calendar, Messages; never show sidebar on mobile.
- **Single-column on mobile:** Client grid, program modules, dashboard stats use `grid-cols-1` by default, then `md:`/`lg:` for columns.
- **Coach dashboard mobile:** Stats stack; no sidebar; content full width.
- **Client portal mobile:** Program content, session details, and messages fully usable at 375px; single column, no squashed text or tiny buttons.
- **Touch targets:** Minimum 44×44px; use `py-3` or `min-h-[44px]` (and `min-w-[44px]` for icon buttons) for all tappable elements.
- **Desktop-only:** Program builder, video import, admin panel show “please use desktop” below `lg`; do not render the full layout on small screens.
