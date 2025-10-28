"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  CheckCircle, 
  XCircle, 
  Edit, 
  ThumbsUp, 
  Filter,
  ArrowUpDown,
  FileText,
  User,
  Calendar,
  Tag,
  GitCompare,
  Sparkles
} from "lucide-react"

interface SourceDocument {
  id: string
  source_type: string
  source_id: string
  original_content: string
  redacted_content: string
  metadata: any
}

interface DraftDocument {
  id: string
  title: string
  content: string
  original_content?: string
  summary?: string
  topics?: string[]
  confidence_score: number
  confidence_reasoning?: string
  triage_level?: 'red' | 'yellow' | 'green'
  created_at: string
  source_references?: any[]
  source_documents?: SourceDocument[]
  status: string
  author?: string
  changes_made?: string[]
}

interface ConfidenceRingProps {
  score: number
  size?: number
}

function ConfidenceRing({ score, size = 40 }: ConfidenceRingProps) {
  const percentage = Math.round(score * 100)
  const circumference = 2 * Math.PI * 16
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  
  const getColor = (score: number) => {
    if (score >= 0.8) return "hsl(142, 76%, 36%)" // green-600 ≥80%
    if (score >= 0.6) return "hsl(32, 95%, 44%)" // orange-500 ≥60%
    return "hsl(0, 84%, 60%)" // red-500 <60%
  }

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r="16"
          stroke="currentColor"
          strokeWidth="3"
          fill="transparent"
          className="text-muted-foreground/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r="16"
          stroke={getColor(score)}
          strokeWidth="3"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300 ease-in-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold" style={{ color: getColor(score) }}>
          {percentage}%
        </span>
      </div>
    </div>
  )
}

export function ApprovalQueueEnhanced() {
  const [drafts, setDrafts] = useState<DraftDocument[]>([])
  const [loading, setLoading] = useState(true)

  const [editingDraft, setEditingDraft] = useState<DraftDocument | null>(null)
  const [editedContent, setEditedContent] = useState("")
  const [expandedDiff, setExpandedDiff] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'confidence' | 'date' | 'title'>('confidence')
  const [filterBy, setFilterBy] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  useEffect(() => {
    loadDrafts()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return // Don't trigger shortcuts when typing in inputs
      }

      // Batch operations require Ctrl+Shift for safety
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        // Batch approve all green items
        handleBatchApproveAllGreen()
        return
      }
      
      // Individual item shortcuts with Ctrl modifier for safety
      if (e.ctrlKey && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'a':
            e.preventDefault()
            // TODO: Handle individual approve for focused item
            break
          case 'e':
            e.preventDefault()
            // TODO: Handle individual edit for focused item
            break
          case 'r':
            e.preventDefault()
            // TODO: Handle individual reject for focused item
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [drafts])

  const loadDrafts = async () => {
    try {
      const response = await fetch('/api/drafts')
      if (response.ok) {
        const data = await response.json()
        setDrafts(data.drafts || [])
      }
    } catch (error) {
      console.error('Failed to load drafts:', error)
    } finally {
      setLoading(false)
    }
  }



  const handleApprove = async (draftId: string) => {
    try {
      const response = await fetch(`/api/drafts/${draftId}/approve`, {
        method: 'POST'
      })
      
      if (response.ok) {
        await loadDrafts()
      }
    } catch (error) {
      console.error('Failed to approve draft:', error)
    }
  }

  const handleReject = async (draftId: string) => {
    try {
      const response = await fetch(`/api/drafts/${draftId}/reject`, {
        method: 'POST'
      })
      
      if (response.ok) {
        await loadDrafts()
      }
    } catch (error) {
      console.error('Failed to reject draft:', error)
    }
  }

  const handleEditAndApprove = async () => {
    if (!editingDraft) return

    try {
      const response = await fetch(`/api/drafts/${editingDraft.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editedContent })
      })
      
      if (response.ok) {
        await loadDrafts()
        setEditingDraft(null)
        setEditedContent("")
      }
    } catch (error) {
      console.error('Failed to edit and approve:', error)
    }
  }

  const getConfidenceLevel = (score: number) => {
    if (score >= 0.85) return 'high'
    if (score >= 0.60) return 'medium'
    return 'low'
  }

  const getTriageColor = (level: string) => {
    switch (level) {
      case 'green': return 'bg-green-50 text-green-700 border-green-200'
      case 'yellow': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'red': return 'bg-red-50 text-red-700 border-red-200'
      default: return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const filteredAndSortedDrafts = drafts
    .filter(draft => {
      if (filterBy === 'all') return true
      const level = getConfidenceLevel(draft.confidence_score)
      return level === filterBy
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return b.confidence_score - a.confidence_score
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'title':
          return a.title.localeCompare(b.title)
        default:
          return 0
      }
    })

  const pendingDrafts = filteredAndSortedDrafts.filter(draft => draft.status === 'pending')

  const handleBatchApproveAllGreen = async () => {
    try {
      // Get all green items from current filtered list
      const greenItems = pendingDrafts.filter((draft: DraftDocument) => draft.triage_level === 'green')
      const greenIds = greenItems.map((draft: DraftDocument) => draft.id)
      
      if (greenIds.length === 0) return
      
      const response = await fetch('/api/drafts/batch-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: greenIds })
      })
      
      if (response.ok) {
        await loadDrafts()
      }
    } catch (error) {
      console.error('Failed to batch approve:', error)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Approval Queue
              </CardTitle>
              <CardDescription>
                AI-processed documents awaiting review
                <span className="ml-4 text-xs text-muted-foreground">
                  Individual: <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+A</kbd> approve 
                  <kbd className="ml-1 px-1 py-0.5 bg-muted rounded text-xs">Ctrl+R</kbd> reject 
                  <kbd className="ml-1 px-1 py-0.5 bg-muted rounded text-xs">Ctrl+E</kbd> edit
                  • Batch: <kbd className="ml-1 px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Shift+A</kbd> approve all green
                </span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Approval Queue
                {pendingDrafts.length > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-800">
                    {pendingDrafts.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>AI-processed documents awaiting review</CardDescription>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Filters */}
              <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="high">High Confidence</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low Confidence</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-40">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confidence">Confidence</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                </SelectContent>
              </Select>

              {/* Batch Approve All Green Items */}
              {(() => {
                const greenCount = pendingDrafts.filter((draft: DraftDocument) => draft.triage_level === 'green').length
                return greenCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={handleBatchApproveAllGreen} 
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2"
                        size="lg"
                      >
                        <ThumbsUp className="h-5 w-5 mr-2" />
                        Approve all Green drafts
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Shift+A</kbd>
                    </TooltipContent>
                  </Tooltip>
                )
              })()}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {pendingDrafts.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">All caught up!</h3>
              <p className="text-muted-foreground">No documents pending approval.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingDrafts.map((draft) => (
                <Card key={draft.id} className="transition-all duration-200 hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">


                      {/* Confidence Ring with Visual Icons */}
                      <div className="flex-shrink-0 flex items-center space-x-2">
                        <div className="text-lg">
                          {draft.confidence_score >= 0.85 ? '🟢' : 
                           draft.confidence_score >= 0.60 ? '🟡' : '🔴'}
                        </div>
                        <ConfidenceRing score={draft.confidence_score} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-2">
                              <h3 className="text-lg font-semibold text-foreground">
                                {(() => {
                                  // Try to get original filename from source references
                                  const originalTitle = draft.source_references?.[0]?.title || 
                                                      draft.source_documents?.[0]?.metadata?.fileName ||
                                                      draft.title
                                  return originalTitle
                                })()}
                              </h3>
                              {/* Show AI-generated topic as subtitle if different from filename */}
                              {draft.topics && draft.topics.length > 0 && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {draft.topics[0]}
                                </p>
                              )}
                            </div>
                            
                            {/* Metadata */}
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-3">
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                {(() => {
                                  if (typeof window === 'undefined') return 'Loading...'
                                  // Try to get source file timestamp, fallback to draft creation
                                  const sourceTimestamp = draft.source_documents?.[0]?.metadata?.createdAt || 
                                                        draft.source_references?.[0]?.createdAt ||
                                                        draft.created_at
                                  return new Date(sourceTimestamp).toLocaleString()
                                })()}
                              </div>
                              {draft.author && (
                                <div className="flex items-center">
                                  <User className="h-4 w-4 mr-1" />
                                  {draft.author}
                                </div>
                              )}
                              {draft.source_references && draft.source_references.length > 0 && (
                                <div className="flex items-center">
                                  <FileText className="h-4 w-4 mr-1" />
                                  {draft.source_references[0].sourceType === 'google_drive' ? '📁 Google Drive' : '💬 Teams'}
                                </div>
                              )}
                            </div>

                            {/* Summary */}
                            {draft.summary && (
                              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                                {draft.summary}
                              </p>
                            )}

                            {/* Topics */}
                            {draft.topics && draft.topics.length > 0 && (
                              <div className="flex items-center space-x-2 mb-3">
                                <Tag className="h-4 w-4 text-muted-foreground" />
                                <div className="flex flex-wrap gap-1">
                                  {draft.topics.slice(0, 3).map((topic, index) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {topic}
                                    </Badge>
                                  ))}
                                  {draft.topics.length > 3 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{draft.topics.length - 3} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}


                          </div>

                          {/* Triage Level */}
                          <div className="flex-shrink-0 ml-4">
                            <Badge className={getTriageColor(draft.triage_level || 'gray')}>
                              {draft.triage_level === 'green' && '🟢 High Confidence'}
                              {draft.triage_level === 'yellow' && '🟡 Medium Confidence'}
                              {draft.triage_level === 'red' && '🔴 Low Confidence'}
                            </Badge>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2 mt-4">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(draft.id)}
                                className="bg-green-600 hover:bg-green-700 relative"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+A</kbd>
                            </TooltipContent>
                          </Tooltip>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setExpandedDiff(expandedDiff === draft.id ? null : draft.id)
                            }}
                          >
                            <GitCompare className="h-4 w-4 mr-1" />
                            View Diff
                          </Button>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingDraft(draft)
                                  setEditedContent(draft.content)
                                }}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+E</kbd>
                            </TooltipContent>
                          </Tooltip>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReject(draft.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+R</kbd>
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        {/* Enhanced Diff View - Original vs AI Structured */}
                        {expandedDiff === draft.id && (
                          <div className="mt-4 p-4 bg-muted/30 rounded-lg border animate-in slide-in-from-top-2">
                            <h4 className="font-medium mb-4 flex items-center">
                              <GitCompare className="h-4 w-4 mr-2" />
                              Source Content vs AI Structured Draft
                            </h4>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {/* Original Source Content */}
                              <div className="space-y-3">
                                <h5 className="text-sm font-semibold text-orange-700 bg-orange-50 px-2 py-1 rounded flex items-center">
                                  <FileText className="h-3 w-3 mr-1" />
                                  Original Source{draft.source_documents && draft.source_documents.length > 1 ? 's' : ''}
                                </h5>
                                <div className="max-h-80 overflow-y-auto border rounded bg-white">
                                  {draft.source_documents && draft.source_documents.length > 0 ? (
                                    draft.source_documents.map((source, index) => (
                                      <div key={source.id} className="p-3 border-b last:border-b-0">
                                        {draft.source_documents!.length > 1 && (
                                          <div className="text-xs text-muted-foreground mb-2 font-medium">
                                            Source {index + 1} ({source.source_type})
                                          </div>
                                        )}
                                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                                          {source.original_content || 'No original content available'}
                                        </pre>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="p-3 text-xs text-muted-foreground italic">
                                      No source content available
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* AI Structured Draft */}
                              <div className="space-y-3">
                                <h5 className="text-sm font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded flex items-center">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  AI Structured Draft
                                </h5>
                                <div className="max-h-80 overflow-y-auto border rounded bg-white">
                                  <div className="p-3">
                                    <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                                      {draft.content}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* AI Confidence Assessment */}
                            {draft.confidence_reasoning && (
                              <div className="mt-4 pt-4 border-t">
                                <h6 className="text-sm font-semibold text-purple-700 mb-3 flex items-center">
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  AI Confidence Assessment
                                </h6>
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                  <p className="text-sm text-purple-800 leading-relaxed">
                                    {draft.confidence_reasoning}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Source Metadata */}
                            {draft.source_documents && draft.source_documents.length > 0 && (
                              <div className="mt-4 pt-4 border-t">
                                <h6 className="text-xs font-semibold text-gray-600 mb-2">Source Details</h6>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {draft.source_documents.map((source, index) => (
                                    <div key={source.id} className="text-xs bg-gray-50 p-2 rounded">
                                      <div className="font-medium">Source {index + 1}</div>
                                      <div className="text-muted-foreground">
                                        Type: {source.source_type} | ID: {source.source_id.substring(0, 8)}...
                                      </div>
                                      {source.metadata?.author && (
                                        <div className="text-muted-foreground">
                                          Author: {source.metadata.author}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={!!editingDraft} onOpenChange={() => setEditingDraft(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Edit Document: {editingDraft?.title}</DialogTitle>
            <DialogDescription>Make changes and approve, or cancel to return</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-64 font-mono text-sm"
              placeholder="Edit document content..."
            />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setEditingDraft(null)
                setEditedContent("")
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEditAndApprove} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Save & Approve
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}