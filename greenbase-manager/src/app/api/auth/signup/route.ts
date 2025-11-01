import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const { email, password, organizationName } = await request.json()
    
    console.log('Server-side sign-up attempt for:', email)
    
    // Validate input
    if (!email || !password || !organizationName) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email, password, and organization name are required' 
      }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ 
        success: false, 
        error: 'Password must be at least 6 characters long' 
      }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Please enter a valid email address' 
      }, { status: 400 })
    }

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
    
    // Create the auth user with auto-confirmation
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/callback`,
        data: {
          email_confirm: true // Skip email confirmation
        }
      }
    })
    
    if (authError) {
      console.error('Auth sign-up error:', authError)
      return NextResponse.json({ 
        success: false, 
        error: authError.message 
      }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create user account' 
      }, { status: 400 })
    }

    console.log('Auth user created:', authData.user.id, authData.user.email)

    // Use admin client to create organization and user profile
    const supabaseAdmin = await getSupabaseAdmin()
    
    // Create organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: organizationName
      })
      .select()
      .single()

    if (orgError) {
      console.error('Organization creation error:', orgError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create organization: ' + orgError.message 
      }, { status: 500 })
    }

    console.log('Organization created:', org.id, org.name)

    // Create user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: authData.user.email!,
        role: 'manager', // First user in organization is manager
        organization_id: org.id
      })
      .select()
      .single()

    if (profileError) {
      console.error('Profile creation error:', profileError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create user profile: ' + profileError.message 
      }, { status: 500 })
    }

    console.log('User profile created:', profile.id, profile.email, profile.role)

    // Always auto-confirm users and sign them in immediately
    try {
      // Use admin client to ensure the user is confirmed
      const { data: confirmedUser, error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
        authData.user.id,
        { 
          email_confirm: true
        }
      )
      
      if (confirmError) {
        console.error('Failed to auto-confirm user:', confirmError)
      } else {
        console.log('User auto-confirmed')
      }

      // Sign them in immediately after signup
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (!signInError && signInData.session) {
        console.log('User auto-signed in after signup')
        return NextResponse.json({ 
          success: true, 
          userId: authData.user.id,
          email: authData.user.email,
          confirmed: true,
          autoSignedIn: true,
          organization: org.name,
          message: 'Account created and signed in successfully!'
        })
      } else {
        console.error('Auto sign-in failed:', signInError)
      }
    } catch (error) {
      console.error('Auto-confirmation/signin failed:', error)
    }

    // Fallback: account created but user needs to sign in manually
    return NextResponse.json({ 
      success: true, 
      userId: authData.user.id,
      email: authData.user.email,
      confirmed: true,
      autoSignedIn: false,
      message: 'Account created successfully! Please sign in to continue.',
      organization: org.name
    })
    
  } catch (error: any) {
    console.error('Server sign-up error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}