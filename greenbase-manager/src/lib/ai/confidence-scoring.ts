export interface ConfidenceFactors {
  contentClarity: number      // 0-1: Readability and structure
  sourceConsistency: number   // 0-1: Agreement across sources  
  informationDensity: number  // 0-1: Useful content ratio
  authorityScore: number      // 0-1: Source credibility
}

export interface ConfidenceWeights {
  contentClarity: number
  sourceConsistency: number
  informationDensity: number
  authorityScore: number
}

export interface OriginalSourceQuality {
  rawContentLength: number
  rawContentLineCount: number
  rawContentUniqueWordRatio: number
  rawContentStructureScore: number
  rawContentQualityLevel: 'high' | 'medium' | 'low'
}

export interface ConfidenceResult {
  score: number
  level: 'green' | 'yellow' | 'red'
  factors: ConfidenceFactors
  reasoning: string
  sourceQualityPenalty?: number
  aiDriven?: boolean
  recommendations?: string[]
  confidenceLevel?: string
}

export interface SourceMetadata {
  type: 'teams' | 'google_drive'
  authorCount: number
  messageCount?: number
  fileSize?: number
  lastModified: Date
  participants?: string[]
}

export class ConfidenceScoring {
  // Stricter weights prioritizing clarity and density for SOPs/wikis
  private static readonly DEFAULT_WEIGHTS: ConfidenceWeights = {
    contentClarity: 0.4,        // Most important for SOPs
    informationDensity: 0.3,    // High-quality content should be dense
    sourceConsistency: 0.2,     // Less critical for single documents
    authorityScore: 0.1         // Least critical factor
  }

  // Balanced thresholds - high-quality documents can achieve green
  private static readonly GREEN_THRESHOLD = 0.80  // Balanced threshold for quality docs
  private static readonly YELLOW_THRESHOLD = 0.60 // Maintained higher standard

  static calculateConfidence(
    content: string,
    sourceMetadata: SourceMetadata[],
    aiAssessment?: any,
    originalSourceQuality?: OriginalSourceQuality,
    weights: ConfidenceWeights = ConfidenceScoring.DEFAULT_WEIGHTS,
    changesSummary?: string[]
  ): ConfidenceResult {
    // Prioritize AI's overall score if available (dynamic scoring)
    if (aiAssessment?.overallScore && typeof aiAssessment.overallScore === 'number') {
      console.log('🤖 Using AI-determined overall confidence score:', aiAssessment.overallScore)

      let score = aiAssessment.overallScore

      // Apply minimal source quality penalty for very poor sources
      const sourceQualityPenalty = originalSourceQuality?.rawContentQualityLevel === 'low' ? 0.05 : 0
      score = Math.max(0, score - sourceQualityPenalty)

      const level = this.determineLevel(score)
      const factors = this.calculateFactors(content, sourceMetadata, aiAssessment, originalSourceQuality)

      // Use AI reasoning if available, otherwise generate
      const reasoning = aiAssessment.reasoning ||
        this.generateReasoning(factors, score, level, originalSourceQuality, sourceQualityPenalty, changesSummary, aiAssessment)

      return {
        score,
        level,
        factors,
        reasoning,
        sourceQualityPenalty,
        aiDriven: true,
        recommendations: aiAssessment.recommendations,
        confidenceLevel: aiAssessment.confidenceLevel
      }
    }

    // Fallback to heuristic scoring
    console.log('📊 Using heuristic confidence scoring (AI assessment unavailable)')
    const factors = this.calculateFactors(content, sourceMetadata, aiAssessment, originalSourceQuality)
    let score = this.calculateWeightedScore(factors, weights)

    // Apply source quality penalty
    const sourceQualityPenalty = originalSourceQuality ? this.calculateSourceQualityPenalty(originalSourceQuality) : 0
    score = Math.max(0, score - sourceQualityPenalty)

    const level = this.determineLevel(score)
    const reasoning = this.generateReasoning(factors, score, level, originalSourceQuality, sourceQualityPenalty, changesSummary, aiAssessment)

    return {
      score,
      level,
      factors,
      reasoning,
      sourceQualityPenalty,
      aiDriven: false
    }
  }

  private static calculateFactors(
    content: string,
    sourceMetadata: SourceMetadata[],
    aiAssessment?: any,
    originalSourceQuality?: OriginalSourceQuality
  ): ConfidenceFactors {
    return {
      contentClarity: this.assessContentClarity(content, aiAssessment, originalSourceQuality),
      sourceConsistency: this.assessSourceConsistency(sourceMetadata),
      informationDensity: this.assessInformationDensity(content, originalSourceQuality),
      authorityScore: this.assessAuthorityScore(sourceMetadata)
    }
  }

  private static assessContentClarity(content: string, aiAssessment?: any, originalSourceQuality?: OriginalSourceQuality): number {
    // Use AI assessment if available
    if (aiAssessment?.factors?.contentClarity !== undefined) {
      console.log('Using AI contentClarity:', aiAssessment.factors.contentClarity)
      return aiAssessment.factors.contentClarity
    }

    // Assess the final content quality regardless of source
    let score = 0.1 // Base score

    // Check for structure indicators
    const hasHeadings = /^#{1,6}\s/m.test(content)
    const hasNumberedLists = /^\s*\d+\.\s/m.test(content)
    const hasBulletPoints = /^\s*[-*+]\s/m.test(content)
    const hasProperSentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10).length > 3
    const hasGoodStructure = content.includes('\n\n') && content.length > 300
    const hasSections = (content.match(/^#{1,6}\s/gm) || []).length >= 2
    const hasFormattedText = /\*\*[^*]+\*\*/.test(content) // Bold text
    const hasCoherentParagraphs = content.split('\n\n').filter(p => p.trim().length > 50).length >= 2

    // Count positive indicators
    let positiveIndicators = 0
    if (hasHeadings) positiveIndicators++
    if (hasNumberedLists) positiveIndicators++
    if (hasBulletPoints) positiveIndicators++
    if (hasProperSentences) positiveIndicators++
    if (hasGoodStructure) positiveIndicators++
    if (hasSections) positiveIndicators++
    if (hasFormattedText) positiveIndicators++
    if (hasCoherentParagraphs) positiveIndicators++

    // Score based on indicators (more generous for well-structured content)
    if (positiveIndicators >= 6) score = 0.9   // Excellent structure
    else if (positiveIndicators >= 5) score = 0.8  // Very good structure
    else if (positiveIndicators >= 4) score = 0.7  // Good structure
    else if (positiveIndicators >= 3) score = 0.6  // Decent structure
    else if (positiveIndicators >= 2) score = 0.4  // Basic structure
    else if (positiveIndicators >= 1) score = 0.25 // Minimal structure

    // Check for content quality indicators
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length
    const avgWordsPerSentence = wordCount / (content.split(/[.!?]+/).length || 1)
    const hasGoodLength = content.length >= 500 && content.length <= 10000
    const hasVariedSentenceLength = content.split(/[.!?]+/).map(s => s.trim().split(/\s+/).length).filter(l => l > 5 && l < 30).length > 3

    // Bonuses for quality content
    if (hasGoodLength) score += 0.1
    if (avgWordsPerSentence > 8 && avgWordsPerSentence < 25) score += 0.05
    if (hasVariedSentenceLength) score += 0.05

    // Special handling for AI-enhanced content from poor sources
    if (originalSourceQuality && originalSourceQuality.rawContentQualityLevel === 'low') {
      // If the final content is well-structured despite poor source, give AI credit
      if (score >= 0.7 && positiveIndicators >= 5) {
        console.log('🤖 AI successfully enhanced poor source content - applying bonus')
        score = Math.min(1.0, score + 0.1) // 10% bonus for successful AI enhancement
      } else if (score >= 0.5 && positiveIndicators >= 3) {
        console.log('🤖 AI moderately enhanced poor source content')
        score = Math.min(1.0, score + 0.05) // 5% bonus for moderate enhancement
      }
    }

    // Only apply minor penalties for very poor final content
    if (content.length < 100) score *= 0.4  // Very short content
    else if (content.length < 200) score *= 0.7

    console.log(`Content clarity: ${score.toFixed(2)} (indicators: ${positiveIndicators}/8, words: ${wordCount}, source: ${originalSourceQuality?.rawContentQualityLevel || 'unknown'})`)
    return Math.min(1, score)
  }

  private static assessSourceConsistency(sourceMetadata: SourceMetadata[]): number {
    if (sourceMetadata.length <= 1) return 0.7 // Single source gets moderate score - not penalized too harshly

    // Multiple sources increase consistency confidence
    const sourceCount = sourceMetadata.length
    let score = Math.min(0.9, 0.5 + (sourceCount - 1) * 0.1)

    // Check for diverse source types
    const sourceTypes = new Set(sourceMetadata.map(s => s.type))
    if (sourceTypes.size > 1) score += 0.1

    // Check for multiple authors
    const totalAuthors = sourceMetadata.reduce((sum, s) => sum + s.authorCount, 0)
    if (totalAuthors > 2) score += 0.1

    return Math.min(1, score)
  }

  private static assessInformationDensity(content: string, originalSourceQuality?: OriginalSourceQuality): number {
    const totalLength = content.length
    if (totalLength === 0) return 0

    // Moderate noise detection - focus on final content quality
    const noisePatterns = [
      /\b(um|uh|like|you know|basically|whatever|stuff|things?|kinda|sorta)\b/gi,
      /[.]{3,}/g, // Multiple dots (but allow ellipsis)
      /\s{3,}/g, // Multiple spaces
      /\b(lol|haha|hmm)\b/gi
    ]

    let cleanContent = content
    noisePatterns.forEach(pattern => {
      cleanContent = cleanContent.replace(pattern, ' ')
    })

    const cleanLength = cleanContent.trim().length
    let density = cleanLength / totalLength

    // More reasonable penalties for short content
    if (totalLength < 100) density *= 0.5
    else if (totalLength < 200) density *= 0.7
    else if (totalLength < 300) density *= 0.85

    // Check vocabulary diversity
    const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const uniqueWords = new Set(words)
    const repetitionRatio = uniqueWords.size / (words.length || 1)

    if (repetitionRatio < 0.3) density *= 0.6  // Very repetitive
    else if (repetitionRatio < 0.5) density *= 0.8  // Somewhat repetitive
    else if (repetitionRatio > 0.7) density += 0.05 // Good vocabulary diversity

    // Check for informational content indicators
    const hasDefinitions = /:\s*[A-Z]/.test(content) // Colon followed by definition
    const hasExamples = /\b(example|for instance|such as|including)\b/gi.test(content)
    const hasInstructions = /\b(step|procedure|process|method|how to)\b/gi.test(content)
    const hasSpecificDetails = /\b\d+\b/.test(content) // Contains numbers/specifics

    let informationBonus = 0
    if (hasDefinitions) informationBonus += 0.05
    if (hasExamples) informationBonus += 0.05
    if (hasInstructions) informationBonus += 0.05
    if (hasSpecificDetails) informationBonus += 0.03

    // Bonus for well-structured content
    const structureBonus = (totalLength > 300 && /^#{1,6}\s/m.test(content)) ? 0.05 : 0

    // Special handling for AI-enhanced content
    if (originalSourceQuality && originalSourceQuality.rawContentQualityLevel === 'low') {
      // If AI created coherent, informative content from poor source, reward it
      if (density > 0.7 && repetitionRatio > 0.6) {
        console.log('🤖 AI created high-density content from poor source')
        density = Math.min(1.0, density + 0.1) // Bonus for successful content creation
      }
    }

    const finalDensity = Math.min(1, density + informationBonus + structureBonus)
    console.log(`Information density: ${finalDensity.toFixed(2)} (clean: ${cleanLength}/${totalLength}, unique: ${repetitionRatio.toFixed(2)}, bonuses: ${(informationBonus + structureBonus).toFixed(2)})`)
    return finalDensity
  }

  private static assessAuthorityScore(sourceMetadata: SourceMetadata[]): number {
    let score = 0.5 // Base score

    // Recent content gets higher authority
    const now = new Date()
    const avgAge = sourceMetadata.reduce((sum, s) => {
      const ageInDays = (now.getTime() - s.lastModified.getTime()) / (1000 * 60 * 60 * 24)
      return sum + ageInDays
    }, 0) / sourceMetadata.length

    if (avgAge < 30) score += 0.2      // Very recent
    else if (avgAge < 90) score += 0.1  // Recent
    else if (avgAge > 365) score -= 0.1 // Old content

    // Multiple participants increase authority
    const totalParticipants = sourceMetadata.reduce((sum, s) => {
      return sum + (s.participants?.length || s.authorCount)
    }, 0)

    if (totalParticipants > 5) score += 0.2
    else if (totalParticipants > 2) score += 0.1

    // Teams messages with high interaction get bonus
    const teamsMetadata = sourceMetadata.filter(s => s.type === 'teams')
    if (teamsMetadata.length > 0) {
      const avgMessages = teamsMetadata.reduce((sum, s) => sum + (s.messageCount || 1), 0) / teamsMetadata.length
      if (avgMessages > 10) score += 0.1
    }

    return Math.min(1, Math.max(0, score))
  }

  private static calculateWeightedScore(
    factors: ConfidenceFactors,
    weights: ConfidenceWeights
  ): number {
    return (
      factors.contentClarity * weights.contentClarity +
      factors.sourceConsistency * weights.sourceConsistency +
      factors.informationDensity * weights.informationDensity +
      factors.authorityScore * weights.authorityScore
    )
  }

  private static determineLevel(score: number): 'green' | 'yellow' | 'red' {
    if (score >= this.GREEN_THRESHOLD) return 'green'
    if (score >= this.YELLOW_THRESHOLD) return 'yellow'
    return 'red'
  }

  private static generateReasoning(
    factors: ConfidenceFactors,
    score: number,
    level: 'green' | 'yellow' | 'red',
    originalSourceQuality?: OriginalSourceQuality,
    sourceQualityPenalty?: number,
    changesSummary?: string[],
    aiAssessment?: any
  ): string {
    // Prioritize AI-specific reasoning if available
    if (aiAssessment?.reasoning && typeof aiAssessment.reasoning === 'string' && aiAssessment.reasoning.trim().length > 10) {
      console.log('🤖 Using AI-specific reasoning for Dan\'s assessment')
      let reasoning = `${Math.round(score * 100)}% confidence. ${aiAssessment.reasoning}`

      // Add change information if this is an update
      if (changesSummary && changesSummary.length > 0) {
        reasoning += ` Changes: ${changesSummary.join(', ')}.`
      }

      // Add source quality information
      if (originalSourceQuality) {
        reasoning += ` Source quality: ${originalSourceQuality.rawContentQualityLevel} (${originalSourceQuality.rawContentLength} chars).`

        if (sourceQualityPenalty && sourceQualityPenalty > 0) {
          reasoning += ` Applied ${Math.round(sourceQualityPenalty * 100)}% penalty for source quality.`
        }
      }

      return reasoning.trim()
    }

    console.log('📋 Using fallback generic reasoning')
    const strengths: string[] = []
    const weaknesses: string[] = []

    // Analyze each factor with specific, actionable feedback
    if (factors.contentClarity >= 0.7) {
      strengths.push('document has clear headings, proper formatting, and logical flow')
    } else if (factors.contentClarity < 0.4) {
      weaknesses.push('document lacks structure - missing headings, poor formatting, or confusing organization')
    }

    if (factors.sourceConsistency >= 0.7) {
      strengths.push('information verified across multiple team discussions or documents')
    } else if (factors.sourceConsistency < 0.4) {
      weaknesses.push('only one source found - may need additional verification from team members')
    }

    if (factors.informationDensity >= 0.7) {
      strengths.push('packed with useful details, procedures, and actionable information')
    } else if (factors.informationDensity < 0.4) {
      weaknesses.push('mostly filler content with few actionable details or specific procedures')
    }

    if (factors.authorityScore >= 0.7) {
      strengths.push('created by experienced team members or subject matter experts')
    } else if (factors.authorityScore < 0.4) {
      weaknesses.push('source credibility unclear - may need review by domain experts')
    }

    // Generate a specific explanation based on the actual issues found
    let explanation = ""
    if (level === 'green') {
      explanation = "Ready to publish - this document meets quality standards for team use."
    } else if (level === 'yellow') {
      explanation = "Needs minor cleanup - usable now but could be improved before publishing."
    } else {
      explanation = "Requires significant work - major issues that could confuse or mislead users."
    }

    let reasoning = `${Math.round(score * 100)}% confidence. ${explanation}`

    // Add change information if this is an update
    if (changesSummary && changesSummary.length > 0) {
      reasoning += ` Changes: ${changesSummary.join(', ')}.`
    }

    if (strengths.length > 0) {
      reasoning += ` Good: ${strengths.join('; ')}.`
    }

    if (weaknesses.length > 0) {
      reasoning += ` Issues: ${weaknesses.join('; ')}.`
    }

    // Add source quality information
    if (originalSourceQuality) {
      reasoning += ` Source quality: ${originalSourceQuality.rawContentQualityLevel} (${originalSourceQuality.rawContentLength} chars).`

      if (sourceQualityPenalty && sourceQualityPenalty > 0) {
        reasoning += ` Applied ${Math.round(sourceQualityPenalty * 100)}% penalty for source quality.`
      }
    }

    return reasoning.trim()
  }

  /**
   * Analyze the quality of original source content
   */
  static analyzeOriginalSourceQuality(rawContent: string): OriginalSourceQuality {
    const rawContentLength = rawContent.length
    const lines = rawContent.split('\n').filter(line => line.trim())
    const rawContentLineCount = lines.length

    // Calculate unique word ratio
    const words = rawContent.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const uniqueWords = new Set(words)
    const rawContentUniqueWordRatio = words.length > 0 ? uniqueWords.size / words.length : 0

    // Assess structure quality of original content
    const rawContentStructureScore = this.assessRawContentStructure(rawContent)

    // Determine overall quality level
    let rawContentQualityLevel: 'high' | 'medium' | 'low' = 'low'

    if (rawContentStructureScore >= 0.7 && rawContentLength >= 500 && rawContentUniqueWordRatio >= 0.6) {
      rawContentQualityLevel = 'high'
    } else if (rawContentStructureScore >= 0.4 && rawContentLength >= 200 && rawContentUniqueWordRatio >= 0.4) {
      rawContentQualityLevel = 'medium'
    }

    return {
      rawContentLength,
      rawContentLineCount,
      rawContentUniqueWordRatio,
      rawContentStructureScore,
      rawContentQualityLevel
    }
  }

  /**
   * Assess the structural quality of raw content
   */
  private static assessRawContentStructure(rawContent: string): number {
    let score = 0.1 // Base score

    // Check for basic structure indicators
    const hasHeadings = /^#{1,6}\s|^[A-Z][^.!?]*:\s*$/m.test(rawContent)
    const hasLists = /^\s*[-*+]\s|^\s*\d+\.\s/m.test(rawContent)
    const hasParagraphs = rawContent.includes('\n\n')
    const hasProperSentences = rawContent.split(/[.!?]+/).filter(s => s.trim().length > 10).length > 2
    const hasMinimalLength = rawContent.length > 100

    // Positive indicators
    if (hasHeadings) score += 0.2
    if (hasLists) score += 0.15
    if (hasParagraphs) score += 0.15
    if (hasProperSentences) score += 0.2
    if (hasMinimalLength) score += 0.1

    // Negative indicators (fragmented content)
    const hasFragmentedLines = rawContent.split('\n').filter(line =>
      line.trim().length > 0 && line.trim().length < 20
    ).length > rawContent.split('\n').length * 0.5

    const hasExcessiveAbbreviations = (rawContent.match(/\b\w{1,3}\b/g) || []).length >
      (rawContent.split(/\s+/).length * 0.3)

    if (hasFragmentedLines) score *= 0.6
    if (hasExcessiveAbbreviations) score *= 0.7

    return Math.min(1, score)
  }

  /**
   * Calculate penalty based on original source quality (reduced penalties)
   */
  private static calculateSourceQualityPenalty(originalSourceQuality: OriginalSourceQuality): number {
    const { rawContentQualityLevel, rawContentLength, rawContentStructureScore } = originalSourceQuality

    let penalty = 0

    // Reduced base penalty by quality level - focus on final output quality
    switch (rawContentQualityLevel) {
      case 'low':
        penalty = 0.05 // Reduced from 15% to 5% - AI can enhance poor sources
        break
      case 'medium':
        penalty = 0.02 // Reduced from 5% to 2%
        break
      case 'high':
        penalty = 0 // No penalty for high-quality source
        break
    }

    // Only apply additional penalties for extremely poor sources
    if (rawContentLength < 50) penalty += 0.05 // Very short source (reduced)
    if (rawContentStructureScore < 0.1) penalty += 0.05 // Extremely poor structure (reduced)

    return Math.min(0.1, penalty) // Cap penalty at 10% (reduced from 25%)
  }

  // Utility method for custom weight configurations
  static createCustomWeights(
    contentClarity: number,
    sourceConsistency: number,
    informationDensity: number,
    authorityScore: number
  ): ConfidenceWeights {
    const total = contentClarity + sourceConsistency + informationDensity + authorityScore

    if (Math.abs(total - 1.0) > 0.01) {
      throw new Error('Confidence weights must sum to 1.0')
    }

    return {
      contentClarity,
      sourceConsistency,
      informationDensity,
      authorityScore
    }
  }
}

export default ConfidenceScoring