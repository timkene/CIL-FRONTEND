import { ReactNode } from 'react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export interface Toast {
  /**
   * Unique toast ID
   */
  id: string

  /**
   * Toast variant/type
   */
  variant: ToastVariant

  /**
   * Toast title (optional)
   */
  title?: string

  /**
   * Toast message
   */
  message: string

  /**
   * Auto-dismiss duration in milliseconds (0 = never)
   * @default 5000
   */
  duration?: number

  /**
   * Optional icon override
   */
  icon?: ReactNode

  /**
   * Optional action button
   */
  action?: {
    label: string
    onClick: () => void
  }
}

export interface ToastOptions {
  /**
   * Toast title (optional)
   */
  title?: string

  /**
   * Auto-dismiss duration in milliseconds (0 = never)
   * @default 5000
   */
  duration?: number

  /**
   * Optional icon override
   */
  icon?: ReactNode

  /**
   * Optional action button
   */
  action?: {
    label: string
    onClick: () => void
  }
}

export interface ToastStore {
  /**
   * All active toasts
   */
  toasts: Toast[]

  /**
   * Add a new toast
   */
  addToast: (toast: Omit<Toast, 'id'>) => string

  /**
   * Remove a toast by ID
   */
  removeToast: (id: string) => void

  /**
   * Remove all toasts
   */
  clearAll: () => void
}
