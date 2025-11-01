import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password, organizationName } = await request.json()
    
    console.log('🧪 Testing signup flow for:', email)
    
    // Test the signup API
    const signupResponse = await fetch(`${request.nextUrl.origin}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, organizationName }),
    })
    
    const signupResult = await signupResponse.json()
    
    console.log('📝 Signup result:', signupResult)
    
    if (!signupResponse.ok || !signupResult.success) {
      return NextResponse.json({
        success: false,
        step: 'signup',
        error: signupResult.error || 'Signup failed',
        details: signupResult
      }, { status: 400 })
    }
    
    // If auto-signed in, test auth state
    if (signupResult.autoSignedIn) {
      console.log('✅ User was auto-signed in')
      return NextResponse.json({
        success: true,
        message: 'Signup flow completed successfully with auto-signin',
        result: signupResult,
        flow: 'auto-signin'
      })
    }
    
    // If not auto-signed in, test manual signin
    console.log('🔄 Testing manual signin...')
    
    const signinResponse = await fetch(`${request.nextUrl.origin}/api/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })
    
    const signinResult = await signinResponse.json()
    
    console.log('🔑 Signin result:', signinResult)
    
    if (!signinResponse.ok || !signinResult.success) {
      return NextResponse.json({
        success: false,
        step: 'signin',
        error: signinResult.error || 'Signin failed after signup',
        signupResult,
        signinResult
      }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Signup flow completed successfully with manual signin',
      signupResult,
      signinResult,
      flow: 'manual-signin'
    })
    
  } catch (error: any) {
    console.error('❌ Signup flow test failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Test failed',
      step: 'unknown'
    }, { status: 500 })
  }
}