'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface SidebarNavItem {
  href: string
  label: string
  icon?: React.ReactNode
}

export interface SidebarProps {
  /** Nav items (links with label and optional icon) */
  items: SidebarNavItem[]
  /** Optional header (e.g. logo) rendered above nav */
  header?: React.ReactNode
  /** Optional footer content below nav */
  footer?: React.ReactNode
  /** Optional class for the sidebar container */
  className?: string
}

const sidebarContainer =
  'flex h-full w-[240px] min-w-[240px] flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] py-4'

const navItemBase =
  'flex items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] font-medium transition-colors'

const navItemDefault =
  'text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/50 hover:text-[var(--color-text-primary)]'

const navItemActive =
  'bg-[var(--color-accent-light)] text-[var(--color-accent)]'

export function Sidebar({ items, header, footer, className }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className={cn(sidebarContainer, className)}>
      {header && <div className="px-4 pb-4">{header}</div>}
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                navItemBase,
                isActive ? navItemActive : navItemDefault
              )}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              {item.label}
            </Link>
          )
        })}
      </nav>
      {footer && <div className="mt-auto px-4 pt-4">{footer}</div>}
    </aside>
  )
}

export interface SidebarLayoutProps {
  sidebar: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** Wraps sidebar + main content for coach (or other) dashboard layout. */
export function SidebarLayout({ sidebar, children, className }: SidebarLayoutProps) {
  return (
    <div className={cn('flex h-full min-h-screen w-full', className)}>
      {sidebar}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
