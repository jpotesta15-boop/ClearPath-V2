import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

function driveRedirectUri(): string {
  const explicit = process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim()
  if (explicit) return explicit
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, '') ?? 'http://localhost:3000'
  return `${base}/api/integrations/google-drive/callback`
}

function appVideosUrl(query: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, '') ?? 'http://localhost:3000'
  return `${base}/coach/videos?${query}`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const err = searchParams.get('error')
  if (err) {
    return NextResponse.redirect(appVideosUrl(`drive_error=${encodeURIComponent(err)}`))
  }

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (!code || !state) {
    return NextResponse.redirect(appVideosUrl('drive_error=missing_code'))
  }

  let workspaceId: string
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { w?: string }
    workspaceId = parsed.w ?? ''
  } catch {
    return NextResponse.redirect(appVideosUrl('drive_error=bad_state'))
  }
  if (!workspaceId) {
    return NextResponse.redirect(appVideosUrl('drive_error=bad_state'))
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(appVideosUrl('drive_error=not_logged_in'))
  }

  const service = createServiceClient()
  const { data: coach } = await service
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!coach?.workspace_id || coach.workspace_id !== workspaceId) {
    return NextResponse.redirect(appVideosUrl('drive_error=workspace_mismatch'))
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(appVideosUrl('drive_error=server_config'))
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: driveRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })

  const tokens = (await tokenRes.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
  }

  if (!tokenRes.ok || !tokens.access_token) {
    return NextResponse.redirect(
      appVideosUrl(`drive_error=${encodeURIComponent(tokens.error ?? 'token_exchange')}`)
    )
  }

  if (!tokens.refresh_token) {
    return NextResponse.redirect(
      appVideosUrl(
        'drive_error=' +
          encodeURIComponent(
            'No refresh token — revoke ClearPath in Google Account → Security and try again, or use Connect again after removing the app.'
          )
      )
    )
  }

  let email: string | null = null
  try {
    const ui = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = (await ui.json()) as { email?: string }
    email = profile.email ?? null
  } catch {
    /* optional */
  }

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()

  const { error: upsertErr } = await service.from('google_drive_connections').upsert(
    {
      workspace_id: workspaceId,
      coach_id: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      google_email: email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id' }
  )

  if (upsertErr) {
    return NextResponse.redirect(appVideosUrl('drive_error=save_failed'))
  }

  return NextResponse.redirect(appVideosUrl('drive_connected=1'))
}
