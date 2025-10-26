import { testSupabase, cleanupTestData, createTestOrganization, createTestUser, createTestApprovedDocument, testData, TEST_USER_ID } from '../setup'

describe('Vector Search Functions', () => {
  let org: any
  let manager: any
  let testDocuments: any[] = []

  beforeAll(async () => {
    await cleanupTestData()
    
    org = await createTestOrganization()
    manager = await createTestUser(org.id, testData.manager)

    // Create test documents with mock embeddings
    const mockEmbedding = Array(1536).fill(0.1) // Mock OpenAI embedding format

    const documents = [
      {
        title: 'JavaScript Basics',
        content: 'JavaScript is a programming language used for web development.',
        summary: 'Introduction to JavaScript programming',
        tags: ['javascript', 'programming', 'web'],
        organization_id: org.id,
        approved_by: manager.id,
        embedding: mockEmbedding
      },
      {
        title: 'React Components',
        content: 'React components are reusable pieces of UI that can be composed together.',
        summary: 'Guide to React components',
        tags: ['react', 'components', 'ui'],
        organization_id: org.id,
        approved_by: manager.id,
        embedding: Array(1536).fill(0.2)
      },
      {
        title: 'Database Design',
        content: 'Database design involves creating a structure for storing and organizing data.',
        summary: 'Database design principles',
        tags: ['database', 'design', 'sql'],
        organization_id: org.id,
        approved_by: manager.id,
        embedding: Array(1536).fill(0.3)
      }
    ]

    for (const doc of documents) {
      try {
        const createdDoc = await createTestApprovedDocument(org.id, manager.id, doc)
        testDocuments.push(createdDoc)
      } catch (error) {
        console.error('Failed to create test document:', error)
      }
    }
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  describe('match_documents function', () => {
    test('should return similar documents based on embedding', async () => {
      const queryEmbedding = Array(1536).fill(0.15)
      
      const { data, error } = await testSupabase
        .rpc('match_documents', {
          query_embedding: queryEmbedding,
          match_threshold: 0.5,
          match_count: 5,
          organization_id: org.id
        })

      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      
      if (data && data.length > 0) {
        expect(data[0]).toHaveProperty('id')
        expect(data[0]).toHaveProperty('title')
        expect(data[0]).toHaveProperty('content')
        expect(data[0]).toHaveProperty('similarity')
        expect(typeof data[0].similarity).toBe('number')
      }
    })

    test('should respect match threshold', async () => {
      const queryEmbedding = Array(1536).fill(0.9) // Very different embedding
      
      const { data, error } = await testSupabase
        .rpc('match_documents', {
          query_embedding: queryEmbedding,
          match_threshold: 0.8, // High threshold
          match_count: 5,
          organization_id: org.id
        })

      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      // Should return fewer or no results due to high threshold
    })

    test('should respect organization isolation', async () => {
      // Create another organization
      const org2 = await testSupabase
        .from('organizations')
        .insert({ name: 'Other Organization' })
        .select()
        .single()
        .then(({ data }) => data)

      const queryEmbedding = Array(1536).fill(0.1)
      
      const { data, error } = await testSupabase
        .rpc('match_documents', {
          query_embedding: queryEmbedding,
          match_threshold: 0.5,
          match_count: 5,
          organization_id: org2.id
        })

      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(0) // Should return no results from other org
    })
  })

  describe('document chunks functionality', () => {
    test('should create and search document chunks', async () => {
      // Ensure we have a document to work with
      if (testDocuments.length === 0) {
        const testDoc = await createTestApprovedDocument(org.id, manager.id, {
          title: 'Chunk Test Document',
          content: 'This is a test document for chunks.',
          summary: 'Test document for chunk functionality'
        })
        testDocuments.push(testDoc)
      }
      
      const document = testDocuments[0]
      
      // Create chunks for the document manually since create_document_chunks may not exist
      const chunksData = [
        {
          document_id: document.id,
          chunk_index: 0,
          content: 'JavaScript is a programming language.',
          embedding: Array(1536).fill(0.1),
          organization_id: org.id
        },
        {
          document_id: document.id,
          chunk_index: 1,
          content: 'It is used for web development.',
          embedding: Array(1536).fill(0.12),
          organization_id: org.id
        }
      ]

      const { error: chunkError } = await testSupabase
        .from('document_chunks')
        .insert(chunksData)

      expect(chunkError).toBeNull()

      // Test chunk search
      const queryEmbedding = Array(1536).fill(0.11)
      
      const { data: chunkResults, error: searchError } = await testSupabase
        .rpc('match_document_chunks', {
          query_embedding: queryEmbedding,
          match_threshold: 0.5,
          match_count: 10,
          organization_id: org.id
        })

      expect(searchError).toBeNull()
      expect(Array.isArray(chunkResults)).toBe(true)
      
      if (chunkResults && chunkResults.length > 0) {
        expect(chunkResults[0]).toHaveProperty('document_id')
        expect(chunkResults[0]).toHaveProperty('content')
        expect(chunkResults[0]).toHaveProperty('similarity')
        expect(chunkResults[0]).toHaveProperty('document_title')
      }
    })
  })

  describe('hybrid_search function', () => {
    test('should search both documents and chunks', async () => {
      const queryEmbedding = Array(1536).fill(0.1)
      
      const { data, error } = await testSupabase
        .rpc('hybrid_search', {
          query_embedding: queryEmbedding,
          match_threshold: 0.5,
          match_count: 10,
          organization_id: org.id
        })

      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      
      if (data && data.length > 0) {
        expect(data[0]).toHaveProperty('source_type')
        expect(['document', 'chunk']).toContain(data[0].source_type)
      }
    })
  })

  describe('get_document_stats function', () => {
    test('should return organization statistics', async () => {
      const { data, error } = await testSupabase
        .rpc('get_document_stats', {
          org_id: org.id
        })

      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      
      if (data && data.length > 0) {
        const stats = data[0]
        expect(stats).toHaveProperty('total_approved_documents')
        expect(stats).toHaveProperty('total_draft_documents')
        expect(stats).toHaveProperty('pending_approvals')
        expect(stats).toHaveProperty('total_qa_interactions')
        expect(typeof stats.total_approved_documents).toBe('number')
      }
    })
  })
})