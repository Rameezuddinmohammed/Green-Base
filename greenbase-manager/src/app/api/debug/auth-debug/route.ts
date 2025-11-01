import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    
    // Check client-side auth
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

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    // Check admin access
    const supabaseAdmin = await getSupabaseAdmin()
    
    let userProfile = null
    let userProfileError = null
    
    if (user) {
      try {
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()
        
        userProfile = profile
        userProfileError = profileError
        
        // Also try by email
        if (!profile && user.email) {
          const { data: profileByEmail, error: profileByEmailError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', user.email)
            .single()
          
          userProfile = profileByEmail
          userProfileError = profileByEmailError
        }
      } catch (error: any) {
        userProfileError = error
      }
    }

    // Get all cookies
    const allCookies = cookieStore.getAll()
    const supabaseCookies = allCookies.filter(c => c.name.includes('supabase'))

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      session: {
        exists: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
        expiresAt: session?.expires_at,
        error: sessionError?.message
      },
      user: {
        exists: !!user,
        userId: user?.id,
        email: user?.email,
        emailConfirmed: user?.email_confirmed_at,
        error: userError?.message
      },
      profile: {
        exists: !!userProfile,
        data: userProfile,
        error: userProfileError?.message
      },
      cookies: {
        total: allCookies.length,
        supabase: supabaseCookies.length,
        supabaseCookieNames: supabaseCookies.map(c => c.name),
        allCookieNames: allCookies.map(c => c.name)
      },
      environment: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing',
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing'
      }
    })
  } catch (error: any) {
    console.error('Auth debug error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to debug auth', 
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    )
  }
}