"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Plus, 
  Settings, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Zap,
  Upload,
  FileText,
  Users,
  Calendar,
  ExternalLink
} from "lucide-react"

interface ConnectedSource {
  id: string
  type: 'teams' | 'google_drive'
  name: string
  userId: string
  selectedChannels?: string[]
  selectedFolders?: string[]
  selectedTeamChannels?: Array<{
    teamId: string
    channelId: string
    displayName: string
  }>
  lastSyncAt?: Date
  isActive: boolean
}

interface TeamsChannel {
  id: string
  teamId: string
  displayName: string
  description?: string
  webUrl?: string
}

interface DriveItem {
  id: string
  name: string
  webUrl: string
  folder?: { childCount: number }
  file?: { mimeType: string }
}

export default function SourcesPage() {
  const [sources, setSources] = useState<ConnectedSource[]>([])
  const [loading, setLoading] = useState(true)
  const [connectingSource, setConnectingSource] = useState<'microsoft' | 'google' | null>(null)
  const [configuringSource, setConfiguringSource] = useState<ConnectedSource | null>(null)
  const [teamsChannels, setTeamsChannels] = useState<TeamsChannel[]>([])
  const [driveItems, setDriveItems] = useState<DriveItem[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [selectedFolders, setSelectedFolders] = useState<string[]>([])
  const [syncingSource, setSyncingSource] = useState<string | null>(null)
  const [configuringSourceId, setConfiguringSourceId] = useState<string | null>(null)
  const [notification, setNotification] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([])
  const [savingConfig, setSavingConfig] = useState(false)

  useEffect(() => {
    loadSources()
  }, [])

  const loadSources = async () => {
    try {
      const response = await fetch('/api/sources')
      if (response.ok) {
        const data = await response.json()
        setSources(data.sources || [])
      }
    } catch (error) {
      console.error('Failed to load sources:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnectSource = async (provider: 'microsoft' | 'google') => {
    setConnectingSource(provider)
    try {
      console.log(`Initiating ${provider} OAuth flow...`)
      
      // Redirect directly to OAuth flow
      window.location.href = `/api/oauth/${provider}/auth`
    } catch (error) {
      console.error('Failed to connect source:', error)
      alert(`Failed to connect ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setConnectingSource(null)
    }
  }

  const handleDisconnectSource = async (sourceId: string) => {
    try {
      const response = await fetch(`/api/sources?sourceId=${sourceId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await loadSources()
      }
    } catch (error) {
      console.error('Failed to disconnect source:', error)
    }
  }

  const handleConfigureSource = async (source: ConnectedSource) => {
    setConfiguringSourceId(source.id)
    
    try {
      if (source.type === 'teams') {
        // Load Teams channels
        const response = await fetch(`/api/sources/${source.id}/channels`)
        if (response.ok) {
          const data = await response.json()
          setTeamsChannels(data.channels || [])
          setSelectedChannels(source.selectedChannels || [])
        }
      } else if (source.type === 'google_drive') {
        // Load Drive folders
        const response = await fetch(`/api/sources/${source.id}/folders`)
        if (response.ok) {
          const data = await response.json()
          setDriveItems(data.items || [])
          setSelectedFolders(source.selectedFolders || [])
        }
      }
      
      // Only open dialog after data is loaded
      setConfiguringSource(source)
    } catch (error) {
      console.error('Failed to load source configuration:', error)
    } finally {
      setConfiguringSourceId(null)
    }
  }

  const handleSaveConfiguration = async () => {
    if (!configuringSource) return

    setSavingConfig(true)

    try {
      const response = await fetch(`/api/sources/${configuringSource.id}/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedChannels: configuringSource.type === 'teams' ? selectedChannels : undefined,
          selectedFolders: configuringSource.type === 'google_drive' ? selectedFolders : undefined
        })
      })

      if (response.ok) {
        await loadSources()
        
        // Show success notification
        showNotification('Configuration saved successfully!', 'success')
        
        // Store the source ID before closing the dialog
        const sourceId = configuringSource.id
        setConfiguringSource(null)
        
        // Auto-sync after configuration
        showNotification('Starting automatic sync...', 'info')
        setTimeout(() => {
          handleSyncSource(sourceId)
        }, 1000)
      } else {
        throw new Error('Failed to save configuration')
      }
    } catch (error) {
      console.error('Failed to save configuration:', error)
      showNotification('Failed to save configuration', 'error')
    } finally {
      setSavingConfig(false)
    }
  }

  const handleSyncSource = async (sourceId: string) => {
    // Prevent multiple simultaneous syncs
    if (syncingSource === sourceId) {
      return
    }

    console.log(`🔄 handleSyncSource called with sourceId: ${sourceId}`)
    console.log(`📋 Available sources:`, sources.map(s => ({ id: s.id, name: s.name, active: s.isActive })))

    setSyncingSource(sourceId)
    
    try {
      console.log(`🚀 Starting sync for source ${sourceId}...`)
      
      const response = await fetch(`/api/sources/${sourceId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType: 'manual' })
      })
      
      console.log(`📡 Sync API response status: ${response.status}`)
      
      let result
      try {
        result = await response.json()
        console.log(`📋 Sync API response:`, result)
      } catch (parseError) {
        console.error(`❌ Failed to parse sync response as JSON:`, parseError)
        throw new Error(`Invalid JSON response from sync API (status: ${response.status})`)
      }
      
      if (response.ok && result.success) {
        console.log('✅ Sync completed successfully:', result)
        
        // Show success notification
        setNotification({
          message: result.message || 'Sync completed successfully!',
          type: 'success'
        })
        
        // Show success for a moment, then clear
        setTimeout(() => {
          setSyncingSource(null)
          setNotification(null)
        }, 3000)
        
        // Reload sources to update last sync time
        await loadSources()
      } else {
        console.error(`❌ Sync failed:`, result)
        throw new Error(result.error || result.message || 'Sync failed')
      }
    } catch (error) {
      console.error('❌ Failed to sync source:', error)
      console.error(`📊 Error details:`, {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      setNotification({
        message: `Sync failed: ${errorMessage}`,
        type: 'error'
      })
      
      // Clear error after showing it
      setTimeout(() => {
        setSyncingSource(null)
        setNotification(null)
      }, 4000)
    }
  }

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type })
    setTimeout(() => {
      setNotification(null)
    }, type === 'error' ? 4000 : 3000)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    setUploadingFiles(files)
    
    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch('/api/upload/manual', {
          method: 'POST',
          body: formData
        })
        
        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }
      }
      
      showNotification(`Successfully uploaded ${files.length} file(s)`, 'success')
      
      // Clear the input
      event.target.value = ''
      
    } catch (error) {
      console.error('Upload error:', error)
      showNotification(
        error instanceof Error ? error.message : 'Upload failed', 
        'error'
      )
    } finally {
      setUploadingFiles([])
    }
  }

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'teams': return '💬'
      case 'google_drive': return '📁'
      default: return '📄'
    }
  }

  const getSourceName = (type: string) => {
    switch (type) {
      case 'teams': return 'Microsoft Teams'
      case 'google_drive': return 'Google Drive'
      default: return 'Unknown'
    }
  }

  const getStatusBadge = (source: ConnectedSource) => {
    if (!source.isActive) {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Inactive</Badge>
    }
    
    if (!source.lastSyncAt) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Not Synced</Badge>
    }

    const hoursSinceSync = (Date.now() - new Date(source.lastSyncAt).getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceSync < 1) {
      return <Badge className="bg-green-100 text-green-800">Active</Badge>
    } else if (hoursSinceSync < 24) {
      return <Badge className="bg-blue-100 text-blue-800">Recent</Badge>
    } else {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Stale</Badge>
    }
  }

  const formatLastSync = (lastSyncAt?: Date) => {
    if (!lastSyncAt) return 'Never'
    
    if (typeof window === 'undefined') return 'Loading...'
    
    const now = new Date()
    const sync = new Date(lastSyncAt)
    const diffMs = now.getTime() - sync.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMinutes < 2) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return sync.toLocaleDateString()
  }

  return (
    <DashboardLayout>
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed bottom-4 right-4 z-[9999] p-4 rounded-lg shadow-xl border max-w-md animate-in slide-in-from-right-2 ${
          notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              notification.type === 'success' ? 'bg-green-500' :
              notification.type === 'error' ? 'bg-red-500' :
              'bg-blue-500'
            }`}></div>
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}
      
      <div className="container py-8 px-4">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Data Sources</h1>
              <p className="text-muted-foreground">
                Connect and manage your knowledge sources
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Manual Upload Button */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-dashed">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Documents</DialogTitle>
                    <DialogDescription>
                      Manually upload documents to your knowledge base
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div 
                      className="border-2 border-dashed border-gray-300 hover:border-gray-400 rounded-lg p-8 text-center transition-colors"
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.currentTarget.classList.add('border-blue-400', 'bg-blue-50')
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50')
                        const files = Array.from(e.dataTransfer.files)
                        if (files.length > 0) {
                          const event = { target: { files, value: '' } } as any
                          handleFileUpload(event)
                        }
                      }}
                    >
                      <input
                        type="file"
                        multiple
                        accept=".doc,.docx,.txt,.md,.pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer block">
                        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-lg font-medium text-gray-900 mb-2">
                          Drop files here or click to browse
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                          Supports Word, Text, Markdown, and PDF files
                        </p>
                        <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 mt-2">
                          Choose Files
                        </div>
                      </label>
                    </div>
                    {uploadingFiles.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Uploading files:</h4>
                        {uploadingFiles.map((file, index) => (
                          <div key={index} className="flex items-center space-x-2 text-sm">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <span>{file.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Connect Source
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Connect a Data Source</DialogTitle>
                  <DialogDescription>
                    Choose a platform to connect and sync your knowledge base
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Button
                    onClick={() => handleConnectSource('microsoft')}
                    disabled={connectingSource === 'microsoft'}
                    className="w-full justify-start h-16 text-left"
                    variant="outline"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl">💬</div>
                      <div>
                        <div className="font-medium">Microsoft Teams</div>
                        <div className="text-sm text-muted-foreground">
                          Sync conversations and shared files
                        </div>
                      </div>
                    </div>
                    {connectingSource === 'microsoft' && (
                      <RefreshCw className="h-4 w-4 ml-auto animate-spin" />
                    )}
                  </Button>
                  
                  <Button
                    onClick={() => handleConnectSource('google')}
                    disabled={connectingSource === 'google'}
                    className="w-full justify-start h-16 text-left"
                    variant="outline"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl">📁</div>
                      <div>
                        <div className="font-medium">Google Drive</div>
                        <div className="text-sm text-muted-foreground">
                          Sync documents and folders
                        </div>
                      </div>
                    </div>
                    {connectingSource === 'google' && (
                      <RefreshCw className="h-4 w-4 ml-auto animate-spin" />
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {/* Sources Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="h-12 bg-muted rounded"></div>
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-4 bg-muted rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : sources.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-6xl mb-4">🔗</div>
                <h3 className="text-lg font-medium mb-2">No sources connected</h3>
                <p className="text-muted-foreground mb-6">
                  Connect your first data source to start building your knowledge base
                </p>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Connect Source
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Connect a Data Source</DialogTitle>
                      <DialogDescription>
                        Choose a platform to connect and sync your knowledge base
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Button
                        onClick={() => handleConnectSource('microsoft')}
                        disabled={connectingSource === 'microsoft'}
                        className="w-full justify-start h-16 text-left"
                        variant="outline"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="text-2xl">💬</div>
                          <div>
                            <div className="font-medium">Microsoft Teams</div>
                            <div className="text-sm text-muted-foreground">
                              Sync conversations and shared files
                            </div>
                          </div>
                        </div>
                        {connectingSource === 'microsoft' && (
                          <RefreshCw className="h-4 w-4 ml-auto animate-spin" />
                        )}
                      </Button>
                      
                      <Button
                        onClick={() => handleConnectSource('google')}
                        disabled={connectingSource === 'google'}
                        className="w-full justify-start h-16 text-left"
                        variant="outline"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="text-2xl">📁</div>
                          <div>
                            <div className="font-medium">Google Drive</div>
                            <div className="text-sm text-muted-foreground">
                              Sync documents and folders
                            </div>
                          </div>
                        </div>
                        {connectingSource === 'google' && (
                          <RefreshCw className="h-4 w-4 ml-auto animate-spin" />
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sources.map((source) => (
                <Card key={source.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{getSourceIcon(source.type)}</div>
                        <div>
                          <CardTitle className="text-lg">{source.name}</CardTitle>
                          <CardDescription>{getSourceName(source.type)}</CardDescription>
                        </div>
                      </div>
                      {getStatusBadge(source)}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-4">
                      {/* Source Stats */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Last Sync</div>
                          <div className="font-medium">{formatLastSync(source.lastSyncAt)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Items</div>
                          <div className="font-medium">
                            {source.type === 'teams' 
                              ? `${source.selectedChannels?.length || 0} channels`
                              : `${source.selectedFolders?.length || 0} folders`
                            }
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConfigureSource(source)}
                          disabled={configuringSourceId === source.id}
                        >
                          {configuringSourceId === source.id ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                              Configuring...
                            </>
                          ) : (
                            <>
                              <Settings className="h-4 w-4 mr-1" />
                              Configure
                            </>
                          )}
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSyncSource(source.id)}
                          disabled={syncingSource === source.id}
                        >
                          <RefreshCw className={`h-4 w-4 mr-1 ${syncingSource === source.id ? 'animate-spin' : ''}`} />
                          {syncingSource === source.id ? 'Syncing' : 'Sync'}
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Disconnect Source</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to disconnect "{source.name}"? 
                                This will stop syncing data from this source.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDisconnectSource(source.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Disconnect
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    

                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Configuration Dialog */}
      <Dialog open={!!configuringSource} onOpenChange={(open) => {
        if (!open && !savingConfig) {
          setConfiguringSource(null)
          setConfiguringSourceId(null)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Configure {configuringSource?.name}
            </DialogTitle>
            <DialogDescription>
              Select the {configuringSource?.type === 'teams' ? 'channels' : 'folders'} to sync
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-96 overflow-y-auto">
            {configuringSource?.type === 'teams' ? (
              <div className="space-y-2">
                {teamsChannels.map((channel) => (
                  <div key={channel.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      checked={selectedChannels.includes(channel.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedChannels([...selectedChannels, channel.id])
                        } else {
                          setSelectedChannels(selectedChannels.filter(id => id !== channel.id))
                        }
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{channel.displayName}</div>
                      {channel.description && (
                        <div className="text-sm text-muted-foreground">{channel.description}</div>
                      )}
                    </div>
                    {channel.webUrl && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={channel.webUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {driveItems.filter(item => item.folder).map((folder) => (
                  <div key={folder.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      checked={selectedFolders.includes(folder.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedFolders([...selectedFolders, folder.id])
                        } else {
                          setSelectedFolders(selectedFolders.filter(id => id !== folder.id))
                        }
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{folder.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {folder.folder?.childCount || 0} items
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={folder.webUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setConfiguringSource(null)
                setConfiguringSourceId(null)
              }}
              disabled={savingConfig}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveConfiguration} disabled={savingConfig}>
              {savingConfig ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving & Syncing...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}