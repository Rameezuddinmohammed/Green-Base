import { NextRequest, NextResponse } from 'next/server'
import { getChangeDetectionService } from '../../../../lib/ingestion/change-detection-service'

/**
 * Microsoft Teams webhook for real-time message notifications
 * This endpoint receives notifications when new messages are posted in Teams channels
 * https://docs.microsoft.com/en-us/graph/webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Handle subscription validation
    if (body.validationToken) {
      console.log('✅ Microsoft Teams webhook validation')
      return new NextResponse(body.validationToken, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    console.log('📨 Microsoft Teams webhook received:', {
      subscriptionId: body.subscriptionId,
      changeType: body.changeType,
      resource: body.resource
    })

    // Only process 'created' and 'updated' events
    if (!body.changeType || !['created', 'updated'].includes(body.changeType)) {
      console.log('ℹ️ Ignoring webhook - not a create/update event')
      return NextResponse.json({ success: true, message: 'Event ignored' })
    }

    // Find active Microsoft Teams sources
    const changeDetectionService = getChangeDetectionService()
    await changeDetectionService.initialize()
    
    const { data: sources } = await (changeDetectionService as any).supabase
      .from('connected_sources')
      .select('id, name, organization_id')
      .eq('type', 'microsoft_teams')
      .eq('is_active', true)
      .eq('auto_sync_enabled', true)

    if (!sources || sources.length === 0) {
      console.log('⚠️ No active Microsoft Teams sources found for webhook')
      return NextResponse.json({ success: true, message: 'No sources to sync' })
    }

    console.log(`🔄 Triggering immediate sync for ${sources.length} Microsoft Teams sources`)

    // Trigger immediate sync for all Teams sources
    const operations = []
    for (const source of sources) {
      try {
        const operation = await changeDetectionService.checkSourceForChanges(source.id)
        operations.push(operation)
        console.log(`✅ Webhook sync completed for ${source.name}: ${operation.itemsCreated} new items`)
      } catch (error) {
        console.error(`❌ Webhook sync failed for ${source.name}:`, error)
        operations.push({
          sourceId: source.id,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successful = operations.filter(op => op.status === 'completed').length
    const totalCreated = operations.reduce((sum, op) => sum + (op.itemsCreated || 0), 0)

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      sourcesProcessed: sources.length,
      successful,
      totalItemsCreated: totalCreated
    })

  } catch (error: any) {
    console.error('❌ Microsoft Teams webhook processing failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Webhook processing failed',
      details: error.message
    }, { status: 500 })
  }
}

/**
 * GET endpoint for webhook health check
 */
export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: 'Microsoft Teams webhook endpoint is active' 
  })
}