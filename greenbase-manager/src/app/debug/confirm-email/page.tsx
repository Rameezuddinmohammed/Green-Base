"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

export default function ConfirmEmailPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")

  const handleConfirmEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setResult(null)
    
    if (!email) {
      setError("Email is required")
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch('/api/debug/confirm-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })
      
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        setError(data.error || 'Confirmation failed')
        return
      }
      
      setResult(data)
      
    } catch (error: any) {
      console.error('Confirmation error:', error)
      setError(error.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Email Confirmation Tool</CardTitle>
            <CardDescription>
              Development tool to manually confirm user emails. Only works in development mode.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleConfirmEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Confirming...' : 'Confirm Email'}
              </Button>
              
              {error && (
                <div className="text-sm text-red-600 p-3 bg-red-50 rounded-md">
                  {error}
                </div>
              )}
              
              {result && (
                <div className="text-sm text-green-600 p-3 bg-green-50 rounded-md">
                  <div className="font-medium">✅ Email confirmed successfully!</div>
                  <div className="mt-2 space-y-1">
                    <div>User ID: {result.userId}</div>
                    <div>Email: {result.email}</div>
                    <div>Confirmed At: {result.confirmedAt}</div>
                  </div>
                </div>
              )}
            </form>
            
            <div className="mt-6 pt-6 border-t">
              <div className="text-center space-y-2">
                <Link href="/auth/signin">
                  <Button variant="outline">Go to Sign In</Button>
                </Link>
                <Link href="/auth/signup">
                  <Button variant="outline">Go to Sign Up</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>If you just signed up and got a "email not confirmed" error</li>
              <li>Enter the email address you used to sign up</li>
              <li>Click "Confirm Email" to manually confirm it</li>
              <li>Go to the sign in page and try logging in again</li>
              <li>This tool only works in development mode</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}