"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Settings, Trash2, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react"

interface ConnectedSource {
  id: string
  type: 'teams' | 'google_drive'
  name: string
  userId: string
  selectedChannels?: string[]
  selectedFolders?: string[]
  selectedTeamChannels?: TeamChannelMapping[]
  lastSyncAt?: Date
  isActive: boolean
}

interface TeamChannelMapping {
  teamId: string
  channelId: string
  displayName: string
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
  folder?: {
    childCount: number
  }
  file?: {
    mimeType: string
  }
  createdDateTime: string
  lastModifiedDateTime: string
  size?: number
}

export function SourceManagement() {
  const [sources, setSources] = useState<ConnectedSource[]>([])
  const [loading, setLoading] = useState(true)
  const [connectDialogOpen, setConnectDialogOpen] = useState(false)
  const [configureDialogOpen, setConfigureDialogOpen] = useState(false)
  const [selectedSource, setSelectedSource] = useState<ConnectedSource | null>(null)
  const [teamsChannels, setTeamsChannels] = useState<TeamsChannel[]>([])
  const [driveItems, setDriveItems] = useState<DriveItem[]>([])
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [selectedFolders, setSelectedFolders] = useState<string[]>([])

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
    try {
      const response = await fetch(`/api/oauth/${provider}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceName: `${provider === 'microsoft' ? 'Teams' : 'Google Drive'} Connection` })
      })
      
      if (response.ok) {
        const data = await response.json()
        window.location.href = data.authUrl
      }
    } catch (error) {
      console.error('Failed to initiate OAuth:', error)
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
    setSelectedSource(source)
    setSelectedChannels(source.selectedChannels || [])
    setSelectedFolders(source.selectedFolders || [])
    
    if (source.type === 'teams') {
      try {
        const response = await fetch(`/api/sources/${source.id}/channels`)
        if (response.ok) {
          const data = await response.json()
          setTeamsChannels(data.channels || [])
        }
      } catch (error) {
        console.error('Failed to load Teams channels:', error)
      }
    } else if (source.type === 'google_drive') {
      try {
        const response = await fetch(`/api/sources/${source.id}/folders`)
        if (response.ok) {
          const data = await response.json()
          setDriveItems(data.items || [])
        }
      } catch (error) {
        console.error('Failed to load Drive folders:', error)
      }
    }
    
    setConfigureDialogOpen(true)
  }

  const handleSaveConfiguration = async () => {
    if (!selectedSource) return

    try {
      const response = await fetch(`/api/sources/${selectedSource.id}/configure`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedChannels: selectedSource.type === 'teams' ? selectedChannels : undefined,
          selectedFolders: selectedSource.type === 'google_drive' ? selectedFolders : undefined
        })
      })
      
      if (response.ok) {
        await loadSources()
        setConfigureDialogOpen(false)
      }
    } catch (error) {
      console.error('Failed to save configuration:', error)
    }
  }

  const handleSyncNow = async (sourceId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const response = await fetch(`/api/sources/${sourceId}/ingest`, {
        method: 'POST'
      })
      
      if (response.ok) {
        await loadSources()
      }
    } catch (error) {
      console.error('Failed to sync source:', error)
    }
  }

  const getSourceStatusBadge = (source: ConnectedSource) => {
    if (!source.isActive) {
      return <Badge className="status-error"><XCircle className="w-3 h-3 mr-1" />Disconnected</Badge>
    }
    
    if (source.lastSyncAt) {
      const hoursSinceSync = (Date.now() - new Date(source.lastSyncAt).getTime()) / (1000 * 60 * 60)
      if (hoursSinceSync < 1) {
        return <Badge className="status-active"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
      } else if (hoursSinceSync < 24) {
        return <Badge className="status-idle"><Clock className="w-3 h-3 mr-1" />Synced {Math.floor(hoursSinceSync)}h ago</Badge>
      }
    }
    
    return <Badge className="status-idle"><Clock className="w-3 h-3 mr-1" />Pending Sync</Badge>
  }

  const getSourceError = (source: ConnectedSource) => {
    // Mock error for demo - in real app, this would come from the source data
    if (!source.isActive) {
      return "Connection failed: Invalid credentials"
    }
    return null
  }

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'teams':
        return ''
      case 'google_drive':
        return ''
      default:
        return ''
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading sources...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Connected Sources</h3>
          <p className="text-sm text-muted-foreground">
            Manage your Teams channels and Google Drive folders
          </p>
        </div>
        
        <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Connect Source
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect New Source</DialogTitle>
              <DialogDescription>
                Choose a source to connect to your knowledge base
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Button 
                variant="outline" 
                className="justify-start h-auto p-4"
                onClick={() => handleConnectSource('microsoft')}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl"></span>
                  <div className="text-left">
                    <div className="font-medium">Microsoft Teams</div>
                    <div className="text-sm text-muted-foreground">
                      Connect Teams channels for message ingestion
                    </div>
                  </div>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="justify-start h-auto p-4"
                onClick={() => handleConnectSource('google')}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl"></span>
                  <div className="text-left">
                    <div className="font-medium">Google Drive</div>
                    <div className="text-sm text-muted-foreground">
                      Connect Drive folders for document ingestion
                    </div>
                  </div>
                </div>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {sources.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-4xl mb-4"></div>
            <h3 className="text-lg font-medium mb-2">No sources connected</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Connect your Teams channels or Google Drive folders to start building your knowledge base
            </p>
            <Button onClick={() => setConnectDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Connect Your First Source
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => {
            const error = getSourceError(source)
            return (
              <Card key={source.id} className="hover-lift group relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getSourceIcon(source.type)}</span>
                      <CardTitle className="text-base">{source.name}</CardTitle>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getSourceStatusBadge(source)}
                      {error && (
                        <div className="relative">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-red-50 border border-red-200 rounded-md shadow-lg text-xs text-red-800 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            {error}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <CardDescription>
                    <div className="flex items-center justify-between">
                      <span>{source.type === 'teams' ? 'Microsoft Teams' : 'Google Drive'}</span>
                      {source.lastSyncAt && (
                        <span className="text-xs text-muted-foreground">
                          Last sync: {new Date(source.lastSyncAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {source.selectedChannels?.length && (
                      <span className="block text-xs mt-1 text-primary-600">
                        📺 {source.selectedChannels.length} channels selected
                      </span>
                    )}
                    {source.selectedFolders?.length && (
                      <span className="block text-xs mt-1 text-primary-600">
                        📁 {source.selectedFolders.length} folders selected
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleConfigureSource(source)}
                      className="flex-1"
                    >
                      <Settings className="w-3 h-3 mr-1" />
                      Configure
                    </Button>
                    
                    {/* Sync Now button - appears on hover */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleSyncNow(source.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Sync now"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="w-3 h-3 mr-1" />
                          Disconnect
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect Source</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to disconnect "{source.name}"? 
                            This will revoke access and archive related documents.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDisconnectSource(source.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={configureDialogOpen} onOpenChange={setConfigureDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure {selectedSource?.name}</DialogTitle>
            <DialogDescription>
              Select the {selectedSource?.type === 'teams' ? 'channels' : 'folders'} you want to include in your knowledge base
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-96 overflow-y-auto">
            {selectedSource?.type === 'teams' && (
              <div className="space-y-2">
                {teamsChannels.map((channel) => (
                  <div key={channel.id} className="flex items-center space-x-2 p-2 border rounded">
                    <Checkbox
                      id={channel.id}
                      checked={selectedChannels.includes(channel.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedChannels([...selectedChannels, channel.id])
                        } else {
                          setSelectedChannels(selectedChannels.filter(id => id !== channel.id))
                        }
                      }}
                    />
                    <label htmlFor={channel.id} className="flex-1 cursor-pointer">
                      <div className="font-medium">{channel.displayName}</div>
                      {channel.description && (
                        <div className="text-sm text-muted-foreground">{channel.description}</div>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            )}
            
            {selectedSource?.type === 'google_drive' && (
              <div className="space-y-2">
                {driveItems.filter(item => item.folder).map((folder) => (
                  <div key={folder.id} className="flex items-center space-x-2 p-2 border rounded">
                    <Checkbox
                      id={folder.id}
                      checked={selectedFolders.includes(folder.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedFolders([...selectedFolders, folder.id])
                        } else {
                          setSelectedFolders(selectedFolders.filter(id => id !== folder.id))
                        }
                      }}
                    />
                    <label htmlFor={folder.id} className="flex-1 cursor-pointer">
                      <div className="font-medium"> {folder.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {folder.folder?.childCount} items
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setConfigureDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfiguration}>
              Save Configuration
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
