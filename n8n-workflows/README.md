# n8n workflows for ClearPath

Import these into [n8n](https://n8n.io) to automate video import from Google Drive into your ClearPath video library.

---

## ClearPath — Drive folder → video library

**File:** `clearpath-drive-folder-video-import.json`

When a new file is added to a Google Drive folder that you’ve set as your “import folder” in the ClearPath app, this workflow:

1. Resolves the folder ID to your workspace and coach (ClearPath API).
2. Downloads the file from Drive.
3. **Converts it to MP4** using CloudConvert.
4. Uploads the MP4 to Cloudinary (for playback URL).
5. Creates the video in your ClearPath library via `POST /api/videos/from-n8n`.

Videos then show up on your **Videos** page (and in Realtime if you have the tab open).

---

### Before you import

1. **ClearPath app**
   - In the app, go to **Videos** and set **Google Drive import folder ID** to the folder you’ll upload into (e.g. from `https://drive.google.com/drive/folders/FOLDER_ID` → use `FOLDER_ID`).
   - Ensure **N8N_CALLBACK_SECRET** is set in the app’s environment (e.g. Vercel / `.env.local`). The workflow will send this in the `X-Clearpath-Secret` header.

2. **n8n**
   - **Install the CloudConvert community node:** In n8n go to **Settings → Community Nodes → Install** and add `@cloudconvert/n8n-nodes-cloudconvert`. Restart n8n if prompted.
   - **Google Drive:** Create a “Google Drive” (or “Google Drive OAuth2”) credential in n8n that can see the same folder.
   - **CloudConvert:** Create a CloudConvert credential in n8n (API key at [cloudconvert.com/dashboard/api/v2/keys](https://cloudconvert.com/dashboard/api/v2/keys), or OAuth2). Free tier includes 25 credits/day.
   - **Cloudinary:** Create a Cloudinary credential in n8n (hosts the MP4 and gives you the playback URL).
   - **ClearPath secret:** Create an **HTTP Header Auth** credential in n8n:
     - Name: e.g. `ClearPath n8n secret`
     - Header name: `X-Clearpath-Secret`
     - Header value: the same value as **N8N_CALLBACK_SECRET** in the ClearPath app.

3. **App URL**
   - The workflow defaults to **`http://localhost:3000`** (for local dev). When you deploy, set n8n env **`CLEARPATH_APP_URL`** to your live URL (e.g. `https://app.clearpath.com`) or the Resolve / Add to site nodes will keep using localhost.
   - If n8n runs in **Docker** and your app is on the host, use `http://host.docker.internal:3000` (or your host IP) instead of `localhost`.

---

### Import and configure

1. In n8n: **Workflows** → **Import from File** → choose `clearpath-drive-folder-video-import.json`.
2. Open **Watch folder** and set the **Drive folder** to the same folder ID you pasted in the ClearPath Videos page.
3. In **Resolve folder** and **Add to site**, assign the **HTTP Header Auth** credential (`X-Clearpath-Secret` = `N8N_CALLBACK_SECRET`).
4. In **Download**, assign your **Google Drive** credential.
5. In **Convert to MP4**, assign your **CloudConvert** credential (API key or OAuth2).
6. In **Upload**, assign your **Cloudinary** credential.
7. Save and **Activate** the workflow.

---

### Resolve folder node — setup

The **Resolve folder** node tells ClearPath which workspace and coach the new file belongs to. It must be set up like this:

1. **Credential (required)**  
   - In the node, open the **Credential to connect with** dropdown.  
   - Select (or create) an **HTTP Header Auth** credential.  
   - In that credential set:
     - **Name:** e.g. `ClearPath secret`
     - **Header Name:** `X-Clearpath-Secret`
     - **Header Value:** the **exact same** value as `N8N_CALLBACK_SECRET` in your ClearPath app (`.env.local` or Vercel).  
   - Without this header, the API returns 401 Unauthorized.

2. **URL (no change needed)**  
   - The node builds the URL from:
     - Base: `CLEARPATH_APP_URL` in n8n (if set) or `https://app.clearpath.com`
     - Path: `/api/videos/resolve-folder?folderId=...`
     - The `folderId` is taken from the **Watch folder** trigger: when a new file appears, the file’s parent folder ID is `$json.parents[0]`, so the same folder you’re watching is sent to ClearPath.

3. **What the API does**  
   - ClearPath looks up a workspace whose **Google Drive import folder ID** (set on the Videos page) equals that `folderId`.  
   - If it finds one, it returns `{ workspaceId, coachId }` and the workflow continues.  
   - If none match (or folder not set in the app), it returns 404 and the **Folder in app?** node stops the flow so no video is created.

**Summary:** Create one HTTP Header Auth credential with `X-Clearpath-Secret` = your app’s `N8N_CALLBACK_SECRET`, assign it to the Resolve folder node, and make sure the folder ID you set on the ClearPath Videos page is the same as the folder you chose in the **Watch folder** trigger.

---

### Flow summary

| Step | What it does |
|------|----------------|
| Watch folder | Google Drive trigger: new file in the chosen folder (polls every 1 minute). |
| Resolve folder | `GET /api/videos/resolve-folder?folderId=...` with `X-Clearpath-Secret`. Gets `workspaceId` and `coachId`; if 404, rest of flow is skipped. |
| Folder in app? | IF: only continues if ClearPath returned a workspace. |
| Download | Downloads the Drive file (binary) using your Google credential. |
| Convert to MP4 | CloudConvert: converts the file to MP4 (any video format in → MP4 out). |
| Upload | Cloudinary: uploads the MP4; you get `secure_url`, `duration`, `bytes`. |
| Add to site | `POST /api/videos/from-n8n` with `workspaceId`, `coachId`, `title`, `playbackUrl`, and optional metadata. |

---

### Testing

1. Set the import folder ID in the ClearPath Videos page and the same folder in the n8n trigger.
2. Upload a video (e.g. from your phone) into that Drive folder.
3. Within a few minutes (depending on poll interval), the workflow should run and the video should appear in your ClearPath Videos library.

If the folder isn’t registered in the app, **Resolve folder** returns 404 and the workflow stops without creating a video (no error needed).

**"Folder in app?" goes to false:** Run the workflow and check the **Resolve folder** node output. If statusCode is 404/400, the folderId in the URL doesn't match the app — use the exact same ID as on the Videos page. If statusCode is 200 but the IF still fails, the workflow now checks both `body.workspaceId` and `workspaceId`. You can also set the Resolve URL to a fixed value: `https://YOUR-APP-URL/api/videos/resolve-folder?folderId=YOUR_FOLDER_ID_HERE` (same ID as in the app).
