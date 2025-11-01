import { NextRequest, NextResponse } from 'next/server'
import { getChangeDetectionService } from '../../../../lib/ingestion/change-detection-service'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting manual sync for debugging...')
    
    const changeDetectionService = getChangeDetectionService()
    const operations = await changeDetectionService.checkAllSourcesForChanges()

    // Calculate summary statistics
    const summary = {
      totalSources: operations.length,
      successful: operations.filter(op => op.status === 'completed').length,
      failed: operations.filter(op => op.status === 'failed').length,
      totalItemsProcessed: operations.reduce((sum, op) => sum + op.itemsProcessed, 0),
      totalItemsCreated: operations.reduce((sum, op) => sum + op.itemsCreated, 0),
      totalItemsUpdated: operations.reduce((sum, op) => sum + op.itemsUpdated, 0),
      errors: operations.filter(op => op.errorMessage).map(op => ({
        sourceId: op.sourceId,
        error: op.errorMessage
      }))
    }

    console.log(`✅ Manual sync completed:`, summary)

    return NextResponse.json({
      success: true,
      summary,
      operations: operations.map(op => ({
        id: op.id,
        sourceId: op.sourceId,
        status: op.status,
        itemsProcessed: op.itemsProcessed,
        itemsCreated: op.itemsCreated,
        itemsUpdated: op.itemsUpdated,
        errorMessage: op.errorMessage
      }))
    })

  } catch (error: any) {
    console.error('❌ Manual sync error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to run manual sync', 
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    )
  }
}