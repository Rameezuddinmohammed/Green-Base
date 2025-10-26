import { NextRequest, NextResponse } from 'next/server'
import { getOAuthService } from '../../../../../lib/oauth/oauth-service'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sourceName } = await request.json()

    if (!sourceName) {
      return NextResponse.json({ error: 'Source name is required' }, { status: 400 })
    }

    // Create Microsoft OAuth URL directly to avoid cookie issues
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/oauth/microsoft/callback`
    const scopes = 'openid profile email https://graph.microsoft.com/Files.Read https://graph.microsoft.com/Group.Read.All'
    
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${process.env.MICROSOFT_CLIENT_ID}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=${encodeURIComponent(session.user.id)}&` +
      `response_mode=query`

    return NextResponse.json({ authUrl })
  } catch (error: any) {
    console.error('Microsoft OAuth auth error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate Microsoft OAuth', details: error.message },
      { status: 500 }
    )
  }
}

