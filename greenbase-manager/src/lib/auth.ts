import { supabase } from './supabase'
import { getSupabaseAdmin } from './supabase-admin'
import { Database } from '@/types/database'

export type User = Database['public']['Tables']['users']['Row']
export type UserRole = Database['public']['Enums']['user_role']

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  organizationId: string
}

/**
 * Get the current authenticated user with profile information
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return null
    }

    // Get user profile from our users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return null
    }

    return {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      organizationId: profile.organization_id
    }
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Sign up a new user with email and password
 */
export async function signUp(
  email: string, 
  password: string, 
  organizationName: string,
  role: UserRole = 'manager'
) {
  try {
    // First, create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError || !authData.user) {
      throw authError || new Error('Failed to create user')
    }

    // Create organization (using admin client to bypass RLS)
    const supabaseAdmin = await getSupabaseAdmin()
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: organizationName
      })
      .select()
      .single()

    if (orgError || !org) {
      throw orgError || new Error('Failed to create organization')
    }

    // Create user profile (using admin client to bypass RLS during signup)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: authData.user.email!,
        role,
        organization_id: org.id
      })
      .select()
      .single()

    if (profileError) {
      throw profileError
    }

    return {
      user: authData.user,
      profile,
      organization: org
    }
  } catch (error) {
    console.error('Error signing up:', error)
    throw error
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    console.error('Error signing in:', error)
    throw error
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Error signing out:', error)
    throw error
  }
}

/**
 * Sign in with OAuth provider (Microsoft/Google)
 */
export async function signInWithOAuth(provider: 'azure' | 'google') {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: provider === 'azure' 
          ? 'openid profile email https://graph.microsoft.com/Files.Read https://graph.microsoft.com/Group.Read.All'
          : 'openid profile email https://www.googleapis.com/auth/drive.readonly'
      }
    })

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    console.error('Error signing in with OAuth:', error)
    throw error
  }
}

/**
 * Check if user is a manager
 */
export async function isManager(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === 'manager'
}

/**
 * Get users in the same organization
 */
export async function getOrganizationUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error('Error getting organization users:', error)
    return []
  }
}

/**
 * Update user role (managers only)
 */
export async function updateUserRole(userId: string, role: UserRole) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    console.error('Error updating user role:', error)
    throw error
  }
}

/**
 * Create user profile after OAuth signup
 */
export async function createUserProfile(
  userId: string,
  email: string,
  organizationId: string,
  role: UserRole = 'employee'
) {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: userId,
        email,
        organization_id: organizationId,
        role
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    console.error('Error creating user profile:', error)
    throw error
  }
}