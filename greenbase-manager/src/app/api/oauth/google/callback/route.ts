import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('Google OAuth callback received')
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // This contains the userId
    const error = searchParams.get('error')

    console.log('Callback params:', { code: !!code, state, error })

    if (error) {
      console.error('Google OAuth error:', error)
      return NextResponse.redirect(
        new URL(`/dashboard/sources?error=${encodeURIComponent(`Google OAuth failed: ${error}`)}`, request.url)
      )
    }

    if (!code || !state) {
      console.error('Missing code or state in callback')
      return NextResponse.redirect(
        new URL(`/dashboard/sources?error=${encodeURIComponent('Invalid OAuth callback - missing code or state')}`, request.url)
      )
    }

    console.log('Processing OAuth callback for user:', state)
    
    try {
      // Use the OAuth service to handle the complete callback flow
      const { getOAuthService } = await import('../../../../../lib/oauth/oauth-service')
      const oauthService = getOAuthService()
      const sourceName = `Google Drive - ${new Date().toLocaleDateString()}`
      
      console.log('Processing OAuth callback with service...')
      const connectedSource = await oauthService.handleCallback('google', code, state, sourceName)
      
      console.log('OAuth callback processed successfully:', connectedSource.id)

    } catch (error) {
      console.error('OAuth callback processing failed:', error)
      return NextResponse.redirect(
        new URL(`/dashboard/sources?error=${encodeURIComponent(`Failed to save Google Drive connection: ${error instanceof Error ? error.message : 'Unknown error'}`)}`, request.url)
      )
    }

    return NextResponse.redirect(
      new URL('/dashboard/sources?success=Google Drive connected successfully', request.url)
    )
  } catch (error: any) {
    console.error('Google OAuth callback error:', error)
    return NextResponse.redirect(
      new URL(`/dashboard/sources?error=${encodeURIComponent(`Failed to connect Google Drive: ${error.message}`)}`, request.url)
    )
  }
}