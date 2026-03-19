# ClearPath — one simple workflow (2–5 min videos, no download in n8n)

## What you get

| Step | Where it runs |
|------|----------------|
| New file in Google Drive folder | **n8n** (tiny JSON only — **no video in n8n memory**) |
| Turn file into **MP4** (via Drive API URL + token, not a public link) | **CloudConvert** (pulls from Google) |
| Host for **playback** on your site | **Supabase Storage** (public `videos` bucket) |
| Save row in video library | **ClearPath** (webhook when conversion finishes) |

**2–5 minute videos:** conversion runs **on ClearPath’s server + CloudConvert**, not inside n8n, so n8n won’t time out or run out of memory.

**The only n8n workflow you need:** `clearpath-drive-folder-video-import.json`  
(3 nodes: sticky note + Watch Drive + filter videos + one HTTP POST.)

---

## A) ClearPath app (once per deploy)

### 1. Environment variables (`.env.local` / Vercel)

| Variable | Where to get it |
|----------|------------------|
| `N8N_CALLBACK_SECRET` | You choose a long random string; **same value** goes into n8n as `CLEARPATH_N8N_SECRET`. |
| `NEXT_PUBLIC_APP_URL` | Public URL, e.g. `https://your-app.vercel.app` (CloudConvert must reach `/api/webhooks/cloudconvert`). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth 2.0 Client ID (Web). Enable **Google Drive API**. |
| `GOOGLE_DRIVE_REDIRECT_URI` | Optional. Default: `{NEXT_PUBLIC_APP_URL}/api/integrations/google-drive/callback` — add **exactly** that under the OAuth client’s **Authorized redirect URIs**. |
| `CLOUDCONVERT_API_KEY` | [CloudConvert → API keys](https://cloudconvert.com/dashboard/api/v2/keys) |
| `CLOUDINARY_CLOUD_NAME` | [Cloudinary dashboard](https://cloudinary.com/console) |
| `CLOUDINARY_API_KEY` | Same |
| `CLOUDINARY_API_SECRET` | Same |
| `CLOUDCONVERT_WEBHOOK_SECRET` | Optional. If set: CloudConvert **account webhook** URL = `{NEXT_PUBLIC_APP_URL}/api/webhooks/cloudconvert` → copy **signing secret** from CloudConvert. If unset, ClearPath verifies the job via CloudConvert API instead. |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | **Only if Vercel Deployment Protection is on.** Same value as **Protection Bypass for Automation** in Vercel (see below). Lets CloudConvert hit your webhook URL and lets n8n POST without the login HTML page. |

### Vercel “Protection Bypass for Automation” (when you see “Authentication Required” HTML)

1. **Vercel** → your project → **Settings** → **Deployment Protection**.
2. Find **Protection Bypass for Automation** → **Generate** (or reveal) the secret → **copy it**.
3. In **Vercel → Environment Variables**, add **`VERCEL_AUTOMATION_BYPASS_SECRET`** = that secret (Production + Preview if needed). **Redeploy.**
4. ClearPath will append `?x-vercel-protection-bypass=...` to the **CloudConvert webhook URL** automatically.
5. In **n8n** workflow variables, add **`VERCEL_AUTOMATION_BYPASS_SECRET`** with the **same** value. Node **3** appends **`?x-vercel-protection-bypass=...`** to the request **URL** (Vercel’s recommended approach when headers misbehave). If you turn protection off, clear that variable so the URL has no query param.
6. **Test** (try **both** — if header fails, use query):

```bash
# Header
curl -sS -D - -o /tmp/out -H "x-vercel-protection-bypass: YOUR_SECRET" "https://YOUR_APP.vercel.app/api/videos/import-from-drive"
# Query
curl -sS -D - -o /tmp/out "https://YOUR_APP.vercel.app/api/videos/import-from-drive?x-vercel-protection-bypass=YOUR_SECRET"
```

First line of body should **not** be `<!DOCTYPE`. If **both** still return the login HTML:

- Secret must come from **Deployment Protection → Protection Bypass for Automation** (not a random string).
- That bypass must be **enabled** for the deployment you’re hitting (check Preview vs Production).
- URL must match the **protected** deployment exactly (no typo, no wrong branch URL).
- Redeploy after adding `VERCEL_AUTOMATION_BYPASS_SECRET` on Vercel (for the webhook side).

### 2. Coach — Videos page

1. Paste **Google Drive folder ID** (from `drive.google.com/drive/folders/THIS_PART`) → Save.  
2. Click **Connect Google Drive** and sign in with the **same Google account** that owns that folder.  
3. Upload test videos to that folder (MOV/MP4/etc.); they’ll show as **processing** then **ready** with playback.

---

## B) n8n (one workflow)

### 1. Import

**Workflows → ⋮ → Import from file** → `clearpath-drive-folder-video-import.json`

### 2. Workflow variables

Workflow **⋮ → Variables**:

| Name | Value |
|------|--------|
| `CLEARPATH_APP_URL` | Same as `NEXT_PUBLIC_APP_URL` (no trailing `/`) |
| `CLEARPATH_N8N_SECRET` | Same as `N8N_CALLBACK_SECRET` |

*(If `$vars` doesn’t work in your n8n, use instance **Settings → Variables** and change expressions to `$env.CLEARPATH_APP_URL` etc.)*

### 3. Node **1 — Watch Drive folder**

- Credential: **Google Drive OAuth2** (same Google account as the import folder).  
- **Folder** → by **ID** → same folder ID as on ClearPath Videos.

### 4. Nodes **2** and **3**

Leave as-is (video filter + POST to ClearPath).

### 5. Activate the workflow

---

## Flow in one sentence

**n8n** says “new file X in folder Y” → **ClearPath** starts CloudConvert on a **Drive URL + your stored Google token** → when done, the app **downloads the temporary MP4** and uploads it to **Supabase Storage** → your library stores the **public playback URL**.

---

## Do not use for this goal

- **`clearpath-drive-url-full-nodes.json`** — runs conversion **inside** n8n (sync); bad for 2–5 min (timeouts).

## API (reference)

- `POST /api/videos/import-from-drive` — body: `folderId`, `driveFileId`, `driveFileName`; header `X-Clearpath-Secret`. If Vercel protection is on, add **`?x-vercel-protection-bypass=SECRET`** to the URL **or** header `x-vercel-protection-bypass: SECRET`.
- `POST /api/webhooks/cloudconvert` — called by CloudConvert only.
