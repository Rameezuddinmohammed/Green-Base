import { NextRequest, NextResponse } from 'next/server'
import { getOAuthService } from '../../../lib/oauth/oauth-service'
import { getServerSession } from 'next-auth'

export async function GET(request: NextRequest) {
  try {
    // For testing purposes, use a dummy user ID
    const testUserId = 'test-user-123'

    const oauthService = getOAuthService()
    const sources = await oauthService.getConnectedSources(testUserId)

    return NextResponse.json({ sources })
  } catch (error: any) {
    console.error('Get sources error:', error)
    return NextResponse.json(
      { error: 'Failed to get connected sources', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sourceId = searchParams.get('sourceId')

    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 })
    }

    const oauthService = getOAuthService()
    await oauthService.disconnectSource(session.user.email, sourceId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Disconnect source error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect source', details: error.message },
      { status: 500 }
    )
  }
}