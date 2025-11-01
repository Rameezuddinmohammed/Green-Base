import { PendingCountProvider } from "@/contexts/pending-count-context"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PendingCountProvider>
      <div className="min-h-screen bg-background">
        {children}
      </div>
    </PendingCountProvider>
  )
}
