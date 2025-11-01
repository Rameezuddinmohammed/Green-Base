"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

function SignUpForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [organizationName, setOrganizationName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [signupResult, setSignupResult] = useState<any>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  const validateForm = () => {
    if (!email || !password || !confirmPassword || !organizationName) {
      setError("All fields are required")
      return false
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return false
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long")
      return false
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address")
      return false
    }

    return true
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          password, 
          organizationName 
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        setError(result.error || 'Sign-up failed')
        return
      }
      
      console.log('Sign-up successful:', result)
      setSignupResult(result)
      setSuccess(true)
      
      if (result.autoSignedIn) {
        // User was automatically signed in - go to dashboard
        console.log('User auto-signed in, redirecting to dashboard...')
        setTimeout(() => {
          window.location.href = redirectTo
        }, 1500)
      } else {
        // User needs to sign in manually - go to signin page
        console.log('Account created, redirecting to signin...')
        setTimeout(() => {
          window.location.href = '/auth/signin'
        }, 2000)
      }
      
    } catch (error: any) {
      console.error('Sign up error:', error)
      setError(error.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  if (success && signupResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-green-600">Welcome to GreenBase!</CardTitle>
            <CardDescription>
              {signupResult.autoSignedIn 
                ? "Your account has been created and you're signed in. Redirecting to dashboard..."
                : "Your account has been created successfully. Redirecting to sign in..."
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-green-50 text-green-800 rounded-md text-sm">
                <div className="font-medium">✅ {signupResult.message}</div>
              </div>
              
              <div className="text-sm text-gray-600 space-y-1">
                <div><strong>Organization:</strong> {signupResult.organization}</div>
                <div><strong>Email:</strong> {signupResult.email}</div>
                <div><strong>Role:</strong> Manager</div>
              </div>
              
              {!signupResult.autoSignedIn && (
                <div className="pt-2">
                  <Link href="/auth/signin">
                    <Button className="w-full">
                      Continue to Sign In
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Your GreenBase Account</CardTitle>
          <CardDescription>
            Set up your organization and start managing your knowledge base
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
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
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
            
            {error && (
              <div className="text-sm text-red-600 mt-2 p-3 bg-red-50 rounded-md">
                {error}
              </div>
            )}
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/auth/signin" className="text-blue-600 hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignUpForm />
    </Suspense>
  )
}