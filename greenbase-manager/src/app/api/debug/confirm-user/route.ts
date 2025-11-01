import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ 
        success: false, 
        error: 'This endpoint is only available in development mode' 
      }, { status: 403 })
    }

    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email is required' 
      }, { status: 400 })
    }

    console.log('🔧 Development: Manually confirming user:', email)
    
    const supabaseAdmin = await getSupabaseAdmin()
    
    // Find the user by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error('Failed to list users:', listError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to find user: ' + listError.message 
      }, { status: 500 })
    }

    const user = users.users.find(u => u.email === email)
    
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found with email: ' + email 
      }, { status: 404 })
    }

    // Confirm the user's email
    const { data: confirmedUser, error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { 
        email_confirm: true
      }
    )
    
    if (confirmError) {
      console.error('Failed to confirm user:', confirmError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to confirm user: ' + confirmError.message 
      }, { status: 500 })
    }

    console.log('✅ User confirmed successfully:', email)

    return NextResponse.json({ 
      success: true, 
      message: 'User email confirmed successfully',
      userId: user.id,
      email: user.email,
      confirmedAt: confirmedUser.user.email_confirmed_at
    })
    
  } catch (error: any) {
    console.error('❌ Manual user confirmation failed:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}