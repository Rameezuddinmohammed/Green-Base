"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function AuthDebugPage() {
  const [authStatus, setAuthStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const checkAuthStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/debug/auth-debug')
      const data = await response.json()
      setAuthStatus(data)
    } catch (error) {
      console.error('Failed to check auth status:', error)
      setAuthStatus({ error: 'Failed to fetch auth status' })
    } finally {
      setLoading(false)
    }
  }

  const checkKnowledgeBase = async () => {
    try {
      const response = await fetch('/api/knowledge-base')
      const data = await response.json()
      console.log('Knowledge Base API Response:', data)
      alert(`Knowledge Base: ${data.documents?.length || 0} documents found`)
    } catch (error) {
      console.error('KB API Error:', error)
      alert('Knowledge Base API Error - check console')
    }
  }

  const testDbAccess = async () => {
    try {
      const response = await fetch('/api/debug/test-kb')
      const data = await response.json()
      console.log('Test DB Response:', data)
      alert(`DB Test: ${data.data?.approved_documents?.count || 0} approved docs, ${data.data?.users?.count || 0} users`)
    } catch (error) {
      console.error('DB Test Error:', error)
      alert('DB Test Error - check console')
    }
  }

  useEffect(() => {
    checkAuthStatus()
  }, [])

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Authentication Debug</h1>
          <p className="text-muted-foreground">Debug authentication and database access</p>
        </div>

        <div className="flex gap-4">
          <Button onClick={checkAuthStatus} disabled={loading}>
            {loading ? 'Checking...' : 'Refresh Auth Status'}
          </Button>
          <Button onClick={checkKnowledgeBase} variant="outline">
            Test Knowledge Base API
          </Button>
          <Button onClick={testDbAccess} variant="outline">
            Test DB Access
          </Button>
          <Button 
            onClick={() => window.open('/debug/upload', '_blank')} 
            variant="outline"
          >
            Test Upload
          </Button>
          <Button 
            onClick={async () => {
              try {
                const response = await fetch('/api/debug/recalculate-confidence', { method: 'POST' })
                const data = await response.json()
                console.log('Confidence recalculation:', data)
                alert(`Recalculated ${data.updatedDocuments}/${data.totalDocuments} documents`)
              } catch (error) {
                console.error('Recalculation error:', error)
                alert('Recalculation failed - check console')
              }
            }}
            variant="outline"
          >
            Recalculate Confidence
          </Button>
        </div>

        {authStatus && (
          <Card>
            <CardHeader>
              <CardTitle>Authentication Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Session</h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={authStatus.session?.exists ? "default" : "destructive"}>
                      {authStatus.session?.exists ? "Active" : "None"}
                    </Badge>
                    {authStatus.session?.email && <span>{authStatus.session.email}</span>}
                  </div>
                  {authStatus.session?.error && (
                    <p className="text-sm text-red-600">{authStatus.session.error}</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">User</h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={authStatus.user?.exists ? "default" : "destructive"}>
                      {authStatus.user?.exists ? "Found" : "None"}
                    </Badge>
                    {authStatus.user?.email && <span>{authStatus.user.email}</span>}
                  </div>
                  {authStatus.user?.error && (
                    <p className="text-sm text-red-600">{authStatus.user.error}</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Profile</h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={authStatus.profile?.exists ? "default" : "destructive"}>
                      {authStatus.profile?.exists ? "Found" : "None"}
                    </Badge>
                    {authStatus.profile?.data && (
                      <span>
                        {authStatus.profile.data.role} in org {authStatus.profile.data.organization_id}
                      </span>
                    )}
                  </div>
                  {authStatus.profile?.error && (
                    <p className="text-sm text-red-600">{authStatus.profile.error}</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Cookies</h3>
                <div className="space-y-1">
                  <p>Total: {authStatus.cookies?.total || 0}</p>
                  <p>Supabase: {authStatus.cookies?.supabase || 0}</p>
                  {authStatus.cookies?.supabaseCookieNames?.length > 0 && (
                    <div className="text-sm">
                      <p>Supabase cookies:</p>
                      <ul className="list-disc list-inside ml-4">
                        {authStatus.cookies.supabaseCookieNames.map((name: string) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Environment</h3>
                <div className="space-y-1">
                  <p>Supabase URL: {authStatus.environment?.supabaseUrl}</p>
                  <p>Anon Key: {authStatus.environment?.supabaseAnonKey}</p>
                  <p>Service Key: {authStatus.environment?.supabaseServiceKey}</p>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="font-semibold mb-2">Raw Data</h3>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-64">
                  {JSON.stringify(authStatus, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}