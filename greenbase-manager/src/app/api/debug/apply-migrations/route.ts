import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin()
    const results = []
    
    console.log('🔄 Applying document update tracking migrations...')
    
    // Step 1: Add source tracking to approved_documents
    try {
      await supabaseAdmin.rpc('exec', { 
        sql: 'ALTER TABLE approved_documents ADD COLUMN IF NOT EXISTS source_external_id TEXT' 
      })
      await supabaseAdmin.rpc('exec', { 
        sql: 'ALTER TABLE approved_documents ADD COLUMN IF NOT EXISTS source_type source_type' 
      })
      await supabaseAdmin.rpc('exec', { 
        sql: 'ALTER TABLE approved_documents ADD COLUMN IF NOT EXISTS source_url TEXT' 
      })
      results.push('✅ Added source tracking to approved_documents')
    } catch (error: any) {
      results.push(`⚠️ Source tracking (may already exist): ${error.message}`)
    }
    
    // Step 2: Add source tracking to document_versions
    try {
      await supabaseAdmin.rpc('exec', { 
        sql: 'ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS source_external_id TEXT' 
      })
      await supabaseAdmin.rpc('exec', { 
        sql: 'ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS source_type source_type' 
      })
      await supabaseAdmin.rpc('exec', { 
        sql: 'ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS source_url TEXT' 
      })
      results.push('✅ Added source tracking to document_versions')
    } catch (error: any) {
      results.push(`⚠️ Document versions source tracking: ${error.message}`)
    }
    
    // Step 3: Add update tracking to draft_documents
    try {
      await supabaseAdmin.rpc('exec', { 
        sql: 'ALTER TABLE draft_documents ADD COLUMN IF NOT EXISTS is_update BOOLEAN DEFAULT FALSE' 
      })
      await supabaseAdmin.rpc('exec', { 
        sql: 'ALTER TABLE draft_documents ADD COLUMN IF NOT EXISTS original_document_id UUID REFERENCES approved_documents(id)' 
      })
      await supabaseAdmin.rpc('exec', { 
        sql: 'ALTER TABLE draft_documents ADD COLUMN IF NOT EXISTS changes_made TEXT[] DEFAULT \'{}\'::TEXT[]' 
      })
      results.push('✅ Added update tracking to draft_documents')
    } catch (error: any) {
      results.push(`⚠️ Update tracking: ${error.message}`)
    }
    
    // Step 4: Add indexes
    try {
      await supabaseAdmin.rpc('exec', { 
        sql: 'CREATE INDEX IF NOT EXISTS idx_approved_documents_source_external_id ON approved_documents(source_external_id, organization_id)' 
      })
      await supabaseAdmin.rpc('exec', { 
        sql: 'CREATE INDEX IF NOT EXISTS idx_draft_documents_is_update ON draft_documents(is_update, original_document_id)' 
      })
      results.push('✅ Added indexes for efficient lookups')
    } catch (error: any) {
      results.push(`⚠️ Indexes: ${error.message}`)
    }
    
    console.log('🎉 Migration completed!')
    
    return NextResponse.json({
      success: true,
      message: 'Document update tracking migrations applied successfully',
      results
    })
    
  } catch (error: any) {
    console.error('❌ Migration error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to apply migrations', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}