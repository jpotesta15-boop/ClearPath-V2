---
name: motion-animation
description: ClearPath V2 animation standard — minimal, purposeful motion. When to use Tailwind vs Framer Motion, reduced motion, modal/drawer specs, and what never gets animated. Use when adding or reviewing any transition, hover state, or page/component animation.
---

# Motion & animation — ClearPath V2

Animation on the platform confirms an action or guides attention; it never decorates. This skill defines the motion philosophy, standard durations, when to use Tailwind vs Framer Motion, reduced motion, and exact specs for modals and page transitions.

---

## 1. Motion philosophy

**Rule:** Animation should **confirm an action** or **guide attention**. Never use animation for decoration.

- If removing an animation makes the UI clearer, remove it.
- Prefer instant feedback (e.g. immediate state change) over a delayed or decorative motion.
- Use motion to: signal success/error, show that something opened/closed, or draw the eye to the next step. Do not use motion to: add “polish,” make the app feel “alive,” or animate things that don’t need it.

**Do:** Short opacity/scale on modal open so the user sees “something appeared.”
**Don’t:** Bounce, elastic, or long transitions on buttons or list items.

---

## 2. Standard transition — Tailwind

Use two timings only:

| Use case | Duration | Easing | Tailwind classes |
|----------|----------|--------|------------------|
| **Hover states** (buttons, cards, nav items) | 150ms | ease-out | `motion-safe:transition-[property] motion-safe:duration-150 motion-safe:ease-out` |
| **Component transitions** (modals appearing, dropdowns opening) | 200ms | ease-out | `motion-safe:transition-[property] motion-safe:duration-200 motion-safe:ease-out` |

**Common pattern for hover:**

```tsx
className="motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out hover:bg-muted"
```

For transforms (e.g. scale on buttons):

```tsx
className="motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out hover:scale-[1.02]"
```

**Rule:** All interactive hover/transition classes must be prefixed with `motion-safe:` (see §5). Use `duration-150` for hover; use `duration-200` for component-level transitions (modals, dropdowns).

---

## 3. What uses Framer Motion vs Tailwind only

**Use Framer Motion for:**

- Page-level transitions (if any are introduced later).
- Drawer / slide-in panels (e.g. filters, side panels).
- Complex staggered lists (e.g. list items animating in one after another).

**Use Tailwind transitions only for:**

- Hover states (buttons, cards, nav items).
- Simple component transitions (modals, dropdowns) — Tailwind is preferred; Framer only if the component already uses it for something else.
- Opacity/scale fades (e.g. initial load of a heavy component).

**Rule:** Do **not** mix Framer Motion and Tailwind transition on the **same element**. Choose one approach per element. Prefer Tailwind for simple hover and show/hide; use Framer only where you need orchestration (e.g. stagger, slide-in, page transition).

**Do:**

```tsx
// Button: Tailwind only
<button className="motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out hover:bg-muted">

// Drawer: Framer Motion only
<motion.div initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
```

**Don't:**

```tsx
// Same element with both — avoid
<motion.div transition={{ duration: 0.2 }} className="transition-colors duration-150">
```

---

## 4. What never gets animated

Do **not** animate:

- **Table rows** — no enter/exit or reorder animation on `<tr>` or table body.
- **List item re-ordering** — when the user reorders items, update the list instantly; no drag-and-drop or reorder animation.
- **Any element the user is actively interacting with** — e.g. do not animate the input or its container while the user is typing. No motion on focus/typing for form fields unless it’s a single, minimal indicator (e.g. border color change via transition).

**Rule:** If the user is typing, dragging, or making a discrete choice (e.g. reordering), the UI should update immediately. Reserve animation for system-driven feedback (e.g. modal open, panel slide) or for initial load of a heavy view.

---

## 5. Reduced motion rule

**Rule:** Wrap all animations in Tailwind’s `motion-safe:` prefix, or in JavaScript check `prefers-reduced-motion` before applying Framer Motion or any custom animation. Never force animation on users who have reduced motion enabled.

**Tailwind:** Use `motion-safe:` so that transition/transform/duration only apply when the user has not requested reduced motion:

```tsx
className="motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-out hover:bg-muted"
```

**Framer Motion (and JS):** Check the media query before animating:

```tsx
const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

<motion.div
  initial={prefersReducedMotion ? false : { opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
>
```

Alternatively use a hook (e.g. `useReducedMotion()`) that reads `prefers-reduced-motion` and pass its result into Framer’s `initial`/`animate`/`transition` so that when reduced motion is true, no animation runs (e.g. `initial={false}` and no transition).

---

## 6. Page transitions

- **Coach dashboard (and app shell):** No page transition animation. Navigation is **instant**. Do not add route-level enter/exit animations for normal navigation.
- **Heavy component on first load:** Only the **initial** page load of a heavy component (e.g. calendar) may use a single **fade-in** at **duration-200** (e.g. `motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out` from `opacity-0` to `opacity-100`), and only when it does not conflict with reduced motion (use `motion-safe:` or skip the fade when `prefers-reduced-motion` is set).

**Rule:** No Framer or Tailwind page/route transition for coach (or client) dashboard navigation. Instant navigation only. Fade-in is reserved for the first paint of a single heavy component, at 200ms, with reduced motion respected.

---

## 7. Modals — exact specs

Modals use a short fade + scale. Enter and exit use the same curve (ease-out); exit is faster.

| Phase | Opacity | Scale | Duration | Easing |
|-------|---------|-------|----------|--------|
| **Enter** | 0 → 100% | 95% → 100% | 150ms | ease-out |
| **Exit**  | 100% → 0 | 100% → 95% | 100ms | ease-out |

### Tailwind (CSS-only modal)

**Enter:** From `opacity-0 scale-95` to `opacity-100 scale-100` over 150ms ease-out.

```tsx
// Modal container (when visible)
className="motion-safe:transition-all motion-safe:duration-150 motion-safe:ease-out opacity-100 scale-100"

// Initial state (before visible) — e.g. when modal is closed, or use a wrapper that toggles classes
className="motion-safe:transition-all motion-safe:duration-100 motion-safe:ease-out opacity-0 scale-95"
```

**Exit:** Reverse — 100ms. When closing, switch to the “exit” classes so the element transitions from `opacity-100 scale-100` to `opacity-0 scale-95` with `duration-100`. In practice, toggle a class or state that applies `opacity-0 scale-95` and `duration-100`, then unmount after 100ms (or use a small delay so the exit transition runs).

Example pattern (conceptual):

```tsx
// Visible: show at full opacity and scale
className={`motion-safe:transition-all motion-safe:ease-out ${isExiting ? 'motion-safe:duration-100 opacity-0 scale-95' : 'motion-safe:duration-150 opacity-100 scale-100'}`}
// When opening: start from opacity-0 scale-95, then apply opacity-100 scale-100.
// When closing: set isExiting true (opacity-0 scale-95, duration-100), then unmount after 100ms.
```

**Backdrop:** Fade only, e.g. `motion-safe:transition-opacity motion-safe:duration-150 motion-safe:ease-out` from `opacity-0` to `opacity-100` (enter); reverse at 100ms on exit.

### Framer Motion variant (modal)

Use when the modal is implemented with Framer Motion (e.g. `AnimatePresence` for exit). Do not mix with Tailwind transition on the same modal container.

```tsx
const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.1, ease: 'easeOut' },
  },
};

// Usage with AnimatePresence
<AnimatePresence>
  {isOpen && (
    <motion.div
      variants={modalVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* modal content */}
    </motion.div>
  )}
</AnimatePresence>
```

**Rule:** Modal enter = 150ms, opacity 0→100%, scale 95%→100%, ease-out. Modal exit = 100ms, reverse (opacity 100%→0, scale 100%→95%). Use either Tailwind classes or this Framer variant on the modal container, not both. Respect reduced motion (see §5).

---

## Quick reference

| Context | Tool | Timing | Notes |
|--------|------|--------|--------|
| Buttons, cards, nav hover | Tailwind | 150ms ease-out | `motion-safe:transition-* motion-safe:duration-150 motion-safe:ease-out` |
| Dropdowns, component open/close | Tailwind | 200ms ease-out | `motion-safe:duration-200` |
| Modals enter | Tailwind or Framer | 150ms | opacity 0→100%, scale 95%→100% |
| Modals exit | Tailwind or Framer | 100ms | reverse of enter |
| Drawers / slide-in panels | Framer Motion | 200ms ease-out | No Tailwind on same element |
| Staggered lists | Framer Motion | — | No Tailwind on same element |
| Page navigation | None | — | Instant |
| Heavy component first load | Tailwind | 200ms | Fade-in only, `motion-safe:` |
| Table rows, list reorder, while typing | None | — | Never animate |
