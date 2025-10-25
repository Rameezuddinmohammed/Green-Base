import { NextRequest, NextResponse } from 'next/server'
import { getOAuthService } from '../../../../../lib/oauth/oauth-service'
import { getServerSession } from 'next-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { sourceId: string } }
) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folderId')

    const oauthService = getOAuthService()
    const folders = await oauthService.getDriveFolders(
      session.user.id, 
      params.sourceId, 
      folderId || undefined
    )

    return NextResponse.json({ folders })
  } catch (error: any) {
    console.error('Get Drive folders error:', error)
    return NextResponse.json(
      { error: 'Failed to get Drive folders', details: error.message },
      { status: 500 }
    )
  }
}