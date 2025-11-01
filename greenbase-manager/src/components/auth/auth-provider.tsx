"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', {
          event,
          hasSession: !!session,
          userId: session?.user?.id || null,
          email: session?.user?.email || null
        })
        
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        // Handle sign out
        if (event === 'SIGNED_OUT') {
          console.log('🚪 Auth state: SIGNED_OUT event received, redirecting to signin...')
          // Clear local state immediately
          setSession(null)
          setUser(null)
          // Small delay to ensure state is updated before redirect
          setTimeout(() => {
            console.log('🔄 Redirecting to signin page...')
            window.location.href = '/auth/signin'
          }, 100)
        }
        
        // Handle sign in
        if (event === 'SIGNED_IN' && session) {
          console.log('🔑 Auth state: SIGNED_IN event received for:', session.user.email)
        }
        
        // Handle token refresh
        if (event === 'TOKEN_REFRESHED' && session) {
          console.log('🔄 Auth state: TOKEN_REFRESHED for:', session.user.email)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    try {
      console.log('🔄 Initiating sign out...')
      
      // Call server-side signout for proper session cleanup
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        console.warn('Server signout failed, falling back to client signout')
      }
      
      // Also call client-side signout to ensure local state is cleared
      await supabase.auth.signOut()
      
      console.log('✅ Sign out completed')
      
      // Force redirect to signin page
      window.location.href = '/auth/signin'
      
    } catch (error) {
      console.error('❌ Sign out error:', error)
      // Fallback: just do client-side signout
      await supabase.auth.signOut()
      window.location.href = '/auth/signin'
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}