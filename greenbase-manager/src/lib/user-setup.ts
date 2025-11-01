import { getSupabaseAdmin } from './supabase-admin'

export interface UserSetupResult {
  user: {
    id: string
    email: string
    role: string
    organization_id: string
  }
  organization: {
    id: string
    name: string
  }
  isNewUser: boolean
}

/**
 * Ensures a user exists in the database with proper organization setup
 * This should be called whenever a user authenticates
 */
export async function ensureUserSetup(authUserId: string, email: string): Promise<UserSetupResult> {
  const supabase = await getSupabaseAdmin()

  // Check if user already exists
  const { data: existingUser, error: userCheckError } = await supabase
    .from('users')
    .select(`
      id,
      email,
      role,
      organization_id,
      organizations (
        id,
        name
      )
    `)
    .eq('id', authUserId)
    .single()

  if (!userCheckError && existingUser) {
    // User already exists, return existing data
    return {
      user: {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
        organization_id: existingUser.organization_id
      },
      organization: {
        id: existingUser.organizations.id,
        name: existingUser.organizations.name
      },
      isNewUser: false
    }
  }

  // User doesn't exist, create new user and organization
  console.log('Setting up new user:', email)

  // Create organization first
  const orgName = email.split('@')[1] || 'Default Organization'
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: orgName
    })
    .select()
    .single()

  if (orgError) {
    console.error('Failed to create organization:', orgError)
    throw new Error(`Failed to create organization: ${orgError.message}`)
  }

  // Create user
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      id: authUserId,
      email: email,
      role: 'manager', // First user in org is manager
      organization_id: organization.id
    })
    .select()
    .single()

  if (userError) {
    console.error('Failed to create user:', userError)
    throw new Error(`Failed to create user: ${userError.message}`)
  }

  console.log('User setup completed:', { userId: user.id, orgId: organization.id })

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id
    },
    organization: {
      id: organization.id,
      name: organization.name
    },
    isNewUser: true
  }
}

/**
 * Get user info with organization details
 */
export async function getUserInfo(authUserId: string): Promise<UserSetupResult | null> {
  const supabase = await getSupabaseAdmin()

  const { data: user, error } = await supabase
    .from('users')
    .select(`
      id,
      email,
      role,
      organization_id,
      organizations (
        id,
        name
      )
    `)
    .eq('id', authUserId)
    .single()

  if (error || !user) {
    return null
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id
    },
    organization: {
      id: user.organizations.id,
      name: user.organizations.name
    },
    isNewUser: false
  }
}