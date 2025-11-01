import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing comprehensive date tracking...')
    
    const supabaseAdmin = await getSupabaseAdmin()
    
    // Test 1: Check if new date columns exist
    console.log('📊 Checking database schema...')
    const { data: draftColumns } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'draft_documents')
      .in('column_name', ['ingested_at', 'original_created_at', 'original_modified_at', 'approved_at', 'approved_by'])
    
    const { data: approvedColumns } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'approved_documents')
      .in('column_name', ['ingested_at', 'original_created_at', 'original_modified_at', 'approved_at'])
    
    // Test 2: Check recent documents with date fields
    console.log('📋 Checking recent documents...')
    const { data: recentDrafts } = await supabaseAdmin
      .from('draft_documents')
      .select('id, title, created_at, ingested_at, original_created_at, original_modified_at, approved_at, approved_by')
      .order('created_at', { ascending: false })
      .limit(3)
    
    const { data: recentApproved } = await supabaseAdmin
      .from('approved_documents')
      .select('id, title, created_at, ingested_at, original_created_at, original_modified_at, approved_at, approved_by')
      .order('created_at', { ascending: false })
      .limit(3)
    
    // Test 3: Date field analysis
    const dateFieldAnalysis = {
      draftDocuments: {
        total: recentDrafts?.length || 0,
        withIngestedAt: recentDrafts?.filter(d => d.ingested_at).length || 0,
        withOriginalCreatedAt: recentDrafts?.filter(d => d.original_created_at).length || 0,
        withOriginalModifiedAt: recentDrafts?.filter(d => d.original_modified_at).length || 0,
        withApprovedAt: recentDrafts?.filter(d => d.approved_at).length || 0,
      },
      approvedDocuments: {
        total: recentApproved?.length || 0,
        withIngestedAt: recentApproved?.filter(d => d.ingested_at).length || 0,
        withOriginalCreatedAt: recentApproved?.filter(d => d.original_created_at).length || 0,
        withOriginalModifiedAt: recentApproved?.filter(d => d.original_modified_at).length || 0,
        withApprovedAt: recentApproved?.filter(d => d.approved_at).length || 0,
      }
    }
    
    return NextResponse.json({
      success: true,
      schema: {
        draftDocumentColumns: draftColumns,
        approvedDocumentColumns: approvedColumns
      },
      sampleData: {
        recentDrafts: recentDrafts?.map(d => ({
          id: d.id,
          title: d.title,
          dates: {
            created_at: d.created_at,
            ingested_at: d.ingested_at,
            original_created_at: d.original_created_at,
            original_modified_at: d.original_modified_at,
            approved_at: d.approved_at
          }
        })),
        recentApproved: recentApproved?.map(d => ({
          id: d.id,
          title: d.title,
          dates: {
            created_at: d.created_at,
            ingested_at: d.ingested_at,
            original_created_at: d.original_created_at,
            original_modified_at: d.original_modified_at,
            approved_at: d.approved_at
          }
        }))
      },
      analysis: dateFieldAnalysis,
      recommendations: [
        dateFieldAnalysis.draftDocuments.withIngestedAt === 0 ? '⚠️ No draft documents have ingested_at populated' : '✅ Draft documents have ingested_at',
        dateFieldAnalysis.approvedDocuments.withApprovedAt === 0 ? '⚠️ No approved documents have approved_at populated' : '✅ Approved documents have approved_at',
        dateFieldAnalysis.draftDocuments.withOriginalCreatedAt === 0 ? '⚠️ No documents have original source dates' : '✅ Documents have original source dates'
      ]
    })
    
  } catch (error) {
    console.error('❌ Date tracking test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}