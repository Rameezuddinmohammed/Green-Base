"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Edit, 
  AlertTriangle, 
  ThumbsUp, 
  Eye,
  Filter,
  ArrowUpDown,
  FileText,
  User,
  Calendar,
  Tag,
  Zap,
  GitCompare,
  Sparkles
} from "lucide-react"

interface DraftDocument {
  id: string
  title: string
  content: string
  original_content?: string
  summary?: string
  topics?: string[]
  confidence_score: number
  triage_level?: 'red' | 'yellow' | 'green'
  created_at: string
  source_references?: any[]
  status: string
  confidence_reasoning?: string
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
    if (score >= 0.8) return "hsl(142, 76%, 36%)" // green-600
    if (score >= 0.5) return "hsl(32, 95%, 44%)" // orange-500
    return "hsl(0, 84%, 60%)" // red-500
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
  const [selectedDrafts, setSelectedDrafts] = useState<string[]>([])
  const [editingDraft, setEditingDraft] = useState<DraftDocument | null>(null)
  const [editedContent, setEditedContent] = useState("")
  const [expandedDiff, setExpandedDiff] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'confidence' | 'date' | 'title'>('confidence')
  const [filterBy, setFilterBy] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  useEffect(() => {
    loadDrafts()
  }, [])

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

  const handleBatchApprove = async () => {
    try {
      const response = await fetch('/api/drafts/batch-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftIds: selectedDrafts })
      })
      
      if (response.ok) {
        await loadDrafts()
        setSelectedDrafts([])
      }
    } catch (error) {
      console.error('Failed to batch approve:', error)
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
    if (score >= 0.8) return 'high'
    if (score >= 0.5) return 'medium'
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
              <CardDescription>AI-processed documents awaiting review</CardDescription>
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
    <>
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
                <SelectTrigger className="w-32">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confidence">Confidence</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                </SelectContent>
              </Select>

              {/* Batch Actions */}
              {selectedDrafts.length > 0 && (
                <Button onClick={handleBatchApprove} className="bg-green-600 hover:bg-green-700">
                  <ThumbsUp className="h-4 w-4 mr-2" />
                  Approve {selectedDrafts.length}
                </Button>
              )}
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
                      {/* Selection checkbox */}
                      <Checkbox
                        checked={selectedDrafts.includes(draft.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDrafts([...selectedDrafts, draft.id])
                          } else {
                            setSelectedDrafts(selectedDrafts.filter(id => id !== draft.id))
                          }
                        }}
                        className="mt-1"
                      />

                      {/* Confidence Ring */}
                      <div className="flex-shrink-0">
                        <ConfidenceRing score={draft.confidence_score} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                              {draft.title}
                            </h3>
                            
                            {/* Metadata */}
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-3">
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                {new Date(draft.created_at).toLocaleString()}
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
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
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

                            {/* AI Confidence reasoning */}
                            {draft.confidence_reasoning && (
                              <div className="bg-muted/50 rounded-lg p-3 mb-3">
                                <div className="flex items-start space-x-2">
                                  <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs font-medium text-foreground mb-1">AI Assessment</p>
                                    <p className="text-xs text-muted-foreground">{draft.confidence_reasoning}</p>
                                  </div>
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
                          <Button
                            size="sm"
                            onClick={() => handleApprove(draft.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          
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
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(draft.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>

                        {/* Inline Diff View */}
                        {expandedDiff === draft.id && (
                          <div className="mt-4 p-4 bg-muted/30 rounded-lg border animate-in slide-in-from-top-2">
                            <h4 className="font-medium mb-2 flex items-center">
                              <GitCompare className="h-4 w-4 mr-2" />
                              Document Content Preview
                            </h4>
                            <div className="max-h-64 overflow-y-auto">
                              <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                                {draft.content.substring(0, 1000)}
                                {draft.content.length > 1000 && '...'}
                              </pre>
                            </div>
                            {draft.changes_made && draft.changes_made.length > 0 && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-xs font-medium text-foreground mb-2">AI Changes Made:</p>
                                <ul className="text-xs text-muted-foreground space-y-1">
                                  {draft.changes_made.map((change, index) => (
                                    <li key={index} className="flex items-start">
                                      <span className="text-green-600 mr-2">+</span>
                                      {change}
                                    </li>
                                  ))}
                                </ul>
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
    </>
  )
}