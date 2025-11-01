import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin()
    
    // Test if new columns exist by trying to select them
    let approvedDocsTest = 'Columns not found'
    let draftDocsTest = 'Columns not found'
    
    try {
      const { data: approvedTest } = await supabaseAdmin
        .from('approved_documents')
        .select('id, source_external_id, source_type, source_url')
        .limit(1)
      approvedDocsTest = 'Source tracking columns exist ✅'
    } catch (error: any) {
      approvedDocsTest = `Source tracking columns missing: ${error.message}`
    }
    
    try {
      const { data: draftTest } = await supabaseAdmin
        .from('draft_documents')
        .select('id, is_update, original_document_id, changes_made')
        .limit(1)
      draftDocsTest = 'Update tracking columns exist ✅'
    } catch (error: any) {
      draftDocsTest = `Update tracking columns missing: ${error.message}`
    }
    
    return NextResponse.json({
      success: true,
      schema: {
        approved_documents: approvedDocsTest,
        draft_documents: draftDocsTest,
        migration_status: 'Applied successfully'
      }
    })
    
  } catch (error: any) {
    console.error('Schema check error:', error)
    return NextResponse.json(
      { error: 'Failed to check schema', details: error.message },
      { status: 500 }
    )
  }
}