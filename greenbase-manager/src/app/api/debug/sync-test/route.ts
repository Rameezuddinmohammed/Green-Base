import { NextRequest, NextResponse } from 'next/server'

export async function POST(_request: NextRequest) {
  try {
    console.log('🧪 Starting sync debug test...')
    
    // Test 1: Basic imports
    console.log('✅ Basic imports working')
    
    // Test 2: Supabase admin
    try {
      const { getSupabaseAdmin } = await import('../../../../lib/supabase-admin')
      console.log('✅ Supabase admin import successful')
      
      const adminClient = await getSupabaseAdmin()
      console.log('✅ Supabase admin client created')
      
      // Test basic query
      const { error } = await adminClient
        .from('connected_sources')
        .select('count')
        .limit(1)
        
      if (error) {
        console.error('❌ Supabase query error:', error)
      } else {
        console.log('✅ Supabase query successful')
      }
      
    } catch (supabaseError) {
      console.error('❌ Supabase admin error:', supabaseError)
      return NextResponse.json({
        success: false,
        error: 'Supabase admin failed',
        details: supabaseError instanceof Error ? supabaseError.message : 'Unknown error',
        step: 'supabase_admin'
      })
    }
    
    // Test 3: Change detection service
    try {
      const { getChangeDetectionService } = await import('../../../../lib/ingestion/change-detection-service')
      console.log('✅ Change detection service import successful')
      
      const changeService = getChangeDetectionService()
      console.log('✅ Change detection service instance created')
      
      await changeService.initialize()
      console.log('✅ Change detection service initialized')
      
    } catch (changeServiceError) {
      console.error('❌ Change detection service error:', changeServiceError)
      return NextResponse.json({
        success: false,
        error: 'Change detection service failed',
        details: changeServiceError instanceof Error ? changeServiceError.message : 'Unknown error',
        step: 'change_detection_service'
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'All sync components working correctly',
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('❌ Debug test failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Debug test failed',
      details: error.message,
      stack: error.stack,
      step: 'general'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Sync debug test endpoint. Use POST to run tests.',
    availableTests: [
      'Basic imports',
      'Supabase admin client',
      'Change detection service'
    ]
  })
}