import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { format, addYears } from 'date-fns'

/**
 * GET /api/calendar/feed/client — iCal feed of the authenticated client's sessions.
 * Client only. Returns text/calendar with VEVENTs for sessions in the next year.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.role === 'coach') {
      return NextResponse.json({ error: 'Forbidden — use coach calendar feed' }, { status: 403 })
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('email', user.email ?? '')
      .limit(1)
      .maybeSingle()
    if (!client) {
      return NextResponse.json({ error: 'Client record not found' }, { status: 404 })
    }

    const now = new Date()
    const oneYearLater = addYears(now, 1)
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, scheduled_time, end_time, duration_minutes, status')
      .eq('client_id', client.id)
      .gte('scheduled_time', now.toISOString())
      .lte('scheduled_time', oneYearLater.toISOString())
      .in('status', ['pending', 'confirmed'])
      .order('scheduled_time')

    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ClearPath//Client Sessions//EN',
      'CALSCALE:GREGORIAN',
    ]

    for (const s of sessions ?? []) {
      const start = new Date(s.scheduled_time)
      const end = s.end_time ? new Date(s.end_time) : new Date(start.getTime() + (s.duration_minutes ?? 60) * 60 * 1000)
      const dtStart = format(start, "yyyyMMdd'T'HHmmss'Z'")
      const dtEnd = format(end, "yyyyMMdd'T'HHmmss'Z'")
      icsLines.push(
        'BEGIN:VEVENT',
        `UID:session-${s.id}@clearpath`,
        `DTSTAMP:${format(start, "yyyyMMdd'T'HHmmss'Z'")}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        'SUMMARY:Coaching session',
        'END:VEVENT'
      )
    }

    icsLines.push('END:VCALENDAR')
    const body = icsLines.join('\r\n')

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="my-sessions.ics"',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Something went wrong' },
      { status: 500 }
    )
  }
}
