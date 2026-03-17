import Link from 'next/link'
import { Suspense } from 'react'
import { LoginForm } from './LoginForm'

/**
 * Login page — LG1 §7: two halves (branded left, form right), responsive.
 * Public; rate-limited in middleware (30/min per IP). Optional signup link.
 */
export default function LoginPage() {
  const appName = process.env.NEXT_PUBLIC_CLIENT_NAME ?? 'ClearPath'
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left half — branded panel */}
      <div className="flex flex-col justify-between bg-[var(--color-accent)] p-8 text-white md:p-10 lg:p-12">
        <div>
          <Link href="/" className="text-xl font-medium tracking-tight">
            {appName}
          </Link>
          <p className="mt-6 text-lg opacity-95">
            Coach OS & client portal
          </p>
          <blockquote className="mt-8 border-l-4 border-white/40 pl-4 text-sm opacity-90">
            Calm, clear, capable — everything you need to run your practice and support your clients.
          </blockquote>
        </div>
        <p className="text-sm opacity-80">
          © {new Date().getFullYear()} {appName}
        </p>
      </div>

      {/* Right half — form */}
      <div className="flex flex-col justify-center bg-[var(--color-bg)] p-8 md:p-10 lg:p-12">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Enter your email and password to continue.
          </p>
          <div className="mt-8">
            <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-[var(--color-surface)]" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
