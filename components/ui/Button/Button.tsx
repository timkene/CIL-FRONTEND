'use client'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'
import type { ButtonProps } from './types'

/**
 * Production-grade Button component
 *
 * Features:
 * - Multiple variants (primary, secondary, outline, ghost, danger)
 * - Three sizes (sm, md, lg)
 * - Loading states with spinner
 * - Icon support (left/right)
 * - Full keyboard accessibility
 * - WCAG 2.1 AA compliant
 *
 * @example
 * // Basic button
 * <Button>Click me</Button>
 *
 * @example
 * // With loading state
 * <Button loading={isSubmitting} onClick={handleSubmit}>
 *   Submit
 * </Button>
 *
 * @example
 * // With icon
 * <Button
 *   variant="primary"
 *   leftIcon={<span className="material-symbols-outlined">add</span>}
 * >
 *   Add Client
 * </Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        className={cn(
          // Base styles — common to all buttons
          'inline-flex items-center justify-center gap-2',
          'font-semibold tracking-wide transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-60',

          // Variant-specific styles (colors, borders, shadows)
          variantStyles[variant],

          // Size-specific styles (padding, height, text size)
          sizeStyles[size],

          // Full width modifier
          fullWidth && 'w-full',

          // Custom className for one-off overrides
          className
        )}
        {...props}
      >
        {/* Loading spinner (replaces left icon when loading) */}
        {loading && (
          <span
            className="material-symbols-outlined animate-spin"
            aria-label="Loading"
            style={{ fontSize: sizeIconMap[size] }}
          >
            progress_activity
          </span>
        )}

        {/* Left icon (hidden when loading) */}
        {!loading && leftIcon && (
          <span className="shrink-0" style={{ fontSize: sizeIconMap[size] }}>
            {leftIcon}
          </span>
        )}

        {/* Button text (hidden visually when loading but kept for accessibility) */}
        <span className={loading ? 'opacity-0' : undefined}>{children}</span>

        {/* Right icon (hidden when loading) */}
        {!loading && rightIcon && (
          <span className="shrink-0" style={{ fontSize: sizeIconMap[size] }}>
            {rightIcon}
          </span>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

// ─────────────────────────────────────────────────────────────────────────────
// Style Mappings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Variant style mapping
 * Each variant defines colors, hover states, and focus ring color
 */
const variantStyles = {
  primary: cn(
    'bg-[#137fec] text-white shadow-sm',
    'hover:bg-[#0f6dd6] active:bg-[#0b5ab0]',
    'focus-visible:ring-[#137fec]'
  ),
  secondary: cn(
    'bg-slate-100 text-slate-900 shadow-sm',
    'hover:bg-slate-200 active:bg-slate-300',
    'focus-visible:ring-slate-400'
  ),
  outline: cn(
    'bg-transparent border-2 border-[#137fec] text-[#137fec]',
    'hover:bg-[#137fec]/10 active:bg-[#137fec]/20',
    'focus-visible:ring-[#137fec]'
  ),
  ghost: cn(
    'bg-transparent text-slate-700',
    'hover:bg-slate-100 active:bg-slate-200',
    'focus-visible:ring-slate-400'
  ),
  danger: cn(
    'bg-rose-600 text-white shadow-sm',
    'hover:bg-rose-700 active:bg-rose-800',
    'focus-visible:ring-rose-600'
  ),
}

/**
 * Size style mapping
 * Defines height, padding, text size, and minimum width
 */
const sizeStyles = {
  sm: 'h-8 px-3 text-sm rounded-lg min-w-[64px]',
  md: 'h-10 px-4 text-base rounded-lg min-w-[80px]',
  lg: 'h-12 px-6 text-lg rounded-xl min-w-[96px]',
}

/**
 * Icon size mapping
 * Ensures icons are properly sized for each button size
 */
const sizeIconMap = {
  sm: '16px',
  md: '18px',
  lg: '20px',
}
