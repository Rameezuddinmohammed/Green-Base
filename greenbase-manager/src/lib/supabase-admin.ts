/**
 * SECURITY: Server-side ONLY Supabase client with service role key
 * 
 * This file contains the privileged Supabase client that bypasses RLS policies.
 * It MUST NEVER be imported in client-side code or components.
 * 
 * Usage: Import ONLY in server-side API routes and server components.
 */

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { getConfigService } from './config'

let supabaseAdminInstance: ReturnType<typeof createClient<Database>> | null = null

/**
 * Get the server-side Supabase admin client
 * Uses service role key for privileged database operations
 */
export async function getSupabaseAdmin() {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance
  }

  const configService = getConfigService()
  const config = await configService.getConfig()

  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw new Error('Missing Supabase configuration for admin client')
  }

  supabaseAdminInstance = createClient<Database>(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  return supabaseAdminInstance
}

// Type export for convenience
export type SupabaseAdmin = Awaited<ReturnType<typeof getSupabaseAdmin>>