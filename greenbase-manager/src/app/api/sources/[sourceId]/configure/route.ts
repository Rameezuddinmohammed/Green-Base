import { NextRequest, NextResponse } from 'next/server'
import { getOAuthService } from '../../../../../lib/oauth/oauth-service'
import { getContentIngestionService } from '../../../../../lib/ingestion/content-ingestion-service'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sourceId } = await params
    const { selectedChannels, selectedFolders } = await request.json()

    // Update source configuration
    const oauthService = getOAuthService()
    await oauthService.updateSourceSelection(
      session.user.id,
      sourceId,
      selectedChannels,
      selectedFolders
    )

    // Get the updated source for ingestion
    const sources = await oauthService.getConnectedSources(session.user.id)
    const source = sources.find(s => s.id === sourceId)

    if (source && (selectedChannels?.length > 0 || selectedFolders?.length > 0)) {
      // Get user's organization ID
      const { data: user } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', session.user.id)
        .single()

      if (user) {
        // Automatically start content ingestion
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

        return NextResponse.json({ success: true, ingestionJob: job })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Configure source error:', error)
    return NextResponse.json(
      { error: 'Failed to configure source', details: error.message },
      { status: 500 }
    )
  }
}