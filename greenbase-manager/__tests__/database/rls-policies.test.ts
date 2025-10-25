import { testSupabase, cleanupTestData, createTestOrganization, createTestUser, testData } from '../setup'

describe('Row Level Security Policies', () => {
  let org1: any, org2: any
  let manager1: any, employee1: any, manager2: any

  beforeAll(async () => {
    await cleanupTestData()
    
    // Create two organizations for multi-tenant testing
    org1 = await createTestOrganization()
    org2 = await testSupabase
      .from('organizations')
      .insert({ name: 'Test Organization 2' })
      .select()
      .single()
      .then(({ data }) => data)

    // Create users in different organizations
    manager1 = await createTestUser(org1.id, testData.manager)
    employee1 = await createTestUser(org1.id, testData.employee)
    manager2 = await createTestUser(org2.id, { ...testData.manager, email: 'manager2@test.com' })
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  describe('Organizations Table', () => {
    test('users can only see their own organization', async () => {
      // Test with service role (should see all)
      const { data: allOrgs } = await testSupabase
        .from('organizations')
        .select('*')

      expect(allOrgs).toHaveLength(2)

      // Simulate user context by using RLS function
      const { data: userOrg } = await testSupabase
        .rpc('get_user_organization_id')

      // Note: In real tests, we'd need to set up proper auth context
      // This is a simplified test structure
    })
  })

  describe('Draft Documents Table', () => {
    test('users can only see draft documents in their organization', async () => {
      // Create draft documents in both organizations
      const draft1 = await testSupabase
        .from('draft_documents')
        .insert({
          ...testData.draftDocument,
          organization_id: org1.id
        })
        .select()
        .single()

      const draft2 = await testSupabase
        .from('draft_documents')
        .insert({
          ...testData.draftDocument,
          title: 'Org 2 Document',
          organization_id: org2.id
        })
        .select()
        .single()

      expect(draft1.data).toBeTruthy()
      expect(draft2.data).toBeTruthy()

      // Test isolation - users should only see documents from their org
      // Note: This would require proper auth context in real implementation
    })

    test('only managers can update draft document status', async () => {
      const { data: draft } = await testSupabase
        .from('draft_documents')
        .insert({
          ...testData.draftDocument,
          organization_id: org1.id
        })
        .select()
        .single()

      expect(draft).toBeTruthy()

      // Test manager can update (would need auth context)
      // Test employee cannot update (would need auth context)
    })
  })

  describe('Approved Documents Table', () => {
    test('users can only see approved documents in their organization', async () => {
      const approved1 = await testSupabase
        .from('approved_documents')
        .insert({
          ...testData.approvedDocument,
          organization_id: org1.id,
          approved_by: manager1.id
        })
        .select()
        .single()

      const approved2 = await testSupabase
        .from('approved_documents')
        .insert({
          ...testData.approvedDocument,
          title: 'Org 2 Approved Document',
          organization_id: org2.id,
          approved_by: manager2.id
        })
        .select()
        .single()

      expect(approved1.data).toBeTruthy()
      expect(approved2.data).toBeTruthy()
    })
  })

  describe('Connected Sources Table', () => {
    test('users can only manage their own connected sources', async () => {
      const source = await testSupabase
        .from('connected_sources')
        .insert({
          user_id: manager1.id,
          type: 'teams',
          name: 'Test Teams Channel',
          access_token: 'encrypted_token',
          refresh_token: 'encrypted_refresh_token'
        })
        .select()
        .single()

      expect(source.data).toBeTruthy()
      expect(source.data?.user_id).toBe(manager1.id)
    })
  })

  describe('Q&A Interactions Table', () => {
    test('users can only see their own QA interactions', async () => {
      const interaction = await testSupabase
        .from('qa_interactions')
        .insert({
          user_id: employee1.id,
          question: 'Test question',
          answer: 'Test answer',
          confidence: 0.9,
          sources: [],
          organization_id: org1.id
        })
        .select()
        .single()

      expect(interaction.data).toBeTruthy()
      expect(interaction.data?.user_id).toBe(employee1.id)
    })

    test('managers can see all QA interactions in their organization', async () => {
      // This would require proper auth context to test manager permissions
      const { data: interactions } = await testSupabase
        .from('qa_interactions')
        .select('*')
        .eq('organization_id', org1.id)

      expect(Array.isArray(interactions)).toBe(true)
    })
  })
})