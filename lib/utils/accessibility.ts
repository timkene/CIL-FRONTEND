'use client'
import { useEffect, useRef } from 'react'

/**
 * Focus trap hook for modals and dialogs
 *
 * Traps keyboard focus within a container element, cycling through
 * focusable elements when Tab is pressed.
 *
 * @param enabled - Whether the focus trap is active
 * @returns Ref to attach to the container element
 *
 * @example
 * const modalRef = useFocusTrap(isOpen)
 * return <div ref={modalRef}>...</div>
 */
export function useFocusTrap(enabled: boolean) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!enabled || !ref.current) return

    const element = ref.current
    const focusableElements = element.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        // Shift+Tab: going backwards
        if (document.activeElement === firstElement) {
          lastElement?.focus()
          e.preventDefault()
        }
      } else {
        // Tab: going forwards
        if (document.activeElement === lastElement) {
          firstElement?.focus()
          e.preventDefault()
        }
      }
    }

    element.addEventListener('keydown', handleTab)
    firstElement?.focus()

    return () => element.removeEventListener('keydown', handleTab)
  }, [enabled])

  return ref
}

/**
 * Lock body scroll hook
 *
 * Prevents scrolling on the document body, typically used for modals.
 * Also compensates for scrollbar width to prevent layout shift.
 *
 * @param lock - Whether to lock scroll
 *
 * @example
 * useLockBodyScroll(isModalOpen)
 */
export function useLockBodyScroll(lock: boolean) {
  useEffect(() => {
    if (lock) {
      // Calculate scrollbar width to prevent layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = `${scrollbarWidth}px`
    } else {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [lock])
}

/**
 * Generate unique ID for accessibility linking
 *
 * @param prefix - Optional prefix for the ID
 * @returns Unique ID string
 *
 * @example
 * const labelId = generateId('label') // => "label-a3f8k2"
 * <label id={labelId}>Name</label>
 * <input aria-labelledby={labelId} />
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
}
