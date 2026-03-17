# V2 Video Pipeline — Technical Design

This document designs the full V2 video pipeline: Google Drive OAuth, browse/select, import via Drive API, conversion to MP4, storage, playback, processing status, and Supabase schema. It is the technical spec for the hardest feature to build correctly.

**Current state (V1):** The app has a **video library** that stores `videos` rows with a `url` (YouTube, Vimeo, or Google Drive share link). Coaches add videos by pasting a URL; there is no in-app Google Drive connection. An **n8n** workflow can watch a Drive folder, optionally convert MOV→MP4 via **CloudConvert**, re-upload to Drive, and POST to `POST /api/webhooks/n8n-video` to insert a video. Playback uses `lib/video-embed.ts` to turn URLs into iframe embeds (Drive uses `https://drive.google.com/file/d/{id}/preview`). There is **no** processing status, no conversion inside the app, and no coach-facing Drive browser.

**V2 goal:** Coach connects their own Google Drive (OAuth), browses and selects files in-app, triggers import; the app pulls the file via Drive API, runs a conversion step to MP4, stores the result, and exposes a reliable playback URL with clear status (queued → processing → ready / failed).

---

## 1. Coach connects Google Drive (OAuth flow)

### 1.1 Scope and consent

- Use **Google OAuth 2.0** with the following **Drive API** scopes (read-only for import; optional write if you later support “save to Drive”):
  - `https://www.googleapis.com/auth/drive.readonly` — list files, get metadata, download file content.
  - Optionally: `https://www.googleapis.com/auth/drive.metadata.readonly` if you want to restrict to metadata-only (not sufficient for download; keep `drive.readonly` for import).
- Do **not** use broad `drive` scope; minimal scopes reduce consent friction and audit surface.

### 1.2 Where OAuth runs

- **Option A (recommended): App-owned OAuth**  
  - **Google Cloud Console:** Create OAuth 2.0 Client ID (Web application). Authorized redirect URI: `https://<your-app>/api/integrations/google-drive/callback` (and same for localhost in dev).
  - **App:** Implement two routes:
    - `GET /api/integrations/google-drive/connect` (or `/coach/settings/integrations` → “Connect Google Drive”): Builds the authorization URL with `access_type=offline`, `prompt=consent` (first time to get refresh_token), `state=<csrf+coach_id>`, and redirects the user to Google.
    - `GET /api/integrations/google-drive/callback`: Exchanges `code` for tokens, stores **refresh_token** and **access_token** (and optional expiry) per coach, then redirects to coach Videos or Settings.
  - **Storage of tokens:** Store in Supabase in a **coach_integrations** (or `coach_google_drive_tokens`) table (see Section 8). Encrypt refresh_token at rest if your compliance requires it; at minimum store in a table that only the backend and RLS can access (e.g. service role or coach-only RLS).

- **Option B: Supabase Auth “Sign in with Google”**  
  - Supabase already has Google as a provider for **login** (`docs/auth-google.md`). That flow does **not** grant Drive API scopes; it only gives identity. To use Drive, you would need to either:
    - Add a **second** Google OAuth flow in the app (App-owned, as in Option A) specifically for Drive, or
    - Use a Supabase custom provider / additional scopes if Supabase ever supports adding Drive scopes to the login provider (not standard today).
  - **Recommendation:** Use Option A so Drive connection is independent of login and you control scopes and token storage.

### 1.3 Flow (step-by-step)

1. Coach goes to **Settings → Integrations** (or **Videos → Connect Google Drive**).
2. Clicks “Connect Google Drive.” Frontend calls `GET /api/integrations/google-drive/connect` (or a route that returns the auth URL for a client redirect).
3. Backend generates `state` (e.g. `HMAC(coach_id + nonce, secret)` or signed JWT containing `coach_id`), saves it in a short-lived store (e.g. Redis or signed cookie) if you want to verify it in callback.
4. User is redirected to Google consent screen with `scope=drive.readonly`, `access_type=offline`, `prompt=consent`.
5. After consent, Google redirects to `GET /api/integrations/google-drive/callback?code=...&state=...`.
6. Backend verifies `state`, exchanges `code` for `access_token` and `refresh_token`, resolves `coach_id` from state (or session), stores tokens in `coach_integrations` (or equivalent) keyed by `coach_id`.
7. Redirect to `/coach/videos` or `/coach/settings/integrations` with a success message.

### 1.4 Token refresh

- Before any Drive API call, check access token expiry. If expired, use the stored refresh_token to get a new access_token (and optionally a new refresh_token) via `POST https://oauth2.googleapis.com/token`, then update the stored tokens. Implement this in a small server-side helper used by all Drive API routes.

### 1.5 Disconnect

- Provide “Disconnect Google Drive” which deletes the row (or clears tokens) in `coach_integrations` for that coach. Optionally revoke at Google: `POST https://oauth2.googleapis.com/revoke?token=...`.

---

## 2. Browse and select videos from Drive

### 2.1 Drive API usage

- **List files:** `GET https://www.googleapis.com/drive/v3/files` with query params:
  - `q`: Filter. Example for “my folder” and video MIME types:
    - `'<folder_id>' in parents and (mimeType contains 'video/' or mimeType = 'application/octet-stream')`
  - `fields`: `files(id,name,mimeType,size,modifiedTime,webViewLink)`
  - `orderBy`: `modifiedTime desc`
  - `pageSize`: e.g. 50; use `nextPageToken` for pagination.
- **Folder picker:** Either:
  - Let the coach paste a **folder ID** (from Drive URL: `https://drive.google.com/drive/folders/<folder_id>`), or
  - Use **Drive Picker API** (JavaScript) so the coach can pick a folder in a Google-hosted dialog; then use that folder ID for listing. Picker requires a separate API key (or same OAuth) and `drive.readonly`; on pick you get folder ID and can then list its contents via your backend with the coach’s stored tokens.

### 2.2 App implementation

- **Backend:**  
  - `GET /api/integrations/google-drive/files?folderId=...&pageToken=...`  
  - Auth: require coach session. Load coach’s tokens from `coach_integrations`; refresh if needed. Call Drive API v3 `files.list` with the folder filter above. Return `{ files: [...], nextPageToken }` with `id`, `name`, `mimeType`, `size`, `modifiedTime`, `webViewLink`.
- **Frontend (coach Videos page):**  
  - “Import from Google Drive” opens a modal or side panel.  
  - Either a text input for “Drive folder ID” or a “Choose folder” button that opens Drive Picker; then “Load” fetches `/api/integrations/google-drive/files?folderId=...`.  
  - Show a list of files (name, size, type, modified). Coach selects one or multiple (checkboxes).  
  - “Import” triggers the import flow (Section 3).

### 2.3 Supported formats for import

- Allow common video types: MP4, MOV, AVI, WebM, MKV, etc. (Drive MIME types like `video/mp4`, `video/quicktime`, etc.). List only files that your conversion step supports (Section 4). If conversion is “to MP4 only,” you can still accept MOV/AVI and convert; optionally show a badge “Will be converted to MP4” for non-MP4.

---

## 3. How the video gets imported (pulled via Google Drive API)

### 3.1 Trigger

- From the “Import from Drive” UI, after the coach selects one or more files, the frontend calls:
  - `POST /api/videos/import-from-drive`  
  - Body: `{ driveFileIds: string[] }` (and optionally `folderId` for context).  
  - Auth: coach session.

### 3.2 Backend import flow

1. **Validate:** Resolve coach, ensure Drive is connected (tokens exist), and that the coach has access to the given file IDs (e.g. by calling `files.get` for each with the coach’s token; 404 or 403 → skip or fail that file).
2. **Create import jobs in DB:** For each file, insert a row into a **video_import_jobs** (or **video_processing_jobs**) table with status `queued`, `source_type = 'google_drive'`, `source_file_id`, `coach_id`, `tenant_id`, and optional `title` (from Drive `name`). See Section 8.
3. **Enqueue work:** Push a job to a **queue** (e.g. Supabase Edge Function + pg_cron, Inngest, Trigger.dev, or a small Node worker that polls the table). The worker will:
   - Download file content via Drive API: `GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media` with `Authorization: Bearer <access_token>`. For large files use `Range` headers or Drive’s export for Google Docs; for binary files `alt=media` is correct.
   - Stream or write the file to a temporary location (or stream directly into the conversion service if it accepts uploads).
4. **Idempotency:** Use `(coach_id, source_type, source_file_id)` as a idempotency key so the same Drive file is not imported twice (or allow re-import and update existing record by design).

### 3.3 Download details

- **Size limits:** Decide a max file size (e.g. 2 GB). Reject or mark failed if Drive returns a file larger than that.
- **Timeout:** Set a generous HTTP timeout for `alt=media` (e.g. 5–10 minutes for large files). Consider resumable download for very large files (Drive supports Range requests).
- **Storage of raw file:** Either (a) stream directly into the conversion step without persisting the raw file, or (b) upload the raw file to a “staging” bucket and then pass that path to the converter. (a) is simpler and avoids storing duplicate data; (b) helps with retries if conversion fails.

---

## 4. Conversion step (to MP4)

You need a reliable way to convert non-MP4 (e.g. MOV, AVI) to MP4 and optionally normalize MP4 for web playback. Options:

### 4.1 FFmpeg on a server

- **How:** Run FFmpeg on your own server (VPS, EC2, or a worker that has FFmpeg installed). Worker downloads from Drive (or reads from staging bucket), runs e.g. `ffmpeg -i input.mov -c:v libx264 -c:a aac -movflags +faststart output.mp4`, uploads output to final storage.
- **Pros:** Full control; no per-minute vendor lock-in; can tune codecs and quality; one-time server cost.  
- **Cons:** You operate and scale the server; need to handle concurrent jobs (queue + workers); CPU/memory for large files; you must secure and patch the box.  
- **Cost:** Server cost (e.g. $20–80/mo for a small worker) plus egress. No per-minute transcoding fee.

### 4.2 Cloudinary

- **How:** Upload the file to Cloudinary (via their API or upload preset). Cloudinary can transcode on upload (e.g. “eager” transformations to MP4) or on-the-fly. Store the Cloudinary public_id and use their delivery URL for playback.
- **Pros:** No server to run; good for images + video; transformations and CDN included.  
- **Cons:** Pricing is usage-based (transformation minutes, storage, bandwidth). Free tier is limited; at scale can get expensive.  
- **Cost:** Check cloudinary.com pricing. Free tier ~25 credits/month; video transformation and storage add up. Rough order: ~$0.05–0.10 per minute of video transformed + storage + delivery.

### 4.3 Mux

- **How:** Create an asset via Mux Video API (upload URL or direct upload); Mux transcodes to multiple renditions and serves via Mux Player or HLS/DASH URLs.  
- **Pros:** Purpose-built for video; encoding quality and delivery are excellent; no FFmpeg to run.  
- **Cons:** Cost is per minute of output (and storage/delivery). More than “just convert to one MP4” — you get adaptive streaming.  
- **Cost:** Pricing per “delivered minute” and encoding. See mux.com/pricing. Suited to apps that need quality and scalability over minimal cost.

### 4.4 Transloadit

- **How:** Send the file (or a URL) to Transloadit; use an assembly with a “video/encode” robot to produce MP4. Store the result in S3, GCS, or Supabase Storage via their storage robot.  
- **Pros:** Flexible assembly pipelines; no server to run; can chain import → encode → store in one job.  
- **Cons:** Per-assembly and per-minute encoding cost; another vendor to integrate.  
- **Cost:** Pay per “encoding minute” and assembly; see transloadit.com/pricing.

### 4.5 Recommendation

- **For lowest ongoing cost and full control:** **FFmpeg on a server** (or serverless with a Lambda/Edge function that runs FFmpeg — possible with a Lambda layer or container). Suited if you have moderate volume and can run a worker.
- **For zero ops and best UX (adaptive streaming, reliability):** **Mux** — use when you want broadcast-grade delivery and are okay with per-minute pricing.
- **For a balance (no server, conversion + storage in one place):** **Transloadit** or **Cloudinary**. Transloadit is strong when you want “URL in → MP4 out → store here” in one pipeline.

**Suggested default for V2:** Start with **Transloadit** or **FFmpeg on a single worker** (e.g. Railway, Render, or a small EC2). Use a **queue** (e.g. Supabase table + Edge Function, or Inngest): job state in DB, worker pulls “queued” jobs, downloads from Drive, runs FFmpeg or calls Transloadit, uploads result to your chosen storage (Section 5), then updates status to `ready` or `failed`.

---

## 5. Where the converted MP4 is stored

### 5.1 Supabase Storage

- **How:** Create a bucket (e.g. `videos` or `coach-videos`) with RLS. Worker or backend uploads the MP4 with a path like `{tenant_id}/{coach_id}/{video_id}.mp4`. Generate signed URLs (short-lived) for playback, or make the bucket public for read if acceptable.
- **Pros:** Same stack as your DB; simple; no extra vendor.  
- **Cons:** Egress and storage costs at scale; no built-in CDN (you can put Cloudflare in front).  
- **Cost:** Supabase pricing: storage per GB, egress per GB. Fine for small/medium usage.

### 5.2 Cloudinary

- **How:** Store the transcoded MP4 in Cloudinary; playback URL is their CDN URL.  
- **Pros:** CDN included; one place for transform + storage + delivery.  
- **Cons:** Vendor lock-in; cost scales with storage and bandwidth.  
- **Cost:** See Section 4.2.

### 5.3 S3 (or S3-compatible, e.g. R2)

- **How:** Upload MP4 to a bucket; use presigned URLs or CloudFront for playback.  
- **Pros:** Durable, scalable; CloudFront gives a CDN.  
- **Cons:** More moving parts (IAM, bucket policy, CloudFront if you use it).  
- **Cost:** S3 storage + request + egress; R2 can reduce egress cost.

### 5.4 Recommendation

- **Supabase Storage** is the most consistent with your current stack and keeps everything in one place; use **signed URLs** for playback so you can enforce tenant/coach access in your API. If you outgrow it, add Cloudflare in front or move to S3 + CloudFront later.
- Store in the `videos` table (or linked table) the **storage path** and **storage provider** (e.g. `supabase`), and derive the playback URL in the app (e.g. `GET /api/videos/[id]/playback-url` that returns a signed URL).

---

## 6. How the video is embedded and played

### 6.1 Native HTML5 player

- **When:** Playback URL is a **direct MP4 URL** (e.g. Supabase signed URL, or S3/CloudFront URL).
- **How:** Use `<video src="..." controls />` or a thin wrapper (e.g. React component) with `controls`, `playsInline`, and optional `poster` (thumbnail). No iframe.
- **Pros:** Simple; no third-party player; full control over UI; works with your signed URL endpoint.  
- **Cons:** No adaptive bitrate (ABR); one quality; large files may buffer more on slow connections.

### 6.2 Service (Mux Player, Video.js, etc.)

- **When:** You use **Mux** or another provider that gives HLS/DASH URLs. Then use **Mux Player** or **Video.js** with the HLS URL.
- **Pros:** ABR; better quality on variable networks; analytics (e.g. Mux Data).  
- **Cons:** Extra dependency and possibly cost; more complexity.

### 6.3 Recommendation for V2

- **For Supabase (or S3) stored MP4:** Use **native HTML5** `<video>` with a **signed URL** from your API. Keep `lib/video-embed.ts` for **external** links (YouTube, Vimeo, Drive share link): if `videos.source_type === 'url'` and `videos.url` is set, keep using `getEmbedUrl()` and iframe; if `videos.source_type === 'imported'` and you have a `playback_path` or `storage_path`, use your **playback URL API** and render `<video src={playbackUrl} ... />`.
- **Unify in one player component:** One component that, given a `video` record, chooses: if internal MP4 → `<video>` with signed URL; else → iframe from `getEmbedUrl(video.url)`.

---

## 7. Processing status flow

### 7.1 States

- **queued** — Import job created; not yet picked up by a worker.
- **downloading** — Worker is fetching the file from Google Drive (optional substep; you can fold into `processing`).
- **processing** — Conversion (FFmpeg or third-party) is in progress.
- **uploading** — Converted file is being uploaded to final storage (optional; can be part of `processing`).
- **ready** — Successfully stored; playback URL available; `videos` row is updated and can be shown to coach/client.
- **failed** — Something failed (download, conversion, or upload). Store `error_message` and optionally `error_code` for display and support.

### 7.2 Transitions

- **queued → downloading** (optional) or **queued → processing** when worker starts.
- **downloading → processing** when download completes.
- **processing → uploading** (optional) or **processing → ready** when conversion and upload complete.
- **processing → failed** or **downloading → failed** on error; set `error_message` and `failed_at`.
- **ready** is terminal; **failed** is terminal unless you support “retry” (e.g. set back to `queued`).

### 7.3 Who updates status

- The **background worker** (or the service that runs after Transloadit webhook) updates the **video_import_jobs** (or **video_processing_jobs**) row and, on success, creates or updates the **videos** row with the final `url` (signed URL base or storage path) and sets `thumbnail_url` if generated.
- Optionally use **webhooks** from Transloadit/Mux to update status when they finish, instead of polling.

### 7.4 Coach and client UI

- **Coach:** In Video Library, show “Import from Drive” and a list of “Recent imports” with status badges (Queued, Processing, Ready, Failed). For failed, show “Retry” if you support it. When status is `ready`, the video appears in the main library and can be assigned.
- **Client:** Only videos in `ready` state (and with a valid playback URL) are shown; no change from current behavior except playback may be native `<video>` for imported MP4s.

---

## 8. Supabase tables for video metadata and status

### 8.1 Extend or keep `public.videos`

Keep `public.videos` as the main record for “a video in the library.” Add columns to support both “link” and “imported” videos:

| Column           | Type         | Nullable | Notes |
|-----------------|--------------|----------|--------|
| (existing)       | …            | …        | id, coach_id, title, description, url, category, created_at, thumbnail_url, client_id |
| `source_type`    | TEXT         | NOT NULL | `'url'` \| `'imported'` (default `'url'` for backward compatibility) |
| `storage_provider`| TEXT         | nullable | `'supabase'` \| `'s3'` \| `'cloudinary'` when source_type = 'imported' |
| `storage_path`   | TEXT         | nullable | Path/key in the storage (e.g. `demo/coach-uuid/video-uuid.mp4`) for signed URL generation |
| `processing_status`| TEXT        | nullable | `'ready'` \| `'processing'` \| `'failed'` for imported; null for `source_type = 'url'` |
| `duration_seconds`| INTEGER     | nullable | Optional; from conversion or metadata |

- For **url** videos: `url` is the external link; `storage_path` null; `processing_status` null.  
- For **imported** videos: `url` can be null or a fallback; playback is from signed URL derived from `storage_path`; `processing_status` is set by the worker.

### 8.2 New: `public.coach_integrations` (or `coach_google_drive_tokens`)

Stores OAuth tokens per coach for Google Drive.

| Column          | Type         | Nullable | Notes |
|----------------|--------------|----------|--------|
| `id`           | UUID         | NOT NULL | PK |
| `coach_id`     | UUID         | NOT NULL | FK → profiles(id) ON DELETE CASCADE, UNIQUE per (coach_id, provider) |
| `provider`     | TEXT         | NOT NULL | e.g. `'google_drive'` |
| `access_token` | TEXT         | nullable | Encrypted or plain (prefer encrypt at rest) |
| `refresh_token`| TEXT         | nullable | |
| `expires_at`   | TIMESTAMPTZ  | nullable | |
| `created_at`   | TIMESTAMPTZ  | NOT NULL | default NOW() |
| `updated_at`   | TIMESTAMPTZ  | NOT NULL | default NOW() |

- RLS: coach can read/update/delete only their own row(s). Use service role in backend to read tokens for Drive API calls.

### 8.3 New: `public.video_import_jobs` (or `video_processing_jobs`)

One row per import job (one Drive file = one job).

| Column            | Type         | Nullable | Notes |
|-------------------|--------------|----------|--------|
| `id`              | UUID         | NOT NULL | PK |
| `coach_id`        | UUID         | NOT NULL | FK → profiles(id) |
| `tenant_id`       | TEXT         | NOT NULL | |
| `source_type`     | TEXT         | NOT NULL | `'google_drive'` |
| `source_file_id`  | TEXT         | NOT NULL | Drive file ID |
| `source_file_name`| TEXT         | nullable | Drive file name (for display) |
| `status`          | TEXT         | NOT NULL | `'queued'` \| `'downloading'` \| `'processing'` \| `'uploading'` \| `'ready'` \| `'failed'` |
| `video_id`        | UUID         | nullable | FK → videos(id); set when status = 'ready' |
| `error_message`   | TEXT         | nullable | Set when status = 'failed' |
| `error_code`      | TEXT         | nullable | Optional machine-readable code |
| `created_at`      | TIMESTAMPTZ  | NOT NULL | default NOW() |
| `updated_at`      | TIMESTAMPTZ  | NOT NULL | default NOW() |
| `failed_at`       | TIMESTAMPTZ  | nullable | |

- Indexes: `(coach_id, status)`, `(status)` for worker polling, `(coach_id, source_type, source_file_id)` for idempotency.
- RLS: coach sees only their jobs; worker uses service role to update.

### 8.4 Migration order

1. Add columns to `videos` (source_type, storage_provider, storage_path, processing_status, duration_seconds) with defaults so existing rows remain valid.
2. Create `coach_integrations` (or `coach_google_drive_tokens`).
3. Create `video_import_jobs`.
4. Backfill existing `videos` with `source_type = 'url'` and `processing_status` null.

### 8.5 Optional: `video_thumbnails`

If you generate thumbnails during conversion, you can store path or URL in `videos.thumbnail_url` only, or add a small table for multiple thumbnails (e.g. time-based). For V2, a single `thumbnail_url` on `videos` is enough.

---

## Summary

| Step | Technical approach |
|------|--------------------|
| 1. Connect Drive | App-owned Google OAuth (drive.readonly), tokens in `coach_integrations`, callback at `/api/integrations/google-drive/callback`. |
| 2. Browse/select | Backend `GET /api/integrations/google-drive/files?folderId=...` using stored tokens; optional Drive Picker for folder choice. |
| 3. Import | `POST /api/videos/import-from-drive` creates `video_import_jobs`; worker downloads via Drive API `files.get` with `alt=media`. |
| 4. Convert | Prefer FFmpeg on a worker or Transloadit; Cloudinary/Mux as alternatives with pros/cons and cost tradeoffs. |
| 5. Store | Prefer Supabase Storage with signed URLs; optional S3/Cloudinary. |
| 6. Playback | Native `<video>` for imported MP4 (signed URL from API); keep iframe embed for external URLs via `getEmbedUrl()`. |
| 7. Status | States: queued → downloading/processing → ready or failed; worker updates `video_import_jobs` and `videos`. |
| 8. Tables | Extend `videos` (source_type, storage_path, processing_status); add `coach_integrations`, `video_import_jobs`. |

This design keeps the existing “paste URL” flow intact while adding a full Drive-based import pipeline with clear ownership, status, and playback behavior.
