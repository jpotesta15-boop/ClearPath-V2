# Deploy ClearPath to Vercel

## 1. Push your code to GitHub

If you haven’t already:

- Create a repo on GitHub and push your ClearPath project.
- Vercel will connect to this repo.

## 2. Create the Vercel project

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub is easiest).
2. Click **Add New…** → **Project**.
3. **Import** your GitHub repo (e.g. `clearpath-v2`).
4. **Framework Preset:** Vercel should detect **Next.js**. Leave **Root Directory** as `.` unless the app lives in a subfolder.
5. Do **not** deploy yet — add environment variables first.

## 3. Add environment variables in Vercel

In the project import screen (or later: **Project → Settings → Environment Variables**), add these. Use the same values you have in `.env.local` (copy from your machine; never commit `.env.local`).

### Required — Supabase

| Name | Value | Notes |
|------|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key | Same place |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key | Same place; keep secret |
| `SUPABASE_SESSION_WEBHOOK_SECRET` | Secret for DB webhook | Same as in Supabase webhook config (if you use it) |

### Required — Stripe

| Name | Value | Notes |
|------|--------|--------|
| `STRIPE_SECRET_KEY` | Stripe secret key | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | After adding webhook endpoint (see below) |
| `STRIPE_PRICE_STARTER_ID` | Stripe Price ID for Starter plan | Stripe → Products → your plan → Price ID |
| `STRIPE_PRICE_PRO_ID` | Stripe Price ID for Pro plan | Same |
| `STRIPE_PRICE_SCALE_ID` | Stripe Price ID for Scale plan | Same (or leave empty if you don’t use that tier) |

### Required — App URL and auth

| Name | Value | Notes |
|------|--------|--------|
| `NEXT_PUBLIC_APP_URL` | Your Vercel app URL | e.g. `https://clearpath-v2.vercel.app` (set **after** first deploy if needed, then redeploy) |
| `N8N_CALLBACK_SECRET` | Long random string | Same value you use in n8n as `X-Clearpath-Secret` for resolve-folder and from-n8n |

### Optional — Tenant / branding

| Name | Value | Notes |
|------|--------|--------|
| `NEXT_PUBLIC_CLIENT_ID` | e.g. `default` or `clearpath` | Must match tenant in DB if you use it |
| `NEXT_PUBLIC_CLIENT_NAME` | e.g. `ClearPath` | Shown on login |
| `NEXT_PUBLIC_BRAND_PRIMARY` | Hex e.g. `#0284c7` | UI color |
| `NEXT_PUBLIC_BRAND_SECONDARY` | Hex e.g. `#0369a1` | UI color |
| `NEXT_PUBLIC_DEMO_MODE` | `true` or omit | Demo login UI |

### Optional — n8n (sessions / reminders)

| Name | Value | Notes |
|------|--------|--------|
| `N8N_SESSION_BOOKED_WEBHOOK_URL` | n8n webhook URL | When a session is booked |
| `N8N_SESSION_REMINDER_ON_DEMAND_URL` | n8n webhook URL | “Send reminder” button |
| `N8N_SESSION_REMINDER_SECRET` | Secret for GET /api/sessions/upcoming | If n8n calls that |
| `N8N_VIDEO_WEBHOOK_SECRET` | Legacy video webhook secret | Only if you still use that route |
| `N8N_DEFAULT_COACH_ID` | Coach UUID | Only if n8n omits coach_id |

### Optional — Rate limiting

| Name | Value | Notes |
|------|--------|--------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | Upstash console |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token | Same |

Add each variable for **Production** (and **Preview** if you want). Then deploy.

## 4. Deploy

1. Click **Deploy**. Vercel will build and deploy.
2. After the first deploy, note your URL (e.g. `https://clearpath-v2.vercel.app`).
3. If you didn’t set `NEXT_PUBLIC_APP_URL` yet, add it now with that URL, then **Redeploy** (Deployments → … → Redeploy).

## 5. Stripe webhook for production

1. In **Stripe Dashboard → Developers → Webhooks**, add an endpoint:
   - URL: `https://YOUR-VERCEL-URL.vercel.app/api/webhooks/stripe`
   - Events: choose the events your app uses (e.g. `checkout.session.completed`, subscription events).
2. Copy the **Signing secret** and set it in Vercel as `STRIPE_WEBHOOK_SECRET`, then redeploy.

## 6. n8n workflow after deploy

Once the app is live at e.g. `https://clearpath-v2.vercel.app`:

1. In n8n, open the **Resolve folder** node and set the URL to:
   - `https://clearpath-v2.vercel.app/api/videos/resolve-folder?folderId={{ $json.parents && $json.parents[0] ? $json.parents[0] : '' }}`
2. In the **Add to site** node set the URL to:
   - `https://clearpath-v2.vercel.app/api/videos/from-n8n`
3. Keep the same **X-Clearpath-Secret** header value as `N8N_CALLBACK_SECRET` in Vercel.

## 7. Custom domain (optional)

In Vercel: **Project → Settings → Domains**, add your domain (e.g. `app.clearpath.com`). Then set `NEXT_PUBLIC_APP_URL` to that URL and redeploy.

---

**Checklist**

- [ ] Code pushed to GitHub  
- [ ] Vercel project created and repo connected  
- [ ] All required env vars added (Supabase, Stripe, `NEXT_PUBLIC_APP_URL`, `N8N_CALLBACK_SECRET`)  
- [ ] First deploy successful  
- [ ] Stripe webhook endpoint added for production URL and `STRIPE_WEBHOOK_SECRET` set  
- [ ] n8n workflow URLs updated to your Vercel URL  
