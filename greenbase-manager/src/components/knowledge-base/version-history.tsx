"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  History, 
  Calendar, 
  User, 
  Eye, 
  RotateCcw,
  Clock
} from "lucide-react"
import { MarkdownRenderer } from './markdown-renderer'

interface DocumentVersion {
  id: string
  version: number
  content: string
  changes: string
  approved_by: string
  approved_at: string
  created_at: string
  approver?: {
    email: string
  }
}

interface VersionHistoryProps {
  versions: DocumentVersion[]
  currentVersion: number
  onViewVersion: (version: DocumentVersion) => void
}

export function VersionHistory({ versions, currentVersion, onViewVersion }: VersionHistoryProps) {
  const [viewingVersion, setViewingVersion] = useState<DocumentVersion | null>(null)

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

  if (versions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="h-12 w-12 mx-auto mb-4" />
        <p>No version history available</p>
      </div>
    )
  }

  return (
    <>
      <ScrollArea className="h-96">
        <div className="space-y-4">
          {versions.map((version, index) => (
            <Card key={version.id} className={version.version === currentVersion ? 'border-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-base">Version {version.version}</CardTitle>
                    {version.version === currentVersion && (
                      <Badge variant="default" className="text-xs">Current</Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewingVersion(version)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
                <CardDescription className="flex items-center space-x-4 text-sm">
                  <span className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {formatDate(version.approved_at)}
                  </span>
                  <span className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {formatRelativeTime(version.approved_at)}
                  </span>
                  <span className="flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    {version.approver?.email || version.approved_by}
                  </span>
                </CardDescription>
              </CardHeader>
              {version.changes && (
                <CardContent className="pt-0">
                  <div className="text-sm">
                    <strong>Changes:</strong>
                    <p className="mt-1 text-muted-foreground">{version.changes}</p>
                  </div>
                </CardContent>
              )}
              {index < versions.length - 1 && <Separator className="mt-4" />}
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Version Viewer Dialog */}
      <Dialog open={!!viewingVersion} onOpenChange={() => setViewingVersion(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Version {viewingVersion?.version} - {formatDate(viewingVersion?.approved_at || '')}
            </DialogTitle>
            <DialogDescription>
              Approved by {viewingVersion?.approver?.email || viewingVersion?.approved_by} • {formatRelativeTime(viewingVersion?.approved_at || '')}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-96">
            {viewingVersion?.changes && (
              <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Changes Made
                </h4>
                <p className="text-sm text-muted-foreground">{viewingVersion.changes}</p>
              </div>
            )}
            
            <div className="prose prose-sm max-w-none">
              <MarkdownRenderer content={viewingVersion?.content || ''} />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}