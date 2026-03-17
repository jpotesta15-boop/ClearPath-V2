'use client'

export interface PageHeaderProps {
  /** Page title */
  title: string
  /** Optional subtitle below the title */
  subtitle?: string
  /** Optional action buttons or controls (e.g. "Add client") */
  children?: React.ReactNode
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-[var(--color-ink)] font-medium leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[15px] text-[var(--color-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {children && <div className="mt-4 flex items-center gap-2 sm:mt-0">{children}</div>}
    </div>
  )
}
