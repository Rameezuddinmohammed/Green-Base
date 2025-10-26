import { getMicrosoftGraphService } from '../oauth/microsoft-graph'
import { getGoogleDriveService } from '../oauth/google-drive'
import { getAIIntegrationService, ProcessedContent, SourceReference, ContentProcessingOptions } from '../ai'
import { SourceMetadata } from '../ai/confidence-scoring'
import { getSupabaseAdmin } from '../supabase-admin'

export interface IngestionSource {
  id: string
  type: 'teams' | 'google_drive'
  userId: string
  organizationId: string
  name: string
  selectedChannels?: string[]
  selectedFolders?: string[]
  selectedTeamChannels?: Array<{ teamId: string; channelId: string; displayName: string }>
  isActive: boolean
}

export interface IngestionJob {
  id: string
  sourceId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt: Date
  completedAt?: Date
  itemsProcessed: number
  itemsTotal: number
  error?: string
}

export interface IngestionResult {
  job: IngestionJob
  processedDocuments: ProcessedContent[]
  errors: Array<{ item: string; error: string }>
}

export interface ContentChunk {
  id: string
  content: string
  sourceType: 'teams' | 'google_drive'
  sourceId: string
  metadata: {
    author?: string
    timestamp: Date
    url?: string
    fileName?: string
    channelName?: string
    teamName?: string
  }
}

class ContentIngestionService {
  private microsoftService = getMicrosoftGraphService()
  private googleService = getGoogleDriveService()
  private aiService = getAIIntegrationService()
  private supabase: any = null

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await getSupabaseAdmin()
    }
    return this.supabase
  }

  async startIngestion(
    source: IngestionSource,
    options: ContentProcessingOptions = {}
  ): Promise<IngestionJob> {
    // Create ingestion job record
    const job: IngestionJob = {
      id: this.generateJobId(),
      sourceId: source.id,
      status: 'pending',
      startedAt: new Date(),
      itemsProcessed: 0,
      itemsTotal: 0
    }

    // Store job in database
    await this.storeIngestionJob(job)

    // Update last sync timestamp immediately
    const { getOAuthService } = await import('../oauth/oauth-service')
    const oauthService = getOAuthService()
    await oauthService.updateLastSync(source.userId, source.id)

    // Start ingestion process asynchronously
    this.processIngestion(source, job, options).catch(error => {
      console.error(`Ingestion job ${job.id} failed:`, error)
      this.updateJobStatus(job.id, 'failed', error.message)
    })

    return job
  }

  private async processIngestion(
    source: IngestionSource,
    job: IngestionJob,
    options: ContentProcessingOptions
  ): Promise<void> {
    try {
      // Update job status to running
      await this.updateJobStatus(job.id, 'running')

      // Fetch content based on source type
      const contentChunks = await this.fetchSourceContent(source)
      
      // Update total items count
      job.itemsTotal = contentChunks.length
      await this.updateJobProgress(job.id, 0, contentChunks.length)

      if (contentChunks.length === 0) {
        await this.updateJobStatus(job.id, 'completed')
        return
      }

      // Group related content chunks for processing
      const groupedContent = await this.groupContentChunks(contentChunks)

      const processedDocuments: ProcessedContent[] = []
      const errors: Array<{ item: string; error: string }> = []

      // Process each group
      for (let i = 0; i < groupedContent.length; i++) {
        const group = groupedContent[i]
        
        try {
          const processedDoc = await this.processContentGroup(group, options)
          processedDocuments.push(processedDoc)

          // Store processed document in database
          await this.storeProcessedDocument(processedDoc, source.organizationId)

          // Update progress
          await this.updateJobProgress(job.id, i + 1, groupedContent.length)
        } catch (error) {
          console.error(`Failed to process content group ${i}:`, error)
          errors.push({
            item: `Group ${i} (${group.length} items)`,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      // Complete the job
      await this.updateJobStatus(job.id, 'completed')
      
      console.log(`Ingestion job ${job.id} completed: ${processedDocuments.length} documents processed, ${errors.length} errors`)
    } catch (error) {
      console.error(`Ingestion job ${job.id} failed:`, error)
      await this.updateJobStatus(job.id, 'failed', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  private async fetchSourceContent(source: IngestionSource): Promise<ContentChunk[]> {
    const chunks: ContentChunk[] = []

    if (source.type === 'teams') {
      chunks.push(...await this.fetchTeamsContent(source))
    } else if (source.type === 'google_drive') {
      chunks.push(...await this.fetchGoogleDriveContent(source))
    }

    return chunks
  }

  private async fetchTeamsContent(source: IngestionSource): Promise<ContentChunk[]> {
    const chunks: ContentChunk[] = []

    if (!source.selectedTeamChannels || source.selectedTeamChannels.length === 0) {
      return chunks
    }

    for (const channelMapping of source.selectedTeamChannels) {
      try {
        const messages = await this.microsoftService.getChannelMessages(
          source.userId,
          channelMapping.teamId,
          channelMapping.channelId,
          100 // Limit per channel
        )

        for (const message of messages) {
          chunks.push({
            id: `teams_${message.id}`,
            content: message.body.content,
            sourceType: 'teams',
            sourceId: `${channelMapping.teamId}/${channelMapping.channelId}`,
            metadata: {
              author: message.from.user?.displayName,
              timestamp: new Date(message.createdDateTime),
              channelName: channelMapping.displayName,
              teamName: channelMapping.displayName.split(' - ')[0]
            }
          })
        }
      } catch (error) {
        console.error(`Failed to fetch messages from channel ${channelMapping.channelId}:`, error)
      }
    }

    return chunks
  }

  private async fetchGoogleDriveContent(source: IngestionSource): Promise<ContentChunk[]> {
    const chunks: ContentChunk[] = []

    if (!source.selectedFolders || source.selectedFolders.length === 0) {
      return chunks
    }

    for (const folderId of source.selectedFolders) {
      try {
        const items = await this.googleService.getDriveItems(source.userId, folderId)

        for (const item of items) {
          // Only process files, not folders
          if (item.file) {
            try {
              const content = await this.googleService.getFileContent(source.userId, item.id)
              
              chunks.push({
                id: `drive_${item.id}`,
                content,
                sourceType: 'google_drive',
                sourceId: item.id,
                metadata: {
                  fileName: item.name,
                  timestamp: new Date(item.lastModifiedDateTime),
                  url: item.webUrl
                }
              })
            } catch (error) {
              console.error(`Failed to fetch content for file ${item.name}:`, error)
            }
          }
        }
      } catch (error) {
        console.error(`Failed to fetch items from folder ${folderId}:`, error)
      }
    }

    return chunks
  }

  private async groupContentChunks(chunks: ContentChunk[]): Promise<ContentChunk[][]> {
    // Simple grouping strategy: group by source and time proximity
    const groups: ContentChunk[][] = []
    const sortedChunks = chunks.sort((a, b) => a.metadata.timestamp.getTime() - b.metadata.timestamp.getTime())

    let currentGroup: ContentChunk[] = []
    let lastTimestamp: Date | null = null
    let lastSourceId: string | null = null

    const TIME_THRESHOLD = 60 * 60 * 1000 // 1 hour
    const MAX_GROUP_SIZE = 10

    for (const chunk of sortedChunks) {
      const shouldStartNewGroup = 
        currentGroup.length >= MAX_GROUP_SIZE ||
        (lastSourceId && chunk.sourceId !== lastSourceId) ||
        (lastTimestamp && Math.abs(chunk.metadata.timestamp.getTime() - lastTimestamp.getTime()) > TIME_THRESHOLD)

      if (shouldStartNewGroup && currentGroup.length > 0) {
        groups.push(currentGroup)
        currentGroup = []
      }

      currentGroup.push(chunk)
      lastTimestamp = chunk.metadata.timestamp
      lastSourceId = chunk.sourceId
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup)
    }

    return groups
  }

  private async processContentGroup(
    group: ContentChunk[],
    options: ContentProcessingOptions
  ): Promise<ProcessedContent> {
    // Prepare content for AI processing
    const sourceContent = group.map(chunk => chunk.content)
    const sourceReferences: SourceReference[] = group.map(chunk => ({
      sourceType: chunk.sourceType,
      sourceId: chunk.sourceId,
      url: chunk.metadata.url,
      snippet: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
      author: chunk.metadata.author,
      timestamp: chunk.metadata.timestamp
    }))

    // Create source metadata for confidence scoring
    const sourceMetadata: SourceMetadata[] = [{
      type: group[0].sourceType,
      authorCount: new Set(group.map(c => c.metadata.author).filter(Boolean)).size,
      messageCount: group.length,
      lastModified: new Date(Math.max(...group.map(c => c.metadata.timestamp.getTime()))),
      participants: Array.from(new Set(
        group.map(c => c.metadata.author)
          .filter((author): author is string => Boolean(author))
      ))
    }]

    // Process with AI service
    return await this.aiService.processContent(
      sourceContent,
      sourceReferences,
      sourceMetadata,
      options
    )
  }

  private async storeProcessedDocument(document: ProcessedContent, organizationId: string): Promise<void> {
    try {
      // Store in draft_documents table for approval queue
      const { error } = await this.supabase
        .from('draft_documents')
        .insert({
          id: document.id,
          title: document.title,
          content: document.content,
          summary: document.summary,
          topics: document.topics,
          confidence_score: document.confidence.score,
          triage_level: document.confidence.level,
          confidence_reasoning: document.confidence.reasoning,
          source_references: document.sourceReferences,
          pii_entities_found: document.piiRedaction.entities.length,
          processing_metadata: document.metadata,
          organization_id: organizationId,
          status: 'pending'
        })

      if (error) {
        throw new Error(`Failed to store document: ${error.message}`)
      }
    } catch (error) {
      console.error('Failed to store processed document:', error)
      throw error
    }
  }

  private async storeIngestionJob(job: IngestionJob): Promise<void> {
    // Store job in a simple table or in-memory for MVP
    // In production, this would be stored in a proper jobs table
    console.log(`Starting ingestion job ${job.id} for source ${job.sourceId}`)
  }

  private async updateJobStatus(jobId: string, status: IngestionJob['status'], error?: string): Promise<void> {
    console.log(`Job ${jobId} status: ${status}${error ? ` - ${error}` : ''}`)
  }

  private async updateJobProgress(jobId: string, processed: number, total: number): Promise<void> {
    console.log(`Job ${jobId} progress: ${processed}/${total}`)
  }

  async getIngestionJob(jobId: string): Promise<IngestionJob | null> {
    // In production, retrieve from database
    return null
  }

  async getJobsBySource(sourceId: string): Promise<IngestionJob[]> {
    // In production, retrieve from database
    return []
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Singleton instance
let contentIngestionService: ContentIngestionService | null = null

export function getContentIngestionService(): ContentIngestionService {
  if (!contentIngestionService) {
    contentIngestionService = new ContentIngestionService()
  }
  return contentIngestionService
}

export { ContentIngestionService }