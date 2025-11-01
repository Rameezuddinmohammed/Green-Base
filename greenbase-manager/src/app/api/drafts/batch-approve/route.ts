import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentIds } = await request.json()

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'Document IDs are required' }, { status: 400 })
    }

    const supabaseAdmin = await getSupabaseAdmin()
    
    // Get user info
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, organization_id, role')
      .eq('email', session.user.email)
      .single()

    if (!user || user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden - Manager access required' }, { status: 403 })
    }

    // Get all draft documents - only allow batch approval of green (high confidence) items
    const { data: draftDocs, error: fetchError } = await supabaseAdmin
      .from('draft_documents')
      .select('*')
      .in('id', documentIds)
      .eq('organization_id', user.organization_id)
      .eq('status', 'pending')
      .eq('triage_level', 'green') // Only allow batch approval of green items

    if (fetchError) {
      throw fetchError
    }

    if (!draftDocs || draftDocs.length === 0) {
      return NextResponse.json({ 
        error: 'No valid green (high confidence) draft documents found for batch approval. Only green items can be batch approved.' 
      }, { status: 404 })
    }

    // Check if any requested documents were filtered out due to not being green
    const foundIds = draftDocs.map(doc => doc.id)
    const filteredOutIds = documentIds.filter(id => !foundIds.includes(id))
    
    if (filteredOutIds.length > 0) {
      console.log(`Filtered out ${filteredOutIds.length} non-green documents from batch approval`)
    }

    const approvedDocuments = []
    const documentVersions = []

    // Process each document
    for (const draftDoc of draftDocs) {
      // Create approved document
      const approvedDoc = {
        title: draftDoc.title,
        content: draftDoc.content,
        summary: draftDoc.summary || '',
        tags: draftDoc.topics || [],
        organization_id: user.organization_id,
        approved_by: user.id,
        version: 1,
        source_draft_id: draftDoc.id // Track the original draft
      }
      
      approvedDocuments.push(approvedDoc)
    }

    // Batch insert approved documents
    const { data: insertedDocs, error: insertError } = await supabaseAdmin
      .from('approved_documents')
      .insert(approvedDocuments)
      .select()

    if (insertError) {
      throw insertError
    }

    // Create document version records
    for (let i = 0; i < insertedDocs.length; i++) {
      documentVersions.push({
        document_id: insertedDocs[i].id,
        version: 1,
        content: insertedDocs[i].content,
        changes: 'Batch approved as generated',
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })
    }

    await supabaseAdmin
      .from('document_versions')
      .insert(documentVersions)

    // Update draft document statuses
    await supabaseAdmin
      .from('draft_documents')
      .update({ status: 'approved' })
      .in('id', documentIds)

    return NextResponse.json({ 
      success: true, 
      approvedCount: insertedDocs.length,
      approvedDocuments: insertedDocs 
    })
  } catch (error: any) {
    console.error('Batch approve documents error:', error)
    return NextResponse.json(
      { error: 'Failed to batch approve documents', details: error.message },
      { status: 500 }
    )
  }
}

