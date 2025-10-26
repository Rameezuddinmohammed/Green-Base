import { getAzureOpenAIService, ChatMessage } from './azure-openai'
import { getPIIRedactionService, PIIRedactionResult } from './pii-redaction'
import { PromptTemplates, ContentStructuringInput, TopicIdentificationInput, ConfidenceAssessmentInput } from './prompt-templates'
import { ConfidenceScoring, ConfidenceResult, SourceMetadata, ConfidenceWeights } from './confidence-scoring'

export interface ProcessedContent {
  id: string
  title: string
  content: string
  summary: string
  topics: string[]
  confidence: ConfidenceResult
  piiRedaction: PIIRedactionResult
  sourceReferences: SourceReference[]
  metadata: ContentMetadata
}

export interface SourceReference {
  sourceType: 'teams' | 'google_drive'
  sourceId: string
  url?: string
  snippet: string
  author?: string
  timestamp: Date
}

export interface ContentMetadata {
  processedAt: Date
  processingVersion: string
  aiModelUsed: string
  tokenUsage: {
    total: number
    structuring: number
    topicIdentification: number
    confidenceAssessment: number
  }
}

export interface ContentProcessingOptions {
  confidenceWeights?: ConfidenceWeights
  piiRedactionOptions?: {
    categories?: string[]
    confidenceThreshold?: number
  }
  enableTopicIdentification?: boolean
  existingTopics?: string[]
}

class AIIntegrationService {
  private openAIService = getAzureOpenAIService()
  private piiService = getPIIRedactionService()
  private processingVersion = '1.0.0'

  async processContent(
    sourceContent: string[],
    sourceReferences: SourceReference[],
    sourceMetadata: SourceMetadata[],
    options: ContentProcessingOptions = {}
  ): Promise<ProcessedContent> {
    const startTime = Date.now()
    let totalTokens = 0

    try {
      // Step 1: PII Redaction
      console.log('Starting PII redaction...')
      const combinedContent = sourceContent.join('\n\n---\n\n')
      const piiRedaction = await this.piiService.redactPII(
        combinedContent,
        options.piiRedactionOptions
      )

      // Step 2: Content Structuring
      console.log('Starting content structuring...')
      const structuringInput: ContentStructuringInput = {
        sourceContent: [piiRedaction.redactedText],
        sourceType: sourceReferences[0]?.sourceType || 'teams',
        metadata: {
          sourceCount: sourceContent.length,
          totalLength: combinedContent.length,
          piiEntitiesFound: piiRedaction.entities.length
        }
      }

      const structuringPrompt = PromptTemplates.contentStructuring(structuringInput)
      const structuringResult = await this.openAIService.chatCompletion([
        { role: 'system', content: structuringPrompt.system },
        { role: 'user', content: structuringPrompt.user }
      ], { temperature: 0.3, maxTokens: 2000 })

      totalTokens += structuringResult.usage.totalTokens

      // Step 3: Topic Identification (if enabled)
      let topics: string[] = []
      let topicTokens = 0
      if (options.enableTopicIdentification !== false) {
        console.log('Starting topic identification...')
        const topicInput: TopicIdentificationInput = {
          content: structuringResult.content,
          existingTopics: options.existingTopics
        }

        const topicPrompt = PromptTemplates.topicIdentification(topicInput)
        const topicResult = await this.openAIService.chatCompletion([
          { role: 'system', content: topicPrompt.system },
          { role: 'user', content: topicPrompt.user }
        ], { temperature: 0.1, maxTokens: 200 })

        topicTokens = topicResult.usage.totalTokens
        totalTokens += topicTokens

        try {
          // Extract JSON from response, handling potential markdown or extra text
          const cleanContent = this.extractJSON(topicResult.content)
          topics = JSON.parse(cleanContent)
          if (!Array.isArray(topics)) {
            throw new Error('Topics result is not an array')
          }
        } catch (error) {
          console.warn('Failed to parse topics JSON, using fallback:', error)
          topics = ['General']
        }
      }

      // Step 4: AI-powered Confidence Assessment
      console.log('Starting confidence assessment...')
      const confidenceInput: ConfidenceAssessmentInput = {
        structuredContent: structuringResult.content,
        sourceQuality: this.calculateSourceQuality(sourceMetadata),
        contentLength: structuringResult.content.length,
        sourceCount: sourceContent.length
      }

      const confidencePrompt = PromptTemplates.confidenceAssessment(confidenceInput)
      const confidenceResult = await this.openAIService.chatCompletion([
        { role: 'system', content: confidencePrompt.system },
        { role: 'user', content: confidencePrompt.user }
      ], { temperature: 0.1, maxTokens: 500 })

      totalTokens += confidenceResult.usage.totalTokens

      let aiAssessment
      try {
        const cleanContent = this.extractJSON(confidenceResult.content)
        aiAssessment = JSON.parse(cleanContent)
      } catch (error) {
        console.warn('Failed to parse confidence assessment JSON:', error)
        aiAssessment = null
      }

      // Step 5: Final Confidence Scoring
      const confidence = ConfidenceScoring.calculateConfidence(
        structuringResult.content,
        sourceMetadata,
        aiAssessment,
        options.confidenceWeights
      )

      // Step 6: Extract title and summary
      const { title, summary } = this.extractTitleAndSummary(structuringResult.content)

      const processingTime = Date.now() - startTime
      console.log(`Content processing completed in ${processingTime}ms, used ${totalTokens} tokens`)

      return {
        id: this.generateId(),
        title,
        content: structuringResult.content,
        summary,
        topics,
        confidence,
        piiRedaction,
        sourceReferences,
        metadata: {
          processedAt: new Date(),
          processingVersion: this.processingVersion,
          aiModelUsed: 'gpt-4',
          tokenUsage: {
            total: totalTokens,
            structuring: structuringResult.usage.totalTokens,
            topicIdentification: topicTokens,
            confidenceAssessment: confidenceResult.usage.totalTokens
          }
        }
      }
    } catch (error) {
      console.error('Content processing failed:', error)
      throw new Error(`AI content processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async recognizeIntent(
    userInput: string,
    availableDocuments: string[]
  ): Promise<{
    intent: 'add' | 'modify' | 'delete' | 'create_new'
    targetDocument: string | null
    proposedChanges: string
    confidence: number
    newContent?: string
  }> {
    const prompt = PromptTemplates.intentRecognition(userInput, availableDocuments)
    
    const result = await this.openAIService.chatCompletion([
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user }
    ], { temperature: 0.2, maxTokens: 500 })

    try {
      const cleanContent = this.extractJSON(result.content)
      return JSON.parse(cleanContent)
    } catch (error) {
      console.error('Failed to parse intent recognition result:', error)
      throw new Error('Intent recognition failed')
    }
  }

  async answerQuestion(
    question: string,
    contextDocuments: string[]
  ): Promise<{
    answer: string
    confidence: number
    tokensUsed: number
  }> {
    const prompt = PromptTemplates.questionAnswering(question, contextDocuments)
    
    const result = await this.openAIService.chatCompletion([
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user }
    ], { temperature: 0.3, maxTokens: 1000 })

    // Simple confidence estimation based on response characteristics
    const confidence = this.estimateAnswerConfidence(result.content, contextDocuments.length)

    return {
      answer: result.content,
      confidence,
      tokensUsed: result.usage.totalTokens
    }
  }

  private calculateSourceQuality(sourceMetadata: SourceMetadata[]): number {
    if (sourceMetadata.length === 0) return 0.5

    let totalQuality = 0
    for (const source of sourceMetadata) {
      let quality = 0.5 // Base quality

      // Recent content is higher quality
      const ageInDays = (Date.now() - source.lastModified.getTime()) / (1000 * 60 * 60 * 24)
      if (ageInDays < 30) quality += 0.2
      else if (ageInDays < 90) quality += 0.1

      // Multiple authors/participants increase quality
      if (source.authorCount > 1) quality += 0.1
      if (source.participants && source.participants.length > 2) quality += 0.1

      // Teams with many messages indicate active discussion
      if (source.type === 'teams' && source.messageCount && source.messageCount > 5) {
        quality += 0.1
      }

      totalQuality += Math.min(1, quality)
    }

    return totalQuality / sourceMetadata.length
  }

  private extractTitleAndSummary(content: string): { title: string; summary: string } {
    const lines = content.split('\n').filter(line => line.trim())
    
    // Try to find a title (first heading or first line)
    let title = 'Untitled Document'
    for (const line of lines) {
      if (line.startsWith('#')) {
        title = line.replace(/^#+\s*/, '').trim()
        break
      } else if (line.trim() && !line.includes(':')) {
        title = line.trim()
        break
      }
    }

    // Create summary from first few sentences
    const sentences = content.replace(/#+\s*[^\n]*\n/g, '').split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10)

    const summary = sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '.' : '')

    return {
      title: title.substring(0, 100), // Limit title length
      summary: summary.substring(0, 300) // Limit summary length
    }
  }

  private estimateAnswerConfidence(answer: string, contextCount: number): number {
    let confidence = 0.5 // Base confidence

    // More context generally means higher confidence
    confidence += Math.min(0.3, contextCount * 0.1)

    // Specific indicators in the answer
    if (answer.includes('According to') || answer.includes('Based on')) confidence += 0.1
    if (answer.includes("I don't have enough information") || answer.includes("not clear")) confidence -= 0.2
    if (answer.length > 100) confidence += 0.1 // Detailed answers are often more confident

    return Math.max(0.1, Math.min(1, confidence))
  }

  private extractJSON(content: string): string {
    // Remove markdown code blocks
    let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    
    // Try to extract JSON from content that might have markdown or extra text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (jsonMatch) {
      return jsonMatch[0]
    }
    
    // If no JSON found, try to find array-like content
    const arrayMatch = cleaned.match(/\[[\s\S]*?\]/)
    if (arrayMatch) {
      return arrayMatch[0]
    }
    
    // If still no JSON, return a safe fallback
    return '[]'
  }

  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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