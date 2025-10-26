import { NextRequest, NextResponse } from 'next/server'
import { getOAuthService } from '../../../../../lib/oauth/oauth-service'
import { getServerSession } from 'next-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sourceId } = await params
    const oauthService = getOAuthService()
    // Use email as user identifier for now
    const channels = await oauthService.getTeamsChannels(session.user.email, sourceId)

    return NextResponse.json({ channels })
  } catch (error: any) {
    console.error('Get Teams channels error:', error)
    return NextResponse.json(
      { error: 'Failed to get Teams channels', details: error.message },
      { status: 500 }
    )
  }
}