import { getAzureOpenAIService } from './azure-openai'
import { getPIIRedactionService } from './pii-redaction'
import { ConfidenceScoring } from './confidence-scoring'
import { PromptTemplates } from './prompt-templates'

export interface SourceReference {
  sourceType: 'teams' | 'google_drive'
  sourceId: string
  originalContent: string
  metadata: {
    author?: string
    createdAt?: Date
    sourceUrl?: string
    [key: string]: any
  }
}

export interface AIProcessingResult {
  structuredContent: string
  redactedContent: string
  summary: string
  topics: string[]
  confidence: {
    score: number
    level: 'green' | 'yellow' | 'red'
    reasoning: string
  }
  piiEntities: Array<{
    text: string
    category: string
    confidenceScore: number
  }>
  processingTime: number
  tokensUsed: number
}

class AIIntegrationService {
  private openAIService = getAzureOpenAIService()
  private piiService = getPIIRedactionService()
  private promptTemplates = PromptTemplates

  /**
   * Process raw content through the complete AI pipeline
   */
  async processContent(
    rawContent: string,
    sourceReferences: SourceReference[]
  ): Promise<AIProcessingResult> {
    const startTime = Date.now()
    let totalTokens = 0

    try {
      console.log('Starting PII redaction...')
      console.log(`Input content length: ${rawContent.length} characters`)
      
      // Step 1: PII Redaction
      const piiResult = await this.piiService.redactPII(rawContent)
      const redactedContent = piiResult.redactedText
      
      console.log(`PII redaction completed. Found ${piiResult.entities.length} entities`)

      console.log('Starting content structuring...')
      // Step 2: Content Structuring
      const structuringPrompt = this.promptTemplates.contentStructuring({
        sourceContent: [redactedContent],
        sourceType: sourceReferences[0]?.sourceType || 'teams',
        metadata: {
          sourceCount: sourceReferences.length,
          totalLength: rawContent.length,
          piiEntitiesFound: piiResult.entities.length
        }
      })
      const structuringResult = await this.openAIService.chatCompletion([
        { role: 'system', content: structuringPrompt.system },
        { role: 'user', content: structuringPrompt.user }
      ], { temperature: 0.3, maxTokens: 2000 })

      totalTokens += structuringResult.usage.totalTokens
      const structuredContent = structuringResult.content

      // Step 3: Summary Generation (simple extraction from structured content)
      const summary = this.extractSummary(structuredContent)

      // Step 4: Topic Identification
      let topics: string[] = []
      if (structuredContent.length > 100) {
        console.log('Starting topic identification...')
        const topicPrompt = this.promptTemplates.topicIdentification({
          content: structuredContent
        })
        const topicResult = await this.openAIService.chatCompletion([
          { role: 'system', content: topicPrompt.system },
          { role: 'user', content: topicPrompt.user }
        ], { temperature: 0.2, maxTokens: 200 })

        totalTokens += topicResult.usage.totalTokens
        
        // Parse topics from AI response
        try {
          const parsed = JSON.parse(topicResult.content)
          topics = Array.isArray(parsed) ? parsed.slice(0, 5) : []
        } catch (error) {
          console.warn('Failed to parse topics from AI response:', error)
          // Fallback to simple extraction
          const topicLines = topicResult.content.split('\n')
            .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
            .map(line => line.replace(/^[-•]\s*/, '').trim())
            .filter(topic => topic.length > 0)
          
          topics = topicLines.slice(0, 5)
        }
      }

      console.log('Starting confidence assessment...')
      // Step 5: Confidence Assessment
      const sourceMetadata = sourceReferences.map(ref => ({
        type: ref.sourceType,
        authorCount: ref.metadata.author ? 1 : 0,
        messageCount: ref.sourceType === 'teams' ? 1 : undefined,
        fileSize: ref.originalContent.length,
        lastModified: ref.metadata.createdAt || new Date(),
        participants: ref.metadata.author ? [ref.metadata.author] : []
      }))

      // Get AI assessment for confidence factors
      const confidencePrompt = this.promptTemplates.confidenceAssessment({
        structuredContent,
        sourceQuality: 0.8, // Default quality score
        contentLength: structuredContent.length,
        sourceCount: sourceReferences.length
      })
      const confidenceResult = await this.openAIService.chatCompletion([
        { role: 'system', content: confidencePrompt.system },
        { role: 'user', content: confidencePrompt.user }
      ], { temperature: 0.1, maxTokens: 300 })

      totalTokens += confidenceResult.usage.totalTokens

      // Parse AI confidence assessment
      let aiAssessment
      try {
        const parsed = JSON.parse(confidenceResult.content)
        aiAssessment = {
          factors: {
            contentClarity: parsed.factors?.contentClarity,
            sourceConsistency: parsed.factors?.informationCompleteness, // Map to our system
            informationDensity: parsed.factors?.factualConsistency
          }
        }
      } catch (error) {
        console.warn('Failed to parse AI confidence assessment:', error)
        // Fallback to regex parsing
        const assessmentText = confidenceResult.content
        const clarityMatch = assessmentText.match(/clarity[:\s]*([0-9.]+)/i)
        const consistencyMatch = assessmentText.match(/consistency[:\s]*([0-9.]+)/i)
        const densityMatch = assessmentText.match(/density[:\s]*([0-9.]+)/i)
        
        aiAssessment = {
          factors: {
            contentClarity: clarityMatch ? Math.min(1, parseFloat(clarityMatch[1])) : undefined,
            sourceConsistency: consistencyMatch ? Math.min(1, parseFloat(consistencyMatch[1])) : undefined,
            informationDensity: densityMatch ? Math.min(1, parseFloat(densityMatch[1])) : undefined
          }
        }
      }

      const confidence = ConfidenceScoring.calculateConfidence(
        structuredContent,
        sourceMetadata,
        aiAssessment
      )

      const processingTime = Date.now() - startTime
      console.log(`Content processing completed in ${processingTime}ms, used ${totalTokens} tokens`)

      return {
        structuredContent,
        redactedContent,
        summary,
        topics,
        confidence: {
          score: confidence.score,
          level: confidence.level,
          reasoning: confidence.reasoning
        },
        piiEntities: piiResult.entities.map(entity => ({
          text: entity.text,
          category: entity.category,
          confidenceScore: entity.confidenceScore
        })),
        processingTime,
        tokensUsed: totalTokens
      }

    } catch (error) {
      console.error('AI processing error:', error)
      throw new Error(`AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract a summary from structured content
   */
  private extractSummary(content: string): string {
    // Simple summary extraction - take first paragraph or create from headings
    const lines = content.split('\n').filter(line => line.trim())
    
    // Look for existing summary section
    const summaryIndex = lines.findIndex(line => 
      line.toLowerCase().includes('summary') || 
      line.toLowerCase().includes('overview')
    )
    
    if (summaryIndex >= 0 && summaryIndex < lines.length - 1) {
      const summaryContent = lines.slice(summaryIndex + 1, summaryIndex + 4)
        .filter(line => !line.startsWith('#'))
        .join(' ')
        .trim()
      
      if (summaryContent.length > 50) {
        return summaryContent.substring(0, 200) + (summaryContent.length > 200 ? '...' : '')
      }
    }
    
    // Fallback: create summary from headings and first content
    const headings = lines.filter(line => line.startsWith('#')).slice(0, 3)
    const firstContent = lines.find(line => !line.startsWith('#') && line.length > 20)
    
    if (headings.length > 0) {
      const topics = headings.map(h => h.replace(/^#+\s*/, '')).join(', ')
      return `Document covering: ${topics}. ${firstContent ? firstContent.substring(0, 100) + '...' : ''}`
    }
    
    // Final fallback
    return content.substring(0, 200) + (content.length > 200 ? '...' : '')
  }

  /**
   * Process content for Q&A (simpler pipeline for real-time responses)
   */
  async processForQA(
    content: string,
    question: string
  ): Promise<{
    answer: string
    confidence: number
    sources: string[]
    tokensUsed: number
  }> {
    try {
      const qaPrompt = this.promptTemplates.questionAnswering(question, [content])
      const result = await this.openAIService.chatCompletion([
        { role: 'system', content: qaPrompt.system },
        { role: 'user', content: qaPrompt.user }
      ], { temperature: 0.2, maxTokens: 500 })

      // Extract confidence from response if available
      let confidence = 0.8 // Default confidence
      const confidenceMatch = result.content.match(/confidence[:\s]*([0-9.]+)/i)
      if (confidenceMatch) {
        confidence = Math.min(1, parseFloat(confidenceMatch[1]))
      }

      return {
        answer: result.content,
        confidence,
        sources: [], // Would be populated by the calling service
        tokensUsed: result.usage.totalTokens
      }

    } catch (error) {
      console.error('QA processing error:', error)
      throw new Error(`QA processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Batch process multiple content items
   */
  async batchProcessContent(
    contentItems: Array<{
      content: string
      sourceReferences: SourceReference[]
    }>
  ): Promise<AIProcessingResult[]> {
    const results: AIProcessingResult[] = []
    
    // Process in batches to avoid rate limits
    const batchSize = 3
    for (let i = 0; i < contentItems.length; i += batchSize) {
      const batch = contentItems.slice(i, i + batchSize)
      const batchPromises = batch.map(item => 
        this.processContent(item.content, item.sourceReferences)
      )
      
      try {
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
      } catch (error) {
        console.error(`Batch processing error for batch ${i / batchSize + 1}:`, error)
        throw error
      }
    }

    return results
  }
}

// Singleton instance
let aiIntegrationService: AIIntegrationService | null = null

export function getAIIntegrationService(): AIIntegrationService {
  if (!aiIntegrationService) {
    aiIntegrationService = new AIIntegrationService()
  }
  return aiIntegrationService
}

export { AIIntegrationService }