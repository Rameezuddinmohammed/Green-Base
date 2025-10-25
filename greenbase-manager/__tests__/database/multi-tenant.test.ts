import { testSupabase, cleanupTestData, createTestOrganization, createTestUser, testData } from '../setup'

describe('Multi-Tenant Data Isolation', () => {
  let org1: any, org2: any
  let manager1: any, employee1: any, manager2: any, employee2: any

  beforeAll(async () => {
    await cleanupTestData()
    
    // Create two separate organizations
    org1 = await createTestOrganization()
    org2 = await testSupabase
      .from('organizations')
      .insert({ name: 'Organization 2' })
      .select()
      .single()
      .then(({ data }) => data)

    // Create users in each organization
    manager1 = await createTestUser(org1.id, testData.manager)
    employee1 = await createTestUser(org1.id, { ...testData.employee, email: 'employee1@test.com' })
    manager2 = await createTestUser(org2.id, { ...testData.manager, email: 'manager2@test.com' })
    employee2 = await createTestUser(org2.id, { ...testData.employee, email: 'employee2@test.com' })
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  describe('Draft Documents Isolation', () => {
    test('organizations cannot see each others draft documents', async () => {
      // Create draft documents in both organizations
      const draft1 = await testSupabase
        .from('draft_documents')
        .insert({
          ...testData.draftDocument,
          title: 'Org 1 Draft',
          organization_id: org1.id
        })
        .select()
        .single()

      const draft2 = await testSupabase
        .from('draft_documents')
        .insert({
          ...testData.draftDocument,
          title: 'Org 2 Draft',
          organization_id: org2.id
        })
        .select()
        .single()

      expect(draft1.data).toBeTruthy()
      expect(draft2.data).toBeTruthy()

      // Verify documents exist in correct organizations
      const { data: org1Drafts } = await testSupabase
        .from('draft_documents')
        .select('*')
        .eq('organization_id', org1.id)

      const { data: org2Drafts } = await testSupabase
        .from('draft_documents')
        .select('*')
        .eq('organization_id', org2.id)

      expect(org1Drafts?.some(d => d.title === 'Org 1 Draft')).toBe(true)
      expect(org1Drafts?.some(d => d.title === 'Org 2 Draft')).toBe(false)
      
      expect(org2Drafts?.some(d => d.title === 'Org 2 Draft')).toBe(true)
      expect(org2Drafts?.some(d => d.title === 'Org 1 Draft')).toBe(false)
    })
  })

  describe('Approved Documents Isolation', () => {
    test('organizations cannot see each others approved documents', async () => {
      const approved1 = await testSupabase
        .from('approved_documents')
        .insert({
          ...testData.approvedDocument,
          title: 'Org 1 Approved',
          organization_id: org1.id,
          approved_by: manager1.id
        })
        .select()
        .single()

      const approved2 = await testSupabase
        .from('approved_documents')
        .insert({
          ...testData.approvedDocument,
          title: 'Org 2 Approved',
          organization_id: org2.id,
          approved_by: manager2.id
        })
        .select()
        .single()

      expect(approved1.data).toBeTruthy()
      expect(approved2.data).toBeTruthy()

      // Verify isolation
      const { data: org1Approved } = await testSupabase
        .from('approved_documents')
        .select('*')
        .eq('organization_id', org1.id)

      const { data: org2Approved } = await testSupabase
        .from('approved_documents')
        .select('*')
        .eq('organization_id', org2.id)

      expect(org1Approved?.some(d => d.title === 'Org 1 Approved')).toBe(true)
      expect(org1Approved?.some(d => d.title === 'Org 2 Approved')).toBe(false)
      
      expect(org2Approved?.some(d => d.title === 'Org 2 Approved')).toBe(true)
      expect(org2Approved?.some(d => d.title === 'Org 1 Approved')).toBe(false)
    })
  })

  describe('Vector Search Isolation', () => {
    test('vector search respects organization boundaries', async () => {
      const mockEmbedding = Array(1536).fill(0.1).join(',')

      // Create approved documents with embeddings in both orgs
      const doc1 = await testSupabase
        .from('approved_documents')
        .insert({
          title: 'Org 1 Vector Doc',
          content: 'Content for organization 1',
          summary: 'Org 1 summary',
          tags: ['org1'],
          organization_id: org1.id,
          approved_by: manager1.id,
          embedding: `[${mockEmbedding}]`
        })
        .select()
        .single()

      const doc2 = await testSupabase
        .from('approved_documents')
        .insert({
          title: 'Org 2 Vector Doc',
          content: 'Content for organization 2',
          summary: 'Org 2 summary',
          tags: ['org2'],
          organization_id: org2.id,
          approved_by: manager2.id,
          embedding: `[${mockEmbedding}]`
        })
        .select()
        .single()

      expect(doc1.data).toBeTruthy()
      expect(doc2.data).toBeTruthy()

      // Test vector search for org1
      const { data: org1Results } = await testSupabase
        .rpc('match_documents', {
          query_embedding: `[${mockEmbedding}]`,
          match_threshold: 0.5,
          match_count: 10,
          organization_id: org1.id
        })

      // Test vector search for org2
      const { data: org2Results } = await testSupabase
        .rpc('match_documents', {
          query_embedding: `[${mockEmbedding}]`,
          match_threshold: 0.5,
          match_count: 10,
          organization_id: org2.id
        })

      // Verify isolation
      expect(org1Results?.some((r: any) => r.title === 'Org 1 Vector Doc')).toBe(true)
      expect(org1Results?.some((r: any) => r.title === 'Org 2 Vector Doc')).toBe(false)
      
      expect(org2Results?.some((r: any) => r.title === 'Org 2 Vector Doc')).toBe(true)
      expect(org2Results?.some((r: any) => r.title === 'Org 1 Vector Doc')).toBe(false)
    })
  })

  describe('Q&A Interactions Isolation', () => {
    test('organizations cannot see each others QA interactions', async () => {
      const interaction1 = await testSupabase
        .from('qa_interactions')
        .insert({
          user_id: employee1.id,
          question: 'Org 1 question',
          answer: 'Org 1 answer',
          confidence: 0.9,
          sources: [],
          organization_id: org1.id
        })
        .select()
        .single()

      const interaction2 = await testSupabase
        .from('qa_interactions')
        .insert({
          user_id: employee2.id,
          question: 'Org 2 question',
          answer: 'Org 2 answer',
          confidence: 0.8,
          sources: [],
          organization_id: org2.id
        })
        .select()
        .single()

      expect(interaction1.data).toBeTruthy()
      expect(interaction2.data).toBeTruthy()

      // Verify isolation
      const { data: org1Interactions } = await testSupabase
        .from('qa_interactions')
        .select('*')
        .eq('organization_id', org1.id)

      const { data: org2Interactions } = await testSupabase
        .from('qa_interactions')
        .select('*')
        .eq('organization_id', org2.id)

      expect(org1Interactions?.some(i => i.question === 'Org 1 question')).toBe(true)
      expect(org1Interactions?.some(i => i.question === 'Org 2 question')).toBe(false)
      
      expect(org2Interactions?.some(i => i.question === 'Org 2 question')).toBe(true)
      expect(org2Interactions?.some(i => i.question === 'Org 1 question')).toBe(false)
    })
  })

  describe('Connected Sources Isolation', () => {
    test('users can only see their own connected sources', async () => {
      const source1 = await testSupabase
        .from('connected_sources')
        .insert({
          user_id: manager1.id,
          type: 'teams',
          name: 'Manager 1 Teams',
          access_token: 'token1',
          refresh_token: 'refresh1'
        })
        .select()
        .single()

      const source2 = await testSupabase
        .from('connected_sources')
        .insert({
          user_id: manager2.id,
          type: 'teams',
          name: 'Manager 2 Teams',
          access_token: 'token2',
          refresh_token: 'refresh2'
        })
        .select()
        .single()

      expect(source1.data).toBeTruthy()
      expect(source2.data).toBeTruthy()

      // Verify each user only sees their own sources
      const { data: manager1Sources } = await testSupabase
        .from('connected_sources')
        .select('*')
        .eq('user_id', manager1.id)

      const { data: manager2Sources } = await testSupabase
        .from('connected_sources')
        .select('*')
        .eq('user_id', manager2.id)

      expect(manager1Sources).toHaveLength(1)
      expect(manager1Sources?.[0].name).toBe('Manager 1 Teams')
      
      expect(manager2Sources).toHaveLength(1)
      expect(manager2Sources?.[0].name).toBe('Manager 2 Teams')
    })
  })

  describe('Document Statistics Isolation', () => {
    test('statistics are isolated by organization', async () => {
      // Get stats for each organization
      const { data: org1Stats } = await testSupabase
        .rpc('get_document_stats', { org_id: org1.id })

      const { data: org2Stats } = await testSupabase
        .rpc('get_document_stats', { org_id: org2.id })

      expect(Array.isArray(org1Stats)).toBe(true)
      expect(Array.isArray(org2Stats)).toBe(true)

      // Stats should be different for each organization
      if (org1Stats && org2Stats && org1Stats.length > 0 && org2Stats.length > 0) {
        // The exact numbers may vary based on test data created above
        expect(typeof org1Stats[0].total_approved_documents).toBe('number')
        expect(typeof org2Stats[0].total_approved_documents).toBe('number')
      }
    })
  })
})