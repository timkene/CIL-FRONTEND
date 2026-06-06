import { create } from 'zustand'
import type { Toast, ToastStore } from './types'

// ────────────────────────────────────────────────────────────────────────────
// Toast Store (Zustand)
// ────────────────────────────────────────────────────────────────────────────

let toastIdCounter = 0

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++toastIdCounter}`
    const newToast: Toast = { id, ...toast }

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }))

    // Auto-dismiss after duration (default 5000ms)
    const duration = toast.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, duration)
    }

    return id
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  clearAll: () => {
    set({ toasts: [] })
  },
}))
