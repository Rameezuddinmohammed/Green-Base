"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Settings, Trash2, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, Loader2 } from "lucide-react"

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
  const [syncingSource, setSyncingSource] = useState<string | null>(null)

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
    setSyncingSource(sourceId)
    try {
      const response = await fetch(`/api/sources/${sourceId}/ingest`, {
        method: 'POST'
      })
      
      if (response.ok) {
        await loadSources()
      }
    } catch (error) {
      console.error('Failed to sync source:', error)
    } finally {
      setSyncingSource(null)
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
              <button 
                className="btn btn-outline"
                style={{ justifyContent: 'flex-start', height: 'auto', padding: '1rem', width: '100%' }}
                onClick={() => handleConnectSource('microsoft')}
              >
                <div className="flex items-center space-x-3">
                  <span style={{ fontSize: '1.5rem' }}>💬</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: '500' }}>Microsoft Teams</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Connect Teams channels for message ingestion
                    </div>
                  </div>
                </div>
              </button>
              
              <button 
                className="btn btn-outline"
                style={{ justifyContent: 'flex-start', height: 'auto', padding: '1rem', width: '100%' }}
                onClick={() => handleConnectSource('google')}
              >
                <div className="flex items-center space-x-3">
                  <span style={{ fontSize: '1.5rem' }}>📁</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: '500' }}>Google Drive</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Connect Drive folders for document ingestion
                    </div>
                  </div>
                </div>
              </button>
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
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {sources.map((source) => {
            const error = getSourceError(source)
            return (
              <div key={source.id} className="card hover-lift" style={{ position: 'relative' }}>
                <div className="card-header">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span style={{ fontSize: '1.125rem' }}>{getSourceIcon(source.type)}</span>
                      <h3 className="card-title" style={{ fontSize: '1rem' }}>{source.name}</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getSourceStatusBadge(source)}
                      {error && (
                        <div style={{ position: 'relative' }}>
                          <AlertTriangle style={{ width: '1rem', height: '1rem', color: '#ef4444' }} />
                          <div style={{ position: 'absolute', bottom: '100%', right: '0', marginBottom: '0.5rem', width: '16rem', padding: '0.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.375rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '0.75rem', color: '#991b1b', opacity: '0', transition: 'opacity 0.2s', zIndex: '10' }}>
                            {error}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="card-description">
                    <div className="flex items-center justify-between">
                      <span>{source.type === 'teams' ? 'Microsoft Teams' : 'Google Drive'}</span>
                      {source.lastSyncAt && (
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          Last sync: {new Date(source.lastSyncAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {source.selectedChannels?.length && (
                      <span style={{ display: 'block', fontSize: '0.75rem', marginTop: '0.25rem', color: '#16a34a' }}>
                        📺 {source.selectedChannels.length} channels selected
                      </span>
                    )}
                    {source.selectedFolders?.length && (
                      <span style={{ display: 'block', fontSize: '0.75rem', marginTop: '0.25rem', color: '#16a34a' }}>
                        📁 {source.selectedFolders.length} folders selected
                      </span>
                    )}
                  </div>
                </div>
                <div className="card-content">
                  <div className="flex space-x-2">
                    <button 
                      className="btn btn-outline btn-sm"
                      onClick={() => handleConfigureSource(source)}
                      style={{ flex: '1' }}
                    >
                      <Settings style={{ width: '0.75rem', height: '0.75rem', marginRight: '0.25rem' }} />
                      Configure
                    </button>
                    
                    {/* Sync Now button - visible on hover */}
                    <button
                      className="btn btn-outline btn-sm hover-scale"
                      onClick={(e) => handleSyncNow(source.id, e)}
                      style={{ 
                        opacity: source.isActive ? '1' : '0.5',
                        transition: 'all 0.2s ease',
                        backgroundColor: source.isActive ? '#f0fdf4' : 'transparent',
                        borderColor: source.isActive ? '#22c55e' : '#d1d5db',
                        color: source.isActive ? '#16a34a' : '#6b7280'
                      }}
                      title="Sync now"
                      disabled={!source.isActive || syncingSource === source.id}
                    >
                      <RefreshCw 
                        style={{ 
                          width: '0.75rem', 
                          height: '0.75rem',
                          animation: syncingSource === source.id ? 'spin 1s linear infinite' : 'none'
                        }} 
                      />
                      <span style={{ marginLeft: '0.25rem', fontSize: '0.75rem' }}>
                        {syncingSource === source.id ? 'Syncing...' : 'Sync'}
                      </span>
                    </button>
                    
                    <button 
                      className="btn btn-outline btn-sm" 
                      style={{ color: '#dc2626' }}
                      onClick={() => {
                        if (confirm(`Are you sure you want to disconnect "${source.name}"?`)) {
                          handleDisconnectSource(source.id)
                        }
                      }}
                    >
                      <Trash2 style={{ width: '0.75rem', height: '0.75rem', marginRight: '0.25rem' }} />
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
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
