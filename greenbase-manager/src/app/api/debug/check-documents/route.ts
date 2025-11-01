import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin()
    
    // Get all draft documents
    const { data: drafts, error: draftsError } = await supabaseAdmin
      .from('draft_documents')
      .select('*')
      .order('created_at', { ascending: false })

    // Get all approved documents
    const { data: approved, error: approvedError } = await supabaseAdmin
      .from('approved_documents')
      .select('*')
      .order('created_at', { ascending: false })

    // Get all users
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('*')

    // Get all organizations
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select('*')

    if (draftsError || approvedError || usersError || orgsError) {
      throw draftsError || approvedError || usersError || orgsError
    }

    return NextResponse.json({
      drafts: {
        count: drafts?.length || 0,
        documents: drafts || []
      },
      approved: {
        count: approved?.length || 0,
        documents: approved || []
      },
      users: users || [],
      organizations: orgs || []
    })
  } catch (error: any) {
    console.error('Debug check documents error:', error)
    return NextResponse.json(
      { error: 'Failed to check documents', details: error.message },
      { status: 500 }
    )
  }
}