'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 14a4 4 0 0 0 4-4 2 2 0 0 0-4 0" />
      <path d="M8 20h8" />
    </svg>
  )
}

function BillingIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
      <path d="M6 15h.01M10 15h.01M14 15h.01M18 15h.01" />
    </svg>
  )
}

function PackagesIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3v6" />
      <path d="M3 9v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" />
      <path d="M21 9l-9-6-9 6" />
      <path d="M3 9l9 6 9-6" />
    </svg>
  )
}

function InvoicesIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  )
}

function ProgramsIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M8 7h6" />
      <path d="M8 11h8" />
    </svg>
  )
}

function VideosIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M22 8v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
      <path d="m10 8 6 4-6 4V8z" />
    </svg>
  )
}

/** Default coach tabs (used when coach layout provides MobileNav) — includes Programs, Videos, Packages */
export const coachTabs = [
  { href: '/coach/dashboard', label: 'Home', icon: HomeIcon },
  { href: '/coach/clients', label: 'Clients', icon: ClientsIcon },
  { href: '/coach/schedule', label: 'Schedule', icon: CalendarIcon },
  { href: '/coach/programs', label: 'Programs', icon: ProgramsIcon },
  { href: '/coach/videos', label: 'Videos', icon: VideosIcon },
  { href: '/coach/messages', label: 'Messages', icon: MessagesIcon },
  { href: '/coach/packages', label: 'Packages', icon: PackagesIcon },
  { href: '/billing', label: 'Billing', icon: BillingIcon },
] as const

/** Client portal tabs (used in app/client/layout) */
export const clientPortalTabs = [
  { href: '/client/portal', label: 'Home', icon: HomeIcon },
  { href: '/client/programs', label: 'Programs', icon: ProgramsIcon },
  { href: '/client/messages', label: 'Messages', icon: MessagesIcon },
  { href: '/client/invoices', label: 'Invoices', icon: InvoicesIcon },
  { href: '/client/sessions', label: 'Sessions', icon: CalendarIcon },
  { href: '/client/profile', label: 'Profile', icon: ProfileIcon },
] as const

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function ClientsIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}

function MessagesIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export interface MobileNavTab {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export interface MobileNavProps {
  /** Optional class for the container */
  className?: string
  /** Tabs to show; defaults to coach tabs */
  tabs?: readonly MobileNavTab[]
  /** Unread message count — shown as green badge on Messages tab when > 0 */
  messageUnreadCount?: number
}

/** Bottom tab bar — visible only below lg (1024px). */
export function MobileNav({ className, tabs = coachTabs, messageUnreadCount = 0 }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-[var(--color-border)] bg-white py-2 lg:hidden',
        className
      )}
      role="navigation"
      aria-label="Main"
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href || (href !== '/' && pathname.startsWith(href))
        const isMessagesTab = href.includes('messages')
        const showBadge = isMessagesTab && messageUnreadCount > 0
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:outline-none',
              isActive
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className={cn('size-6', isActive && 'text-[var(--color-accent)]')} />
            <span>{label}</span>
            {showBadge && (
              <span
                className="absolute right-0 top-0 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-success)] px-1.5 text-[11px] font-medium text-white"
                aria-label={`${messageUnreadCount} unread messages`}
              >
                {messageUnreadCount > 99 ? '99+' : messageUnreadCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
