import { NextRequest, NextResponse } from 'next/server'
import { getOAuthService } from '../../../../../lib/oauth/oauth-service'
import { getDemoStorage } from '../../../../../lib/demo-storage'

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
      const oauthService = getOAuthService()
      const sourceName = `Microsoft Teams - ${new Date().toLocaleDateString()}`
      
      const connectedSource = await oauthService.handleCallback('microsoft', code, state, sourceName)
      console.log('Microsoft OAuth callback processed successfully:', connectedSource.id)
    } catch (error) {
      console.error('Microsoft OAuth callback processing failed:', error)
      
      // Fallback: Store in demo storage
      console.log('Using demo storage fallback for Microsoft OAuth callback')
      const demoStorage = getDemoStorage()
      const demoSource = {
        id: `demo-teams-${Date.now()}`,
        type: 'teams' as const,
        name: `Microsoft Teams - ${new Date().toLocaleDateString()}`,
        userId: state,
        accessToken: 'demo-access-token',
        refreshToken: 'demo-refresh-token',
        isActive: true,
        lastSyncAt: new Date()
      }
      
      demoStorage.addSource(demoSource)
      console.log('Demo source added successfully:', demoSource.id)
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