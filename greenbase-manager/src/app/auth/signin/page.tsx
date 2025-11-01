"use client"

import { supabase } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"

function SignInForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const searchParams = useSearchParams()
  const router = useRouter()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
  const authError = searchParams.get('error')
  // Using the shared client from lib/supabase.ts

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    
    try {
      // Use server-side sign-in API
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        setError(result.error || 'Sign-in failed')
        return
      }
      
      console.log('Server sign-in successful:', result.email)
      
      // Wait a moment for cookies to be set
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Redirect to destination
      window.location.href = redirectTo
      
    } catch (error: any) {
      console.error('Sign in error:', error)
      setError(error.message || 'Network error')
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
            
            <div className="text-center">
              <Link href="/auth/reset-password" className="text-sm text-blue-600 hover:underline">
                Forgot your password?
              </Link>
            </div>
            
            {(error || authError) && (
              <div className="text-sm text-red-600 mt-2 p-3 bg-red-50 rounded-md">
                <div className="font-medium">Sign In Failed</div>
                <div className="mt-1">{error || authError}</div>
              </div>
            )}
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link href="/auth/signup" className="text-blue-600 hover:underline">
                Sign up here
              </Link>
            </p>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-md">
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
