import { NextRequest, NextResponse } from 'next/server'
import { getOAuthService } from '../../../../../lib/oauth/oauth-service'
import { getServerSession } from 'next-auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: { sourceId: string } }
) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { selectedChannels, selectedFolders } = body

    const oauthService = getOAuthService()
    await oauthService.updateSourceSelection(
      session.user.id,
      params.sourceId,
      selectedChannels,
      selectedFolders
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Update source selection error:', error)
    return NextResponse.json(
      { error: 'Failed to update source selection', details: error.message },
      { status: 500 }
    )
  }
}