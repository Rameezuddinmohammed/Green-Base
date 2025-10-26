import { NextRequest, NextResponse } from 'next/server'
import { getOAuthService } from '../../../../../lib/oauth/oauth-service'
import { getServerSession } from 'next-auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { selectedChannels, selectedFolders } = body
    const { sourceId } = await params

    const oauthService = getOAuthService()
    await oauthService.updateSourceSelection(
      session.user.email,
      sourceId,
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