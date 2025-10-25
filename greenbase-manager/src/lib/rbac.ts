import { UserRole } from './auth'

// Define permissions for different roles
export const permissions = {
  manager: [
    'view_dashboard',
    'view_approval_queue',
    'approve_documents',
    'reject_documents',
    'edit_documents',
    'manage_sources',
    'view_analytics',
    'manage_users',
    'view_all_qa_interactions',
    'export_data'
  ],
  employee: [
    'view_dashboard',
    'ask_questions',
    'submit_updates',
    'view_approved_documents',
    'view_own_qa_interactions'
  ]
} as const

export type Permission = typeof permissions.manager[number] | typeof permissions.employee[number]

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const rolePermissions = permissions[role] || []
  return rolePermissions.includes(permission as any)
}

/**
 * Check if a user role can access a specific route
 */
export function canAccessRoute(role: UserRole, route: string): boolean {
  // Manager routes
  const managerRoutes = [
    '/approval-queue',
    '/sources',
    '/analytics',
    '/users'
  ]
  
  // Employee routes (all users can access these)
  const employeeRoutes = [
    '/dashboard',
    '/documents',
    '/search'
  ]
  
  if (role === 'manager') {
    return true // Managers can access all routes
  }
  
  if (role === 'employee') {
    // Employees cannot access manager-only routes
    const isManagerRoute = managerRoutes.some(managerRoute => 
      route.startsWith(managerRoute)
    )
    return !isManagerRoute
  }
  
  return false
}

/**
 * Get available navigation items based on user role
 */
export function getNavigationItems(role: UserRole) {
  const baseItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      permission: 'view_dashboard' as Permission
    },
    {
      name: 'Documents',
      href: '/documents',
      permission: 'view_approved_documents' as Permission
    }
  ]
  
  const managerItems = [
    {
      name: 'Approval Queue',
      href: '/approval-queue',
      permission: 'view_approval_queue' as Permission
    },
    {
      name: 'Sources',
      href: '/sources',
      permission: 'manage_sources' as Permission
    },
    {
      name: 'Analytics',
      href: '/analytics',
      permission: 'view_analytics' as Permission
    },
    {
      name: 'Users',
      href: '/users',
      permission: 'manage_users' as Permission
    }
  ]
  
  const allItems = role === 'manager' 
    ? [...baseItems, ...managerItems]
    : baseItems
  
  return allItems.filter(item => hasPermission(role, item.permission))
}

/**
 * Higher-order component for role-based access control
 */
export function withRoleGuard<T extends object>(
  Component: React.ComponentType<T>,
  requiredPermission: Permission
) {
  return function GuardedComponent(props: T & { userRole?: UserRole }) {
    const { userRole, ...componentProps } = props
    
    if (!userRole || !hasPermission(userRole, requiredPermission)) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
            <p className="text-gray-500">You don't have permission to view this content.</p>
          </div>
        </div>
      )
    }
    
    return <Component {...(componentProps as T)} />
  }
}