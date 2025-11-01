'use client'

import { useEffect } from 'react'

/**
 * Component that initializes automatic sync on app startup
 * This runs client-side to start the background sync scheduler
 */
export function AutoSyncInitializer() {
  useEffect(() => {
    // Initialize automatic sync on client-side
    const initializeSync = async () => {
      try {
        console.log('🚀 Initializing automatic sync...')
        
        // Call the sync trigger endpoint to start the scheduler
        const response = await fetch('/api/sync/trigger', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'start' })
        })

        if (response.ok) {
          const result = await response.json()
          console.log('✅ Automatic sync initialized:', result)
        } else {
          console.warn('⚠️ Failed to initialize automatic sync:', response.statusText)
        }
      } catch (error) {
        console.error('❌ Error initializing automatic sync:', error)
      }
    }

    // Initialize after a short delay to ensure app is fully loaded
    const timer = setTimeout(initializeSync, 2000)
    
    return () => clearTimeout(timer)
  }, [])

  // This component doesn't render anything
  return null
}