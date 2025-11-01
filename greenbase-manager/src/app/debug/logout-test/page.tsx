"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/components/auth/auth-provider"

export default function LogoutTestPage() {
  const { user, session, signOut } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
    console.log(message)
  }

  const handleLogout = async () => {
    if (isLoggingOut) return
    
    setIsLoggingOut(true)
    addLog('🔄 Starting logout process...')
    
    try {
      addLog('📞 Calling signOut function...')
      await signOut()
      addLog('✅ signOut function completed')
    } catch (error: any) {
      addLog(`❌ Logout error: ${error.message}`)
    } finally {
      setIsLoggingOut(false)
      addLog('🏁 Logout process finished')
    }
  }

  const handleManualRedirect = () => {
    addLog('🔄 Manual redirect to signin...')
    window.location.href = '/auth/signin'
  }

  const handleClearLogs = () => {
    setLogs([])
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Logout Test Page</CardTitle>
            <CardDescription>
              Test the logout functionality and debug any issues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-2">Current Auth State:</h3>
                <div className="text-sm space-y-1">
                  <div>User: {user ? `${user.email} (${user.id})` : 'None'}</div>
                  <div>Session: {session ? 'Active' : 'None'}</div>
                  <div>Loading: {isLoggingOut ? 'Yes' : 'No'}</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Button 
                  onClick={handleLogout} 
                  disabled={isLoggingOut || !user}
                  className="w-full"
                >
                  {isLoggingOut ? 'Logging Out...' : 'Test Logout'}
                </Button>
                
                <Button 
                  onClick={handleManualRedirect} 
                  variant="outline"
                  className="w-full"
                >
                  Manual Redirect to Signin
                </Button>
                
                <Button 
                  onClick={handleClearLogs} 
                  variant="secondary"
                  className="w-full"
                >
                  Clear Logs
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debug Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 p-4 rounded-md font-mono text-sm max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-gray-500">No logs yet. Click "Test Logout" to start.</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index}>{log}</div>
                ))
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
              <li>Make sure you're signed in (you should see user info above)</li>
              <li>Click "Test Logout" to test the logout functionality</li>
              <li>Watch the debug logs to see what happens</li>
              <li>If logout doesn't work, try "Manual Redirect to Signin"</li>
              <li>Check the browser console for additional error messages</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}