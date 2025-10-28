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
    weights: ConfidenceWeights = ConfidenceScoring.DEFAULT_WEIGHTS
  ): ConfidenceResult {
    const factors = this.calculateFactors(content, sourceMetadata, aiAssessment, originalSourceQuality)
    let score = this.calculateWeightedScore(factors, weights)
    
    // Apply source quality penalty
    const sourceQualityPenalty = originalSourceQuality ? this.calculateSourceQualityPenalty(originalSourceQuality) : 0
    score = Math.max(0, score - sourceQualityPenalty)
    
    const level = this.determineLevel(score)
    const reasoning = this.generateReasoning(factors, score, level, originalSourceQuality, sourceQualityPenalty)

    return {
      score,
      level,
      factors,
      reasoning,
      sourceQualityPenalty
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

    // Much stricter heuristic fallback - require multiple positive indicators
    let score = 0.1 // Very low base score

    // Check for structure indicators (require multiple for high scores)
    const hasHeadings = /^#{1,6}\s/m.test(content)
    const hasNumberedLists = /^\s*\d+\.\s/m.test(content)
    const hasBulletPoints = /^\s*[-*+]\s/m.test(content)
    const hasProperSentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10).length > 3
    const hasGoodStructure = content.includes('\n\n') && content.length > 300
    const hasSections = (content.match(/^#{1,6}\s/gm) || []).length >= 2

    // Count positive indicators
    let positiveIndicators = 0
    if (hasHeadings) positiveIndicators++
    if (hasNumberedLists) positiveIndicators++
    if (hasBulletPoints) positiveIndicators++
    if (hasProperSentences) positiveIndicators++
    if (hasGoodStructure) positiveIndicators++
    if (hasSections) positiveIndicators++

    // Require multiple indicators for decent scores
    if (positiveIndicators >= 5) score = 0.8  // Excellent structure
    else if (positiveIndicators >= 4) score = 0.65
    else if (positiveIndicators >= 3) score = 0.5
    else if (positiveIndicators >= 2) score = 0.35
    else if (positiveIndicators >= 1) score = 0.2

    // Heavy penalties for poor content
    if (content.length < 150) score *= 0.3  // Very short content
    else if (content.length < 300) score *= 0.6
    
    if (content.split('\n').length < 5) score *= 0.5  // Not enough lines
    
    // Penalize lack of proper formatting
    if (!hasHeadings && !hasNumberedLists) score *= 0.6

    // Check readability (stricter requirements)
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 5)
    const avgSentenceLength = content.length / (sentences.length || 1)
    if (avgSentenceLength > 20 && avgSentenceLength < 120) {
      score += 0.05  // Small bonus for good readability
    }

    // Apply penalty if final structure is much better than original source
    if (originalSourceQuality) {
      const structureImprovement = score - originalSourceQuality.rawContentStructureScore
      if (structureImprovement > 0.4) {
        // Significant AI enhancement - apply moderate penalty
        score *= 0.9
        console.log(`Applied structure enhancement penalty: final clarity reduced by 10%`)
      }
    }

    console.log(`Heuristic contentClarity: ${score.toFixed(2)} (indicators: ${positiveIndicators}/6, length: ${content.length})`)
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

    // Very aggressive noise detection for SOPs/wikis
    const noisePatterns = [
      /\b(um|uh|like|you know|basically|actually|whatever|stuff|things?|kinda|sorta|just|really)\b/gi,
      /\b(thanks|thank you|please|hi|hello|bye|ok|okay|yeah|yes|no|sure)\b/gi,
      /[.]{2,}/g, // Multiple dots
      /\s+/g, // Multiple spaces
      /\b(lol|haha|hmm|well|so|but|and then|i think|maybe|probably|guess|suppose)\b/gi,
      /\b(idk|tbh|btw|fyi|asap|etc)\b/gi // Common abbreviations that add noise
    ]

    let cleanContent = content
    noisePatterns.forEach(pattern => {
      cleanContent = cleanContent.replace(pattern, ' ')
    })

    const cleanLength = cleanContent.trim().length
    let density = cleanLength / totalLength

    // Extremely strict penalties for short content
    if (totalLength < 100) density *= 0.2  // Increased penalty
    else if (totalLength < 200) density *= 0.4  // Increased penalty
    else if (totalLength < 400) density *= 0.6  // Increased penalty

    // Stricter penalties for repetitive content
    const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const uniqueWords = new Set(words)
    const repetitionRatio = uniqueWords.size / (words.length || 1)
    
    if (repetitionRatio < 0.4) density *= 0.4  // Very repetitive
    else if (repetitionRatio < 0.6) density *= 0.7  // Somewhat repetitive

    // Penalize content with too many questions (indicates uncertainty)
    const questionCount = (content.match(/\?/g) || []).length
    if (questionCount > 3) density *= 0.8

    // Very small bonus for structure, only if content is substantial and well-formatted
    const structureBonus = (totalLength > 300 && /^\s*\d+\.\s/m.test(content)) ? 0.03 : 0

    // Apply penalty based on original source quality
    if (originalSourceQuality) {
      const lengthExpansion = totalLength / (originalSourceQuality.rawContentLength || 1)
      
      // If AI significantly expanded very short source, apply penalty
      if (originalSourceQuality.rawContentLength < 200 && lengthExpansion > 2) {
        density *= 0.7 // 30% penalty for significant expansion of short source
        console.log(`Applied expansion penalty: original ${originalSourceQuality.rawContentLength} chars expanded to ${totalLength}`)
      }
      
      // If original had very low unique word ratio, apply penalty
      if (originalSourceQuality.rawContentUniqueWordRatio < 0.4) {
        density *= 0.8 // 20% penalty for poor original vocabulary
        console.log(`Applied vocabulary penalty: original unique ratio ${originalSourceQuality.rawContentUniqueWordRatio.toFixed(2)}`)
      }
    }

    console.log(`Information density: ${(density + structureBonus).toFixed(2)} (clean: ${cleanLength}/${totalLength}, unique: ${repetitionRatio.toFixed(2)})`)
    return Math.min(1, density + structureBonus)
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
    sourceQualityPenalty?: number
  ): string {
    const strengths: string[] = []
    const weaknesses: string[] = []

    // Analyze each factor
    if (factors.contentClarity >= 0.7) {
      strengths.push('well-structured content')
    } else if (factors.contentClarity < 0.4) {
      weaknesses.push('unclear or unstructured content')
    }

    if (factors.sourceConsistency >= 0.7) {
      strengths.push('consistent across multiple sources')
    } else if (factors.sourceConsistency < 0.4) {
      weaknesses.push('limited source validation')
    }

    if (factors.informationDensity >= 0.7) {
      strengths.push('high information density')
    } else if (factors.informationDensity < 0.4) {
      weaknesses.push('low information content')
    }

    if (factors.authorityScore >= 0.7) {
      strengths.push('authoritative sources')
    } else if (factors.authorityScore < 0.4) {
      weaknesses.push('questionable source authority')
    }

    let reasoning = `Confidence: ${Math.round(score * 100)}% (${level}). `

    if (strengths.length > 0) {
      reasoning += `Strengths: ${strengths.join(', ')}. `
    }

    if (weaknesses.length > 0) {
      reasoning += `Areas for review: ${weaknesses.join(', ')}.`
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
   * Calculate penalty based on original source quality
   */
  private static calculateSourceQualityPenalty(originalSourceQuality: OriginalSourceQuality): number {
    const { rawContentQualityLevel, rawContentLength, rawContentStructureScore } = originalSourceQuality
    
    let penalty = 0
    
    // Base penalty by quality level
    switch (rawContentQualityLevel) {
      case 'low':
        penalty = 0.15 // 15% penalty for poor source
        break
      case 'medium':
        penalty = 0.05 // 5% penalty for medium source
        break
      case 'high':
        penalty = 0 // No penalty for high-quality source
        break
    }
    
    // Additional penalties for very poor sources
    if (rawContentLength < 100) penalty += 0.1 // Very short source
    if (rawContentStructureScore < 0.3) penalty += 0.1 // Very poor structure
    
    return Math.min(0.25, penalty) // Cap penalty at 25%
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