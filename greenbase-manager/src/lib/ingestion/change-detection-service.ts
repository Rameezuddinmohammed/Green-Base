import { getSupabaseAdmin } from '../supabase-admin'
import { getGoogleDriveService } from '../oauth/google-drive'
import { getMicrosoftGraphService } from '../oauth/microsoft-graph'
import { getIngestionService, SourceContent } from './ingestion-service'

export interface ChangeDetectionResult {
  sourceId: string
  changedItems: SourceContent[]
  newChangeToken?: string
  totalItemsChecked: number
  processingTime: number
}

export interface SyncOperation {
  id: string
  sourceId: string
  status: 'running' | 'completed' | 'failed'
  itemsProcessed: number
  itemsCreated: number
  itemsUpdated: number
  errorMessage?: string
}

class ChangeDetectionService {
  private supabase: any = null
  private googleDriveService = getGoogleDriveService()
  private microsoftGraphService = getMicrosoftGraphService()
  private ingestionService = getIngestionService()

  async initialize() {
    if (this.supabase) return
    
    try {
      console.log('🔧 Initializing change detection service...')
      this.supabase = await getSupabaseAdmin()
      
      // Test the connection
      const { data, error } = await this.supabase
        .from('connected_sources')
        .select('count')
        .limit(1)
        
      if (error) {
        throw new Error(`Database connection test failed: ${error.message}`)
      }
      
      console.log('✅ Change detection service initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize change detection service:', error)
      throw new Error(`Change detection service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Main entry point: Check all sources for changes and process them
   */
  async checkAllSourcesForChanges(): Promise<SyncOperation[]> {
    await this.initialize()
    
    console.log('🔄 Starting automatic change detection for all sources...')
    
    // Get sources that need syncing
    const { data: sourcesToSync, error } = await this.supabase
      .rpc('get_sources_needing_sync')
    
    if (error) {
      console.error('Failed to get sources needing sync:', error)
      return []
    }

    if (!sourcesToSync || sourcesToSync.length === 0) {
      console.log('✅ No sources need syncing at this time')
      return []
    }

    console.log(`📋 Found ${sourcesToSync.length} sources that need syncing`)

    const operations: SyncOperation[] = []

    // Process each source
    for (const source of sourcesToSync) {
      try {
        console.log(`🔍 Checking source: ${source.name} (${source.type})`)
        const operation = await this.checkSourceForChanges(source)
        operations.push(operation)
      } catch (error) {
        console.error(`❌ Failed to check source ${source.name}:`, error)
        
        // Record failed operation
        const failedOperation: SyncOperation = {
          id: await this.recordSyncOperation(source.source_id, 'automatic', 'failed', 0, 0, 0, error instanceof Error ? error.message : 'Unknown error'),
          sourceId: source.source_id,
          status: 'failed',
          itemsProcessed: 0,
          itemsCreated: 0,
          itemsUpdated: 0,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
        operations.push(failedOperation)
      }
    }

    console.log(`✅ Completed change detection. Processed ${operations.length} sources`)
    return operations
  }

  /**
   * Check a specific source for changes
   */
  async checkSourceForChanges(source: any): Promise<SyncOperation> {
    await this.initialize()
    
    const startTime = Date.now()
    
    // Record sync start
    const syncId = await this.recordSyncOperation(
      source.source_id, 
      'manual', // Use correct sync type for manual calls
      'running', 
      0, 0, 0, undefined, 
      source.change_token
    )

    try {
      let result: ChangeDetectionResult

      if (source.type === 'google_drive') {
        result = await this.checkGoogleDriveChanges(source)
      } else if (source.type === 'teams') {
        result = await this.checkTeamsChanges(source)
      } else {
        throw new Error(`Unsupported source type: ${source.type}`)
      }

      // Process changed items if any
      let itemsCreated = 0
      if (result.changedItems.length > 0) {
        console.log(`📝 Processing ${result.changedItems.length} changed items from ${source.name}`)
        
        // Get user organization
        const { data: user } = await this.supabase
          .from('users')
          .select('organization_id')
          .eq('id', source.user_id)
          .single()

        if (!user) {
          throw new Error('User not found')
        }

        // Process through ingestion service
        const ingestionResult = await this.ingestionService.processSourceContent(
          result.changedItems,
          source.source_id,
          user.organization_id
        )

        itemsCreated = ingestionResult.documentsCreated
        
        if (ingestionResult.errors.length > 0) {
          console.warn(`⚠️ Some items failed to process:`, ingestionResult.errors)
        }
      }

      // Update change token if provided
      if (result.newChangeToken) {
        await this.updateSourceChangeToken(source.source_id, result.newChangeToken)
      }

      // Record successful completion
      await this.updateSyncOperation(syncId, 'completed', {
        itemsProcessed: result.totalItemsChecked,
        itemsCreated,
        itemsUpdated: 0,
        changeTokenAfter: result.newChangeToken
      })

      console.log(`✅ Successfully synced ${source.name}: ${itemsCreated} new documents created`)

      return {
        id: syncId,
        sourceId: source.source_id,
        status: 'completed',
        itemsProcessed: result.totalItemsChecked,
        itemsCreated,
        itemsUpdated: 0
      }

    } catch (error) {
      console.error(`❌ Failed to sync source ${source.name}:`, error)
      
      // Record failure
      await this.updateSyncOperation(syncId, 'failed', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  /**
   * Check Google Drive for changes using the Changes API
   */
  private async checkGoogleDriveChanges(source: any): Promise<ChangeDetectionResult> {
    const startTime = Date.now()
    
    try {
      console.log(`🔍 Starting Google Drive change detection for: ${source.name}`)
      
      // Get selected folders for this source
      const { data: sourceData, error: sourceDataError } = await this.supabase
        .from('connected_sources')
        .select('selected_folders')
        .eq('id', source.source_id)
        .single()

      if (sourceDataError) {
        throw new Error(`Failed to get source configuration: ${sourceDataError.message}`)
      }

      const selectedFolders = sourceData?.selected_folders || []
      
      if (selectedFolders.length === 0) {
        console.log(`⚠️ No folders selected for Google Drive source: ${source.name}`)
        return {
          sourceId: source.source_id,
          changedItems: [],
          totalItemsChecked: 0,
          processingTime: Date.now() - startTime
        }
      }

      console.log(`📁 Checking ${selectedFolders.length} selected folders`)

      // Test Google Drive service initialization
      try {
        await this.googleDriveService.initialize()
        console.log('✅ Google Drive service initialized')
      } catch (initError) {
        throw new Error(`Google Drive service initialization failed: ${initError instanceof Error ? initError.message : 'Unknown error'}`)
      }

      console.log(`🔍 Checking Google Drive changes for source: ${source.name}`)
      
      // Use Changes API for efficient change detection
      let changesResult
      try {
        changesResult = await this.googleDriveService.getChanges(source.user_id, source.change_token)
        console.log(`📋 Retrieved ${changesResult.changes.length} changes from Google Drive API`)
      } catch (driveError: any) {
        console.error(`❌ Google Drive API error:`, driveError)
        
        // If it's an OAuth error, return empty result but don't fail completely
        if (driveError.message?.includes('token') || driveError.message?.includes('auth')) {
          console.warn(`🔑 OAuth token issue for ${source.name}, skipping sync`)
          return {
            sourceId: source.source_id,
            changedItems: [],
            totalItemsChecked: 0,
            processingTime: Date.now() - startTime
          }
        }
        
        throw driveError
      }
      
      const changedItems: SourceContent[] = []
      let totalItemsChecked = changesResult.changes.length

      console.log(`📋 Found ${totalItemsChecked} changes to process`)

      // Process each change
      for (const change of changesResult.changes) {
        try {
          // Skip removed files
          if (change.removed || !change.file || change.file.trashed) {
            console.log(`🗑️ Skipping removed/trashed file: ${change.fileId}`)
            continue
          }

          const file = change.file
          
          // Check if file is in any of our selected folders
          const isInSelectedFolder = await this.googleDriveService.isFileInSelectedFolders(
            source.user_id, 
            file.id, 
            selectedFolders
          )

          if (!isInSelectedFolder) {
            console.log(`📁 File ${file.name} not in selected folders, skipping`)
            continue
          }

          // Only process actual files, not folders
          if (file.mimeType === 'application/vnd.google-apps.folder') {
            console.log(`📂 Skipping folder: ${file.name}`)
            continue
          }

          console.log(`📄 Processing changed file: ${file.name}`)

          // Check if we've already processed this version
          const lastModified = new Date(file.modifiedTime)
          const { data: existingItem } = await this.supabase
            .from('source_items')
            .select('last_modified, is_processed')
            .eq('source_id', source.source_id)
            .eq('external_id', file.id)
            .single()

          // If item is new or modified since last check
          if (!existingItem || new Date(existingItem.last_modified) < lastModified) {
            try {
              // Get file content
              const content = await this.googleDriveService.getFileContent(source.user_id, file.id)
              
              // Create source content object
              const sourceContent: SourceContent = {
                id: file.id,
                type: 'drive_file',
                title: file.name,
                content: content,
                metadata: {
                  createdAt: lastModified, // Use modified time as created time for changes
                  sourceUrl: `https://drive.google.com/file/d/${file.id}/view`,
                  mimeType: file.mimeType,
                  lastModified: lastModified
                }
              }

              changedItems.push(sourceContent)

              // Update or insert source item record
              await this.supabase
                .from('source_items')
                .upsert({
                  source_id: source.source_id,
                  external_id: file.id,
                  item_type: 'file',
                  name: file.name,
                  last_modified: lastModified,
                  etag: file.id,
                  parent_id: file.parents?.[0] || null,
                  is_processed: false,
                  metadata: {
                    mimeType: file.mimeType,
                    parents: file.parents
                  },
                  organization_id: (await this.supabase
                    .from('users')
                    .select('organization_id')
                    .eq('id', source.user_id)
                    .single()).data.organization_id
                }, {
                  onConflict: 'source_id,external_id'
                })

            } catch (contentError) {
              console.warn(`⚠️ Failed to get content for file ${file.name}:`, contentError)
              // Continue with other files
            }
          } else {
            console.log(`✅ File ${file.name} already up to date`)
          }

        } catch (changeError) {
          console.warn(`⚠️ Failed to process change for file ${change.fileId}:`, changeError)
          // Continue with other changes
        }
      }

      return {
        sourceId: source.source_id,
        changedItems,
        newChangeToken: changesResult.newStartPageToken,
        totalItemsChecked,
        processingTime: Date.now() - startTime
      }

    } catch (error) {
      throw new Error(`Google Drive change detection failed: ${error}`)
    }
  }

  /**
   * Check Microsoft Teams for changes
   */
  private async checkTeamsChanges(source: any): Promise<ChangeDetectionResult> {
    const startTime = Date.now()
    
    try {
      console.log(`🔍 Starting Teams change detection for: ${source.name}`)
      
      // Get selected team channels for this source
      const { data: sourceData, error: sourceDataError } = await this.supabase
        .from('connected_sources')
        .select('selected_team_channels')
        .eq('id', source.source_id)
        .single()

      if (sourceDataError) {
        throw new Error(`Failed to get source configuration: ${sourceDataError.message}`)
      }

      const selectedChannels = sourceData?.selected_team_channels || []
      
      if (selectedChannels.length === 0) {
        console.log(`⚠️ No channels selected for Teams source: ${source.name}`)
        return {
          sourceId: source.source_id,
          changedItems: [],
          totalItemsChecked: 0,
          processingTime: Date.now() - startTime
        }
      }

      console.log(`💬 Checking ${selectedChannels.length} selected channels`)

      // Test Microsoft Graph service initialization
      try {
        await this.microsoftGraphService.initialize()
        console.log('✅ Microsoft Graph service initialized')
      } catch (initError) {
        throw new Error(`Microsoft Graph service initialization failed: ${initError instanceof Error ? initError.message : 'Unknown error'}`)
      }

      const changedItems: SourceContent[] = []
      let totalItemsChecked = 0

      // For each selected channel, get recent messages
      for (const channel of selectedChannels) {
        try {
          console.log(`🔍 Checking Teams channel: ${channel.displayName}`)
          
          // Get recent messages from this channel
          const messages = await this.microsoftGraphService.getChannelMessages(
            source.user_id, 
            channel.teamId, 
            channel.channelId, 
            50 // Check last 50 messages
          )
          
          totalItemsChecked += messages.length

          // Check each message for changes
          for (const message of messages) {
            const createdAt = new Date(message.createdDateTime)
            
            // Only process messages from the last sync check (or last 24 hours if first sync)
            const cutoffTime = source.last_change_check 
              ? new Date(source.last_change_check)
              : new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago

            if (createdAt > cutoffTime) {
              console.log(`💬 Found new message from ${message.from?.user?.displayName || 'Unknown'}`)
              
              // Check if this message has been processed before
              const { data: existingItem } = await this.supabase
                .from('source_items')
                .select('id')
                .eq('source_id', source.source_id)
                .eq('external_id', message.id)
                .single()

              if (!existingItem) {
                // Create source content object
                const sourceContent: SourceContent = {
                  id: message.id,
                  type: 'teams_message',
                  title: `Message from ${message.from?.user?.displayName || 'Unknown'} in ${channel.displayName}`,
                  content: message.body?.content || '',
                  metadata: {
                    author: message.from?.user?.displayName,
                    createdAt: createdAt,
                    channelName: channel.displayName,
                    teamId: channel.teamId,
                    channelId: channel.channelId
                  }
                }

                changedItems.push(sourceContent)

                // Record source item
                await this.supabase
                  .from('source_items')
                  .insert({
                    source_id: source.source_id,
                    external_id: message.id,
                    item_type: 'message',
                    name: `Message from ${message.from?.user?.displayName || 'Unknown'}`,
                    last_modified: createdAt,
                    etag: message.id, // Use message ID as etag
                    parent_id: channel.channelId,
                    is_processed: false,
                    metadata: {
                      channelName: channel.displayName,
                      teamId: channel.teamId,
                      channelId: channel.channelId,
                      author: message.from?.user?.displayName
                    },
                    organization_id: (await this.supabase
                      .from('users')
                      .select('organization_id')
                      .eq('id', source.user_id)
                      .single()).data.organization_id
                  })
              }
            }
          }
        } catch (channelError) {
          console.warn(`⚠️ Failed to check channel ${channel.displayName}:`, channelError)
          // Continue with other channels
        }
      }

      return {
        sourceId: source.source_id,
        changedItems,
        totalItemsChecked,
        processingTime: Date.now() - startTime
      }

    } catch (error) {
      throw new Error(`Teams change detection failed: ${error}`)
    }
  }

  /**
   * Update source change token after successful sync
   */
  private async updateSourceChangeToken(sourceId: string, changeToken: string): Promise<void> {
    await this.initialize()
    
    const { error } = await this.supabase.rpc('update_source_change_token', {
      p_source_id: sourceId,
      p_change_token: changeToken
    })
    
    if (error) {
      console.error('Failed to update source change token:', error)
      throw new Error(`Failed to update change token: ${error.message}`)
    }
  }

  /**
   * Record a sync operation
   */
  private async recordSyncOperation(
    sourceId: string,
    syncType: string,
    status: string,
    itemsProcessed: number = 0,
    itemsCreated: number = 0,
    itemsUpdated: number = 0,
    errorMessage?: string,
    changeTokenBefore?: string,
    changeTokenAfter?: string
  ): Promise<string> {
    await this.initialize()
    
    const { data, error } = await this.supabase.rpc('record_sync_operation', {
      p_source_id: sourceId,
      p_sync_type: syncType,
      p_status: status,
      p_items_processed: itemsProcessed,
      p_items_created: itemsCreated,
      p_items_updated: itemsUpdated,
      p_error_message: errorMessage,
      p_change_token_before: changeTokenBefore,
      p_change_token_after: changeTokenAfter
    })
    
    if (error) {
      console.error('Failed to record sync operation:', error)
      throw new Error(`Failed to record sync operation: ${error.message}`)
    }
    
    return data
  }

  /**
   * Update an existing sync operation
   */
  private async updateSyncOperation(
    syncId: string, 
    status: string, 
    updates: {
      itemsProcessed?: number
      itemsCreated?: number
      itemsUpdated?: number
      errorMessage?: string
      changeTokenAfter?: string
    }
  ): Promise<void> {
    await this.initialize()
    
    const updateData: any = {
      status,
      completed_at: new Date().toISOString()
    }

    if (updates.itemsProcessed !== undefined) updateData.items_processed = updates.itemsProcessed
    if (updates.itemsCreated !== undefined) updateData.items_created = updates.itemsCreated
    if (updates.itemsUpdated !== undefined) updateData.items_updated = updates.itemsUpdated
    if (updates.errorMessage) updateData.error_message = updates.errorMessage
    if (updates.changeTokenAfter) updateData.change_token_after = updates.changeTokenAfter

    const { error } = await this.supabase
      .from('source_sync_history')
      .update(updateData)
      .eq('id', syncId)
      
    if (error) {
      console.error('Failed to update sync operation:', error)
      // Don't throw here as this is cleanup, but log the error
    }
  }

  /**
   * Get sync history for a source
   */
  async getSyncHistory(sourceId: string, limit: number = 10): Promise<any[]> {
    await this.initialize()
    
    const { data, error } = await this.supabase
      .from('source_sync_history')
      .select('*')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to get sync history: ${error.message}`)
    }

    return data || []
  }

  /**
   * Mark source items as processed after successful ingestion
   */
  async markItemsAsProcessed(sourceId: string, externalIds: string[], draftDocumentId?: string): Promise<void> {
    await this.initialize()
    
    const updateData: any = {
      is_processed: true,
      last_processed_at: new Date().toISOString()
    }

    if (draftDocumentId) {
      updateData.draft_document_id = draftDocumentId
    }

    await this.supabase
      .from('source_items')
      .update(updateData)
      .eq('source_id', sourceId)
      .in('external_id', externalIds)
  }
}

// Singleton instance
let changeDetectionService: ChangeDetectionService | null = null

export function getChangeDetectionService(): ChangeDetectionService {
  if (!changeDetectionService) {
    changeDetectionService = new ChangeDetectionService()
  }
  return changeDetectionService
}

export { ChangeDetectionService }