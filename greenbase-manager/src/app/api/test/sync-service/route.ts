import { NextRequest, NextResponse } from 'next/server'
import { getChangeDetectionService } from '../../../../lib/ingestion/change-detection-service'

/**
 * Test endpoint to verify change detection service works
 */
export async function GET() {
  try {
    console.log('🧪 Testing change detection service...')
    
    const changeDetectionService = getChangeDetectionService()
    
    // Test initialization
    await changeDetectionService.initialize()
    console.log('✅ Change detection service initialized successfully')
    
    // Test getting sources that need sync (should return empty array if no sources need sync)
    const operations = await changeDetectionService.checkAllSourcesForChanges()
    console.log(`✅ Found ${operations.length} sources that needed syncing`)
    
    return NextResponse.json({
      success: true,
      message: 'Change detection service is working',
      sourcesChecked: operations.length,
      operations: operations.map(op => ({
        sourceId: op.sourceId,
        status: op.status,
        itemsCreated: op.itemsCreated
      }))
    })

  } catch (error: any) {
    console.error('❌ Change detection service test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Service test failed',
      details: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

/**
 * Test manual sync for a specific source
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceId } = body
    
    if (!sourceId) {
      return NextResponse.json({ error: 'sourceId required' }, { status: 400 })
    }
    
    console.log(`🧪 Testing manual sync for source: ${sourceId}`)
    
    const changeDetectionService = getChangeDetectionService()
    
    // Create a mock source object for testing
    const mockSource = {
      source_id: sourceId,
      user_id: 'test-user',
      type: 'google_drive',
      name: 'Test Source',
      change_token: null,
      last_change_check: null,
      selected_folders: [],
      selected_team_channels: []
    }
    
    const operation = await changeDetectionService.checkSourceForChanges(mockSource)
    
    return NextResponse.json({
      success: true,
      message: 'Manual sync test completed',
      operation: {
        id: operation.id,
        status: operation.status,
        itemsProcessed: operation.itemsProcessed,
        itemsCreated: operation.itemsCreated
      }
    })

  } catch (error: any) {
    console.error('❌ Manual sync test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Manual sync test failed',
      details: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}