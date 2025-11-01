import { getAzureOpenAIService } from './azure-openai'
import { getSupabaseAdmin } from '../supabase-admin'

export interface DocumentForCategorization {
  id: string
  title: string
  content: string
  summary?: string
  topics?: string[]
  tags?: string[]
  source_type?: 'teams' | 'google_drive'
  embedding?: number[]
}

export interface CategorySuggestion {
  name: string
  description: string
  confidence: number
  documentIds: string[]
  keywords: string[]
  reasoning: string
}

export interface CategorizationResult {
  categories: CategorySuggestion[]
  uncategorized: string[]
  processingTime: number
  tokensUsed: number
}

class DocumentCategorizationService {
  private openAIService = getAzureOpenAIService()

  /**
   * Analyze documents and suggest intelligent categories
   */
  async categorizeDocuments(
    documents: DocumentForCategorization[],
    organizationId: string
  ): Promise<CategorizationResult> {
    const startTime = Date.now()
    let totalTokens = 0

    try {
      console.log(`Starting categorization for ${documents.length} documents`)

      // Step 1: Extract key themes and concepts from all documents
      const documentAnalyses = await this.analyzeDocumentThemes(documents)
      totalTokens += documentAnalyses.tokensUsed

      // Step 2: Group documents by similarity using AI
      const groupingResult = await this.groupSimilarDocuments(documents, documentAnalyses.themes)
      totalTokens += groupingResult.tokensUsed

      // Step 3: Generate intelligent category names and descriptions
      const categories = await this.generateCategoryNames(groupingResult.groups, documents)
      totalTokens += categories.tokensUsed

      // Step 4: Validate and refine categories
      const refinedCategories = await this.refineCategorization(categories.suggestions, documents)
      totalTokens += refinedCategories.tokensUsed

      const processingTime = Date.now() - startTime
      console.log(`Categorization completed in ${processingTime}ms, used ${totalTokens} tokens`)

      return {
        categories: refinedCategories.categories,
        uncategorized: refinedCategories.uncategorized,
        processingTime,
        tokensUsed: totalTokens
      }

    } catch (error) {
      console.error('Document categorization error:', error)
      throw new Error(`Categorization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Analyze themes and concepts across all documents
   */
  private async analyzeDocumentThemes(documents: DocumentForCategorization[]): Promise<{
    themes: Array<{ theme: string, keywords: string[], documentIds: string[] }>
    tokensUsed: number
  }> {
    const prompt = `Analyze the following documents and identify common themes, concepts, and patterns. 
    Focus on business functions, document types, processes, and subject areas.

    Documents to analyze:
    ${documents.map((doc, index) => `
    Document ${index + 1} (ID: ${doc.id}):
    Title: ${doc.title}
    Summary: ${doc.summary || 'No summary available'}
    Topics: ${doc.topics?.join(', ') || 'None'}
    Content Preview: ${doc.content.substring(0, 300)}...
    `).join('\n')}

    Please identify 5-8 major themes that emerge from these documents. For each theme, provide:
    1. Theme name (concise, business-friendly)
    2. Key keywords that represent this theme
    3. Which document IDs belong to this theme

    Respond in JSON format:
    {
      "themes": [
        {
          "theme": "Human Resources Policies",
          "keywords": ["hr", "policy", "employee", "benefits", "procedures"],
          "documentIds": ["doc1", "doc2"]
        }
      ]
    }`

    const result = await this.openAIService.chatCompletion([
      { role: 'system', content: 'You are an expert document analyst specializing in business content categorization.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.3, maxTokens: 1500 })

    try {
      const parsed = JSON.parse(result.content)
      return {
        themes: parsed.themes || [],
        tokensUsed: result.usage.totalTokens
      }
    } catch (error) {
      console.warn('Failed to parse theme analysis, using fallback')
      return {
        themes: this.fallbackThemeAnalysis(documents),
        tokensUsed: result.usage.totalTokens
      }
    }
  }

  /**
   * Group similar documents using AI analysis
   */
  private async groupSimilarDocuments(
    documents: DocumentForCategorization[],
    themes: Array<{ theme: string, keywords: string[], documentIds: string[] }>
  ): Promise<{
    groups: Array<{ documents: string[], similarity: number, commonConcepts: string[] }>
    tokensUsed: number
  }> {
    const prompt = `Based on the identified themes and document analysis, group similar documents together.
    Consider content similarity, business function, document type, and subject matter.

    Themes identified:
    ${themes.map(theme => `- ${theme.theme}: ${theme.keywords.join(', ')}`).join('\n')}

    Documents:
    ${documents.map(doc => `
    ID: ${doc.id}
    Title: ${doc.title}
    Type: ${doc.source_type || 'unknown'}
    Topics: ${doc.topics?.join(', ') || 'None'}
    `).join('\n')}

    Create logical groups of 2-5 documents that belong together. For each group, identify:
    1. Document IDs in the group
    2. Similarity score (0-1)
    3. Common concepts that unite them

    Respond in JSON format:
    {
      "groups": [
        {
          "documents": ["doc1", "doc2"],
          "similarity": 0.85,
          "commonConcepts": ["policy", "procedures", "compliance"]
        }
      ]
    }`

    const result = await this.openAIService.chatCompletion([
      { role: 'system', content: 'You are an expert at identifying document relationships and creating logical groupings.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.2, maxTokens: 1000 })

    try {
      const parsed = JSON.parse(result.content)
      return {
        groups: parsed.groups || [],
        tokensUsed: result.usage.totalTokens
      }
    } catch (error) {
      console.warn('Failed to parse grouping analysis, using fallback')
      return {
        groups: this.fallbackGrouping(documents, themes),
        tokensUsed: result.usage.totalTokens
      }
    }
  }

  /**
   * Generate intelligent category names and descriptions
   */
  private async generateCategoryNames(
    groups: Array<{ documents: string[], similarity: number, commonConcepts: string[] }>,
    documents: DocumentForCategorization[]
  ): Promise<{
    suggestions: CategorySuggestion[]
    tokensUsed: number
  }> {
    const suggestions: CategorySuggestion[] = []
    let totalTokens = 0

    for (const group of groups) {
      const groupDocs = documents.filter(doc => group.documents.includes(doc.id))
      
      const prompt = `Create an intelligent category name and description for this group of related documents.
      The category should be business-friendly, descriptive, and capture the essence of what these documents represent.

      Documents in group:
      ${groupDocs.map(doc => `
      - ${doc.title}
        Summary: ${doc.summary || 'No summary'}
        Topics: ${doc.topics?.join(', ') || 'None'}
        Source: ${doc.source_type || 'unknown'}
      `).join('\n')}

      Common concepts: ${group.commonConcepts.join(', ')}
      Similarity score: ${group.similarity}

      Provide a category that would make sense to business users. Consider:
      - Business function (HR, IT, Finance, Operations, etc.)
      - Document type (Policies, Procedures, Guides, References, etc.)
      - Subject area (Security, Compliance, Training, etc.)

      Respond in JSON format:
      {
        "name": "Human Resources Policies",
        "description": "Company policies and procedures related to human resources, employee benefits, and workplace guidelines",
        "confidence": 0.9,
        "keywords": ["hr", "policy", "employee", "benefits", "workplace"],
        "reasoning": "These documents all relate to HR policies and contain similar procedural content for employee management"
      }`

      const result = await this.openAIService.chatCompletion([
        { role: 'system', content: 'You are an expert at creating business-friendly category names for document management systems.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.4, maxTokens: 400 })

      totalTokens += result.usage.totalTokens

      try {
        const parsed = JSON.parse(result.content)
        suggestions.push({
          name: parsed.name,
          description: parsed.description,
          confidence: parsed.confidence || group.similarity,
          documentIds: group.documents,
          keywords: parsed.keywords || group.commonConcepts,
          reasoning: parsed.reasoning || `Documents grouped by similarity (${group.similarity.toFixed(2)})`
        })
      } catch (error) {
        console.warn('Failed to parse category suggestion, using fallback')
        suggestions.push({
          name: this.generateFallbackCategoryName(groupDocs),
          description: `Related documents covering ${group.commonConcepts.join(', ')}`,
          confidence: group.similarity,
          documentIds: group.documents,
          keywords: group.commonConcepts,
          reasoning: `Grouped by content similarity and common concepts`
        })
      }
    }

    return { suggestions, tokensUsed: totalTokens }
  }

  /**
   * Refine and validate categorization results
   */
  private async refineCategorization(
    suggestions: CategorySuggestion[],
    documents: DocumentForCategorization[]
  ): Promise<{
    categories: CategorySuggestion[]
    uncategorized: string[]
    tokensUsed: number
  }> {
    const categorizedDocIds = new Set(suggestions.flatMap(s => s.documentIds))
    const uncategorized = documents
      .filter(doc => !categorizedDocIds.has(doc.id))
      .map(doc => doc.id)

    // Filter out low-confidence categories and merge similar ones
    const refinedCategories = suggestions
      .filter(cat => cat.confidence > 0.6 && cat.documentIds.length >= 2)
      .sort((a, b) => b.confidence - a.confidence)

    // Merge categories with very similar names
    const mergedCategories = this.mergeSimilarCategories(refinedCategories)

    return {
      categories: mergedCategories,
      uncategorized,
      tokensUsed: 0 // No AI calls in this step
    }
  }

  /**
   * Fallback theme analysis when AI parsing fails
   */
  private fallbackThemeAnalysis(documents: DocumentForCategorization[]): Array<{ theme: string, keywords: string[], documentIds: string[] }> {
    const themes: { [key: string]: { keywords: Set<string>, documentIds: string[] } } = {}

    documents.forEach(doc => {
      // Extract themes from existing topics and content
      const allText = `${doc.title} ${doc.summary || ''} ${doc.topics?.join(' ') || ''}`.toLowerCase()
      
      // Common business themes
      const themePatterns = {
        'Human Resources': ['hr', 'human resources', 'employee', 'staff', 'personnel', 'benefits', 'policy'],
        'Information Technology': ['it', 'technology', 'software', 'system', 'network', 'security', 'technical'],
        'Finance & Accounting': ['finance', 'accounting', 'budget', 'cost', 'expense', 'financial', 'money'],
        'Operations': ['operations', 'process', 'procedure', 'workflow', 'standard', 'operating'],
        'Compliance & Legal': ['compliance', 'legal', 'regulation', 'audit', 'risk', 'governance'],
        'Training & Development': ['training', 'development', 'learning', 'education', 'course', 'skill']
      }

      Object.entries(themePatterns).forEach(([theme, keywords]) => {
        const matches = keywords.filter(keyword => allText.includes(keyword))
        if (matches.length > 0) {
          if (!themes[theme]) {
            themes[theme] = { keywords: new Set(), documentIds: [] }
          }
          matches.forEach(match => themes[theme].keywords.add(match))
          themes[theme].documentIds.push(doc.id)
        }
      })
    })

    return Object.entries(themes).map(([theme, data]) => ({
      theme,
      keywords: Array.from(data.keywords),
      documentIds: data.documentIds
    }))
  }

  /**
   * Fallback grouping when AI parsing fails
   */
  private fallbackGrouping(
    documents: DocumentForCategorization[],
    themes: Array<{ theme: string, keywords: string[], documentIds: string[] }>
  ): Array<{ documents: string[], similarity: number, commonConcepts: string[] }> {
    return themes
      .filter(theme => theme.documentIds.length >= 2)
      .map(theme => ({
        documents: theme.documentIds,
        similarity: 0.7,
        commonConcepts: theme.keywords
      }))
  }

  /**
   * Generate fallback category name
   */
  private generateFallbackCategoryName(documents: DocumentForCategorization[]): string {
    const titles = documents.map(doc => doc.title.toLowerCase())
    const commonWords = this.findCommonWords(titles)
    
    if (commonWords.length > 0) {
      return commonWords.map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ') + ' Documents'
    }

    // Fallback to source type
    const sourceTypes = [...new Set(documents.map(doc => doc.source_type).filter(Boolean))]
    if (sourceTypes.length === 1 && sourceTypes[0]) {
      return `${sourceTypes[0].charAt(0).toUpperCase() + sourceTypes[0].slice(1)} Documents`
    }

    return 'Related Documents'
  }

  /**
   * Find common words in document titles
   */
  private findCommonWords(titles: string[]): string[] {
    const wordCounts: { [word: string]: number } = {}
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'])

    titles.forEach(title => {
      const words = title.split(/\s+/).filter(word => 
        word.length > 2 && !stopWords.has(word.toLowerCase())
      )
      words.forEach(word => {
        const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '')
        if (cleanWord.length > 2) {
          wordCounts[cleanWord] = (wordCounts[cleanWord] || 0) + 1
        }
      })
    })

    return Object.entries(wordCounts)
      .filter(([_, count]) => count >= Math.ceil(titles.length / 2))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word)
  }

  /**
   * Merge categories with similar names
   */
  private mergeSimilarCategories(categories: CategorySuggestion[]): CategorySuggestion[] {
    const merged: CategorySuggestion[] = []
    const used = new Set<number>()

    categories.forEach((category, index) => {
      if (used.has(index)) return

      const similar = categories.filter((other, otherIndex) => 
        otherIndex > index && 
        !used.has(otherIndex) &&
        this.areCategoriesSimilar(category.name, other.name)
      )

      if (similar.length > 0) {
        // Merge similar categories
        const mergedCategory: CategorySuggestion = {
          name: category.name, // Keep the first (highest confidence) name
          description: category.description,
          confidence: Math.max(category.confidence, ...similar.map(s => s.confidence)),
          documentIds: [
            ...category.documentIds,
            ...similar.flatMap(s => s.documentIds)
          ],
          keywords: [
            ...new Set([
              ...category.keywords,
              ...similar.flatMap(s => s.keywords)
            ])
          ],
          reasoning: `Merged from ${similar.length + 1} similar categories`
        }

        merged.push(mergedCategory)
        similar.forEach((_, similarIndex) => {
          used.add(categories.indexOf(similar[similarIndex]))
        })
      } else {
        merged.push(category)
      }

      used.add(index)
    })

    return merged
  }

  /**
   * Check if two category names are similar enough to merge
   */
  private areCategoriesSimilar(name1: string, name2: string): boolean {
    const words1 = new Set(name1.toLowerCase().split(/\s+/))
    const words2 = new Set(name2.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...words1].filter(word => words2.has(word)))
    const union = new Set([...words1, ...words2])
    
    const similarity = intersection.size / union.size
    return similarity > 0.6 // 60% word overlap
  }

  /**
   * Apply categorization to documents in the database
   */
  async applyCategorization(
    organizationId: string,
    categorization: CategorizationResult
  ): Promise<void> {
    const supabase = await getSupabaseAdmin()

    try {
      // Update documents with new categories
      for (const category of categorization.categories) {
        await supabase
          .from('approved_documents')
          .update({
            topics: [category.name],
            tags: category.keywords,
            updated_at: new Date().toISOString()
          })
          .eq('organization_id', organizationId)
          .in('id', category.documentIds)
      }

      console.log(`Applied categorization to ${categorization.categories.length} categories`)
    } catch (error) {
      console.error('Failed to apply categorization:', error)
      throw error
    }
  }

  /**
   * Get categorization suggestions for new documents
   */
  async suggestCategoryForDocument(
    document: DocumentForCategorization,
    organizationId: string
  ): Promise<{
    suggestedCategory: string
    confidence: number
    reasoning: string
  }> {
    const supabase = await getSupabaseAdmin()

    try {
      // Get existing categories from the organization
      const { data: existingDocs } = await supabase
        .from('approved_documents')
        .select('tags, title, summary')
        .eq('organization_id', organizationId)
        .not('tags', 'is', null)

      if (!existingDocs || existingDocs.length === 0) {
        return {
          suggestedCategory: 'General Documents',
          confidence: 0.5,
          reasoning: 'No existing categories found, using default'
        }
      }

      const existingCategories = [...new Set(existingDocs.flatMap(doc => doc.tags || []).filter(Boolean))]

      const prompt = `Suggest the best category for this new document based on existing categories in the organization.

      New Document:
      Title: ${document.title}
      Summary: ${document.summary || 'No summary'}
      Content Preview: ${document.content.substring(0, 500)}...

      Existing Categories:
      ${existingCategories.map(cat => `- ${cat}`).join('\n')}

      Choose the most appropriate existing category or suggest "NEW_CATEGORY" if none fit well.
      
      Respond in JSON format:
      {
        "category": "Human Resources Policies",
        "confidence": 0.85,
        "reasoning": "Document content matches HR policy structure and terminology"
      }`

      const result = await this.openAIService.chatCompletion([
        { role: 'system', content: 'You are an expert document classifier for business organizations.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.2, maxTokens: 300 })

      try {
        const parsed = JSON.parse(result.content)
        return {
          suggestedCategory: parsed.category === 'NEW_CATEGORY' ? 'Uncategorized' : parsed.category,
          confidence: parsed.confidence || 0.7,
          reasoning: parsed.reasoning || 'AI-based content analysis'
        }
      } catch (error) {
        return {
          suggestedCategory: 'General Documents',
          confidence: 0.5,
          reasoning: 'Failed to parse AI suggestion'
        }
      }

    } catch (error) {
      console.error('Failed to suggest category:', error)
      return {
        suggestedCategory: 'General Documents',
        confidence: 0.5,
        reasoning: 'Error occurred during categorization'
      }
    }
  }
}

// Singleton instance
let documentCategorizationService: DocumentCategorizationService | null = null

export function getDocumentCategorizationService(): DocumentCategorizationService {
  if (!documentCategorizationService) {
    documentCategorizationService = new DocumentCategorizationService()
  }
  return documentCategorizationService
}

export { DocumentCategorizationService }