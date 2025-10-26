"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { 
  BarChart3, 
  FileText, 
  BookOpen, 
  Settings, 
  Search,
  User,
  Bell,
  Command,
  Moon,
  Sun
} from "lucide-react"


interface NavigationProps {
  pendingCount?: number
}

export function Navigation({ pendingCount = 0 }: NavigationProps) {
  const pathname = usePathname()
  const [isDark, setIsDark] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)

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
      badge: pendingCount > 0 ? pendingCount : undefined
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

  return (
    <>
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            {/* Logo and main navigation */}
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <Link href="/dashboard" className="logo">
                  <div className="logo-icon">
                    <span>🌱</span>
                  </div>
                  <span>GreenBase</span>
                </Link>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
                {navigation.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`nav-link ${item.current ? 'active' : ''}`}
                    >
                      <Icon style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                      {item.name}
                      {item.badge && (
                        <span className="badge" style={{ marginLeft: '0.5rem', backgroundColor: '#22c55e', color: 'white' }}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Search and user menu */}
            <div className="flex items-center space-x-4">
              {/* Global search */}
              <div style={{ position: 'relative', display: 'none' }}>
                <div style={{ position: 'absolute', top: '0', left: '0', bottom: '0', paddingLeft: '0.75rem', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <Search style={{ width: '1rem', height: '1rem', color: '#6b7280' }} />
                </div>
                <input
                  type="text"
                  placeholder="Search knowledge base..."
                  style={{ paddingLeft: '2.5rem', paddingRight: '1rem', width: '16rem', backgroundColor: '#f9fafb', border: '0', borderRadius: '0.375rem', padding: '0.5rem' }}
                  onClick={() => setShowCommandPalette(true)}
                  readOnly
                />
                <div style={{ position: 'absolute', top: '0', right: '0', bottom: '0', paddingRight: '0.75rem', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <kbd style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '0.25rem', border: '1px solid #e5e7eb', padding: '0.125rem 0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>
                    <Command style={{ width: '0.75rem', height: '0.75rem', marginRight: '0.125rem' }} />K
                  </kbd>
                </div>
              </div>

              {/* Theme toggle */}
              <button
                onClick={() => setIsDark(!isDark)}
                style={{ width: '2.25rem', height: '2.25rem', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {isDark ? (
                  <Sun style={{ width: '1rem', height: '1rem' }} />
                ) : (
                  <Moon style={{ width: '1rem', height: '1rem' }} />
                )}
              </button>

              {/* Notifications */}
              <button style={{ width: '2.25rem', height: '2.25rem', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <Bell style={{ width: '1rem', height: '1rem' }} />
                {pendingCount > 0 && (
                  <div style={{ position: 'absolute', top: '-0.25rem', right: '-0.25rem', width: '0.75rem', height: '0.75rem', backgroundColor: '#22c55e', borderRadius: '50%', animation: 'pulse-ring 1.5s ease-out infinite' }} />
                )}
              </button>

              {/* User menu */}
              <button style={{ width: '2.25rem', height: '2.25rem', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User style={{ width: '1rem', height: '1rem' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile navigation */}
        <div style={{ display: 'none', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ padding: '0.5rem', paddingTop: '0.5rem', paddingBottom: '0.75rem' }}>
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`nav-link ${item.current ? 'active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', padding: '0.75rem', fontSize: '1rem', fontWeight: '500', borderRadius: '0.375rem', marginBottom: '0.25rem' }}
                >
                  <Icon style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.75rem' }} />
                  {item.name}
                  {item.badge && (
                    <span className="badge" style={{ marginLeft: 'auto', backgroundColor: '#22c55e', color: 'white' }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Command Palette Overlay */}
      {showCommandPalette && (
        <div style={{ position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', zIndex: '50', backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)', animation: 'scale-in 0.2s ease-out' }}>
          <div style={{ position: 'fixed', top: '25%', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '32rem' }}>
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', padding: '1rem' }}>
              <div className="flex items-center space-x-3 mb-4">
                <Search style={{ width: '1.25rem', height: '1.25rem', color: '#6b7280' }} />
                <input
                  placeholder="Search or jump to..."
                  style={{ border: '0', backgroundColor: 'transparent', fontSize: '1.125rem', outline: 'none', width: '100%' }}
                  autoFocus
                />
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                <div style={{ marginBottom: '0.5rem', fontWeight: '500' }}>Quick Actions</div>
                <div className="space-y-1">
                  <div style={{ padding: '0.25rem 0.5rem', borderRadius: '0.25rem', cursor: 'pointer' }} onMouseOver={(e) => e.target.style.backgroundColor = '#f3f4f6'} onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}>📝 Go to Approval Queue</div>
                  <div style={{ padding: '0.25rem 0.5rem', borderRadius: '0.25rem', cursor: 'pointer' }} onMouseOver={(e) => e.target.style.backgroundColor = '#f3f4f6'} onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}>📚 Search Knowledge Base</div>
                  <div style={{ padding: '0.25rem 0.5rem', borderRadius: '0.25rem', cursor: 'pointer' }} onMouseOver={(e) => e.target.style.backgroundColor = '#f3f4f6'} onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}>⚙️ Manage Sources</div>
                  <div style={{ padding: '0.25rem 0.5rem', borderRadius: '0.25rem', cursor: 'pointer' }} onMouseOver={(e) => e.target.style.backgroundColor = '#f3f4f6'} onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}>🔄 Sync All Sources</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}