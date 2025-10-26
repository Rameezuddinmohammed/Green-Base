"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Users,
  Zap,
  BarChart3,
  Settings
} from "lucide-react"

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

export function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    totalDocuments: 0,
    pendingApprovals: 0,
    activeSources: 0,
    avgConfidenceScore: 0,
    recentActivity: []
  })
  const [loading, setLoading] = useState(true)

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

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'approval': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'sync': return <Zap className="h-4 w-4 text-blue-500" />
      case 'creation': return <FileText className="h-4 w-4 text-purple-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.8) return <span className="badge badge-green">High</span>
    if (score >= 0.5) return <span className="badge badge-yellow">Medium</span>
    return <span className="badge badge-red">Low</span>
  }

  if (loading) {
    return (
      <div className="grid gap-6 lg-grid-cols-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card skeleton" style={{ height: '120px' }}>
            <div style={{ height: '1rem', width: '75%', marginBottom: '0.5rem' }} className="skeleton"></div>
            <div style={{ height: '2rem', width: '50%', marginBottom: '0.5rem' }} className="skeleton"></div>
            <div style={{ height: '0.75rem', width: '100%' }} className="skeleton"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
        <div className="card hover-lift">
          <div className="flex items-center justify-between mb-2">
            <h3 style={{ fontSize: '0.875rem', fontWeight: '500' }}>Total Documents</h3>
            <FileText style={{ width: '1rem', height: '1rem', color: '#6b7280' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{stats.totalDocuments}</div>
          <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            Across all sources
          </p>
        </div>

        <div className="card hover-lift">
          <div className="flex items-center justify-between mb-2">
            <h3 style={{ fontSize: '0.875rem', fontWeight: '500' }}>Pending Approvals</h3>
            <Clock style={{ width: '1rem', height: '1rem', color: '#6b7280' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ea580c', marginBottom: '0.25rem' }}>{stats.pendingApprovals}</div>
          <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            Awaiting review
          </p>
        </div>

        <div className="card hover-lift">
          <div className="flex items-center justify-between mb-2">
            <h3 style={{ fontSize: '0.875rem', fontWeight: '500' }}>Active Sources</h3>
            <Settings style={{ width: '1rem', height: '1rem', color: '#6b7280' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#16a34a', marginBottom: '0.25rem' }}>{stats.activeSources}</div>
          <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            Connected & syncing
          </p>
        </div>

        <div className="card hover-lift">
          <div className="flex items-center justify-between mb-2">
            <h3 style={{ fontSize: '0.875rem', fontWeight: '500' }}>Avg Confidence</h3>
            <TrendingUp style={{ width: '1rem', height: '1rem', color: '#6b7280' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{Math.round(stats.avgConfidenceScore * 100)}%</div>
          <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            AI confidence score
          </p>
        </div>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {/* Recent Activity */}
        <div className="card">
          <div style={{ marginBottom: '1rem' }}>
            <h3 className="flex items-center" style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              <BarChart3 style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.5rem' }} />
              Recent Activity
            </h3>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Latest updates across your knowledge base
            </p>
          </div>
          <div>
            <div className="space-y-4">
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3">
                    {getActivityIcon(activity.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {activity.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.timestamp.toLocaleString()}
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
                <div className="text-center py-6 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Insights Panel */}
        <div className="card">
          <div style={{ marginBottom: '1rem' }}>
            <h3 className="flex items-center" style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              <Zap style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.5rem', color: '#22c55e' }} />
              AI Insights
            </h3>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
              Smart recommendations for your knowledge base
            </p>
          </div>
          <div>
            <div className="space-y-4">
              {stats.pendingApprovals > 0 && (
                <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-900">
                      {stats.pendingApprovals} documents need review
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      High confidence items can be batch approved
                    </p>
                  </div>
                </div>
              )}
              
              {stats.avgConfidenceScore < 0.7 && (
                <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">
                      Consider source quality review
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Average confidence is below optimal threshold
                    </p>
                  </div>
                </div>
              )}

              {stats.activeSources === 0 && (
                <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <Settings className="h-5 w-5 text-purple-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-900">
                      Connect your first source
                    </p>
                    <p className="text-xs text-purple-700 mt-1">
                      Start by connecting Teams or Google Drive
                    </p>
                  </div>
                </div>
              )}

              {stats.pendingApprovals === 0 && stats.activeSources > 0 && (
                <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900">
                      All caught up!
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      No pending approvals. Your knowledge base is up to date.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}