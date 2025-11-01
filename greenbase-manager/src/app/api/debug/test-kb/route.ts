import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin()
    
    console.log('🔍 Testing knowledge base data...')
    
    // Get all approved documents without any filters
    const { data: allApproved, error: allError } = await supabaseAdmin
      .from('approved_documents')
      .select('*')
      .order('created_at', { ascending: false })

    console.log('📊 All approved documents:', allApproved?.length || 0)
    if (allError) {
      console.error('❌ Error fetching all approved:', allError)
    }

    // Get all users
    const { data: allUsers, error: usersError } = await supabaseAdmin
      .from('users')
      .select('*')

    console.log('👥 All users:', allUsers?.length || 0)
    if (usersError) {
      console.error('❌ Error fetching users:', usersError)
    }

    // Get all organizations
    const { data: allOrgs, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select('*')

    console.log('🏢 All organizations:', allOrgs?.length || 0)
    if (orgsError) {
      console.error('❌ Error fetching organizations:', orgsError)
    }

    return NextResponse.json({
      success: true,
      data: {
        approved_documents: {
          count: allApproved?.length || 0,
          documents: allApproved || []
        },
        users: {
          count: allUsers?.length || 0,
          users: allUsers || []
        },
        organizations: {
          count: allOrgs?.length || 0,
          organizations: allOrgs || []
        }
      }
    })
  } catch (error: any) {
    console.error('❌ Test KB error:', error)
    return NextResponse.json(
      { error: 'Failed to test KB', details: error.message },
      { status: 500 }
    )
  }
}