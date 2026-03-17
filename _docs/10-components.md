# 10 — Component Registry (Master)

This document is the **master component registry**. Always check it before building something new: reuse existing components where possible and add new ones here when you create them.

For each component we list: **file path**, **what it renders**, **props**, and **where it is used**. Components are grouped by category. A final section lists **V2 components to build**.

---

## 1. Layout

| Component | Path | Renders | Props | Used in |
|-----------|------|---------|-------|---------|
| **AppLayout** | `components/layout/AppLayout.tsx` | Main content wrapper: max-width container, responsive padding, vertical rhythm. | `children`, `className?` | `app/coach/layout.tsx`, `app/client/layout.tsx`, `app/forgot-password/page.tsx`, `app/auth/set-password/page.tsx` |
| **AnimatedPage** | `components/layout/AnimatedPage.tsx` | Wraps children in Framer Motion page enter animation; respects `prefers-reduced-motion`. | `children` | — (exported; used via AnimatedPageWithExit) |
| **AnimatedPageWithExit** | `components/layout/AnimatedPage.tsx` | Wraps children in `AnimatePresence` + `AnimatedPage` keyed by pathname for route-change exit. | `children` | `app/coach/layout.tsx`, `app/client/layout.tsx` |
| **PageHeader** | `components/layout/PageHeader.tsx` | Page title, optional subtitle, optional right-aligned primary action. | `title`, `subtitle?`, `primaryAction?`, `className?` | `app/coach/schedule/page.tsx`, `app/coach/session-packages/page.tsx`, `app/coach/messages/page.tsx`, `app/coach/payments/page.tsx`, `app/coach/settings/page.tsx`, `app/coach/settings/branding/page.tsx`, `app/coach/clients/page.tsx`, `app/client/schedule/ClientScheduleContent.tsx`, `app/client/dashboard/page.tsx` |
| **CoachHeader** | `components/layout/CoachHeader.tsx` | Coach top bar: live time (e.g. "2:30 PM · Saturday, March 14"), green status dot. No props. | — | `app/coach/layout.tsx` |

---

## 2. Navigation

| Component | Path | Renders | Props | Used in |
|-----------|------|---------|-------|---------|
| **SidebarNav** | `components/SidebarNav.tsx` | Collapsible sidebar: logo/brand, nav links with icons and optional badge, collapse toggle, logout. Realtime unread badge for Messages. | `navItems: NavItem[]` where `NavItem = { href, label, badgeCount? }` | `app/coach/layout.tsx`, `app/client/layout.tsx` |
| **MobileBottomNav** | `components/MobileBottomNav.tsx` | Fixed bottom nav (md:hidden): subset of nav items (Home, Schedule, Clients/Programs, Messages, Settings) with icons and optional badge. Listens to `clearpath:unread-messages-updated`. | `navItems: NavItem[]` (same type as SidebarNav) | `app/coach/layout.tsx`, `app/client/layout.tsx` |
| **CoachNav** | `components/CoachNav.tsx` | Horizontal top nav for coach: brand label, links (Home, Clients, Schedule, …), Logout. | — | **Not used** (layouts use SidebarNav + MobileBottomNav) |
| **ClientNav** | `components/ClientNav.tsx` | Horizontal top nav for client: brand label, links (Home, Programs, Schedule, …), Logout. | — | **Not used** (layouts use SidebarNav + MobileBottomNav) |

---

## 3. Forms & inputs

| Component | Path | Renders | Props | Used in |
|-----------|------|---------|-------|---------|
| **Button** | `components/ui/button.tsx` | Styled button; supports `asChild` (Radix Slot). Exports `buttonClasses()` for link styling. | Extends `React.ButtonHTMLAttributes`. `variant?: 'default' \| 'outline' \| 'ghost'`, `size?: 'default' \| 'sm' \| 'lg'`, `asChild?` | Used across app (auth, coach and client pages, modals, empty states). |
| **Input** | `components/ui/input.tsx` | Styled text input (border, focus ring, placeholder). | Extends `React.InputHTMLAttributes<HTMLInputElement>`; `className?` | Login, forgot-password, set-password, coach/client settings, session packages, messages, schedule, payments, client profile editors, programs, videos, daily message. |
| **Textarea** | `components/ui/textarea.tsx` | Styled multiline text input. | Extends `React.TextareaHTMLAttributes<HTMLTextAreaElement>`; `className?` | `app/coach/settings/client-experience/page.tsx`, `app/coach/settings/branding/page.tsx` |
| **FormField** | `components/ui/form.tsx` | Wrapper div with `space-y-1.5` for label + control + description/error. | `className?`, `...HTMLAttributes<HTMLDivElement>` | `app/login/page.tsx`, `app/forgot-password/page.tsx`, `app/auth/set-password/page.tsx` |
| **FormLabel** | `components/ui/form.tsx` | Styled label (block, text-sm, font-medium). | Standard label props; `className?` | Same as FormField. |
| **FormDescription** | `components/ui/form.tsx` | Muted helper text (text-xs). | `className?`, `...HTMLAttributes<HTMLParagraphElement>` | **Not used** in app (available for future forms). |
| **FormError** | `components/ui/form.tsx` | Error text (text-sm, danger color), `role="alert"`. | `className?`, `...HTMLAttributes<HTMLParagraphElement>` | `app/login/page.tsx`, `app/forgot-password/page.tsx`, `app/auth/set-password/page.tsx` |

---

## 4. Data display & lists

| Component | Path | Renders | Props | Used in |
|-----------|------|---------|-------|---------|
| **Card** | `components/ui/card.tsx` | Container with border and shadow; variants: surface, raised, ghost. Optional hover lift when `interactive`. Subcomponents: CardHeader, CardTitle, CardContent. | `variant?: 'surface' \| 'raised' \| 'ghost'`, `interactive?: boolean`, `className?`, `...HTMLAttributes<HTMLDivElement>` | Dashboard, schedule, messages, payments, programs, videos, clients, settings, session packages, analytics, daily message, client schedule/dashboard/programs/videos/settings. |
| **ListRow** | `components/ui/ListRow.tsx` | Single row: leading (e.g. avatar), title, subtitle, meta (e.g. badge), actions. Optional link or onClick. | `title`, `subtitle?`, `leading?`, `meta?`, `actions?`, `href?`, `onClick?`, `className?` | `app/coach/dashboard/DashboardContent.tsx`, `app/coach/clients/[id]/page.tsx`, `app/coach/clients/[id]/SessionHistoryWithPay.tsx`, `app/coach/schedule/page.tsx` |
| **SectionHeader** | `components/ui/SectionHeader.tsx` | Small section title, optional subtitle, optional right-aligned meta. | `title`, `subtitle?`, `meta?`, `className?` | Used inside SectionShell; also `app/coach/schedule/page.tsx`, `app/client/schedule/ClientScheduleContent.tsx`, `app/coach/clients/[id]/ClientProfileDetails.tsx`, `app/coach/clients/[id]/ClientNotesEditor.tsx`, `app/coach/clients/[id]/ClientPortalAccess.tsx`, dashboard, session-packages, and others. |
| **SectionShell** | `components/ui/SectionShell.tsx` | Section with SectionHeader + content area that switches by state: loading (skeleton), error (message + retry), empty (custom content), ready (children). | `title`, `subtitle?`, `meta?`, `state?: 'loading' \| 'empty' \| 'error' \| 'ready'`, `errorMessage?`, `onRetry?`, `emptyContent?`, `children?`, `className?`, `contentClassName?`, `skeletonVariant?: 'hero' \| 'kpi' \| 'list' \| 'chart'` | Not imported directly in app pages; pattern available for section-level loading/empty/error. |
| **KPIBlock** | `components/ui/KPIBlock.tsx` | Small metric card: label, value (bold), optional helperText. | `label`, `value: string \| number`, `helperText?`, `className?` | `components/dashboard/DashboardHero.tsx`, `components/dashboard/DashboardKPIStrip.tsx`, `app/coach/clients/[id]/page.tsx` |
| **StatusBadge** | `components/ui/StatusBadge.tsx` | Pill badge with status color. | `status: 'success' \| 'warning' \| 'danger' \| 'info' \| 'neutral'`, `label`, `className?` | Coach schedule, client schedule, messages, payments, dashboard, client detail, session history. |
| **EmptyState** | `components/ui/empty-state.tsx` | Centered empty state: optional icon, title, description, optional action (link or button). | `title`, `icon?`, `description?`, `action?: { label, href? \| onClick? }`, `className?` | Client schedule, session packages, coach messages, analytics, client dashboard/programs/videos, coach clients/schedule/payments, client detail. |

---

## 5. Modals & overlay

| Component | Path | Renders | Props | Used in |
|-----------|------|---------|-------|---------|
| **Modal** | `components/ui/modal.tsx` | Portal dialog: backdrop, animated panel, focus trap, Escape to close, optional prevent close (e.g. while submitting). | `open`, `onClose`, `children`, `className?`, `preventClose?` | `app/coach/session-packages/page.tsx`, `app/coach/messages/page.tsx`, `app/coach/payments/page.tsx`, `app/coach/schedule/page.tsx`, `app/coach/clients/ClientListWithActions.tsx`, `app/coach/programs/page.tsx` |

---

## 6. Loading & skeletons

| Component | Path | Renders | Props | Used in |
|-----------|------|---------|-------|---------|
| **Loading** | `components/ui/loading.tsx` | Full-screen centered spinner (no props). | — | **Not imported** (pages use PageSkeleton or inline loading state). |
| **Skeleton** | `components/ui/skeleton.tsx` | Pulse placeholder div. | `className?`, `...HTMLAttributes<HTMLDivElement>` | Used internally by SkeletonLine/SkeletonCard in skeleton.tsx; not imported elsewhere. |
| **SkeletonLine** | `components/ui/skeleton.tsx` | Skeleton with h-4 w-full. | Same as Skeleton. | Internal to skeleton.tsx. |
| **SkeletonCard** (skeleton.tsx) | `components/ui/skeleton.tsx` | Simple card-shaped skeleton (title + 3 lines). | Same as Skeleton. | Not used; app uses `components/ui/SkeletonCard.tsx` (variant-based). |
| **SkeletonCard** (variant-based) | `components/ui/SkeletonCard.tsx` | Card-shaped skeleton by variant: list (3 items), hero (title + lines + buttons), kpi (grid of small cards), chart (title + chart area). | `variant?: 'hero' \| 'kpi' \| 'list' \| 'chart'`, `className?` | `components/ui/SectionShell.tsx`, `components/ui/PageSkeleton.tsx` |
| **PageSkeleton** | `components/ui/PageSkeleton.tsx` | Full-page loading: optional header block + N SkeletonCards. | `className?`, `variant?: 'list' \| 'hero' \| 'kpi' \| 'chart'`, `showHeader?`, `cardCount?` | Coach: dashboard, schedule, messages, session-packages, payments, programs, programs/[id], videos, settings, settings/branding, settings/client-experience, analytics. Client: schedule (Suspense fallback), messages. |

---

## 7. Providers

| Component | Path | Renders | Props | Used in |
|-----------|------|---------|-------|---------|
| **ThemeProvider** | `components/providers/ThemeProvider.tsx` | Wrapper that sets CSS vars `--cp-brand-primary`, `--cp-brand-secondary` from props. | `children`, `brandPrimary`, `brandSecondary` | `app/layout.tsx` |
| **ThemeVariantProvider** | `components/providers/ThemeVariantProvider.tsx` | Context for theme variant (blue/orange/purple/red/green/neutral) and mode (light/dark); applies vars and persists to localStorage. Exports `useThemeVariant`, `VARIANT_SWATCH_COLORS`, `ThemeVariant`, `ThemeMode`. | `children` | `app/layout.tsx` |
| **BrandThemeProvider** | `components/providers/BrandThemeProvider.tsx` | Injects org brand colors into CSS vars (primary, secondary, soft/subtle/muted, optional bg). | `brand: OrgBrand`, `children` | Used by ClientBrandWrapper. |
| **ClientBrandWrapper** | `components/providers/ClientBrandWrapper.tsx` | Wraps children in BrandThemeProvider when `brand` is non-null; otherwise renders children only. | `brand: OrgBrand \| null`, `children` | `app/coach/layout.tsx`, `app/client/layout.tsx` |

---

## 8. Chat / messaging

| Component | Path | Renders | Props | Used in |
|-----------|------|---------|-------|---------|
| **MessageBubble** | `components/chat/MessageBubble.tsx` | Single message: text bubble or session-offer card (product name, amount, CTA). Shows sender label when not own; timestamp. Styled by context (coach vs client) and isOwn. | `message: ChatMessage`, `context: 'coach' \| 'client'` | Used only inside MessageThread. |
| **MessageThread** | `components/chat/MessageThread.tsx` | List of messages with date dividers; renders MessageBubble per message. Optional bottom ref for scroll. | `messages: ChatMessage[]`, `context: 'coach' \| 'client'`, `bottomRef?` | `app/coach/messages/page.tsx`, `app/client/messages/page.tsx` |
| **types** | `components/chat/types.ts` | — | Exports `ChatMessage`, `SessionOfferData`. | MessageBubble, MessageThread, coach/client messages pages. |

`ChatMessage`: `id`, `content`, `createdAt`, `isOwn`, `senderLabel?`, `offer?` (SessionOfferData).

---

## 9. Dashboard

| Component | Path | Renders | Props | Used in |
|-----------|------|---------|-------|---------|
| **DashboardHero** | `components/dashboard/DashboardHero.tsx` | Raised card: “Next session” (client name + time or empty copy), Open Schedule / Open Messages buttons, current time, and 2×2 KPI grid (This week $, Upcoming, Pending, Unread). | `currentTime`, `nextSession \| null`, `revenueThisWeek`, `upcomingCount`, `pendingCount`, `unseenMessagesCount` | `app/coach/dashboard/DashboardContent.tsx` |
| **DashboardKPIStrip** | `components/dashboard/DashboardKPIStrip.tsx` | Grid of KPIBlocks: Total revenue, This week, Clients. | `revenue`, `revenueThisWeek`, `totalClients` | `app/coach/dashboard/DashboardContent.tsx` |

---

## 10. V2 components to build

Before implementing new UI, check this list and the registry above: reuse or extend existing components where possible; add new ones here once created.

### Client cards & lists

- **ClientCard** — Summary card for a client (avatar/initials, name, status, last session or next session, quick actions). Use in coach client list and search.
- **ClientListFilters** — Filters/sort for client list (status, search, sort by name/date).

### Messaging

- **ConversationList** / **InboxThreadRow** — Coach inbox: one row per conversation (client name, last message preview, unread count, time). See `05-messaging.md` (inbox, conversation list).
- **MessageComposer** — Send input + optional attachment (if V2 adds attachments). May wrap existing input in messages pages.
- **MessageAttachment** — Display and optional download for file attachments (when `message_type` or attachments exist). See `05-messaging.md` (attachments).

### Calendar & scheduling

- **CalendarMonthGrid** — Month view with day cells and session indicators (reuse or replace logic in `app/coach/schedule/page.tsx`).
- **CalendarWeekView** — Week timeline (e.g. 6:00–22:00) with sessions as blocks. See `06-calendar-scheduling.md` (week view).
- **CalendarDayView** — Single-day timeline (existing day view can be extracted into a component).
- **SessionBlock** — Single session block for calendar (time, client name, status, click to edit).
- **AvailabilitySlotEditor** — Create/edit recurring or one-off availability (V2 coach availability). See `06-calendar-scheduling.md`.
- **BookingPanel** / **BookSessionForm** — Client-facing: choose slot, optional product, submit request or pay. May be composed from existing schedule UI.

### Video

- **VideoPlayer** — In-app playback with progress and optional tracking (V2: stable URL, processing status). See `07-video-pipeline.md`.
- **VideoCard** — Thumbnail, title, duration/status, assign/play actions for coach and client video lists.
- **DriveImportModal** / **DriveFilePicker** — Coach: browse Drive folder, select files, trigger import. See `07-video-pipeline.md` (browse and select).
- **ProcessingStatusBadge** — Queued / Processing / Ready / Failed for video pipeline.

### Program builder

- **ProgramBuilderShell** — Layout for builder: header (name, description, back/delete), structure panel, content panel, assignments panel. See `08-program-builder.md`.
- **ModuleList** / **ModuleCard** — List of modules (weeks/sessions) with add, reorder, edit, remove.
- **ContentBlockList** / **ContentBlockCard** — Ordered list of blocks (text, video, link, task, image) with type icon, preview, drag handle, edit/remove.
- **BlockEditor** (or per-type: **TextBlockEditor**, **VideoBlockEditor**, **TaskBlockEditor**, **ImageBlockEditor**) — Inline or modal edit for each block type.
- **TaskChecklistEditor** — Add/remove/reorder checklist items for a task block.
- **AssignmentPanel** — “Who has access”: assign/remove clients for the program (can build on existing assignment logic in program detail).

### Other

- **DataTable** (optional) — Reusable table with sort, optional filters, for payments, sessions, or analytics. Prefer ListRow/Card patterns first.
- **Toast** / **Notification** — Global toast for success/error (e.g. “Saved”, “Payment sent”). Not present in current registry.

---

## Summary

- **Layout:** AppLayout, AnimatedPage, PageHeader, CoachHeader.  
- **Navigation:** SidebarNav, MobileBottomNav (CoachNav/ClientNav unused).  
- **Forms:** Button, Input, Textarea, FormField, FormLabel, FormDescription, FormError.  
- **Data display:** Card (and subcomponents), ListRow, SectionHeader, SectionShell, KPIBlock, StatusBadge, EmptyState.  
- **Modals:** Modal.  
- **Loading:** PageSkeleton, SkeletonCard (variant-based), Skeleton/SkeletonLine (skeleton.tsx); Loading exists but is unused.  
- **Providers:** ThemeProvider, ThemeVariantProvider, BrandThemeProvider, ClientBrandWrapper.  
- **Chat:** MessageBubble, MessageThread (+ types).  
- **Dashboard:** DashboardHero, DashboardKPIStrip.  

**V2:** Add client cards, conversation list/inbox row, message composer/attachments, calendar views and session/availability components, video player/card/Drive import/processing badge, and program builder (shell, modules, content blocks, block editors, assignment panel). Optionally: DataTable, Toast.

Always check this document before creating a new reusable component.
