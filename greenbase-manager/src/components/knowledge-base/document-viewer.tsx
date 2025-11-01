"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { 
  ArrowLeft, 
  Calendar, 
  User, 
  ExternalLink,
  Tag,
  Clock,
  FileText,
  History
} from "lucide-react"
import { MarkdownRenderer } from './markdown-renderer'
import { VersionHistory } from './version-history'

interface DocumentViewerProps {
  documentId: string
  onBack: () => void
  document?: ApprovedDocument | null
}

interface ApprovedDocument {
  id: string
  title: string
  content: string
  summary: string
  tags: string[]
  created_at: string
  updated_at: string
  approved_by: string
  approved_at: string
  original_created_at?: string
  version: number
  source_type?: 'teams' | 'google_drive'
  source_url?: string
  topics?: string[]
  source_draft?: {
    source_references?: any
  }
  approver?: {
    email: string
  }
}

interface DocumentVersion {
  id: string
  version: number
  content: string
  changes: string
  approved_by: string
  approved_at: string
  created_at: string
}

export function DocumentViewer({ documentId, onBack, document: initialDocument }: DocumentViewerProps) {
  const [document, setDocument] = useState<ApprovedDocument | null>(initialDocument || null)
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(!initialDocument)
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('content')

  useEffect(() => {
    if (!initialDocument) {
      loadDocument()
    }
  }, [documentId, initialDocument])

  const loadDocument = async () => {
    try {
      setLoading(true)
      
      // Load document details
      const response = await fetch(`/api/knowledge-base/${documentId}`)
      if (response.ok) {
        const data = await response.json()
        setDocument(data.document)
      }
    } catch (error) {
      console.error('Failed to load document:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadVersions = async () => {
    if (versionsLoading || versions.length > 0) return
    
    try {
      setVersionsLoading(true)
      const response = await fetch(`/api/knowledge-base/${documentId}/versions`)
      if (response.ok) {
        const data = await response.json()
        setVersions(data.versions || [])
      }
    } catch (error) {
      console.error('Failed to load versions:', error)
    } finally {
      setVersionsLoading(false)
    }
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    if (tab === 'history') {
      loadVersions()
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
    return formatDate(dateString)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" disabled>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Knowledge Base
          </Button>
        </div>
        
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-8 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded w-5/6"></div>
              <div className="h-4 bg-muted rounded w-4/6"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Knowledge Base
          </Button>
        </div>
        
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Document not found</h3>
            <p className="text-muted-foreground">
              The requested document could not be found or you don't have access to it.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Knowledge Base
        </Button>
      </div>

      {/* Document Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl">{document.title}</CardTitle>
              <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                <span className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  Approved {formatDate(document.approved_at)}
                </span>
                <span className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {formatRelativeTime(document.approved_at)}
                </span>
                {document.original_created_at && (
                  <span className="flex items-center">
                    <FileText className="h-4 w-4 mr-1" />
                    Created {formatDate(document.original_created_at)}
                  </span>
                )}
                <span className="flex items-center">
                  <User className="h-4 w-4 mr-1" />
                  v{document.version} by {document.approver?.email || document.approved_by}
                </span>
              </div>
            </div>
            
            {document.source_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={document.source_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Source
                </a>
              </Button>
            )}
          </div>

          {/* Tags and Topics */}
          {((document.tags?.length ?? 0) > 0 || (document.topics?.length ?? 0) > 0) && (
            <div className="flex flex-wrap gap-2 pt-3">
              {document.tags?.map((tag, index) => (
                <Badge key={`tag-${index}`} variant="secondary">
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
              {document.topics?.map((topic, index) => (
                <Badge key={`topic-${index}`} variant="outline">
                  {topic}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="mt-0">
          <Card>
            {document.summary && (
              <CardHeader className="pb-2">
                <p className="text-muted-foreground text-sm leading-snug">{document.summary}</p>
              </CardHeader>
            )}
            <CardContent className={document.summary ? "pt-0 pb-4" : "pt-4 pb-4"}>
              <MarkdownRenderer content={document.content} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Version History</CardTitle>
              <p className="text-muted-foreground">
                Track changes and view previous versions of this document
              </p>
            </CardHeader>
            <CardContent>
              {versionsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <VersionHistory
                  versions={versions}
                  currentVersion={document.version}
                  onViewVersion={(version) => {
                    // Handle version viewing if needed
                    console.log('Viewing version:', version)
                  }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metadata Tab */}
        <TabsContent value="metadata">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Document Metadata</CardTitle>
              <p className="text-muted-foreground">
                Detailed information about this document
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Basic Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Document ID:</span>
                        <span className="font-mono">{document.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Version:</span>
                        <span>{document.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created:</span>
                        <span>{formatDate(document.created_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Updated:</span>
                        <span>{formatDate(document.updated_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Approved By:</span>
                        <span>{document.approver?.email || document.approved_by}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Source Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Source Type:</span>
                        <span className="capitalize">{document.source_type || 'Unknown'}</span>
                      </div>
                      {document.source_url && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Source URL:</span>
                          <a 
                            href={document.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate max-w-48"
                          >
                            {document.source_url}
                          </a>
                        </div>
                      )}
                      {document.source_draft?.source_references && (
                        <div>
                          <span className="text-muted-foreground">External References:</span>
                          <div className="mt-1 text-xs bg-muted p-2 rounded">
                            <pre>{JSON.stringify(document.source_draft.source_references, null, 2)}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}