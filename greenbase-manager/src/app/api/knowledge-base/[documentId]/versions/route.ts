import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin'
import { getServerSession } from 'next-auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId } = await params

    const supabase = await getSupabaseAdmin()
    
    // Get user's organization
    const { data: user } = await supabase
      .from('users')
      .select('organization_id')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify document belongs to user's organization
    const { data: document } = await supabase
      .from('approved_documents')
      .select('organization_id')
      .eq('id', documentId)
      .eq('organization_id', user.organization_id)
      .single()

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Get document versions
    const { data: versions, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('version', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ versions })
  } catch (error: any) {
    console.error('Get document versions error:', error)
    return NextResponse.json(
      { error: 'Failed to get document versions', details: error.message },
      { status: 500 }
    )
  }
}