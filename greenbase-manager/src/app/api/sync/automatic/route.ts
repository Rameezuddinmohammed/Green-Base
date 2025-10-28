import { NextRequest, NextResponse } from 'next/server'
import { getChangeDetectionService } from '../../../../lib/ingestion/change-detection-service'

/**
 * Automatic sync endpoint - should be called by a background job/cron
 * This endpoint checks all sources for changes and processes them
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is an internal request (add authentication as needed)
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.INTERNAL_API_TOKEN || 'dev-token'
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🤖 Starting automatic sync for all sources...')
    
    const changeDetectionService = getChangeDetectionService()
    const operations = await changeDetectionService.checkAllSourcesForChanges()

    // Calculate summary statistics
    const summary = {
      totalSources: operations.length,
      successful: operations.filter(op => op.status === 'completed').length,
      failed: operations.filter(op => op.status === 'failed').length,
      totalItemsProcessed: operations.reduce((sum, op) => sum + op.itemsProcessed, 0),
      totalItemsCreated: operations.reduce((sum, op) => sum + op.itemsCreated, 0),
      errors: operations.filter(op => op.errorMessage).map(op => ({
        sourceId: op.sourceId,
        error: op.errorMessage
      }))
    }

    console.log(`✅ Automatic sync completed:`, summary)

    return NextResponse.json({
      success: true,
      summary,
      operations: operations.map(op => ({
        id: op.id,
        sourceId: op.sourceId,
        status: op.status,
        itemsProcessed: op.itemsProcessed,
        itemsCreated: op.itemsCreated,
        errorMessage: op.errorMessage
      }))
    })

  } catch (error: any) {
    console.error('❌ Automatic sync failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Automatic sync failed',
      details: error.message
    }, { status: 500 })
  }
}

/**
 * GET endpoint to check sync status and history
 */
export async function GET() {
  try {
    const changeDetectionService = getChangeDetectionService()
    
    // Get recent sync operations across all sources
    const { data: recentSyncs, error } = await (await changeDetectionService.initialize(), 
      (changeDetectionService as any).supabase
        .from('source_sync_history')
        .select(`
          id,
          source_id,
          sync_type,
          status,
          started_at,
          completed_at,
          items_processed,
          items_created,
          items_updated,
          error_message,
          connected_sources!inner(name, type)
        `)
        .order('started_at', { ascending: false })
        .limit(50)
    )

    if (error) {
      throw new Error(`Failed to get sync history: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      recentSyncs: recentSyncs || []
    })

  } catch (error: any) {
    console.error('Failed to get sync status:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get sync status',
      details: error.message
    }, { status: 500 })
  }
}