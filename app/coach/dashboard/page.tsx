import { CoachDashboardUpcoming } from './CoachDashboardUpcoming'

export default function CoachDashboardPage() {
  return (
    <main className="min-h-screen p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-medium text-[var(--color-text-primary)]">Coach Dashboard</h1>
        <p className="mt-1 text-[var(--color-text-secondary)]">Welcome to your dashboard.</p>
      </div>
      <CoachDashboardUpcoming />
    </main>
  )
}
