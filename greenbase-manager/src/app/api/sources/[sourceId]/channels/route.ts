import { NextRequest, NextResponse } from 'next/server'
import { getOAuthService } from '../../../../../lib/oauth/oauth-service'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(
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

    const oauthService = getOAuthService()
    const channels = await oauthService.getTeamsChannels(session.user.id, sourceId)

    return NextResponse.json({ channels })
  } catch (error: any) {
    console.error('Get Teams channels error:', error)
    return NextResponse.json(
      { error: 'Failed to get Teams channels', details: error.message },
      { status: 500 }
    )
  }
}