import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'
import { UserRole } from './auth'

/**
 * Get authenticated user on the server side
 */
export async function getServerUser() {
  const supabase = createServerComponentClient<Database>({ cookies })
  
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return null
    }

    // Get user profile - using any type for now since users table is not in generated types
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profileError || !profile) {
      return null
    }

    const userProfile = profile as any

    return {
      id: userProfile.id,
      email: userProfile.email,
      role: userProfile.role as UserRole,
      organizationId: userProfile.organization_id,
      session
    }
  } catch (error) {
    console.error('Error getting server user:', error)
    return null
  }
}

/**
 * Require authentication for API routes
 */
export async function requireAuth() {
  const user = await getServerUser()
  
  if (!user) {
    throw new Error('Authentication required')
  }
  
  return user
}

/**
 * Require specific role for API routes
 */
export async function requireRole(role: UserRole) {
  const user = await requireAuth()
  
  if (user.role !== role) {
    throw new Error(`${role} role required`)
  }
  
  return user
}

/**
 * Require manager role for API routes
 */
export async function requireManager() {
  return requireRole('manager')
}

/**
 * Get Supabase client with user context for server components
 */
export async function getServerSupabase() {
  return createServerComponentClient<Database>({ cookies })
}

/**
 * Create API response with proper error handling
 */
export function createApiResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

/**
 * Create error response for API routes
 */
export function createErrorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}