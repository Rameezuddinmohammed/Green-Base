import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getDocumentCategorizationService } from '../../../../lib/ai/document-categorization'

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

    console.log('🧠 Starting automatic categorization for organization:', user.organization_id)

    // Get all approved documents that need categorization
    const { data: documents } = await supabaseAdmin
      .from('approved_documents')
      .select('id, title, content, summary, tags')
      .eq('organization_id', user.organization_id)
      .or('tags.is.null,tags.eq.{}')

    if (!documents || documents.length === 0) {
      return NextResponse.json({ 
        message: 'No documents need categorization',
        categorized: 0
      })
    }

    console.log(`📚 Found ${documents.length} documents to categorize`)

    const categorizationService = getDocumentCategorizationService()
    let categorizedCount = 0

    // Process documents in batches to avoid overwhelming the AI service
    const batchSize = 5
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize)
      
      for (const doc of batch) {
        try {
          console.log(`🔍 Categorizing document: ${doc.title}`)
          
          const suggestion = await categorizationService.suggestCategoryForDocument({
            id: doc.id,
            title: doc.title,
            content: doc.content,
            summary: doc.summary || undefined,
            tags: doc.tags || undefined
          }, user.organization_id)

          // Update document with AI-suggested category
          await supabaseAdmin
            .from('approved_documents')
            .update({
              tags: [suggestion.suggestedCategory],
              updated_at: new Date().toISOString()
            })
            .eq('id', doc.id)

          categorizedCount++
          console.log(`✅ Categorized "${doc.title}" as "${suggestion.suggestedCategory}" (${Math.round(suggestion.confidence * 100)}% confidence)`)
          
        } catch (error) {
          console.error(`❌ Failed to categorize document ${doc.id}:`, error)
          
          // Fallback: assign a basic category based on title
          const fallbackCategory = doc.title.toLowerCase().includes('policy') ? 'Company Policies' : 'General Documents'
          await supabaseAdmin
            .from('approved_documents')
            .update({
              tags: [fallbackCategory],
              updated_at: new Date().toISOString()
            })
            .eq('id', doc.id)
          
          categorizedCount++
        }
      }

      // Small delay between batches to be respectful to the AI service
      if (i + batchSize < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`🎉 Automatic categorization complete: ${categorizedCount}/${documents.length} documents categorized`)

    return NextResponse.json({
      message: 'Automatic categorization completed',
      totalDocuments: documents.length,
      categorized: categorizedCount,
      success: true
    })

  } catch (error: any) {
    console.error('❌ Auto-categorization error:', error)
    return NextResponse.json(
      { error: 'Failed to auto-categorize documents', details: error.message },
      { status: 500 }
    )
  }
}