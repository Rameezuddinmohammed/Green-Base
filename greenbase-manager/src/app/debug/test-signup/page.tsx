"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

export default function TestSignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [organizationName, setOrganizationName] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")

  const handleTestSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setResult(null)
    
    if (!email || !password || !organizationName) {
      setError("All fields are required")
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, organizationName }),
      })
      
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        setError(data.error || 'Signup failed')
        return
      }
      
      setResult(data)
      
    } catch (error: any) {
      console.error('Signup test error:', error)
      setError(error.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const generateRandomEmail = () => {
    const timestamp = Date.now()
    setEmail(`test${timestamp}@example.com`)
    setPassword("test123")
    setOrganizationName(`Test Company ${timestamp}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Test Signup Flow</CardTitle>
            <CardDescription>
              Test the streamlined signup process without email confirmation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTestSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="organizationName">Organization Name</Label>
                <Input
                  id="organizationName"
                  type="text"
                  placeholder="Your Company Name"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              
              <div className="flex gap-2">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Testing Signup...' : 'Test Signup'}
                </Button>
                <Button type="button" onClick={generateRandomEmail} variant="outline">
                  Generate Random
                </Button>
              </div>
              
              {error && (
                <div className="text-sm text-red-600 p-3 bg-red-50 rounded-md">
                  <div className="font-medium">❌ Signup Failed</div>
                  <div className="mt-1">{error}</div>
                </div>
              )}
              
              {result && (
                <div className="text-sm text-green-600 p-3 bg-green-50 rounded-md">
                  <div className="font-medium">✅ Signup Successful!</div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div><strong>User ID:</strong> {result.userId}</div>
                    <div><strong>Email:</strong> {result.email}</div>
                    <div><strong>Organization:</strong> {result.organization}</div>
                    <div><strong>Auto Signed In:</strong> {result.autoSignedIn ? 'Yes' : 'No'}</div>
                    <div><strong>Message:</strong> {result.message}</div>
                  </div>
                  
                  {result.autoSignedIn && (
                    <div className="mt-3">
                      <Link href="/dashboard">
                        <Button size="sm" className="w-full">
                          Go to Dashboard
                        </Button>
                      </Link>
                    </div>
                  )}
                  
                  {!result.autoSignedIn && (
                    <div className="mt-3">
                      <Link href="/auth/signin">
                        <Button size="sm" className="w-full">
                          Go to Sign In
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </form>
            
            <div className="mt-6 pt-6 border-t">
              <div className="text-center space-y-2">
                <Link href="/auth/signup">
                  <Button variant="outline">Go to Real Signup Page</Button>
                </Link>
                <Link href="/auth/signin">
                  <Button variant="outline">Go to Sign In</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How It Should Work</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>User fills out signup form (organization, email, password)</li>
              <li>System creates user account and automatically confirms email</li>
              <li>System attempts to sign user in immediately</li>
              <li>If successful: User goes directly to dashboard</li>
              <li>If auto-signin fails: User goes to signin page (but account is ready)</li>
              <li>No email confirmation step required!</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}