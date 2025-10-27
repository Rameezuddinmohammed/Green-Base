"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestOAuthPage() {
  const [testResults, setTestResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testOAuth = async (provider: 'microsoft' | 'google') => {
    setLoading(true)
    try {
      const response = await fetch(`/api/test-oauth?provider=${provider}`)
      const result = await response.json()
      setTestResults({ provider, ...result })
    } catch (error) {
      setTestResults({ 
        provider, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    } finally {
      setLoading(false)
    }
  }

  const connectSource = (provider: 'microsoft' | 'google') => {
    window.location.href = `/api/oauth/${provider}/auth`
  }

  return (
    <div className="container py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">OAuth Testing</h1>
          <p className="text-muted-foreground">
            Test OAuth configuration and connection flow
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Microsoft Teams</CardTitle>
              <CardDescription>Test Microsoft Graph OAuth integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => testOAuth('microsoft')} 
                disabled={loading}
                className="w-full"
              >
                Test Configuration
              </Button>
              <Button 
                onClick={() => connectSource('microsoft')} 
                variant="outline"
                className="w-full"
              >
                Connect Microsoft Teams
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Google Drive</CardTitle>
              <CardDescription>Test Google Drive OAuth integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => testOAuth('google')} 
                disabled={loading}
                className="w-full"
              >
                Test Configuration
              </Button>
              <Button 
                onClick={() => connectSource('google')} 
                variant="outline"
                className="w-full"
              >
                Connect Google Drive
              </Button>
            </CardContent>
          </Card>
        </div>

        {testResults && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results - {testResults.provider}</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                {JSON.stringify(testResults, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>How to Test the Full Flow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">1. Test Configuration</h4>
              <p className="text-sm text-muted-foreground">
                Click "Test Configuration" to verify OAuth credentials are properly loaded
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">2. Connect Source</h4>
              <p className="text-sm text-muted-foreground">
                Click "Connect" to go through the OAuth flow and authorize access
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">3. Configure & Sync</h4>
              <p className="text-sm text-muted-foreground">
                Go to Sources page, configure channels/folders, then sync to import data
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">4. Review AI Results</h4>
              <p className="text-sm text-muted-foreground">
                Check the Approval Queue to see AI-processed documents with confidence scores
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}