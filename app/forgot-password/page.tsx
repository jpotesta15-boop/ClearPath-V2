import Link from 'next/link'

/**
 * Forgot-password page — public; rate-limited in middleware (30/min per IP).
 * Placeholder: form can call supabase.auth.resetPasswordForEmail and redirect to set-password.
 */
export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">
          Forgot password?
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          <Link href="/login" className="text-[var(--color-accent)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
