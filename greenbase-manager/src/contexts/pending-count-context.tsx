"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface PendingCountContextType {
  pendingCount: number
  refreshPendingCount: () => Promise<void>
  isRefreshing: boolean
}

const PendingCountContext = createContext<PendingCountContextType | undefined>(undefined)

export function PendingCountProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchPendingCount = async () => {
    try {
      setIsRefreshing(true)
      // Use the faster pending-count endpoint instead of fetching all drafts
      const response = await fetch('/api/drafts/pending-count')
      if (response.ok) {
        const data = await response.json()
        const count = data.pendingCount || 0
        setPendingCount(count)
        // console.log(`📊 Pending count updated: ${count}`)
      } else {
        // Fallback to the full drafts endpoint if the count endpoint fails
        console.warn('Pending count endpoint failed, falling back to full drafts fetch')
        const fallbackResponse = await fetch('/api/drafts')
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json()
          const pending = fallbackData.drafts?.filter((draft: any) => draft.status === 'pending') || []
          setPendingCount(pending.length)
          // console.log(`📊 Pending count updated (fallback): ${pending.length}`)
        }
      }
    } catch (error) {
      console.error('Failed to fetch pending count:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const refreshPendingCount = async () => {
    // console.log('🔄 Manual refresh of pending count triggered')
    await fetchPendingCount()
  }

  useEffect(() => {
    // Initial fetch
    fetchPendingCount()
    
    // Auto-refresh every 30 seconds (much less aggressive)
    const interval = setInterval(fetchPendingCount, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <PendingCountContext.Provider value={{ 
      pendingCount, 
      refreshPendingCount, 
      isRefreshing 
    }}>
      {children}
    </PendingCountContext.Provider>
  )
}

export function usePendingCount() {
  const context = useContext(PendingCountContext)
  if (context === undefined) {
    throw new Error('usePendingCount must be used within a PendingCountProvider')
  }
  return context
}