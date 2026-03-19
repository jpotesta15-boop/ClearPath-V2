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

/**
 * GET — redirect coach to Google OAuth (Drive read-only) for the import folder account.
 */
export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID is not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login?next=/coach/videos', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'))
  }

  const service = createServiceClient()
  const { data: coach } = await service
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!coach?.workspace_id) {
    return NextResponse.redirect(
      new URL('/coach/videos?drive_error=no_workspace', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
    )
  }

  const state = Buffer.from(JSON.stringify({ w: coach.workspace_id }), 'utf8').toString('base64url')

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', driveRedirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set(
    'scope',
    [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ')
  )
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)

  return NextResponse.redirect(url.toString())
}
