import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // This contains the userId
    const error = searchParams.get('error')

    if (error) {
      console.error('Microsoft OAuth error:', error)
      return NextResponse.redirect(
        new URL(`/dashboard/sources?error=${encodeURIComponent('Microsoft OAuth failed')}`, request.url)
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(`/dashboard/sources?error=${encodeURIComponent('Invalid OAuth callback')}`, request.url)
      )
    }

    console.log('Processing Microsoft OAuth callback for user:', state)

    try {
      // Use the OAuth service to handle the complete callback flow
      const { getOAuthService } = await import('../../../../../lib/oauth/oauth-service')
      const oauthService = getOAuthService()
      const sourceName = `Microsoft Teams - ${new Date().toLocaleDateString()}`
      
      console.log('Processing OAuth callback with service...')
      const connectedSource = await oauthService.handleCallback('microsoft', code, state, sourceName)
      
      console.log('OAuth callback processed successfully:', connectedSource.id)

    } catch (error) {
      console.error('Microsoft OAuth callback processing failed:', error)
      return NextResponse.redirect(
        new URL(`/dashboard/sources?error=${encodeURIComponent(`Failed to save Microsoft Teams connection: ${error instanceof Error ? error.message : 'Unknown error'}`)}`, request.url)
      )
    }

    return NextResponse.redirect(
      new URL('/dashboard/sources?success=Microsoft Teams connected successfully', request.url)
    )
  } catch (error: any) {
    console.error('Microsoft OAuth callback error:', error)
    return NextResponse.redirect(
      new URL(`/dashboard/sources?error=${encodeURIComponent('Failed to connect Microsoft Teams')}`, request.url)
    )
  }
}