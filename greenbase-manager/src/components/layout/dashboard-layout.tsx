"use client"

import { useState, useEffect } from "react"
import { Navigation } from "./navigation"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [pendingCount, setPendingCount] = useState(0)

  // Fetch pending approvals count
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const response = await fetch('/api/drafts')
        if (response.ok) {
          const data = await response.json()
          const pending = data.drafts?.filter((draft: any) => draft.status === 'pending') || []
          setPendingCount(pending.length)
        }
      } catch (error) {
        console.error('Failed to fetch pending count:', error)
      }
    }

    fetchPendingCount()
    
    // Refresh count every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>
      <Navigation pendingCount={pendingCount} />
      <main style={{ backgroundColor: '#ffffff' }}>
        {children}
      </main>
    </div>
  )
}