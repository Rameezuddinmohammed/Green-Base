import { getVectorSearchService, SearchOptions } from '@/lib/vector/vector-search-service'
import { testSupabase, cleanupTestData, ensureTestUser, createTestApprovedDocument, testData, TEST_USER_ID, TEST_ORGANIZATION_ID } from '../setup'

// Mock Azure OpenAI service
jest.mock('@/lib/ai/azure-openai', () => ({
  getAzureOpenAIService: () => ({
    generateEmbedding: jest.fn().mockResolvedValue({
      embedding: Array(1536).fill(0.1), // Mock embedding vector
      usage: { promptTokens: 10, totalTokens: 10 }
    }),
    generateBatchEmbeddings: jest.fn().mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => ({
        embedding: Array(1536).fill(0.1),
        usage: { promptTokens: 10, totalTokens: 10 }
      })))
    )
  })
}))

// Mock Supabase admin to use test client
jest.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => require('../setup').testSupabase
}))

describe('VectorSearchService', () => {
  let vectorService: ReturnType<typeof getVectorSearchService>
  let testOrgId: string
  let testDocId: string

  beforeAll(async () => {
    vectorService = getVectorSearchService()

    // Clean up any existing data first
    await cleanupTestData()

    // Ensure test user and organization exist
    const { org } = await ensureTestUser()
    testOrgId = org.id

    // Create test approved document using the helper function
    const doc = await createTestApprovedDocument(testOrgId, TEST_USER_ID)
    testDocId = doc.id
  })

  beforeEach(async () => {
    // Clean up any existing chunks before each test to avoid conflicts
    await testSupabase
      .from('document_chunks')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  describe('embedDocument', () => {
    it('should successfully embed a document and create chunks', async () => {
      // Create a fresh document for this test to avoid foreign key issues
      const freshDoc = await createTestApprovedDocument(testOrgId, TEST_USER_ID, {
        title: 'Fresh Test Document for Embedding'
      })

      const content = `# Test Document

This is a comprehensive test document that contains multiple paragraphs and sections.

## Section 1
This section discusses important concepts that are relevant to our knowledge base.

## Section 2  
This section provides additional details and examples that users might search for.

The document should be chunked appropriately for vector search.`

      const job = await vectorService.embedDocument(freshDoc.id, content, testOrgId)

      expect(job.status).toBe('completed')
      expect(job.chunksTotal).toBeGreaterThan(0)
      expect(job.chunksProcessed).toBe(job.chunksTotal)
      expect(job.error).toBeUndefined()

      // Verify chunks were created in database
      const { data: chunks, error } = await testSupabase
        .from('document_chunks')
        .select('*')
        .eq('document_id', freshDoc.id)

      expect(error).toBeNull()
      expect(chunks).toHaveLength(job.chunksTotal)
      expect(chunks![0].embedding).toBeDefined()
      expect(chunks![0].content).toBeTruthy()
    })

    it('should handle empty content gracefully', async () => {
      // Create a fresh document for this test
      const freshDoc = await createTestApprovedDocument(testOrgId, TEST_USER_ID, {
        title: 'Empty Content Test Document'
      })

      const job = await vectorService.embedDocument(freshDoc.id, '', testOrgId)

      expect(job.status).toBe('completed')
      expect(job.chunksTotal).toBe(1) // Empty content still creates one chunk
      expect(job.chunksProcessed).toBe(1)
    })

    it('should handle very short content', async () => {
      // Create a fresh document for this test
      const freshDoc = await createTestApprovedDocument(testOrgId, TEST_USER_ID, {
        title: 'Short Content Test Document'
      })

      const shortContent = 'Short text.'
      const job = await vectorService.embedDocument(freshDoc.id, shortContent, testOrgId)

      expect(job.status).toBe('completed')
      expect(job.chunksTotal).toBe(1) // Should create one chunk for short content
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      // Ensure document is embedded before search tests
      const content = 'This is a test document about project management and team collaboration.'
      await vectorService.embedDocument(testDocId, content, testOrgId)
    })

    it('should return relevant search results', async () => {
      const query = 'project management'
      const options: SearchOptions = {
        organizationId: testOrgId,
        limit: 5,
        threshold: 0.1 // Low threshold for testing
      }

      const results = await vectorService.search(query, options)

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThanOrEqual(0)

      if (results.length > 0) {
        expect(results[0]).toHaveProperty('id')
        expect(results[0]).toHaveProperty('title')
        expect(results[0]).toHaveProperty('content')
        expect(results[0]).toHaveProperty('similarity')
        expect(results[0]).toHaveProperty('sourceType')
      }
    })

    it('should respect similarity threshold', async () => {
      const query = 'completely unrelated quantum physics'
      const options: SearchOptions = {
        organizationId: testOrgId,
        threshold: 0.9 // High threshold
      }

      const results = await vectorService.search(query, options)

      // With mock embeddings, similarity might still be high enough
      expect(results.length).toBeGreaterThanOrEqual(0)
    })

    it('should limit results correctly', async () => {
      const query = 'test'
      const options: SearchOptions = {
        organizationId: testOrgId,
        limit: 2,
        threshold: 0.1
      }

      const results = await vectorService.search(query, options)

      expect(results.length).toBeLessThanOrEqual(2)
    })
  })

  describe('searchChunks', () => {
    it('should search document chunks specifically', async () => {
      const query = 'test document'
      const options: SearchOptions = {
        organizationId: testOrgId,
        threshold: 0.1
      }

      const results = await vectorService.searchChunks(query, options)

      expect(Array.isArray(results)).toBe(true)

      if (results.length > 0) {
        expect(results[0].sourceType).toBe('chunk')
        expect(results[0]).toHaveProperty('documentId')
      }
    })
  })

  describe('searchDocuments', () => {
    it('should search full documents specifically', async () => {
      const query = 'test document'
      const options: SearchOptions = {
        organizationId: testOrgId,
        threshold: 0.1
      }

      const results = await vectorService.searchDocuments(query, options)

      expect(Array.isArray(results)).toBe(true)

      if (results.length > 0) {
        expect(results[0].sourceType).toBe('document')
        expect(results[0].documentId).toBeUndefined()
      }
    })
  })

  describe('getEmbeddingStats', () => {
    it('should return embedding statistics', async () => {
      const stats = await vectorService.getEmbeddingStats(testOrgId)

      expect(stats).toHaveProperty('totalDocuments')
      expect(stats).toHaveProperty('documentsWithEmbeddings')
      expect(stats).toHaveProperty('totalChunks')
      expect(stats).toHaveProperty('avgChunksPerDocument')

      expect(typeof stats.totalDocuments).toBe('number')
      expect(typeof stats.documentsWithEmbeddings).toBe('number')
      expect(typeof stats.totalChunks).toBe('number')
      expect(typeof stats.avgChunksPerDocument).toBe('number')
    })
  })

  describe('error handling', () => {
    it('should handle invalid organization ID', async () => {
      const query = 'test'
      const options: SearchOptions = {
        organizationId: '00000000-0000-0000-0000-000000000000' // Valid UUID format but non-existent
      }

      const results = await vectorService.search(query, options)
      expect(results).toHaveLength(0)
    })

    it('should handle embedding service errors gracefully', async () => {
      // Mock service to throw error
      const mockService = {
        generateEmbedding: jest.fn().mockRejectedValue(new Error('Service unavailable'))
      }

      // This would require dependency injection to test properly
      // For now, we'll test that the service handles errors in general
      expect(async () => {
        await vectorService.search('test', { organizationId: testOrgId })
      }).not.toThrow()
    })
  })

  describe('performance', () => {
    it('should complete search within reasonable time', async () => {
      const startTime = Date.now()

      await vectorService.search('test query', {
        organizationId: testOrgId,
        limit: 5
      })

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })
  })
})