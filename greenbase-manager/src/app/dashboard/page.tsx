"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Sparkles, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Zap,
  TrendingUp,
  Settings
} from "lucide-react"
// import { AIAssistantPanel } from "@/components/ai-assistant-panel"

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
  // const [aiPanelOpen, setAiPanelOpen] = useState(false)

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

  // Auto-open AI panel when there are actionable insights - Commented out
  // useEffect(() => {
  //   if (!loading && (stats.pendingApprovals > 5 || stats.avgConfidenceScore < 0.7)) {
  //     const timer = setTimeout(() => setAiPanelOpen(true), 2000)
  //     return () => clearTimeout(timer)
  //   }
  // }, [loading, stats])

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'approval': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'sync': return <Zap className="h-4 w-4 text-blue-500" />
      case 'creation': return <FileText className="h-4 w-4 text-purple-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.8) return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">🟢 {Math.round(score * 100)}%</Badge>
    if (score >= 0.5) return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">🟡 {Math.round(score * 100)}%</Badge>
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">🔴 {Math.round(score * 100)}%</Badge>
  }

  const formatTimestamp = (timestamp: Date) => {
    // Use a consistent format that won't cause hydration issues
    if (typeof window === 'undefined') {
      // Server-side: return a placeholder
      return 'Loading...'
    }
    // Client-side: return formatted date
    return timestamp.toLocaleString()
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <DashboardLayout>
        <div className="container py-8 px-4" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
          <div className="space-y-8">
            {/* Header with AI Assistant Trigger */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">
                  AI-powered knowledge management at a glance
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* AI Assistant Button - Commented out for now */}
                {/* <Button 
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
                </Button> */}
              </div>
            </div>

            {/* 2-Column Grid Layout as per Plan */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Quick Stats & Source Status */}
              <div className="lg:col-span-1 space-y-6">
                {/* Quick Stats */}
                <Card className="hover:shadow-md transition-shadow" style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart3 className="h-5 w-5 mr-2" />
                      Quick Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-4">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Total Documents</span>
                          <span className="text-2xl font-bold">{stats.totalDocuments}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Pending Approvals</span>
                          <span className="text-2xl font-bold text-orange-600">{stats.pendingApprovals}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Active Sources</span>
                          <span className="text-2xl font-bold text-green-600">{stats.activeSources}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Avg Confidence</span>
                          <span className="text-2xl font-bold text-blue-600">{Math.round(stats.avgConfidenceScore * 100)}%</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Source Status */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Zap className="h-5 w-5 mr-2" />
                      Source Status
                    </CardTitle>
                    <CardDescription>Connected data sources overview</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="animate-pulse flex items-center space-x-3">
                            <div className="h-8 w-8 bg-gray-200 rounded"></div>
                            <div className="flex-1">
                              <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : stats.activeSources > 0 ? (
                      <div className="text-center py-4">
                        <div className="text-2xl font-bold text-green-600 mb-2">{stats.activeSources}</div>
                        <p className="text-sm text-muted-foreground">Active Sources Connected</p>
                        <Button variant="outline" size="sm" className="mt-3" asChild>
                          <a href="/dashboard/sources">Manage Sources</a>
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="font-medium mb-2">No sources connected</p>
                        <p className="text-xs mb-4">Connect your first data source to get started</p>
                        <Button size="sm" asChild>
                          <a href="/dashboard/sources">Connect Source</a>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Recent Activity & Pending Approvals */}
              <div className="lg:col-span-2 space-y-6">
                {/* Recent Activity Feed */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Clock className="h-5 w-5 mr-2" />
                      Recent Activity Feed
                    </CardTitle>
                    <CardDescription>Latest updates across your knowledge base</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="animate-pulse flex items-center space-x-3">
                            <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                            <div className="flex-1">
                              <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {stats.recentActivity.length > 0 ? (
                          stats.recentActivity.slice(0, 8).map((activity) => (
                            <div key={activity.id} className="flex items-center space-x-3 p-3 hover:bg-muted/50 rounded-lg transition-colors">
                              {getActivityIcon(activity.type)}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {activity.title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatTimestamp(activity.timestamp)}
                                </p>
                              </div>
                              {activity.confidence && (
                                <div className="flex-shrink-0">
                                  {getConfidenceBadge(activity.confidence)}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No recent activity</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Pending Approvals Preview */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 mr-2" />
                        Pending Approvals Preview
                        {stats.pendingApprovals > 0 && (
                          <Badge className="ml-2 bg-orange-100 text-orange-800">
                            {stats.pendingApprovals}
                          </Badge>
                        )}
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href="/dashboard/approvals">View All</a>
                      </Button>
                    </CardTitle>
                    <CardDescription>Documents awaiting your review</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="animate-pulse p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                              </div>
                              <div className="h-8 w-16 bg-gray-200 rounded"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : stats.pendingApprovals > 0 ? (
                      <div className="space-y-3">
                        {stats.recentActivity
                          .filter(a => a.type === 'creation')
                          .slice(0, 4)
                          .map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                              <div className="flex-1">
                                <p className="text-sm font-medium truncate">{item.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatTimestamp(item.timestamp)}
                                </p>
                              </div>
                              {item.confidence && (
                                <div className="flex items-center space-x-2">
                                  {getConfidenceBadge(item.confidence)}
                                  <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                    Approve
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No pending approvals</p>
                        <p className="text-xs mt-1">All documents are up to date</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>

      {/* AI Assistant Panel - Commented out for now */}
      {/* <AIAssistantPanel 
        isOpen={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        stats={stats}
      /> */}
    </div>
  )
}
