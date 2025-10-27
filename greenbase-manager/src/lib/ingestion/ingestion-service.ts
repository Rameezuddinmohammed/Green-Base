import { getSupabaseAdmin } from '../supabase-admin'
import { getAIIntegrationService } from '../ai/ai-integration-service'
import { getVectorSearchService } from '../vector/vector-search-service'

export interface SourceContent {
  id: string
  type: 'teams_message' | 'drive_file'
  title: string
  content: string
  metadata: {
    author?: string
    createdAt?: Date
    sourceUrl?: string
    participants?: string[]
    [key: string]: any
  }
}

export interface IngestionResult {
  documentsCreated: number
  documentsUpdated: number
  errors: string[]
  processingTime: number
}

class IngestionService {
  private supabase: any = null
  private aiService = getAIIntegrationService()
  private vectorService = getVectorSearchService()

  async initialize() {
    if (this.supabase) return
    this.supabase = await getSupabaseAdmin()
  }

  /**
   * Process content from a connected source
   */
  async processSourceContent(
    sourceContent: SourceContent[],
    sourceId: string,
    organizationId: string
  ): Promise<IngestionResult> {
    await this.initialize()
    
    const startTime = Date.now()
    const result: IngestionResult = {
      documentsCreated: 0,
      documentsUpdated: 0,
      errors: [],
      processingTime: 0
    }

    try {
      // Group related content by similarity/topic
      const contentGroups = await this.groupRelatedContent(sourceContent)

      for (const group of contentGroups) {
        try {
          await this.processContentGroup(group, sourceId, organizationId)
          result.documentsCreated++
        } catch (error) {
          console.error('Failed to process content group:', error)
          result.errors.push(`Failed to process group: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      result.processingTime = Date.now() - startTime
      return result

    } catch (error) {
      console.error('Ingestion service error:', error)
      result.errors.push(`Ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      result.processingTime = Date.now() - startTime
      return result
    }
  }

  /**
   * Group related content items together for better document creation
   */
  private async groupRelatedContent(content: SourceContent[]): Promise<SourceContent[][]> {
    // For MVP, we'll create simple groups based on content length and type
    // In production, this could use AI to group by topic similarity
    
    const groups: SourceContent[][] = []
    const processed = new Set<string>()

    for (const item of content) {
      if (processed.has(item.id)) continue

      const group = [item]
      processed.add(item.id)

      // Find related items (same type, similar timeframe, or mentioned together)
      for (const other of content) {
        if (processed.has(other.id) || other.id === item.id) continue

        if (this.areItemsRelated(item, other)) {
          group.push(other)
          processed.add(other.id)
        }

        // Limit group size to avoid overly large documents
        if (group.length >= 10) break
      }

      groups.push(group)
    }

    return groups
  }

  /**
   * Check if two content items are related and should be grouped
   */
  private areItemsRelated(item1: SourceContent, item2: SourceContent): boolean {
    // Same type preference
    if (item1.type !== item2.type) return false

    // Time proximity (within 24 hours for messages, any time for files)
    if (item1.type === 'teams_message' && item2.type === 'teams_message') {
      const time1 = item1.metadata.createdAt?.getTime() || 0
      const time2 = item2.metadata.createdAt?.getTime() || 0
      const timeDiff = Math.abs(time1 - time2)
      const oneDayMs = 24 * 60 * 60 * 1000
      
      if (timeDiff > oneDayMs) return false
    }

    // Same participants/author
    if (item1.metadata.author && item2.metadata.author) {
      if (item1.metadata.author === item2.metadata.author) return true
    }

    // Content similarity (basic keyword matching)
    const keywords1 = this.extractKeywords(item1.content)
    const keywords2 = this.extractKeywords(item2.content)
    const commonKeywords = keywords1.filter(k => keywords2.includes(k))
    
    return commonKeywords.length >= 2
  }

  /**
   * Extract basic keywords from content
   */
  private extractKeywords(content: string): string[] {
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'would', 'there', 'could', 'other'].includes(word))

    // Return most frequent words
    const frequency: { [key: string]: number } = {}
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1
    })

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word)
  }

  /**
   * Process a group of related content items into a draft document
   */
  private async processContentGroup(
    contentGroup: SourceContent[],
    sourceId: string,
    organizationId: string
  ): Promise<void> {
    console.log(`Processing content group with ${contentGroup.length} items for organization ${organizationId}`)
    
    // Log content preview for debugging
    contentGroup.forEach((item, index) => {
      console.log(`Item ${index + 1}: ${item.type} - "${item.title}" (${item.content.length} chars)`)
    })
    // Combine content from the group
    const combinedContent = contentGroup.map(item => {
      let header = `## ${item.title}\n`
      if (item.metadata.author) {
        header += `**Author:** ${item.metadata.author}\n`
      }
      if (item.metadata.createdAt) {
        header += `**Date:** ${item.metadata.createdAt.toLocaleDateString()}\n`
      }
      header += '\n'
      
      return header + item.content
    }).join('\n\n---\n\n')

    // Generate a title for the document group
    const title = await this.generateDocumentTitle(contentGroup)

    console.log(`Generated title: "${title}"`)
    console.log(`Combined content length: ${combinedContent.length} characters`)
    
    // Process through AI pipeline
    console.log('Starting AI processing...')
    const aiResult = await this.aiService.processContent(
      combinedContent,
      contentGroup.map(item => ({
        sourceType: item.type === 'teams_message' ? 'teams' : 'google_drive',
        sourceId: item.id,
        originalContent: item.content,
        metadata: item.metadata
      }))
    )
    
    console.log(`AI processing completed. Confidence: ${aiResult.confidence.score} (${aiResult.confidence.level})`)

    // Create draft document
    const { data: draftDoc, error: draftError } = await this.supabase
      .from('draft_documents')
      .insert({
        title,
        content: aiResult.structuredContent,
        summary: aiResult.summary,
        topics: aiResult.topics,
        confidence_score: aiResult.confidence.score,
        confidence_reasoning: aiResult.confidence.reasoning,
        triage_level: aiResult.confidence.level,
        source_references: contentGroup.map(item => ({
          sourceType: item.type === 'teams_message' ? 'teams' : 'google_drive',
          sourceId: item.id,
          title: item.title,
          author: item.metadata.author,
          createdAt: item.metadata.createdAt,
          sourceUrl: item.metadata.sourceUrl
        })),
        pii_entities_found: aiResult.piiEntities.length,
        processing_metadata: {
          sourceId,
          itemCount: contentGroup.length,
          processingTime: aiResult.processingTime,
          tokensUsed: aiResult.tokensUsed
        },
        organization_id: organizationId,
        status: 'pending'
      })
      .select()
      .single()

    if (draftError) {
      throw new Error(`Failed to create draft document: ${draftError.message}`)
    }

    // Create source document records
    const sourceDocuments = contentGroup.map(item => ({
      draft_document_id: draftDoc.id,
      source_type: item.type === 'teams_message' ? 'teams' : 'google_drive',
      source_id: item.id,
      original_content: item.content,
      redacted_content: aiResult.redactedContent,
      metadata: item.metadata
    }))

    const { error: sourceError } = await this.supabase
      .from('source_documents')
      .insert(sourceDocuments)

    if (sourceError) {
      console.error('Failed to create source documents:', sourceError)
      // Don't throw here as the main document was created successfully
    }

    console.log(`Created draft document "${title}" from ${contentGroup.length} source items`)
  }

  /**
   * Generate a meaningful title for a document group
   */
  private async generateDocumentTitle(contentGroup: SourceContent[]): Promise<string> {
    if (contentGroup.length === 1) {
      return contentGroup[0].title
    }

    // Extract common themes from titles and content
    const allTitles = contentGroup.map(item => item.title).join(' ')
    const keywords = this.extractKeywords(allTitles)
    
    if (keywords.length > 0) {
      const mainKeyword = keywords[0]
      const capitalizedKeyword = mainKeyword.charAt(0).toUpperCase() + mainKeyword.slice(1)
      
      if (contentGroup[0].type === 'teams_message') {
        return `${capitalizedKeyword} Discussion (${contentGroup.length} messages)`
      } else {
        return `${capitalizedKeyword} Documentation (${contentGroup.length} files)`
      }
    }

    // Fallback titles
    if (contentGroup[0].type === 'teams_message') {
      return `Team Discussion - ${new Date().toLocaleDateString()}`
    } else {
      return `Document Collection - ${new Date().toLocaleDateString()}`
    }
  }

  /**
   * Manually trigger ingestion for a specific source
   */
  async triggerSourceIngestion(sourceId: string, userId: string): Promise<IngestionResult> {
    await this.initialize()

    // Get user organization
    const { data: user } = await this.supabase
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single()

    if (!user) {
      throw new Error('User not found')
    }

    // This would typically be called by the OAuth service
    // For now, return a placeholder result
    return {
      documentsCreated: 0,
      documentsUpdated: 0,
      errors: ['Manual ingestion not yet implemented'],
      processingTime: 0
    }
  }
}

// Singleton instance
let ingestionService: IngestionService | null = null

export function getIngestionService(): IngestionService {
  if (!ingestionService) {
    ingestionService = new IngestionService()
  }
  return ingestionService
}

export { IngestionService }