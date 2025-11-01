import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getDocumentCategorizationService } from '../../../../../lib/ai/document-categorization'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const cookieStore = await cookies()
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
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.email) {
      console.log('❌ No session or email found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('👤 User session:', session.user.email)

    const { documentId } = await params
    
    // Parse request body safely
    let editedContent = null
    try {
      const body = await request.json()
      editedContent = body.editedContent
    } catch (e) {
      // No body or invalid JSON - that's okay, editedContent will be null
    }

    const supabaseAdmin = await getSupabaseAdmin()
    
    // Get user info
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, organization_id, role')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      console.log('❌ User not found in database')
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.role !== 'manager') {
      console.log('❌ User is not a manager:', user.role)
      return NextResponse.json({ error: 'Forbidden - Manager access required' }, { status: 403 })
    }

    console.log('✅ User authorized:', { id: user.id, role: user.role, org: user.organization_id })

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

    console.log('🆕 Creating new approved document')
    console.log('Draft document data:', {
      title: draftDoc.title,
      summary: draftDoc.summary,
      topics: draftDoc.topics,
      organization_id: user.organization_id
    })

    // Get smart category suggestion for this document
    let smartCategory = 'General Documents'
    let categoryConfidence = 0.5
    let categoryReasoning = 'Default category'

    try {
      console.log('🧠 Getting AI category suggestion...')
      const categorizationService = getDocumentCategorizationService()
      const suggestion = await categorizationService.suggestCategoryForDocument({
        id: documentId,
        title: draftDoc.title,
        content: editedContent || draftDoc.content,
        summary: draftDoc.summary || undefined,
        topics: draftDoc.topics || undefined,
        tags: draftDoc.topics || undefined
      }, user.organization_id)

      smartCategory = suggestion.suggestedCategory
      categoryConfidence = suggestion.confidence
      categoryReasoning = suggestion.reasoning
      console.log('✅ AI suggested category:', smartCategory, `(${Math.round(categoryConfidence * 100)}% confidence)`)
    } catch (error) {
      console.warn('⚠️ Failed to get AI category suggestion, using fallback:', error)
    }
    
    let approvedDoc
    let isUpdate = false
    let newVersion = 1

    // Check if this is an update to an existing document
    if (draftDoc.is_update && draftDoc.original_document_id) {
      isUpdate = true
      console.log('📝 Processing document update for:', draftDoc.original_document_id)
      
      // Get the existing document to determine next version
      const { data: existingDoc } = await supabaseAdmin
        .from('approved_documents')
        .select('id, version, title')
        .eq('id', draftDoc.original_document_id)
        .single()
      
      if (existingDoc) {
        newVersion = existingDoc.version + 1
        console.log(`📈 Updating to version ${newVersion}`)
        
        // Update the existing document
        const { data: updatedDoc, error: updateError } = await supabaseAdmin
          .from('approved_documents')
          .update({
            content: editedContent || draftDoc.content,
            summary: draftDoc.summary || '',
            tags: [smartCategory], // Use AI-suggested category as primary tag
            approved_by: user.id,
            version: newVersion,
            updated_at: new Date().toISOString(),
            approved_at: new Date().toISOString()
          })
          .eq('id', draftDoc.original_document_id)
          .select()
          .single()
        
        if (updateError) {
          console.error('Update error:', updateError)
          throw updateError
        }
        
        approvedDoc = updatedDoc
        console.log('✅ Updated existing document to version', newVersion)
      } else {
        console.warn('⚠️ Original document not found, creating new document instead')
        isUpdate = false
      }
    }
    
    // If not an update or original document not found, create new document
    if (!isUpdate) {
      const { data: newDoc, error: insertError } = await supabaseAdmin
        .from('approved_documents')
        .insert({
          title: draftDoc.title,
          content: editedContent || draftDoc.content,
          summary: draftDoc.summary || '',
          tags: [smartCategory], // Use AI-suggested category as primary tag
          organization_id: user.organization_id,
          approved_by: user.id,
          version: 1,
          approved_at: new Date().toISOString(),
          original_created_at: draftDoc.original_created_at,
          source_external_id: draftDoc.source_external_id
        })
        .select()
        .single()

      if (insertError) {
        console.error('Insert error:', insertError)
        throw insertError
      }
      
      approvedDoc = newDoc
      console.log('✅ Created new approved document with smart category:', approvedDoc.id, smartCategory)
    }

    // Create version record
    const changesSummary = isUpdate && draftDoc.changes_made?.length > 0 
      ? draftDoc.changes_made.join('; ') 
      : (editedContent ? 'Edited during approval' : (isUpdate ? 'Document updated' : 'Initial version'))
    
    await supabaseAdmin
      .from('document_versions')
      .insert({
        document_id: approvedDoc.id,
        version: newVersion,
        content: approvedDoc.content,
        changes: changesSummary,
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })

    // Update draft document status
    await supabaseAdmin
      .from('draft_documents')
      .update({ 
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id
      })
      .eq('id', documentId)

    return NextResponse.json({ 
      success: true, 
      approvedDocument: approvedDoc,
      isUpdate: false
    })
  } catch (error: any) {
    console.error('Approve document error:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: 'Failed to approve document', details: error.message, stack: error.stack },
      { status: 500 }
    )
  }
}