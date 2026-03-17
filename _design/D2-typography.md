# D2 — Typography System: ClearPath V2

This document defines the complete typography system for ClearPath, including font choice, type scale, weights, line heights, letter spacing, and implementation as CSS custom properties and Tailwind config.

---

## 1. Font Choice

**Primary typeface:** [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) (Google Fonts).

Plus Jakarta Sans is a clean, geometric sans-serif with excellent readability at UI and body sizes, a slightly warm character that fits a coaching context, and a full weight range that supports the restricted scale (400, 500, 600) without feeling flat.

**Google Fonts import (add to `<head>` or global CSS):**

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
```

Use **400 (regular), 500 (medium), and 600 (semibold)** only in the app. Reserve **700 (bold)** for marketing or landing headlines outside the main product UI.

---

## 2. Type Scale (CSS Custom Properties)

| Token       | Size  | CSS Variable           |
|------------|-------|-------------------------|
| Display    | 48px  | `--text-display`        |
| H1         | 36px  | `--text-h1`             |
| H2         | 28px  | `--text-h2`             |
| H3         | 22px  | `--text-h3`             |
| H4         | 18px  | `--text-h4`             |
| Body large | 17px  | `--text-body-lg`        |
| Body       | 15px  | `--text-body`           |
| Body small | 13px  | `--text-body-sm`        |
| Caption    | 12px  | `--text-caption`        |

---

## 3. Font Weights

| Weight | Value | CSS Variable     | Use |
|--------|--------|------------------|-----|
| Regular | 400  | `--font-weight-regular`  | Body copy, descriptions |
| Medium  | 500  | `--font-weight-medium`  | Subheadings, labels, emphasis |
| Semibold | 600 | `--font-weight-semibold` | Headings, nav, buttons |
| Bold    | 700  | **Not used in app UI** — only for marketing/landing headlines |

---

## 4. Line Heights

| Context   | Value | CSS Variable        |
|-----------|-------|---------------------|
| Headings  | 1.2   | `--leading-heading` |
| Body      | 1.6   | `--leading-body`    |
| Captions  | 1.4   | `--leading-caption` |

---

## 5. Letter Spacing

| Context         | Value   | CSS Variable           |
|-----------------|---------|-------------------------|
| Headings        | -0.02em | `--tracking-heading`    |
| Uppercase labels| 0.08em  | `--tracking-uppercase`  |
| Body            | 0       | `--tracking-body`       |

---

## 6. Text Styles Reference Table

| Style name   | Font size | Weight | Line height | Letter spacing | Use case |
|-------------|-----------|--------|-------------|----------------|----------|
| Display     | 48px      | 600    | 1.2         | -0.02em        | Hero, splash titles |
| H1          | 36px      | 600    | 1.2         | -0.02em        | Page titles |
| H2          | 28px      | 600    | 1.2         | -0.02em        | Section headers |
| H3          | 22px      | 600    | 1.2         | -0.02em        | Card titles, subsections |
| H4          | 18px      | 500    | 1.2         | -0.02em        | Small headings, list titles |
| Body large  | 17px      | 400    | 1.6         | 0             | Intro paragraphs, summaries |
| Body        | 15px      | 400    | 1.6         | 0             | Default body copy |
| Body small  | 13px      | 400    | 1.6         | 0             | Secondary text, compact UI |
| Caption     | 12px      | 400    | 1.4         | 0             | Labels, timestamps, metadata |
| Label caps  | 12px      | 500    | 1.4         | 0.08em        | Uppercase labels, badges |

---

## 7. Implementation

### 7.1 CSS Custom Properties (global styles)

Add to your root CSS (e.g. `app/globals.css` or `styles/globals.css`):

```css
:root {
  /* Font family */
  --font-sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;

  /* Type scale (font-size) */
  --text-display: 48px;
  --text-h1: 36px;
  --text-h2: 28px;
  --text-h3: 22px;
  --text-h4: 18px;
  --text-body-lg: 17px;
  --text-body: 15px;
  --text-body-sm: 13px;
  --text-caption: 12px;

  /* Font weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  /* Line heights */
  --leading-heading: 1.2;
  --leading-body: 1.6;
  --leading-caption: 1.4;

  /* Letter spacing */
  --tracking-heading: -0.02em;
  --tracking-uppercase: 0.08em;
  --tracking-body: 0;
}

body {
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: var(--font-weight-regular);
  line-height: var(--leading-body);
  letter-spacing: var(--tracking-body);
}
```

### 7.2 Tailwind Config Extension

Extend `tailwind.config.ts` so utility classes map to the design tokens:

```ts
// tailwind.config.ts — add under theme.extend

theme: {
  extend: {
    fontFamily: {
      sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    fontSize: {
      'display': ['var(--text-display)', { lineHeight: 'var(--leading-heading)', letterSpacing: 'var(--tracking-heading)' }],
      'h1': ['var(--text-h1)', { lineHeight: 'var(--leading-heading)', letterSpacing: 'var(--tracking-heading)' }],
      'h2': ['var(--text-h2)', { lineHeight: 'var(--leading-heading)', letterSpacing: 'var(--tracking-heading)' }],
      'h3': ['var(--text-h3)', { lineHeight: 'var(--leading-heading)', letterSpacing: 'var(--tracking-heading)' }],
      'h4': ['var(--text-h4)', { lineHeight: 'var(--leading-heading)', letterSpacing: 'var(--tracking-heading)' }],
      'body-lg': ['var(--text-body-lg)', { lineHeight: 'var(--leading-body)' }],
      'body': ['var(--text-body)', { lineHeight: 'var(--leading-body)' }],
      'body-sm': ['var(--text-body-sm)', { lineHeight: 'var(--leading-body)' }],
      'caption': ['var(--text-caption)', { lineHeight: 'var(--leading-caption)' }],
    },
    fontWeight: {
      normal: 'var(--font-weight-regular)',
      medium: 'var(--font-weight-medium)',
      semibold: 'var(--font-weight-semibold)',
    },
    letterSpacing: {
      'heading': 'var(--tracking-heading)',
      'uppercase': 'var(--tracking-uppercase)',
    },
  },
},
```

### 7.3 Example Tailwind Usage

```html
<h1 class="text-h1 font-semibold">Page title</h1>
<h2 class="text-h2 font-semibold">Section</h2>
<p class="text-body-lg">Intro paragraph.</p>
<p class="text-body">Default body copy.</p>
<span class="text-caption text-secondary">Metadata</span>
<span class="text-caption font-medium uppercase tracking-uppercase">Label</span>
```

---

## 8. Summary

- **Font:** Plus Jakarta Sans (professional, readable, warm enough for coaching).
- **Scale:** Display → Caption as above; all exposed as CSS variables and Tailwind `text-*` utilities.
- **Weights:** 400, 500, 600 in app; 700 only for marketing headlines.
- **Line height:** 1.2 headings, 1.6 body, 1.4 captions.
- **Letter spacing:** -0.02em headings, 0.08em uppercase labels, 0 body.
- Use the reference table (§6) and the CSS/Tailwind blocks (§7) for consistent implementation across ClearPath V2.
