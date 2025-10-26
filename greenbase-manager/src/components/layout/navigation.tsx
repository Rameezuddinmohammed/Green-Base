"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
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
  Sun,
  Zap,
  RefreshCw,
  Plus,
  Archive
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"

interface NavigationProps {
  pendingCount?: number
}

export function Navigation({ pendingCount = 0 }: NavigationProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isDark, setIsDark] = useState(false)
  const [open, setOpen] = useState(false)

  // Command palette shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: BarChart3,
      current: pathname === "/dashboard",
      description: "Overview and insights"
    },
    {
      name: "Approval Queue",
      href: "/dashboard",
      icon: FileText,
      current: pathname.includes("approvals"),
      badge: pendingCount > 0 ? pendingCount : undefined,
      description: "Review pending documents"
    },
    {
      name: "Knowledge Base",
      href: "/dashboard",
      icon: BookOpen,
      current: pathname.includes("knowledge-base"),
      description: "Browse approved content"
    },
    {
      name: "Sources",
      href: "/dashboard",
      icon: Settings,
      current: pathname.includes("sources"),
      description: "Manage data connections"
    }
  ]

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false)
    command()
  }, [])

  return (
    <>
      {/* Main Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          {/* Logo */}
          <div className="mr-8">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="text-sm font-bold">🌱</span>
              </div>
              <span className="hidden font-bold sm:inline-block">GreenBase</span>
            </Link>
          </div>

          {/* Main Navigation */}
          <nav className="flex items-center space-x-1">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant={item.current ? "secondary" : "ghost"}
                    className="relative h-9 justify-start"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">{item.name}</span>
                    {item.badge && (
                      <Badge 
                        variant="secondary" 
                        className="ml-2 h-5 min-w-[20px] bg-orange-100 text-orange-800 hover:bg-orange-100"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center space-x-2">
            {/* Command Palette Trigger */}
            <Button
              variant="outline"
              className="relative h-9 w-9 p-0 xl:h-10 xl:w-60 xl:justify-start xl:px-3 xl:py-2"
              onClick={() => setOpen(true)}
            >
              <Search className="h-4 w-4 xl:mr-2" />
              <span className="hidden xl:inline-flex">Search...</span>
              <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 xl:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark(!isDark)}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {pendingCount > 0 && (
                <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </Badge>
              )}
            </Button>

            {/* User Menu */}
            <Button variant="ghost" size="icon">
              <User className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Command Palette */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          <CommandGroup heading="Navigation">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <CommandItem
                  key={item.name}
                  onSelect={() => runCommand(() => router.push(item.href))}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{item.name}</span>
                  <CommandShortcut>{item.description}</CommandShortcut>
                </CommandItem>
              )
            })}
          </CommandGroup>

          <CommandGroup heading="Quick Actions">
            <CommandItem onSelect={() => runCommand(() => router.push("/dashboard"))}>
              <Zap className="mr-2 h-4 w-4" />
              <span>View AI Insights</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => console.log("Sync all sources"))}>
              <RefreshCw className="mr-2 h-4 w-4" />
              <span>Sync All Sources</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => console.log("Add new source"))}>
              <Plus className="mr-2 h-4 w-4" />
              <span>Add New Source</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => console.log("View archived"))}>
              <Archive className="mr-2 h-4 w-4" />
              <span>View Archived Documents</span>
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Smart Filters">
            <CommandItem onSelect={() => runCommand(() => console.log("Recently updated"))}>
              <span>🔥</span>
              <span className="ml-2">Recently Updated</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => console.log("Needs review"))}>
              <span>🕒</span>
              <span className="ml-2">Needs Review</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => console.log("High confidence"))}>
              <span>🌿</span>
              <span className="ml-2">High Confidence Only</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}