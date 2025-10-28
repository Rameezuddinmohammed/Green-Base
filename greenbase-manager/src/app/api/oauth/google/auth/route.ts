import { NextRequest, NextResponse } from 'next/server'
import { getGoogleDriveService } from '../../../../../lib/oauth/google-drive'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    console.log('Google OAuth auth route called')
    
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )
    
    // Get session using the same pattern as other API routes
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    console.log('Session check:', { 
      hasSession: !!session, 
      userId: session?.user?.id, 
      email: session?.user?.email,
      error: sessionError,
      cookieCount: cookieStore.getAll().length
    })
    
    if (!session?.user?.id) {
      console.log('No valid session found, redirecting to sign-in')
      return NextResponse.redirect(
        new URL('/auth/signin?error=Please sign in to connect Google Drive&redirectTo=/dashboard/sources', request.url)
      )
    }

    console.log('Session valid, generating Google auth URL for user:', session.user.id)
    const googleService = getGoogleDriveService()
    const authUrl = await googleService.getAuthUrl(session.user.id)
    
    console.log('Redirecting to Google OAuth URL')
    return NextResponse.redirect(authUrl)
  } catch (error: any) {
    console.error('Google OAuth auth error:', error)
    return NextResponse.redirect(
      new URL(`/dashboard/sources?error=${encodeURIComponent('Failed to initiate Google OAuth')}`, request.url)
    )
  }
}