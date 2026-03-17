# M6 — Backup and Recovery

**Purpose:** This is the playbook you use at 2am when something is broken. It defines backup strategy, recovery steps, and what can never be recovered so you can protect it.

---

## 1. Supabase Pro daily backups

### 1.1 Confirm they are enabled

- **Pro plan:** Daily backups are **automatic** for all Pro projects. No toggle to “enable”; they run by default.
- **Verify:** Supabase Dashboard → **Database** → **Backups** (or [Database > Backups](https://supabase.com/dashboard/project/_/database/backups/scheduled)).
- You should see **Scheduled** (daily) backups listed with dates. If the list is empty or stale, check project plan and contact Supabase support.

### 1.2 Retention (Pro plan)

| Plan   | Daily backup retention |
|--------|-------------------------|
| Pro    | **7 days**              |
| Team   | 14 days                 |
| Enterprise | 30 days             |

- Only backups within the retention window are available for restore.
- **Point-in-Time Recovery (PITR)** is an add-on (7 / 14 / 28 days retention, billed separately). If enabled, PITR replaces daily backups and allows restore to any second within the retention window. Enable at **Project Settings → Add-ons**.

### 1.3 How to restore from a backup

1. **Dashboard:** Database → **Backups** → choose the backup **closest before** the desired restore point → **Restore**.
2. Confirm in the prompt. **The project is unavailable during restore.** Downtime depends on database size.
3. When restore completes, the dashboard shows a notification. Re-test app and auth.
4. **Important:** Daily backups do **not** include passwords for custom roles. After restore, reset any custom role passwords.
5. **Realtime / replication:** If you use subscriptions or replication slots (other than Realtime), drop them before restore and re-create after. Realtime’s slot is handled by Supabase.

**If you use PITR:** Database → **Backups** → **Point in Time** → **Start a restore** → pick date/time within the recovery window → confirm. Same downtime and post-restore checks apply.

**Programmatic restore (PITR):** Management API: `POST /v1/projects/{ref}/database/backups/restore-pitr` with `recovery_time_target_unix`. See [Supabase Management API](https://supabase.com/docs/reference/api/v1-restore-pitr-backup).

### 1.4 What database backups do **not** include

- **Storage (files):** Restoring a database backup does **not** restore Storage bucket objects (avatars, videos, etc.). Storage must be backed up and restored separately (see §3).
- **Custom role passwords:** Must be reset after a restore.

---

## 2. Before every database migration (V2) — required step

**Rule:** Before running **any** database migration in V2, create a known restore point. This is a **required step** in the deployment process.

### 2.1 Required: confirm or create a restore point

1. **Supabase Dashboard:** Open **Database** → **Backups**.
2. **Confirm** the most recent daily backup is present and **note its timestamp**. That is your restore point if the migration fails.
3. **Optional but recommended for critical migrations:** Create a manual logical backup so you are not relying only on the last daily run:
   ```bash
   supabase db dump -f backup_pre_migration_$(date +%Y%m%d_%H%M).sql
   ```
   Store the file in a secure, off-project location (e.g. team drive, encrypted bucket). Do not commit it to the repo.

### 2.2 Deployment process (document in your runbook)

- **Pre-migration checklist (required):**
  1. Open Supabase Dashboard → Database → Backups.
  2. Confirm latest scheduled backup exists; note date/time.
  3. (Recommended) Run `supabase db dump` and store the file.
  4. Run the migration (e.g. `supabase db push` or your migration runner).
  5. Smoke-test app and critical flows.
- If the migration causes data loss or breakage, restore from the backup you noted (Dashboard → Backups → Restore) or from your dump (restore via `psql` or Supabase SQL editor against a new DB if needed).

### 2.3 Where this is documented

- Add this “Pre-migration backup” step to **docs/DEPLOY_CHECKLIST.md** (and any CI/deploy docs) so it is never skipped.

---

## 3. Video and file storage backups

### 3.1 Where ClearPath stores files

- **Avatars / coach branding:** Supabase Storage bucket **`avatars`** (see `supabase/migrations/20240114000000_storage_avatars.sql`).
- **Videos (V2):** Design supports **Supabase Storage** (e.g. `videos` or `coach-videos` bucket) and/or **Cloudinary** (see `07-video-pipeline.md`, `.cursor/skills/video-processing/SKILL-video-processing.md`). Current V1 video library uses external URLs; V2 may add imported video files to Supabase or Cloudinary.

### 3.2 Supabase Storage

- **Built-in backups:** Supabase’s database backup/restore **does not** include Storage objects. Bucket files are **not** restored when you restore a database backup.
- **Strategy:**
  - **Option A:** Use a third-party backup service (e.g. SimpleBackups, or custom job) to copy bucket contents to another store (e.g. S3, GCS) on a schedule.
  - **Option B:** Periodic manual export: use Supabase client or Storage API to list and download objects from `avatars` (and any video bucket) to a secure backup location.
- **Restore:** Re-upload objects from your backup into the same bucket paths (and ensure RLS/policies are re-applied via migrations if you restored to a new project).

### 3.3 Cloudinary (if used for video)

- **Backup:** Cloudinary backup is **off by default**. Enable it so you can recover deleted assets and versions.
- **Enable:** Cloudinary Console → **Settings** → **Backup** → turn on **Enable automatic backup** → Save. Run **Perform initial backup** once to back up existing assets.
- **Scope:** Only originals are backed up; derived/transformed assets can be regenerated.
- **Restore:** Use Media Library to restore previous versions or recover deleted assets. Do not change backup folder structure if using custom S3/GCS backup.

### 3.4 Summary

| Storage        | Backed up by default? | Action |
|----------------|------------------------|--------|
| Supabase DB    | Yes (daily, 7 days Pro) | Confirm in Dashboard; optional PITR add-on. |
| Supabase Storage (avatars, videos) | No | Add external backup (script or service) and document restore steps. |
| Cloudinary     | No (opt-in)           | Enable automatic backup in Console; run initial backup. |

---

## 4. Disaster recovery procedure (app down)

Use this order to diagnose and restore service.

### Step 1 — Confirm scope

- **Symptom:** Site down, 5xx, or “something broken.”
- **Check:** Open the app in a browser; call `GET /api/health` (or your health endpoint). Note: 503 = env/DB or critical dependency.
- **Check:** Vercel Dashboard → Project → **Deployments** and **Logs** (and **Functions** if used). Look for failed builds or runtime errors.
- **Check:** Supabase Dashboard → **Project health / Status** and **Logs** (Database, Auth, API).

### Step 2 — Restore traffic quickly (if it’s a bad deploy)

- If the outage started right after a deployment, **roll back the deployment first** (see §5). Restoring traffic often fixes “app down” in under 2 minutes.
- After rollback, re-check health and logs. If the app is up, continue with root-cause analysis off critical path.

### Step 3 — Classify failure

- **Application / code:** Errors in Vercel logs, broken route, missing env. → Fix code, deploy preview, then promote or deploy to prod (§5).
- **Database:** Supabase unreachable, migrations failed, or data corruption. → Use Supabase Dashboard (Status, Logs). If needed, restore from backup (§1.3). Then re-run any migrations that are safe and required.
- **Auth:** Supabase Auth issues (e.g. redirects, JWT). → Check Supabase Auth settings (URLs, redirect URLs, providers). Fix config and redeploy if env changed.
- **Storage:** Avatars or videos missing/errors. → Check Supabase Storage (and Cloudinary if used). Restore from your storage backup if you have one (§3).
- **Third-party:** Stripe, n8n, etc. → Check status pages and your webhook/API logs. No backup to restore; fix integration or config.

### Step 4 — Restore data (if needed)

- **Database:** Database → Backups → choose restore point → Restore. Then re-apply any post-restore steps (passwords, replication slots).
- **Storage:** Restore from your Supabase Storage backup (and Cloudinary backup if used) per §3.
- **Env/secrets:** If env vars were changed or lost, restore from your secrets store (e.g. Vercel env, 1Password). Redeploy so new env is active.

### Step 5 — Verify and communicate

- Hit health and main user flows (login, coach dashboard, client view, one payment flow if applicable).
- If you had an outage, inform users (status page or email) and document the incident and follow-up actions.

### Quick reference

| Step | Action |
|------|--------|
| 1    | Confirm scope (app, health, Vercel, Supabase). |
| 2    | If post-deploy: instant rollback (§5). |
| 3    | Classify: app / DB / auth / storage / third-party. |
| 4    | Restore data from backups if needed (§1, §3). |
| 5    | Verify flows; communicate. |

---

## 5. Roll back a bad Vercel deployment (< 2 minutes)

Vercel keeps previous deployments. Use **instant rollback** to point production back to the last known good deployment without a new build.

### 5.1 From the dashboard

1. Vercel Dashboard → your project → **Deployments**.
2. Find the **current production** deployment (bad one) and the **previous** (good) one.
3. On the **previous (good)** deployment → **⋯** (menu) → **Promote to Production** (or **Rollback** depending on UI).
4. Confirm. Production traffic switches to that deployment in seconds.

### 5.2 From the CLI (fastest if you’re in terminal)

```bash
# Roll back to the previous production deployment (instant)
vercel rollback

# Confirm
vercel rollback status
```

- **Pro/Enterprise:** To roll back to a specific older deployment: `vercel rollback <deployment-url>`.
- **Hobby:** Rollback only to the **immediately previous** production deployment.

### 5.3 Promote a specific deployment to production

```bash
vercel promote <deployment-url>
vercel promote status
```

### 5.4 Important after rollback

- **Environment variables:** Rollback does **not** change env vars. If the break was caused by a bad or missing env var, fix it in Vercel → Project → Settings → Environment Variables, then redeploy or promote again.
- **Auto deployments:** After a rollback, Vercel may disable auto-assignment of production to new commits. You may need to **promote** the next good deployment to production manually when ready.

### 5.5 After service is restored

- Use **vercel list --prod** and **vercel inspect <deployment-url>** (and **vercel logs**) to find what changed in the bad deployment.
- Fix in code, deploy a preview, test, then **vercel deploy --prod** or **vercel promote**.

---

## 6. Data that can never be recovered if lost

Define these so they are explicitly covered by backups or accepted as unrecoverable.

### 6.1 Must be backed up (recoverable)

| Data | Where it lives | Backup mechanism | If lost |
|------|----------------|-------------------|--------|
| **User and app data** (profiles, clients, sessions, programs, messages, payments, video metadata) | Supabase DB | Pro daily backups (7 days); optional PITR; optional pre-migration dump | Restore from backup (§1). |
| **Auth state** (users, sessions) | Supabase Auth (in DB) | Same as DB backups | Restore from same backup; reset custom role passwords if any. |
| **Avatars / coach logos** | Supabase Storage `avatars` | Not automatic; need external backup (§3) | Permanent unless you have your own backup. |
| **Imported video files (V2)** | Supabase Storage or Cloudinary | Supabase: external backup; Cloudinary: enable backup (§3) | Permanent unless backed up. |

### 6.2 Recoverable only from your own backups

- **Supabase Storage** (avatars, any coach/video buckets): Supabase does not back these up with DB restore. **If you don’t have your own backup, they are unrecoverable** after a project restore or accidental deletion.
- **Cloudinary:** If automatic backup was never enabled, **deleted or overwritten assets are unrecoverable**.

### 6.3 Typically not recoverable (accept or mitigate)

| Data | Why | Mitigation |
|-----|-----|------------|
| **Custom role passwords** (Supabase) | Not stored in daily backups | Reset after any DB restore; document in runbook. |
| **Env vars / secrets** (Vercel, etc.) | Not part of DB or code backup | Store in a secrets manager or secure doc; restore manually after incident. |
| **In-memory or ephemeral state** | Never persisted | Accept loss; design so nothing critical depends on it. |
| **Logs and metrics** (Vercel, Supabase) | Retention limits | Export or forward to long-term storage if you need them. |
| **Third-party state** (e.g. n8n run history, Stripe idempotency outside your DB) | Outside your control | Rely on provider; document which actions are idempotent. |

### 6.4 Checklist: “Can we recover it?”

- **Database (schema + data):** Yes, if within Pro 7-day window (or PITR window). Pre-migration dumps extend safety.
- **Storage (Supabase):** Only if you added your own backup (§3). Otherwise **no**.
- **Cloudinary:** Only if backup was enabled and initial backup run. Otherwise **no** for deleted/overwritten assets.
- **Application code:** Yes (git + Vercel deployment history).
- **Secrets:** Only from your own secrets store or backup.

---

## 7. Quick reference card (2am checklist)

| Situation | Action |
|-----------|--------|
| **App down after deploy** | Vercel → Rollback or `vercel rollback` → verify health. |
| **DB wrong / corrupted** | Supabase → Database → Backups → Restore to last good point; reset custom passwords; re-test. |
| **Need restore point before migration** | Database → Backups (note latest); optional `supabase db dump`; then run migration. |
| **Storage (avatars/videos) gone** | Restore from your Supabase Storage backup; if none, treat as unrecoverable and improve backup (§3). |
| **Cloudinary assets gone** | Restore from Cloudinary backup (if enabled); otherwise unrecoverable. |
| **Secrets / env wrong** | Fix in Vercel (or Supabase) → redeploy or promote. |
| **Don’t know what’s wrong** | Follow §4 step by step: scope → rollback if recent deploy → classify → restore data if needed → verify. |

---

*Document owner: ClearPath team. Keep this file next to DEPLOY_CHECKLIST.md and runbooks; update when backup or deployment process changes.*
