import { getVectorSearchService, SearchResult, SearchOptions } from './vector-search-service'
import { getAIIntegrationService } from '../ai'
import { getSupabaseAdmin } from '../supabase-admin'

export interface RAGQuery {
  question: string
  userId: string
  organizationId: string
  context?: string
  maxSources?: number
  similarityThreshold?: number
}

export interface RAGResponse {
  answer: string
  confidence: number
  sources: RAGSource[]
  followUpQuestions?: string[]
  tokensUsed: number
  processingTimeMs: number
}

export interface RAGSource {
  documentId: string
  title: string
  content: string
  similarity: number
  url?: string
  snippet: string
}

export interface RAGMetrics {
  totalQueries: number
  avgConfidence: number
  avgResponseTime: number
  topSources: Array<{ documentId: string; title: string; queryCount: number }>
  commonQuestions: Array<{ question: string; count: number }>
}

class RAGPipeline {
  private vectorService = getVectorSearchService()
  private aiService = getAIIntegrationService()
  private supabase: any = null

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await getSupabaseAdmin()
    }
    return this.supabase
  }

  /**
   * Process a question using RAG pipeline
   */
  async processQuery(query: RAGQuery): Promise<RAGResponse> {
    const startTime = Date.now()

    try {
      // Step 1: Retrieve relevant context using vector search
      const searchOptions: SearchOptions = {
        threshold: query.similarityThreshold || 0.7,
        limit: query.maxSources || 5,
        organizationId: query.organizationId,
        includeChunks: true,
        includeDocuments: true
      }

      const searchResults = await this.vectorService.searchChunks(query.question, searchOptions)

      if (searchResults.length === 0) {
        return {
          answer: "I don't have enough information in the knowledge base to answer your question. Please try rephrasing your question or contact your team for more specific information.",
          confidence: 0.1,
          sources: [],
          tokensUsed: 0,
          processingTimeMs: Date.now() - startTime
        }
      }

      // Step 2: Prepare context for AI generation
      const contextDocuments = searchResults.map(result => 
        `[Document: ${result.title}]\n${result.content}`
      )

      // Step 3: Generate answer using AI service
      const aiResponse = await this.aiService.answerQuestion(query.question, contextDocuments)

      // Step 4: Prepare sources with metadata
      const sources = await this.prepareSources(searchResults)

      // Step 5: Generate follow-up questions (optional)
      const followUpQuestions = await this.generateFollowUpQuestions(
        query.question,
        aiResponse.answer,
        searchResults
      )

      const response: RAGResponse = {
        answer: aiResponse.answer,
        confidence: aiResponse.confidence,
        sources,
        followUpQuestions,
        tokensUsed: aiResponse.tokensUsed,
        processingTimeMs: Date.now() - startTime
      }

      // Step 6: Log interaction for analytics
      await this.logInteraction(query, response)

      return response

    } catch (error) {
      console.error('RAG pipeline failed:', error)
      
      return {
        answer: "I'm sorry, I encountered an error while processing your question. Please try again or contact support if the issue persists.",
        confidence: 0,
        sources: [],
        tokensUsed: 0,
        processingTimeMs: Date.now() - startTime
      }
    }
  }

  /**
   * Get conversation context for multi-turn interactions
   */
  async getConversationContext(
    userId: string,
    organizationId: string,
    limit: number = 5
  ): Promise<Array<{ question: string; answer: string; timestamp: Date }>> {
    interface QAInteractionRow {
      question: string
      answer: string
      created_at: string
    }
    try {
      const supabase = await this.getSupabase()
      const { data, error } = await supabase
        .from('qa_interactions')
        .select('question, answer, created_at')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Failed to get conversation context:', error)
        return []
      }

      return (data || []).map((row: QAInteractionRow) => ({
        question: row.question,
        answer: row.answer,
        timestamp: new Date(row.created_at)
      }))

    } catch (error) {
      console.error('Failed to get conversation context:', error)
      return []
    }
  }

  /**
   * Get RAG metrics for analytics
   */
  async getRAGMetrics(
    organizationId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<RAGMetrics> {
    try {
      const supabase = await this.getSupabase()
      const { data: interactions, error } = await supabase
        .from('qa_interactions')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('created_at', timeRange.start.toISOString())
        .lte('created_at', timeRange.end.toISOString())

      if (error) {
        throw new Error(`Failed to get RAG metrics: ${error.message}`)
      }

      interface QAInteraction {
        confidence: number
        sources: any[]
        question: string
      }

      const totalQueries = interactions?.length || 0
      const avgConfidence = totalQueries > 0 
        ? interactions!.reduce((sum: number, i: QAInteraction) => sum + i.confidence, 0) / totalQueries 
        : 0

      // Calculate average response time (if stored)
      const avgResponseTime = 1500 // Placeholder - would need to store this in interactions

      // Get top sources
      const sourceMap = new Map<string, { title: string; count: number }>()
      interactions?.forEach((interaction: QAInteraction) => {
        const sources = interaction.sources || []
        sources.forEach((source: any) => {
          const key = source.documentId
          if (sourceMap.has(key)) {
            sourceMap.get(key)!.count++
          } else {
            sourceMap.set(key, { title: source.title, count: 1 })
          }
        })
      })

      const topSources = Array.from(sourceMap.entries())
        .map(([documentId, data]) => ({
          documentId,
          title: data.title,
          queryCount: data.count
        }))
        .sort((a, b) => b.queryCount - a.queryCount)
        .slice(0, 10)

      // Get common questions
      const questionMap = new Map<string, number>()
      interactions?.forEach((interaction: QAInteraction) => {
        const question = interaction.question.toLowerCase()
        questionMap.set(question, (questionMap.get(question) || 0) + 1)
      })

      const commonQuestions = Array.from(questionMap.entries())
        .map(([question, count]) => ({ question, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      return {
        totalQueries,
        avgConfidence,
        avgResponseTime,
        topSources,
        commonQuestions
      }

    } catch (error) {
      console.error('Failed to get RAG metrics:', error)
      throw error
    }
  }

  /**
   * Suggest questions based on available content
   */
  async suggestQuestions(
    organizationId: string,
    limit: number = 5
  ): Promise<string[]> {
    interface QuestionInteraction {
      question: string
    }
    try {
      // Get recent popular questions
      const supabase = await this.getSupabase()
      const { data: interactions, error } = await supabase
        .from('qa_interactions')
        .select('question')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Failed to get question suggestions:', error)
        return []
      }

      // Simple frequency-based suggestions
      const questionMap = new Map<string, number>()
      interactions?.forEach((interaction: QuestionInteraction) => {
        const question = interaction.question
        questionMap.set(question, (questionMap.get(question) || 0) + 1)
      })

      return Array.from(questionMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([question]) => question)

    } catch (error) {
      console.error('Failed to suggest questions:', error)
      return []
    }
  }

  private async prepareSources(searchResults: SearchResult[]): Promise<RAGSource[]> {
    const sources: RAGSource[] = []

    for (const result of searchResults) {
      // Get document metadata for URL if available
      let url: string | undefined
      
      if (result.documentId) {
        try {
          const supabase = await this.getSupabase()
          const { data: doc } = await supabase
            .from('approved_documents')
            .select('id')
            .eq('id', result.documentId)
            .single()

          if (doc) {
            url = `/knowledge-base/documents/${doc.id}`
          }
        } catch (error) {
          // Ignore errors getting document metadata
        }
      }

      sources.push({
        documentId: result.documentId || result.id,
        title: result.title,
        content: result.content,
        similarity: result.similarity,
        url,
        snippet: result.content.substring(0, 200) + (result.content.length > 200 ? '...' : '')
      })
    }

    return sources
  }

  private async generateFollowUpQuestions(
    originalQuestion: string,
    answer: string,
    sources: SearchResult[]
  ): Promise<string[]> {
    try {
      // Simple heuristic-based follow-up generation
      const followUps: string[] = []

      // Based on answer content
      if (answer.includes('process') || answer.includes('procedure')) {
        followUps.push('What are the steps involved in this process?')
      }
      
      if (answer.includes('policy') || answer.includes('rule')) {
        followUps.push('Are there any exceptions to this policy?')
      }
      
      if (answer.includes('contact') || answer.includes('team')) {
        followUps.push('Who should I contact for more information?')
      }

      // Based on sources
      if (sources.length > 1) {
        followUps.push('Can you provide more details from the other sources?')
      }

      return followUps.slice(0, 3) // Limit to 3 follow-ups

    } catch (error) {
      console.error('Failed to generate follow-up questions:', error)
      return []
    }
  }

  private async logInteraction(query: RAGQuery, response: RAGResponse): Promise<void> {
    try {
      const supabase = await this.getSupabase()
      const { error } = await supabase
        .from('qa_interactions')
        .insert({
          user_id: query.userId,
          organization_id: query.organizationId,
          question: query.question,
          answer: response.answer,
          confidence: response.confidence,
          sources: response.sources.map(source => ({
            documentId: source.documentId,
            title: source.title,
            similarity: source.similarity,
            snippet: source.snippet
          }))
        })

      if (error) {
        console.error('Failed to log QA interaction:', error)
      }

    } catch (error) {
      console.error('Failed to log QA interaction:', error)
    }
  }
}

// Singleton instance
let ragPipeline: RAGPipeline | null = null

export function getRAGPipeline(): RAGPipeline {
  if (!ragPipeline) {
    ragPipeline = new RAGPipeline()
  }
  return ragPipeline
}

export { RAGPipeline }