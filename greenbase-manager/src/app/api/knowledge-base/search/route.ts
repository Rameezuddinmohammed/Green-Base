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
      // Try vector search first
      const vectorSearchService = getVectorSearchService()
      const searchResults = await vectorSearchService.searchDocuments(query, {
        organizationId: user.organization_id,
        limit: 20,
        threshold: 0.5
      })

      // Convert search results to document format
      const documents = searchResults.map(result => ({
        id: result.id,
        title: result.title,
        content: result.content,
        summary: result.content.substring(0, 200) + '...',
        tags: [], // Would need to be fetched separately
        created_at: new Date().toISOString(), // Placeholder
        updated_at: new Date().toISOString(), // Placeholder
        approved_by: '', // Placeholder
        version: 1,
        similarity: result.similarity
      }))

      return NextResponse.json({ documents })

    } catch (vectorError) {
      console.warn('Vector search failed, falling back to text search:', vectorError)
      
      // Fallback to simple text search
      const { data: documents, error } = await supabaseAdmin
        .from('approved_documents')
        .select('*')
        .eq('organization_id', user.organization_id)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order('updated_at', { ascending: false })
        .limit(20)

      if (error) {
        throw error
      }

      return NextResponse.json({ documents })
    }

  } catch (error: any) {
    console.error('Search knowledge base error:', error)
    return NextResponse.json(
      { error: 'Failed to search knowledge base', details: error.message },
      { status: 500 }
    )
  }
}