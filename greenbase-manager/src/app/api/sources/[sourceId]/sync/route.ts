import { NextRequest, NextResponse } from 'next/server'
import { getOAuthService } from '../../../../../lib/oauth/oauth-service'
import { getIngestionService } from '../../../../../lib/ingestion/ingestion-service'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user organization
    const { data: user } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', session.user.id)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { sourceId } = await params
    const oauthService = getOAuthService()
    const ingestionService = getIngestionService()

    // Get source content
    const rawContent = await oauthService.getSourceContent(session.user.id, sourceId)
    
    // Transform content to expected format
    const transformedContent = Array.isArray(rawContent) ? rawContent.map((item: any) => {
      if ('body' in item) {
        // Teams message - clean HTML content
        let content = item.body?.content || ''
        
        // Basic HTML to text conversion
        content = content
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
          .replace(/&amp;/g, '&') // Replace HTML entities
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim()
        
        return {
          id: item.id,
          type: 'teams_message' as const,
          title: `Message from ${item.from?.user?.displayName || 'Unknown'}`,
          content: content || '[Empty message]',
          metadata: {
            author: item.from?.user?.displayName,
            createdAt: new Date(item.createdDateTime),
            sourceUrl: item.webUrl,
            participants: [item.from?.user?.displayName].filter(Boolean)
          }
        }
      } else {
        // Drive file
        return {
          id: item.id,
          type: 'drive_file' as const,
          title: item.name,
          content: item.content || `File: ${item.name}`,
          metadata: {
            author: 'Unknown',
            createdAt: new Date(item.createdDateTime || item.lastModifiedDateTime || Date.now()),
            sourceUrl: item.webUrl
          }
        }
      }
    }) : []
    
    // Process content through ingestion pipeline
    const result = await ingestionService.processSourceContent(
      transformedContent,
      sourceId,
      user.organization_id
    )

    // Update last sync timestamp
    await oauthService.updateLastSync(session.user.id, sourceId)

    return NextResponse.json({ 
      success: true, 
      processed: result.documentsCreated,
      message: `Processed ${result.documentsCreated} documents from source`
    })
  } catch (error: any) {
    console.error('Sync source error:', error)
    return NextResponse.json(
      { error: 'Failed to sync source', details: error.message },
      { status: 500 }
    )
  }
}