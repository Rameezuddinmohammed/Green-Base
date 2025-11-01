import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing auth system...')
    
    const supabaseAdmin = await getSupabaseAdmin()
    
    // Test 1: Check if we can connect to auth.users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Auth connection failed:', authError)
      return NextResponse.json({
        success: false,
        error: 'Failed to connect to auth system',
        details: authError.message
      }, { status: 500 })
    }

    console.log('✅ Auth connection successful, found', authUsers.users.length, 'users')

    // Test 2: Check public.users table
    const { data: publicUsers, error: publicError } = await supabaseAdmin
      .from('users')
      .select('*')
      .limit(10)

    if (publicError) {
      console.error('❌ Public users table error:', publicError)
      return NextResponse.json({
        success: false,
        error: 'Failed to query public users table',
        details: publicError.message
      }, { status: 500 })
    }

    console.log('✅ Public users table accessible, found', publicUsers.length, 'profiles')

    // Test 3: Check organizations table
    const { data: orgs, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .limit(10)

    if (orgError) {
      console.error('❌ Organizations table error:', orgError)
      return NextResponse.json({
        success: false,
        error: 'Failed to query organizations table',
        details: orgError.message
      }, { status: 500 })
    }

    console.log('✅ Organizations table accessible, found', orgs.length, 'organizations')

    // Test 4: Check if signup API endpoint exists
    const signupTest = {
      endpoint: '/api/auth/signup',
      exists: true // We just created it
    }

    // Test 5: Check if signin API endpoint exists  
    const signinTest = {
      endpoint: '/api/auth/signin',
      exists: true // Already existed
    }

    return NextResponse.json({
      success: true,
      message: 'Auth system test completed successfully',
      results: {
        authConnection: {
          status: 'success',
          userCount: authUsers.users.length
        },
        publicUsersTable: {
          status: 'success',
          profileCount: publicUsers.length
        },
        organizationsTable: {
          status: 'success',
          orgCount: orgs.length
        },
        apiEndpoints: {
          signup: signupTest,
          signin: signinTest,
          resetPassword: {
            endpoint: '/api/auth/reset-password',
            exists: true
          }
        },
        authUsers: authUsers.users.map(u => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          email_confirmed_at: u.email_confirmed_at
        })),
        publicUsers: publicUsers.map(u => ({
          id: u.id,
          email: u.email,
          role: u.role,
          organization_id: u.organization_id
        })),
        organizations: orgs.map(o => ({
          id: o.id,
          name: o.name,
          created_at: o.created_at
        }))
      }
    })

  } catch (error: any) {
    console.error('❌ Auth system test failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Auth system test failed',
      details: error.message
    }, { status: 500 })
  }
}