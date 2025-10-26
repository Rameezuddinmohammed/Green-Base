import { NextRequest, NextResponse } from 'next/server'
import { getContentIngestionService } from '../../../../../lib/ingestion/content-ingestion-service'
import { getOAuthService } from '../../../../../lib/oauth/oauth-service'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sourceId } = await params

    // Get the connected source
    const oauthService = getOAuthService()
    const sources = await oauthService.getConnectedSources(session.user.id)
    const source = sources.find(s => s.id === sourceId)

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }

    // Get user's organization ID
    const { data: user } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', session.user.id)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Start content ingestion
    const ingestionService = getContentIngestionService()
    const job = await ingestionService.startIngestion({
      id: source.id,
      type: source.type,
      userId: session.user.id,
      organizationId: user.organization_id,
      name: source.name,
      selectedChannels: source.selectedChannels,
      selectedFolders: source.selectedFolders,
      selectedTeamChannels: source.selectedTeamChannels,
      isActive: source.isActive
    })

    return NextResponse.json({ job })
  } catch (error: any) {
    console.error('Start ingestion error:', error)
    return NextResponse.json(
      { error: 'Failed to start ingestion', details: error.message },
      { status: 500 }
    )
  }
}