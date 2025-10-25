import { NextRequest, NextResponse } from 'next/server'
import { getOAuthService } from '../../../../../lib/oauth/oauth-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // This contains the userId
    const error = searchParams.get('error')

    if (error) {
      console.error('Microsoft OAuth error:', error)
      return NextResponse.redirect(
        new URL(`/dashboard/sources?error=${encodeURIComponent(error)}`, request.url)
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/sources?error=missing_parameters', request.url)
      )
    }

    const oauthService = getOAuthService()
    const connectedSource = await oauthService.handleCallback(
      'microsoft',
      code,
      state, // userId from state parameter
      'Microsoft Teams' // Default name, can be customized later
    )

    // Redirect to success page with source ID
    return NextResponse.redirect(
      new URL(`/dashboard/sources?success=microsoft&sourceId=${connectedSource.id}`, request.url)
    )
  } catch (error: any) {
    console.error('Microsoft OAuth callback error:', error)
    return NextResponse.redirect(
      new URL(`/dashboard/sources?error=${encodeURIComponent(error.message)}`, request.url)
    )
  }
}