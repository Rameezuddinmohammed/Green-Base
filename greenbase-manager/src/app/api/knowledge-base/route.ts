import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.id) {
      // For testing without authentication, return empty documents
      console.log('No session found, returning empty documents for demo')
      return NextResponse.json({ documents: [] })
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

    // Get approved documents for the organization
    const { data: documents, error } = await supabaseAdmin
      .from('approved_documents')
      .select('*')
      .eq('organization_id', user.organization_id)
      .order('updated_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ documents })
  } catch (error: any) {
    console.error('Get knowledge base documents error:', error)
    return NextResponse.json(
      { error: 'Failed to get knowledge base documents', details: error.message },
      { status: 500 }
    )
  }
}

