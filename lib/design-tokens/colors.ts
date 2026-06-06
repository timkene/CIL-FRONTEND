/**
 * Clearline Analytics Design System — Color Tokens
 *
 * Centralized color definitions following the existing brand guidelines.
 * All components should reference these tokens instead of hardcoded values.
 */

export const colors = {
  // Primary brand color (Clearline Blue)
  primary: {
    DEFAULT: '#137fec',
    50:  '#eff8ff',
    100: '#dcf0ff',
    500: '#137fec',
    600: '#0f6dd6',
    700: '#0b5ab0',
  },

  // Semantic colors for feedback
  success: {
    DEFAULT: '#10b981',
    50:  '#ecfdf5',
    500: '#10b981',
    600: '#059669',
  },

  warning: {
    DEFAULT: '#f59e0b',
    50:  '#fffbeb',
    500: '#f59e0b',
    600: '#d97706',
  },

  error: {
    DEFAULT: '#ef4444',
    50:  '#fef2f2',
    500: '#ef4444',
    600: '#dc2626',
  },

  // Neutral grays
  gray: {
    50:  '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },

  // Healthcare-specific (MLR status colors)
  mlr: {
    loss:       '#ef4444', // Red - MLR > 75%
    warning:    '#f59e0b', // Amber - MLR 70-75%
    profitable: '#10b981', // Green - MLR <= 70%
  },
} as const

export type ColorToken = typeof colors
