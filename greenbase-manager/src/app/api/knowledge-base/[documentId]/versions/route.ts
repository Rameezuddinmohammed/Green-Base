import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
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
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId } = await params

    const supabaseAdmin = await getSupabaseAdmin()
    
    // Get user's organization
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', session.user.id)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify document belongs to user's organization
    const { data: document } = await supabaseAdmin
      .from('approved_documents')
      .select('organization_id')
      .eq('id', documentId)
      .eq('organization_id', user.organization_id)
      .single()

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Get document versions with user information
    const { data: versions, error } = await supabaseAdmin
      .from('document_versions')
      .select(`
        *,
        approver:users!approved_by(email)
      `)
      .eq('document_id', documentId)
      .order('version', { ascending: false })

    if (error) {
      throw error
    }

    // Format versions for display
    const formattedVersions = versions?.map(version => ({
      ...version,
      approved_by: version.approver?.email || version.approved_by
    })) || []

    return NextResponse.json({ versions: formattedVersions })
  } catch (error: any) {
    console.error('Get document versions error:', error)
    return NextResponse.json(
      { error: 'Failed to get document versions', details: error.message },
      { status: 500 }
    )
  }
}