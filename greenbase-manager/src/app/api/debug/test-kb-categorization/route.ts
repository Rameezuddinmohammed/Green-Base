import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin()
    
    // Get all approved documents
    const { data: documents, error } = await supabaseAdmin
      .from('approved_documents')
      .select('id, title, summary, tags, organization_id, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by organization
    const byOrg = documents?.reduce((acc, doc) => {
      if (!acc[doc.organization_id]) {
        acc[doc.organization_id] = []
      }
      acc[doc.organization_id].push(doc)
      return acc
    }, {} as Record<string, any[]>) || {}

    return NextResponse.json({
      totalDocuments: documents?.length || 0,
      documentsByOrg: Object.entries(byOrg).map(([orgId, docs]) => ({
        organizationId: orgId,
        documentCount: docs.length,
        documents: docs.map(doc => ({
          id: doc.id,
          title: doc.title,
          tags: doc.tags,
          hasCategory: doc.tags && doc.tags.length > 0
        }))
      }))
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to test KB categorization', details: error.message },
      { status: 500 }
    )
  }
}