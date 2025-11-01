"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, 
  FileText, 
  BookOpen, 
  Settings, 
  Search,
  Bell,
  Command,
  Moon,
  Sun,
  LogOut
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { usePendingCount } from "@/contexts/pending-count-context"


interface NavigationProps {
  pendingCount?: number
}

export function Navigation({ pendingCount = 0 }: NavigationProps) {
  const pathname = usePathname()
  const { signOut } = useAuth()
  const { pendingCount: contextPendingCount, refreshPendingCount, isRefreshing } = usePendingCount()
  const [isDark, setIsDark] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  
  // Use the context pending count instead of prop
  const displayPendingCount = contextPendingCount

  const handleSignOut = async () => {
    if (isSigningOut) return // Prevent double-clicks
    
    try {
      setIsSigningOut(true)
      console.log('🔄 Navigation: Starting sign out...')
      await signOut()
      console.log('✅ Navigation: Sign out completed')
    } catch (error) {
      console.error('❌ Navigation: Sign out failed:', error)
      // Force redirect as fallback
      window.location.href = '/auth/signin'
    } finally {
      setIsSigningOut(false)
    }
  }

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Command palette shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(true)
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: BarChart3,
      current: pathname === "/dashboard"
    },
    {
      name: "Approval Queue",
      href: "/dashboard/approvals",
      icon: FileText,
      current: pathname.startsWith("/dashboard/approvals"),
      badge: displayPendingCount > 0 ? displayPendingCount : undefined
    },
    {
      name: "Knowledge Base",
      href: "/dashboard/knowledge-base",
      icon: BookOpen,
      current: pathname.startsWith("/dashboard/knowledge-base")
    },
    {
      name: "Sources",
      href: "/dashboard/sources",
      icon: Settings,
      current: pathname.startsWith("/dashboard/sources")
    }
  ]

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-[60]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex items-center">
              <span className="text-xl font-bold">GreenBase</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9"></div>
              <div className="w-9 h-9"></div>
              <div className="w-9 h-9"></div>
            </div>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <>
      <nav className="border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-[60] shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            {/* Logo and main navigation */}
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <Link href="/dashboard" className="text-xl font-bold text-primary hover:text-primary/80 transition-colors">
                  GreenBase
                </Link>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-2">
                {navigation.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg group ${
                        item.current 
                          ? 'text-primary bg-primary/10 shadow-sm' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.name}
                      {item.badge && (
                        <Badge className="ml-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs px-2 py-1 min-w-[20px] flex items-center justify-center">
                          {item.badge}
                        </Badge>
                      )}
                      {item.current && (
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Search and user menu */}
            <div className="flex items-center space-x-2">
              {/* Global search */}
              <div className="hidden md:block relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-muted-foreground" />
                </div>
                <input
                  type="text"
                  placeholder="Search knowledge base..."
                  className="pl-10 pr-4 w-64 bg-muted border-0 rounded-md py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  onClick={() => setShowCommandPalette(true)}
                  readOnly
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <kbd className="inline-flex items-center rounded border border-border px-2 py-1 text-xs text-muted-foreground">
                    <Command className="w-3 h-3 mr-1" />K
                  </kbd>
                </div>
              </div>

              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDark(!isDark)}
                className="w-9 h-9 p-0"
              >
                {isDark ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </Button>

              {/* Notifications */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-9 h-9 p-0 relative"
                onClick={refreshPendingCount}
                disabled={isRefreshing}
                title={isRefreshing ? "Refreshing..." : "Refresh pending count"}
              >
                <Bell className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {displayPendingCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                )}
              </Button>

              {/* User menu */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-9 h-9 p-0"
                title={isSigningOut ? "Signing out..." : "Sign Out"}
              >
                <LogOut className={`w-4 h-4 ${isSigningOut ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile navigation */}
        <div className="sm:hidden border-t border-border bg-background/50">
          <div className="px-3 py-3 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-base font-medium rounded-lg transition-all duration-200 ${
                    item.current 
                      ? 'text-primary bg-primary/10 border-l-4 border-primary' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                  {item.badge && (
                    <Badge className="ml-auto bg-primary text-primary-foreground hover:bg-primary/90 text-xs px-2 py-1">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Command Palette Overlay */}
      {showCommandPalette && (
        <div 
          className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm animate-in fade-in-0"
          onClick={() => setShowCommandPalette(false)}
        >
          <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4">
            <div 
              className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-lg border shadow-2xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center space-x-3 mb-4">
                <Search className="w-5 h-5 text-muted-foreground" />
                <input
                  placeholder="Search or jump to..."
                  className="border-0 bg-transparent text-lg outline-none w-full placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>
              <div className="text-sm text-muted-foreground">
                <div className="mb-2 font-medium">Quick Actions</div>
                <div className="space-y-1">
                  <Link 
                    href="/dashboard/approvals"
                    className="block px-2 py-1 rounded cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => setShowCommandPalette(false)}
                  >
                    📝 Go to Approval Queue
                  </Link>
                  <Link 
                    href="/dashboard/knowledge-base"
                    className="block px-2 py-1 rounded cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => setShowCommandPalette(false)}
                  >
                    📚 Search Knowledge Base
                  </Link>
                  <Link 
                    href="/dashboard/sources"
                    className="block px-2 py-1 rounded cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => setShowCommandPalette(false)}
                  >
                    ⚙️ Manage Sources
                  </Link>
                  <div className="px-2 py-1 rounded cursor-pointer hover:bg-muted transition-colors">
                    🔄 Sync All Sources
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}