import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ensureUserSetup } from '../../../lib/user-setup'

export async function POST(request: NextRequest) {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Setting up user:', user.email)

    // Ensure user is properly set up in database
    const userSetup = await ensureUserSetup(user.id, user.email)

    return NextResponse.json({
      success: true,
      user: userSetup.user,
      organization: userSetup.organization,
      isNewUser: userSetup.isNewUser
    })

  } catch (error: any) {
    console.error('User setup error:', error)
    return NextResponse.json(
      { error: 'Failed to setup user', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user exists and return info
    const { getUserInfo } = await import('../../../lib/user-setup')
    const userInfo = await getUserInfo(user.id)

    if (!userInfo) {
      return NextResponse.json({ userExists: false })
    }

    return NextResponse.json({
      userExists: true,
      user: userInfo.user,
      organization: userInfo.organization
    })

  } catch (error: any) {
    console.error('Get user info error:', error)
    return NextResponse.json(
      { error: 'Failed to get user info', details: error.message },
      { status: 500 }
    )
  }
}