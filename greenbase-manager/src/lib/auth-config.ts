// Supabase Auth Configuration
export const authConfig = {
  // OAuth providers configuration
  providers: {
    azure: {
      scopes: 'openid profile email https://graph.microsoft.com/Files.Read https://graph.microsoft.com/Group.Read.All',
      redirectTo: '/auth/callback'
    },
    google: {
      scopes: 'openid profile email https://www.googleapis.com/auth/drive.readonly',
      redirectTo: '/auth/callback'
    }
  },
  
  // Protected routes that require authentication
  protectedRoutes: [
    '/dashboard',
    '/approval-queue',
    '/sources',
    '/analytics',
    '/users'
  ],
  
  // Routes that require manager role
  managerOnlyRoutes: [
    '/approval-queue',
    '/sources',
    '/analytics',
    '/users'
  ],
  
  // Public routes (no auth required)
  publicRoutes: [
    '/',
    '/auth/signin',
    '/auth/signup',
    '/auth/callback'
  ],
  
  // Default redirect after successful login
  defaultRedirect: '/dashboard',
  
  // Redirect after logout
  logoutRedirect: '/auth/signin'
}

export type AuthConfig = typeof authConfig