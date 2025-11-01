"use client"

import { Navigation } from "./navigation"
import { ToastContainer } from "../ui/toast"
import { usePendingCount } from "@/contexts/pending-count-context"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { pendingCount } = usePendingCount()

  return (
    <div className="min-h-screen bg-background">
      <Navigation pendingCount={pendingCount} />
      <main className="bg-background">
        {children}
      </main>
    </div>
  )
}