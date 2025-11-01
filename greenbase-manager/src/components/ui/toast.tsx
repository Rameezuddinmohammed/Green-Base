"use client"

import { useState, useEffect } from "react"
import { X, CheckCircle, AlertCircle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  description?: string
  duration?: number
}

interface ToastProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastComponent({ toast, onRemove }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id)
    }, toast.duration || 4000)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onRemove])

  const getToastStyles = (type: string) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50 border-green-200',
          icon: 'text-green-500',
          title: 'text-green-800',
          desc: 'text-green-600'
        }
      case 'error':
        return {
          bg: 'bg-red-50 border-red-200',
          icon: 'text-red-500',
          title: 'text-red-800',
          desc: 'text-red-600'
        }
      case 'info':
        return {
          bg: 'bg-blue-50 border-blue-200',
          icon: 'text-blue-500',
          title: 'text-blue-800',
          desc: 'text-blue-600'
        }
      default:
        return {
          bg: 'bg-gray-50 border-gray-200',
          icon: 'text-gray-500',
          title: 'text-gray-800',
          desc: 'text-gray-600'
        }
    }
  }

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info
  }

  const Icon = icons[toast.type]
  const styles = getToastStyles(toast.type)

  return (
    <div
      className={cn(
        "pointer-events-auto w-full max-w-md overflow-hidden rounded-lg border shadow-md backdrop-blur-sm transition-all duration-300 ease-in-out",
        "animate-in slide-in-from-right-full",
        styles.bg
      )}
    >
      <div className="p-3">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className={cn("h-4 w-4", styles.icon)} />
          </div>
          <div className="ml-2 flex-1 min-w-0">
            <p className={cn("text-sm font-medium truncate", styles.title)}>
              {toast.title}
            </p>
            {toast.description && (
              <p className={cn("mt-0.5 text-xs line-clamp-2", styles.desc)}>
                {toast.description}
              </p>
            )}
          </div>
          <div className="ml-2 flex-shrink-0">
            <button
              className={cn(
                "inline-flex rounded-md p-1 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors",
                styles.icon
              )}
              onClick={() => onRemove(toast.id)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { ...toast, id }])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  // Expose addToast globally
  useEffect(() => {
    ;(window as any).addToast = addToast
  }, [])

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-50 flex flex-col items-end px-4 py-6 space-y-4">
      {toasts.map(toast => (
        <ToastComponent key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  )
}

// Helper function to show toasts
export const showToast = (toast: Omit<Toast, 'id'>) => {
  if (typeof window !== 'undefined' && (window as any).addToast) {
    ;(window as any).addToast(toast)
  }
}
