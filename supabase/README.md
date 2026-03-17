# Supabase CLI — connect and push migrations

This project uses **Supabase** for database and auth. Migrations live in `supabase/migrations/`. To keep your remote project in sync, use the Supabase CLI.

## 1. Install Supabase CLI

**Option A — npm (project-local):**
```bash
npm install -D supabase
```
Then run via: `npx supabase <command>`

**Option B — global (recommended):**
- **Windows (scoop):** `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git` then `scoop install supabase`
- **Windows (npm global):** `npm install -g supabase`
- **macOS:** `brew install supabase/tap/supabase`

Check: `supabase --version`

## 2. Log in

```bash
supabase login
```
This opens the browser to authenticate with your Supabase account.

## 3. Link this folder to your remote project

You need your **project reference ID** from the Supabase dashboard:

- Open [Supabase Dashboard](https://supabase.com/dashboard) → your project
- The URL is `https://supabase.com/dashboard/project/<project-ref>`
- Use that `<project-ref>` (e.g. `abcdefghijklmnop`)

Then run:

```bash
supabase link --project-ref <project-ref>
```

When prompted, enter your **database password** (the one you set when creating the project, or reset it under Project Settings → Database).

Linking stores the connection in `.supabase/` (add this folder to `.gitignore` if you use git).

## 4. Push migrations to the remote database

Apply all migrations in `supabase/migrations/` that haven’t been applied yet:

```bash
supabase db push
```

You’ll see which migrations will be applied. Confirm to run them.

## 5. Optional: pull remote schema

If you or someone else changed the database in the Dashboard (or from another branch), pull the current schema into a migration:

```bash
supabase db pull
```

This creates a new migration file under `supabase/migrations/` reflecting the remote schema. Review and commit it.

## 6. Optional: reset local (Docker) database

If you use **local Supabase** (e.g. `supabase start`), you can reset the local DB and re-apply all migrations:

```bash
supabase db reset
```

---

## Quick reference

| Command              | Purpose                          |
|----------------------|----------------------------------|
| `supabase login`     | Log in to Supabase               |
| `supabase link --project-ref <ref>` | Link this repo to a remote project |
| `supabase db push`   | Apply pending migrations to remote |
| `supabase db pull`   | Create a migration from remote schema |
| `supabase db reset`  | Reset local DB and re-run migrations (requires `supabase start`) |

---

## Migration order (this project)

Migrations run in filename order. Current order:

1. `20240315000000` – base tables  
2. `20240315000001` – workspaces  
3. `20240315000002` – coaches  
4. `20240315000003` – add workspace_id to all tables  
5. `20240315000004` – current_workspace_id()  
6. `20240315000005` – RLS workspace policies  
7. `20240315000006` – drop legacy tenant columns  
8. `20240316000001` – clients V2 columns  
9. `20240316000002` – messages UPDATE (read_at)  
10. `20240316000003` – messages client_id + RLS  
11. `20240316000004` – workspaces onboarding columns  

If your remote DB was created manually or from an older set of migrations, run any missing migrations in this order (e.g. in the SQL Editor), or use `supabase db push` after linking so the CLI can track and apply only new ones.
