import { useCallback } from 'react'
import { useToastStore } from './store'
import type { ToastOptions } from './types'

// ────────────────────────────────────────────────────────────────────────────
// useToast Hook
// ────────────────────────────────────────────────────────────────────────────

export function useToast() {
  const { addToast, removeToast, clearAll } = useToastStore()

  const success = useCallback(
    (message: string, options?: ToastOptions) => {
      return addToast({
        variant: 'success',
        message,
        ...options,
      })
    },
    [addToast]
  )

  const error = useCallback(
    (message: string, options?: ToastOptions) => {
      return addToast({
        variant: 'error',
        message,
        duration: 0, // Errors don't auto-dismiss by default
        ...options,
      })
    },
    [addToast]
  )

  const warning = useCallback(
    (message: string, options?: ToastOptions) => {
      return addToast({
        variant: 'warning',
        message,
        ...options,
      })
    },
    [addToast]
  )

  const info = useCallback(
    (message: string, options?: ToastOptions) => {
      return addToast({
        variant: 'info',
        message,
        ...options,
      })
    },
    [addToast]
  )

  return {
    success,
    error,
    warning,
    info,
    dismiss: removeToast,
    dismissAll: clearAll,
  }
}
