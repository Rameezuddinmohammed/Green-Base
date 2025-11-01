import { getAzureOpenAIService } from './azure-openai'
import { getPIIRedactionService } from './pii-redaction'
import { ConfidenceScoring } from './confidence-scoring'
import { PromptTemplates, DocumentDomain } from './prompt-templates'

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
   * Classify document type before processing
   */
  async classifyDocumentType(rawContent: string): Promise<DocumentDomain> {
    try {
      console.log('Starting document classification...')
      
      const classificationPrompt = this.promptTemplates.documentClassification({
        rawContent
      })
      
      const result = await this.openAIService.chatCompletion([
        { role: 'system', content: classificationPrompt.system },
        { role: 'user', content: classificationPrompt.user }
      ], { temperature: 0.1, maxTokens: 50 })

      // Parse the classification result
      const rawClassification = result.content.trim()
      const classification = rawClassification.toUpperCase()
      
      console.log(`Raw AI classification response: "${rawClassification}"`)
      console.log(`Normalized classification: "${classification}"`)
      
      // Validate that it's a valid DocumentDomain
      const validDomains = Object.values(DocumentDomain)
      if (validDomains.includes(classification as DocumentDomain)) {
        console.log(`✅ Document classified as: ${classification}`)
        return classification as DocumentDomain
      } else {
        console.warn(`❌ Invalid classification result: "${classification}"`)
        console.warn(`Valid domains are: ${validDomains.join(', ')}`)
        console.warn(`Defaulting to DEFAULT_SOP`)
        return DocumentDomain.DEFAULT_SOP
      }
      
    } catch (error) {
      console.error('❌ Document classification error:', error)
      console.error('Content preview:', rawContent.substring(0, 200) + '...')
      console.error('Defaulting to DEFAULT_SOP due to classification error')
      return DocumentDomain.DEFAULT_SOP
    }
  }

  /**
   * Process raw content through the complete AI pipeline
   */
  async processContent(
    rawContent: string,
    sourceReferences: SourceReference[],
    changesSummary?: string[]
  ): Promise<AIProcessingResult> {
    const startTime = Date.now()
    let totalTokens = 0

    try {
      // Validate input content
      if (!rawContent || rawContent.trim().length === 0) {
        throw new Error('Unable to process file: No readable content found. The file may be corrupted, in an unsupported format, or empty.')
      }

      // Check for minimal content quality
      if (rawContent.trim().length < 10) {
        throw new Error('Unable to process file: Content is too short or may not have been extracted properly.')
      }

      console.log('Starting PII redaction...')
      console.log(`Input content length: ${rawContent.length} characters`)

      // Step 1: PII Redaction
      const piiResult = await this.piiService.redactPII(rawContent)
      const redactedContent = piiResult.redactedText

      console.log(`PII redaction completed. Found ${piiResult.entities.length} entities`)

      // Step 2: Document Classification
      console.log('Starting document classification...')
      const documentDomain = await this.classifyDocumentType(rawContent)
      
      console.log('Starting content structuring...')
      // Step 3: Domain-Aware Content Structuring
      let structuringPrompt;
      
      if (documentDomain === DocumentDomain.AI_DETERMINED) {
        console.log('🤖 Using AI-determined formatting for unique document type')
        // Use AI to determine the best formatting approach
        structuringPrompt = this.promptTemplates.aiDeterminedFormatting({
          rawContent: redactedContent,
          metadata: {
            sourceCount: sourceReferences.length,
            totalLength: rawContent.length,
            piiEntitiesFound: piiResult.entities.length
          }
        })
      } else {
        console.log(`📋 Using predefined ${documentDomain} template`)
        // Use predefined specialist prompt for known domains
        structuringPrompt = this.promptTemplates.getSpecialistPrompt(documentDomain, {
          sourceContent: [redactedContent],
          sourceType: sourceReferences[0]?.sourceType || 'teams',
          metadata: {
            sourceCount: sourceReferences.length,
            totalLength: rawContent.length,
            piiEntitiesFound: piiResult.entities.length
          }
        })
      }
      const structuringResult = await this.openAIService.chatCompletion([
        { role: 'system', content: structuringPrompt.system },
        { role: 'user', content: structuringPrompt.user }
      ], { temperature: 0.3, maxTokens: 2000 })

      totalTokens += structuringResult.usage.totalTokens
      const structuredContent = structuringResult.content

      // Step 4: Summary Generation (simple extraction from structured content)
      const summary = this.extractSummary(structuredContent)

      // Step 5: Topic Identification
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
      // Step 6: Confidence Assessment
      const sourceMetadata = sourceReferences.map(ref => ({
        type: ref.sourceType,
        authorCount: ref.metadata.author ? 1 : 0,
        messageCount: ref.sourceType === 'teams' ? 1 : undefined,
        fileSize: ref.originalContent.length,
        lastModified: ref.metadata.createdAt || new Date(),
        participants: ref.metadata.author ? [ref.metadata.author] : []
      }))

      let aiAssessment = undefined

      // Analyze original source quality first
      const originalSourceQuality = ConfidenceScoring.analyzeOriginalSourceQuality(rawContent)
      console.log('Original source quality analysis:', originalSourceQuality)

      // Calculate dynamic source quality score
      const sourceQualityScore = originalSourceQuality.rawContentQualityLevel === 'high' ? 0.8 :
                                originalSourceQuality.rawContentQualityLevel === 'medium' ? 0.6 : 0.4

      try {
        // First, get heuristic analysis for AI to reference
        const heuristicAnalysis = this.generateHeuristicAnalysis(structuredContent, sourceMetadata, originalSourceQuality)
        
        // Use dynamic AI-driven confidence scoring as primary method
        const confidencePrompt = this.promptTemplates.dynamicConfidenceScoring({
          structuredContent,
          sourceQuality: sourceQualityScore,
          contentLength: structuredContent.length,
          sourceCount: sourceReferences.length,
          heuristicData: heuristicAnalysis,
          documentType: this.inferDocumentType(structuredContent),
          sourceMetadata: sourceMetadata
        })
        const confidenceResult = await Promise.race([
          this.openAIService.chatCompletion([
            { role: 'system', content: confidencePrompt.system },
            { role: 'user', content: confidencePrompt.user }
          ], { temperature: 0.1, maxTokens: 300 }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI confidence assessment timeout')), 30000)
          )
        ]) as any

        totalTokens += confidenceResult.usage.totalTokens

        // Parse AI confidence assessment with improved error handling
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

        // Validate and clamp scores to 0-1 range
        const validateScore = (score: any): number | undefined => {
          if (typeof score === 'number' && !isNaN(score)) {
            return Math.min(1, Math.max(0, score))
          }
          return undefined
        }

        // Handle both old and new response formats
        if (parsed.overallConfidence && typeof parsed.overallConfidence === 'number') {
          // New dynamic format - AI provides overall score
          aiAssessment = {
            overallScore: validateScore(parsed.overallConfidence),
            factors: {
              contentClarity: validateScore(parsed.factors?.contentClarity),
              sourceConsistency: validateScore(parsed.factors?.factualConsistency || parsed.factors?.informationCompleteness),
              informationDensity: validateScore(parsed.factors?.informationCompleteness || parsed.factors?.actionability),
              authorityScore: validateScore(parsed.factors?.professionalStandards || parsed.factors?.factualConsistency)
            },
            reasoning: typeof parsed.reasoning === 'string' && parsed.reasoning.trim().length > 0 
              ? parsed.reasoning.trim() 
              : undefined,
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : undefined,
            confidenceLevel: typeof parsed.confidenceLevel === 'string' ? parsed.confidenceLevel : undefined
          }
        } else {
          // Legacy format - calculate from factors
          aiAssessment = {
            factors: {
              contentClarity: validateScore(parsed.factors.contentClarity),
              sourceConsistency: validateScore(parsed.factors.factualConsistency),
              informationDensity: validateScore(parsed.factors.informationCompleteness),
              authorityScore: validateScore(parsed.overallConfidence)
            },
            reasoning: typeof parsed.reasoning === 'string' && parsed.reasoning.trim().length > 0 
              ? parsed.reasoning.trim() 
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

        // Fix field mapping in fallback - match the expected field names
        aiAssessment = {
          factors: {
            contentClarity: clarityMatch ? Math.min(1, Math.max(0, parseFloat(clarityMatch[1]))) : undefined,
            sourceConsistency: consistencyMatch ? Math.min(1, Math.max(0, parseFloat(consistencyMatch[1]))) : undefined,
            informationDensity: completenessMatch ? Math.min(1, Math.max(0, parseFloat(completenessMatch[1]))) : undefined,
            authorityScore: overallMatch ? Math.min(1, Math.max(0, parseFloat(overallMatch[1]))) : undefined
          },
          reasoning: undefined // No reasoning available from regex fallback
        }
        
        console.log('Fallback AI Assessment:', aiAssessment)
      }
    } catch (aiError) {
      console.error('AI confidence assessment failed completely:', aiError)
      aiAssessment = undefined
    }

      // originalSourceQuality already analyzed above

      const confidence = ConfidenceScoring.calculateConfidence(
        structuredContent,
        sourceMetadata,
        aiAssessment,
        originalSourceQuality,
        undefined, // Use default weights
        changesSummary
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
   * Generate heuristic analysis for AI reference
   */
  private generateHeuristicAnalysis(content: string, sourceMetadata: any[], originalSourceQuality: any) {
    const words = content.split(/\s+/).filter(w => w.length > 0)
    const lines = content.split('\n').filter(l => l.trim())
    
    // Clarity indicators
    const hasHeadings = /^#{1,6}\s/m.test(content)
    const hasLists = /^\s*[-*+]\s|^\s*\d+\.\s/m.test(content)
    const hasProperSentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10).length > 3
    const hasSections = (content.match(/^#{1,6}\s/gm) || []).length >= 2
    
    const clarityIndicators = [
      hasHeadings && 'headings',
      hasLists && 'lists', 
      hasProperSentences && 'proper sentences',
      hasSections && 'multiple sections'
    ].filter(Boolean).join(', ') || 'minimal structure'

    // Information density
    const uniqueWords = new Set(words.map(w => w.toLowerCase()))
    const repetitionRatio = uniqueWords.size / (words.length || 1)
    const informationDensity = `${(repetitionRatio * 100).toFixed(0)}% unique words, ${words.length} total words`

    // Source consistency
    const sourceConsistency = sourceMetadata.length > 1 
      ? `${sourceMetadata.length} sources, multiple authors`
      : `single source, ${sourceMetadata[0]?.authorCount || 0} authors`

    // Authority indicators
    const isRecent = sourceMetadata.some(s => {
      const age = (Date.now() - new Date(s.lastModified).getTime()) / (1000 * 60 * 60 * 24)
      return age < 90
    })
    const authorityIndicators = [
      isRecent && 'recent content',
      sourceMetadata.length > 1 && 'multiple sources',
      originalSourceQuality?.rawContentQualityLevel === 'high' && 'high source quality'
    ].filter(Boolean).join(', ') || 'limited authority indicators'

    // Detected issues
    const detectedIssues = []
    if (content.length < 200) detectedIssues.push('very short content')
    if (!hasHeadings) detectedIssues.push('no headings')
    if (!hasLists && !hasProperSentences) detectedIssues.push('poor structure')
    if (repetitionRatio < 0.3) detectedIssues.push('highly repetitive')
    if (originalSourceQuality?.rawContentQualityLevel === 'low') detectedIssues.push('poor source quality')

    return {
      clarityIndicators,
      informationDensity,
      sourceConsistency,
      authorityIndicators,
      detectedIssues
    }
  }

  /**
   * Infer document type from content
   */
  private inferDocumentType(content: string): string {
    const lowerContent = content.toLowerCase()
    
    if (lowerContent.includes('procedure') || lowerContent.includes('steps') || lowerContent.includes('process')) {
      return 'Standard Operating Procedure'
    } else if (lowerContent.includes('policy') || lowerContent.includes('guidelines') || lowerContent.includes('rules')) {
      return 'Policy Document'
    } else if (lowerContent.includes('handbook') || lowerContent.includes('manual')) {
      return 'Reference Manual'
    } else if (lowerContent.includes('contact') || lowerContent.includes('directory')) {
      return 'Contact Directory'
    } else if (lowerContent.includes('plan') || lowerContent.includes('strategy')) {
      return 'Strategic Document'
    } else {
      return 'Business Document'
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