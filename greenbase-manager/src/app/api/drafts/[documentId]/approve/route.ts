import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId } = await params
    const { editedContent } = await request.json()

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

    // Get the draft document
    const { data: draftDoc, error: fetchError } = await supabaseAdmin
      .from('draft_documents')
      .select('*')
      .eq('id', documentId)
      .eq('organization_id', user.organization_id)
      .single()

    if (fetchError || !draftDoc) {
      return NextResponse.json({ error: 'Draft document not found' }, { status: 404 })
    }

    // Create approved document
    const { data: approvedDoc, error: insertError } = await supabaseAdmin
      .from('approved_documents')
      .insert({
        title: draftDoc.title,
        content: editedContent || draftDoc.content,
        summary: draftDoc.summary || '',
        tags: draftDoc.topics || [],
        organization_id: user.organization_id,
        approved_by: user.id,
        version: 1
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    // Create document version record
    await supabaseAdmin
      .from('document_versions')
      .insert({
        document_id: approvedDoc.id,
        version: 1,
        content: approvedDoc.content,
        changes: editedContent ? 'Edited during approval' : 'Approved as generated',
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })

    // Update draft document status
    await supabaseAdmin
      .from('draft_documents')
      .update({ status: 'approved' })
      .eq('id', documentId)

    return NextResponse.json({ success: true, approvedDocument: approvedDoc })
  } catch (error: any) {
    console.error('Approve document error:', error)
    return NextResponse.json(
      { error: 'Failed to approve document', details: error.message },
      { status: 500 }
    )
  }
}