'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { Button } from '../Button'
import type { Toast as ToastType } from './types'

// ────────────────────────────────────────────────────────────────────────────
// Toast Component (individual toast)
// ────────────────────────────────────────────────────────────────────────────

const variantStyles = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-rose-50 border-rose-200 text-rose-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
}

const iconStyles = {
  success: 'text-emerald-600',
  error: 'text-rose-600',
  warning: 'text-amber-600',
  info: 'text-blue-600',
}

const defaultIcons = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
}

interface ToastProps {
  toast: ToastType
  onClose: () => void
}

export function Toast({ toast, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false)

  // Handle close with exit animation
  const handleClose = () => {
    setIsExiting(true)
    setTimeout(onClose, 200) // Match animation duration
  }

  // Auto-dismiss countdown
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(handleClose, toast.duration)
      return () => clearTimeout(timer)
    }
  }, [toast.duration])

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 w-full max-w-md p-4 rounded-lg border shadow-lg',
        'transition-all duration-200',
        variantStyles[toast.variant],
        isExiting
          ? 'animate-out fade-out slide-out-to-right-full'
          : 'animate-in fade-in slide-in-from-right-full'
      )}
      role="alert"
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {toast.icon || (
          <span className={cn('material-symbols-outlined text-xl', iconStyles[toast.variant])}>
            {defaultIcons[toast.variant]}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <div className="font-semibold text-sm mb-1">{toast.title}</div>
        )}
        <div className="text-sm">{toast.message}</div>

        {/* Action button */}
        {toast.action && (
          <div className="mt-3">
            <button
              onClick={toast.action.onClick}
              className="text-sm font-semibold underline hover:no-underline"
            >
              {toast.action.label}
            </button>
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={handleClose}
        className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
        aria-label="Close notification"
      >
        <span className="material-symbols-outlined text-lg">close</span>
      </button>
    </div>
  )
}
