# SKILL — n8n Video Processing Workflow Setup (folder-based)

This document describes the folder-based video import flow: coach sets a Google Drive import folder ID in the app; n8n watches that folder (or is triggered when a new file appears), converts the file to MP4, uploads to storage, then creates the video in ClearPath via API. No OAuth or in-app Drive picker.

---

## Title

**ClearPath Video Processing Workflow (folder-based)**

---

## 1. Trigger: new file in Google Drive folder

- Use the **Google Drive** trigger node (e.g. “Watch for new files in folder”) or a **Schedule** trigger that polls Drive for new files in known folders.
- For each new file you need: **folderId** (the Drive folder ID), **fileId** (the file ID), and **fileName** (for the video title).
- n8n uses its own Google credentials (service account or OAuth app) to access the folder — not the coach’s OAuth from the app.

---

## 2. Resolve folder to workspace and coach

- **Method:** GET
- **URL:** `[APP_URL]/api/videos/resolve-folder?folderId={{ $json.folderId }}`
  - Replace `[APP_URL]` with `NEXT_PUBLIC_APP_URL` (e.g. `https://app.clearpath.com` or `http://localhost:3000`).
- **Headers:**
  - `X-Clearpath-Secret`: `[N8N_CALLBACK_SECRET]`
- If the response is **404**, the folder is not registered in ClearPath — skip this file (or log and continue).
- On **200**, the body is `{ workspaceId, coachId }`. Store these for the next steps.

---

## 3. Download file from Google Drive

- **Method:** GET
- **URL:** `https://www.googleapis.com/drive/v3/files/{{ $json.fileId }}?alt=media`
- **Headers:**
  - `Authorization`: `Bearer [your n8n Google access token]`
- **Response format:** File (binary). Save to a binary property (e.g. `video`) for the next node.
- Use the same Google credentials n8n uses to access the folder (service account or OAuth).

---

## 4. Convert and upload

**Option A — Cloudinary (recommended):**

- **URL:** `https://api.cloudinary.com/v1_1/[cloud_name]/video/upload`
- **Method:** POST
- **Body:** Form data with `file` = binary video from the previous node.
- Cloudinary returns: `secure_url`, `duration`, `bytes`, and can generate a thumbnail.

**Option B — Supabase Storage:**

- Upload the converted (or raw) file to your bucket, build the public/signed URL, and derive duration/size if available.

---

## 5. Create video in ClearPath

- **Method:** POST
- **URL:** `[APP_URL]/api/videos/from-n8n`
- **Headers:**
  - `X-Clearpath-Secret`: `[N8N_CALLBACK_SECRET]`
  - `Content-Type`: `application/json`
- **Body:**

```json
{
  "workspaceId": "{{ $('Resolve folder').item.json.workspaceId }}",
  "coachId": "{{ $('Resolve folder').item.json.coachId }}",
  "title": "{{ $json.fileName without extension }}",
  "playbackUrl": "{{ $json.secure_url }}",
  "thumbnailUrl": "{{ $json.secure_url.replace('/upload/', '/upload/so_0/') }}",
  "durationSeconds": {{ $json.duration }},
  "fileSizeBytes": {{ $json.bytes }}
}
```

- Adjust node names (e.g. `Resolve folder`) to match your workflow. Use the filename (without extension) as `title` if you don’t have a separate title.
- On success, ClearPath returns `201` with `{ data: { id } }`. The video appears in the coach’s Video library.

---

## 6. Error handling

- If **resolve-folder** returns 404, skip creating a video (folder not linked to a workspace).
- If download, convert, or upload fails, log the error and do not call **from-n8n** (no video row is created). Optionally retry or move the file to an “failed” folder.

---

## Summary

1. **Trigger** on new file in a Google Drive folder (folderId, fileId, fileName).
2. **GET /api/videos/resolve-folder?folderId=...** with `X-Clearpath-Secret`. If 404, skip. Else get `workspaceId`, `coachId`.
3. **Download** file from Drive using n8n’s Google credentials.
4. **Convert** (if needed) and **upload** to Cloudinary or Supabase Storage.
5. **POST /api/videos/from-n8n** with `workspaceId`, `coachId`, `title`, `playbackUrl`, and optional metadata.

Coach flow in the app: set “Google Drive import folder ID” on the Videos page (paste from the folder URL), then upload videos to that folder from phone or computer. They appear in the library after n8n processes them.
