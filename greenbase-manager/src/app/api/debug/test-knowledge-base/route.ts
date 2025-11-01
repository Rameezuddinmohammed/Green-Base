import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Knowledge Base API components...')
    
    // Test 1: Supabase Admin Client
    console.log('1️⃣ Testing Supabase admin client...')
    let supabaseAdmin
    try {
      supabaseAdmin = await getSupabaseAdmin()
      console.log('✅ Supabase admin client initialized successfully')
    } catch (adminError: any) {
      console.error('❌ Supabase admin client failed:', adminError)
      return NextResponse.json({
        success: false,
        step: 'admin_client',
        error: adminError.message,
        stack: adminError.stack
      }, { status: 500 })
    }

    // Test 2: Database Connection
    console.log('2️⃣ Testing database connection...')
    try {
      const { data: testQuery, error: testError } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .limit(1)
      
      if (testError) {
        console.error('❌ Database connection failed:', testError)
        return NextResponse.json({
          success: false,
          step: 'database_connection',
          error: testError.message,
          details: testError
        }, { status: 500 })
      }
      
      console.log('✅ Database connection successful')
      console.log('Sample organization:', testQuery?.[0])
    } catch (dbError: any) {
      console.error('❌ Database test failed:', dbError)
      return NextResponse.json({
        success: false,
        step: 'database_test',
        error: dbError.message
      }, { status: 500 })
    }

    // Test 3: Users Table
    console.log('3️⃣ Testing users table...')
    try {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, email, organization_id, role')
        .limit(5)
      
      if (usersError) {
        console.error('❌ Users table query failed:', usersError)
        return NextResponse.json({
          success: false,
          step: 'users_table',
          error: usersError.message,
          details: usersError
        }, { status: 500 })
      }
      
      console.log('✅ Users table accessible')
      console.log(`Found ${users?.length || 0} users`)
    } catch (usersTestError: any) {
      console.error('❌ Users table test failed:', usersTestError)
      return NextResponse.json({
        success: false,
        step: 'users_table_test',
        error: usersTestError.message
      }, { status: 500 })
    }

    // Test 4: Approved Documents Table
    console.log('4️⃣ Testing approved_documents table...')
    try {
      const { data: documents, error: documentsError } = await supabaseAdmin
        .from('approved_documents')
        .select('id, title, organization_id, created_at')
        .limit(5)
      
      if (documentsError) {
        console.error('❌ Approved documents table query failed:', documentsError)
        return NextResponse.json({
          success: false,
          step: 'approved_documents_table',
          error: documentsError.message,
          details: documentsError
        }, { status: 500 })
      }
      
      console.log('✅ Approved documents table accessible')
      console.log(`Found ${documents?.length || 0} approved documents`)
    } catch (docsTestError: any) {
      console.error('❌ Approved documents table test failed:', docsTestError)
      return NextResponse.json({
        success: false,
        step: 'approved_documents_test',
        error: docsTestError.message
      }, { status: 500 })
    }

    // Test 5: Configuration
    console.log('5️⃣ Testing configuration...')
    try {
      const { getConfigService } = await import('@/lib/config')
      const configService = getConfigService()
      const config = await configService.getConfig()
      
      console.log('✅ Configuration loaded successfully')
      console.log('Supabase URL:', config.supabase.url)
      console.log('Has service role key:', !!config.supabase.serviceRoleKey)
    } catch (configError: any) {
      console.error('❌ Configuration test failed:', configError)
      return NextResponse.json({
        success: false,
        step: 'configuration',
        error: configError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'All Knowledge Base API components are working correctly',
      timestamp: new Date().toISOString(),
      tests: {
        admin_client: '✅ Pass',
        database_connection: '✅ Pass',
        users_table: '✅ Pass',
        approved_documents_table: '✅ Pass',
        configuration: '✅ Pass'
      }
    })

  } catch (error: any) {
    console.error('❌ Knowledge Base API test failed:', error)
    return NextResponse.json({
      success: false,
      step: 'unknown',
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}