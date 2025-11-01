import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
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

    const supabaseAdmin = await getSupabaseAdmin()
    
    // Get user's organization
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('organization_id, role')
      .eq('id', session.user.id)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { documentId } = await params
    console.log('🔍 Looking for document:', documentId, 'for organization:', user.organization_id)

    // Get the specific document with user information
    const { data: document, error } = await supabaseAdmin
      .from('approved_documents')
      .select(`
        *,
        approver:users!approved_by(email)
      `)
      .eq('id', documentId)
      .eq('organization_id', user.organization_id)
      .single()

    console.log('📄 Document query result:', { document: !!document, error })

    if (error) {
      console.error('❌ Document fetch error:', error)
      if (error.code === 'PGRST116') {
        // Check if document exists at all
        const { data: anyDoc } = await supabaseAdmin
          .from('approved_documents')
          .select('id, organization_id')
          .eq('id', documentId)
          .single()
        
        console.log('🔍 Document exists check:', anyDoc)
        return NextResponse.json({ 
          error: 'Document not found', 
          debug: { 
            documentId, 
            userOrgId: user.organization_id,
            documentExists: !!anyDoc,
            documentOrgId: anyDoc?.organization_id
          } 
        }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ document })
  } catch (error: any) {
    console.error('Get document error:', error)
    return NextResponse.json(
      { error: 'Failed to get document', details: error.message },
      { status: 500 }
    )
  }
}