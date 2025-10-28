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
        sourceQuality: 0.5, // More conservative default quality score
        contentLength: structuredContent.length,
        sourceCount: sourceReferences.length
      })
      const confidenceResult = await this.openAIService.chatCompletion([
        { role: 'system', content: confidencePrompt.system },
        { role: 'user', content: confidencePrompt.user }
      ], { temperature: 0.1, maxTokens: 300 })

      totalTokens += confidenceResult.usage.totalTokens

      // Parse AI confidence assessment with improved error handling
      let aiAssessment
      try {
        // Try to extract JSON from the response (handle cases where AI adds extra text)
        let jsonContent = confidenceResult.content.trim()
        
        // If response contains markdown code blocks, extract the JSON
        const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
        if (jsonMatch) {
          jsonContent = jsonMatch[1]
        }
        
        // Find JSON object even if there's text before/after
        const jsonObjectMatch = jsonContent.match(/\{[\s\S]*\}/)
        if (jsonObjectMatch) {
          jsonContent = jsonObjectMatch[0]
        }

        const parsed = JSON.parse(jsonContent)
        console.log('✓ AI Assessment Parsed Successfully:', parsed)
        
        // Validate that we have the expected structure
        if (!parsed.factors || typeof parsed.factors !== 'object') {
          throw new Error('Missing or invalid factors object')
        }

        aiAssessment = {
          factors: {
            contentClarity: typeof parsed.factors.contentClarity === 'number' 
              ? parsed.factors.contentClarity 
              : undefined,
            sourceConsistency: typeof parsed.factors.informationCompleteness === 'number'
              ? parsed.factors.informationCompleteness 
              : undefined,
            informationDensity: typeof parsed.factors.factualConsistency === 'number'
              ? parsed.factors.factualConsistency 
              : undefined,
            authorityScore: typeof parsed.overallConfidence === 'number'
              ? parsed.overallConfidence 
              : undefined
          }
        }
        
        console.log('✓ Mapped AI Assessment:', aiAssessment)
      } catch (error) {
        console.warn('✗ Failed to parse AI confidence assessment:', error)
        console.log('Raw AI Response:', confidenceResult.content)
        
        // Improved regex fallback with stricter parsing
        const assessmentText = confidenceResult.content
        
        // Try to extract numbers from the response
        const clarityMatch = assessmentText.match(/["']?contentClarity["']?\s*:\s*([0-9.]+)/i)
        const completenessMatch = assessmentText.match(/["']?informationCompleteness["']?\s*:\s*([0-9.]+)/i)
        const consistencyMatch = assessmentText.match(/["']?factualConsistency["']?\s*:\s*([0-9.]+)/i)
        const overallMatch = assessmentText.match(/["']?overallConfidence["']?\s*:\s*([0-9.]+)/i)

        console.log('Regex extraction:', { clarityMatch, completenessMatch, consistencyMatch, overallMatch })

        aiAssessment = {
          factors: {
            contentClarity: clarityMatch ? Math.min(1, Math.max(0, parseFloat(clarityMatch[1]))) : undefined,
            sourceConsistency: completenessMatch ? Math.min(1, Math.max(0, parseFloat(completenessMatch[1]))) : undefined,
            informationDensity: consistencyMatch ? Math.min(1, Math.max(0, parseFloat(consistencyMatch[1]))) : undefined,
            authorityScore: overallMatch ? Math.min(1, Math.max(0, parseFloat(overallMatch[1]))) : undefined
          }
        }
        
        console.log('Fallback AI Assessment:', aiAssessment)
      }

      // Analyze original source quality
      const originalSourceQuality = ConfidenceScoring.analyzeOriginalSourceQuality(rawContent)
      console.log('Original source quality analysis:', originalSourceQuality)

      const confidence = ConfidenceScoring.calculateConfidence(
        structuredContent,
        sourceMetadata,
        aiAssessment,
        originalSourceQuality
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
   * Extract a concise single-sentence summary from structured content
   */
  private extractSummary(content: string): string {
    const lines = content.split('\n').filter(line => line.trim())

    // Look for existing summary or overview section
    const summaryIndex = lines.findIndex(line =>
      line.toLowerCase().includes('summary') ||
      line.toLowerCase().includes('overview') ||
      line.toLowerCase().includes('description')
    )

    if (summaryIndex >= 0 && summaryIndex < lines.length - 1) {
      const summaryLines = lines.slice(summaryIndex + 1, summaryIndex + 3)
        .filter(line => !line.startsWith('#') && line.trim().length > 10)
      
      if (summaryLines.length > 0) {
        // Get the first complete sentence
        const summaryText = summaryLines.join(' ').trim()
        const firstSentence = this.extractFirstSentence(summaryText)
        if (firstSentence.length > 20) {
          return firstSentence
        }
      }
    }

    // Look for first meaningful paragraph (not headings)
    const firstParagraph = lines.find(line => 
      !line.startsWith('#') && 
      !line.startsWith('-') && 
      !line.startsWith('*') &&
      !line.match(/^\d+\./) &&
      line.length > 30
    )

    if (firstParagraph) {
      const firstSentence = this.extractFirstSentence(firstParagraph)
      if (firstSentence.length > 20) {
        return firstSentence
      }
    }

    // Fallback: create summary from main headings
    const mainHeadings = lines
      .filter(line => line.match(/^#{1,2}\s/))
      .map(h => h.replace(/^#+\s*/, ''))
      .slice(0, 2)

    if (mainHeadings.length > 0) {
      if (mainHeadings.length === 1) {
        return `Documentation about ${mainHeadings[0].toLowerCase()}.`
      } else {
        return `Documentation covering ${mainHeadings.join(' and ').toLowerCase()}.`
      }
    }

    // Final fallback - create from content type
    if (content.includes('procedure') || content.includes('steps')) {
      return 'Standard operating procedure documentation.'
    } else if (content.includes('policy') || content.includes('guidelines')) {
      return 'Policy and guidelines documentation.'
    } else {
      return 'Internal documentation and reference material.'
    }
  }

  /**
   * Extract the first complete sentence from text
   */
  private extractFirstSentence(text: string): string {
    // Clean up the text
    const cleanText = text.replace(/\s+/g, ' ').trim()
    
    // Find the first sentence ending
    const sentenceEnders = /[.!?]/
    const match = cleanText.match(/^[^.!?]*[.!?]/)
    
    if (match) {
      return match[0].trim()
    }
    
    // If no sentence ender found, take first 120 characters and add period
    if (cleanText.length > 120) {
      const truncated = cleanText.substring(0, 120)
      const lastSpace = truncated.lastIndexOf(' ')
      if (lastSpace > 80) {
        return truncated.substring(0, lastSpace) + '.'
      }
    }
    
    // Return as-is if short enough, add period if needed
    return cleanText.length > 0 
      ? (cleanText.endsWith('.') || cleanText.endsWith('!') || cleanText.endsWith('?') 
         ? cleanText 
         : cleanText + '.')
      : 'Document content summary not available.'
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