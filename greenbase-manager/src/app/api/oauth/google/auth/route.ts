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

    // Create Google OAuth URL directly to avoid cookie issues
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/oauth/google/callback`
    const scopes = 'openid profile email https://www.googleapis.com/auth/drive.readonly'
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=${encodeURIComponent(session.user.id)}&` +
      `access_type=offline&` +
      `prompt=consent`

    return NextResponse.json({ authUrl })
  } catch (error: any) {
    console.error('Google OAuth auth error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate Google OAuth', details: error.message },
      { status: 500 }
    )
  }
}

