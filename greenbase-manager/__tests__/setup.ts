// Test setup for database tests
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// Test database configuration
const supabaseUrl = process.env.SUPABASE_TEST_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_TEST_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing test database configuration')
}

// Create test client with service role for full access
export const testSupabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Test data helpers
export const testData = {
  organization: {
    name: 'Test Organization'
  },
  manager: {
    email: 'manager@test.com',
    role: 'manager' as const
  },
  employee: {
    email: 'employee@test.com', 
    role: 'employee' as const
  },
  draftDocument: {
    title: 'Test Document',
    content: 'This is test content for the document.',
    confidence_score: 0.85,
    triage_level: 'green' as const
  },
  approvedDocument: {
    title: 'Approved Test Document',
    content: 'This is approved test content.',
    summary: 'Test document summary',
    tags: ['test', 'document']
  }
}

// Cleanup helper
export async function cleanupTestData() {
  try {
    // Delete in reverse dependency order
    await testSupabase.from('qa_interactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('document_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('document_versions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('approved_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('source_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('draft_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('connected_sources').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('organizations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  } catch (error) {
    console.error('Error cleaning up test data:', error)
  }
}

// Create test organization and users
export async function createTestOrganization() {
  const { data: org, error: orgError } = await testSupabase
    .from('organizations')
    .insert(testData.organization)
    .select()
    .single()

  if (orgError) throw orgError
  return org
}

export async function createTestUser(organizationId: string, userData: typeof testData.manager | typeof testData.employee) {
  // Create auth user first (simulate)
  const userId = crypto.randomUUID()
  
  const { data: user, error: userError } = await testSupabase
    .from('users')
    .insert({
      id: userId,
      email: userData.email,
      role: userData.role,
      organization_id: organizationId
    })
    .select()
    .single()

  if (userError) throw userError
  return user
}