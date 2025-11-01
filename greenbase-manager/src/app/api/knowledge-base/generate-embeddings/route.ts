import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'
import { getVectorSearchService } from '../../../../lib/vector/vector-search-service'
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

    // Only managers can generate embeddings
    if (user.role !== 'manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get documents without embeddings
    const { data: documents, error } = await supabaseAdmin
      .from('approved_documents')
      .select('id, title, content')
      .eq('organization_id', user.organization_id)
      .is('embedding', null)

    if (error) {
      throw error
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ 
        message: 'No documents need embeddings',
        processed: 0
      })
    }

    console.log(`🔄 Generating embeddings for ${documents.length} documents...`)

    const vectorService = getVectorSearchService()
    let processed = 0
    let failed = 0

    // Process documents in batches
    for (const doc of documents) {
      try {
        await vectorService.embedDocument(doc.id, doc.content, user.organization_id)
        processed++
        console.log(`✅ Generated embeddings for: ${doc.title}`)
      } catch (error) {
        console.error(`❌ Failed to generate embeddings for ${doc.title}:`, error)
        failed++
      }
    }

    return NextResponse.json({
      message: `Embeddings generation completed`,
      processed,
      failed,
      total: documents.length
    })

  } catch (error: any) {
    console.error('Generate embeddings error:', error)
    return NextResponse.json(
      { error: 'Failed to generate embeddings', details: error.message },
      { status: 500 }
    )
  }
}