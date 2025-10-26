"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { DashboardWidgets } from "@/components/dashboard/dashboard-widgets"
import { SourceManagement } from "@/components/source-management"
import { ApprovalQueueEnhanced } from "@/components/approval-queue-enhanced"
import { KnowledgeBaseBrowser } from "@/components/knowledge-base-browser"
import { AIAssistantPanel } from "@/components/ai-assistant-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles } from "lucide-react"

interface DashboardStats {
  totalDocuments: number
  pendingApprovals: number
  activeSources: number
  avgConfidenceScore: number
  recentActivity: Array<{
    id: string
    type: 'approval' | 'sync' | 'creation'
    title: string
    timestamp: Date
    confidence?: number
  }>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalDocuments: 0,
    pendingApprovals: 0,
    activeSources: 0,
    avgConfidenceScore: 0,
    recentActivity: []
  })
  const [loading, setLoading] = useState(true)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all data in parallel
        const [draftsRes, sourcesRes, knowledgeRes] = await Promise.all([
          fetch('/api/drafts'),
          fetch('/api/sources'),
          fetch('/api/knowledge-base')
        ])

        const [drafts, sources, knowledge] = await Promise.all([
          draftsRes.ok ? draftsRes.json() : { drafts: [] },
          sourcesRes.ok ? sourcesRes.json() : { sources: [] },
          knowledgeRes.ok ? knowledgeRes.json() : { documents: [] }
        ])

        const pendingDrafts = drafts.drafts?.filter((d: any) => d.status === 'pending') || []
        const activeSources = sources.sources?.filter((s: any) => s.isActive) || []
        const allDocuments = knowledge.documents || []

        // Calculate average confidence score
        const avgConfidence = pendingDrafts.length > 0 
          ? pendingDrafts.reduce((sum: number, d: any) => sum + (d.confidence_score || 0), 0) / pendingDrafts.length
          : 0

        // Create recent activity feed
        const recentActivity = [
          ...pendingDrafts.slice(0, 3).map((d: any) => ({
            id: d.id,
            type: 'creation' as const,
            title: d.title,
            timestamp: new Date(d.created_at),
            confidence: d.confidence_score
          })),
          ...activeSources.slice(0, 2).map((s: any) => ({
            id: s.id,
            type: 'sync' as const,
            title: `${s.name} synced`,
            timestamp: s.lastSyncAt ? new Date(s.lastSyncAt) : new Date()
          }))
        ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5)

        setStats({
          totalDocuments: allDocuments.length + pendingDrafts.length,
          pendingApprovals: pendingDrafts.length,
          activeSources: activeSources.length,
          avgConfidenceScore: avgConfidence,
          recentActivity
        })
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  // Auto-open AI panel when there are actionable insights
  useEffect(() => {
    if (!loading && (stats.pendingApprovals > 5 || stats.avgConfidenceScore < 0.7)) {
      const timer = setTimeout(() => setAiPanelOpen(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [loading, stats])

  return (
    <div className="min-h-screen bg-background">
      <DashboardLayout>
        <div className="container py-8 px-4">
          <div className="space-y-8">
            {/* Header with AI Assistant Trigger */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">
                  AI-powered knowledge management at a glance
                </p>
              </div>
              <Button 
                onClick={() => setAiPanelOpen(true)}
                className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                AI Assistant
                {(stats.pendingApprovals > 5 || stats.avgConfidenceScore < 0.7) && (
                  <Badge className="ml-2 bg-orange-500 hover:bg-orange-500 animate-pulse">
                    !
                  </Badge>
                )}
              </Button>
            </div>

            {/* Enhanced Dashboard Overview with Widgets */}
            <DashboardWidgets stats={stats} loading={loading} />
            
            {/* Tabbed Content Sections */}
            <Tabs defaultValue="sources" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="sources">Sources</TabsTrigger>
                <TabsTrigger value="approvals">
                  Approval Queue
                  {stats.pendingApprovals > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-800">
                      {stats.pendingApprovals}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
              </TabsList>
              
              <TabsContent value="sources" className="mt-6">
                <SourceManagement />
              </TabsContent>
              
              <TabsContent value="approvals" className="mt-6">
                <ApprovalQueueEnhanced />
              </TabsContent>
              
              <TabsContent value="knowledge" className="mt-6">
                <KnowledgeBaseBrowser />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DashboardLayout>

      {/* AI Assistant Panel */}
      <AIAssistantPanel 
        isOpen={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        stats={stats}
      />
    </div>
  )
}
