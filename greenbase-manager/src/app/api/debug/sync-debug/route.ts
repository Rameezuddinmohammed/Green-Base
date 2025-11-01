import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin()
    
    // Get all connected sources
    const { data: sources } = await supabaseAdmin
      .from('connected_sources')
      .select('*')
      .eq('type', 'google_drive')
    
    console.log('📊 Connected Google Drive sources:', sources?.length)
    
    const sourceDetails = sources?.map(source => ({
      id: source.id,
      name: source.name,
      isActive: source.is_active,
      autoSyncEnabled: source.auto_sync_enabled,
      syncFrequency: source.sync_frequency_minutes,
      lastSync: source.last_sync_at,
      lastChangeCheck: source.last_change_check,
      selectedFolders: source.selected_folders,
      shouldSync: source.is_active && source.auto_sync_enabled,
      timeSinceLastCheck: source.last_change_check ? 
        Math.floor((Date.now() - new Date(source.last_change_check).getTime()) / (1000 * 60)) : 
        'Never'
    }))
    
    return NextResponse.json({
      success: true,
      totalSources: sources?.length || 0,
      sources: sourceDetails
    })
    
  } catch (error: any) {
    console.error('❌ Sync debug error:', error)
    return NextResponse.json(
      { error: 'Failed to debug sync', details: error.message },
      { status: 500 }
    )
  }
}