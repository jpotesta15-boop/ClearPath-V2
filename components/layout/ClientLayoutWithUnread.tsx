'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Nav } from '@/components/layout/Nav'
import { MobileNav, clientPortalTabs } from '@/components/layout/MobileNav'

const UNREAD_POLL_MS = 30_000

export function ClientLayoutWithUnread({
  children,
  userDisplayName,
}: {
  children: React.ReactNode
  userDisplayName: string | null
}) {
  const [unreadCount, setUnreadCount] = useState(0)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const supabase = createClient()

  const fetchUnread = async () => {
    try {
      const res = await fetch('/api/messages/unread-count')
      const json = await res.json()
      if (res.ok && typeof json.data?.count === 'number') {
        setUnreadCount(json.data.count)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, UNREAD_POLL_MS)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return
      const channel = supabase
        .channel('unread-messages')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          () => {
            if (!cancelled) fetchUnread()
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages' },
          () => {
            if (!cancelled) fetchUnread()
          }
        )
        .subscribe()
      channelRef.current = channel
    })
    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const handler = () => fetchUnread()
    window.addEventListener('clearpath:unread-messages-updated', handler)
    return () => window.removeEventListener('clearpath:unread-messages-updated', handler)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-surface)]">
      <Nav userDisplayName={userDisplayName} />
      <div className="flex-1 pb-16 lg:pb-0">
        {children}
      </div>
      <MobileNav tabs={clientPortalTabs} messageUnreadCount={unreadCount} />
    </div>
  )
}
