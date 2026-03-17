# D3 — Component Styles: ClearPath V2

This document defines the exact visual style for every core UI component in ClearPath V2, using colors from **D1 — Brand Identity** and typography from **D2 — Typography**. All class strings are Tailwind utilities that can be used directly in code. Colors use the D1 hex values via arbitrary values so styles work without theme extension; if you add D1/D2 tokens to `tailwind.config`, you may substitute semantic names (e.g. `bg-accent` for `bg-[#2D7A6F]`).

---

## 1. Buttons

All buttons share: **8px border-radius**, **14px font size**, **medium (500) weight**, **40px height**. Use `inline-flex items-center justify-center` for alignment with icons.

### 1.1 Primary (solid accent)

- **When to use:** Main CTAs (e.g. Save, Submit, Book session).
- **Tailwind classes:**

```
h-10 min-h-10 rounded-lg bg-[#2D7A6F] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#246358] focus:outline-none focus:ring-2 focus:ring-[#2D7A6F] focus:ring-offset-2 active:bg-[#246358] disabled:pointer-events-none disabled:opacity-50
```

- **Variants:** Add `w-full` for full-width. Add `gap-2` when used with an icon.

### 1.2 Secondary (white with border)

- **When to use:** Secondary actions (Cancel, Back, alternative choice next to primary).
- **Tailwind classes:**

```
h-10 min-h-10 rounded-lg border border-[#E8E6E1] bg-white px-4 text-sm font-medium text-[#1A1A1A] transition-colors hover:bg-[#F8F7F4] hover:border-[#E8E6E1] focus:outline-none focus:ring-2 focus:ring-[#2D7A6F] focus:ring-offset-2 active:bg-[#F8F7F4] disabled:pointer-events-none disabled:opacity-50
```

- **Variants:** On off-white/surface pages use `bg-[#F8F7F4]` and `hover:bg-[#E8E6E1]/50` so the button still reads as secondary.

### 1.3 Ghost (no border, text only)

- **When to use:** Tertiary actions, table row actions, inline links that look like buttons.
- **Tailwind classes:**

```
h-10 min-h-10 rounded-lg px-4 text-sm font-medium text-[#1A1A1A] transition-colors hover:bg-[#E8E6E1]/50 focus:outline-none focus:ring-2 focus:ring-[#2D7A6F] focus:ring-offset-2 active:bg-[#E8E6E1]/70 disabled:pointer-events-none disabled:opacity-50
```

- **Variants:** For a ghost that reads as “link”, use `text-[#2D7A6F] hover:bg-[#E8F2F0]` instead of neutral text/hover.

### 1.4 Destructive (red)

- **When to use:** Delete, remove, or irreversible destructive actions.
- **Tailwind classes:**

```
h-10 min-h-10 rounded-lg bg-[#B85450] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#A04844] focus:outline-none focus:ring-2 focus:ring-[#B85450] focus:ring-offset-2 active:bg-[#A04844] disabled:pointer-events-none disabled:opacity-50
```

- **Variants:** Destructive secondary (outline): `border border-[#B85450] bg-transparent text-[#B85450] hover:bg-[#F8EEED]`.

---

## 2. Input Fields

- **When to use:** Text inputs, email, number, password, textarea. Same border and focus treatment for selects and other form controls.

### 2.1 Base input

- **Border:** 1px solid D1 border color. **Border-radius:** 8px. **Focus ring:** 2px ring in accent; use ring-offset for clarity.

**Tailwind classes (default state):**

```
h-10 w-full rounded-lg border border-[#E8E6E1] bg-white px-3 py-2 text-[15px] font-normal text-[#1A1A1A] placeholder:text-[#6B6B6B] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2D7A6F] focus:ring-offset-0 focus:border-[#2D7A6F] disabled:cursor-not-allowed disabled:opacity-60
```

- **Placeholder:** `placeholder:text-[#6B6B6B]` (D1 secondary text). Keep placeholder font-weight 400.

### 2.2 Error state

- **When to use:** After validation fails or when server returns a field error.

**Tailwind classes:**

```
h-10 w-full rounded-lg border-2 border-[#B85450] bg-[#F8EEED] px-3 py-2 text-[15px] font-normal text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#B85450] focus:ring-offset-0
```

- **Error message text:** `text-body-sm text-[#B85450] mt-1` (or `text-[13px] text-[#B85450] mt-1`).

### 2.3 Textarea

Same border, radius, focus, and error treatment; allow multi-line and resize as needed:

```
min-h-[80px] w-full resize-y rounded-lg border border-[#E8E6E1] bg-white px-3 py-2 text-[15px] font-normal text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#2D7A6F] focus:ring-offset-0 focus:border-[#2D7A6F] disabled:opacity-60
```

---

## 3. Cards

### 3.1 Flat card (off-white, subtle border)

- **When to use:** Content containers on white or surface backgrounds; lists, settings groups, simple panels.

**Tailwind classes:**

```
rounded-lg border border-[#E8E6E1] bg-[#F8F7F4] p-4
```

- **Variants:** Use `p-5` or `p-6` for more padding. Add `text-[#1A1A1A]` if parent doesn’t set text color.

### 3.2 Raised card (white, light shadow)

- **When to use:** Elevated content, dashboards, feature blocks, modals’ inner content.

**Tailwind classes:**

```
rounded-lg border border-[#E8E6E1] bg-white p-4 shadow-[0_1px_3px_rgba(26,26,26,0.06)]
```

- **Variants:** For stronger elevation use `shadow-[0_2px_8px_rgba(26,26,26,0.08)]`. Card title: `text-h4 font-medium text-[#1A1A1A]` (or `text-lg font-medium`).

---

## 4. Badges and Status Pills

Small, rounded labels for status. Use **13px** body-small and **medium** weight.

### 4.1 Active (green)

- **When to use:** Active subscription, completed, confirmed.

**Tailwind classes:**

```
inline-flex items-center rounded-full bg-[#E8F0EA] px-2.5 py-0.5 text-[13px] font-medium text-[#4A7C59]
```

### 4.2 Inactive (gray)

- **When to use:** Inactive, paused, draft, not started.

**Tailwind classes:**

```
inline-flex items-center rounded-full bg-[#E8E6E1]/80 px-2.5 py-0.5 text-[13px] font-medium text-[#6B6B6B]
```

### 4.3 Pending (amber)

- **When to use:** Pending payment, awaiting confirmation, scheduled.

**Tailwind classes:**

```
inline-flex items-center rounded-full bg-[#F5F0E6] px-2.5 py-0.5 text-[13px] font-medium text-[#B8860B]
```

### 4.4 Optional: Error / Overdue

**Tailwind classes:**

```
inline-flex items-center rounded-full bg-[#F8EEED] px-2.5 py-0.5 text-[13px] font-medium text-[#B85450]
```

---

## 5. Tables

- **When to use:** Tabular data (sessions, clients, payments). Prefer consistent spacing and borders per D1.

### 5.1 Container

**Tailwind classes:**

```
w-full border-collapse rounded-lg border border-[#E8E6E1] bg-white
```

### 5.2 Header row

**Tailwind classes:**

```
border-b border-[#E8E6E1] bg-[#F8F7F4] text-left
```

### 5.3 Header cell

**Tailwind classes:**

```
px-4 py-3 text-caption font-medium uppercase tracking-[0.08em] text-[#6B6B6B]
```

(Or `text-[12px] font-medium uppercase tracking-wider text-[#6B6B6B]`.)

### 5.4 Body row

**Tailwind classes (default):**

```
border-b border-[#E8E6E1] transition-colors last:border-b-0
```

### 5.5 Body row hover

**Tailwind classes:**

```
hover:bg-[#F8F7F4]
```

### 5.6 Body cell

**Tailwind classes:**

```
px-4 py-3 text-[15px] font-normal text-[#1A1A1A]
```

- **Secondary text in a cell:** `text-[#6B6B6B]`.

---

## 6. Navigation

### 6.1 Sidebar (coach dashboard)

- **When to use:** Main coach app sidebar; vertical list of nav items.

**Sidebar container:**

```
flex h-full w-[240px] min-w-[240px] flex-col border-r border-[#E8E6E1] bg-[#F8F7F4] py-4
```

**Nav item (default):**

```
flex items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] font-medium text-[#6B6B6B] transition-colors hover:bg-[#E8E6E1]/50 hover:text-[#1A1A1A]
```

**Nav item (active):**

```
flex items-center gap-3 rounded-lg bg-[#E8F2F0] px-4 py-2.5 text-[15px] font-medium text-[#2D7A6F]
```

- **Optional:** Add `border-l-2 border-l-[#2D7A6F]` to the active item for a left accent bar.

### 6.2 Top nav

- **When to use:** App top bar (client or coach), with logo and primary links.

**Top nav container:**

```
flex h-14 items-center justify-between border-b border-[#E8E6E1] bg-white px-4
```

**Top nav link (default):**

```
rounded-lg px-3 py-2 text-[15px] font-medium text-[#6B6B6B] transition-colors hover:bg-[#F8F7F4] hover:text-[#1A1A1A]
```

**Top nav link (active):**

```
rounded-lg px-3 py-2 text-[15px] font-medium text-[#2D7A6F] hover:bg-[#E8F2F0]
```

### 6.3 Mobile bottom nav

- **When to use:** Client or coach mobile bottom navigation.

**Container:**

```
fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-[#E8E6E1] bg-white py-2 safe-area-pb
```

**Item (default):** `text-[#6B6B6B]`. **Item (active):** `text-[#2D7A6F]`. Use `text-caption` or `text-[12px]` for labels.

---

## 7. Modals and Drawers

### 7.1 Modal overlay

**Tailwind classes:**

```
fixed inset-0 z-50 bg-[#1A1A1A]/40 backdrop-blur-[2px]
```

### 7.2 Modal panel

- **Border-radius:** 12px (or 16px for larger modals). **Padding:** 24px.

**Tailwind classes:**

```
relative z-50 mx-4 max-h-[90vh] w-full max-w-md rounded-xl border border-[#E8E6E1] bg-white p-6 shadow-[0_10px_40px_rgba(26,26,26,0.15)]
```

- **Variants:** `max-w-lg` or `max-w-xl` for wider modals. Modal title: `text-h3 font-semibold text-[#1A1A1A]`. Footer: `mt-6 flex justify-end gap-3`.

### 7.3 Drawer overlay

Same as modal overlay:

```
fixed inset-0 z-50 bg-[#1A1A1A]/40 backdrop-blur-[2px]
```

### 7.4 Drawer panel (side)

- **When to use:** Slide-in panel from right (or left). **Border-radius:** 0 on the outside edge; 12px on the inner/top edge if desired.

**Tailwind classes (right drawer):**

```
fixed right-0 top-0 z-50 h-full w-full max-w-sm border-l border-[#E8E6E1] bg-white p-6 shadow-[-4px_0_24px_rgba(26,26,26,0.08)]
```

- **Variants:** `max-w-md` for wider drawer. Inner padding: `p-6`; use `pt-8` if you add a close strip at top.

---

## 8. Empty States

- **When to use:** No data yet (no clients, no sessions, no programs, no messages). Calm, clear, capable tone; accent used sparingly for the primary action.

### 8.1 Container

**Tailwind classes:**

```
flex flex-col items-center justify-center rounded-lg border border-dashed border-[#E8E6E1] bg-[#F8F7F4] px-6 py-12 text-center
```

### 8.2 Icon or illustration

- Use a simple icon or illustration in **secondary text color** so it doesn’t dominate.

**Tailwind classes (icon wrapper):**

```
mb-4 text-[#6B6B6B]
```

### 8.3 Title

**Tailwind classes:**

```
text-h4 font-medium text-[#1A1A1A] mb-1
```

(Or `text-lg font-medium text-[#1A1A1A] mb-1`.)

### 8.4 Description

**Tailwind classes:**

```
mb-6 max-w-sm text-[15px] font-normal leading-relaxed text-[#6B6B6B]
```

### 8.5 Primary action button

Use the **primary button** styles from §1.1 so the CTA is clear (e.g. “Add your first client”, “Create program”).

### 8.6 Full example (Tailwind only)

```
<div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#E8E6E1] bg-[#F8F7F4] px-6 py-12 text-center">
  <div class="mb-4 text-[#6B6B6B]"><!-- icon --></div>
  <h3 class="text-lg font-medium text-[#1A1A1A] mb-1">No clients yet</h3>
  <p class="mb-6 max-w-sm text-[15px] font-normal leading-relaxed text-[#6B6B6B]">Add your first client to start scheduling sessions and building programs.</p>
  <a href="..." class="h-10 min-h-10 inline-flex items-center justify-center rounded-lg bg-[#2D7A6F] px-4 text-sm font-medium text-white ...">Add client</a>
</div>
```

---

## Summary

| Component        | Key tokens |
|-----------------|------------|
| Buttons         | 8px radius, 14px font, medium, 40px height; primary `#2D7A6F`, secondary border `#E8E6E1`, destructive `#B85450` |
| Inputs          | 8px radius, border `#E8E6E1`, focus ring `#2D7A6F`, error border/bg `#B85450` / `#F8EEED` |
| Cards           | Flat: `#F8F7F4` + border; Raised: white + 1px border + light shadow |
| Badges          | Active `#4A7C59`/`#E8F0EA`, Inactive gray, Pending `#B8860B`/`#F5F0E6` |
| Tables          | Header `#F8F7F4`, borders `#E8E6E1`, row hover `#F8F7F4` |
| Nav             | Sidebar bg `#F8F7F4`, active bg `#E8F2F0`, active text `#2D7A6F` |
| Modals/Drawers  | Overlay `#1A1A1A`/40%, panel white, border `#E8E6E1`, rounded-xl, p-6 |
| Empty states    | Dashed border, bg `#F8F7F4`, title primary text, body secondary, primary CTA |

All of the above class strings are written so they can be copied into components as-is; replace or extend with your design tokens in `tailwind.config` when D1/D2 variables are wired in.
