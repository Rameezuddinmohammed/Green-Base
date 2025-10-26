import { getAzureOpenAIService, EmbeddingResult } from '../ai/azure-openai'
import { getSupabaseAdmin } from '../supabase-admin'
import { DocumentChunking, DocumentChunk } from '../ingestion/document-chunking'

export interface SearchResult {
  id: string
  title: string
  content: string
  similarity: number
  sourceType: 'document' | 'chunk'
  documentId?: string
}

export interface SearchOptions {
  threshold?: number
  limit?: number
  organizationId?: string
  includeChunks?: boolean
  includeDocuments?: boolean
}

export interface EmbeddingJob {
  id: string
  documentId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  chunksTotal: number
  chunksProcessed: number
  error?: string
  createdAt: Date
  completedAt?: Date
}

class VectorSearchService {
  private openAIService = getAzureOpenAIService()
  private supabase: any = null

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await getSupabaseAdmin()
    }
    return this.supabase
  }

  /**
   * Generate embeddings for a document and store chunks in database
   */
  async embedDocument(
    documentId: string,
    content: string,
    organizationId: string
  ): Promise<EmbeddingJob> {
    const job: EmbeddingJob = {
      id: this.generateJobId(),
      documentId,
      status: 'pending',
      chunksTotal: 0,
      chunksProcessed: 0,
      createdAt: new Date()
    }

    try {
      // Update job status
      job.status = 'processing'

      // Chunk the document
      const chunks = DocumentChunking.chunkDocument(content, {
        maxTokens: 500,
        overlapTokens: 50,
        preserveSentences: true
      })

      job.chunksTotal = chunks.length

      if (chunks.length === 0) {
        job.status = 'completed'
        job.completedAt = new Date()
        return job
      }

      // Generate embeddings for chunks
      const chunkContents = chunks.map(chunk => chunk.content)
      const embeddings = await this.openAIService.generateBatchEmbeddings(chunkContents)

      // Prepare chunks data for database
      const chunksData = chunks.map((chunk, index) => ({
        content: chunk.content,
        embedding: embeddings[index].embedding,
        chunkIndex: chunk.metadata.chunkIndex
      }))

      // Store chunks in database
      await this.storeDocumentChunks(documentId, chunksData, organizationId)

      // Generate and store full document embedding
      const fullDocEmbedding = await this.openAIService.generateEmbedding(content)
      await this.updateDocumentEmbedding(documentId, fullDocEmbedding.embedding)

      job.chunksProcessed = chunks.length
      job.status = 'completed'
      job.completedAt = new Date()

      console.log(`Document ${documentId} embedded successfully: ${chunks.length} chunks`)
      return job

    } catch (error) {
      console.error(`Failed to embed document ${documentId}:`, error)
      job.status = 'failed'
      job.error = error instanceof Error ? error.message : 'Unknown error'
      job.completedAt = new Date()
      return job
    }
  }

  /**
   * Search for similar documents and chunks using vector similarity
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      threshold = 0.7,
      limit = 10,
      organizationId,
      includeChunks = true,
      includeDocuments = true
    } = options

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.openAIService.generateEmbedding(query)

      // Search using the hybrid search function
      const supabase = await this.getSupabase()
      const { data, error } = await supabase
        .rpc('hybrid_search', {
          query_embedding: queryEmbedding.embedding,
          match_threshold: threshold,
          match_count: limit,
          organization_id: organizationId
        })

      if (error) {
        throw new Error(`Vector search failed: ${error.message}`)
      }

      // Filter results based on options
      let results = data || []
      
      if (!includeDocuments) {
        results = results.filter((r: any) => r.source_type === 'chunk')
      }
      
      if (!includeChunks) {
        results = results.filter((r: any) => r.source_type === 'document')
      }

      return results.map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        similarity: row.similarity,
        sourceType: row.source_type,
        documentId: row.source_type === 'chunk' ? row.id : undefined
      }))

    } catch (error) {
      console.error('Vector search failed:', error)
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Search only document chunks (for detailed RAG retrieval)
   */
  async searchChunks(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      threshold = 0.7,
      limit = 20,
      organizationId
    } = options

    try {
      const queryEmbedding = await this.openAIService.generateEmbedding(query)

      const supabase = await this.getSupabase()
      const { data, error } = await supabase
        .rpc('match_document_chunks', {
          query_embedding: queryEmbedding.embedding,
          match_threshold: threshold,
          match_count: limit,
          organization_id: organizationId
        })

      if (error) {
        throw new Error(`Chunk search failed: ${error.message}`)
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        title: row.document_title,
        content: row.content,
        similarity: row.similarity,
        sourceType: 'chunk' as const,
        documentId: row.document_id
      }))

    } catch (error) {
      console.error('Chunk search failed:', error)
      throw new Error(`Chunk search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Search only full documents
   */
  async searchDocuments(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      threshold = 0.7,
      limit = 10,
      organizationId
    } = options

    try {
      const queryEmbedding = await this.openAIService.generateEmbedding(query)

      const supabase = await this.getSupabase()
      const { data, error } = await supabase
        .rpc('match_documents', {
          query_embedding: queryEmbedding.embedding,
          match_threshold: threshold,
          match_count: limit,
          organization_id: organizationId
        })

      if (error) {
        throw new Error(`Document search failed: ${error.message}`)
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        similarity: row.similarity,
        sourceType: 'document' as const
      }))

    } catch (error) {
      console.error('Document search failed:', error)
      throw new Error(`Document search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Re-embed all documents for an organization (maintenance operation)
   */
  async reembedAllDocuments(organizationId: string): Promise<EmbeddingJob[]> {
    try {
      // Get all approved documents for the organization
      const supabase = await this.getSupabase()
      const { data: documents, error } = await supabase
        .from('approved_documents')
        .select('id, content')
        .eq('organization_id', organizationId)

      if (error) {
        throw new Error(`Failed to fetch documents: ${error.message}`)
      }

      const jobs: EmbeddingJob[] = []

      // Process each document
      for (const doc of documents || []) {
        const job = await this.embedDocument(doc.id, doc.content, organizationId)
        jobs.push(job)
      }

      console.log(`Re-embedding completed for organization ${organizationId}: ${jobs.length} documents processed`)
      return jobs

    } catch (error) {
      console.error('Re-embedding failed:', error)
      throw error
    }
  }

  /**
   * Get embedding statistics for an organization
   */
  async getEmbeddingStats(organizationId: string): Promise<{
    totalDocuments: number
    documentsWithEmbeddings: number
    totalChunks: number
    avgChunksPerDocument: number
  }> {
    interface DocumentWithChunks {
      id: string
      embedding: number[] | null
      document_chunks: Array<{ count: number }>
    }
    try {
      const supabase = await this.getSupabase()
      const { data: stats, error } = await supabase
        .from('approved_documents')
        .select(`
          id,
          embedding,
          document_chunks(count)
        `)
        .eq('organization_id', organizationId)

      if (error) {
        throw new Error(`Failed to get embedding stats: ${error.message}`)
      }

      const totalDocuments = stats?.length || 0
      const documentsWithEmbeddings = stats?.filter((doc: DocumentWithChunks) => doc.embedding !== null).length || 0
      const totalChunks = stats?.reduce((sum: number, doc: DocumentWithChunks) => sum + (doc.document_chunks?.[0]?.count || 0), 0) || 0
      const avgChunksPerDocument = totalDocuments > 0 ? totalChunks / totalDocuments : 0

      return {
        totalDocuments,
        documentsWithEmbeddings,
        totalChunks,
        avgChunksPerDocument
      }

    } catch (error) {
      console.error('Failed to get embedding stats:', error)
      throw error
    }
  }

  private async storeDocumentChunks(
    documentId: string,
    chunksData: Array<{ content: string; embedding: number[]; chunkIndex: number }>,
    organizationId: string
  ): Promise<void> {
    try {
      const supabase = await this.getSupabase()
      
      // First verify the document exists in approved_documents
      const { data: docExists, error: docError } = await supabase
        .from('approved_documents')
        .select('id')
        .eq('id', documentId)
        .single()

      if (docError || !docExists) {
        throw new Error(`Document ${documentId} not found in approved_documents table`)
      }
      
      // Delete existing chunks
      const { error: deleteError } = await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId)

      if (deleteError) {
        throw new Error(`Failed to delete existing chunks: ${deleteError.message}`)
      }

      // Insert new chunks with organization_id
      const chunks = chunksData.map(chunk => ({
        document_id: documentId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        embedding: chunk.embedding,
        organization_id: organizationId
      }))

      const { error: insertError } = await supabase
        .from('document_chunks')
        .insert(chunks)

      if (insertError) {
        throw new Error(`Failed to insert chunks: ${insertError.message}`)
      }

    } catch (error) {
      console.error('Failed to store document chunks:', error)
      throw error
    }
  }

  private async updateDocumentEmbedding(documentId: string, embedding: number[]): Promise<void> {
    try {
      const supabase = await this.getSupabase()
      
      const { error } = await supabase
        .from('approved_documents')
        .update({ embedding })
        .eq('id', documentId)

      if (error) {
        throw new Error(`Failed to update document embedding: ${error.message}`)
      }

    } catch (error) {
      console.error('Failed to update document embedding:', error)
      throw error
    }
  }

  private generateJobId(): string {
    return `embed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Singleton instance
let vectorSearchService: VectorSearchService | null = null

export function getVectorSearchService(): VectorSearchService {
  if (!vectorSearchService) {
    vectorSearchService = new VectorSearchService()
  }
  return vectorSearchService
}

export { VectorSearchService }