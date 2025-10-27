import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin()
    
    // Create demo organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .upsert({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Demo Organization'
      }, { onConflict: 'id' })
      .select()
      .single()

    if (orgError && orgError.code !== '23505') { // Ignore duplicate key error
      console.error('Organization creation error:', orgError)
      throw orgError
    }

    // Create demo user in auth.users (this will be handled by Supabase Auth)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'manager@demo.com',
      password: 'demo123',
      email_confirm: true
    })

    if (authError && authError.message !== 'User already registered') {
      console.error('Auth user creation error:', authError)
      throw authError
    }

    const userId = authUser?.user?.id || '00000000-0000-0000-0000-000000000001'

    // Create user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        email: 'manager@demo.com',
        role: 'manager',
        organization_id: org?.id || '00000000-0000-0000-0000-000000000001'
      }, { onConflict: 'id' })
      .select()
      .single()

    if (profileError && profileError.code !== '23505') {
      console.error('Profile creation error:', profileError)
      throw profileError
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Demo user created successfully',
      user: {
        email: 'manager@demo.com',
        role: 'manager',
        organizationId: org?.id || '00000000-0000-0000-000000000001'
      }
    })
  } catch (error: any) {
    console.error('Setup demo error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to setup demo user', 
        details: error.message,
        code: error.code 
      },
      { status: 500 }
    )
  }
}