import { NextRequest, NextResponse } from 'next/server'
import { getConfigService } from '../../../../lib/config'
import { getKeyVaultService } from '../../../../lib/azure-keyvault'

export async function GET(request: NextRequest) {
  try {
    console.log('🔧 Testing configuration service...')
    
    // Test environment variables
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      AZURE_KEY_VAULT_URL: !!process.env.AZURE_KEY_VAULT_URL,
      AZURE_CLIENT_ID: !!process.env.AZURE_CLIENT_ID,
      AZURE_CLIENT_SECRET: !!process.env.AZURE_CLIENT_SECRET,
      AZURE_TENANT_ID: !!process.env.AZURE_TENANT_ID,
      NODE_ENV: process.env.NODE_ENV
    }
    
    console.log('Environment variables check:', envCheck)
    
    // Test Key Vault service
    let keyVaultTest = null
    try {
      const keyVaultService = getKeyVaultService()
      // Try to get a test secret (this will fail gracefully if not configured)
      const testSecret = await keyVaultService.getSecret('test-secret')
      keyVaultTest = {
        initialized: true,
        testSecretExists: !!testSecret,
        error: null
      }
    } catch (error: any) {
      keyVaultTest = {
        initialized: false,
        testSecretExists: false,
        error: error.message
      }
    }
    
    console.log('Key Vault test:', keyVaultTest)
    
    // Test config service
    let configTest = null
    try {
      const configService = getConfigService()
      const config = await configService.getConfig()
      
      configTest = {
        success: true,
        hasSupabaseUrl: !!config.supabase.url,
        hasSupabaseAnonKey: !!config.supabase.anonKey,
        hasSupabaseServiceKey: !!config.supabase.serviceRoleKey,
        supabaseServiceKeySource: process.env.NODE_ENV === 'production' ? 'Key Vault' : 'Environment',
        error: null
      }
      
      // Validate config
      configService.validateConfig(config)
      configTest.validationPassed = true
      
    } catch (error: any) {
      configTest = {
        success: false,
        error: error.message,
        stack: error.stack,
        validationPassed: false
      }
    }
    
    console.log('Config test:', configTest)

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: envCheck,
      keyVault: keyVaultTest,
      config: configTest
    })
  } catch (error: any) {
    console.error('Config test error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to test configuration', 
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    )
  }
}