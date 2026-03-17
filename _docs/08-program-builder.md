# 08 — Program Builder (V2 Specification)

This document defines the **V2 program system**: a mini course builder inside the coaching dashboard. It builds on the current implementation (see `app/coach/programs/`, `app/client/programs/`, `program_lessons`, `program_assignments`) and extends it with structure (modules/weeks), richer content types (text blocks, embedded video, tasks/checklists), and full progress tracking.

---

## 1. What a program is

A **program** is a structured collection of learning content that a coach creates and assigns to clients. Conceptually it is like a mini course.

- **Structure**: A program is organized into **weeks**, **modules**, or **sessions** (terminology can be configurable). Each of these is a container that has a **title**, optional **description**, and a **sort order**.
- **Content**: Inside each container, the coach adds **content blocks**. Each block can be:
  - **Video** — from the coach’s video library (uploaded) or an **embedded** video (e.g. YouTube/Vimeo URL).
  - **Text** — rich or plain text (instructions, notes, summaries).
  - **Link** — external URL with optional title.
  - **Task / checklist** — one or more items the client can mark complete (e.g. “Complete the worksheet”, “Watch the intro video”).
  - **Image** — image URL (or uploaded asset) with optional caption.

**Current state (V1):** Programs have a **flat list of lessons** (`program_lessons`) with types `video | link | note | image`. There are no “modules” or “weeks”; no tasks/checklists; no embedded video (only library `video_id`). See `ProgramDetailClient.tsx` and `02-database-schema.md` §3.

**V2:** Add an intermediate **module** (or week/session) layer and a **content block** model that supports the types above, including tasks and embedded video.

---

## 2. How a coach creates a program from scratch

### 2.1 Entry point

- **List page**: `/coach/programs` — coach sees all their programs (existing). “Create Program” opens a form: **name**, **description** (optional). On submit, create a row in `programs` and redirect to the **program builder** for that program.
- **Builder**: `/coach/programs/[id]` — single page where the coach builds structure and content.

### 2.2 Builder UI (V2)

- **Header**: Program name (editable), description (editable), “Back to Programs”, “Delete program”.
- **Structure panel**: 
  - List of **modules** (or “weeks” / “sessions” — one term chosen in settings). Each module has:
    - Title (required), optional description, sort order.
    - “Add module” at bottom; drag handle to reorder; “Edit” / “Remove” per module.
  - Optional: “Add week” that groups modules (if product uses weeks as a higher level); for a minimal V2, **modules** alone are enough.
- **Content panel**: 
  - When a module is selected, show the **content blocks** inside that module (ordered list).
  - Per block: type icon, title/preview, drag handle, “Edit”, “Remove”.
  - “Add content” dropdown or buttons: **Text**, **Video** (library or embed), **Link**, **Task / checklist**, **Image**.
- **Assignments panel** (can stay as today): “Who has access” — select clients to assign; remove access. Optionally: “Assign as template to multiple” (see §4).

Flow: Create program → add modules → select module → add blocks (text, video, link, task, image) → reorder modules and blocks → assign clients.

---

## 3. How a coach adds content to a program

Content is added as **content blocks** inside a **module**. Each block has a **type** and type-specific payload.

| Block type   | Coach input | Stored how |
|-------------|-------------|------------|
| **Text**    | Rich or plain text (markdown supported) | `content` text; optional `title`. |
| **Video (library)** | Pick from coach’s `videos` table | `video_id` FK; optional `title` override. |
| **Video (embedded)** | Paste URL (YouTube/Vimeo) or embed code | `url` or `embed_url`; optional `title`; no `video_id`. |
| **Link**    | Title + URL | `title`, `url`. |
| **Task / checklist** | List of items (e.g. “Item 1”, “Item 2”) | JSON array or child rows: `[{ "label": "...", "order": 0 }, ...]`. |
| **Image**   | URL (or upload to storage) + optional caption | `url`, optional `title`/caption. |

- **Order**: Blocks have `sort_order` within a module. Reorder via drag-and-drop (reuse pattern from current `program_lessons` reorder in `ProgramDetailClient.tsx`).
- **Editing**: Inline or modal edit per block; save updates the content block row (and any task items).

**Current state:** Coach adds “lesson” types: video (library), link, note, image. No modules; no tasks; no embedded video. See “Add video / Add link / Add note / Add image” in `ProgramDetailClient.tsx`.

---

## 4. How programs are assigned to clients

### 4.1 One-to-one assignment (current and V2)

- **Program** is a reusable template owned by the coach. The coach **assigns** it to specific **clients** via `program_assignments` (or V2 `client_programs`): one row per (program, client).
- Coach chooses from “Add access” dropdown (clients not yet assigned) and “Remove” for those who have access. Assigning a program can also auto-assign its **videos** to those clients (current behavior in `ProgramDetailClient.tsx` — upsert into `video_assignments` for lessons that have `video_id`).

### 4.2 Template assigned to many (V2 optional)

- **Template program**: A program can be marked as a **template** (e.g. `programs.is_template = true`). Coach can “Assign to multiple”: select many clients at once → create one assignment per (program, client). Each client then gets their own **copy** or **shared** view of the same program (shared = same program_id; copy = optional future “clone for client”).
- For V2, “assign to many” can mean: same program_id, multiple rows in `client_programs` (one per client). No need for cloning unless product requires per-client customization of content.

---

## 5. How clients experience a program

### 5.1 Discovery and entry

- **Client Programs page**: `/client/programs` — list of programs assigned to the client (from `program_assignments` / `client_programs`). Each card shows program name, description, and **progress** (e.g. “2/5 modules”, “3/8 tasks complete”).
- Tapping a program opens **program view**: modules in order; expand/collapse or linear scroll.

### 5.2 Consuming content

- **Modules**: Shown in order. Each module shows title, optional description, then its content blocks.
- **Blocks**:
  - **Text**: Rendered (markdown if supported).
  - **Video (library)**: Inline player or link to `/client/videos` with the video; client can mark “complete” (existing `video_completions`).
  - **Video (embedded)**: Inline embed (iframe or SDK) so client watches in place.
  - **Link**: Button or link opening in new tab.
  - **Task / checklist**: List of items with a checkbox per item. Client can **mark items complete**; state stored per client (e.g. `client_program_task_completions` or JSON on `client_programs`).
  - **Image**: Rendered with optional caption.

### 5.3 Progress

- **Per program**: Progress = f(modules viewed/completed, videos completed, tasks completed). Example: “3/5 modules”, “7/10 tasks”, “4/4 videos”.
- **Marking complete**:
  - **Videos**: Existing `video_completions` (client_id, video_id, completed_at). Same in V2 for library videos.
  - **Tasks**: New: store which task items are done per client and program (e.g. `client_id`, `program_id`, `content_block_id`, `task_item_index` or JSON).
- **UI**: Progress bar or summary at top of program view and on program card in list; optional “Mark module complete” if product wants module-level completion.

---

## 6. Whether coaches can see client progress

**Yes.** Coaches see how each assigned client is progressing through a program.

- **Current**: On program detail (“Who has access”), each assigned client shows “X/Y videos done” (derived from `video_completions` for that client and the video IDs in the program’s lessons). See `ProgramDetailClient.tsx` (completionByClient).
- **V2**: Extend to full progress:
  - **Per client (on program)**: Modules completed, videos completed, tasks completed (e.g. “5/7 modules”, “12/15 tasks”, “4/4 videos”).
  - **Where**: Program detail “Who has access” list; optionally a “Progress” tab or client detail “Programs” section with per-program progress.

Data: Aggregate from `video_completions` (existing) plus new task/completion tables for tasks and optionally module completion.

---

## 7. Complete data model (V2)

### 7.1 Current tables (V1)

- **programs**: `id`, `coach_id`, `name`, `description`, `client_id` (tenant), `created_at`, `updated_at`.
- **program_assignments**: `id`, `program_id`, `client_id` (FK clients), `assigned_at`; UNIQUE(program_id, client_id).
- **program_lessons**: `id`, `program_id`, `video_id` (nullable), `lesson_type` ('video'|'link'|'note'|'image'), `title`, `url`, `content`, `sort_order`, `created_at`.

### 7.2 V2: Programs table (extend)

Keep `programs` as the root. Add optional columns for V2:

| Column        | Type    | Nullable | Notes |
|---------------|---------|----------|--------|
| `id`          | UUID    | NOT NULL | PK (unchanged) |
| `coach_id`    | UUID    | NOT NULL | FK → profiles (unchanged) |
| `name`        | TEXT    | NOT NULL | (unchanged) |
| `description` | TEXT   | nullable | (unchanged) |
| `client_id`   | TEXT    | nullable | Tenant (unchanged) |
| `is_template` | BOOLEAN | NOT NULL DEFAULT false | For “assign to many” (optional) |
| `created_at`  | TIMESTAMPTZ | NOT NULL | (unchanged) |
| `updated_at`  | TIMESTAMPTZ | NOT NULL | (unchanged) |

### 7.3 V2: Modules table (new)

Represents a group (week, module, or session) inside a program.

| Column        | Type    | Nullable | Notes |
|---------------|---------|----------|--------|
| `id`          | UUID    | NOT NULL | PK |
| `program_id`  | UUID    | NOT NULL | FK → programs ON DELETE CASCADE |
| `title`       | TEXT    | NOT NULL | |
| `description` | TEXT   | nullable | |
| `sort_order`  | INTEGER | NOT NULL DEFAULT 0 | Order within program |
| `created_at`  | TIMESTAMPTZ | NOT NULL | |
| `updated_at`  | TIMESTAMPTZ | NOT NULL | |

**Index:** `idx_program_modules_program` ON `program_id`.

### 7.4 V2: Content blocks table (new)

Replaces or coexists with `program_lessons`. If migrating, one option is to add `program_content_blocks` and keep `program_lessons` for backward compatibility until migration; or rename and extend `program_lessons` with `module_id` and new types.

| Column        | Type    | Nullable | Notes |
|---------------|---------|----------|--------|
| `id`          | UUID    | NOT NULL | PK |
| `module_id`   | UUID    | NOT NULL | FK → program_modules ON DELETE CASCADE |
| `block_type`  | TEXT    | NOT NULL | 'text' \| 'video_library' \| 'video_embed' \| 'link' \| 'task' \| 'image' |
| `title`       | TEXT    | nullable | Optional title override |
| `content`     | TEXT    | nullable | Body text, markdown, or JSON for task items |
| `url`         | TEXT    | nullable | For link, image, or embed URL |
| `video_id`    | UUID    | nullable | FK → videos (for block_type = 'video_library') |
| `sort_order`  | INTEGER | NOT NULL DEFAULT 0 | Order within module |
| `created_at`  | TIMESTAMPTZ | NOT NULL | |
| `updated_at`  | TIMESTAMPTZ | NOT NULL | |

**Task blocks:** Store checklist items in `content` as JSON, e.g. `[{ "id": "uuid", "label": "Do X", "order": 0 }, ...]`.

**Indexes:** `idx_content_blocks_module` ON `module_id`.

### 7.5 Client–program assignment (V2)

Keep **program_assignments** for assignment; optionally add progress fields in a separate table or on assignment.

**Option A — program_assignments (current) plus progress table:**  
Keep `program_assignments` as is. Add **client_program_progress** (or similar): e.g. `client_id`, `program_id`, `completed_module_ids` (JSONB array), `last_accessed_at`, etc. Task completions in **client_task_completions** (see below).

**Option B — client_programs (single assignment table):**  
Rename or introduce `client_programs`: `id`, `program_id`, `client_id`, `assigned_at`, optional `started_at`, `progress_json` (JSONB) for denormalized progress. Same task completions table.

For clarity this spec uses **client_programs** as the assignment table name in V2 (can be implemented as `program_assignments` with optional new columns).

| Column        | Type    | Nullable | Notes |
|---------------|---------|----------|--------|
| `id`          | UUID    | NOT NULL | PK |
| `program_id`  | UUID    | NOT NULL | FK → programs ON DELETE CASCADE |
| `client_id`   | UUID    | NOT NULL | FK → clients ON DELETE CASCADE |
| `assigned_at` | TIMESTAMPTZ | NOT NULL | |
| `started_at`  | TIMESTAMPTZ | nullable | First view (optional) |
| UNIQUE(program_id, client_id) | | | |

### 7.6 Task completions (V2)

Store which task items a client has completed.

| Column           | Type    | Nullable | Notes |
|------------------|---------|----------|--------|
| `id`             | UUID    | NOT NULL | PK |
| `client_id`      | UUID    | NOT NULL | FK → clients ON DELETE CASCADE |
| `content_block_id` | UUID  | NOT NULL | FK → program_content_blocks ON DELETE CASCADE |
| `task_item_id`   | TEXT    | NOT NULL | Id from block’s JSON (e.g. item.id) |
| `completed_at`   | TIMESTAMPTZ | NOT NULL | |
| UNIQUE(client_id, content_block_id, task_item_id) | | | |

**Indexes:** `idx_task_completions_client`, `idx_task_completions_block`.

### 7.7 Backward compatibility with V1

- If **modules** are optional: Programs with no modules can be shown as a single “default” module whose content is the existing `program_lessons` (mapped to content block types: video, link, note, image). New programs use modules + content blocks only.
- Migration path: Script to create one `program_modules` row per program and move each `program_lessons` row into `program_content_blocks` with `module_id` and appropriate `block_type`/`content`/`url`/`video_id`.

---

## 8. Supabase tables and RLS policies

### 8.1 Tables summary

| Table | Purpose |
|-------|---------|
| **programs** | Coach-owned program definition; optional `is_template`. |
| **program_modules** | Modules (weeks/sessions) inside a program; ordered by `sort_order`. |
| **program_content_blocks** | Content blocks inside a module; type + type-specific fields; ordered. |
| **program_assignments** (or **client_programs**) | Which client has which program; optional progress fields. |
| **client_task_completions** | Per-client, per–content block, per–task item completion. |
| **video_completions** | (Existing) Per-client video completion for library videos. |

Existing: **videos**, **program_lessons** (if kept during migration).

### 8.2 RLS: programs

- **Coaches (tenant):** `ALL` where `client_id = get_current_client_id()` and `coach_id` in profiles with `auth.uid()` and `role = 'coach'` and `tenant_id = get_current_client_id()`.
- **Clients:** No direct SELECT on `programs`; they see programs only via assignment table + join to program for name/description.

(Matches current tenant isolation in `20240102000000_add_tenant_isolation.sql`.)

### 8.3 RLS: program_modules

- **Coaches:** `ALL` where module’s program belongs to coach in tenant (e.g. `EXISTS (SELECT 1 FROM programs WHERE programs.id = program_modules.program_id AND programs.coach_id = auth.uid() AND programs.client_id = get_current_client_id())`).
- **Clients:** `SELECT` where the program is assigned to the client (e.g. `EXISTS (SELECT 1 FROM program_assignments pa JOIN clients c ON c.id = pa.client_id WHERE pa.program_id = program_modules.program_id AND c.email = (SELECT email FROM profiles WHERE id = auth.uid()))`).

### 8.4 RLS: program_content_blocks

- **Coaches:** `ALL` where the block’s module’s program belongs to coach (via `program_modules` → `programs`).
- **Clients:** `SELECT` where the block’s module’s program is assigned to the client (via `program_modules` → `program_assignments` + client match by email).

### 8.5 RLS: program_assignments (or client_programs)

- **Coaches:** **INSERT / UPDATE / DELETE** where the program belongs to the coach in tenant. (Current schema doc notes a **gap**: only client SELECT exists; coach mutations may rely on service role or fail. V2 must add: `FOR ALL` for coach: `EXISTS (SELECT 1 FROM programs WHERE programs.id = program_assignments.program_id AND programs.coach_id = auth.uid() AND programs.client_id = get_current_client_id())`.)
- **Clients:** `SELECT` where `client_id` matches the client record for `auth.uid()` (email match) and program is in tenant (unchanged).

### 8.6 RLS: client_task_completions

- **Clients:** `ALL` (SELECT, INSERT, UPDATE, DELETE) where `client_id` is the client row for current user (email match in clients).
- **Coaches:** `SELECT` where `client_id` is in their clients (e.g. `client_id IN (SELECT id FROM clients WHERE coach_id = auth.uid())`).

### 8.7 RLS: video_completions

- Keep existing: clients manage own; coaches SELECT for their clients in tenant.

### 8.8 Indexes

- `program_modules`: `(program_id)`, optionally `(program_id, sort_order)`.
- `program_content_blocks`: `(module_id)`, `(module_id, sort_order)`.
- `program_assignments`: existing `(program_id)`, `(client_id)`; optional `(client_id)` for “my programs” query.
- `client_task_completions`: `(client_id)`, `(content_block_id)` for aggregating progress.

---

## Summary

| Aspect | V1 (current) | V2 |
|--------|--------------|-----|
| Structure | Flat list of lessons | Programs → modules → content blocks |
| Content types | video, link, note, image | text, video_library, video_embed, link, task, image |
| Tasks | No | Yes; per-item completion stored |
| Assignment | program_assignments per client | Same; optional “assign to many”; fix coach RLS |
| Client view | List programs + lessons | List programs with progress; drill into modules/blocks; mark tasks complete |
| Coach progress | “X/Y videos done” per client | Full progress: modules, videos, tasks |
| Data | programs, program_lessons, program_assignments | + program_modules, program_content_blocks, client_task_completions; optional client_programs |

This document is the single reference for implementing the V2 program builder: builder UI, content model, assignment, client experience, progress, and Supabase schema and RLS.
