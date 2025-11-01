import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'
import { getVectorSearchService } from '../../../../lib/vector/vector-search-service'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
    const query = searchParams.get('q')

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

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

    try {
      // Try vector search first if embeddings are available
      const vectorSearchService = getVectorSearchService()
      let searchResults: any[] = []
      let useVectorSearch = false

      try {
        searchResults = await vectorSearchService.searchDocuments(query, {
          organizationId: user.organization_id,
          limit: 20,
          threshold: 0.3 // Lower threshold for more results
        })
        
        if (searchResults.length > 0) {
          useVectorSearch = true
        }
      } catch (vectorError) {
        console.warn('Vector search failed, using text search:', vectorError)
      }

      let documents: any[] = []

      if (useVectorSearch && searchResults.length > 0) {
        // Get full document details for vector search results
        const documentIds = searchResults.map(r => r.id)
        const { data: fullDocs, error: docsError } = await supabaseAdmin
          .from('approved_documents')
          .select('*')
          .eq('organization_id', user.organization_id)
          .in('id', documentIds)

        if (!docsError && fullDocs) {
          documents = fullDocs.map(doc => {
            const searchResult = searchResults.find(r => r.id === doc.id)
            return {
              ...doc,
              similarity: searchResult?.similarity || 0,
              snippet: generateSnippet(doc.content, query)
            }
          }).sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
        }
      }

      // Fallback to text search if vector search didn't work or returned no results
      if (documents.length === 0) {
        const { data: textSearchDocs, error } = await supabaseAdmin
          .from('approved_documents')
          .select('*')
          .eq('organization_id', user.organization_id)
          .or(`title.ilike.%${query}%,content.ilike.%${query}%,summary.ilike.%${query}%`)
          .order('updated_at', { ascending: false })
          .limit(20)

        if (error) {
          throw error
        }

        documents = (textSearchDocs || []).map(doc => ({
          ...doc,
          snippet: generateSnippet(doc.content, query)
        }))
      }

      return NextResponse.json({ 
        documents,
        searchType: useVectorSearch ? 'semantic' : 'text',
        totalResults: documents.length
      })

    } catch (searchError: any) {
      console.error('Search failed:', searchError)
      return NextResponse.json(
        { error: 'Search failed', details: searchError.message },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Search knowledge base error:', error)
    return NextResponse.json(
      { error: 'Failed to search knowledge base', details: error.message },
      { status: 500 }
    )
  }
}

// Helper function to generate search snippets
function generateSnippet(content: string, query: string, maxLength: number = 200): string {
  const queryLower = query.toLowerCase()
  const contentLower = content.toLowerCase()
  const queryIndex = contentLower.indexOf(queryLower)
  
  if (queryIndex === -1) {
    return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '')
  }
  
  const start = Math.max(0, queryIndex - 50)
  const end = Math.min(content.length, queryIndex + query.length + 150)
  const snippet = content.substring(start, end)
  
  return (start > 0 ? '...' : '') + snippet + (end < content.length ? '...' : '')
}