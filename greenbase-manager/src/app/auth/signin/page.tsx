"use client"

import { supabase } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"

function SignInForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const searchParams = useSearchParams()
  const router = useRouter()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
  // Using the shared client from lib/supabase.ts

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        return
      }

      if (data.session) {
        // Wait a moment for the session to be established
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Refresh the page to update server-side session
        router.refresh()
        
        // Force a hard redirect to ensure session is picked up
        window.location.href = redirectTo
      } else {
        setError('Authentication failed - no session created')
      }
    } catch (error: any) {
      console.error('Sign in error:', error)
      setError(error.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In to GreenBase</CardTitle>
          <CardDescription>
            Enter your credentials to access the manager dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
            
            {error && (
              <div className="text-sm text-red-600 mt-2">
                {error}
              </div>
            )}
          </form>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-800 font-medium">Demo Credentials:</p>
            <p className="text-sm text-blue-600">Email: manager@demo.com</p>
            <p className="text-sm text-blue-600">Password: demo123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInForm />
    </Suspense>
  )
}
