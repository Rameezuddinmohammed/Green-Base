import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'
import { getDocumentCategorizationService } from '../../../../lib/ai/document-categorization'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
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
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { mode = 'full', documentIds } = await request.json()

    const supabaseAdmin = await getSupabaseAdmin()
    
    // Get user's organization
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('organization_id, role')
      .eq('id', session.user.id)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only managers can trigger full recategorization
    if (mode === 'full' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Manager access required for full categorization' }, { status: 403 })
    }

    // Get documents to categorize
    let documentsQuery = supabaseAdmin
      .from('approved_documents')
      .select('id, title, content, summary, topics, tags, source_type, embedding')
      .eq('organization_id', user.organization_id)
      .not('tags', 'cs', '["archived"]')

    if (mode === 'selective' && documentIds && documentIds.length > 0) {
      documentsQuery = documentsQuery.in('id', documentIds)
    }

    const { data: documents, error: fetchError } = await documentsQuery

    if (fetchError) {
      throw fetchError
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ 
        message: 'No documents found to categorize',
        categories: [],
        uncategorized: []
      })
    }

    console.log(`Starting categorization for ${documents.length} documents`)

    // Run AI categorization
    const categorizationService = getDocumentCategorizationService()
    const result = await categorizationService.categorizeDocuments(documents as any[], user.organization_id)

    // Apply categorization if requested
    const { apply = false } = await request.json().catch(() => ({ apply: false }))
    if (apply) {
      await categorizationService.applyCategorization(user.organization_id, result)
    }

    return NextResponse.json({
      success: true,
      categories: result.categories,
      uncategorized: result.uncategorized,
      stats: {
        totalDocuments: documents.length,
        categorizedDocuments: result.categories.reduce((sum, cat) => sum + cat.documentIds.length, 0),
        uncategorizedDocuments: result.uncategorized.length,
        categoriesCreated: result.categories.length,
        processingTime: result.processingTime,
        tokensUsed: result.tokensUsed
      },
      applied: apply
    })

  } catch (error: any) {
    console.error('Document categorization error:', error)
    return NextResponse.json(
      { error: 'Failed to categorize documents', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
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
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    const supabaseAdmin = await getSupabaseAdmin()
    
    // Get user's organization
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', session.user.id)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (documentId) {
      // Get category suggestion for a specific document
      const { data: document } = await supabaseAdmin
        .from('approved_documents')
        .select('id, title, content, summary, topics, tags, source_type')
        .eq('id', documentId)
        .eq('organization_id', user.organization_id)
        .single()

      if (!document) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }

      const categorizationService = getDocumentCategorizationService()
      const suggestion = await categorizationService.suggestCategoryForDocument(document as any, user.organization_id)

      return NextResponse.json({
        documentId,
        suggestion
      })
    } else {
      // Get current categorization stats
      const { data: documents } = await supabaseAdmin
        .from('approved_documents')
        .select('id, topics, tags')
        .eq('organization_id', user.organization_id)
        .not('tags', 'cs', '["archived"]')

      const stats = {
        totalDocuments: documents?.length || 0,
        categorizedDocuments: documents?.filter((doc: any) => doc.topics && doc.topics.length > 0).length || 0,
        categories: [...new Set(documents?.flatMap((doc: any) => doc.topics || []).filter(Boolean) || [])],
        uncategorizedDocuments: documents?.filter((doc: any) => !doc.topics || doc.topics.length === 0).length || 0
      }

      return NextResponse.json({ stats })
    }

  } catch (error: any) {
    console.error('Get categorization info error:', error)
    return NextResponse.json(
      { error: 'Failed to get categorization info', details: error.message },
      { status: 500 }
    )
  }
}