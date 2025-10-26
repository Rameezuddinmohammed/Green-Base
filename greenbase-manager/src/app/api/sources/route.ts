import { NextRequest, NextResponse } from 'next/server'
import { getOAuthService } from '../../../lib/oauth/oauth-service'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const oauthService = getOAuthService()
    const sources = await oauthService.getConnectedSources(session.user.id)

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
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sourceId = searchParams.get('sourceId')

    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 })
    }

    const oauthService = getOAuthService()
    await oauthService.disconnectSource(session.user.id, sourceId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Disconnect source error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect source', details: error.message },
      { status: 500 }
    )
  }
}

