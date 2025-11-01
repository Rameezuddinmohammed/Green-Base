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
      // Experimental: Try parallel processing first, fallback to sequential
      const useParallelProcessing = process.env.ENABLE_PARALLEL_PROCESSING === 'true'
      const maxConcurrency = parseInt(process.env.MAX_PROCESSING_CONCURRENCY || '3')

      if (useParallelProcessing && sourceContent.length > 1) {
        console.log(`🚀 Attempting parallel processing with max concurrency: ${maxConcurrency}`)
        try {
          const parallelResult = await this.processContentParallel(sourceContent, sourceId, organizationId, maxConcurrency)
          console.log(`✅ Parallel processing succeeded: ${parallelResult.documentsCreated} documents, ${parallelResult.errors.length} errors`)
          return parallelResult
        } catch (parallelError) {
          console.warn(`⚠️ Parallel processing failed, falling back to sequential:`, parallelError)
          // Continue to sequential processing below
        }
      }

      // Sequential processing (original method)
      console.log(`🔄 Using sequential processing for ${sourceContent.length} documents`)
      for (const content of sourceContent) {
        try {
          await this.processIndividualContent(content, sourceId, organizationId)
          result.documentsCreated++
        } catch (error) {
          console.error('Failed to process content item:', error)
          result.errors.push(`Failed to process "${content.title}": ${error instanceof Error ? error.message : 'Unknown error'}`)
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
   * Process content items in parallel with controlled concurrency
   */
  private async processContentParallel(
    sourceContent: SourceContent[],
    sourceId: string,
    organizationId: string,
    maxConcurrency: number = 3
  ): Promise<IngestionResult> {
    const startTime = Date.now()
    const result: IngestionResult = {
      documentsCreated: 0,
      documentsUpdated: 0,
      errors: [],
      processingTime: 0
    }

    // Process in batches to control concurrency
    const batches = []
    for (let i = 0; i < sourceContent.length; i += maxConcurrency) {
      batches.push(sourceContent.slice(i, i + maxConcurrency))
    }

    console.log(`📦 Processing ${sourceContent.length} documents in ${batches.length} batches (max ${maxConcurrency} concurrent)`)

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} documents`)

      const batchStartTime = Date.now()

      // Process batch in parallel
      const batchPromises = batch.map(async (content, index) => {
        try {
          console.log(`📄 [Batch ${batchIndex + 1}] Starting document ${index + 1}: "${content.title}"`)
          await this.processIndividualContent(content, sourceId, organizationId)
          console.log(`✅ [Batch ${batchIndex + 1}] Completed document ${index + 1}: "${content.title}"`)
          return { success: true, content }
        } catch (error) {
          console.error(`❌ [Batch ${batchIndex + 1}] Failed document ${index + 1}: "${content.title}"`, error)
          return {
            success: false,
            content,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })

      // Wait for all documents in this batch to complete
      const batchResults = await Promise.all(batchPromises)

      const batchTime = Date.now() - batchStartTime
      console.log(`⏱️ Batch ${batchIndex + 1} completed in ${(batchTime / 1000).toFixed(1)}s`)

      // Collect results
      for (const batchResult of batchResults) {
        if (batchResult.success) {
          result.documentsCreated++
        } else {
          result.errors.push(`Failed to process "${batchResult.content.title}": ${batchResult.error}`)
        }
      }

      // Add a small delay between batches to prevent overwhelming the system
      if (batchIndex < batches.length - 1) {
        console.log(`⏸️ Waiting 2s before next batch...`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    result.processingTime = Date.now() - startTime
    console.log(`🏁 Parallel processing completed: ${result.documentsCreated} created, ${result.errors.length} errors, ${(result.processingTime / 1000).toFixed(1)}s total`)

    return result
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
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word)
  }

  /**
   * Detect changes between old and new content using AI analysis
   */
  private async detectChanges(oldContent: string, newContent: string): Promise<string[]> {
    // Quick check - if content is identical, no changes
    if (oldContent === newContent) {
      return []
    }

    try {
      console.log('🔍 Using AI to analyze document changes...')

      // Use AI to analyze changes through the AI integration service
      const aiResult = await this.aiService.processForQA(
        `Compare these two document versions and identify specific changes:\n\nOLD VERSION:\n${oldContent.substring(0, 1000)}\n\nNEW VERSION:\n${newContent.substring(0, 1000)}`,
        'What specific changes were made between these two versions? Return as a JSON array of change descriptions.'
      )

      // Parse AI response
      try {
        let jsonContent = aiResult.answer.trim()

        // Extract JSON array from response
        const jsonMatch = jsonContent.match(/\[[\s\S]*?\]/)
        if (jsonMatch) {
          jsonContent = jsonMatch[0]
        }

        const aiChanges = JSON.parse(jsonContent)

        if (Array.isArray(aiChanges) && aiChanges.length > 0) {
          console.log(`✅ AI detected ${aiChanges.length} specific changes`)
          return aiChanges.slice(0, 5) // Limit to 5 changes
        }
      } catch (parseError) {
        console.warn('Failed to parse AI change analysis, using fallback')
      }
    } catch (error) {
      console.warn('AI change analysis failed, using fallback:', error)
    }

    // Fallback to simple heuristic analysis
    return this.detectChangesHeuristic(oldContent, newContent)
  }

  /**
   * Fallback heuristic change detection
   */
  private detectChangesHeuristic(oldContent: string, newContent: string): string[] {
    const changes: string[] = []

    // Simple line-based diff
    const oldLines = oldContent.split('\n').filter(l => l.trim())
    const newLines = newContent.split('\n').filter(l => l.trim())

    // Check for length changes
    const lengthDiff = Math.abs(newLines.length - oldLines.length)
    if (lengthDiff > 5) {
      changes.push(`Content ${newLines.length > oldLines.length ? 'expanded' : 'reduced'} by ${lengthDiff} lines`)
    }

    // Check for new sections (lines starting with #)
    const oldSections = oldLines.filter(l => l.startsWith('#')).map(l => l.replace(/^#+\s*/, ''))
    const newSections = newLines.filter(l => l.startsWith('#')).map(l => l.replace(/^#+\s*/, ''))
    const addedSections = newSections.filter(s => !oldSections.includes(s))
    const removedSections = oldSections.filter(s => !newSections.includes(s))

    if (addedSections.length > 0) {
      changes.push(`Added sections: ${addedSections.slice(0, 3).join(', ')}${addedSections.length > 3 ? '...' : ''}`)
    }
    if (removedSections.length > 0) {
      changes.push(`Removed sections: ${removedSections.slice(0, 3).join(', ')}${removedSections.length > 3 ? '...' : ''}`)
    }

    // Check for keyword changes
    const oldKeywords = this.extractKeywords(oldContent)
    const newKeywords = this.extractKeywords(newContent)
    const addedKeywords = newKeywords.filter(k => !oldKeywords.includes(k))
    const removedKeywords = oldKeywords.filter(k => !newKeywords.includes(k))

    if (addedKeywords.length > 0) {
      changes.push(`New topics: ${addedKeywords.slice(0, 3).join(', ')}`)
    }
    if (removedKeywords.length > 0) {
      changes.push(`Removed topics: ${removedKeywords.slice(0, 3).join(', ')}`)
    }

    // If no specific changes detected but content is different
    if (changes.length === 0 && oldContent !== newContent) {
      changes.push('Content updated')
    }

    return changes
  }

  /**
   * Process a single content item into a draft document
   */
  private async processIndividualContent(
    content: SourceContent,
    sourceId: string,
    organizationId: string
  ): Promise<void> {
    console.log(`Processing individual content: ${content.type} - "${content.title}" (${content.content.length} chars)`)

    // Generate content hash for change detection
    const contentHash = await this.generateContentHash(content.content)
    console.log(`📋 Content hash: ${contentHash.substring(0, 8)}...`)

    // Check file state tracking to see if this file has actually changed
    const { data: fileState } = await this.supabase
      .from('file_state_tracking')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('source_external_id', content.id)
      .single()

    if (fileState) {
      console.log(`📁 Found file state record, last hash: ${fileState.last_content_hash.substring(0, 8)}...`)

      // If content hasn't changed, skip processing
      if (fileState.last_content_hash === contentHash) {
        console.log(`✅ Content unchanged, skipping processing for: "${content.title}"`)

        // Update last sync time
        await this.supabase
          .from('file_state_tracking')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', fileState.id)

        return
      }

      console.log(`🔄 Content changed detected for: "${content.title}"`)
    } else {
      console.log(`🆕 New file detected: "${content.title}"`)
    }

    // Find the latest approved document for this source external ID
    const { data: existingDocs } = await this.supabase
      .from('approved_documents')
      .select('id, title, content, version, source_external_id')
      .eq('organization_id', organizationId)
      .eq('source_external_id', content.id)
      .order('version', { ascending: false })
      .limit(1)

    const existingDoc = existingDocs?.[0] || null
    const isUpdate = !!existingDoc

    if (existingDoc) {
      console.log(`✅ Found existing document: ${existingDoc.title} (v${existingDoc.version})`)
    } else {
      console.log(`🆕 New document: "${content.title}"`)
    }

    // Detect changes if this is an update
    let changesSummary: string[] = []
    if (isUpdate && existingDoc) {
      changesSummary = await this.detectChanges(existingDoc.content, content.content)
      console.log(`📊 Detected ${changesSummary.length} changes: ${changesSummary.join(', ')}`)
    }

    // Format content with metadata header
    let formattedContent = `# ${content.title}\n\n`
    if (content.metadata.author) {
      formattedContent += `**Author:** ${content.metadata.author}\n`
    }
    if (content.metadata.createdAt) {
      formattedContent += `**Date:** ${content.metadata.createdAt.toLocaleDateString()}\n`
    }
    formattedContent += '\n' + content.content

    console.log(`Formatted content length: ${formattedContent.length} characters`)

    // Process through AI pipeline
    console.log('Starting AI processing...')
    const aiResult = await this.aiService.processContent(
      formattedContent,
      [{
        sourceType: content.type === 'teams_message' ? 'teams' : 'google_drive',
        sourceId: content.id,
        originalContent: content.content,
        metadata: content.metadata
      }],
      changesSummary // Pass changes summary to AI processing
    )

    console.log(`AI processing completed. Confidence: ${aiResult.confidence.score} (${aiResult.confidence.level})`)

    // Create draft document
    const { data: draftDoc, error: draftError } = await this.supabase
      .from('draft_documents')
      .insert({
        title: content.title,
        content: aiResult.structuredContent,
        summary: aiResult.summary,
        topics: aiResult.topics,
        confidence_score: aiResult.confidence.score,
        confidence_reasoning: aiResult.confidence.reasoning,
        triage_level: aiResult.confidence.level,
        source_references: [{
          sourceType: content.type === 'teams_message' ? 'teams' : 'google_drive',
          sourceId: content.id,
          title: content.title,
          author: content.metadata.author,
          createdAt: content.metadata.createdAt,
          sourceUrl: content.metadata.sourceUrl
        }],
        pii_entities_found: aiResult.piiEntities.length,
        processing_metadata: {
          sourceId,
          itemCount: 1,
          processingTime: aiResult.processingTime,
          tokensUsed: aiResult.tokensUsed,
          isUpdate,
          originalDocumentId: existingDoc?.id,
          changesSummary
        },
        organization_id: organizationId,
        status: 'pending',
        // Store update metadata
        is_update: isUpdate,
        original_document_id: existingDoc?.id,
        changes_made: changesSummary,
        source_external_id: content.id,
        // Date tracking
        original_created_at: content.metadata.createdAt?.toISOString()
      })
      .select()
      .single()

    if (draftError) {
      throw new Error(`Failed to create draft document: ${draftError.message}`)
    }

    // Create source document record
    const { error: sourceError } = await this.supabase
      .from('source_documents')
      .insert({
        draft_document_id: draftDoc.id,
        source_type: content.type === 'teams_message' ? 'teams' : 'google_drive',
        source_id: content.id,
        original_content: content.content,
        redacted_content: aiResult.redactedContent,
        metadata: content.metadata
      })

    if (sourceError) {
      console.error('Failed to create source document:', sourceError)
      // Don't throw here as the main document was created successfully
    }

    // Update file state tracking
    await this.updateFileStateTracking(
      organizationId,
      content.id,
      sourceId,
      contentHash,
      content.metadata.createdAt
    )

    console.log(`Created draft document "${content.title}" with confidence ${aiResult.confidence.level} (${Math.round(aiResult.confidence.score * 100)}%)`)
  }

  /**
   * Generate a hash of the content for change detection
   */
  private async generateContentHash(content: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(content.trim())
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Update or create file state tracking record
   */
  private async updateFileStateTracking(
    organizationId: string,
    sourceExternalId: string,
    sourceId: string,
    contentHash: string,
    modifiedTime?: Date
  ): Promise<void> {
    const { error } = await this.supabase
      .from('file_state_tracking')
      .upsert({
        organization_id: organizationId,
        source_external_id: sourceExternalId,
        source_id: sourceId,
        last_content_hash: contentHash,
        last_modified_time: modifiedTime?.toISOString(),
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'organization_id,source_external_id'
      })

    if (error) {
      console.error('Failed to update file state tracking:', error)
    } else {
      console.log(`✅ Updated file state tracking for: ${sourceExternalId}`)
    }
  }

  /**
   * Process a group of related content items into a draft document (legacy grouping method)
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
   * Process content with grouping enabled (alternative processing mode)
   */
  async processSourceContentWithGrouping(
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



  /**
   * Detailed fallback change detection for specific patterns
   */
  private detectChangesDetailed(oldContent: string, newContent: string): string[] {
    const changes: string[] = []

    // Check for date changes (common pattern: Month YYYY)
    const dateRegex = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/g
    const oldDates = oldContent.match(dateRegex) || []
    const newDates = newContent.match(dateRegex) || []

    for (let i = 0; i < Math.max(oldDates.length, newDates.length); i++) {
      if (oldDates[i] !== newDates[i]) {
        if (oldDates[i] && newDates[i]) {
          changes.push(`Changed date from ${oldDates[i]} to ${newDates[i]}`)
        } else if (newDates[i]) {
          changes.push(`Added date: ${newDates[i]}`)
        } else if (oldDates[i]) {
          changes.push(`Removed date: ${oldDates[i]}`)
        }
      }
    }

    // Check for number changes (amounts, limits, etc.)
    const numberRegex = /\$[\d,]+|\d+\s*(days?|hours?|minutes?|business days?)/g
    const oldNumbers = oldContent.match(numberRegex) || []
    const newNumbers = newContent.match(numberRegex) || []

    const oldNumbersSet = new Set(oldNumbers)
    const newNumbersSet = new Set(newNumbers)

    for (const num of newNumbers) {
      if (!oldNumbersSet.has(num)) {
        const similar = oldNumbers.find(old =>
          old.replace(/[\d,]/g, '') === num.replace(/[\d,]/g, '')
        )
        if (similar) {
          changes.push(`Changed amount from ${similar} to ${num}`)
        } else {
          changes.push(`Added amount: ${num}`)
        }
      }
    }

    // Check for line-by-line differences
    const oldLines = oldContent.split('\n').filter(line => line.trim())
    const newLines = newContent.split('\n').filter(line => line.trim())

    if (oldLines.length !== newLines.length) {
      changes.push(`Content structure changed (${oldLines.length} lines → ${newLines.length} lines)`)
    }

    // Find specific line changes
    for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) {
      if (oldLines[i] !== newLines[i]) {
        const oldLine = oldLines[i].trim()
        const newLine = newLines[i].trim()

        // Skip if it's just formatting
        if (oldLine.replace(/\s+/g, ' ') === newLine.replace(/\s+/g, ' ')) continue

        // Check if it's a meaningful change
        if (Math.abs(oldLine.length - newLine.length) > 5 ||
          oldLine.split(' ').length !== newLine.split(' ').length) {
          changes.push(`Modified line: "${oldLine.substring(0, 50)}${oldLine.length > 50 ? '...' : ''}" → "${newLine.substring(0, 50)}${newLine.length > 50 ? '...' : ''}"`)
        }

        if (changes.length >= 5) break
      }
    }

    return changes.length > 0 ? changes : ['Content has been updated']
  }

  /**
   * Smart content preparation for AI comparison - focuses on important sections
   */
  private prepareContentForComparison(content: string): string {
    const maxTokens = 6000 // ~24,000 characters budget

    if (content.length <= maxTokens) {
      return content
    }

    // For long documents, extract key sections intelligently
    const sections = []

    // Always include the beginning (title, overview, etc.)
    sections.push(content.substring(0, 1500))

    // Extract important sections (dates, numbers, policy statements)
    const importantPatterns = [
      /effective date[:\s].*$/gim,
      /policy statement[:\s].*$/gim,
      /\$[\d,]+/g,
      /\d+\s*(days?|hours?|minutes?|business days?)/g,
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/g,
      /deadline[:\s].*$/gim,
      /limit[:\s].*$/gim
    ]

    for (const pattern of importantPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        for (const match of matches) {
          // Find context around the match (50 chars before/after)
          const index = content.indexOf(match)
          const start = Math.max(0, index - 50)
          const end = Math.min(content.length, index + match.length + 50)
          const context = content.substring(start, end)
          sections.push(context)
        }
      }
    }

    // Always include the end (contact info, dates, etc.)
    sections.push(content.substring(Math.max(0, content.length - 1500)))

    // Combine sections and deduplicate
    const combined = [...new Set(sections)].join('\n...\n')

    // If still too long, truncate but keep important parts
    if (combined.length > maxTokens) {
      return combined.substring(0, maxTokens) + '...[truncated]'
    }

    return combined
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