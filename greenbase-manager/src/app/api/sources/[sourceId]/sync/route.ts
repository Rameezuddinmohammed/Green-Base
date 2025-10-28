import { NextRequest, NextResponse } from 'next/server'
import { getChangeDetectionService } from '../../../../../lib/ingestion/change-detection-service'
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params
  return NextResponse.json({
    message: 'Sync endpoint is working',
    sourceId,
    timestamp: new Date().toISOString(),
    method: 'GET'
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  console.log('🚀 Sync API POST endpoint called')
  
  try {
    console.log('📋 Step 1: Getting cookies...')
    const cookieStore = await cookies()
    
    console.log('📋 Step 2: Creating Supabase client...')
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )
    
    console.log('📋 Step 3: Getting session...')
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.email) {
      console.log('❌ No session found, returning unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('📋 Step 4: Parsing request parameters...')
    const { sourceId } = await params
    const body = await request.json()
    const syncType = body.syncType || 'manual'

    console.log(`🔄 Manual sync requested for source: ${sourceId}, type: ${syncType}`)

    console.log('📋 Step 5: Getting admin Supabase client...')
    const adminSupabase = await getSupabaseAdmin()
    console.log('✅ Admin Supabase client obtained')

    console.log('📋 Step 6: Looking up source in database...')
    console.log(`🔍 Searching for source ID: ${sourceId} for user: ${session.user.id}`)

    // Get source details from database with all required fields
    const { data: source, error: sourceError } = await adminSupabase
      .from('connected_sources')
      .select(`
        id,
        user_id,
        type,
        name,
        change_token,
        last_change_check,
        selected_folders,
        selected_team_channels,
        is_active,
        sync_frequency_minutes,
        auto_sync_enabled
      `)
      .eq('id', sourceId)
      .eq('user_id', session.user.id)
      .single()

    console.log('📊 Source lookup result:', { source: !!source, error: sourceError })

    if (sourceError || !source) {
      console.error('❌ Source lookup failed:', {
        sourceId,
        userId: session.user.id,
        error: sourceError,
        hasSource: !!source
      })
      
      // Let's also check if the source exists at all (without user filter)
      const { data: anySource } = await adminSupabase
        .from('connected_sources')
        .select('id, user_id, name')
        .eq('id', sourceId)
        .single()
        
      if (anySource) {
        console.log('📋 Source exists but belongs to different user:', anySource)
        return NextResponse.json({ 
          success: false,
          error: 'Source not found', 
          message: 'Source not found or access denied',
          details: 'The source either does not exist or you do not have permission to access it'
        }, { status: 404 })
      } else {
        console.log('📋 Source does not exist in database')
        return NextResponse.json({ 
          success: false,
          error: 'Source not found', 
          message: 'Source does not exist',
          details: `No source found with ID: ${sourceId}`
        }, { status: 404 })
      }
    }

    if (!source.is_active) {
      return NextResponse.json({ 
        error: 'Source is not active',
        message: `Source "${source.name}" is currently disabled`
      }, { status: 400 })
    }

    console.log(`📋 Processing manual sync for: ${source.name} (${source.type})`)
    console.log(`📊 Source config:`, {
      hasSelectedFolders: !!source.selected_folders?.length,
      hasSelectedChannels: !!source.selected_team_channels?.length,
      hasChangeToken: !!source.change_token,
      autoSyncEnabled: source.auto_sync_enabled
    })

    // Initialize and use change detection service
    const changeDetectionService = getChangeDetectionService()
    
    try {
      console.log('🚀 Starting change detection process...')
      
      const operation = await changeDetectionService.checkSourceForChanges({
        source_id: source.id,
        user_id: source.user_id,
        type: source.type,
        name: source.name,
        change_token: source.change_token,
        last_change_check: source.last_change_check,
        selected_folders: source.selected_folders,
        selected_team_channels: source.selected_team_channels
      })

      console.log(`✅ Change detection completed successfully for ${source.name}`)
      console.log(`📈 Results: ${operation.itemsProcessed} processed, ${operation.itemsCreated} created`)

      return NextResponse.json({
        success: true,
        syncType,
        source: {
          id: source.id,
          name: source.name,
          type: source.type
        },
        operation: {
          id: operation.id,
          status: operation.status,
          itemsProcessed: operation.itemsProcessed,
          itemsCreated: operation.itemsCreated,
          itemsUpdated: operation.itemsUpdated
        },
        message: operation.itemsCreated > 0 
          ? `Successfully processed ${operation.itemsCreated} new items from ${source.name}`
          : `No new changes found in ${source.name}`,
        timestamp: new Date().toISOString()
      })

    } catch (syncError: any) {
      console.error(`❌ Change detection failed for source ${source.name}:`, syncError)
      console.error('Error stack:', syncError.stack)
      
      // Record the failed operation in sync history
      try {
        await adminSupabase.rpc('record_sync_operation', {
          p_source_id: source.id,
          p_sync_type: syncType,
          p_status: 'failed',
          p_items_processed: 0,
          p_items_created: 0,
          p_items_updated: 0,
          p_error_message: syncError.message,
          p_change_token_before: source.change_token,
          p_change_token_after: null
        })
      } catch (recordError) {
        console.error('Failed to record sync failure:', recordError)
      }

      return NextResponse.json({
        success: false,
        syncType,
        source: {
          id: source.id,
          name: source.name,
          type: source.type
        },
        error: 'Sync operation failed',
        details: syncError.message,
        message: `Failed to sync ${source.name}: ${syncError.message}`,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { stack: syncError.stack })
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('❌ Manual sync API error:', error)
    console.error('Error stack:', error.stack)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process sync request',
      details: error.message,
      message: 'An unexpected error occurred during sync processing',
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }, { status: 500 })
  }
}