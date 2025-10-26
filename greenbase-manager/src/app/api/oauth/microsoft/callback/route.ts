import { NextRequest, NextResponse } from 'next/server'
import { getOAuthService } from '../../../../../lib/oauth/oauth-service'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL('/auth/signin', request.url))
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('Microsoft OAuth error:', error)
      return NextResponse.redirect(new URL('/dashboard?error=oauth_failed', request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL('/dashboard?error=no_code', request.url))
    }

    // Verify state matches user ID for security
    if (state !== session.user.id) {
      return NextResponse.redirect(new URL('/dashboard?error=invalid_state', request.url))
    }

    const oauthService = getOAuthService()
    const source = await oauthService.handleCallback(
      'microsoft',
      code,
      session.user.id, // Use UUID instead of email
      'Microsoft Teams Connection'
    )

    return NextResponse.redirect(new URL('/dashboard?connected=microsoft', request.url))
  } catch (error: any) {
    console.error('Microsoft OAuth callback error:', error)
    return NextResponse.redirect(new URL('/dashboard?error=callback_failed', request.url))
  }
}

