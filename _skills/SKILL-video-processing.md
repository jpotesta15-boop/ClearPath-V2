---
name: video-processing
description: Single reference for the video pipeline: Google Drive (OAuth + n8n), Drive API list/download, sending to Mux or Cloudinary, processing status in DB (queued/processing/ready/failed), webhooks and polling, final URL storage and playback, and all error states. Use when building or debugging the video pipeline.
---

# Video processing pipeline

This document is the **single reference** for the video pipeline in this project. It covers: Google Drive connection (OAuth and n8n), Drive API usage, sending video to Mux or Cloudinary, how processing status is tracked in the database, how completion is detected (polling vs webhook), how the final URL is stored and served, and every error state that must be handled.

---

## 1. Overview: two paths

| Path | When | Processing status in app |
|------|------|---------------------------|
| **V1 — n8n + webhook** | Current. n8n watches Drive (and optionally converts via CloudConvert), then POSTs to the app. | **None.** Video appears in library only after webhook succeeds. No queued/processing/ready/failed in DB. |
| **V2 — in-app Drive** | Future. Coach connects Drive in-app (OAuth), selects files, app imports via Drive API and sends to Mux or Cloudinary. | **Full.** `video_import_jobs` + optional `videos.processing_status` with queued → processing → ready \| failed. |

Both paths can coexist: URL/link videos (paste or n8n) and imported/processed videos (V2).

---

## 2. Google Drive connection

### 2.1 n8n (current — no app OAuth)

- **Where:** Google Drive is connected **inside n8n**, not in the Next.js app.
- **Credentials:** Configured in n8n (Google account OAuth or service account) for:
  - **Trigger:** “Watch for new/updated files” or “On file created” on a folder.
  - **Download:** “Google Drive Download” node (file content).
  - **Upload:** “Google Drive Upload” node (e.g. after CloudConvert).
- **App env:** The app does **not** use Google credentials. It only exposes `POST /api/webhooks/n8n-video` and uses `N8N_VIDEO_WEBHOOK_SECRET`, `N8N_DEFAULT_COACH_ID`, `NEXT_PUBLIC_CLIENT_ID`.

### 2.2 In-app Google Drive OAuth (V2)

Use **app-owned OAuth** (not Supabase “Sign in with Google”) so you control Drive scopes and token storage.

**Scopes:**

- `https://www.googleapis.com/auth/drive.readonly` — list files, metadata, download. Required for import.
- Do **not** use broad `drive`; minimal scopes reduce consent friction.

**Routes:**

- `GET /api/integrations/google-drive/connect` — Build auth URL with `access_type=offline`, `prompt=consent`, `state=<signed coach_id + nonce>`, redirect to Google.
- `GET /api/integrations/google-drive/callback` — Verify `state`, exchange `code` for tokens, store in `coach_integrations` (or `coach_google_drive_tokens`), redirect to `/coach/videos` or settings.

**Token storage:**

- Table: `coach_integrations` with columns: `coach_id`, `provider` (e.g. `'google_drive'`), `access_token`, `refresh_token`, `expires_at`, `created_at`, `updated_at`.
- Encrypt `refresh_token` at rest if required by compliance; at minimum restrict access via RLS (coach-only read; backend uses service role for Drive API calls).

**Token refresh:**

- Before any Drive API call: if `expires_at` is past (or within a short buffer), call `POST https://oauth2.googleapis.com/token` with `refresh_token`, get new `access_token` (and optionally `refresh_token`), update the row.

**Disconnect:**

- “Disconnect Google Drive” deletes or clears the row for that coach. Optionally revoke: `POST https://oauth2.googleapis.com/revoke?token=...`.

**Env (when V2 is implemented):**

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Redirect URI in Google Cloud Console: `https://<your-app>/api/integrations/google-drive/callback` (and localhost for dev).

---

## 3. Drive API: list and download

### 3.1 List files

- **Endpoint:** `GET https://www.googleapis.com/drive/v3/files`
- **Query params:**
  - `q`: e.g. `'<folder_id>' in parents and (mimeType contains 'video/' or mimeType = 'application/octet-stream')`
  - `fields`: `files(id,name,mimeType,size,modifiedTime,webViewLink)`
  - `orderBy`: `modifiedTime desc`
  - `pageSize`: e.g. 50; use `nextPageToken` for pagination.
- **Auth:** `Authorization: Bearer <access_token>` (coach’s token from `coach_integrations`).
- **App route (V2):** `GET /api/integrations/google-drive/files?folderId=...&pageToken=...` — require coach session, load/refresh tokens, call Drive API, return `{ files: [...], nextPageToken }`.

**Folder picker:** Coach can paste a folder ID (from Drive URL `https://drive.google.com/drive/folders/<folder_id>`) or use Drive Picker API (JavaScript) to choose a folder, then use that ID for listing.

### 3.2 Download file content

- **Endpoint:** `GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media`
- **Auth:** `Authorization: Bearer <access_token>`.
- **Use:** Worker (or server) downloads the binary for conversion. For large files use a generous timeout (e.g. 5–10 minutes) and optionally `Range` headers for resumable download.
- **Size limit:** Enforce a max file size (e.g. 2 GB); reject or mark job failed if exceeded.
- **Idempotency:** Use `(coach_id, source_type, source_file_id)` so the same Drive file is not imported twice (or define explicit “re-import” behavior).

---

## 4. Sending video to Mux or Cloudinary

### 4.1 Mux

- **Flow:** Create an asset via Mux Video API (upload URL or direct upload). Mux transcodes to multiple renditions and serves HLS/DASH.
- **Steps:**
  1. Create asset (and optionally upload URL) via Mux API.
  2. Upload file (from Drive download or stream) to the provided URL, or use Mux direct upload.
  3. Track asset ID in job/video row. Use Mux webhook or poll asset status until `ready` or `errored`.
- **Playback:** Mux Player or Video.js with HLS URL; store `storage_provider = 'mux'` and asset/playback_id in `videos` (e.g. `storage_path` or dedicated column).
- **Cost:** Per delivered/encoding minute; see mux.com/pricing.

### 4.2 Cloudinary

- **Flow:** Upload file to Cloudinary (API or upload preset). Can transcode on upload (e.g. “eager” to MP4) or on-the-fly.
- **Steps:**
  1. Upload binary (or URL) via Cloudinary API.
  2. Optionally request eager transformation to MP4.
  3. Store `public_id` and use Cloudinary delivery URL for playback.
- **Playback:** Store `storage_provider = 'cloudinary'` and `storage_path` (or `public_id`); build delivery URL from Cloudinary base + path.
- **Cost:** Usage-based (transformation minutes, storage, bandwidth); see cloudinary.com pricing.

### 4.3 Current alternative: n8n + CloudConvert (no Mux/Cloudinary in app)

- Conversion happens **in n8n**: Drive trigger → (filter video MIME) → Google Drive Download → CloudConvert job (e.g. MOV → MP4) → poll until done → download MP4 → Google Drive Upload MP4 → POST to `POST /api/webhooks/n8n-video` with the **new** Drive link.
- The app never receives the file; it only receives `title`, `url`, `description`, `category`, optional `coach_id`. No processing status in DB; video appears when webhook succeeds.

---

## 5. Processing status in the database

### 5.1 Current (V1)

- **Table:** `videos` only. Columns used: `id`, `coach_id`, `client_id` (tenant), `title`, `description`, `url`, `category`, `thumbnail_url`, `created_at`.
- **No** `video_import_jobs` table. **No** status column. Videos from n8n appear only after a successful webhook insert.

### 5.2 V2: job table and optional videos columns

**Table: `video_import_jobs` (or `video_processing_jobs`)**

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | PK |
| `coach_id` | UUID | FK → profiles(id) |
| `tenant_id` | TEXT | |
| `source_type` | TEXT | `'google_drive'` |
| `source_file_id` | TEXT | Drive file ID |
| `source_file_name` | TEXT | nullable, for display |
| `status` | TEXT | `'queued'` \| `'downloading'` \| `'processing'` \| `'uploading'` \| `'ready'` \| `'failed'` |
| `video_id` | UUID | nullable, FK → videos(id); set when status = 'ready' |
| `error_message` | TEXT | nullable; set when status = 'failed' |
| `error_code` | TEXT | nullable, machine-readable |
| `created_at`, `updated_at` | TIMESTAMPTZ | |
| `failed_at` | TIMESTAMPTZ | nullable |

**Indexes:** `(coach_id, status)`, `(status)` for worker polling, `(coach_id, source_type, source_file_id)` for idempotency. RLS: coach sees only their jobs; worker uses service role to update.

**Optional columns on `videos` (V2):**

- `source_type`: `'url'` \| `'imported'` (default `'url'` for backward compatibility).
- `storage_provider`: `'supabase'` \| `'s3'` \| `'cloudinary'` \| `'mux'` when imported.
- `storage_path`: path or key for playback (e.g. Supabase path, Cloudinary public_id, Mux asset id).
- `processing_status`: `'ready'` \| `'processing'` \| `'failed'` for imported; null for `source_type = 'url'`.

**State transitions:**

- `queued` → `downloading` (optional) or `queued` → `processing` when worker starts.
- `downloading` → `processing` when download completes.
- `processing` → `uploading` (optional) or `processing` → `ready` when conversion and upload complete.
- Any non-terminal state → `failed` on error; set `error_message`, `error_code`, `failed_at`.
- `ready` and `failed` are terminal unless you implement “retry” (e.g. set back to `queued`).

---

## 6. Polling vs webhook for processing completion

### 6.1 Polling

- **Who:** A background worker (or cron-triggered Edge Function) polls for jobs with status `queued` (or `processing` if checking external job status).
- **Flow:** Worker picks a job, updates to `downloading`/`processing`, downloads from Drive, sends to Mux/Cloudinary (or converts then uploads to Supabase Storage). For Mux/Cloudinary, worker can poll their API for asset/job status until `ready` or `errored`, then update `video_import_jobs` and create/update `videos`.
- **Frequency:** Tune to balance latency and cost (e.g. every 30–60 seconds for job pickup; Mux/Cloudinary polling per their docs).

### 6.2 Webhook

- **Mux:** Configure a webhook URL (e.g. `POST /api/webhooks/mux`) for asset lifecycle events. On `video.asset.ready` or `video.asset.errored`, update `video_import_jobs` and `videos` (set `video_id`, `storage_path`, status, or `error_message`). Verify webhook signature per Mux docs.
- **Cloudinary:** Can use webhooks for upload/transformation completion; same idea: receive callback, update job and `videos`.
- **Idempotency:** Use webhook event ID or (asset_id + event type) to avoid applying the same completion twice.

---

## 7. Final video URL storage and serving

### 7.1 URL/link videos (current and n8n)

- **Storage:** `videos.url` holds the external link (YouTube, Vimeo, or Google Drive share link).
- **Serving:** Use `lib/video-embed.ts` → `getEmbedUrl(url)`:
  - YouTube → `https://www.youtube.com/embed/<id>`
  - Vimeo → `https://player.vimeo.com/video/<id>`
  - Google Drive → `https://drive.google.com/file/d/<fileId>/preview`
- **Player:** iframe with `src={getEmbedUrl(video.url)}`. Thumbnails: YouTube/Vimeo/Drive thumbnail URLs (see coach videos page pattern).

### 7.2 Imported videos (V2)

- **Storage:** `videos.storage_provider` + `videos.storage_path` (or equivalent). `videos.url` can be null or a fallback.
- **Serving:**
  - **Supabase Storage:** Generate a short-lived signed URL from `storage_path`; expose via `GET /api/videos/[id]/playback-url` (auth: coach or assigned client). Return `{ url: signedUrl }`.
  - **Mux:** Use Mux playback ID / HLS URL; store in `videos` and serve via same playback endpoint or direct from frontend using Mux Player.
  - **Cloudinary:** Build delivery URL from `storage_path` (public_id); serve same way (API or direct URL if public).
- **Player:** Single component that, given a `video` row: if `source_type === 'imported'` and playback path exists → `<video src={playbackUrl} ... />` or Mux Player; else → iframe with `getEmbedUrl(video.url)`.

---

## 8. Error states to handle

### 8.1 n8n webhook (`POST /api/webhooks/n8n-video`)

| Condition | Response | Action |
|-----------|----------|--------|
| Missing or wrong `Authorization` / `x-n8n-secret` | 401 Unauthorized | Log; do not insert. |
| Invalid JSON body | 400 Invalid JSON | Log; return message. |
| Zod validation failure (e.g. missing title/url, invalid url) | 400 with first form error message | Return `parsed.error` message. |
| Missing coach: no `coach_id` and no `N8N_DEFAULT_COACH_ID` | 400 coach_id required | Return clear message. |
| Supabase insert error (e.g. FK, RLS) | 400/500 with safe message | Log with `logServerError`; return generic user message. |
| Unexpected throw | 500 | Log; return generic error. |

**Validation schema:** `n8nVideoSchema` in `lib/validations/index.ts`: `title` (required, 1–500), `url` (required, valid http(s) URL), optional `description`, `category`, `coach_id` (UUID).

### 8.2 Google Drive OAuth (V2)

| Condition | Handling |
|----------|----------|
| User denies consent | Redirect back with error query; show “Connection cancelled” in UI. |
| Invalid or missing `state` in callback | Reject; redirect with error; do not store tokens. |
| Token exchange fails (invalid code, expired) | Redirect with error; do not store; offer “Try again”. |
| DB error saving tokens | Log; redirect with “Connection failed, try again”. |

### 8.3 Drive API (V2)

| Condition | Handling |
|-----------|----------|
| Token expired | Refresh with refresh_token before call; if refresh fails, mark integration disconnected and prompt re-connect. |
| 403 Forbidden / 404 Not Found on list or get | Return clear error to client; do not create import job for inaccessible files. |
| File too large (e.g. > 2 GB) | Reject in import endpoint or mark job failed with `error_code: 'FILE_TOO_LARGE'`. |
| Download timeout or network error | Mark job `failed`; set `error_message` and `error_code` (e.g. `DOWNLOAD_FAILED`). |

### 8.4 Conversion / upload (V2 worker)

| Condition | Handling |
|-----------|----------|
| Mux/Cloudinary API error on create or upload | Set job status `failed`; store `error_message` and optional `error_code`; do not create `videos` row. |
| Mux asset `errored` (webhook or poll) | Update job to `failed`; set `error_message` from Mux payload. |
| Supabase Storage upload failure | Mark job `failed`; store error for support. |
| Worker crash or timeout | Job stays `processing` or `downloading`; implement timeout or dead-job detection and set to `failed` with message like “Processing timed out”. |

### 8.5 Playback (V2)

| Condition | Handling |
|-----------|----------|
| Video not found or no access | 404 from playback URL endpoint. |
| Signed URL expired | Client requests new URL (e.g. refetch before play or on 403). |
| Storage path missing for imported video | Treat as broken; show “Video unavailable” in UI. |

### 8.6 UI

- **Coach:** Show “Recent imports” with status badges (Queued, Processing, Ready, Failed). For Failed, show `error_message` and optional “Retry” if supported.
- **Client:** Only list/play videos that are in `ready` state (and have valid playback URL or embed URL). Do not show queued/processing/failed to clients.

---

## 9. Quick reference

| Item | Location / value |
|------|-------------------|
| n8n webhook | `POST /api/webhooks/n8n-video` |
| Webhook auth | `Authorization: Bearer <N8N_VIDEO_WEBHOOK_SECRET>` or `x-n8n-secret` |
| Webhook body | `n8nVideoSchema`: title, url, optional description, category, coach_id |
| Webhook handler | `app/api/webhooks/n8n-video/route.ts` |
| Embed URL helper | `lib/video-embed.ts` → `getEmbedUrl(url)` |
| Videos table | `videos`: id, coach_id, client_id, title, description, url, category, thumbnail_url, created_at |
| V2 job table | `video_import_jobs`: status queued \| downloading \| processing \| uploading \| ready \| failed |
| Drive list (V2) | `GET https://www.googleapis.com/drive/v3/files` with `q`, `fields`, `pageSize`, `pageToken` |
| Drive download (V2) | `GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media` |
| Playback (V2 imported) | Signed URL from `GET /api/videos/[id]/playback-url` or Mux/Cloudinary URL |

Use this document when implementing or debugging any part of the video pipeline.
