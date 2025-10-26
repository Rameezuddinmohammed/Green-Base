import { NextRequest, NextResponse } from 'next/server'
import { getOAuthService } from '../../../../lib/oauth/oauth-service'
import { getServerSession } from 'next-auth'

export async function GET(request: NextRequest) {
  try {
    // For testing purposes, use a dummy user ID
    // In production, this should get the user ID from the session
    const testUserId = 'test-user-123'

    const oauthService = getOAuthService()
    const authUrl = await oauthService.getAuthUrl('google', testUserId)

    return NextResponse.json({ authUrl })
  } catch (error: any) {
    console.error('Google OAuth initiation error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate Google OAuth', details: error.message },
      { status: 500 }
    )
  }
}

