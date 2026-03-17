# M4 — Mobile & PWA Strategy: ClearPath

This document defines the mobile strategy for ClearPath: which views matter most for clients on mobile, responsive breakpoints and navigation behavior, Progressive Web App (PWA) approach, touch targets, the client bottom tab bar, and which features to simplify or hide on small screens. It also provides a `manifest.json` template and a list of pages that need specific mobile layout work.

---

## 1. Mobile Strategy: Critical Client Views

Clients are the primary mobile users. The following views are **most critical** on mobile and must be fast, readable, and easy to tap:

| Priority | View | Rationale |
|----------|------|-----------|
| **1** | **Program view** | Clients check their assigned program and lessons (video links, notes, tasks) on the go. Program list and program detail (lessons/modules) must be thumb-friendly and quick to load. |
| **2** | **Session details** | Viewing an upcoming or past session (time, location/link, notes) and taking actions (join, reschedule, mark complete) is core. Session cards and detail screens need clear hierarchy and large tap targets. |
| **3** | **Messages** | Client–coach messaging is high-usage on mobile. Thread list and conversation view must feel native: readable text, easy input, and optional push/notifications later. |
| **4** | **Upcoming schedule** | The client’s upcoming sessions (dashboard schedule widget and/or dedicated schedule page) should be immediately visible and scannable. Quick access to “next session” is a key mobile goal. |

**Design principle:** Optimize the **client** experience for mobile first; coach workflows (program building, analytics, client management) remain **desktop-first** (see §6).

---

## 2. Responsive Breakpoints & Sidebar Behavior

Use a single, consistent set of breakpoints so the sidebar and bottom nav behave predictably across coach and client apps.

### 2.1 Breakpoint Definitions

| Breakpoint | Min width | Tailwind prefix | Usage |
|------------|-----------|-----------------|--------|
| **Mobile** | &lt; 768px | (default) | Single column, bottom tab bar, no sidebar. |
| **Tablet** | 768px | `md:` | Optional: icon rail only (see below). Bottom tab bar **hidden** from this width up. |
| **Desktop** | 1024px | `lg:` | Sidebar visible. Collapses to **icon rail** when toggled; icon rail = narrow (~64px) icons-only strip. |
| **Wide** | 1280px+ | `xl:` | Same as desktop; content can use max-width for readability. |

### 2.2 Navigation Behavior by Width

- **&lt; 768px:**  
  - **Sidebar:** Hidden (`hidden` below `md`).  
  - **Bottom tab bar:** Visible (`md:hidden`). Primary navigation for clients (and coaches on small screens) lives here.

- **768px – 1023px (tablet):**  
  - **Sidebar:** Visible as **icon rail only** (e.g. `md:flex md:w-16`), no labels. Optional: allow expand to full width on larger tablets if desired.  
  - **Bottom tab bar:** Hidden (`md:hidden`).

- **≥ 1024px:**  
  - **Sidebar:** Full sidebar (e.g. `lg:w-60` when expanded). User can collapse to **icon rail** (`lg:w-16`); state can persist in `localStorage`.  
  - **Bottom tab bar:** Hidden.

**Implementation note:** Current code uses `md` for both sidebar visibility and bottom bar hide. Align with this spec by: (1) showing bottom bar only below 768px (`md:hidden`), (2) showing sidebar from 768px up as icon rail by default in the 768–1023px range, (3) at 1024px and up allowing full sidebar with collapse-to–icon-rail. See `SidebarNav.tsx` and `MobileBottomNav.tsx`; consider a single breakpoint (e.g. `lg`) for “full sidebar vs icon rail” and keep `md` for “bottom bar vs sidebar.”

---

## 3. Progressive Web App (PWA)

Build the **client portal** as a PWA so clients can install it on their phone and get a more app-like experience, including offline access to program content.

### 3.1 Recommendation: Yes, PWA for Clients

- **manifest.json:** Define name, short_name, theme_color, background_color, display (e.g. `standalone`), start_url, and icons. Served from the app root (e.g. `/manifest.json`).
- **Service worker:** Use for **offline caching** of the client’s program content (program list, program detail, lesson text/links; optionally cache static assets and shell). Do not cache sensitive or real-time data beyond what’s needed for “view my program offline.”
- **Add to Home Screen (A2HS):** Prompt clients (e.g. after first login or when they’ve viewed a program) to “Add to Home Screen” so they can install the app. Use the `beforeinstallprompt` event where supported; show a dismissible in-app banner as fallback. Do not prompt repeatedly; respect a “don’t show again” or “already installed” state.

### 3.2 What to Cache (Service Worker)

- **Shell:** HTML/JS/CSS for the client app shell (layout, nav) so the app loads quickly and works offline for already-visited routes.
- **Program content:** After a client has loaded their program(s) and program detail, cache those responses (or pre-cache the “My Program” and “Program detail” pages and their JSON/data) so they can view program and lessons without network.
- **Static assets:** Favicon, icons, fonts, and critical images referenced by the manifest.

Do **not** cache: live messaging (always require network), payment flows, or coach-only areas. Keep cache invalidation simple (e.g. versioned cache name, or revalidate when online).

### 3.3 manifest.json Template

Place at project root or under `public/` so it is served as `/manifest.json`. Ensure the path is correct in `<link rel="manifest" href="/manifest.json">` in the root layout.

```json
{
  "name": "ClearPath — Client Portal",
  "short_name": "ClearPath",
  "description": "Your coaching program, sessions, and messages",
  "start_url": "/client/dashboard",
  "scope": "/client/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#0f172a",
  "background_color": "#f8fafc",
  "categories": ["health", "lifestyle"],
  "icons": [
    {
      "src": "/icons/icon-72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "prefer_related_applications": false
}
```

- Replace `theme_color` and `background_color` with values from your design tokens (e.g. D1/D3).
- Ensure all icon sizes exist under `public/icons/` (or adjust paths). Include at least 192px and 512px for installability.
- `scope: "/client/"` keeps the PWA experience scoped to the client portal; adjust if you use a different base path.

### 3.4 Add to Home Screen Prompt

- Use the Web App Manifest and a small in-app banner or modal: “Install ClearPath for quick access and offline program view.”
- On `beforeinstallprompt`, store the event and show an “Install” button; after install or “Don’t show again,” don’t prompt again (e.g. use `localStorage` or session storage).
- Only show the prompt in the **client** area (e.g. under `/client/`), not for coaches or unauthenticated users.

---

## 4. Touch Targets

All interactive elements must be **at least 44×44 px** on mobile (WCAG 2.1 and common platform guidelines).

- **Buttons:** Min height 44px, min width 44px (or padding so the hit area is at least 44×44). Use utility classes such as `min-h-[44px] min-w-[44px]` or a shared touch-target class for primary and secondary buttons.
- **Links in lists (e.g. program cards, session rows):** Entire row/card should be tappable with a minimum height of 44px for the clickable region; padding can contribute to the hit area.
- **Nav items (bottom tab bar):** Each tab target ≥ 44px height; the current `h-14` (56px) is acceptable. Ensure horizontal tap area is adequate when multiple tabs are present.
- **Form controls:** Checkboxes, radios, and toggles: 44×44 px hit area. Use `touch-manipulation` or similar where appropriate to reduce delay.
- **Icons that act as buttons:** Wrap in a focusable/tappable element with min 44×44 px (icon can be smaller inside).

Apply these rules in component styles (see D3) and in the mobile-specific overrides listed in §7. Audit existing buttons, `ClientNav`, `MobileBottomNav`, and client dashboard/schedule/program/messages components.

---

## 5. Bottom Tab Bar for Mobile Clients

On viewports **&lt; 768px**, client navigation uses a **bottom tab bar** with **4 tabs** (no more, to keep labels readable and targets large):

| Order | Tab | Route | Purpose |
|-------|-----|--------|--------|
| 1 | **Home** | `/client/dashboard` | Client dashboard: welcome, upcoming sessions, program shortcuts, daily message. |
| 2 | **Program** | `/client/programs` | List of assigned programs; tap through to program detail and lessons. |
| 3 | **Sessions** | `/client/schedule` | Upcoming (and optionally past) sessions; session details and actions. |
| 4 | **Messages** | `/client/messages` | Thread list and conversation with coach. |

**Not in the bottom bar (mobile):** Videos and Settings. Access via dashboard links, program content, or a “More” / overflow menu (e.g. in the header) so the bar stays at 4 tabs. If portal customization hides Programs or Schedule, the bar can show only the enabled tabs (minimum 4 slots; leave slots empty or replace with Videos/Settings if needed for consistency).

**Implementation:** `MobileBottomNav` already filters by `primaryLabels` for clients (`Home`, `Programs`, `Schedule`, `Messages`, `Settings`). Align labels and routes with this spec: use “Program” (singular) and “Sessions” in the UI for the bar, mapping to `/client/programs` and `/client/schedule`. Ensure `ClientLayout` passes the 4-item nav set for mobile (or 4 + overflow for Settings) so the bar shows exactly these four as primary.

---

## 6. Features to Simplify or Hide on Mobile

### 6.1 Client Portal

- **Simplify:** Program list and program detail: use single-column layout, larger cards, and fewer columns in tables. Schedule: list or card layout instead of a wide calendar. Messages: full-width thread list and conversation; simplify composer if needed.
- **Hide (or move to overflow):** “Videos” and “Settings” as separate tabs in the bottom bar; expose via Home/dashboard or a header menu. Optional: hide secondary dashboard widgets on very small screens and show “Upcoming” + “Program” + “Messages” first.

### 6.2 Coach Portal: Desktop-First

- **Program building:** Creating and editing programs (structure, modules, content blocks, drag-and-drop, video picker) is **desktop-first**. On mobile, either:
  - **Hide** “Create Program” and “Edit program” from the coach UI, or  
  - **Show** a message: “Program builder works best on a larger screen. Please use a desktop or tablet.” with a link to the same URL so they can still open it if they insist.
- **Video library / import:** Browsing and importing from Google Drive, managing the video library: treat as desktop-first; no need to optimize the full flow for small screens.
- **Analytics, session packages, payments:** Read-only or simple actions can be responsive; complex configuration and bulk actions remain desktop-focused.
- **Client list and client detail:** List and basic profile view can be responsive; heavy editing (notes, session history, payments) can be simplified or desktop-preferred.

Summary: **Clients** get a full, mobile-optimized experience (program, sessions, messages, schedule). **Coaches** get a usable mobile view for checking messages and schedule, but program building and heavy admin are desktop-first.

---

## 7. Pages Requiring Specific Mobile Layout Work

Use this list for implementation and QA. Each page should respect breakpoints (§2), touch targets (§4), and the bottom bar (§5); client pages should also consider PWA and offline (§3).

### 7.1 Client

| Page | Route | Mobile layout work |
|------|--------|--------------------|
| Dashboard | `/client/dashboard` | Single column; upcoming sessions and program cards stacked; ensure CTA buttons and card taps ≥ 44px; optional “Add to Home Screen” banner. |
| Programs (list) | `/client/programs` | Single column program cards; each card tappable ≥ 44px height; simplify or hide secondary metadata on small screens. |
| Program detail | `/client/programs/[id]` (if exists) or in-page | Lesson/list single column; video thumbnails and links with large touch targets; support offline when cached by SW. |
| Schedule | `/client/schedule` | List or card layout for sessions; no wide calendar on &lt;768px; session detail full-width with clear primary action (e.g. Join). |
| Session detail | `/client/schedule` or `/client/sessions/[id]` (if exists) | Full-width; time, link, notes prominent; buttons 44px min. |
| Messages | `/client/messages` | Full-width thread list; conversation view with readable bubbles and input; ensure send button and input area meet touch target. |
| Videos | `/client/videos` | If kept accessible on mobile: grid or list with large thumbnails and tap targets; optional hide from main nav, link from dashboard/program. |
| Settings | `/client/settings` | Single column form; toggles and buttons 44px; optional move to overflow menu on mobile. |

### 7.2 Coach (mobile = simplified / desktop-first)

| Page | Route | Mobile layout work |
|------|--------|--------------------|
| Dashboard | `/coach/dashboard` | Single column; key metrics and recent activity readable; primary links large enough. |
| Clients list | `/coach/clients` | List with adequate row height (≥44px); avoid dense table on small screens. |
| Client detail | `/coach/clients/[id]` | Tabs or accordions for notes, sessions, payments; primary actions 44px. |
| Programs list | `/coach/programs` | List/cards; “Create Program” can show “Best on desktop” message or hide. |
| Program builder | `/coach/programs/[id]` | Desktop-first; on small viewport show message or simplified read-only view. |
| Schedule | `/coach/schedule` or daily view | List or day view; avoid complex drag-and-drop on small screens. |
| Messages | `/coach/messages` or daily message | Readable thread and composer; touch targets for send and nav. |
| Videos | `/coach/videos` | List/grid; “Import” and heavy management desktop-first. |
| Payments / session packages / settings | Various | Forms and tables responsive; complex flows can remain desktop-preferred. |

### 7.3 Shared / Auth

| Page | Route | Mobile layout work |
|------|--------|--------------------|
| Login | `/login` | Single column; inputs and submit button 44px; avoid tiny links. |
| Set password | `/auth/set-password` | Same as login. |
| Public/landing | `/` | Responsive hero and CTA; touch-friendly nav and buttons. |

---

## 8. Summary

- **Client mobile priorities:** Program view, session details, messages, upcoming schedule.
- **Breakpoints:** &lt;768px = bottom tab bar; 768–1023px = icon rail; ≥1024px = full sidebar (collapsible to icon rail).
- **PWA:** manifest.json, service worker for offline client program content, Add to Home Screen prompt for clients.
- **Touch:** All interactive elements ≥ 44×44 px on mobile.
- **Client bottom bar:** 4 tabs — Home, Program, Sessions, Messages; Videos and Settings via dashboard or overflow.
- **Coach:** Program building and heavy admin are desktop-first; mobile = view and light actions only.
- Use the manifest template and the page list above to implement and audit mobile and PWA behavior.
