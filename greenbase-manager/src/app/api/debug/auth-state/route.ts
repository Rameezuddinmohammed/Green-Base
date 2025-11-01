import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking auth state...')
    
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
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    // Get all cookies
    const allCookies = cookieStore.getAll()
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('supabase') || 
      cookie.name.includes('sb-') ||
      cookie.name.includes('auth')
    )
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      session: {
        exists: !!session,
        userId: session?.user?.id || null,
        email: session?.user?.email || null,
        expiresAt: session?.expires_at || null,
        error: sessionError?.message || null
      },
      user: {
        exists: !!user,
        userId: user?.id || null,
        email: user?.email || null,
        error: userError?.message || null
      },
      cookies: {
        total: allCookies.length,
        authCookies: authCookies.map(c => ({
          name: c.name,
          hasValue: !!c.value,
          valueLength: c.value?.length || 0
        }))
      }
    })
    
  } catch (error: any) {
    console.error('❌ Auth state check failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}