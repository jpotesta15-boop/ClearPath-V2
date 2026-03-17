# D1 — Brand Identity: ClearPath Coaching Platform

This document defines the visual identity system for ClearPath, including colors, usage rules, and personality guidelines.

---

## 1. Primary Colors

| Role | Hex | CSS Variable | Use |
|------|-----|--------------|-----|
| Background (white) | `#FFFFFF` | `--color-bg` | Main app background |
| Surface (off-white) | `#F8F7F4` | `--color-surface` | Cards, panels, elevated areas |
| Primary text | `#1A1A1A` | `--color-text-primary` | Headings, body copy |
| Secondary text | `#6B6B6B` | `--color-text-secondary` | Captions, hints, metadata |
| Border | `#E8E6E1` | `--color-border` | Dividers, input borders, card edges |

---

## 2. Accent Color

**Accent:** `#2D7A6F` (refined teal) — calm, professional, growth-oriented; suitable for a coaching brand.

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Accent (default) | `#2D7A6F` | `--color-accent` |
| Accent hover/pressed | `#246358` | `--color-accent-hover` |
| Accent light (backgrounds) | `#E8F2F0` | `--color-accent-light` |

Use the accent sparingly: primary CTAs, active nav states, links, and key progress indicators only.

---

## 3. Semantic Colors (Muted / Desaturated)

All semantic colors are softened to match the clean, low-noise aesthetic. Avoid bright or saturated semantic colors.

| Role | Hex | CSS Variable | Use |
|------|-----|--------------|-----|
| Success | `#4A7C59` | `--color-success` | Confirmations, completed states |
| Success light | `#E8F0EA` | `--color-success-light` | Success backgrounds, badges |
| Warning | `#B8860B` | `--color-warning` | Warnings, pending, caution |
| Warning light | `#F5F0E6` | `--color-warning-light` | Warning backgrounds |
| Error | `#B85450` | `--color-error` | Errors, destructive actions |
| Error light | `#F8EEED` | `--color-error-light` | Error backgrounds, validation |
| Info | `#4A6FA5` | `--color-info` | Informational messages, tips |
| Info light | `#EBF0F6` | `--color-info-light` | Info backgrounds |

---

## 4. How to Use Each Color

- **Backgrounds:** Use `--color-bg` (`#FFFFFF`) for the main canvas and `--color-surface` (`#F8F7F4`) for cards, sidebars, and elevated surfaces. Never use pure gray or colored backgrounds for large areas unless specified.
- **Text:** Always use `--color-text-primary` (`#1A1A1A`) for readable text. **Never use pure black (`#000000`)**. Use `--color-text-secondary` for supporting copy (captions, placeholders, metadata).
- **Borders:** Use `--color-border` for dividers, input outlines, and card edges. Keeps the UI light and consistent.
- **Accent:** Use only for:
  - Primary buttons and CTAs
  - Active navigation/item states
  - Key links and progress indicators
  - Optional: small highlights (e.g., left border on active item)
- **Semantic colors:** Use for status (success/warning/error), badges, and inline alerts. Prefer the light variants for background tints; use the main semantic color for text and icons.

---

## 5. Logo Usage Rules

- **Minimum size:** 24px height (digital). Do not scale the logo below this; use the wordmark or icon-only lockup as specified in asset guidelines.
- **Clear space:** Maintain clear space equal to the height of the “C” (or primary mark) on all sides. No type, UI elements, or graphics inside this zone.
- **Backgrounds:** Logo may appear on:
  - White (`#FFFFFF`)
  - Off-white surface (`#F8F7F4`)
  - Accent (`#2D7A6F`) — use white or off-white logo version only.
- **Do not:** Place the logo on busy imagery, low-contrast backgrounds, or semantic colors (success/error/etc.) unless a dedicated lockup is provided.

---

## 6. Brand Personality

**Three words:** **Calm · Clear · Capable**

- **Calm:** Avoid visual noise. Plenty of whitespace, muted semantics, no aggressive gradients or heavy shadows. Motion (if any) should be subtle.
- **Clear:** Hierarchy through typography and spacing first; color supports rather than dominates. Labels and actions should be obvious.
- **Capable:** Feels professional and trustworthy. Accent and semantic colors are used with restraint so the product feels reliable, not playful or flashy.

**UI implications:** Prefer subtle borders over heavy shadows, system-friendly type scales, and a limited palette. Buttons and CTAs should be clearly identifiable but not loud. Error and warning states should be noticeable without feeling alarming.

---

## CSS Custom Properties (Copy into `globals.css`)

```css
:root {
  /* Primary */
  --color-bg: #FFFFFF;
  --color-surface: #F8F7F4;
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #6B6B6B;
  --color-border: #E8E6E1;

  /* Accent */
  --color-accent: #2D7A6F;
  --color-accent-hover: #246358;
  --color-accent-light: #E8F2F0;

  /* Semantic — muted */
  --color-success: #4A7C59;
  --color-success-light: #E8F0EA;
  --color-warning: #B8860B;
  --color-warning-light: #F5F0E6;
  --color-error: #B85450;
  --color-error-light: #F8EEED;
  --color-info: #4A6FA5;
  --color-info-light: #EBF0F6;
}
```

Replace the accent hex values with your chosen brand accent if different; keep the same variable names for consistency.
