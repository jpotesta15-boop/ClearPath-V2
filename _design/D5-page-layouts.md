# D5 — Page Layouts: ClearPath V2

This document describes the **layout of every major page** in ClearPath V2: what appears in each zone (header, sidebar, main content, right panel). Layouts are specified as written descriptions of element placement, not as code. Implement using the spacing and breakpoints from **D4 — Spacing & Layout** and the components from **D3** and **10 — Component Registry**.

Coach-area pages share the same **global chrome**: fixed left sidebar (240px desktop; icon rail below 1024px), and coach header bar at the top of the main area (live time, status dot). Client portal pages use the client layout (sidebar + client header). Within that chrome, each page defines its own content zones below.

---

## 1. Coach dashboard home

**Route:** `/coach/dashboard`

**Purpose:** At-a-glance overview: key metrics, recent activity, and upcoming sessions.

### Zones

- **Header (within main content area)**  
  Page title only (e.g. “Dashboard” or “Home”). No primary action in the header; the page is informational.

- **Sidebar**  
  Standard coach sidebar: logo at top, nav (Dashboard, Clients, Messages, Schedule, Programs, Videos, Payments, Analytics, Settings), profile and logout at bottom. Dashboard item is active/highlighted.

- **Main content**  
  Single column, max-width content area. From top to bottom:

  1. **Summary stats strip (top)**  
     A horizontal row of compact metric blocks. Three primary stats: (1) **Active clients** — count of active clients; (2) **Sessions this week** — count of sessions in the current week; (3) **Unread messages** — count with optional link to Messages. Stats are visually equal (same card or KPI style). Use spacing between blocks per D4 (e.g. gap from scale).

  2. **Two-column section below (desktop)**  
     Left column (roughly two-thirds width): **Recent activity feed**. Chronological list of recent events (e.g. new message, session completed, client joined program, payment received). Each row: icon/type, short description, relative time, optional link to the related resource.  
     Right column (roughly one-third): **Upcoming sessions**. List of next few upcoming sessions (client name, date/time, session type or package name). “View all” or link to Schedule at bottom of the list.

  On smaller viewports the two columns stack: activity feed first, then upcoming sessions.

- **Right panel**  
  None. All content lives in the main area.

---

## 2. Client list page

**Route:** `/coach/clients`

**Purpose:** Browse and search all clients; quick access to message and open profile.

### Zones

- **Header (within main content area)**  
  Left: page title (“Clients”). Right: primary action — “Add client” button (primary style per D3).

- **Sidebar**  
  Standard coach sidebar. Clients nav item is active.

- **Main content**  
  Single column.

  1. **Top bar**  
     **Search bar** (full-width or prominent): text input, placeholder e.g. “Search by name or email”. Optional **filter controls** next to or below search (e.g. filter by status, tag, or “Has upcoming session”). Search and filters sit in one horizontal strip at the top of the content.

  2. **Client grid**  
     Below the search/filter strip, a **grid of client cards**. Each card shows: **photo** (avatar or placeholder), **name**, **status** (e.g. Active, Inactive, or status badge), **last active** (date or “X days ago”), and a **quick message** button (icon or label). Cards are uniform in size; grid is responsive (e.g. 1 column on mobile, 2–3 on tablet, 3+ on desktop). Grid uses consistent gap (e.g. 16px per D4). Clicking the card (or a “View” action) opens the client detail page.

- **Right panel**  
  None.

---

## 3. Client detail page

**Route:** `/coach/clients/[id]`

**Purpose:** Single client view: profile, status, notes, and tabbed areas for messages, sessions, programs, progress.

### Zones

- **Header (within main content area)**  
  Left: client name as page title. Right: one or more actions (e.g. “Request payment”, “Send message”, “Settings” or overflow menu). Optional back or breadcrumb to Clients list.

- **Sidebar**  
  Standard coach sidebar. Clients is active; current client may be implied by context but no nested sidebar.

- **Main content**  
  Two-column layout (desktop): **left column** (about one-third) and **right column** (about two-thirds). On smaller viewports columns stack: left column first, then right.

  - **Left column (client info)**  
    - **Client info block:** Photo/avatar, name, email, phone (if present).  
    - **Status:** Status badge or label (e.g. Active, Inactive, Onboarding).  
    - **Tags:** List or pills of tags (e.g. “Nutrition”, “Strength”) for filtering or context.  
    - **Notes:** Editable or read-only notes section (e.g. internal coach notes). May be expandable or a short preview with “View all”.  
    Optional: portal access link, “Login as client” (if supported), or other account-level actions at bottom of left column.

  - **Right column (tabbed content)**  
    **Tabs** at top: Messages | Sessions | Programs | Progress. Only one tab visible at a time.  
    - **Messages:** Inline list or preview of recent messages with this client; may link to full Messages page with conversation pre-selected.  
    - **Sessions:** List of past and upcoming sessions (date, type, status, payment); actions such as “Mark complete”, “Send reminder”, “Request payment”.  
    - **Programs:** Programs assigned to this client; progress per program; option to assign or remove.  
    - **Progress:** High-level progress (e.g. program completion, sessions completed, or other metrics).  

  Tab content fills the right column below the tab strip. No nested sidebars within this area.

- **Right panel**  
  None. The “right column” is the main content right half, not a separate sticky panel.

---

## 4. Messages page

**Route:** `/coach/messages` (and client equivalent `/client/messages`)

**Purpose:** List conversations and view/send messages in the selected thread.

### Zones

- **Header (within main content area)**  
  Page title (“Messages”) only, or no extra header if the two-column layout is self-explanatory. Optional: “New conversation” or “Daily message” action in a top bar.

- **Sidebar**  
  Standard coach (or client) sidebar. Messages nav item is active; optional unread badge on the nav item.

- **Main content**  
  **Two-column layout** that fills the main content area:

  - **Left column: conversation list**  
    Scrollable list of conversations. Each row: participant name (e.g. client name for coach), last message preview or timestamp, unread indicator if applicable. List is ordered by last activity (newest first). Selecting a row loads that conversation in the right column. On mobile, only one column is visible at a time (list view or thread view with toggle/back).

  - **Right column: active conversation**  
    - **Thread header:** Name of the other participant (and optional subtext, e.g. “Client • Program X”).  
    - **Message thread:** Scrollable area showing messages in chronological order (sender, content, timestamp). Coach/client messages visually distinct (e.g. alignment or background).  
    - **Message input at bottom:** Text input (or textarea) plus send button, fixed or sticky at the bottom of the right column. Optional: attachment or link button.  

  Left column width is fixed or min-width (e.g. 280–320px); right column takes the remaining width. When no conversation is selected, right column shows an empty state (“Select a conversation” or “Start a new message”).

- **Right panel**  
  None. The layout is two columns within main content only.

---

## 5. Calendar page

**Route:** `/coach/schedule` (calendar view); client equivalent `/client/schedule` if applicable.

**Purpose:** View and manage sessions in month or week view with a compact agenda.

### Zones

- **Header (within main content area)**  
  Left: page title (“Schedule” or “Calendar”). Right: **Month / Week toggle** (segmented control or tabs) to switch between month view and week view. Optional: “Add availability” or “New session” button.

- **Sidebar**  
  Standard coach (or client) sidebar. Schedule (or Calendar) nav item is active.

- **Main content**  
  **Primary area: calendar grid**  
  Large calendar grid filling most of the main content. In **month view**: traditional month grid (7 columns for days, rows for weeks); cells show session count or indicators (e.g. dots). In **week view**: time slots (e.g. 7am–9pm) as rows, days as columns; sessions shown as blocks in the grid. Clicking a day or slot may open a detail panel, modal, or navigate to a day detail. Sessions are visually distinct (e.g. color or label). Today is highlighted.

- **Right panel: mini agenda**  
  A **narrow sidebar on the right** of the main content (not the app-level nav sidebar). Contents: **Mini agenda** for the selected day (or today if none selected): list of sessions for that day (time, client name, session type). Optional: “No sessions” when empty. Agenda scrolls if there are many items. Width is constrained (e.g. 200–260px) so the calendar grid remains dominant. On narrow viewports the mini agenda can move below the calendar or be toggled/hidden.

- **Summary**  
  Top: title + month/week toggle (+ optional primary action). Center-left: calendar grid. Right: mini agenda sidebar. No other right panel.

---

## 6. Program builder page

**Route:** `/coach/programs/[id]`

**Purpose:** Edit program structure (modules) and the content of the selected module.

### Zones

- **Header (within main content area)**  
  Left: program name (editable or as title). Right: “Save” and/or “Publish” (or “Done”), and optional “Assign to clients” or “Who has access”. Optional back link to program list.

- **Sidebar**  
  Standard coach sidebar. Programs nav item is active.

- **Main content**  
  **Two-panel layout** inside the main content area (full width allowed per D4; no max-width constraint for this page):

  - **Left panel: program structure**  
    **Modules list.** Each item is a module (e.g. “Week 1”, “Week 2”, “Introduction”). List is vertically scrollable. Modules can be reordered (e.g. drag handle). “Add module” at bottom or between items. Selecting a module loads its content in the main (right) area. Selected module is visually highlighted. Optional: expand/collapse to show lessons or blocks within each module in the list. Width is fixed or min-width (e.g. 260–300px).

  - **Main area (center/right): content editor**  
    **Content editor for the selected module.** When a module is selected: title and optional description of the module (editable). Below: list of **content blocks** (e.g. video, link, note/text, image, task). Each block has type icon/label, title, and optional preview or edit control. “Add block” or “Add content” with type picker (video from library, link, note, image, task). Blocks can be reordered (e.g. drag-and-drop). Clicking a block may expand inline editing or open a small modal. When no module is selected, this area shows an empty state (“Select a module” or “Add a module to get started”).

  Left panel is sticky or scrolls independently; main area scrolls as needed. Layout uses full width of the content area (no 1200px cap for this page).

- **Right panel**  
  None. Optional “Who has access” or assignments may be a section inside the main area or a modal rather than a third column.

---

## 7. Video library page

**Route:** `/coach/videos`

**Purpose:** View all coach videos, their processing status, and import new videos.

### Zones

- **Header (within main content area)**  
  Left: page title (“Video library” or “Videos”). Right: **Import button** (primary: “Import” or “Import from Google Drive”) at top right.

- **Sidebar**  
  Standard coach sidebar. Videos nav item is active.

- **Main content**  
  Single column.

  1. **Top**  
     Optional: search or filter by status (e.g. All, Ready, Processing, Failed). If present, a thin bar below the page header.

  2. **Grid of video thumbnails**  
     Responsive grid of **video cards**. Each card shows: **thumbnail** (poster image or placeholder), **title** (video name), and **status** indicator — one of **Processing**, **Ready**, or **Failed** (e.g. badge or label per D3 status styles). Optional: duration, date added, or “Used in X programs”. Clicking a card may open a detail view, modal, or inline actions (e.g. copy link, add to program, delete). Grid gap and card size follow D4 (e.g. 16px gap, consistent card height). Empty state when no videos: message and “Import your first video” or similar.

- **Right panel**  
  None.

---

## 8. Client portal (client dashboard home)

**Route:** `/client/dashboard` (or `/client`)

**Purpose:** Client’s home: welcome, current program progress, upcoming sessions, and recent messages.

### Zones

- **Header (within main content area)**  
  **Welcome header:** Greeting using client’s first name (e.g. “Hi, Sarah”) and optional short tagline or date. No primary action required in header; page is informational.

- **Sidebar**  
  Client sidebar: logo, nav (Home/Dashboard, Programs, Schedule, Videos, Messages, Settings), profile/logout at bottom. Home/Dashboard is active.

- **Main content**  
  Single column, max-width content area. From top to bottom:

  1. **Welcome header**  
     As above; sets the tone for the page.

  2. **Current program progress**  
     If the client has an assigned program: **progress card or section** showing the current program name, overall progress (e.g. “Module 2 of 4” or progress bar), and optional CTA (“Continue” or “Resume”). If multiple programs, show the primary or most recent one; optional “View all programs” link. If no program: short empty state or “No active program” with optional link to Programs.

  3. **Upcoming sessions**  
     **List or cards** of next upcoming sessions (date, time, coach name or “Coaching session”, optional “Join” or “Add to calendar”). Limit to next 2–5. “View schedule” link to full Schedule page.

  4. **Recent messages**  
     **Preview of recent messages** (e.g. last 2–3) with coach: snippet or subject and date. “View all messages” link to Messages page.

  Sections are stacked vertically with spacing between major sections per D4 (e.g. 48px). Order may be tuned (e.g. program first, then sessions, then messages).

- **Right panel**  
  None. Client portal home is a single-column layout.

---

## Summary checklist

| Page | Header | Sidebar | Main content | Right panel |
|------|--------|---------|--------------|-------------|
| Coach dashboard | Title only | Standard coach | Stats strip; activity feed + upcoming sessions (2-col then stack) | — |
| Client list | Title + “Add client” | Standard coach | Search + filter; client card grid | — |
| Client detail | Client name + actions | Standard coach | Left: info, status, tags, notes. Right: tabs (Messages, Sessions, Programs, Progress) | — |
| Messages | Title (optional) | Standard coach/client | Left: conversation list. Right: thread + input at bottom | — |
| Calendar | Title + Month/Week toggle | Standard coach/client | Calendar grid | Mini agenda (selected day) |
| Program builder | Program name + Save/Publish | Standard coach | Left: modules list. Right: content editor for selected module | — |
| Video library | Title + Import | Standard coach | Video thumbnail grid with status | — |
| Client portal home | Welcome (e.g. “Hi, Sarah”) | Client nav | Program progress; upcoming sessions; recent messages | — |

Use this document together with D3 (component styles), D4 (spacing and breakpoints), and the component registry (10) when implementing or refining each page layout in ClearPath V2.
