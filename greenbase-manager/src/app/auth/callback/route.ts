import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ensureUserSetup } from '../../../lib/user-setup'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  console.log('Auth callback called:', { hasCode: !!code, next })

  // Handle OAuth callback with code
  if (code) {
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

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      console.log('OAuth session established successfully')
      
      // Ensure user is set up in database after successful auth
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) {
          console.log('Setting up user after auth:', user.email)
          await ensureUserSetup(user.id, user.email)
        }
      } catch (setupError) {
        console.error('User setup failed after auth:', setupError)
        // Continue anyway - user setup will be retried in dashboard
      }
      
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('OAuth session error:', error)
  } else {
    // Handle direct callback (from sign-in page)
    console.log('Direct callback - establishing session from existing auth')
    
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

    // Try to get the current session and refresh it
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (session && !error) {
      console.log('Session refreshed successfully')
      
      // Ensure user is set up in database
      try {
        if (session.user?.email) {
          console.log('Setting up user after session refresh:', session.user.email)
          await ensureUserSetup(session.user.id, session.user.email)
        }
      } catch (setupError) {
        console.error('User setup failed after session refresh:', setupError)
        // Continue anyway - user setup will be retried in dashboard
      }
      
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    console.log('No session found in callback')
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/signin?error=Could not authenticate user`)
}