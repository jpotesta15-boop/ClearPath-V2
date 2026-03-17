'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { format, isToday, isYesterday } from 'date-fns'
import { InvoiceCardClient } from '@/components/client/InvoiceCardClient'

type Message = {
  id: string
  sender_id: string
  recipient_id: string
  client_id: string
  content: string
  read_at: string | null
  created_at: string
  message_type?: string | null
}

export function ClientMessagesContent({
  clientId,
  coachName,
}: {
  clientId: string
  coachName: string
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const supabase = createClient()

  const fetchMessages = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/messages?clientId=${encodeURIComponent(clientId)}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load messages')
        setMessages([])
        return
      }
      setMessages(json.data ?? [])
    } catch {
      setError('Something went wrong — check your connection and try again')
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    fetch(`/api/messages/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    }).catch(() => {})
  }, [clientId])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) setUserId(user.id)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!clientId || !userId) return

    const channel = supabase
      .channel(`client-messages:${clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const msg = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const updated = payload.new as Message
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [clientId, userId])

  const handleSend = async () => {
    const content = inputValue.trim()
    if (!content || sending) return
    setSending(true)
    setInputValue('')
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, content }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not send message')
        setInputValue(content)
        return
      }
      setMessages((prev) => {
        const next = [...prev, json.data]
        return next.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      })
      window.dispatchEvent(new CustomEvent('clearpath:unread-messages-updated'))
    } catch {
      setError('Could not send message — try again')
      setInputValue(content)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <Link
          href="/client/portal"
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface)] focus:ring-2 focus:ring-[var(--color-accent)]"
          aria-label="Back to portal"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-lg font-medium text-[var(--color-ink)]">
          Messages with {coachName}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && <ThreadSkeleton />}
        {!loading && error && (
          <p className="text-[var(--color-muted)]">{error}</p>
        )}
        {!loading && !error && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="font-medium text-[var(--color-ink)]">No messages yet.</p>
            <p className="mt-1 text-[15px] text-[var(--color-muted)]">
              Send your coach a message to get started.
            </p>
          </div>
        )}
        {!loading && !error && messages.length > 0 && (
          <div className="space-y-4">
            {groupMessagesByDate(messages).map(({ dateLabel, msgs }) => (
              <div key={dateLabel}>
                <p className="mb-2 text-center text-[12px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                  {dateLabel}
                </p>
                <div className="space-y-2">
                  {msgs.map((msg) => {
                    const isInvoice = msg.message_type === 'invoice'
                    let invoiceData: Parameters<typeof InvoiceCardClient>[0]['data'] | null = null
                    if (isInvoice) {
                      try {
                        const parsed = JSON.parse(msg.content) as { type?: string; invoiceId?: string; packageTitle?: string; packageDescription?: string | null; amountCents?: number; currency?: string; status?: string; dueDate?: string | null; paidAt?: string | null }
                        if (parsed?.type === 'invoice' && parsed.invoiceId) {
                          invoiceData = {
                            type: 'invoice',
                            invoiceId: parsed.invoiceId,
                            packageTitle: parsed.packageTitle ?? 'Invoice',
                            packageDescription: parsed.packageDescription ?? null,
                            amountCents: parsed.amountCents ?? 0,
                            currency: parsed.currency ?? 'usd',
                            status: parsed.status ?? 'pending',
                            dueDate: parsed.dueDate ?? null,
                            paidAt: parsed.paidAt ?? null,
                          }
                        }
                      } catch {
                        invoiceData = null
                      }
                    }
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === userId ? 'justify-end' : 'justify-start'}`}
                      >
                        {invoiceData ? (
                          <div className="max-w-[320px]">
                            <InvoiceCardClient data={invoiceData} />
                            <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                              {format(new Date(msg.created_at), 'h:mm a')}
                            </p>
                          </div>
                        ) : (
                          <div
                            className={`max-w-[85%] rounded-xl px-4 py-2 ${
                              msg.sender_id === userId
                                ? 'bg-[var(--color-accent)] text-white'
                                : 'bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border)]'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words text-[15px]">{msg.content}</p>
                            <p
                              className={`mt-1 text-[12px] ${
                                msg.sender_id === userId ? 'text-white/80' : 'text-[var(--color-muted)]'
                              }`}
                            >
                              {format(new Date(msg.created_at), 'h:mm a')}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      <div className="border-t border-[var(--color-border)] p-4">
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Type a message..."
            rows={1}
            maxLength={2000}
            className="min-h-[44px] flex-1 resize-y rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0"
            aria-label="Message"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || sending}
            className="shrink-0"
          >
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
        {inputValue.length > 1900 && (
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">
            {inputValue.length} / 2000
          </p>
        )}
      </div>
    </div>
  )
}

function groupMessagesByDate(messages: Message[]): { dateLabel: string; msgs: Message[] }[] {
  const groups = new Map<string, Message[]>()
  for (const m of messages) {
    const d = new Date(m.created_at)
    const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d, yyyy')
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(m)
  }
  return [...groups.entries()].map(([dateLabel, msgs]) => ({ dateLabel, msgs }))
}

function ThreadSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={i % 2 === 0 ? 'flex justify-end' : 'flex justify-start'}>
          <div className="h-16 w-3/4 max-w-[280px] rounded-xl bg-[var(--color-border)] animate-pulse" />
        </div>
      ))}
    </div>
  )
}
