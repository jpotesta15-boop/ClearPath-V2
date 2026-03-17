'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { format, isToday, isYesterday } from 'date-fns'
import { InvoiceCard } from '@/components/coach/InvoiceCard'

type Conversation = {
  clientId: string
  fullName: string
  status: string
  lastMessagePreview: string
  lastMessageAt: string
  unreadCount: number
}

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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2)
  return name.slice(0, 2).toUpperCase() || '?'
}

function statusBadgeVariant(status: string): 'active' | 'inactive' | 'pending' {
  if (status === 'active') return 'active'
  if (status === 'paused') return 'pending'
  return 'inactive'
}

export function CoachMessagesPageContent() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [conversationsError, setConversationsError] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [selectedClientName, setSelectedClientName] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const supabase = createClient()

  const fetchConversations = useCallback(async () => {
    setConversationsError(null)
    setLoadingConversations(true)
    try {
      const res = await fetch('/api/messages/conversations')
      const json = await res.json()
      if (!res.ok) {
        setConversationsError(json.error ?? 'Could not load conversations')
        setConversations([])
        return
      }
      setConversations(json.data ?? [])
    } catch {
      setConversationsError('Something went wrong — check your connection and try again')
      setConversations([])
    } finally {
      setLoadingConversations(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) setUserId(user.id)
    })
    return () => { cancelled = true }
  }, [supabase.auth])

  const fetchMessages = useCallback(
    async (clientId: string) => {
      setMessagesError(null)
      setLoadingMessages(true)
      try {
        const res = await fetch(`/api/messages?clientId=${encodeURIComponent(clientId)}`)
        const json = await res.json()
        if (!res.ok) {
          setMessagesError(json.error ?? 'Could not load messages')
          setMessages([])
          return
        }
        setMessages(json.data ?? [])
        const conv = conversations.find((c) => c.clientId === clientId)
        if (conv) setSelectedClientName(conv.fullName)
      } catch {
        setMessagesError('Something went wrong — check your connection and try again')
        setMessages([])
      } finally {
        setLoadingMessages(false)
      }
    },
    [conversations]
  )

  useEffect(() => {
    if (!selectedClientId) {
      setMessages([])
      setMessagesError(null)
      return
    }
    fetchMessages(selectedClientId)
  }, [selectedClientId, fetchMessages])

  useEffect(() => {
    if (!selectedClientId) return
    fetch(`/api/messages/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: selectedClientId }),
    }).catch(() => {})
  }, [selectedClientId])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!selectedClientId || !userId) return

    const channel = supabase
      .channel(`messages:${selectedClientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `client_id=eq.${selectedClientId}`,
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
          filter: `client_id=eq.${selectedClientId}`,
        },
        (payload) => {
          const updated = payload.new as Message
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          )
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || (err != null)) {
          console.error('[Realtime] messages subscription:', status, err)
        }
      })

    channelRef.current = channel
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [selectedClientId, userId])

  const handleSend = async () => {
    const content = inputValue.trim()
    if (!content || !selectedClientId || sending) return
    setSending(true)
    setInputValue('')
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId, content }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMessagesError(json.error ?? 'Could not send message')
        setInputValue(content)
        return
      }
      setMessages((prev) => {
        const next = [...prev, json.data]
        return next.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      })
      fetchConversations()
    } catch {
      setMessagesError('Could not send message — try again')
      setInputValue(content)
    } finally {
      setSending(false)
    }
  }

  const showListOnly = !selectedClientId
  const showThreadOnly = selectedClientId

  return (
    <div className="flex h-[calc(100vh-2rem)] min-h-0 flex-col lg:flex-row">
      {/* Left: conversation list — 1/3 on desktop, full on mobile when no thread */}
      <div
        className={`flex h-full flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] ${
          showListOnly ? 'w-full' : 'hidden lg:flex lg:w-1/3'
        }`}
      >
        <div className="border-b border-[var(--color-border)] px-4 py-4">
          <h1 className="text-lg font-medium text-[var(--color-ink)]">Messages</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConversations && <ConversationListSkeleton />}
          {!loadingConversations && conversationsError && (
            <div className="p-4">
              <p className="text-[var(--color-muted)]">{conversationsError}</p>
              <Button variant="secondary" className="mt-2" onClick={fetchConversations}>
                Try again
              </Button>
            </div>
          )}
          {!loadingConversations && !conversationsError && conversations.length === 0 && (
            <div className="p-6 text-center">
              <p className="font-medium text-[var(--color-ink)]">No conversations yet.</p>
              <p className="mt-1 text-[15px] text-[var(--color-muted)]">
                Add a client and send them a message to get started.
              </p>
            </div>
          )}
          {!loadingConversations && !conversationsError && conversations.length > 0 && (
            <ul className="divide-y divide-[var(--color-border)]">
              {conversations.map((c) => (
                <li key={c.clientId}>
                  <button
                    type="button"
                    onClick={() => setSelectedClientId(c.clientId)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-border)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-inset ${
                      selectedClientId === c.clientId ? 'bg-[var(--color-accent-light)]' : ''
                    }`}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-bg)] text-sm font-medium text-[var(--color-accent)]"
                      aria-hidden
                    >
                      {getInitials(c.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[var(--color-ink)]">{c.fullName}</p>
                      <p className="truncate text-[13px] text-[var(--color-muted)]">
                        {c.lastMessagePreview || 'No messages yet'}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">
                        {c.lastMessageAt
                          ? format(new Date(c.lastMessageAt), 'MMM d, h:mm a')
                          : '—'}
                      </p>
                    </div>
                    {c.unreadCount > 0 && (
                      <span
                        className="shrink-0 rounded-full bg-[var(--color-success)] px-2 py-0.5 text-xs font-medium text-white"
                        aria-label={`${c.unreadCount} unread`}
                      >
                        {c.unreadCount > 99 ? '99+' : c.unreadCount}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right: thread — 2/3 on desktop, full on mobile when selected */}
      <div
        className={`flex h-full flex-col bg-white ${
          showThreadOnly ? 'flex w-full lg:w-2/3' : 'hidden lg:flex lg:w-2/3'
        }`}
      >
        {!selectedClientId && (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <p className="text-[var(--color-muted)]">Select a conversation</p>
          </div>
        )}
        {selectedClientId && (
          <>
            <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
              {typeof window !== 'undefined' && window.innerWidth < 1024 && (
                <button
                  type="button"
                  onClick={() => setSelectedClientId(null)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface)] focus:ring-2 focus:ring-[var(--color-accent)]"
                  aria-label="Back to conversations"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/coach/clients/${selectedClientId}`}
                  className="font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 rounded"
                >
                  {selectedClientName || 'Client'}
                </Link>
                {conversations.find((c) => c.clientId === selectedClientId) && (
                  <Badge
                    variant={statusBadgeVariant(
                      conversations.find((c) => c.clientId === selectedClientId)!.status
                    )}
                    className="ml-2"
                  >
                    {conversations.find((c) => c.clientId === selectedClientId)!.status}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingMessages && <ThreadSkeleton />}
              {!loadingMessages && messagesError && (
                <p className="text-[var(--color-muted)]">{messagesError}</p>
              )}
              {!loadingMessages && !messagesError && messages.length === 0 && (
                <p className="text-center text-[var(--color-muted)]">No messages yet. Send a message to get started.</p>
              )}
              {!loadingMessages && !messagesError && messages.length > 0 && (
                <div className="space-y-4">
                  {groupMessagesByDate(messages).map(({ dateLabel, msgs }) => (
                    <div key={dateLabel}>
                      <p className="mb-2 text-center text-[12px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                        {dateLabel}
                      </p>
                      <div className="space-y-2">
                        {msgs.map((msg) => {
                          const isInvoice = msg.message_type === 'invoice'
                          let invoiceData: Parameters<typeof InvoiceCard>[0]['data'] | null = null
                          if (isInvoice) {
                            try {
                              const parsed = JSON.parse(msg.content) as { type?: string; invoiceId?: string; packageTitle?: string; packageDescription?: string | null; amountCents?: number; currency?: string; status?: string; dueDate?: string | null; paymentMethod?: string | null; paidAt?: string | null }
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
                                  paymentMethod: parsed.paymentMethod ?? null,
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
                                  <InvoiceCard
                                    data={invoiceData}
                                    clientName={selectedClientName || 'Client'}
                                    onPaymentRecorded={() => fetchMessages(selectedClientId!)}
                                  />
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
          </>
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

function ConversationListSkeleton() {
  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {[1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-[var(--color-border)] animate-pulse" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-[var(--color-border)] animate-pulse" />
            <div className="h-3 w-full rounded bg-[var(--color-border)] animate-pulse" />
            <div className="h-3 w-1/4 rounded bg-[var(--color-border)] animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  )
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
