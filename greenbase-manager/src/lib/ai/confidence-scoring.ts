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

export interface ConfidenceResult {
  score: number
  level: 'green' | 'yellow' | 'red'
  factors: ConfidenceFactors
  reasoning: string
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
  private static readonly DEFAULT_WEIGHTS: ConfidenceWeights = {
    contentClarity: 0.3,
    sourceConsistency: 0.3,
    informationDensity: 0.2,
    authorityScore: 0.2
  }

  private static readonly GREEN_THRESHOLD = 0.8
  private static readonly YELLOW_THRESHOLD = 0.5

  static calculateConfidence(
    content: string,
    sourceMetadata: SourceMetadata[],
    aiAssessment?: any,
    weights: ConfidenceWeights = ConfidenceScoring.DEFAULT_WEIGHTS
  ): ConfidenceResult {
    const factors = this.calculateFactors(content, sourceMetadata, aiAssessment)
    const score = this.calculateWeightedScore(factors, weights)
    const level = this.determineLevel(score)
    const reasoning = this.generateReasoning(factors, score, level)

    return {
      score,
      level,
      factors,
      reasoning
    }
  }

  private static calculateFactors(
    content: string,
    sourceMetadata: SourceMetadata[],
    aiAssessment?: any
  ): ConfidenceFactors {
    return {
      contentClarity: this.assessContentClarity(content, aiAssessment),
      sourceConsistency: this.assessSourceConsistency(sourceMetadata),
      informationDensity: this.assessInformationDensity(content),
      authorityScore: this.assessAuthorityScore(sourceMetadata)
    }
  }

  private static assessContentClarity(content: string, aiAssessment?: any): number {
    // Use AI assessment if available
    if (aiAssessment?.factors?.contentClarity) {
      return aiAssessment.factors.contentClarity
    }

    // Fallback to heuristic assessment
    let score = 0.5 // Base score

    // Check for structure indicators
    const hasHeadings = /^#{1,6}\s/.test(content) || /^[A-Z][^.!?]*:/.test(content)
    const hasBulletPoints = /^\s*[-*+]\s/m.test(content) || /^\s*\d+\.\s/m.test(content)
    const hasProperSentences = content.split(/[.!?]+/).length > 2

    if (hasHeadings) score += 0.15
    if (hasBulletPoints) score += 0.1
    if (hasProperSentences) score += 0.15

    // Check readability
    const avgSentenceLength = content.length / (content.split(/[.!?]+/).length || 1)
    if (avgSentenceLength > 20 && avgSentenceLength < 100) score += 0.1

    return Math.min(1, score)
  }

  private static assessSourceConsistency(sourceMetadata: SourceMetadata[]): number {
    if (sourceMetadata.length <= 1) return 0.7 // Single source gets moderate score

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

  private static assessInformationDensity(content: string): number {
    const totalLength = content.length
    if (totalLength === 0) return 0

    // Remove common noise words and patterns
    const noisePatterns = [
      /\b(um|uh|like|you know|basically|actually)\b/gi,
      /\b(thanks|thank you|please|hi|hello|bye)\b/gi,
      /[.]{2,}/g, // Multiple dots
      /\s+/g // Multiple spaces
    ]

    let cleanContent = content
    noisePatterns.forEach(pattern => {
      cleanContent = cleanContent.replace(pattern, ' ')
    })

    const cleanLength = cleanContent.trim().length
    const density = cleanLength / totalLength

    // Adjust for content length - very short content gets penalized
    let score = density
    if (totalLength < 100) score *= 0.7
    else if (totalLength < 300) score *= 0.85

    // Bonus for structured content
    const structureBonus = /^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s/m.test(content) ? 0.1 : 0

    return Math.min(1, score + structureBonus)
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
    level: 'green' | 'yellow' | 'red'
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

    return reasoning.trim()
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