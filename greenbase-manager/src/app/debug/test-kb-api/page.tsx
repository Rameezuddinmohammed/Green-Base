"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestKBAPIPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")

  const testKBAPI = async () => {
    setLoading(true)
    setError("")
    setResult(null)
    
    try {
      console.log('🧪 Testing Knowledge Base API...')
      
      const response = await fetch('/api/knowledge-base')
      const data = await response.json()
      
      console.log('📡 KB API Response:', { status: response.status, data })
      
      if (!response.ok) {
        setError(`API Error (${response.status}): ${data.error || 'Unknown error'}`)
        setResult(data)
        return
      }
      
      setResult(data)
      
    } catch (error: any) {
      console.error('❌ KB API Test Error:', error)
      setError(error.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const testAuthAPI = async () => {
    setLoading(true)
    setError("")
    setResult(null)
    
    try {
      console.log('🧪 Testing KB Auth API...')
      
      const response = await fetch('/api/debug/test-kb-auth')
      const data = await response.json()
      
      console.log('📡 KB Auth API Response:', { status: response.status, data })
      
      if (!response.ok) {
        setError(`Auth Test Error (${response.status}): ${data.error || 'Unknown error'}`)
        setResult(data)
        return
      }
      
      setResult(data)
      
    } catch (error: any) {
      console.error('❌ KB Auth Test Error:', error)
      setError(error.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Knowledge Base API Test</CardTitle>
            <CardDescription>
              Test the Knowledge Base API with proper browser authentication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={testKBAPI} disabled={loading} className="flex-1">
                  {loading ? 'Testing KB API...' : 'Test Knowledge Base API'}
                </Button>
                <Button onClick={testAuthAPI} disabled={loading} variant="outline" className="flex-1">
                  {loading ? 'Testing Auth...' : 'Test KB Authentication'}
                </Button>
              </div>
              
              {error && (
                <div className="text-sm text-red-600 p-3 bg-red-50 rounded-md">
                  <div className="font-medium">❌ Test Failed</div>
                  <div className="mt-1">{error}</div>
                </div>
              )}
              
              {result && (
                <div className="space-y-4">
                  <div className="text-sm text-green-600 p-3 bg-green-50 rounded-md">
                    <div className="font-medium">✅ Test Completed</div>
                  </div>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">API Response</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded font-mono overflow-auto max-h-96">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Make sure you're signed in to the application</li>
              <li>Click "Test Knowledge Base API" to test the main API endpoint</li>
              <li>Click "Test KB Authentication" to test the auth flow specifically</li>
              <li>Check the browser console for detailed logs</li>
              <li>Review the API response for error details</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}