# D4 — Spacing & Layout: ClearPath V2

This document defines the spacing scale, page layout, sidebar structure, content grids, component spacing rules, and breakpoints for ClearPath V2. **Never use arbitrary spacing values outside the defined scale.** All values are expressed as Tailwind config and CSS custom properties for consistency with D1–D3.

---

## 1. Spacing Scale (8px Base Unit)

The spacing scale uses an **8px base unit**. Every spacing value in the app must come from this scale. No arbitrary values (e.g. `p-[13px]`, `gap-7`) except where this document explicitly allows.

| Token | Value | CSS Variable | Tailwind | Use |
|-------|--------|--------------|----------|-----|
| xs | 4px | `--space-xs` | `1` (4px) | Tight gaps (icon + label, inline badges) |
| sm | 8px | `--space-sm` | `2` (8px) | Default small gap, list item padding |
| — | 12px | `--space-12` | `3` (12px) | Between related form fields, compact sections |
| md | 16px | `--space-md` | `4` (16px) | Standard gap between elements, card grid gap |
| lg | 24px | `--space-lg` | `6` (24px) | Between subsections, list spacing |
| xl | 32px | `--space-xl` | `8` (32px) | Page padding (desktop), title-to-content |
| 2xl | 48px | `--space-2xl` | `12` (48px) | Between major sections |
| 3xl | 64px | `--space-3xl` | `16` (64px) | Large section separation |
| 4xl | 96px | `--space-4xl` | `24` (96px) | Hero / marketing spacing |

**Scale steps in order:** 4px (xs), 8px (sm), 12px, 16px (md), 24px (lg), 32px (xl), 48px (2xl), 64px (3xl), 96px (4xl).

### 1.1 Tailwind config (spacing)

```js
// tailwind.config.ts — theme.extend
spacing: {
  xs: '4px',   // 1 = 4px in default Tailwind; we alias for clarity
  sm: '8px',
  3: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
  '4xl': '96px',
  // Layout-specific (can use same scale)
  'sidebar': '240px',
  'content-max': '1200px',
  'page-padding-desktop': '32px',
  'page-padding-mobile': '16px',
  'card-inner': '20px',
}
```

Note: Tailwind’s default `1` = 4px, `2` = 8px, etc. Override only the steps above so `p-2` = 8px, `p-4` = 16px, `p-8` = 32px, `gap-6` = 24px, `gap-12` = 48px. Use semantic names (e.g. `space-lg`) when extending.

### 1.2 CSS custom properties (spacing)

```css
:root {
  /* Spacing scale — 8px base */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-12: 12px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
  --space-4xl: 96px;

  /* Layout */
  --layout-sidebar-width: 240px;
  --layout-content-max-width: 1200px;
  --layout-page-padding-desktop: 32px;
  --layout-page-padding-mobile: 16px;
  --layout-card-padding: 20px;

  /* Component spacing */
  --spacing-title-to-content: 32px;
  --spacing-between-sections: 48px;
  --spacing-between-cards: 16px;
}
```

---

## 2. Page Layout

- **Coach dashboard:** Fixed left sidebar + main content area.
- **Sidebar width:** 240px (desktop). Below 1024px the sidebar collapses to an icon rail (see Breakpoints).
- **Main content:** Max width 1200px. Content is centered within the remaining viewport.
- **Page padding:**
  - Desktop (≥1024px): 32px (`--space-xl`).
  - Mobile (&lt;768px): 16px (`--space-md`).
  - Tablet (768px–1023px): 16px unless a tablet-specific comp specifies 24px; otherwise 16px.

### 2.1 Tailwind / CSS

- Sidebar: `w-[240px]` or `width: var(--layout-sidebar-width)`.
- Main content wrapper: `max-w-[1200px]` or `max-width: var(--layout-content-max-width)`.
- Page padding: `p-8 lg:p-8` for 32px; on mobile use `p-4` (16px). So: `p-4 lg:p-8`.

```css
.main-content {
  max-width: var(--layout-content-max-width);
  padding: var(--layout-page-padding-mobile);
}
@media (min-width: 1024px) {
  .main-content {
    padding: var(--layout-page-padding-desktop);
  }
}
```

---

## 3. Sidebar Layout

The coach dashboard sidebar has three vertical zones:

| Zone | Position | Contents |
|------|----------|----------|
| Top | Sticky top | Logo (and optional app name) |
| Middle | Flexible | Primary nav items (Dashboard, Clients, Programs, etc.) |
| Bottom | Sticky bottom | Profile, settings, logout |

- Use flex column: `flex flex-col h-full`.
- Middle: `flex-1 overflow-y-auto` so nav scrolls if needed.
- Use spacing from the scale between logo and nav (e.g. 24px) and between nav and bottom block (e.g. 24px). Internal nav item spacing: 8px or 12px.

---

## 4. Content Grid

| Page type | Layout | Notes |
|-----------|--------|------|
| Most pages | Single column | Lists, forms, dashboards (e.g. Clients list, Settings) |
| Client detail | 2/3 + 1/3 | Main content (e.g. notes, sessions) 2/3; sidebar (profile, actions) 1/3 |
| Program builder | Full width | No max-width constraint; content uses full main area |

- Single column: one wrapper, no grid or `grid-cols-1`.
- Client detail: e.g. `grid grid-cols-1 lg:grid-cols-3` with main `lg:col-span-2` and sidebar `lg:col-span-1`. Gap between columns: 24px or 32px from scale.
- Program builder: `w-full` or `max-w-none` inside the main content area so it can exceed 1200px when needed.

---

## 5. Component Spacing Rules

| Context | Value | Scale token | Tailwind |
|---------|--------|-------------|----------|
| Page title to content below | 32px | xl | `mb-8` or `gap-8` |
| Between major sections | 48px | 2xl | `space-y-12` or `mb-12` |
| Between cards in a grid | 16px | md | `gap-4` |
| Padding inside a card | 20px | — | Use 20px only here: `p-5` (20px) or a custom `card-inner` token |

**20px card padding:** 20px is not on the 8px scale; it is the single exception for card inner padding. Define once (e.g. `--layout-card-padding: 20px` and Tailwind `card-inner: 20px`) and use everywhere for card padding so it stays consistent.

---

## 6. Breakpoints

| Name | Min width | CSS Variable | Use |
|------|-----------|--------------|-----|
| Mobile | 375px | `--bp-mobile` | Small phones (design minimum) |
| Tablet | 768px | `--bp-tablet` | Tablets, large phones |
| Desktop | 1024px | `--bp-desktop` | Sidebar full width; desktop layout |
| Wide | 1280px | `--bp-wide` | Large screens |

**Sidebar behavior:** At **&lt; 1024px** the dashboard sidebar collapses to an **icon rail** (icons only, no labels, narrow width). At ≥1024px the full 240px sidebar is shown.

### 6.1 Tailwind config (screens)

```js
// tailwind.config.ts — theme.extend
screens: {
  mobile: '375px',
  sm: '640px',   // keep Tailwind default if used
  tablet: '768px',
  md: '768px',
  desktop: '1024px',
  lg: '1024px',
  wide: '1280px',
  xl: '1280px',
  '2xl': '1536px',
}
```

Use `desktop:` for “full sidebar and desktop layout” (e.g. `hidden desktop:flex`, `w-0 desktop:w-[240px]` for sidebar).

### 6.2 CSS custom properties (breakpoints)

```css
:root {
  --bp-mobile: 375px;
  --bp-tablet: 768px;
  --bp-desktop: 1024px;
  --bp-wide: 1280px;
}
```

Use in media queries: `@media (min-width: var(--bp-desktop)) { ... }`.

---

## 7. Summary Checklist

- **Spacing:** Only use 4, 8, 12, 16, 24, 32, 48, 64, 96px (and 20px for card inner padding).
- **Page:** Sidebar 240px, content max 1200px, padding 32px (desktop) / 16px (mobile).
- **Sidebar:** Logo top → nav middle (flex-1) → profile/settings bottom.
- **Grid:** Single column (most), 2/3 + 1/3 (client detail), full width (program builder).
- **Components:** Title–content 32px, between sections 48px, between cards 16px, inside card 20px.
- **Breakpoints:** 375, 768, 1024, 1280; sidebar collapses to icon rail below 1024px.

Implement these via the Tailwind config and CSS variables above so spacing and layout stay consistent across ClearPath V2.
