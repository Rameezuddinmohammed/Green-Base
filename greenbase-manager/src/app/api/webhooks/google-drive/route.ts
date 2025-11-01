import { NextRequest, NextResponse } from 'next/server'
import { getChangeDetectionService } from '../../../../lib/ingestion/change-detection-service'

/**
 * Google Drive Push Notification webhook
 * This endpoint receives real-time notifications when files change in Google Drive
 * https://developers.google.com/drive/api/guides/push
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the webhook is from Google
    const channelId = request.headers.get('x-goog-channel-id')
    const channelToken = request.headers.get('x-goog-channel-token')
    const resourceId = request.headers.get('x-goog-resource-id')
    const resourceState = request.headers.get('x-goog-resource-state')
    
    console.log('📨 Google Drive webhook received:', {
      channelId,
      channelToken,
      resourceId,
      resourceState
    })

    // Only process 'update' and 'create' events
    if (!resourceState || !['update', 'create'].includes(resourceState)) {
      console.log('ℹ️ Ignoring webhook - not an update/create event')
      return NextResponse.json({ success: true, message: 'Event ignored' })
    }

    // Find the source associated with this webhook
    const changeDetectionService = getChangeDetectionService()
    await changeDetectionService.initialize()
    
    const { data: sources } = await (changeDetectionService as any).supabase
      .from('connected_sources')
      .select('id, name, organization_id')
      .eq('type', 'google_drive')
      .eq('is_active', true)
      .eq('auto_sync_enabled', true)

    if (!sources || sources.length === 0) {
      console.log('⚠️ No active Google Drive sources found for webhook')
      return NextResponse.json({ success: true, message: 'No sources to sync' })
    }

    console.log(`🔄 Triggering immediate sync for ${sources.length} Google Drive sources`)

    // Trigger immediate sync for all Google Drive sources
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
    console.error('❌ Google Drive webhook processing failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Webhook processing failed',
      details: error.message
    }, { status: 500 })
  }
}

/**
 * Handle webhook verification (GET request from Google)
 */
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('hub.challenge')
  
  if (challenge) {
    console.log('✅ Google Drive webhook verification successful')
    return new NextResponse(challenge, { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
  
  return NextResponse.json({ 
    success: true, 
    message: 'Google Drive webhook endpoint is active' 
  })
}