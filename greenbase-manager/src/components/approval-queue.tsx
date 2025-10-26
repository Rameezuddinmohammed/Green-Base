"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle, XCircle, Clock, Edit, AlertTriangle, ThumbsUp } from "lucide-react"

interface DraftDocument {
  id: string
  title: string
  content: string
  summary?: string
  topics?: string[]
  confidence_score: number
  triage_level?: 'red' | 'yellow' | 'green'
  created_at: string
  source_references?: any[]
  status: string
}

export function ApprovalQueue() {
  const [drafts, setDrafts] = useState<DraftDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDrafts, setSelectedDrafts] = useState<string[]>([])
  const [editingDraft, setEditingDraft] = useState<DraftDocument | null>(null)
  const [editedContent, setEditedContent] = useState("")

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
    if (selectedDrafts.length === 0) return
    try {
      const response = await fetch('/api/drafts/batch-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: selectedDrafts })
      })
      if (response.ok) {
        await loadDrafts()
        setSelectedDrafts([])
      }
    } catch (error) {
      console.error('Failed to batch approve:', error)
    }
  }

  const handleApprove = async (documentId: string, content?: string) => {
    try {
      const response = await fetch(`/api/drafts/${documentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editedContent: content })
      })
      if (response.ok) {
        await loadDrafts()
        setEditingDraft(null)
      }
    } catch (error) {
      console.error('Failed to approve document:', error)
    }
  }

  const handleReject = async (documentId: string) => {
    try {
      const response = await fetch(`/api/drafts/${documentId}/reject`, { method: 'POST' })
      if (response.ok) await loadDrafts()
    } catch (error) {
      console.error('Failed to reject document:', error)
    }
  }

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.8) return <Badge className="bg-green-100 text-green-800">High ({Math.round(score * 100)}%)</Badge>
    if (score >= 0.6) return <Badge className="bg-yellow-100 text-yellow-800">Medium ({Math.round(score * 100)}%)</Badge>
    return <Badge className="bg-red-100 text-red-800">Low ({Math.round(score * 100)}%)</Badge>
  }

  const filterDraftsByTriage = (level: 'red' | 'yellow' | 'green') => {
    return drafts.filter(draft => {
      if (draft.triage_level) return draft.triage_level === level
      if (draft.confidence_score < 0.6) return level === 'red'
      if (draft.confidence_score < 0.8) return level === 'yellow'
      return level === 'green'
    })
  }

  const renderDraftCard = (draft: DraftDocument) => (
    <Card key={draft.id} className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <Checkbox
              checked={selectedDrafts.includes(draft.id)}
              onCheckedChange={(checked) => {
                if (checked) {
                  setSelectedDrafts([...selectedDrafts, draft.id])
                } else {
                  setSelectedDrafts(selectedDrafts.filter(id => id !== draft.id))
                }
              }}
            />
            <div className="flex-1">
              <CardTitle className="text-base">{draft.title}</CardTitle>
              <CardDescription className="mt-1">{draft.summary || 'No summary available'}</CardDescription>
            </div>
          </div>
          {getConfidenceBadge(draft.confidence_score)}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-4">
              <span>Source: {draft.source_references?.[0]?.source || 'Unknown'}</span>
              <span>{new Date(draft.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          
          {draft.topics && draft.topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {draft.topics.slice(0, 3).map((topic, index) => (
                <Badge key={index} variant="secondary" className="text-xs">{topic}</Badge>
              ))}
              {draft.topics.length > 3 && (
                <Badge variant="secondary" className="text-xs">+{draft.topics.length - 3} more</Badge>
              )}
            </div>
          )}
          
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => handleApprove(draft.id)} className="text-green-600">
              <CheckCircle className="w-3 h-3 mr-1" />Approve
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleReject(draft.id)} className="text-red-600">
              <XCircle className="w-3 h-3 mr-1" />Reject
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              setEditingDraft(draft)
              setEditedContent(draft.content)
            }}>
              <Edit className="w-3 h-3 mr-1" />Edit
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Clock className="w-6 h-6 animate-spin mr-2" />Loading approval queue...
        </CardContent>
      </Card>
    )
  }

  const redDrafts = filterDraftsByTriage('red')
  const yellowDrafts = filterDraftsByTriage('yellow')
  const greenDrafts = filterDraftsByTriage('green')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Approval Queue</h3>
          <p className="text-sm text-muted-foreground">
            Review and approve AI-generated documentation drafts ({drafts.length} pending)
          </p>
        </div>
        {selectedDrafts.length > 0 && (
          <Button onClick={handleBatchApprove}>
            <CheckCircle className="w-4 h-4 mr-2" />Approve Selected ({selectedDrafts.length})
          </Button>
        )}
      </div>

      {drafts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">All caught up!</h3>
            <p className="text-sm text-muted-foreground text-center">
              No pending documents to review. New drafts will appear here as content is processed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="red" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="red" className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span>Triage ({redDrafts.length})</span>
            </TabsTrigger>
            <TabsTrigger value="yellow" className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <span>Review ({yellowDrafts.length})</span>
            </TabsTrigger>
            <TabsTrigger value="green" className="flex items-center space-x-2">
              <ThumbsUp className="w-4 h-4 text-green-500" />
              <span>Approve ({greenDrafts.length})</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="red" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span>Low confidence documents requiring careful review</span>
              </div>
              {redDrafts.length === 0 ? (
                <Card><CardContent className="text-center py-8 text-muted-foreground">No documents requiring triage</CardContent></Card>
              ) : redDrafts.map(renderDraftCard)}
            </div>
          </TabsContent>
          
          <TabsContent value="yellow" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span>Medium confidence documents for review</span>
              </div>
              {yellowDrafts.length === 0 ? (
                <Card><CardContent className="text-center py-8 text-muted-foreground">No documents pending review</CardContent></Card>
              ) : yellowDrafts.map(renderDraftCard)}
            </div>
          </TabsContent>
          
          <TabsContent value="green" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <ThumbsUp className="w-4 h-4 text-green-500" />
                <span>High confidence documents ready for approval</span>
              </div>
              {greenDrafts.length === 0 ? (
                <Card><CardContent className="text-center py-8 text-muted-foreground">No documents ready for approval</CardContent></Card>
              ) : greenDrafts.map(renderDraftCard)}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {editingDraft && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Edit Document: {editingDraft.title}</CardTitle>
            <CardDescription>Make changes to the content before approving</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="edit" className="w-full">
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit" className="space-y-4">
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[300px]"
                  placeholder="Edit the document content..."
                />
                <div className="flex space-x-2">
                  <Button onClick={() => handleApprove(editingDraft.id, editedContent)}>
                    <CheckCircle className="w-4 h-4 mr-2" />Approve with Changes
                  </Button>
                  <Button variant="outline" onClick={() => setEditingDraft(null)}>Cancel</Button>
                </div>
              </TabsContent>
              <TabsContent value="preview">
                <div className="prose max-w-none p-4 border rounded-md bg-muted/50">
                  <pre className="whitespace-pre-wrap">{editedContent}</pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
