# D6 — Interaction & Feedback States: ClearPath V2

This document defines exactly how every interactive and feedback state should look and feel in ClearPath V2. Use it as the single reference for loading, empty, error, success, confirmation, and transition behavior. All specs use D1 colors, D2 typography, and D3 component styles where applicable. Class strings are Tailwind utilities; substitute semantic tokens if your `tailwind.config` exposes them.

---

## 1. Loading States

**Rule:** Never use a standalone spinner for full-page or list content. Use skeleton screens that mirror the final layout so users perceive progress and structure.

### 1.1 Full-page load

- **When:** Initial data fetch for a page (e.g. clients list, schedule, dashboard).
- **Pattern:** Skeleton screens only — no spinners. The skeleton should match the page layout: header area (title + optional subtitle + action area) plus content blocks in the same shape as the loaded content (e.g. list rows, cards, KPI tiles).
- **Accessibility:** Root container has `aria-label="Loading"` and `aria-busy="true"`.

**Page skeleton container:**

```
flex flex-col gap-6 p-4 md:p-6
```

**Header skeleton (title + subtitle + button area):**

```
flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between
```

**Title placeholder:**

```
h-8 w-48 rounded-md bg-[#E8E6E1] animate-pulse motion-reduce:animate-none
```

**Subtitle placeholder (optional):**

```
h-4 w-64 rounded bg-[#E8E6E1] animate-pulse motion-reduce:animate-none
```

**Action button placeholder:**

```
h-10 w-32 rounded-lg bg-[#E8E6E1] animate-pulse motion-reduce:animate-none
```

**List-style skeleton (repeat for N rows):** Each row should mimic a list item (e.g. avatar + lines).

- Row container: `flex items-center gap-4 rounded-lg border border-[#E8E6E1] bg-[#F8F7F4] p-4`
- Avatar: `h-10 w-10 shrink-0 rounded-full bg-[#E8E6E1] animate-pulse motion-reduce:animate-none`
- Line 1: `h-4 w-32 rounded bg-[#E8E6E1] animate-pulse motion-reduce:animate-none`
- Line 2: `h-3 w-48 rounded bg-[#E8E6E1] animate-pulse motion-reduce:animate-none`

**Card-style skeleton (e.g. dashboard tiles):**

- Card: `rounded-lg border border-[#E8E6E1] bg-[#F8F7F4] p-4`
- Title bar: `h-4 w-24 rounded bg-[#E8E6E1] animate-pulse motion-reduce:animate-none mb-3`
- Content lines: `h-3 w-full rounded bg-[#E8E6E1] animate-pulse motion-reduce:animate-none` (use 2–3 with gap-2)

**CSS for pulse (if not using Tailwind `animate-pulse`):**

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@media (prefers-reduced-motion: reduce) {
  .animate-pulse { animation: none; }
}
```

---

### 1.2 Component-level load

- **When:** A section or component loads its data after the page is visible (e.g. a card, a sidebar widget, a table).
- **Pattern:** Pulsing skeleton in the **exact shape** of the component (same dimensions and structure). No generic spinner.
- **Example:** Client card → skeleton with same avatar size, title width, and 2–3 text lines. Table section → skeleton rows with same column widths.

**Generic content-shaped block:**

```
rounded-lg border border-[#E8E6E1] bg-[#F8F7F4] p-4
```

Inside it, use `h-4` / `h-3` bars with `rounded bg-[#E8E6E1] animate-pulse motion-reduce:animate-none` and widths that match the real content (e.g. `w-full`, `w-3/4`, `w-1/2`).

**Single-line placeholder:**

```
h-4 w-full max-w-[200px] rounded bg-[#E8E6E1] animate-pulse motion-reduce:animate-none
```

**Form-shaped (e.g. 2 inputs + button):**

- Label: `h-3 w-16 rounded bg-[#E8E6E1] animate-pulse motion-reduce:animate-none mb-2`
- Input: `h-10 w-full rounded-lg bg-[#E8E6E1] animate-pulse motion-reduce:animate-none`
- Button: `h-10 w-24 rounded-lg bg-[#E8E6E1] animate-pulse motion-reduce:animate-none mt-4`

---

### 1.3 Button loading

- **When:** A button triggers an async action (Save, Submit, Send, Add client).
- **Pattern:** Spinner **replaces** the button text. Button **keeps the same width** (use `min-w-[...]` or fixed width so it doesn’t jump). Button is **disabled** during load.
- **Do not:** Show both spinner and text (e.g. “Saving…” with spinner) unless the design system explicitly allows it; for ClearPath V2, spinner only.

**Button container (preserve width):**

- Use the same width as the non-loading state: e.g. `min-w-[120px]` or match the label width so the button doesn’t resize when switching to spinner.

**Spinner (replaces label):**

- Size: 20px (h-5 w-5). Color: white on primary/destructive, neutral on secondary/ghost.

**Tailwind for spinner (inline SVG or icon):**

```
h-5 w-5 animate-spin text-white
```

For secondary/ghost: `text-[#1A1A1A]`.

**Disabled state:**

```
disabled:pointer-events-none disabled:opacity-50
```

**CSS for spin (if not using Tailwind):**

```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
.animate-spin {
  animation: spin 1s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .animate-spin { animation: none; }
}
```

**Example primary button in loading state:**

```
h-10 min-h-10 min-w-[120px] rounded-lg bg-[#2D7A6F] px-4 text-sm font-medium text-white shadow-sm opacity-90 cursor-not-allowed inline-flex items-center justify-center gap-2
```

Content: only the spinner (no text).

---

## 2. Empty States

Every empty state must have: **(1) headline**, **(2) one-line description**, **(3) primary action button**. Use an illustration or icon placeholder when it fits the layout.

**Shared empty-state container:**

```
flex flex-col items-center justify-center rounded-lg border border-[#E8E6E1] bg-[#F8F7F4] p-8 md:p-12 text-center
```

**Illustration / icon placeholder:**

- Optional area above the headline. Use a neutral icon or branded illustration.
- Container: `mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E8E6E1]/60 text-[#6B6B6B]` (or an `<img>` for custom illustration).

**Headline:**

```
text-h4 font-medium text-[#1A1A1A] md:text-lg
```

**Description (one line):**

```
mt-2 max-w-sm text-[15px] font-normal text-[#6B6B6B] leading-relaxed
```

**Primary action (CTA):**

- Use D3 primary button. Add `mt-6` for spacing.

```
mt-6 h-10 min-h-10 rounded-lg bg-[#2D7A6F] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#246358] focus:outline-none focus:ring-2 focus:ring-[#2D7A6F] focus:ring-offset-2
```

---

### 2.1 Client list — no clients

- **Headline:** “No clients yet”
- **Description:** “Add your first client to start managing sessions and programs.”
- **Primary action:** “Add your first client” → links to create-client flow or opens “Add client” modal.
- **Container:** Use shared empty-state container; optional illustration placeholder above headline.

---

### 2.2 No messages

- **Headline:** “No messages yet”
- **Description:** “Conversations with your coach will appear here.”
- **Primary action:** “Open Messages” or “Go to Messages” (if different context).
- **Container:** Same as above; can be in a narrow column (e.g. messages panel).

---

### 2.3 No programs

- **Coach:** “No programs yet” / “Create your first program to assign to clients.” / “Create program”
- **Client:** “No programs assigned” / “Your coach will assign programs for you here.” / “View schedule” or no CTA if there’s nothing to do.
- **Container:** Same shared empty-state block.

---

### 2.4 No scheduled sessions

- **Coach:** “No sessions scheduled” / “Book a session with a client or wait for them to accept an offer.” / “Book session”
- **Client:** “Nothing scheduled yet” / “Your coach may send you an offer or you can request a session.” / “Open Schedule” or “Open Messages”
- **Container:** Same shared empty-state block.

---

### 2.5 Other empty lists (payments, videos, session packages)

Apply the same pattern: **headline** + **one-line description** + **primary action**. Copy should be specific (e.g. “No session packages” / “Create a package so clients can book and pay.” / “Create package”).

---

## 3. Error States

### 3.1 API / global errors (toast)

- **When:** A request fails (network, 4xx/5xx, or server error).
- **Placement:** Bottom-right of the viewport.
- **Style:** Red (error) toast. Auto-dismiss after **5 seconds**.
- **Content:** Short message (e.g. “Something went wrong. Please try again.” or a specific message from the API).

**Toast container (bottom-right):**

```
fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2
```

**Toast panel (error — red):**

```
flex items-start gap-3 rounded-lg border border-[#B85450] bg-[#F8EEED] px-4 py-3 shadow-[0_4px_12px_rgba(26,26,26,0.12)]
```

**Icon (optional):** Error icon in `text-[#B85450]`.

**Message text:**

```
text-[15px] font-medium text-[#1A1A1A]
```

**Auto-dismiss:** 5000 ms. Optional progress bar or countdown; at minimum, start a timer and remove/toast off after 5s.

**Animation:** Toast slides in from the right (see §6).

---

### 3.2 Form validation errors

- **When:** Client-side or server-side validation fails for a field.
- **Field:** Red border and optional light red background. Error message **below** the field.

**Input (error state):**

```
h-10 w-full rounded-lg border-2 border-[#B85450] bg-[#F8EEED] px-3 py-2 text-[15px] font-normal text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#B85450] focus:ring-offset-0
```

**Error message below field:**

```
mt-1.5 text-[13px] font-normal text-[#B85450]
```

**Textarea:** Same border/background/message: `border-2 border-[#B85450] bg-[#F8EEED]` and message with `mt-1.5 text-[13px] text-[#B85450]`.

---

### 3.3 Full-page error

- **When:** Critical load failure (e.g. page data failed, not just a single section).
- **Pattern:** Centered message and a **Retry** button.

**Container:**

```
flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 py-12 text-center
```

**Message:**

```
text-h4 font-medium text-[#1A1A1A]
```

**Optional detail:**

```
text-[15px] font-normal text-[#6B6B6B] max-w-md
```

**Retry button:** Use D3 primary button:

```
h-10 min-h-10 rounded-lg bg-[#2D7A6F] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#246358] focus:outline-none focus:ring-2 focus:ring-[#2D7A6F] focus:ring-offset-2
```

---

## 4. Success States

### 4.1 Form submitted

- **When:** A form is successfully submitted (e.g. settings saved, program created).
- **Pattern:** **Green toast** bottom-right. Auto-dismiss after ~4–5 seconds.
- **Message:** Short and clear (e.g. “Saved”, “Program created”).

**Toast panel (success):**

```
flex items-start gap-3 rounded-lg border border-[#4A7C59] bg-[#E8F0EA] px-4 py-3 shadow-[0_4px_12px_rgba(26,26,26,0.12)]
```

**Message text:**

```
text-[15px] font-medium text-[#1A1A1A]
```

Placement and animation same as error toast (§3.1, §6).

---

### 4.2 Client added

- **Pattern:** Confirmation **and** option to go to the new client’s profile.
- **Options:**
  - **A)** Success toast with action: “Client added” + link/button “View profile”.
  - **B)** Inline confirmation message on the same page: “Client added. [View profile]” with primary CTA.
- **Toast (with action):** Same green toast as §4.1; add a secondary button or link “View profile” next to or below the message. Example link: `text-[15px] font-medium text-[#2D7A6F] hover:underline`.

---

### 4.3 Video upload started

- **Pattern:** **Progress indicator** so the user knows the upload is in progress.
- **Options:**
  - Inline progress bar under the upload control or in the video list row.
  - Or a small status badge “Uploading…” with a progress percentage or bar.

**Progress bar container:**

```
w-full rounded-full bg-[#E8E6E1] overflow-hidden
```

**Progress fill:**

```
h-2 rounded-full bg-[#2D7A6F] transition-[width] duration-300 ease-out
```

Width: `width: ${percent}%` (e.g. 0–100).

**Status text (optional):**

```
text-[13px] font-medium text-[#6B6B6B]
```

e.g. “Uploading… 45%”

---

## 5. Confirmation Dialogs

- **When:** Any **destructive** action — e.g. deleting a client, removing a program, revoking access.
- **Pattern:** **Modal** with: (1) clear title or message that includes the **specific item name** (e.g. “Delete [Client Name]?”), (2) short explanation of consequence, (3) **Cancel** (secondary), (4) **Confirm** (red/destructive) button.

**Modal overlay:**

```
fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A1A]/50 p-4
```

**Modal panel:**

```
w-full max-w-md rounded-lg border border-[#E8E6E1] bg-white p-6 shadow-[0_4px_20px_rgba(26,26,26,0.15)]
```

**Title:**

```
text-h4 font-medium text-[#1A1A1A]
```

e.g. “Delete [Client Name]?” or “Remove program?”

**Body copy:**

```
mt-2 text-[15px] font-normal text-[#6B6B6B] leading-relaxed
```

e.g. “This will permanently remove this client and their data. This cannot be undone.”

**Actions (footer):**

```
mt-6 flex flex-row justify-end gap-3
```

**Cancel button (secondary):**

```
h-10 min-h-10 rounded-lg border border-[#E8E6E1] bg-white px-4 text-sm font-medium text-[#1A1A1A] transition-colors hover:bg-[#F8F7F4] focus:outline-none focus:ring-2 focus:ring-[#2D7A6F] focus:ring-offset-2
```

**Confirm button (destructive):**

```
h-10 min-h-10 rounded-lg bg-[#B85450] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#A04844] focus:outline-none focus:ring-2 focus:ring-[#B85450] focus:ring-offset-2
```

**Focus:** Focus trap inside modal; focus moves to confirm or first focusable element; Escape closes (Cancel). On confirm, run the action and then close.

---

## 6. Transition Animations

- **Rule:** Respect `prefers-reduced-motion: reduce` — disable or shorten animations when the user requests reduced motion.

### 6.1 Page transitions

- **Behavior:** **Instant.** No enter/exit animation between routes/pages.
- **Implementation:** No extra transition wrapper; content swaps immediately.

---

### 6.2 Component transitions

- **When:** Components mount/unmount or show/hide (e.g. accordion, dropdown, inline form).
- **Duration:** **150 ms**. Easing: **ease** (or `ease-out` for exit).
- **Typical use:** Opacity and/or transform (e.g. `opacity` 0→1, or `translateY` for dropdowns).

**Tailwind:**

```
transition-all duration-150 ease-out
```

**CSS:**

```css
transition: opacity 150ms ease, transform 150ms ease;
```

**Reduced motion:**

```css
@media (prefers-reduced-motion: reduce) {
  .transition-all { transition-duration: 0ms; }
}
```

---

### 6.3 Modal

- **Behavior:** **Fade in** (overlay + panel). Duration: **200 ms**.
- **Overlay:** opacity 0 → 1.
- **Panel:** opacity 0 → 1; optional slight scale (e.g. 0.98 → 1) for a light “pop”.

**Overlay (fade in):**

```
data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
```

If using raw CSS:

```css
.modal-overlay {
  animation: fadeIn 200ms ease;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

**Panel:** Same 200 ms fade; optional `transform: scale(0.98)` → `scale(1)`.

---

### 6.4 Toast

- **Behavior:** **Slide in from the right.** Duration: **200 ms**.
- **Exit:** Fade out or slide out (e.g. 150 ms) when dismissed or auto-dismissed.

**Slide in from right (Tailwind-style):**

```
translate-x-full → translate-x-0
```

**CSS:**

```css
.toast-enter {
  transform: translateX(100%);
  opacity: 0;
}
.toast-enter-active {
  transform: translateX(0);
  opacity: 1;
  transition: transform 200ms ease, opacity 200ms ease;
}
```

**Reduced motion:** Skip transform; use opacity only or instant show.

```css
@media (prefers-reduced-motion: reduce) {
  .toast-enter { transform: none; }
  .toast-enter-active { transition: opacity 100ms ease; }
}
```

---

## Summary Table

| State type        | Pattern                    | Key specs |
|-------------------|----------------------------|-----------|
| Full-page load    | Skeleton only              | Match layout; `animate-pulse`; `aria-busy` |
| Component load    | Shape-matching skeleton    | Same dimensions/structure as content |
| Button loading    | Spinner replaces text      | Same width; disabled |
| Empty states      | Headline + description + CTA | Optional illustration; D3 primary button |
| API error         | Toast bottom-right, red   | 5s auto-dismiss; slide in from right |
| Form validation   | Red border + message below | `border-[#B85450]`, `bg-[#F8EEED]`, `text-[#B85450]` |
| Full-page error   | Centered + Retry           | Primary button Retry |
| Success (form)    | Green toast                | Auto-dismiss ~4–5s |
| Client added      | Confirmation + “View profile” | Toast or inline with CTA |
| Video upload      | Progress bar               | `bg-[#2D7A6F]`, width by % |
| Confirmation      | Modal + item name + red confirm | Destructive button; focus trap |
| Page transition   | Instant                    | No animation |
| Component         | 150 ms ease                | Opacity/transform |
| Modal             | 200 ms fade                | Overlay + panel |
| Toast             | 200 ms slide from right    | Enter; fade/slide out on dismiss |

---

*This document is the single source of truth for interaction and feedback states in ClearPath V2. Implement components (skeletons, toasts, modals, empty states) to match these specs and reference D1–D3 for colors, type, and base components.*
