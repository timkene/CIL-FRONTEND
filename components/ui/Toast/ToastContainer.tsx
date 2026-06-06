'use client'

import { useToastStore } from './store'
import { Toast } from './Toast'

// ────────────────────────────────────────────────────────────────────────────
// Toast Container (renders all toasts)
// ────────────────────────────────────────────────────────────────────────────

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed top-0 right-0 z-[100] p-4 space-y-3 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="space-y-3 pointer-events-auto">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </div>
  )
}
