import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { addWeeks, startOfWeek, addDays, getYear, getMonth, getDate } from 'date-fns'

const pad = (n: number) => String(n).padStart(2, '0')

/** Build UTC Date from (y,m,d,h,min) interpreted in the given IANA timezone. Uses Intl (no date-fns-tz). */
function fromZonedTime(dateTimeStr: string, timeZone: string): Date {
  const [datePart, timePart] = dateTimeStr.split('T')
  const [y, m, d] = (datePart ?? '').split('-').map(Number)
  const [h = 0, min = 0, sec = 0] = (timePart ?? '00:00:00').split(':').map(Number)
  if (timeZone === 'UTC') {
    return new Date(Date.UTC(y, m - 1, d, h, min, sec))
  }
  const utcTrial = Date.UTC(y, m - 1, d, h, min, sec)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcTrial))
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10)
  const inTzMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  const offsetMs = utcTrial - inTzMs
  return new Date(utcTrial - offsetMs)
}

/**
 * POST /api/availability/materialize — generate availability_slots from recurring_availability for next 6 weeks.
 * Coach only. Rate limit 5/min. Uses coach timezone from profiles.timezone (default UTC).
 */
export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
    const { success, retryAfter } = await checkRateLimitAsync(`availability-materialize:${ip}`, { windowMs: 60_000, max: 5 })
    if (!success) {
      const res = NextResponse.json({ error: 'Too many requests — try again in a minute' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .maybeSingle()
    const tz = profile?.timezone?.trim() || 'UTC'

    const { data: rules } = await supabase
      .from('recurring_availability')
      .select('id, day_of_week, start_time, end_time, label, session_product_id')
      .eq('workspace_id', coach.workspace_id)
      .eq('coach_id', user.id)
      .eq('is_active', true)

    if (!rules?.length) {
      return NextResponse.json({ data: { created: 0, message: 'No active recurring availability rules' } })
    }

    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 0 })
    const slotsToInsert: Array<{
      coach_id: string
      workspace_id: string
      start_time: string
      end_time: string
      label: string | null
      session_product_id: string | null
      is_group_session: boolean
      max_participants: number
    }> = []

    for (let w = 0; w < 6; w++) {
      const weekStartW = addWeeks(weekStart, w)
      for (const rule of rules) {
        const dayDate = addDays(weekStartW, rule.day_of_week)
        const y = getYear(dayDate)
        const m = getMonth(dayDate) + 1
        const d = getDate(dayDate)
        const [startH = 0, startM = 0] = String(rule.start_time).split(':').map(Number)
        const [endH = 0, endM = 0] = String(rule.end_time).split(':').map(Number)
        const dateStr = `${y}-${pad(m)}-${pad(d)}`
        let slotStart: Date
        let slotEnd: Date
        if (tz === 'UTC') {
          slotStart = new Date(Date.UTC(y, m - 1, d, startH, startM, 0))
          slotEnd = new Date(Date.UTC(y, m - 1, d, endH, endM, 0))
        } else {
          slotStart = fromZonedTime(`${dateStr}T${pad(startH)}:${pad(startM)}:00`, tz)
          slotEnd = fromZonedTime(`${dateStr}T${pad(endH)}:${pad(endM)}:00`, tz)
        }
        if (slotStart >= now && slotEnd > slotStart) {
          const startIso = slotStart.toISOString()
          const endIso = slotEnd.toISOString()
          const { data: existingSlots } = await supabase
            .from('availability_slots')
            .select('id')
            .eq('coach_id', user.id)
            .lt('start_time', endIso)
            .gt('end_time', startIso)
          if (existingSlots?.length) continue
          const { data: existingSessions } = await supabase
            .from('sessions')
            .select('id')
            .eq('coach_id', user.id)
            .gte('scheduled_time', startIso)
            .lt('scheduled_time', endIso)
            .in('status', ['pending', 'confirmed'])
          if (existingSessions?.length) continue
          slotsToInsert.push({
            coach_id: user.id,
            workspace_id: coach.workspace_id,
            start_time: startIso,
            end_time: endIso,
            label: rule.label ?? null,
            session_product_id: rule.session_product_id ?? null,
            is_group_session: false,
            max_participants: 1,
          })
        }
      }
    }

    if (slotsToInsert.length === 0) {
      return NextResponse.json({ data: { created: 0, message: 'No new slots to create' } })
    }

    const { error } = await supabase.from('availability_slots').insert(slotsToInsert)
    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not create slots' },
        { status: 500 }
      )
    }
    return NextResponse.json({ data: { created: slotsToInsert.length } })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}
