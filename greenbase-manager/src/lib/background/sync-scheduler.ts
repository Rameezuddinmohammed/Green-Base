import { getChangeDetectionService } from '../ingestion/change-detection-service'

/**
 * Background sync scheduler
 * In production, this would be replaced with a proper cron job or background worker
 * For development, this provides a simple way to test automatic syncing
 */
export class SyncScheduler {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private changeDetectionService = getChangeDetectionService()
  private checkIntervalMinutes = 5 // How often to check (not sync frequency)

  /**
   * Start the automatic sync scheduler
   * @param checkIntervalMinutes How often to check for sources needing sync (default: 5 minutes)
   */
  start(checkIntervalMinutes: number = 5): void {
    if (this.isRunning) {
      console.log('⚠️ Sync scheduler is already running')
      return
    }

    this.checkIntervalMinutes = checkIntervalMinutes
    console.log(`🚀 Starting automatic sync scheduler (checking every ${checkIntervalMinutes} minutes)`)
    
    this.isRunning = true
    
    // Run immediately on start
    this.runSyncCheck()
    
    // Then run on interval
    this.intervalId = setInterval(() => {
      this.runSyncCheck()
    }, checkIntervalMinutes * 60 * 1000)
  }

  /**
   * Stop the automatic sync scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ Sync scheduler is not running')
      return
    }

    console.log('🛑 Stopping automatic sync scheduler')
    
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    
    this.isRunning = false
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning
  }

  /**
   * Run a single sync check cycle
   */
  private async runSyncCheck(): Promise<void> {
    try {
      console.log('🔄 Running scheduled sync check...')
      
      const operations = await this.changeDetectionService.checkAllSourcesForChanges()
      
      if (operations.length === 0) {
        console.log('✅ No sources needed syncing')
        return
      }

      const successful = operations.filter(op => op.status === 'completed').length
      const failed = operations.filter(op => op.status === 'failed').length
      const totalCreated = operations.reduce((sum, op) => sum + op.itemsCreated, 0)

      console.log(`✅ Sync check completed: ${successful} successful, ${failed} failed, ${totalCreated} new documents created`)

      if (failed > 0) {
        const failedSources = operations
          .filter(op => op.status === 'failed')
          .map(op => `${op.sourceId}: ${op.errorMessage}`)
        
        console.warn('⚠️ Some sources failed to sync:', failedSources)
      }

    } catch (error) {
      console.error('❌ Scheduled sync check failed:', error)
    }
  }

  /**
   * Manually trigger a sync check (for testing)
   */
  async triggerManualCheck(): Promise<void> {
    console.log('🔧 Manually triggering sync check...')
    await this.runSyncCheck()
  }

  /**
   * Notify scheduler that a manual sync occurred for a source
   * This resets the timer for that source's next automatic sync
   */
  notifyManualSync(sourceId: string): void {
    console.log(`🔄 Manual sync completed for source ${sourceId}, timer reset for next automatic sync`)
    // The next automatic sync check will see the updated last_sync_at time
    // and respect the source's sync_frequency_minutes setting
  }

  /**
   * Get the next scheduled check time
   */
  getNextCheckTime(): Date | null {
    if (!this.isRunning) return null
    return new Date(Date.now() + this.checkIntervalMinutes * 60 * 1000)
  }
}

// Singleton instance
let syncScheduler: SyncScheduler | null = null

export function getSyncScheduler(): SyncScheduler {
  if (!syncScheduler) {
    syncScheduler = new SyncScheduler()
  }
  return syncScheduler
}

/**
 * Initialize automatic syncing (call this in your app startup)
 * In production, you would replace this with a proper background job system
 */
export function initializeAutomaticSync(): void {
  // Only run in development or if explicitly enabled
  if (process.env.NODE_ENV === 'development' || process.env.ENABLE_AUTO_SYNC === 'true') {
    const scheduler = getSyncScheduler()
    
    // Start with 15-minute intervals (matches our database default)
    scheduler.start(15)
    
    console.log('🤖 Automatic sync initialized')
  } else {
    console.log('ℹ️ Automatic sync disabled (set ENABLE_AUTO_SYNC=true to enable)')
  }
}

/**
 * Cleanup function (call this on app shutdown)
 */
export function shutdownAutomaticSync(): void {
  if (syncScheduler) {
    syncScheduler.stop()
    console.log('🛑 Automatic sync shutdown complete')
  }
}