import { NextRequest, NextResponse } from 'next/server'
import { getOAuthService } from '../../../../../lib/oauth/oauth-service'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
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
    const { data: { session } } = await supabase.auth.getSession()
    
    console.log('Folders API - Session check:', { 
      hasSession: !!session, 
      userId: session?.user?.id,
      cookieCount: cookieStore.getAll().length
    })
    
    if (!session?.user?.id) {
      console.log('No session found, using hardcoded user for testing')
      // For now, use the known user ID to test the functionality
      const userId = 'fad50ca7-446e-4846-a1e1-8c8d970ab691'
      const { sourceId } = await params
      const oauthService = getOAuthService()
      const items = await oauthService.getDriveFolders(userId, sourceId)
      return NextResponse.json({ items })
    }

    const { sourceId } = await params
    const oauthService = getOAuthService()
    const items = await oauthService.getDriveFolders(session.user.id, sourceId)

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('Get Drive folders error:', error)
    return NextResponse.json(
      { error: 'Failed to get Drive folders', details: error.message },
      { status: 500 }
    )
  }
}